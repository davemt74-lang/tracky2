import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 MAX_RECORDINGS,createRecordingRecord,failRecordingRecord,finishRecordingRecord,
 normalizeRecordingRecord,recordingIdsForStoragePressure,recordingIdsToExpire,recordingIdsToPrune,
 recordingMediaState,recordingMetadataExport,recordingPlaybackDescriptor,
 recordingTurnIdsForInterval,recoverInterruptedRecording
} from '../src/recording-core.js';

test('13E recording requires canonical session and explicit-owner consent metadata',()=>{
 const row=createRecordingRecord({id:'r1',sessionId:'s1',retentionDays:7,mimeType:'audio/webm'},1000);
 assert.equal(row.status,'recording');
 assert.equal(row.mediaState,'pending');
 assert.equal(row.consent.mode,'explicit-owner');
 assert.equal(row.consent.grantedAt,1000);
 assert.equal(row.expiresAt,1000+7*86400000);
});

test('13E finalized recording stores media metadata and canonical turn ids, not transcript text',()=>{
 const row=createRecordingRecord({id:'r1',sessionId:'s1'},1000);
 const done=finishRecordingRecord(row,{
  chunkCount:2,bytes:1200,mimeType:'audio/webm',
  transcriptTurnIds:['t1','t2'],stoppedReason:'owner-stop'
 },5000);
 assert.equal(done.status,'available');
 assert.equal(done.mediaState,'available');
 assert.equal(done.durationMs,4000);
 assert.deepEqual(done.transcriptTurnIds,['t1','t2']);
 assert.equal('transcript' in done,false);
});

test('13E transcript alignment uses canonical turn ids and current session/time bounds',()=>{
 const turns=[
  {id:'old',sessionId:'s1',createdAt:new Date(500).toISOString()},
  {id:'a',sessionId:'s1',createdAt:new Date(1200).toISOString()},
  {id:'b',sessionId:'s1',createdAt:new Date(3000).toISOString()},
  {id:'other',sessionId:'s2',createdAt:new Date(2000).toISOString()},
  {id:'late',sessionId:'s1',createdAt:new Date(6000).toISOString()}
 ];
 assert.deepEqual(recordingTurnIdsForInterval(turns,'s1',1000,5000),['a','b']);
});

test('13E abrupt active recording recovers as damaged/missing instead of pretending complete',()=>{
 const noChunks=recoverInterruptedRecording(createRecordingRecord({id:'r1',sessionId:'s1'},1000),5000);
 assert.equal(noChunks.status,'missing');
 const partial=recoverInterruptedRecording(normalizeRecordingRecord({
  ...createRecordingRecord({id:'r2',sessionId:'s1'},1000),chunkCount:2,bytes:1000
 }),5000);
 assert.equal(partial.status,'damaged');
 assert.equal(partial.stoppedReason,'interrupted-recovered');
});

test('13E media validation detects missing chunks, gaps and byte mismatches',()=>{
 const record=finishRecordingRecord(createRecordingRecord({id:'r1',sessionId:'s1'},1000),{
  chunkCount:2,bytes:300,mimeType:'audio/webm'
 },3000);
 assert.equal(recordingMediaState(record,[]).state,'missing');
 assert.equal(recordingMediaState(record,[
  {seq:0,size:100},{seq:2,size:200}
 ]).reason,'chunk-sequence-gap');
 assert.equal(recordingMediaState(record,[
  {seq:0,size:100},{seq:1,size:100}
 ]).reason,'byte-count-mismatch');
 const available=recordingMediaState(record,[{seq:0,size:100},{seq:1,size:200}]);
 assert.equal(available.state,'available');
 assert.equal(recordingPlaybackDescriptor(record,available).playable,true);
});

test('13E retention expiry and bounded-recording pruning are deterministic',()=>{
 const rows=[];
 for(let i=0;i<MAX_RECORDINGS+5;i++){
  rows.push(finishRecordingRecord(createRecordingRecord({
   id:'r'+i,sessionId:'s1',retentionDays:1
  },1000+i),{chunkCount:1,bytes:10},2000+i));
 }
 assert.equal(recordingIdsToPrune(rows).length,5);
 assert.equal(recordingIdsToExpire(rows,1000+86400000+1000).length,rows.length);
});

test('13E storage pressure selects oldest completed recordings only until target ratio',()=>{
 const rows=[
  finishRecordingRecord(createRecordingRecord({id:'a',sessionId:'s1'},1000),{chunkCount:1,bytes:20},2000),
  finishRecordingRecord(createRecordingRecord({id:'b',sessionId:'s1'},3000),{chunkCount:1,bytes:30},4000),
  normalizeRecordingRecord({...createRecordingRecord({id:'live',sessionId:'s1'},5000),bytes:100})
 ];
 assert.deepEqual(recordingIdsForStoragePressure(rows,{usage:90,quota:100,highRatio:.85,targetRatio:.5}),['a','b']);
 assert.deepEqual(recordingIdsForStoragePressure(rows,{usage:70,quota:100}),[]);
});

test('13E failed recording is explicit and never becomes playable',()=>{
 const failed=failRecordingRecord(createRecordingRecord({id:'r1',sessionId:'s1'},1000),'media-recorder-error',2000);
 assert.equal(failed.status,'failed');
 assert.equal(recordingPlaybackDescriptor(failed).playable,false);
});

test('13E metadata export contains no media payload or copied transcript text',()=>{
 const row=finishRecordingRecord(createRecordingRecord({id:'r1',sessionId:'s1'},1000),{
  chunkCount:2,bytes:300,transcriptTurnIds:['t1']
 },3000);
 const json=JSON.stringify(recordingMetadataExport([row]));
 for(const forbidden of ['blob','chunks','rawAudio','samples','transcriptText','pcm'])
  assert.equal(json.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
 assert.match(json,/media-excluded/);
});

test('13E participant store owns recording metadata/media stores and DB migration',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const version=Number(store.match(/const DB_VERSION = (\d+)/)?.[1]||0);
 assert.ok(version>=10);
 assert.match(store,/const RECORDINGS = 'recordings'/);
 assert.match(store,/const RECORDING_MEDIA = 'recording-media'/);
 assert.match(store,/export async function saveRecording/);
 assert.match(store,/export async function saveRecordingChunk/);
 assert.match(store,/export function listRecordings/);
 assert.match(store,/export async function getRecordingMedia/);
 assert.match(store,/export async function deleteRecording/);
 assert.match(store,/export async function pruneExpiredRecordings/);
});

test('13E participant deletion scrubs recording turn references without deleting unrelated media',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const start=store.indexOf('export async function deleteParticipant');
 const block=store.slice(start,start+11000);
 assert.match(block,/RECORDINGS/);
 assert.match(block,/transcriptTurnIds/);
 assert.match(block,/deletedTurnIds/);
 assert.doesNotMatch(block,/recordingMedia\.delete/);
});

test('13E runtime records only from the existing RoomAudioCapture stream',()=>{
 const ui=fs.readFileSync('src/recording-ui.js','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/getStream:\(\)=>state\.voice\.audio\?\.stream\|\|null/);
 assert.doesNotMatch(ui,/getUserMedia\(/);
 assert.match(ui,/MediaRecorder/);
 assert.match(ui,/saveRecordingChunk/);
});

test('13E session recall includes canonical recording metadata while export remains media-free',()=>{
 const recall=fs.readFileSync('src/session-recall-ui.js','utf8');
 const core=fs.readFileSync('src/session-recall-core.js','utf8');
 const identity=fs.readFileSync('src/session-identity-core.js','utf8');
 assert.match(recall,/listRecordings/);
 assert.match(recall,/recordings/);
 assert.match(core,/'recording'/);
 assert.match(core,/canonical-recording-metadata/);
 assert.match(identity,/canonical-recording-reference/);
 assert.doesNotMatch(identity,/Blob|arrayBuffer|MediaRecorder/);
});

test('13E pure recording core opens no sensor, storage or network path',()=>{
 const core=fs.readFileSync('src/recording-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|Blob/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 TranscriptLifecycleController,canonicalTranscriptFields,searchTranscriptTurns,
 transcriptExport,transcriptSessionSummaries,TRANSCRIPT_LIFECYCLE_VERSION
} from '../src/transcript-lifecycle-core.js';
import {reviseTranscriptRecord} from '../src/transcript-correction.js';
import {conversationTimeline} from '../src/conversation-timeline.js';
import {TRANSCRIPTION_MODEL_ID,TRANSCRIPTION_MODEL_REVISION} from '../src/model-config.js';

test('11C pending to partial to final reconciliation keeps partial hypotheses ephemeral',()=>{
 const lifecycle=new TranscriptLifecycleController();
 const pending=lifecycle.begin({segmentId:'seg-1',generation:2,sessionId:'s1',
  source:'local-whisper',captureDurationMs:2200,at:1000});
 assert.equal(pending.state,'pending');
 const partial=lifecycle.partial('seg-1','  hello wor ',{at:1100,confidence:.4});
 assert.equal(partial.state,'partial');
 assert.equal(partial.partialText,'hello wor');
 assert.equal(partial.ephemeral,true);
 assert.equal(partial.text,'');
 const final=lifecycle.finalize('seg-1',{text:' Hello world. ',at:1500,confidence:.82,
  language:'en',source:'local-whisper',modelId:'model',modelRevision:'rev',
  processingDurationMs:420});
 assert.equal(final.state,'final');
 assert.equal(final.text,'Hello world.');
 assert.equal(final.partialText,'');
 assert.equal(final.confidence,.82);
 assert.equal(final.processingDurationMs,420);
 assert.equal(lifecycle.get('seg-1').state,'final');
});

test('11C cancellation rejects stale transcription finalization',()=>{
 const lifecycle=new TranscriptLifecycleController();
 lifecycle.begin({segmentId:'stale',generation:3,at:1000});
 const cancelled=lifecycle.cancel('stale','generation-invalidated',1200);
 assert.equal(cancelled.state,'cancelled');
 assert.equal(cancelled.cancelReason,'generation-invalidated');
 assert.equal(lifecycle.finalize('stale',{text:'late result',at:1300}),null);
});

test('11C canonical fields persist final provenance, timing and segment boundary only',()=>{
 const lifecycle=new TranscriptLifecycleController();
 lifecycle.begin({segmentId:'seg-a',sessionId:'session-a',captureDurationMs:3100,at:1000});
 const final=lifecycle.finalize('seg-a',{text:'first turn',at:1400,source:'local-whisper',
  modelId:TRANSCRIPTION_MODEL_ID,modelRevision:TRANSCRIPTION_MODEL_REVISION,
  processingDurationMs:390});
 const fields=canonicalTranscriptFields(final);
 assert.equal(fields.transcriptLifecycleVersion,TRANSCRIPT_LIFECYCLE_VERSION);
 assert.equal(fields.transcriptState,'final');
 assert.equal(fields.transcriptSegmentId,'seg-a');
 assert.equal(fields.transcriptModelId,TRANSCRIPTION_MODEL_ID);
 assert.equal(fields.transcriptModelRevision,TRANSCRIPTION_MODEL_REVISION);
 assert.equal(fields.transcriptCaptureDurationMs,3100);
 assert.equal(fields.transcriptProcessingDurationMs,390);
 assert.equal(fields.transcriptConfidence,null);

 const lifecycle2=new TranscriptLifecycleController();
 lifecycle2.begin({segmentId:'seg-b',sessionId:'session-a',at:2000});
 const second=canonicalTranscriptFields(lifecycle2.finalize('seg-b',{text:'second turn',at:2200}));
 assert.equal(second.transcriptSegmentId,'seg-b');
 assert.notEqual(second.transcriptSegmentId,fields.transcriptSegmentId,
  'speaker/audio segment boundaries must remain separate canonical transcript boundaries');
});

test('11C session summaries segment canonical history without duplicating transcript records',()=>{
 const turns=[
  {id:'1',sessionId:'s1',transcript:'one',createdAt:'2026-10-04T10:00:00Z',participantId:'p1',transcriptState:'final'},
  {id:'2',sessionId:'s1',transcript:'two',createdAt:'2026-10-04T10:00:05Z',participantId:null,transcriptState:'corrected'},
  {id:'3',sessionId:'s2',transcript:'three',createdAt:'2026-10-04T11:00:00Z',participantId:'p2',transcriptState:'final'}
 ];
 const summaries=transcriptSessionSummaries(turns);
 assert.equal(summaries.length,2);
 const s1=summaries.find(x=>x.sessionId==='s1');
 assert.equal(s1.turnCount,2);
 assert.equal(s1.transcriptCount,2);
 assert.equal(s1.correctedCount,1);
 assert.deepEqual(s1.participantIds,['p1']);
 assert.ok(s1.endedAt>s1.startedAt);
});

test('11C search uses canonical transcript text with session and participant filters',()=>{
 const turns=[
  {id:'1',sessionId:'s1',participantId:'p1',transcript:'Order the green tea',createdAt:'2026-10-04T10:00:00Z'},
  {id:'2',sessionId:'s2',participantId:'p2',transcript:'Green room is ready',createdAt:'2026-10-04T11:00:00Z'},
  {id:'3',sessionId:'s1',participantId:null,transcript:'Background sentence',createdAt:'2026-10-04T12:00:00Z'}
 ];
 assert.deepEqual(searchTranscriptTurns(turns,'green').map(x=>x.id),['2','1']);
 assert.deepEqual(searchTranscriptTurns(turns,'green',{sessionId:'s1'}).map(x=>x.id),['1']);
 assert.deepEqual(searchTranscriptTurns(turns,'green',{participantId:'p2'}).map(x=>x.id),['2']);
 assert.equal(searchTranscriptTurns(turns,'').length,0);
});

test('11C transcript export contains text/provenance but strips media, embeddings and unrelated fields',()=>{
 const turns=[{
  id:'t1',sessionId:'s1',participantId:'p1',participantName:'Old name',
  transcript:'Canonical words',transcriptState:'final',transcriptSource:'local-whisper',
  transcriptModelId:TRANSCRIPTION_MODEL_ID,transcriptModelRevision:TRANSCRIPTION_MODEL_REVISION,
  transcriptConfidence:null,transcriptCaptureDurationMs:2000,transcriptProcessingDurationMs:350,
  transcribedAt:'2026-10-04T10:00:01Z',createdAt:'2026-10-04T10:00:01Z',
  attribution:'voice+body',associationState:'verified-voice+face-body',
  samples:[1,2],embedding:[3,4],photo:'data:image/png;base64,AAA',rawAudio:'secret'
 }];
 const payload=transcriptExport(turns,[{id:'p1',name:'Pat',primaryPhoto:'secret',voiceEmbeddings:[[1]]}]);
 assert.equal(payload.schema,'tracky2-transcript-export-v1');
 assert.equal(payload.turnCount,1);
 assert.equal(payload.turns[0].participantName,'Pat');
 assert.equal(payload.turns[0].transcript,'Canonical words');
 const json=JSON.stringify(payload);
 for(const forbidden of ['primaryPhoto','voiceEmbeddings','embedding','rawAudio','samples'])
  assert.equal(json.includes(forbidden),false,forbidden+' must not be exported');
});

test('11C owner correction changes lifecycle to corrected but preserves identity and original model provenance',()=>{
 const original={
  id:'turn-1',transcript:'helo world',participantId:'p1',participantName:'Pat',
  attribution:'voice+body',associationState:'verified-voice+body',
  transcriptState:'final',transcriptSource:'local-whisper',
  transcriptModelId:TRANSCRIPTION_MODEL_ID,transcriptModelRevision:TRANSCRIPTION_MODEL_REVISION
 };
 const corrected=reviseTranscriptRecord(original,'hello world',2000);
 assert.equal(corrected.transcriptState,'corrected');
 assert.equal(corrected.transcript,'hello world');
 assert.equal(corrected.originalTranscript,'helo world');
 assert.equal(corrected.participantId,'p1');
 assert.equal(corrected.attribution,'voice+body');
 assert.equal(corrected.associationState,'verified-voice+body');
 assert.equal(corrected.transcriptCorrectionProvenance.source,'local-owner');
 assert.equal(corrected.transcriptCorrectionProvenance.originalModelId,TRANSCRIPTION_MODEL_ID);
 assert.equal(corrected.transcriptCorrectionProvenance.originalModelRevision,TRANSCRIPTION_MODEL_REVISION);
 assert.equal(corrected.transcriptRevisions[0].previousState,'final');
});

test('11C conversation timeline exposes canonical transcript state/model data without a second transcript copy',()=>{
 const turns=[{
  id:'t1',transcript:'hello',participantId:'p1',participantName:'Pat',attribution:'voice-only',
  associationState:'verified-voice-only',createdAt:'2026-10-04T10:00:00Z',
  transcriptState:'final',transcriptSource:'local-whisper',
  transcriptModelId:TRANSCRIPTION_MODEL_ID,transcriptModelRevision:TRANSCRIPTION_MODEL_REVISION,
  transcriptProcessingDurationMs:222
 }];
 const rows=conversationTimeline(turns,[{role:'participant',text:'stale duplicate',at:1}],[{id:'p1',name:'Pat'}]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].text,'hello');
 assert.equal(rows[0].transcriptState,'final');
 assert.equal(rows[0].transcriptModelRevision,TRANSCRIPTION_MODEL_REVISION);
 assert.equal(rows[0].transcriptProcessingDurationMs,222);
});

test('11C canonical store rejects ephemeral states and strips raw media-shaped fields',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(store,/\['pending','partial','cancelled'\]\.includes\(input\.transcriptState\)/);
 assert.match(store,/Ephemeral transcript lifecycle state cannot be persisted/);
 assert.match(store,/partialText:discardPartial/);
 assert.match(store,/samples:discardSamples/);
 assert.match(store,/rawAudio:discardRawAudio/);
 assert.match(store,/transcriptState:safeInput\.transcriptState/);
});

test('11C local Whisper path exposes exact pinned source/model revision and keeps compatibility text method',()=>{
 const engine=fs.readFileSync('src/room-audio-engine.js','utf8');
 assert.match(engine,/async transcribeDetailed\(samples\)/);
 assert.match(engine,/source:'local-whisper'/);
 assert.match(engine,/modelId:TRANSCRIPTION_MODEL_ID/);
 assert.match(engine,/modelRevision:TRANSCRIPTION_MODEL_REVISION/);
 assert.match(engine,/processingDurationMs/);
 assert.match(engine,/return \(await this\.transcribeDetailed\(samples\)\)\.text/);
 assert.equal(typeof TRANSCRIPTION_MODEL_REVISION,'string');
 assert.ok(TRANSCRIPTION_MODEL_REVISION.length>=7);
});

test('11C runtime rejects stale transcription results before canonical save and never persists a partial hypothesis',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const begin=runtime.indexOf('transcriptLifecycle.begin({');
 const detail=runtime.indexOf('transcribeDetailed(segment.samples)',begin);
 const stale=runtime.indexOf("transcriptLifecycle.cancel(segment.segmentId,'stale-transcription-result'",detail);
 const fields=runtime.indexOf('canonicalTranscriptFields(transcriptRecord)',stale);
 const save=runtime.indexOf('savedTurn = await saveDialogueTurn',fields);
 assert.ok(begin>0&&detail>begin&&stale>detail&&fields>stale&&save>fields);
 assert.match(runtime,/currentTranscriptState='pending'/);
 assert.match(runtime,/currentTranscriptState='cancelled'/);
 assert.match(runtime,/transcriptLifecycle\.forget\(segment\?\.segmentId\)/);
 assert.doesNotMatch(runtime,/saveDialogueTurn\(\{[^}]*partialText/s);
});

test('11C UI provides explicit local transcript search/export and labels export privacy boundary',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 for(const id of ['transcriptSearch','transcriptSearchRun','transcriptExportSession',
  'transcriptExportAll','transcriptSessionSummary','transcriptSearchResults'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(runtime,/searchTranscriptTurns\(rows,query/);
 assert.match(runtime,/transcriptExport\(rows,state\.identity\.participants/);
 assert.match(runtime,/text\/provenance only · no audio, photos or biometrics/);
 assert.match(agent,/Transcript · /);
 assert.match(agent,/transcriptModelRevision/);
});

test('11C lifecycle module is pure metadata/text coordination and never opens media/model/network paths',()=>{
 const core=fs.readFileSync('src/transcript-lifecycle-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|pipeline\(|embedding\(|Float32Array/);
});

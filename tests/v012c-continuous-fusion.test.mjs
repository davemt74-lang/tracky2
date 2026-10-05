import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 ContinuousSpeakerFusionTracker,continuousFusionTurnFields,recordVisualHistory,
 summarizeContinuousFusion,visualSnapshotForWindow
} from '../src/continuous-fusion-core.js';

const fusion=(participantId,extra={})=>({
 participantId,decision:'verified',confidence:.9,state:'verified-multimodal',
 trackId:'T1',provenance:['voice:voice-profile-match'],conflicts:[],...extra
});

test('12C visual history is bounded and aligns a speaker window to nearest camera snapshot',()=>{
 let history=[];
 for(let i=0;i<100;i++)history=recordVisualHistory(history,{
  at:i*500,tracks:[{id:'T1',participantId:'p1',status:'matched',similarity:.9}]
 },{maxEntries:20,maxAgeMs:10000});
 assert.ok(history.length<=20);
 const snap=visualSnapshotForWindow(history,{
  segmentStartedAt:45000,startOffsetMs:1000,endOffsetMs:2000,maxSkewMs:1000
 });
 assert.equal(snap.state,'camera-current');
 assert.ok(snap.currentParticipantIds.includes('p1'));
});

test('12C camera loss does not block voice-anchored cluster identity',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 const result=tracker.observe({
  clusterId:'D1',fusion:fusion('p1',{state:'verified-voice-only',trackId:null}),
  at:1000,activeParticipantIds:['p1'],
  currentVisualParticipantIds:[],occludedParticipantIds:[]
 });
 assert.equal(result.participantId,'p1');
 assert.equal(result.state,'verified');
});

test('12C visual evidence alone never creates a new speaker-cluster identity',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 const result=tracker.observe({
  clusterId:'D1',fusion:{participantId:null,decision:'abstain',provenance:['face:live-face-identity']},
  at:1000,activeParticipantIds:['p1'],currentVisualParticipantIds:['p1']
 });
 assert.equal(result.participantId,null);
 assert.equal(result.state,'unknown');
});

test('12C short voice-unmatched interval carries prior cluster identity with conservative decay',()=>{
 const tracker=new ContinuousSpeakerFusionTracker({carryMs:10000});
 tracker.observe({clusterId:'D1',fusion:fusion('p1'),at:1000,
  activeParticipantIds:['p1'],currentVisualParticipantIds:['p1']});
 const carried=tracker.observe({
  clusterId:'D1',fusion:{participantId:null,decision:'abstain',provenance:[]},
  at:5000,activeParticipantIds:['p1'],currentVisualParticipantIds:['p1']
 });
 assert.equal(carried.participantId,'p1');
 assert.equal(carried.state,'continuity');
 assert.ok(carried.confidence<.9);
 assert.ok(carried.provenance.includes('current-visual-support'));
});

test('12C occlusion keeps bounded continuity but stale carry expires',()=>{
 const tracker=new ContinuousSpeakerFusionTracker({carryMs:6000});
 tracker.observe({clusterId:'D1',fusion:fusion('p1'),at:1000,
  activeParticipantIds:['p1'],currentVisualParticipantIds:['p1']});
 const occluded=tracker.observe({
  clusterId:'D1',fusion:{participantId:null,decision:'abstain'},
  at:4000,activeParticipantIds:['p1'],currentVisualParticipantIds:[],
  occludedParticipantIds:['p1']
 });
 assert.equal(occluded.participantId,'p1');
 assert.ok(occluded.provenance.includes('occluded-visual-continuity'));
 const expired=tracker.observe({
  clusterId:'D1',fusion:{participantId:null,decision:'abstain'},
  at:8000,activeParticipantIds:['p1']
 });
 assert.equal(expired.participantId,null);
 assert.equal(expired.state,'expired');
});

test('12C cross-path contradictory verification abstains before confirmed cluster handoff',()=>{
 const tracker=new ContinuousSpeakerFusionTracker({handoffConfirmations:2});
 tracker.observe({clusterId:'D1',fusion:fusion('p1'),at:1000,activeParticipantIds:['p1','p2']});
 const conflict=tracker.observe({clusterId:'D1',fusion:fusion('p2',{trackId:'T2'}),at:2000,
  activeParticipantIds:['p1','p2'],currentVisualParticipantIds:['p1','p2']});
 assert.equal(conflict.participantId,null);
 assert.equal(conflict.state,'identity-conflict');
 assert.ok(conflict.conflicts.includes('verified-participant-challenger'));
 const handoff=tracker.observe({clusterId:'D1',fusion:fusion('p2',{trackId:'T2'}),at:2500,
  activeParticipantIds:['p1','p2'],currentVisualParticipantIds:['p2']});
 assert.equal(handoff.participantId,'p2');
 assert.equal(handoff.state,'handoff');
});

test('12C visible conflicting person cannot silently steal an existing cluster',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 tracker.observe({clusterId:'D1',fusion:fusion('p1'),at:1000,activeParticipantIds:['p1','p2']});
 const result=tracker.observe({
  clusterId:'D1',fusion:{participantId:null,decision:'abstain'},at:3000,
  activeParticipantIds:['p1','p2'],currentVisualParticipantIds:['p2']
 });
 assert.equal(result.participantId,null);
 assert.equal(result.state,'visual-conflict');
 assert.ok(result.conflicts.includes('mapped-participant-not-currently-visible'));
});

test('12C participant deletion/revocation removes carried cluster identity',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 tracker.observe({clusterId:'D1',fusion:fusion('p1'),at:1000,activeParticipantIds:['p1']});
 tracker.reconcile([]);
 assert.equal(tracker.snapshot().length,0);
 const result=tracker.observe({
  clusterId:'D1',fusion:{participantId:null,decision:'abstain'},at:2000,
  activeParticipantIds:[],currentVisualParticipantIds:[]
 });
 assert.equal(result.participantId,null);
});

test('12C cancelled segment work can be forked without poisoning accepted continuity state',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 tracker.observe({clusterId:'D1',fusion:fusion('p1'),at:1000,activeParticipantIds:['p1','p2']});
 const working=tracker.fork();
 working.observe({clusterId:'D1',fusion:fusion('p2'),at:2000,activeParticipantIds:['p1','p2']});
 assert.equal(tracker.snapshot()[0].participantId,'p1');
 const accepted=tracker.fork();
 accepted.observe({clusterId:'D1',fusion:fusion('p1'),at:2500,activeParticipantIds:['p1','p2']});
 tracker.commitFrom(accepted);
 assert.equal(tracker.snapshot()[0].participantId,'p1');
});

test('12C canonical fields are bounded provenance only and contain no biometric/audio payload',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 const row=tracker.observe({clusterId:'D1',fusion:fusion('p1'),at:1000,
  activeParticipantIds:['p1'],currentVisualParticipantIds:['p1']});
 const fields=continuousFusionTurnFields(summarizeContinuousFusion([row]));
 assert.deepEqual(fields.continuousFusionParticipantIds,['p1']);
 const json=JSON.stringify(fields);
 for(const forbidden of ['embedding','samples','pcm','primaryPhoto','rawAudio'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('12C runtime records bounded camera history and aligns each diarized window to camera evidence',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/recordRoomTrackHistory\(now\)/);
 assert.match(runtime,/roomTrackHistoryForSegment\(segment\)/);
 assert.match(runtime,/visualSnapshotForWindow\(/);
 assert.match(runtime,/ContinuousSpeakerFusionTracker/);
 assert.match(runtime,/continuousFusionTurnFields\(/);
});

test('12C participant deletion scrubs continuous-fusion participant references',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const start=store.indexOf('export async function deleteParticipant(');
 const end=store.indexOf('export async function prunePendingCaptures',start);
 const block=store.slice(start,end);
 assert.match(block,/continuousFusionParticipantIds/);
 assert.match(block,/continuousFusionClusterLinks/);
 assert.match(block,/continuousFusionWindowLinks/);
});

test('12C pure fusion layer has no media, persistence or network side effects',()=>{
 const core=fs.readFileSync('src/continuous-fusion-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
});

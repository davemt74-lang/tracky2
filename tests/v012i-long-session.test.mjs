import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 LONG_SESSION_MAX_PARTICIPANT_REFS,boundedParticipantIds,longSessionHealth,
 reconcileParticipantMap,reconcileParticipantSet,reconcileTransientDialogueTurns,
 restartIntegritySnapshot
} from '../src/long-session-core.js';
import {
 ConversationListeningController
} from '../src/conversation-listening-core.js';
import {
 DIARIZATION_MAX_CLUSTERS,SpeakerDiarizationSession
} from '../src/speaker-diarization-core.js';
import {
 CONTINUOUS_FUSION_MAX_LINKS,ContinuousSpeakerFusionTracker,
 VISUAL_HISTORY_MAX_ENTRIES,recordVisualHistory
} from '../src/continuous-fusion-core.js';
import {RoomEventLedger,MAX_ROOM_EVENTS,roomObservation} from '../src/room-event-core.js';
import {RecoveryBudget,storagePressure} from '../src/runtime-resilience-core.js';
import {MAX_ACTIVITY_ITEMS,activityEvent,addActivity} from '../src/player-activity.js';

const pcm=()=>new Float32Array(16000).fill(.02);

test('12I listening stress remains bounded and restart generation invalidates queued work',()=>{
 const c=new ConversationListeningController({maxQueue:4});
 c.start(1,0);
 for(let i=0;i<1000;i++)c.enqueue({
  samples:pcm(),startedAt:i*10,endedAt:i*10+1000
 },{generation:1,now:i*10});
 assert.ok(c.snapshot().queueDepth<=4);
 assert.ok(c.snapshot().droppedOverflow>0);
 const first=c.beginNext(10000).segment;
 assert.ok(first);
 c.invalidateGeneration(2,'stress-restart',10001);
 const snapshot=c.snapshot();
 assert.equal(snapshot.queueDepth,0);
 assert.equal(snapshot.processingSegmentId,null);
 assert.equal(c.canContinue(first,10002).valid,false);
});

test('12I diarization stress cannot exceed cluster capacity',()=>{
 const d=new SpeakerDiarizationSession();
 for(let i=0;i<500;i++){
  const e=Array.from({length:16},(_,j)=>Math.sin((i+1)*(j+1)));
  d.assign({embedding:e,windowId:'w'+i,quality:1});
 }
 assert.ok(d.snapshot().clusterCount<=DIARIZATION_MAX_CLUSTERS);
 assert.equal(d.snapshot().windowCount,500);
});

test('12I continuous fusion participant churn reconciles removed identities',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 for(let i=0;i<4;i++){
  const id='p'+i;
  tracker.observe({
   clusterId:'D'+(i+1),at:i+1,activeParticipantIds:[id],
   fusion:{participantId:id,decision:'verified',confidence:.9,trackId:'t'+i,provenance:[]}
  });
 }
 assert.equal(tracker.snapshot().length,4);
 tracker.reconcile(['p3']);
 assert.deepEqual(tracker.snapshot().map(row=>row.participantId),['p3']);
 tracker.reconcile([]);
 assert.equal(tracker.snapshot().length,0);
});

test('12I continuous fusion hard-caps pathological cluster churn',()=>{
 const tracker=new ContinuousSpeakerFusionTracker();
 const active=['p1'];
 for(let i=0;i<100;i++){
  tracker.observe({
   clusterId:'cluster-'+i,at:i+1,activeParticipantIds:active,
   fusion:{participantId:'p1',decision:'verified',confidence:.9,trackId:'t1',provenance:[]}
  });
 }
 assert.ok(tracker.snapshot().length<=CONTINUOUS_FUSION_MAX_LINKS);
 assert.deepEqual(tracker.snapshot().map(row=>row.clusterId),
  Array.from({length:CONTINUOUS_FUSION_MAX_LINKS},(_,i)=>
   'cluster-'+(100-CONTINUOUS_FUSION_MAX_LINKS+i)));
});

test('12I visual history stays bounded through a long camera run',()=>{
 let history=[];
 for(let i=0;i<5000;i++)history=recordVisualHistory(history,{
  at:i*100,tracks:[{id:'t1',participantId:'p1',status:'matched',cx:.5,cy:.5}]
 },{now:i*100});
 assert.ok(history.length<=VISUAL_HISTORY_MAX_ENTRIES);
 assert.ok(history.every(row=>history.at(-1).at-row.at<=30000));
});

test('12I ROOM and activity histories stay bounded under event pressure',()=>{
 const room=new RoomEventLedger();
 let activity=[];
 for(let i=0;i<1000;i++){
  room.append(roomObservation({
   id:'r'+i,at:i,category:'activity',message:'event '+i,source:'stress',
   semantic:'stress-event',dedupeKey:'stress-'+i
  },i));
  activity=addActivity(activity,activityEvent({
   participantId:'p1',name:'Pat',kind:'zone',detail:'Zone '+((i%4)+1),at:i*1200
  }));
 }
 assert.equal(room.entries().length,MAX_ROOM_EVENTS);
 assert.ok(activity.length<=MAX_ACTIVITY_ITEMS);
});

test('12I participant churn prunes stale runtime refs and enforces hard cap',()=>{
 const valid=['p997','p998','p999'];
 const many=Array.from({length:1000},(_,i)=>'p'+i);
 assert.deepEqual([...reconcileParticipantSet(many,valid)],valid);
 assert.deepEqual([...reconcileParticipantMap(many.map((id,i)=>[id,i]),valid)],
  [['p997',997],['p998',998],['p999',999]]);
 assert.equal(boundedParticipantIds(many).length,LONG_SESSION_MAX_PARTICIPANT_REFS);
});

test('12I transient canonical dialogue projection scrubs deleted participant references',()=>{
 const turns=[{
  id:'direct',participantId:'gone',transcript:'delete me',
  nearbyParticipantIds:['gone','keep']
 },{
  id:'context',participantId:'keep',transcript:'keep me',
  nearbyParticipantIds:['gone','keep'],
  conversationParticipantIds:['gone','keep'],
  addressedParticipantId:'gone',addressedParticipantIds:['gone','keep'],
  multimodalContextParticipantIds:['gone','keep'],
  multimodalEvidence:[{participantId:'gone'},{participantId:'keep'}],
  continuousFusionParticipantIds:['gone','keep'],
  continuousFusionClusterLinks:[{participantId:'gone'},{participantId:'keep'}],
  continuousFusionWindowLinks:[{participantId:'gone'},{participantId:'keep'}],
  multiPersonParticipantIds:['gone','keep'],
  multiPersonCandidateParticipantIds:['gone','keep'],
  multiPersonAttributionIntervals:[{
   participantId:'gone',candidateParticipantIds:['gone','keep']
  }],
  multiPersonAttributionCorrections:[{
   participantId:'gone',previousParticipantId:'keep'
  }]
 }];
 const rows=reconcileTransientDialogueTurns(turns,['keep']);
 assert.equal(rows.length,1);
 const row=rows[0];
 assert.equal(row.id,'context');
 assert.deepEqual(row.nearbyParticipantIds,['keep']);
 assert.deepEqual(row.conversationParticipantIds,['keep']);
 assert.equal(row.addressedParticipantId,null);
 assert.deepEqual(row.addressedParticipantIds,['keep']);
 assert.deepEqual(row.multimodalEvidence.map(x=>x.participantId),['keep']);
 assert.deepEqual(row.continuousFusionClusterLinks.map(x=>x.participantId),['keep']);
 assert.equal(row.multiPersonAttributionIntervals[0].participantId,null);
 assert.deepEqual(row.multiPersonAttributionIntervals[0].candidateParticipantIds,['keep']);
});

test('12I recovery budget remains bounded and storage pressure disables optional persistence',()=>{
 const budget=new RecoveryBudget({maxAttempts:3,windowMs:10000,delays:[0,1,2]});
 for(let i=0;i<3;i++){
  assert.equal(budget.plan({now:i,permission:'granted',visible:true}).allowed,true);
  budget.record(i);
 }
 assert.equal(budget.plan({now:3,permission:'granted',visible:true}).reason,'retry-budget-exhausted');
 assert.equal(budget.snapshot(3).attempts,3);
 assert.equal(storagePressure({usage:95,quota:100}).optionalPersistence,false);
});

test('12I restart integrity flags transient state until queues/history/refs are cleared',()=>{
 const bad=restartIntegritySnapshot({
  listening:{queueDepth:1,processingSegmentId:'s1'},
  roomTrackHistory:[{at:1}],
  participantRefs:{seen:new Set(['p1'])},
  transientTurnState:{speaker:'p1'}
 });
 assert.equal(bad.clean,false);
 const clean=restartIntegritySnapshot({
  listening:{queueDepth:0,processingSegmentId:null},
  roomTrackHistory:[],participantRefs:{seen:new Set()},
  transientTurnState:{speaker:null,conflicts:[]}
 });
 assert.equal(clean.clean,true);
});

test('12I aggregate health detects only actual bound violations',()=>{
 const healthy=longSessionHealth({
  listening:{queueDepth:4},diarization:{clusterCount:4},
  continuousFusion:Array.from({length:4},(_,i)=>({clusterId:'D'+i})),
  roomEventCount:120,visualHistoryCount:72,activityEventCount:36,
  participantRefCounts:{announcedParticipants:3,seenParticipants:3,lastZones:3,greeted:3}
 });
 assert.equal(healthy.status,'healthy');
 const bad=longSessionHealth({...healthy,roomEventCount:121});
 assert.equal(bad.status,'degraded');
 assert.ok(bad.issues.includes('room-events-unbounded'));
});

test('12I runtime removes write-only announced track retention and reconciles participant refs',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.doesNotMatch(runtime,/announcedTracks/);
 assert.match(runtime,/reconcileLongSessionParticipantRefs\(participantIds\)/);
 assert.match(runtime,/agentRuntime\?\.reconcileParticipants\?\.\((?:ids|participantIds)\)/);
 assert.match(agent,/reconcileParticipants\(validIds=\[\]\)/);
});

test('12I manual stop and page lifecycle cancel recovery timers and transient audio work',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/cancelCameraRecovery\(\)/);
 assert.match(runtime,/cancelMicrophoneRecovery\(\)/);
 assert.match(runtime,/listeningController\.stop\(/);
 assert.match(runtime,/roomTrackHistory=\[\]/);
 assert.match(runtime,/window\.addEventListener\('pagehide'/);
});

test('12I pure long-session helpers open no sensors, persistence or network path',()=>{
 const core=fs.readFileSync('src/long-session-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildUnifiedCognitiveState,UnifiedCognitiveStateStore} from '../src/unified-cognitive-state-core.js';

test('15A builds one bounded metadata-only cognitive snapshot',()=>{
 const now=200000;
 const state=buildUnifiedCognitiveState({
  sessionId:'s1',room:{id:'room-1',name:'Living room',cameraActive:true,microphoneActive:true},
  participants:[{id:'p1',visible:true,speaking:false,lastObservedAt:199000,stationaryMs:70000}],
  conversation:{lastDialogueAt:180000,userSpeaking:false},
  media:{active:{status:'active',kind:'television',continuityId:'c1',lastAt:199000,identity:{title:'Show',confidence:.9}}},
  events:[{id:'e1',at:198000,semantic:'media-identification',confidence:.9}],
  memories:[{id:'m1',status:'active',type:'preference',text:'Likes sci-fi',persistent:true}],
  tasks:[{id:'t1',status:'scheduled',skillId:'describe_object'}],
  followThrough:{id:'f1',status:'pending-confirmation',action:'research',participantId:'p1'},
  agent:{pendingProactive:1,interruptionsThisHour:2},
  runtime:{performanceLevel:'normal'}
 },now);
 assert.equal(state.schema,1);
 assert.deepEqual(state.visibleParticipantIds,['p1']);
 assert.equal(state.media.identity.title,'Show');
 assert.equal(state.tasks.length,1);
 assert.equal(state.rawAudioStored,false);
 assert.equal(state.rawFramesStored,false);
});

test('15A removes expired memory and terminal task records',()=>{
 const now=5000;
 const state=buildUnifiedCognitiveState({
  memories:[
   {id:'m1',status:'active',text:'old',expiresAt:4000},
   {id:'m2',status:'revoked',text:'revoked'},
   {id:'m3',status:'active',text:'current',expiresAt:9000}
  ],
  tasks:[{id:'t1',status:'succeeded'},{id:'t2',status:'running'}]
 },now);
 assert.deepEqual(state.memories.map(x=>x.id),['m3']);
 assert.deepEqual(state.tasks.map(x=>x.id),['t2']);
});

test('15A stale evidence is represented instead of silently treated current',()=>{
 const state=buildUnifiedCognitiveState({
  participants:[{id:'p1',visible:true,lastObservedAt:1}],
  media:{active:{status:'active',kind:'music',lastAt:1}}
 },300000);
 assert.equal(state.participants[0].freshness,'stale');
 assert.ok(state.conflicts.includes('stale-active-media'));
});

test('15A conflicting simultaneous speakers are explicit',()=>{
 const state=buildUnifiedCognitiveState({
  participants:[
   {id:'p1',visible:true,speaking:true,lastObservedAt:1000},
   {id:'p2',visible:true,speaking:true,lastObservedAt:1000}
  ]
 },2000);
 assert.ok(state.conflicts.includes('multiple-current-speakers'));
});

test('15A store exposes transitions without persisting transient state across reset',()=>{
 const store=new UnifiedCognitiveStateStore();
 store.update({room:{id:'a'}},1000);
 store.update({room:{id:'b'}},2000);
 assert.equal(store.transition().sequence,2);
 assert.equal(store.transition().previous.room.id,'a');
 store.reset();
 assert.equal(store.snapshot(),null);
});

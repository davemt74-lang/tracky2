import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RoomLiveValidationTracker,roomAudioBehaviorPolicy,roomLiveValidationMessage
} from '../src/room-audio-live-validation-core.js';

test('14.9A verified live speech over background preserves media but blocks remote recognition',()=>{
 const policy=roomAudioBehaviorPolicy({
  speechOrigin:{state:'live',allowParticipantAttribution:true,mediaContext:{kind:'music'}}
 });
 assert.equal(policy.mode,'foreground-conversation-over-background');
 assert.equal(policy.allowConversation,true);
 assert.equal(policy.allowRemoteExactRecognition,false);
 assert.equal(policy.preserveBackgroundSession,true);
});

test('14.9A uncertain mixed speech blocks both conversation and remote media lookup',()=>{
 const policy=roomAudioBehaviorPolicy({
  speechOrigin:{state:'uncertain',allowConversation:false,mediaContext:{kind:'television'}}
 });
 assert.equal(policy.mode,'mixed-uncertain');
 assert.equal(policy.allowConversation,false);
 assert.equal(policy.allowRemoteDialogueLookup,false);
});

test('14.9A recorded speech allows background recognition path',()=>{
 const policy=roomAudioBehaviorPolicy({
  speechOrigin:{state:'recorded',allowConversation:false,mediaContext:{kind:'radio'}}
 });
 assert.equal(policy.mode,'background-media');
 assert.equal(policy.allowRemoteExactRecognition,true);
 assert.equal(policy.allowRemoteDialogueLookup,true);
});

test('14.9A validation tracker is bounded and metadata-only',()=>{
 const tracker=new RoomLiveValidationTracker({eventLimit:24});
 for(let i=0;i<40;i++)tracker.observeBackground({
  transition:i%5===0?'source-changed':'continued',
  state:{kind:i%2?'music':'television',confidence:.9},reason:'test'
 },1000+i*1000);
 const snap=tracker.snapshot(50000);
 assert.equal(snap.eventCount,24);
 assert.equal(snap.rawAudioStored,false);
 assert.equal(snap.participantId,null);
 assert.ok(snap.sourceChanges>0);
});

test('14.9A tracks foreground-over-background and mixed uncertainty',()=>{
 const tracker=new RoomLiveValidationTracker();
 tracker.observeSpeechOrigin({
  state:'live',allowParticipantAttribution:true,
  mediaContext:{kind:'music',confidence:.9},evidence:{voiceConfidence:.95},
  reason:'verified-live-speaker-over-recorded-media'
 },1000);
 tracker.observeSpeechOrigin({
  state:'uncertain',mediaContext:{kind:'television',confidence:.8},
  evidence:{voiceConfidence:.4},reason:'recorded-media-and-live-room-evidence-conflict'
 },2000);
 const snap=tracker.snapshot(3000);
 assert.equal(snap.foregroundOverBackground,1);
 assert.equal(snap.uncertainMixed,1);
});

test('14.9A provider failure and recovery are explicit and bounded',()=>{
 const tracker=new RoomLiveValidationTracker();
 tracker.observeProvider({provider:'acrcloud',status:'failure',reason:'timeout',at:1000});
 tracker.observeProvider({provider:'acrcloud',status:'success',at:2000});
 const snap=tracker.snapshot(2500);
 assert.equal(snap.providerFailures,1);
 assert.equal(snap.providerRecoveries,1);
 assert.match(roomLiveValidationMessage(snap),/1 provider failures/);
 assert.match(roomLiveValidationMessage(snap),/1 recoveries/);
});

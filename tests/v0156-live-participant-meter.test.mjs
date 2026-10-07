import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('post-V0.15.6 meter remains direct microphone UI',()=>{
 const result=roomMeterState({
  active:true,db:-31,noiseFloorDb:-59,vad:true
 });
 assert.equal(result.mode,'speech');
 assert.ok(result.level>0);
});

test('voice profile matching can never be a prerequisite for meter movement',()=>{
 const noProfile=roomMeterState({
  active:true,db:-32,noiseFloorDb:-60,vad:true
 });
 const unrelatedProfile=roomMeterState({
  active:true,db:-32,noiseFloorDb:-60,vad:true,
  participantId:'dave',voiceProfileReady:true,
  liveSpeakerParticipantId:'other',liveSpeakerConfidence:.99
 });
 assert.deepEqual(unrelatedProfile,noProfile);
});

test('rolling live speaker-filter side channel stays removed from capture core',()=>{
 const capture=read('src/room-audio-engine.js');
 const runtime=read('vertical-motion.js');
 assert.doesNotMatch(capture,/onVoiceWindow|pushVoicePreview|voiceWindowIntervalMs/);
 assert.doesNotMatch(runtime,/onRoomVoiceWindow|liveSpeakerFilterState|liveSpeakerParticipantId/);
 assert.match(runtime,/const result=roomMeterState\(shared\)/);
 assert.match(runtime,/onLevel: onRoomAudioLevel/);
});

test('voice profile evidence remains post-segment metadata and not meter authority',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function noteLiveVoiceProfileMatch');
 const end=runtime.indexOf('async function processRoomSegment',start);
 const block=runtime.slice(start,end);
 assert.match(block,/Voice-profile evidence belongs to post-segment attribution\/diagnostics/);
 assert.doesNotMatch(block,/liveSpeaker/);
});

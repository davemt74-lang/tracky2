import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  participantSignalLevel,
  roomMeterState
} from '../src/participant-audio-meter.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.15.6 participant meter is live even without a saved Voice Profile',()=>{
 const state=roomMeterState({
  active:true,participantId:'dave',speaking:true,
  liveDb:-31,noiseFloorDb:-59,
  voiceProfileReady:false,soleCandidate:true
 });
 assert.equal(state.mode,'live');
 assert.ok(state.level>0);
 assert.equal(state.profileFiltered,false);
});

test('V0.15.6 saved Voice Profile assists filtering but never gates meter availability',()=>{
 const pending=roomMeterState({
  active:true,participantId:'dave',speaking:true,
  liveDb:-32,noiseFloorDb:-60,
  voiceProfileReady:true,soleCandidate:true
 });
 assert.equal(pending.mode,'filtering');
 assert.ok(pending.level>0);

 const matched=roomMeterState({
  active:true,participantId:'dave',speaking:true,
  liveDb:-32,noiseFloorDb:-60,
  voiceProfileReady:true,liveSpeakerParticipantId:'dave',
  liveSpeakerConfidence:.91
 });
 assert.equal(matched.mode,'speaker');
 assert.ok(matched.level>0);
 assert.equal(matched.profileFiltered,true);
});

test('V0.15.6 Voice Profile filter suppresses another speaker/background from participant meter',()=>{
 const other=roomMeterState({
  active:true,participantId:'dave',speaking:true,
  liveDb:-24,noiseFloorDb:-58,
  voiceProfileReady:true,liveSpeakerParticipantId:'other',
  liveSpeakerConfidence:.93
 });
 assert.equal(other.mode,'background-filtered');
 assert.equal(other.level,0);

 const roomOnly=roomMeterState({
  active:true,participantId:'dave',speaking:false,
  liveDb:-39,noiseFloorDb:-44,voiceProfileReady:true,
  soleCandidate:true
 });
 assert.equal(roomOnly.mode,'quiet');
 assert.equal(roomOnly.level,0);
});

test('V0.15.6 meter level follows signal above adaptive room floor',()=>{
 assert.equal(participantSignalLevel(-50,-52),0);
 assert.ok(participantSignalLevel(-36,-58)>0);
 assert.ok(participantSignalLevel(-24,-58)>participantSignalLevel(-36,-58));
});

test('V0.15.6 runtime performs rolling speaker filtering during live speech',()=>{
 const capture=read('src/room-audio-engine.js');
 const runtime=read('vertical-motion.js');
 assert.match(capture,/onVoiceWindow/);
 assert.match(capture,/pushVoicePreview\(frame, db, now\)/);
 assert.match(capture,/voiceWindowIntervalMs = options\.voiceWindowIntervalMs \?\? 650/);
 assert.match(runtime,/async function onRoomVoiceWindow\(window\)/);
 assert.match(runtime,/onVoiceWindow: async \(window\) => onRoomVoiceWindow\(window\)/);
 assert.match(runtime,/liveSpeakerFilterState='rejected'/);
 assert.match(runtime,/heading\.textContent = 'VOICE INPUT'/);
 assert.match(runtime,/Live participant voice input filtered from room and background audio/);
});

test('V0.15.6 valid Voice Profile evidence no longer requires camera presence',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function noteLiveVoiceProfileMatch');
 const end=runtime.indexOf('async function processRoomSegment',start);
 const block=runtime.slice(start,end);
 assert.match(block,/state\.voice\.liveSpeakerParticipantId=participant\.id/);
 assert.doesNotMatch(block,/if\(!liveTrack\)return false/);
 assert.match(block,/if\(liveTrack\)\{/);
});

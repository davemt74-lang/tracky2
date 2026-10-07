import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

test('participant meter is driven directly by the live microphone',()=>{
 const result=roomMeterState({
  active:true,db:-30,noiseFloorDb:-58,vad:true
 });
 assert.equal(result.mode,'speech');
 assert.ok(result.level>0);
 assert.match(result.text,/VOICE INPUT/);
});

test('participant meter does not depend on profile enrollment or participant identity',()=>{
 const a=roomMeterState({active:true,db:-34,noiseFloorDb:-60,vad:true});
 const b=roomMeterState({
  active:true,db:-34,noiseFloorDb:-60,vad:true,
  participantId:'dave',voiceProfileReady:false,
  liveSpeakerParticipantId:'someone-else'
 });
 assert.deepEqual(b,a);
 assert.ok(a.level>0);
});

test('suppression and microphone stop are the only hard meter stops',()=>{
 assert.equal(roomMeterState({
  active:true,suppressed:true,db:-18,noiseFloorDb:-58,vad:true
 }).level,0);
 assert.equal(roomMeterState({
  active:false,db:-18,noiseFloorDb:-58,vad:true
 }).level,0);
});

test('quiet microphone level can still be visible without claiming speech',()=>{
 const result=roomMeterState({
  active:true,db:-48,noiseFloorDb:-55,vad:false
 });
 assert.equal(result.mode,'quiet');
 assert.ok(result.level>0);
});

test('AGENT sidebar consumes RoomAudioCapture live dB/VAD directly',()=>{
 const source=fs.readFileSync('vertical-motion.js','utf8');
 const capture=fs.readFileSync('src/room-audio-engine.js','utf8');
 const css=fs.readFileSync('agent-presence.css','utf8');

 assert.match(source,/db:state\.voice\.micDb/);
 assert.match(source,/noiseFloorDb:state\.voice\.noiseFloorDb/);
 assert.match(source,/vad:state\.voice\.vad/);
 assert.match(source,/const result=roomMeterState\(shared\)/);
 assert.match(source,/function onRoomAudioLevel\(level\)/);
 assert.match(source,/updateParticipantAudioMeters\(\)/);
 assert.doesNotMatch(source,/onRoomVoiceWindow/);
 assert.doesNotMatch(source,/liveSpeakerFilterState/);
 assert.doesNotMatch(capture,/onVoiceWindow|pushVoicePreview|voiceWindowIntervalMs/);
 assert.match(css,/participant-audio-meter\[data-mode="speech"\]/);
});

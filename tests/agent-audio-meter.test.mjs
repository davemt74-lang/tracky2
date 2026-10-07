import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

test('participant meter follows live user microphone input before a Voice Profile is required',()=>{
 const result=roomMeterState({
  active:true,participantId:'person-a',speaking:true,
  liveDb:-30,noiseFloorDb:-58,voiceProfileReady:false,soleCandidate:true
 });
 assert.equal(result.mode,'live');
 assert.ok(result.level>0);
 assert.equal(result.profileFiltered,false);
});

test('Voice Profile is a speaker/background filter, not a meter gate',()=>{
 const matched=roomMeterState({
  active:true,participantId:'alice',speaking:true,
  liveDb:-28,noiseFloorDb:-58,voiceProfileReady:true,
  liveSpeakerParticipantId:'alice',liveSpeakerConfidence:.92
 });
 assert.equal(matched.mode,'speaker');
 assert.ok(matched.level>0);
 assert.equal(matched.profileFiltered,true);

 const other=roomMeterState({
  active:true,participantId:'alice',speaking:true,
  liveDb:-24,noiseFloorDb:-58,voiceProfileReady:true,
  liveSpeakerParticipantId:'bob',liveSpeakerConfidence:.94
 });
 assert.equal(other.mode,'background-filtered');
 assert.equal(other.level,0);
});

test('suppression and room-level noise below the speech gate do not animate participant input',()=>{
 assert.equal(roomMeterState({
  active:true,suppressed:true,participantId:'p',speaking:true,
  liveDb:-18,noiseFloorDb:-58,soleCandidate:true
 }).level,0);
 assert.equal(roomMeterState({
  active:true,participantId:'p',speaking:false,
  liveDb:-44,noiseFloorDb:-47,soleCandidate:true
 }).level,0);
 assert.equal(roomMeterState({
  active:false,participantId:'p',speaking:true,
  liveDb:-18,noiseFloorDb:-58,soleCandidate:true
 }).level,0);
});

test('AGENT sidebar consumes live mic level while ROOM retains ambient monitoring',()=>{
 const source=fs.readFileSync('vertical-motion.js','utf8');
 const capture=fs.readFileSync('src/room-audio-engine.js','utf8');
 const css=fs.readFileSync('agent-presence.css','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');

 assert.match(source,/liveDb:state\.voice\.micDb/);
 assert.match(source,/noiseFloorDb:state\.voice\.noiseFloorDb/);
 assert.match(source,/speaking:state\.voice\.vad/);
 assert.match(source,/liveSpeakerFilterState==='matched'/);
 assert.match(source,/onVoiceWindow: async \(window\) => onRoomVoiceWindow\(window\)/);
 assert.match(capture,/pushVoicePreview\(frame, db, now\)/);
 assert.doesNotMatch(source,/Raw room VAD\/dB must NEVER animate/);
 assert.doesNotMatch(source,/heading\.textContent = 'ROOM MIC · SHARED INPUT'/);

 assert.match(agent,/\$\('roomAudioDiagnosticsMount'\)\.append\(live\)/);
 assert.match(html,/id="roomAmbientAudioMeter"/);
 assert.match(css,/participant-audio-meter\[data-mode="speaker"\]/);
 assert.match(css,/participant-audio-meter\[data-mode="filtering"\]/);
 assert.match(html,/id="roomAgentTab"/);
 assert.match(html,/id="agentLeftControls"(?! hidden)/);
});

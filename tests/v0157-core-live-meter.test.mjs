import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.15.7 live meter moves from microphone dB with no profile or identity inputs',()=>{
 const quiet=roomMeterState({active:true,db:-60,noiseFloorDb:-65,vad:false});
 const speech=roomMeterState({active:true,db:-28,noiseFloorDb:-58,vad:true});
 assert.equal(quiet.mode,'quiet');
 assert.equal(speech.mode,'speech');
 assert.ok(quiet.level>0);
 assert.ok(speech.level>quiet.level);
});

test('V0.15.7 profile and camera metadata cannot affect meter result',()=>{
 const baseline=roomMeterState({active:true,db:-33,noiseFloorDb:-59,vad:true});
 const noisyMetadata=roomMeterState({
  active:true,db:-33,noiseFloorDb:-59,vad:true,
  participantId:'dave',
  voiceProfileReady:false,
  liveSpeakerParticipantId:'other',
  liveSpeakerConfidence:1,
  track:null,
  cameraActive:false
 });
 assert.deepEqual(noisyMetadata,baseline);
});

test('V0.15.7 runtime uses one canonical direct onLevel path',()=>{
 const runtime=read('vertical-motion.js');
 const capture=read('src/room-audio-engine.js');

 assert.match(runtime,/onLevel: onRoomAudioLevel/);
 assert.match(runtime,/function onRoomAudioLevel\(level\)/);
 assert.match(runtime,/state\.voice\.micDb=level\.db/);
 assert.match(runtime,/state\.voice\.vad=level\.speaking/);
 assert.match(runtime,/updateParticipantAudioMeters\(\)/);

 const meterStart=runtime.indexOf('function updateParticipantAudioMeters');
 const meterEnd=runtime.indexOf('function updateConversationGroups',meterStart);
 const meter=runtime.slice(meterStart,meterEnd);
 assert.match(meter,/db:state\.voice\.micDb/);
 assert.match(meter,/vad:state\.voice\.vad/);
 assert.match(meter,/const result=roomMeterState\(shared\)/);
 assert.doesNotMatch(meter,/voiceProfile|participantId|liveSpeaker|diariz|transcript/);

 assert.doesNotMatch(capture,/onVoiceWindow|pushVoicePreview|voiceWindowIntervalMs/);
});

test('V0.15.7 participant card exposes the meter and then stops before profile controls',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function createParticipantCard');
 const end=runtime.indexOf('function noteVisitorEvent',start);
 const block=runtime.slice(start,end);

 assert.match(block,/heading\.textContent = 'VOICE INPUT'/);
 assert.match(block,/Live microphone voice input level/);
 assert.match(block,/if \(state\.mode === 'agent'\) return card;/);
});

test('V0.15.7 microphone startup remains independent of camera state',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function maybeStartApprovedMicrophone');
 const end=runtime.indexOf('}\nvoid maybeStartApprovedMicrophone();',start)+2;
 assert.ok(start>=0&&end>start,'microphone startup function must remain present');
 const block=runtime.slice(start,end);
 assert.match(block,/return startRoomAudio\(\)/);
 assert.doesNotMatch(block,/state\.running|camera/);
});

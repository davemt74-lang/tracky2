import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('live participant meter now follows the current microphone signal during speech',()=>{
 const result=roomMeterState({
  active:true,participantId:'p1',speaking:true,
  liveDb:-30,noiseFloorDb:-58,voiceProfileReady:false,soleCandidate:true
 });
 assert.equal(result.mode,'live');
 assert.ok(result.level>0);
});

test('enrolled Voice Profile filters background or another speaker instead of gating input',()=>{
 const accepted=roomMeterState({
  active:true,participantId:'p1',speaking:true,
  liveDb:-27,noiseFloorDb:-58,voiceProfileReady:true,
  liveSpeakerParticipantId:'p1',liveSpeakerConfidence:.95
 });
 assert.equal(accepted.mode,'speaker');
 assert.ok(accepted.level>0);

 const rejected=roomMeterState({
  active:true,participantId:'p1',speaking:true,
  liveDb:-22,noiseFloorDb:-58,voiceProfileReady:true,
  liveSpeakerParticipantId:'p2',liveSpeakerConfidence:.94
 });
 assert.equal(rejected.mode,'background-filtered');
 assert.equal(rejected.level,0);
});

test('runtime records raw voice profile match before diarization suppression',()=>{
 const runtime=read('vertical-motion.js');
 const raw=runtime.indexOf('const rawVoiceMatch = bestVoiceMatch');
 const note=runtime.indexOf('noteLiveVoiceProfileMatch(rawVoiceMatch,segment)',raw);
 const diarize=runtime.indexOf('const diarization=await diarizeRoomSegment',raw);
 assert.ok(raw>0&&note>raw&&diarize>note);
 assert.match(runtime,/voiceProfileMatchedSegment=true/);
 assert.match(runtime,/voiceProfileMatchConfidence=Number\(match\.similarity\)/);
 assert.match(runtime,/lastVoiceProfileMatchAt=performance\.now\(\)/);
});

test('conversation attribution still retains stricter diarization suppression',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/const diarizationUnsafe=!diarization\.safeWholeTurnAttribution\|\|continuousConflict/);
 assert.match(runtime,/let voiceMatch=diarizationUnsafe\?\{/);
 assert.match(runtime,/diarizationSuppressed:true/);
});

test('participant profile changes propagate to an already-open AGENT tab',()=>{
 const store=read('src/participant-store.js');
 const runtime=read('vertical-motion.js');
 assert.match(store,/export const PARTICIPANT_CHANGE_KEY='tracky-participant-change-v1'/);
 assert.match(store,/localStorage\.setItem\(PARTICIPANT_CHANGE_KEY/);
 assert.match(runtime,/window\.addEventListener\('storage'/);
 assert.match(runtime,/event\.key===PARTICIPANT_CHANGE_KEY/);
 assert.match(runtime,/scheduleParticipantProfileRefresh/);
 assert.match(runtime,/await reloadIdentityParticipants\(\)/);
});

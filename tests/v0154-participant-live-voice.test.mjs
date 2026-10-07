import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('live participant meter follows current microphone amplitude immediately',()=>{
 const result=roomMeterState({
  active:true,db:-30,noiseFloorDb:-58,vad:true
 });
 assert.equal(result.mode,'speech');
 assert.ok(result.level>0);
});

test('voice profile state cannot suppress the live participant meter',()=>{
 const base=roomMeterState({
  active:true,db:-27,noiseFloorDb:-58,vad:true
 });
 const withProfileState=roomMeterState({
  active:true,db:-27,noiseFloorDb:-58,vad:true,
  participantId:'p1',voiceProfileReady:true,
  liveSpeakerParticipantId:'p2',liveSpeakerConfidence:.99
 });
 assert.deepEqual(withProfileState,base);
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

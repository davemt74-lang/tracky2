import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('live participant meter reacts to a recent voice-profile match before conversation attribution',()=>{
 const track={
  participantId:'p1',
  voiceProfileMatchedSegment:true,
  voiceProfileMatchConfidence:.91,
  lastVoiceProfileMatchAt:1000,
  voiceLevelDb:-24
 };
 const result=roomMeterState({
  active:true,suppressed:false,track,voiceProfileReady:true,now:1400
 });
 assert.equal(result.mode,'profile-match');
 assert.ok(result.level>0);
 assert.match(result.text,/VOICE PROFILE MATCH · 91%/);
});

test('participant meter still fails closed without an enrolled profile',()=>{
 const track={
  participantId:'p1',voiceProfileMatchedSegment:true,
  voiceProfileMatchConfidence:.95,lastVoiceProfileMatchAt:1000,voiceLevelDb:-20
 };
 assert.equal(roomMeterState({
  active:true,track,voiceProfileReady:false,now:1200
 }).mode,'unenrolled');
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

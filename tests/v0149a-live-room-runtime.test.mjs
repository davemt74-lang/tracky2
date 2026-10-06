import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9A runtime wires live validation and mixed-audio behavior policy',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/RoomLiveValidationTracker/);
 assert.match(runtime,/const roomLiveValidation=new RoomLiveValidationTracker\(\)/);
 assert.match(runtime,/roomLiveValidation\.observeBackground/);
 assert.match(runtime,/roomLiveValidation\.observeSpeechOrigin/);
 assert.match(runtime,/roomAudioBehaviorPolicy/);
});

test('14.9A uncertain mixed music can transcribe locally but cannot use web lookup',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/const remoteLyricEligible=Boolean\(policy\.allowRemoteDialogueLookup\)/);
 assert.match(runtime,/musicLyricWebLookupEnabled&&job\.remoteLyricEligible/);
 assert.match(runtime,/web lookup held for mixed live\/recorded speech/);
});

test('14.9A recorded media web lookup requires behavior-policy approval',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/speechOrigin\?\.state!=='recorded'\|\|!policy\.allowRemoteDialogueLookup/);
});

test('14.9A provider outcomes are telemetry-only and contain no audio payload',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function noteRoomProviderOutcome');
 const end=runtime.indexOf('function renderRoomAudioIntelligence',start);
 const block=runtime.slice(start,end);
 assert.match(block,/observeProvider/);
 assert.doesNotMatch(block,/samples|pcm|Float32Array|audioData/i);
 const core=read('src/room-audio-live-validation-core.js');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket|indexedDB|localStorage/);
});

test('14.9A UI and package shell expose live validation core',()=>{
 const html=read('vertical-motion.html');
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 assert.match(html,/id="roomLiveValidationStatus"/);
 assert.match(sw,/room-audio-live-validation-core\.js/);
 assert.match(workflow,/room-audio-live-validation-core\.js/);
});

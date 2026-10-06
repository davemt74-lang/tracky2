import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1D runtime uses one adaptive proactivity quality tracker',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/ProactivityQualityTracker/);
 assert.match(runtime,/proactivityQualityTracker\.shouldSpeak/);
 assert.match(runtime,/proactivityQualityTracker\.note/);
});

test('15.1D user outcomes train adaptive proactivity quality',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function noteSituationalDialogueFeedback');
 const end=runtime.indexOf('function considerContextualMediaEngagement',start);
 const block=runtime.slice(start,end);
 assert.match(block,/outcome:classified\.outcome/);
 assert.match(block,/proactivityQualityTracker\.note/);
});

test('15.1D ignored engagement and deliberate silence are recorded separately',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/outcome:'ignored'/);
 assert.match(runtime,/outcome:'silence-correct'/);
});

test('15.1D governor receives adaptive interruption budget before evaluateNext',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/adaptiveMaxInterruptionsPerHour/);
 assert.match(runtime,/maxInterruptionsPerHour:adaptiveMaxInterruptionsPerHour/);
});

test('15.1D core stays metadata-only and local',()=>{
 const core=read('src/proactivity-quality-core.js');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket|indexedDB|localStorage/);
});

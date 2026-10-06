import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9H runtime wires certification monitor to room events and performance',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/LongSessionAutonomyMonitor/);
 assert.match(runtime,/noteAutonomyCertificationObservation\(accepted\.event\)/);
 assert.match(runtime,/longSessionAutonomyMonitor\.note\('performance'/);
 assert.match(runtime,/renderAutonomyCertificationStatus/);
});

test('14.9H provider failure and recovery feed certification state',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function noteRoomProviderOutcome');
 const end=runtime.indexOf('function renderRoomMediaContinuity',start);
 const block=runtime.slice(start,end);
 assert.match(block,/provider-failure/);
 assert.match(block,/provider-recovery/);
});

test('14.9H certification tracks participant/media/interruption evidence without raw sensor payloads',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function noteAutonomyCertificationObservation');
 const end=runtime.indexOf('function renderAutonomyCertificationStatus',start);
 const block=runtime.slice(start,end);
 assert.match(block,/participant-cycle/);
 assert.match(block,/media-transition/);
 assert.match(block,/conversation-over-media/);
 assert.match(block,/memory-bounds/);
 assert.doesNotMatch(block,/samples|Float32Array|pcm|audioData|getUserMedia/i);
});

test('14.9H control center exposes live certification state',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="roomAutonomyCertificationStatus"/);
 assert.match(html,/AUTONOMY CERTIFICATION/);
});

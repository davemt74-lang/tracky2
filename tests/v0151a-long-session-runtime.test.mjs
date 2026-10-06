import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1A runtime uses one 10-second device-performance cadence',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/DEVICE_PERFORMANCE_SAMPLE_MS/);
 assert.match(runtime,/lastDevicePerformanceSampleAt/);
 assert.match(runtime,/certAt-lastDevicePerformanceSampleAt>=DEVICE_PERFORMANCE_SAMPLE_MS/);
});

test('15.1A runtime persists aggregate stability evidence across reloads',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/tracky2-v0151a-stability/);
 assert.match(runtime,/exportState\(\)/);
 assert.match(runtime,/noteRestart\(\{clean:/);
 assert.match(runtime,/persistV0151Stability\(true\)/);
});

test('15.1A status is visible in runtime health',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="v0151LongSessionStabilityStatus"/);
});

test('15.1A persistence remains aggregate-only',()=>{
 const core=read('src/v0151-long-session-stability-core.js');
 assert.doesNotMatch(core,/MediaStream|AudioBuffer|ImageData|getUserMedia|transcript\s*:|chain.?of.?thought/i);
 assert.doesNotMatch(core,/fetch\(|WebSocket|XMLHttpRequest/);
});

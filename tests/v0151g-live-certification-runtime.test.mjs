import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1G main runtime publishes metadata-only live certification snapshot',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/tracky2-v0151g-live-certification-snapshot/);
 assert.match(runtime,/publishLiveCertificationSnapshot/);
 assert.match(runtime,/longSessionStatus/);
 assert.match(runtime,/reconnectGeneration/);
});

test('15.1G diagnostics consumes runtime snapshot and scenario matrix',()=>{
 const js=read('diagnostics.js'),html=read('diagnostics.html');
 assert.match(js,/LiveCertificationHarness/);
 assert.match(js,/readLiveRuntimeSnapshot/);
 assert.match(html,/id="liveCertificationScenarios"/);
 assert.match(html,/id="liveCertificationStatus"/);
});

test('15.1G export includes live installed-device certification',()=>{
 const js=read('diagnostics.js');
 assert.match(js,/liveCertification:/);
 assert.match(js,/installed-device-certification/);
});

test('15.1G core stays local and metadata-only',()=>{
 const core=read('src/live-certification-core.js');
 assert.doesNotMatch(core,/fetch\(|WebSocket|getUserMedia|AudioContext|MediaRecorder|indexedDB|localStorage/);
});

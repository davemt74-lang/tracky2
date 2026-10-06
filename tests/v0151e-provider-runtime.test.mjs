import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1E runtime has one shared provider recovery coordinator',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/ProviderRecoveryCoordinator/);
 assert.match(runtime,/providerRecoveryCoordinator\.begin/);
 assert.match(runtime,/providerRecoveryCoordinator\.failure/);
 assert.match(runtime,/providerRecoveryCoordinator\.success/);
});

test('15.1E music and media remote work use logical request keys',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/music-fingerprint:/);
 assert.match(runtime,/music-web:/);
 assert.match(runtime,/media-web:/);
});

test('15.1E agent chat guards provider fallback and late duplicate speech',()=>{
 const agent=read('agent-mode.js');
 assert.match(agent,/ProviderRecoveryCoordinator/);
 assert.match(agent,/providerRecovery\.begin/);
 assert.match(agent,/logicalRequestKey/);
 assert.match(agent,/logical-request-already-completed/);
});

test('15.1E core is metadata-only and local',()=>{
 const core=read('src/provider-recovery-core.js');
 assert.doesNotMatch(core,/fetch\(|WebSocket|getUserMedia|AudioContext|MediaRecorder|indexedDB|localStorage/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1F runtime creates canonical restart/reconnect coordinator',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/RestartReconnectCoordinator/);
 assert.match(runtime,/restartReconnectCoordinator\.restart/);
 assert.match(runtime,/reconcileTransientState/);
});

test('15.1F online/offline lifecycle invalidates stale network work and syncs on reconnect',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/window\.addEventListener\('offline'/);
 assert.match(runtime,/window\.addEventListener\('online'/);
 assert.match(runtime,/providerRecoveryCoordinator/);
 assert.match(runtime,/multiRoomRuntime\?\.sync/);
});

test('15.1F proactive execution has replay keys and marks completion',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/restartReconnectCoordinator\.replayAllowed/);
 assert.match(runtime,/restartReconnectCoordinator\.markCompleted/);
 assert.match(runtime,/proactive-replay:/);
});

test('15.1F runtime exit clears transient cognition before sensor shutdown',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf("function prepareRuntimeExit");
 const block=runtime.slice(start,start+2400);
 assert.match(block,/clearTransientCognition\(\)/);
 assert.match(block,/providerRecoveryCoordinator/);
});

test('15.1F core is metadata-only and local',()=>{
 const core=read('src/restart-reconnect-core.js');
 assert.doesNotMatch(core,/fetch\(|WebSocket|getUserMedia|AudioContext|MediaRecorder|indexedDB|localStorage/);
});

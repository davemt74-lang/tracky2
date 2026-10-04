import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 RecoveryBudget,RuntimeBudget,automaticRecoveryAllowed,permissionState,
 queryMediaPermission,releaseAcceptanceSummary,storagePressure
} from '../src/runtime-resilience-core.js';

test('10J storage pressure pauses only optional persistence at critical quota usage',()=>{
 assert.equal(storagePressure({usage:49,quota:100}).status,'healthy');
 assert.equal(storagePressure({usage:80,quota:100}).status,'warning');
 const critical=storagePressure({usage:91,quota:100});
 assert.equal(critical.status,'critical');
 assert.equal(critical.optionalPersistence,false);
 assert.equal(storagePressure({}).status,'unknown');
 assert.equal(storagePressure({}).optionalPersistence,true);
});

test('10J automatic recovery requires existing grant, foreground page and no manual stop',()=>{
 assert.equal(automaticRecoveryAllowed({permission:'granted',visible:true}),true);
 assert.equal(automaticRecoveryAllowed({permission:'prompt',visible:true}),false);
 assert.equal(automaticRecoveryAllowed({permission:'denied',visible:true}),false);
 assert.equal(automaticRecoveryAllowed({permission:'granted',visible:false}),false);
 assert.equal(automaticRecoveryAllowed({permission:'granted',visible:true,manualStop:true}),false);
 assert.equal(permissionState('weird'),'unsupported');
});

test('10J recovery budget caps retries and expires old attempts',()=>{
 const budget=new RecoveryBudget({maxAttempts:3,windowMs:1000,delays:[10,20,30]});
 let plan=budget.plan({now:1000,permission:'granted'});
 assert.equal(plan.allowed,true);assert.equal(plan.delayMs,10);
 budget.record(1000);
 assert.equal(budget.plan({now:1100,permission:'granted'}).delayMs,20);
 budget.record(1100);budget.record(1200);
 plan=budget.plan({now:1250,permission:'granted'});
 assert.equal(plan.allowed,false);assert.equal(plan.reason,'retry-budget-exhausted');
 assert.equal(budget.plan({now:2201,permission:'granted'}).allowed,true);
 assert.equal(budget.plan({now:2201,permission:'denied'}).reason,'permission-denied');
});

test('10J runtime budget uses aggregate counters and excludes hidden-tab suspension',()=>{
 const budget=new RuntimeBudget({frameStallMs:250,scanWarnMs:100,audioQueueWarn:4});
 budget.recordFrame(0);
 budget.recordFrame(16);
 budget.recordFrame(1016,{hidden:true});
 budget.recordFrame(5016);
 let snap=budget.snapshot();
 assert.equal(snap.stalls,0,'background interval must not become an active stall');
 assert.ok(snap.durationMs<100,'active duration is accumulated frame gaps only');
 budget.recordFrame(5316);budget.recordFrame(5616);budget.recordFrame(5916);
 budget.recordScan(150);budget.recordScan(160);budget.recordScan(170);
 budget.recordAudioQueue(5);
 snap=budget.snapshot();
 assert.equal(snap.status,'degraded');
 assert.ok(snap.reasons.includes('frame-stalls'));
 assert.ok(snap.reasons.includes('slow-room-scan'));
 assert.ok(snap.reasons.includes('audio-backlog'));
 assert.equal('framesData' in snap,false);
});

test('10J permission query fails closed without prompting or throwing',async()=>{
 assert.equal(await queryMediaPermission(null,'camera'),'unsupported');
 assert.equal(await queryMediaPermission({query:async()=>({state:'granted'})},'camera'),'granted');
 assert.equal(await queryMediaPermission({query:async()=>{throw Error('unsupported');}},'microphone'),'unsupported');
 assert.equal(await queryMediaPermission({query:async()=>({state:'granted'})},'geolocation'),'unsupported');
});

test('10J physical release acceptance remains incomplete until every explicit device check passes',()=>{
 const partial=releaseAcceptanceSummary({checks:{'camera-recovery':true}});
 assert.equal(partial.status,'incomplete');
 assert.ok(partial.pending.includes('microphone-recovery'));
 const all=Object.fromEntries(partial.required.map(key=>[key,true]));
 assert.equal(releaseAcceptanceSummary({checks:all}).status,'device-acceptance-complete');
 assert.equal(releaseAcceptanceSummary({checks:{...all,'long-session':false}}).status,'failed');
});

test('10J main AGENT reuses canonical captures and has bounded granted-only recovery',()=>{
 const code=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(code,/const cameraRecovery=new RecoveryBudget\(\)/);
 assert.match(code,/const microphoneRecovery=new RecoveryBudget\(\)/);
 assert.match(code,/queryMediaPermission\(navigator\.permissions,'camera'\)/);
 assert.match(code,/queryMediaPermission\(navigator\.permissions,'microphone'\)/);
 assert.match(code,/mediaPermissions\.camera!=='granted'/);
 assert.match(code,/mediaPermissions\.microphone!=='granted'/);
 assert.match(code,/track\.addEventListener\('ended'/);
 assert.match(code,/scheduleCameraRecovery\(\)/);
 assert.match(code,/scheduleMicrophoneRecovery\(\)/);
 assert.match(code,/new RoomAudioCapture\(/);
 const core=fs.readFileSync('src/runtime-resilience-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(/);
});

test('10J optional ROOM persistence pauses at critical storage without deleting data or changing consent',()=>{
 const code=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(code,/saveRoomHistory&&storageHealth\.optionalPersistence/);
 assert.match(code,/optional ROOM history saves paused/);
 assert.match(code,/prior==='critical'&&storageHealth\.optionalPersistence/);
 assert.match(code,/persistCurrentRoomSnapshot\(\)/);
 assert.doesNotMatch(code,/storageHealth\.status==='critical'.*clearRoomObservations\(/s);
});

test('10J runtime lifecycle cleans timers/watchers and resumes pending recovery only on foreground',()=>{
 const code=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(code,/if\(cameraRecoveryTimer\)clearTimeout\(cameraRecoveryTimer\)/);
 assert.match(code,/if\(microphoneRecoveryTimer\)clearTimeout\(microphoneRecoveryTimer\)/);
 assert.match(code,/if\(storageHealthTimer\)clearInterval\(storageHealthTimer\)/);
 assert.match(code,/for\(const unwatch of permissionWatchers\)unwatch\(\)/);
 assert.match(code,/if\(document\.hidden\)return;/);
 assert.match(code,/cameraRecoveryPending.*scheduleCameraRecovery/s);
 assert.match(code,/microphoneRecoveryPending.*scheduleMicrophoneRecovery/s);
});

test('10J diagnostics export is aggregate-only and requires explicit representative-device evidence',()=>{
 const html=fs.readFileSync('diagnostics.html','utf8');
 const js=fs.readFileSync('diagnostics.js','utf8');
 for(const key of ['camera-recovery','microphone-recovery','permission-lifecycle',
  'foreground-resume','long-session','restart-integrity','storage-pressure'])
  assert.match(html,new RegExp('data-release-check="'+key+'"'));
 assert.match(html,/at least 20 minutes/i);
 assert.match(js,/version:'0\.10\.9'/);
 assert.match(js,/runtime:runtimeBudget\.snapshot\(\)/);
 assert.match(js,/releaseAcceptanceSummary/);
 assert.doesNotMatch(js,/imageData:|rawAudio:|transcript:|faceEmbedding:|voiceEmbedding:/);
});

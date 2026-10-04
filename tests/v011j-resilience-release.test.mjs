import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 V011_SOFTWARE_GATES,boundedBacklogHealth,meetingLifecycleHealth,
 modelServiceHealth,v011SoftwareReadiness
} from '../src/v011-release-core.js';

test('11J software gate covers every V0.11 section plus cross-cutting release checks',()=>{
 assert.deepEqual(V011_SOFTWARE_GATES.slice(0,9),[
  'conversation-listening','speaker-participant','transcription','multi-participant',
  'meeting-runtime','environmental-audio','spatial-interaction','proactive-agent','session-recall'
 ]);
 for(const key of ['runtime-resilience','privacy-regression','accessibility-regression','package-integrity'])
  assert.ok(V011_SOFTWARE_GATES.includes(key));
});

test('11J backlog health is bounded by depth, age and observed drops',()=>{
 assert.equal(boundedBacklogHealth({queueDepth:2,oldestAgeMs:1000}).status,'healthy');
 const bad=boundedBacklogHealth({queueDepth:6,oldestAgeMs:40000,dropped:2});
 assert.equal(bad.status,'degraded');
 assert.deepEqual(bad.reasons,['queue-depth','queue-age','dropped-work']);
});

test('11J optional model failure degrades to local fallback without becoming a release blocker by itself',()=>{
 assert.equal(modelServiceHealth({configured:false}).status,'optional-disabled');
 const failed=modelServiceHealth({configured:true,available:false,lastError:'offline'});
 assert.equal(failed.status,'degraded-fallback');
 assert.equal(failed.blocking,false);
});

test('11J meeting lifecycle rejects impossible records and more than one active meeting',()=>{
 assert.equal(meetingLifecycleHealth([{id:'m1',status:'active'}]).status,'healthy');
 const bad=meetingLifecycleHealth([
  {id:'m1',status:'active'},{id:'m2',status:'active'},
  {id:'m3',status:'ended',startedAt:3000,endedAt:2000}
 ]);
 assert.equal(bad.status,'degraded');
 assert.ok(bad.reasons.includes('multiple-active-meetings'));
 assert.ok(bad.reasons.includes('invalid-meeting-record'));
});

test('11J software readiness never claims physical device certification',()=>{
 const gates=Object.fromEntries(V011_SOFTWARE_GATES.map(key=>[key,true]));
 const ready=v011SoftwareReadiness({gates});
 assert.equal(ready.status,'software-ready');
 assert.equal(ready.physicalDeviceAcceptance,'separate-required-evidence');
});

test('11J runtime degradation fails readiness even when static software gates pass',()=>{
 const gates=Object.fromEntries(V011_SOFTWARE_GATES.map(key=>[key,true]));
 assert.equal(v011SoftwareReadiness({gates,backlog:{dropped:1}}).status,'failed');
 assert.equal(v011SoftwareReadiness({gates,storageStatus:'critical'}).status,'failed');
 assert.equal(v011SoftwareReadiness({gates,permissionState:'denied'}).status,'failed');
});

test('11J release regression inventory keeps all V0.11 section tests present',()=>{
 for(const suffix of ['a-listening','b-speaker-participant','c-transcription','d-multi-conversation',
  'e-meeting-runtime','f-environmental-audio','g-spatial-interaction','h-proactive-agent',
  'i-session-recall'])
  assert.ok(fs.existsSync('tests/v011'+suffix+'.test.mjs'),'missing V0.11'+suffix+' regression');
});

test('11J package, PWA, audit and physical-evidence boundary remain wired after later releases',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const audit=fs.readFileSync('scripts/audit.mjs','utf8');
 const workflow=fs.readFileSync('.github/workflows/test.yml','utf8');
 const docs=fs.readFileSync('docs/V011-RELEASE-ACCEPTANCE.md','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 assert.match(pkg.scripts.test,/v011-release-core\.js/);
 assert.match(audit,new RegExp(pkg.version.replaceAll('.','\\.')));
 assert.match(workflow,new RegExp('tracky2-v'+pkg.version.replaceAll('.','\\.')+'-deploy\\.zip'));
 assert.match(workflow,/V011-RELEASE-ACCEPTANCE\.md/);
 assert.match(sw,new RegExp('tracky2-static-v'+pkg.version.replaceAll('.','\\.')));
 assert.match(docs,/physical device evidence/i);
 assert.match(docs,/not hardware certification/i);
});

test('11J pure release core has no media, persistence or network side effects',()=>{
 const core=fs.readFileSync('src/v011-release-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
});

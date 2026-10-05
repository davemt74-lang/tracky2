import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 V012_RELEASE_VERSION,V012_SOFTWARE_GATES,v012ArtifactIntegrity,
 v012EvidenceBoundary,v012RuntimeBounds,v012SoftwareReadiness
} from '../src/v012-release-core.js';

test('12J release gates cover every V0.12 section plus cross-cutting invariants',()=>{
 assert.deepEqual(V012_SOFTWARE_GATES.slice(0,9),[
  'multimodal-identity','shared-mic-diarization','continuous-camera-voice-fusion',
  'multi-person-attribution','session-identity-timeline','multi-room-handoff',
  'spatial-audio-source','agent-multimodal-reasoning','long-session-hardening'
 ]);
 for(const key of ['deletion-revocation-propagation','privacy-regression',
  'accessibility-regression','package-integrity'])
  assert.ok(V012_SOFTWARE_GATES.includes(key));
});

test('12J runtime bound contract rejects growth beyond canonical limits',()=>{
 assert.equal(v012RuntimeBounds().status,'healthy');
 const bad=v012RuntimeBounds({
  listeningQueueDepth:5,diarizationClusters:5,fusionLinks:9,
  roomEvents:121,visualHistory:73,activityEvents:37
 });
 assert.equal(bad.status,'degraded');
 assert.deepEqual(bad.reasons,[
  'listening-queue','diarization-clusters','continuous-fusion-links',
  'room-events','visual-history','activity-events'
 ]);
});

test('12J evidence boundary encodes one mic, one transcript authority and no identity shortcuts',()=>{
 assert.equal(v012EvidenceBoundary().status,'preserved');
 for(const input of [
  {liveRoomMicrophones:2},{canonicalTranscriptStores:2},{identityOverrideAllowed:true},
  {spatialIdentityAuthority:true},{unknownAllowed:false},
  {physicalCalibrationRequiredForMetric:false}
 ])assert.equal(v012EvidenceBoundary(input).status,'violated');
});

test('12J artifact integrity requires final version, ZIP, checksum, PWA, audit and PHP proof',()=>{
 const good=v012ArtifactIntegrity({
  version:V012_RELEASE_VERSION,zipVerified:true,checksumProduced:true,
  pwaVerified:true,auditPassed:true,phpFoundationPassed:true
 });
 assert.equal(good.status,'verified');
 assert.equal(v012ArtifactIntegrity({...good.checks,version:'0.12.8'}).status,'incomplete');
});

test('12J software readiness never claims physical hardware certification',()=>{
 const gates=Object.fromEntries(V012_SOFTWARE_GATES.map(key=>[key,true]));
 const ready=v012SoftwareReadiness({
  gates,
  artifactIntegrity:{
   version:V012_RELEASE_VERSION,zipVerified:true,checksumProduced:true,
   pwaVerified:true,auditPassed:true,phpFoundationPassed:true
  }
 });
 assert.equal(ready.status,'software-ready');
 assert.equal(ready.physicalDeviceAcceptance,'separate-required-evidence');
 assert.equal(ready.universalHardwareClaim,false);
});

test('12J release regression inventory contains Sections 12A through 12I',()=>{
 const expected=[
  'v012a-multimodal-identity.test.mjs',
  'v012b-speaker-diarization.test.mjs',
  'v012c-continuous-fusion.test.mjs',
  'v012d-multi-person-attribution.test.mjs',
  'v012e-session-identity.test.mjs',
  'v012f-room-handoff.test.mjs',
  'v012g-spatial-audio-source.test.mjs',
  'v012h-agent-multimodal.test.mjs',
  'v012i-long-session.test.mjs'
 ];
 for(const file of expected)
  assert.ok(fs.existsSync('tests/'+file),'missing V0.12 regression '+file);
});

test('12J one live room microphone invariant remains explicit in release runtime',()=>{
 const audio=fs.readFileSync('src/room-audio-engine.js','utf8');
 assert.equal((audio.match(/getUserMedia\(/g)||[]).length,1);
 assert.match(audio,/channelCount:\s*\{\s*ideal:\s*2\s*\}/);
 assert.match(audio,/audioSource/);
 const worklet=fs.readFileSync('src/room-audio-worklet.js','utf8');
 assert.match(worklet,/leftRms/);assert.match(worklet,/rightRms/);
});

test('12J canonical identity, deletion and AGENT no-override contracts remain wired',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const agent=fs.readFileSync('src/agent-multimodal-context.js','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(store,/export async function deleteParticipant/);
 assert.match(store,/dialogue\.delete\(row\.id\)/);
 assert.match(agent,/identityOverrideAllowed:false/);
 assert.match(runtime,/reconcileLongSessionParticipantRefs/);
});

test('12J package, PWA, audit, acceptance doc and artifact checksum are final-version consistent',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const audit=fs.readFileSync('scripts/audit.mjs','utf8');
 const workflow=fs.readFileSync('.github/workflows/test.yml','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 const docs=fs.readFileSync('docs/V012-RELEASE-ACCEPTANCE.md','utf8');
 assert.equal(pkg.version,V012_RELEASE_VERSION);
 assert.match(pkg.scripts.test,/v012-release-core\.js/);
 assert.match(audit,/V012-RELEASE-ACCEPTANCE\.md/);
 assert.match(audit,/v012-release-core\.js/);
 assert.match(workflow,new RegExp('tracky2-v'+V012_RELEASE_VERSION.replaceAll('.','\\.')+'-deploy\\.zip'));
 assert.match(workflow,/sha256sum tracky2-v0\.12\.9-deploy\.zip/);
 assert.match(workflow,/V012-RELEASE-ACCEPTANCE\.md/);
 assert.match(sw,/tracky2-static-v0\.12\.9/);
 assert.match(docs,/physical device evidence/i);
 assert.match(docs,/not hardware certification/i);
});

test('12J PWA shell contains every V0.12 pure release/runtime module required offline',()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 for(const file of [
  'multimodal-identity-core.js','speaker-diarization-core.js','continuous-fusion-core.js',
  'multi-person-attribution-core.js','session-identity-core.js','room-handoff-core.js',
  'spatial-audio-source-core.js','agent-multimodal-context.js','long-session-core.js',
  'v012-release-core.js'
 ])assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
});

test('12J pure release core has no media, persistence, network or identity mutation side effects',()=>{
 const core=fs.readFileSync('src/v012-release-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|patchParticipant|saveParticipant/);
});

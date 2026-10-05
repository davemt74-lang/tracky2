import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 V013_RELEASE_VERSION,V013_SOFTWARE_GATES,v013ArtifactIntegrity,
 v013AuthorityBoundary,v013CertificationDigestInput,v013ReleaseReadiness,
 v013RepresentativeDeviceScope,v013RuntimeBounds
} from '../src/v013-release-core.js';

test('13J release gates cover every V0.13 section plus cross-cutting invariants',()=>{
 assert.equal(V013_RELEASE_VERSION,'0.13.9');
 assert.deepEqual(V013_SOFTWARE_GATES.slice(0,9),[
  'representative-hardware-certification','overlap-source-separation',
  'advanced-participant-continuity','multi-room-runtime','recording-recall-runtime',
  'environmental-intelligence','routine-intelligence','proactive-agent-intelligence',
  'long-run-device-hardening'
 ]);
 for(const key of ['deletion-revocation-propagation','privacy-regression',
  'accessibility-regression','package-integrity'])
  assert.ok(V013_SOFTWARE_GATES.includes(key));
});

test('13J runtime bounds include V0.13 certification, routine, proactive, performance and recording growth',()=>{
 assert.equal(v013RuntimeBounds().status,'healthy');
 const bad=v013RuntimeBounds({
  certificationEvents:161,continuityHistory:37,multiRoomEvents:513,
  environmentalGroups:81,environmentalFeedback:201,
  routineRows:61,routineFeedback:161,proactivePending:25,
  performanceSamples:361,recordingIndexRows:121
 });
 assert.equal(bad.status,'degraded');
 assert.deepEqual(bad.reasons,[
  'certification-events','continuity-history','multi-room-events',
  'environmental-groups','environmental-feedback','routine-history',
  'routine-feedback','proactive-pending','performance-samples','recording-index'
 ]);
});

test('13J authority boundary preserves one mic, one transcript, no hidden recording and no identity override',()=>{
 assert.equal(v013AuthorityBoundary().status,'preserved');
 for(const input of [
  {liveRoomMicrophones:2},{canonicalTranscriptStores:2},{hiddenRecordingAllowed:true},
  {agentIdentityOverrideAllowed:true},{noTeleportInference:false},{unknownAllowed:false},
  {sourceSeparationCreatesTranscriptAuthority:true},
  {representativeHardwareClaimOnly:false}
 ])assert.equal(v013AuthorityBoundary(input).status,'violated');
});

test('13J representative device evidence remains scoped and optional for software readiness',()=>{
 assert.equal(v013RepresentativeDeviceScope().status,'software-only');
 const evidence=v013RepresentativeDeviceScope({
  hardwareReportPresent:true,hardwareStatus:'pass',
  performanceEvidencePresent:true,performanceStatus:'partial'
 });
 assert.equal(evidence.status,'representative-evidence');
 assert.equal(evidence.universalHardwareClaim,false);
 assert.equal(v013RepresentativeDeviceScope({universalHardwareClaim:true}).status,'violated');
});

test('13J artifact integrity requires final ZIP checksum PWA audit PHP direct release and acceptance doc',()=>{
 const good=v013ArtifactIntegrity({
  version:V013_RELEASE_VERSION,zipVerified:true,checksumProduced:true,
  pwaVerified:true,auditPassed:true,phpFoundationPassed:true,
  directReleaseAssets:true,acceptanceDocumentIncluded:true
 });
 assert.equal(good.status,'verified');
 assert.equal(v013ArtifactIntegrity({...good.checks,version:'0.13.8'}).status,'incomplete');
});

test('13J software readiness never claims universal hardware certification',()=>{
 const gates=Object.fromEntries(V013_SOFTWARE_GATES.map(key=>[key,true]));
 const ready=v013ReleaseReadiness({
  gates,
  artifactIntegrity:{
   version:V013_RELEASE_VERSION,zipVerified:true,checksumProduced:true,
   pwaVerified:true,auditPassed:true,phpFoundationPassed:true,
   directReleaseAssets:true,acceptanceDocumentIncluded:true
  },
  representativeDeviceScope:{hardwareReportPresent:true,hardwareStatus:'pass'}
 });
 assert.equal(ready.status,'software-ready');
 assert.equal(ready.hardwareCertification,'representative-device-only');
 assert.equal(ready.universalHardwareClaim,false);
});

test('13J regression inventory contains Sections 13A through 13I',()=>{
 const expected=[
  'v013a-hardware-certification.test.mjs','v013b-overlap-separation.test.mjs',
  'v013c-participant-continuity.test.mjs','v013d-multi-room-runtime.test.mjs',
  'v013e-recording-recall.test.mjs','v013f-environmental-intelligence.test.mjs',
  'v013g-routine-intelligence.test.mjs','v013h-proactive-intelligence.test.mjs',
  'v013i-device-performance.test.mjs'
 ];
 for(const file of expected)assert.ok(fs.existsSync('tests/'+file),'missing V0.13 regression '+file);
});

test('13J final invariants remain wired across the merged runtime',()=>{
 const audio=fs.readFileSync('src/room-audio-engine.js','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const agent=fs.readFileSync('src/agent-multimodal-context.js','utf8');
 const recording=fs.readFileSync('src/recording-core.js','utf8');
 const room=fs.readFileSync('src/multi-room-runtime-core.js','utf8');
 assert.equal((audio.match(/getUserMedia\(/g)||[]).length,1);
 assert.match(store,/export async function deleteParticipant/);
 assert.match(agent,/identityOverrideAllowed:false/);
 assert.match(recording,/consent/i);
 assert.doesNotMatch(recording,/hidden-recording|silent-recording/i);
 assert.match(room,/teleport|handoff|conflict/i);
});

test('13J source separation remains metadata-only at persistence and export boundaries',()=>{
 const core=fs.readFileSync('src/overlap-source-separation-core.js','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const transcript=fs.readFileSync('src/transcript-lifecycle-core.js','utf8');
 assert.match(core,/canonical-transcript-unchanged/);
 const saveStart=store.indexOf('export async function saveDialogueTurn');
 const saveEnd=store.indexOf('export function reviseDialogueTurn',saveStart);
 const saveBlock=store.slice(saveStart,saveEnd);
 assert.match(saveBlock,/separationInput:discardSeparationInput/);
 assert.match(saveBlock,/\.\.\.safeInput/);
 assert.doesNotMatch(saveBlock,/record\s*=\s*\{[^}]*separationInput/s);
 const exportStart=transcript.indexOf('export function transcriptExport');
 assert.doesNotMatch(transcript.slice(exportStart),/separationInput|source\.samples/);
});

test('13J hardware certification and performance evidence remain representative-only',()=>{
 const hardware=fs.readFileSync('src/hardware-certification-core.js','utf8');
 const perf=fs.readFileSync('src/device-performance-core.js','utf8');
 const doc=fs.readFileSync('docs/hardware-acceptance.md','utf8');
 assert.match(hardware,/universalHardwareClaim:false/);
 assert.match(perf,/representative|certification|performance/i);
 assert.match(doc,/not universal hardware certification/i);
});

test('13J PWA shell contains every V0.13 runtime and release core required offline',()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 for(const file of [
  'hardware-certification-core.js','overlap-source-separation-core.js',
  'participant-continuity-core.js','multi-room-runtime-core.js','recording-core.js',
  'environmental-intelligence-core.js','routine-intelligence-core.js',
  'agent-proactive-intelligence-core.js','device-performance-core.js',
  'v013-release-core.js'
 ])assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
});

test('13J acceptance evidence remains intact under later additive releases',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const audit=fs.readFileSync('scripts/audit.mjs','utf8');
 const workflow=fs.readFileSync('.github/workflows/test.yml','utf8');
 const docs=fs.readFileSync('docs/V013-RELEASE-ACCEPTANCE.md','utf8');
 const status=fs.readFileSync('docs/DEVELOPMENT-STATUS.md','utf8');
 const numeric=value=>String(value).split('.').map(v=>Number(v)||0);
 const compare=(a,b)=>{const aa=numeric(a),bb=numeric(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;};
 assert.ok(compare(pkg.version,V013_RELEASE_VERSION)>=0,'later releases may advance package version without reopening V0.13');
 assert.equal(V013_RELEASE_VERSION,'0.13.9');
 assert.match(pkg.scripts.test,/v013-release-core\.js/);
 assert.match(audit,/V013-RELEASE-ACCEPTANCE\.md/);
 assert.match(audit,/v013-release-core\.js/);
 assert.match(workflow,/V013-RELEASE-ACCEPTANCE\.md/);
 assert.match(workflow,/v013-release-core\.js/);
 assert.match(docs,/0\.13\.9/);
 assert.match(docs,/representative-device/i);
 assert.match(docs,/not universal hardware certification/i);
 assert.match(status,/V0\.13\.9 is complete/);
 assert.match(status,/Do \*\*not\*\* restart V0\.13 Sections 13A–13J/);
});

test('13J digest input contains release evidence statuses only',()=>{
 const digest=v013CertificationDigestInput({
  softwareStatus:'software-ready',hardwareStatus:'pass',
  performanceStatus:'partial',mergedCommit:'abcdef'
 });
 assert.deepEqual(digest,{
  releaseVersion:'0.13.9',softwareStatus:'software-ready',
  hardwareStatus:'pass',performanceStatus:'partial',
  mergedCommit:'abcdef',universalHardwareClaim:false
 });
});

test('13J pure release core has no media persistence network or identity mutation side effects',()=>{
 const core=fs.readFileSync('src/v013-release-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|patchParticipant|saveParticipant|crypto\.subtle/);
});

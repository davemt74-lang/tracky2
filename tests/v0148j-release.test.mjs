import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 V0148_RELEASE_VERSION,V0148_AUDIO_GATES,v0148ArtifactIntegrity,
 v0148AudioRuntimeBounds,v0148CertificationScenario,v0148PrivacyBoundary,
 v0148ReleaseReadiness,v0148RestartRecovery
} from '../src/v0148-release-core.js';

test('14.8J release contract closes every ROOM-audio section A through I',()=>{
 assert.equal(V0148_RELEASE_VERSION,'0.14.8');
 for(const gate of [
  'environmental-awareness','speech-origin-separation','music-identification',
  'lyric-web-resolution','recorded-media-identification','important-sound-governance',
  'personalized-sound-learning','audio-visual-media-fusion','spoken-media-identification',
  'acrcloud-exact-recognition','unified-audio-orchestration'
 ])assert.ok(V0148_AUDIO_GATES.includes(gate));
});

test('14.8J bounds keep all audio work queues and unified session bounded',()=>{
 assert.equal(v0148AudioRuntimeBounds().status,'healthy');
 const bad=v0148AudioRuntimeBounds({
  environmentalQueueDepth:3,musicQueueDepth:2,mediaQueueDepth:2,
  roomAudioSessions:2,providerRequestsInFlight:3
 });
 assert.equal(bad.status,'degraded');
 assert.deepEqual(bad.reasons,[
  'environmental-queue','music-queue','media-queue','room-audio-session','provider-requests'
 ]);
});

test('14.8J privacy boundary rejects raw audio persistence and remote recognition without opt-in',()=>{
 assert.equal(v0148PrivacyBoundary().status,'preserved');
 for(const input of [
  {rawAudioPersisted:true},{rawAudioInRoomFeed:true},{workingLyricsPersisted:true},
  {recordedDialoguePersisted:true},{cameraFramesUploaded:true},
  {participantIdentityFromEnvironmentalAudio:true},{remoteRecognitionRequiresOptIn:false}
 ])assert.equal(v0148PrivacyBoundary(input).status,'violated');
});

test('14.8J restart recovery requires queue reset and abort semantics',()=>{
 assert.equal(v0148RestartRecovery().status,'ready');
 assert.equal(v0148RestartRecovery({musicAbort:false}).status,'failed');
 assert.equal(v0148RestartRecovery({persistedRawAudio:true}).status,'failed');
});

test('14.8J software-ready requires all gates plus artifact integrity',()=>{
 const gates=Object.fromEntries(V0148_AUDIO_GATES.map(key=>[key,true]));
 const ready=v0148ReleaseReadiness({
  gates,
  artifactIntegrity:{
   version:'0.14.8',zipVerified:true,checksumProduced:true,pwaVerified:true,
   auditPassed:true,phpFoundationPassed:true,acceptanceDocumentIncluded:true
  }
 });
 assert.equal(ready.status,'software-ready');
 assert.equal(ready.universalHardwareClaim,false);
});

test('14.8J representative scenarios are metadata-only',()=>{
 const row=v0148CertificationScenario({kind:'music',status:'pass',durationMs:65000,note:'same track continued'});
 assert.equal(row.rawAudioStored,false);
 assert.equal(row.participantId,null);
 assert.equal(row.kind,'music');
});

test('14.8J current package surfaces remain version-aligned after later releases',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const sw=fs.readFileSync('sw.js','utf8');
 const diagnostics=fs.readFileSync('diagnostics.js','utf8');
 const audit=fs.readFileSync('scripts/audit.mjs','utf8');
 const workflow=fs.readFileSync('.github/workflows/test.yml','utf8');
 assert.equal(pkg.version,'0.15.2');
 assert.match(sw,/tracky2-static-v0\.15\.2/);
 assert.match(diagnostics,/version:'0\.15\.2'/);
 assert.match(audit,/packageJson\.version !== '0\.15\.2'/);
 assert.match(workflow,/tracky2-v0\.15\.2-deploy\.zip/);
 assert.doesNotMatch(workflow,/tracky2-v0\.14\.7-deploy\.zip/);
});

test('14.8J merged runtime has explicit disable/reset abort paths and metadata-only orchestration',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const core=fs.readFileSync('src/room-audio-orchestration-core.js','utf8');
 assert.match(runtime,/musicFingerprintAbortController\?\.abort\(\)/);
 assert.match(runtime,/musicLyricWebAbortController\?\.abort\(\)/);
 assert.match(runtime,/mediaWebAbortController\?\.abort\(\)/);
 assert.match(runtime,/roomAudioIntelligence\.reset\('environmental-audio-disabled'\)/);
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
});

test('14.8J A-I regression inventory remains present',()=>{
 for(const file of [
  'v0148a-speech-origin.test.mjs','v0148b-music-identification.test.mjs',
  'v0148c-lyric-web-resolution.test.mjs','v0148d-media-identification.test.mjs',
  'v0148e-environmental-alerts.test.mjs','v0148f-personalized-sound-learning.test.mjs',
  'v0148g-room-media-fusion.test.mjs','v0148h-acrcloud-music.test.mjs',
  'v0148i-room-audio-orchestration.test.mjs'
 ])assert.ok(fs.existsSync('tests/'+file),'missing '+file);
});

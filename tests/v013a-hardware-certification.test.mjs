import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 HARDWARE_CERT_VERSION,HARDWARE_LONG_SESSION_MIN_MS,
 buildHardwareCertificationReport,canonicalCertificationJson,
 coarseRuntimeProfile,compareHardwareCertificationReports,
 hardwareCertificationSummary,normalizeCapabilityMatrix,
 normalizeCertificationEvents
} from '../src/hardware-certification-core.js';

const passExercises=()=>Object.fromEntries([
 'camera-coverage','microphone-transport','camera-recovery','microphone-recovery',
 'permission-lifecycle','foreground-resume','long-session','restart-integrity','storage-pressure'
].map(key=>[key,{outcome:'pass',durationMs:key==='long-session'?HARDWARE_LONG_SESSION_MIN_MS:null}]));

test('13A coarse runtime profile discards raw UA/platform identifiers',()=>{
 const profile=coarseRuntimeProfile({
  userAgent:'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
  platform:'Win32',deviceClass:'desktop',secureContext:true,locale:'en-US'
 });
 assert.deepEqual(profile,{
  browserFamily:'Chrome',browserMajor:154,osFamily:'Windows',
  deviceClass:'desktop',secureContext:true,locale:'en-US'
 });
 assert.equal(JSON.stringify(profile).includes('Mozilla'),false);
 assert.equal(JSON.stringify(profile).includes('Win32'),false);
});

test('13A capability matrix records stereo support without device ids or labels',()=>{
 const matrix=normalizeCapabilityMatrix({
  camera:{state:'supported',deviceCount:2,width:1280,height:720,frameRate:30},
  microphone:{state:'supported',deviceCount:1,channelCount:2,stereoAvailable:true},
  mediaDevices:{getUserMedia:true,enumerateDevices:true},
  permissionsApi:'supported',storageEstimate:'supported',audioWorklet:'supported',
  localModel:'not-tested'
 });
 assert.equal(matrix.microphone.channelCount,2);
 assert.equal(matrix.microphone.stereoAvailable,true);
 const json=JSON.stringify(matrix);
 assert.doesNotMatch(json,/deviceId|groupId|rawLabel/);
});

test('13A complete representative-device evidence becomes PASS without universal claim',()=>{
 const summary=hardwareCertificationSummary({
  capabilities:{
   camera:{state:'supported'},microphone:{state:'supported'},
   mediaDevices:{getUserMedia:true,enumerateDevices:true}
  },
  exercises:passExercises()
 });
 assert.equal(summary.status,'pass');
 assert.equal(summary.universalHardwareClaim,false);
});

test('13A long-session PASS is downgraded to PARTIAL below twenty minutes',()=>{
 const exercises=passExercises();
 exercises['long-session']={outcome:'pass',durationMs:HARDWARE_LONG_SESSION_MIN_MS-1};
 const summary=hardwareCertificationSummary({
  capabilities:{
   camera:{state:'supported'},microphone:{state:'supported'},
   mediaDevices:{getUserMedia:true}
  },exercises
 });
 assert.equal(summary.status,'partial');
 assert.ok(summary.partial.includes('long-session'));
});

test('13A explicit failure or required hardware absence fails certification',()=>{
 const exercises=passExercises();
 exercises['camera-recovery']={outcome:'fail'};
 assert.equal(hardwareCertificationSummary({
  capabilities:{camera:{state:'supported'},microphone:{state:'supported'},
   mediaDevices:{getUserMedia:true}},exercises
 }).status,'fail');
 assert.equal(hardwareCertificationSummary({
  capabilities:{camera:{state:'unsupported'},microphone:{state:'supported'},
   mediaDevices:{getUserMedia:true}},exercises:passExercises()
 }).capabilityFailure,'camera-unsupported');
});

test('13A evidence ledger is bounded and rejects arbitrary event types',()=>{
 const events=[];
 for(let i=0;i<300;i++)events.push({type:'camera-start',at:i,state:'ok'});
 events.push({type:'raw-frame',at:999,detail:'forbidden'});
 const rows=normalizeCertificationEvents(events);
 assert.equal(rows.length,160);
 assert.equal(rows.some(row=>row.type==='raw-frame'),false);
});

test('13A report export is redacted and canonical serialization is deterministic',()=>{
 const input={
  measuredAt:'2026-10-05T00:00:00.000Z',
  runtimeProfile:{userAgent:'Chrome/154 Windows',platform:'Win32',deviceClass:'desktop'},
  ownerDeviceProfile:{cameraLabel:'Owner camera',microphoneLabel:'Owner mic',
   environmentLabel:'Office',notes:'Normal daylight'},
  capabilities:{camera:{state:'supported'},microphone:{state:'supported',channelCount:1},
   mediaDevices:{getUserMedia:true}},
  exercises:passExercises(),
  camera:{frames:500,durationMs:10000,measuredFps:50,
   cameraReadiness:'coverage-and-performance-observed',
   colors:{green:{detections:10},blue:{detections:10}}},
  microphone:{status:'signal-observed',peakRms:.12,channelCount:1,stereoAvailable:false},
  runtime:{status:'healthy',frames:500,stalls:0,durationMs:10000},
  permissionStates:{camera:'granted',microphone:'granted'},
  storage:{status:'healthy',ratio:.2},
  rawAudio:'forbidden',transcript:'forbidden',faceEmbedding:[1,2],
  evidenceEvents:[{type:'camera-start',at:1,state:'granted'}]
 };
 const report=buildHardwareCertificationReport(input);
 assert.equal(report.version,HARDWARE_CERT_VERSION);
 assert.equal(report.summary.status,'pass');
 const first=canonicalCertificationJson(report);
 const second=canonicalCertificationJson({...report,rawFrame:'forbidden'});
 assert.equal(first,second);
 for(const forbidden of ['rawAudio','transcript','faceEmbedding','rawFrame','deviceId','groupId'])
  assert.equal(first.includes(forbidden),false,forbidden);
});

test('13A report comparison exposes result/capability changes without importing hidden fields',()=>{
 const base=buildHardwareCertificationReport({
  measuredAt:'2026-10-05T00:00:00.000Z',
  capabilities:{camera:{state:'supported'},microphone:{state:'supported'},
   mediaDevices:{getUserMedia:true}},
  exercises:passExercises()
 });
 const nextExercises=passExercises();nextExercises['storage-pressure']={outcome:'partial'};
 const next=buildHardwareCertificationReport({
  measuredAt:'2026-10-06T00:00:00.000Z',
  capabilities:{camera:{state:'supported'},microphone:{state:'supported',channelCount:2},
   mediaDevices:{getUserMedia:true}},
  exercises:nextExercises
 });
 const diff=compareHardwareCertificationReports(next,base);
 assert.equal(diff.comparable,true);
 assert.equal(diff.currentStatus,'partial');
 assert.ok(diff.capabilityChanges.includes('microphone'));
 assert.deepEqual(diff.exerciseChanges,[{
  key:'storage-pressure',previous:'pass',current:'partial'
 }]);
});

test('13A diagnostics integrates certification profile, capability matrix, outcome controls and checksum export',()=>{
 const html=fs.readFileSync('diagnostics.html','utf8');
 const js=fs.readFileSync('diagnostics.js','utf8');
 for(const id of ['certCameraLabel','certMicrophoneLabel','certEnvironmentLabel',
  'certCapabilityMatrix','certificationStatus','compareCertificationReport'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/data-release-check="camera-recovery"/);
 assert.match(html,/value="partial"/);
 assert.match(html,/value="fail"/);
 assert.match(js,/buildHardwareCertificationReport/);
 assert.match(js,/canonicalCertificationJson/);
 assert.match(js,/crypto\.subtle\.digest/);
 assert.match(js,/tracky2-hardware-certification-/);
 assert.match(js,/\.sha256/);
});

test('13A hardware acceptance documentation separates software completion from device evidence',()=>{
 const doc=fs.readFileSync('docs/hardware-acceptance.md','utf8');
 assert.match(doc,/V0\.13/i);
 assert.match(doc,/representative-device/i);
 assert.match(doc,/not universal hardware certification/i);
 assert.match(doc,/SHA-256/i);
});

test('13A pure certification core opens no sensors, storage or network path',()=>{
 const core=fs.readFileSync('src/hardware-certification-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|crypto\.subtle/);
});

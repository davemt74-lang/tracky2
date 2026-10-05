import { detectColorControllers, createColorCalibration, validateColorCalibration } from './src/color-controllers.js';
import { createControllerStability } from './src/controller-stability.js';
import { createHardwareDiagnostics } from './src/hardware-diagnostics.js';
import {
 RuntimeBudget,queryMediaPermission,storagePressure,releaseAcceptanceSummary
} from './src/runtime-resilience-core.js';
import {
 buildHardwareCertificationReport,canonicalCertificationJson,
 compareHardwareCertificationReports,normalizeCapabilityMatrix
} from './src/hardware-certification-core.js';

const DIAGNOSTICS_RELEASE={version:'0.13.4'};
const $ = selector => document.querySelector(selector);
const ui = {
 start:$('#startTestCamera'),stop:$('#stopTestCamera'),select:$('#testCameraSelect'),
 video:$('#testVideo'),canvas:$('#testCanvas'),camera:$('#testCameraStatus'),
 metrics:$('#testMetrics'),mic:$('#testMicrophone'),micStatus:$('#testMicrophoneStatus'),
 export:$('#exportTestReport'),exportStatus:$('#testExportStatus'),
 healthRefresh:$('#refreshReleaseHealth'),permissionStatus:$('#releasePermissionStatus'),
 storageStatus:$('#releaseStorageStatus'),runtimeStatus:$('#releaseRuntimeStatus'),
 acceptance:$('#releaseAcceptanceChecks'),acceptanceStatus:$('#releaseAcceptanceStatus'),
 acceptanceNotes:$('#releaseAcceptanceNotes'),
 certCameraLabel:$('#certCameraLabel'),certMicrophoneLabel:$('#certMicrophoneLabel'),
 certEnvironmentLabel:$('#certEnvironmentLabel'),certLightingLabel:$('#certLightingLabel'),
 certNoiseLabel:$('#certNoiseLabel'),certCapabilityMatrix:$('#certCapabilityMatrix'),
 certificationStatus:$('#certificationStatus'),
 compareReport:$('#compareCertificationReport'),compareStatus:$('#certCompareStatus')
};

const context=ui.canvas.getContext('2d',{willReadFrequently:true});
const metrics=createHardwareDiagnostics();
const runtimeBudget=new RuntimeBudget();
const trackers={green:createControllerStability(),blue:createControllerStability()};

let stream=null,raf=0,lastDisplay=0,lastLongCheckpoint=0;
let cameraOutcome='not-tested';
let micOutcome={status:'not-tested',peakRms:0,channelCount:null,stereoAvailable:null};
let permissionHealth={camera:'unsupported',microphone:'unsupported'};
let previousPermissionHealth={...permissionHealth};
let storageHealth=storagePressure();
let evidenceEvents=[];
let capabilityInput={
 camera:{state:'unknown',deviceCount:null,width:null,height:null,frameRate:null},
 microphone:{state:'unknown',deviceCount:null,channelCount:null,stereoAvailable:null},
 mediaDevices:{
  getUserMedia:Boolean(navigator.mediaDevices?.getUserMedia),
  enumerateDevices:Boolean(navigator.mediaDevices?.enumerateDevices)
 },
 permissionsApi:navigator.permissions?.query?'supported':'unsupported',
 storageEstimate:navigator.storage?.estimate?'supported':'unsupported',
 audioWorklet:typeof globalThis.AudioWorkletNode!=='undefined'?'supported':'unsupported',
 localModel:'not-tested'
};

function calibration() {
 try {
  const saved=window.localStorage.getItem('tracky2-color-calibration-v1');
  return saved?validateColorCalibration(JSON.parse(saved)):createColorCalibration();
 } catch {return createColorCalibration();}
}
const currentCalibration=calibration();

function recordEvidence(type,state=null,detail=null){
 evidenceEvents.push({type,at:Date.now(),state,detail});
 evidenceEvents=evidenceEvents.slice(-160);
}

function deviceClass(){
 const ua=String(navigator.userAgent||'');
 if(/ipad|tablet/i.test(ua))return 'tablet';
 if(/mobile|iphone|android/i.test(ua))return 'mobile';
 return 'desktop';
}

function ownerDeviceProfile(){
 return {
  cameraLabel:ui.certCameraLabel?.value,
  microphoneLabel:ui.certMicrophoneLabel?.value,
  environmentLabel:ui.certEnvironmentLabel?.value,
  lightingLabel:ui.certLightingLabel?.value,
  noiseLabel:ui.certNoiseLabel?.value,
  notes:ui.acceptanceNotes?.value
 };
}

function manualOutcomes(){
 const result={};
 for(const input of ui.acceptance?.querySelectorAll('[data-release-check]')||[])
  result[input.dataset.releaseCheck]=String(input.value||'not-run');
 return result;
}

function acceptanceChecks(){
 const checks={};
 for(const [key,value] of Object.entries(manualOutcomes())){
  if(value==='pass')checks[key]=true;
  else if(value==='fail')checks[key]=false;
 }
 return checks;
}

function exerciseInputs(){
 const camera=metrics.snapshot();
 const manual=manualOutcomes();
 const runtime=runtimeBudget.snapshot();
 const cameraCoverage=camera.frames===0
  ?'not-run'
  :camera.cameraReadiness==='coverage-and-performance-observed'?'pass'
  :cameraOutcome.startsWith('failed:')?'fail':'partial';
 const microphoneTransport=micOutcome.status==='not-tested'
  ?'not-run'
  :micOutcome.status==='signal-observed'?'pass'
  :micOutcome.status==='permission-granted-signal-weak'?'partial':'fail';
 return {
  'camera-coverage':{
   outcome:cameraCoverage,durationMs:camera.durationMs,
   evidence:camera.cameraReadiness,observedAt:Date.now()
  },
  'microphone-transport':{
   outcome:microphoneTransport,durationMs:null,
   evidence:micOutcome.status,observedAt:Date.now()
  },
  'camera-recovery':{outcome:manual['camera-recovery']},
  'microphone-recovery':{outcome:manual['microphone-recovery']},
  'permission-lifecycle':{outcome:manual['permission-lifecycle']},
  'foreground-resume':{outcome:manual['foreground-resume']},
  'long-session':{
   outcome:manual['long-session'],durationMs:runtime.durationMs,
   evidence:'active-runtime-duration'
  },
  'restart-integrity':{outcome:manual['restart-integrity']},
  'storage-pressure':{outcome:manual['storage-pressure']}
 };
}

function buildCurrentReport(measuredAt=new Date().toISOString()){
 return buildHardwareCertificationReport({
  measuredAt,
  releaseVersion:DIAGNOSTICS_RELEASE.version,
  runtimeProfile:{
   userAgent:navigator.userAgent,
   platform:navigator.platform,
   deviceClass:deviceClass(),
   secureContext:window.isSecureContext,
   locale:navigator.language
  },
  ownerDeviceProfile:ownerDeviceProfile(),
  capabilities:capabilityInput,
  exercises:exerciseInputs(),
  camera:metrics.snapshot(),
  microphone:micOutcome,
  runtime:runtimeBudget.snapshot(),
  permissionStates:permissionHealth,
  storage:{status:storageHealth.status,ratio:storageHealth.ratio},
  evidenceEvents
 });
}

function renderCapabilityMatrix(){
 if(!ui.certCapabilityMatrix)return;
 const matrix=normalizeCapabilityMatrix(capabilityInput);
 ui.certCapabilityMatrix.replaceChildren();
 const rows=[
  'Camera: '+matrix.camera.state+
    (matrix.camera.deviceCount!==null?' · '+matrix.camera.deviceCount+' device'+(matrix.camera.deviceCount===1?'':'s'):'')+
    (matrix.camera.width?' · '+matrix.camera.width+'×'+matrix.camera.height:'')+
    (matrix.camera.frameRate?' · '+Number(matrix.camera.frameRate).toFixed(1)+' FPS':''),
  'Microphone: '+matrix.microphone.state+
    (matrix.microphone.deviceCount!==null?' · '+matrix.microphone.deviceCount+' device'+(matrix.microphone.deviceCount===1?'':'s'):'')+
    (matrix.microphone.channelCount?' · '+matrix.microphone.channelCount+' channel'+(matrix.microphone.channelCount===1?'':'s'):'')+
    (matrix.microphone.stereoAvailable===true?' · stereo available':
     matrix.microphone.stereoAvailable===false?' · mono':''),
  'Media APIs: getUserMedia '+(matrix.mediaDevices.getUserMedia?'yes':'no')+
    ' · enumerateDevices '+(matrix.mediaDevices.enumerateDevices?'yes':'no'),
  'Browser capabilities: permissions '+matrix.permissionsApi+
    ' · storage estimate '+matrix.storageEstimate+
    ' · AudioWorklet '+matrix.audioWorklet+
    ' · local model '+matrix.localModel
 ];
 for(const line of rows){
  const p=document.createElement('p');p.textContent=line;ui.certCapabilityMatrix.append(p);
 }
}

function renderCertificationStatus(){
 if(!ui.certificationStatus)return;
 const report=buildCurrentReport();
 const summary=report.summary;
 const label=summary.status.toUpperCase();
 const details=[
  summary.passed.length+' passed',
  summary.partial.length+' partial',
  summary.failed.length+' failed',
  summary.notRun.length+' not run'
 ];
 ui.certificationStatus.textContent='Representative-device certification · '+label+
  ' · '+details.join(' · ')+
  (summary.capabilityFailure?' · '+summary.capabilityFailure:'')+
  ' · never a universal hardware claim.';
}

function render() {
 const snapshot=metrics.snapshot();
 ui.metrics.replaceChildren();
 const rows=[
  'Frames: '+snapshot.frames+' · measured FPS: '+snapshot.measuredFps+
   ' · active session: '+(snapshot.durationMs/1000).toFixed(1)+' s',
  ...['green','blue'].map(color=>{
   const m=snapshot.colors[color],lock=trackers[color].snapshot();
   return color.toUpperCase()+': '+m.detections+' detections · '+m.stableFrames+
    ' stable frames · '+Math.round(m.meanConfidence*100)+'% mean confidence · visited zones '+
    (m.visitedZones.length?m.visitedZones.map(i=>i+1).join(', '):'none')+
    ' · dropouts '+m.dropouts+' · rejected jumps '+m.rejectedJumps+' · '+lock.status;
  }),
  'Camera coverage/performance: '+snapshot.cameraReadiness
 ];
 for(const line of rows) {
  const p=document.createElement('p');p.textContent=line;ui.metrics.append(p);
 }
 const runtime=runtimeBudget.snapshot();
 if(ui.runtimeStatus)ui.runtimeStatus.textContent='Runtime: '+runtime.status+
  ' · '+runtime.frames+' active frames · '+runtime.stalls+' stalls · max gap '+
  runtime.maxFrameGapMs+' ms · active duration '+Math.round(runtime.durationMs/1000)+' s';
 ui.export.disabled=snapshot.frames===0&&micOutcome.status==='not-tested'&&cameraOutcome==='not-tested';
 renderAcceptanceStatus();
 renderCapabilityMatrix();
 renderCertificationStatus();
}

function stopCamera({record=true}={}) {
 cancelAnimationFrame(raf);
 const hadStream=Boolean(stream);
 stream?.getTracks().forEach(track=>track.stop());
 stream=null;ui.video.srcObject=null;
 ui.start.disabled=false;ui.stop.disabled=true;ui.select.disabled=false;
 ui.camera.textContent='Camera stopped. Results remain available for export.';
 if(record&&hadStream)recordEvidence('camera-stop','manual');
}

function tick(now) {
 if(!stream)return;
 runtimeBudget.recordFrame(now,{hidden:document.hidden});
 const runtime=runtimeBudget.snapshot();
 const checkpoint=Math.floor(runtime.durationMs/(5*60*1000));
 if(checkpoint>lastLongCheckpoint){
  lastLongCheckpoint=checkpoint;
  recordEvidence('long-session-checkpoint','observed',
   Math.round(runtime.durationMs/60000)+' active minutes');
 }
 if(ui.video.readyState>=2) {
  const vw=ui.video.videoWidth||1280,vh=ui.video.videoHeight||720;
  const h=Math.max(180,Math.round(320/(vw/vh)));
  if(ui.canvas.height!==h)ui.canvas.height=h;
  context.drawImage(ui.video,0,0,ui.canvas.width,ui.canvas.height);
  const image=context.getImageData(0,0,ui.canvas.width,ui.canvas.height);
  const found=detectColorControllers(image,{calibration:currentCalibration});
  const events={green:trackers.green.observe(found.green,now),
    blue:trackers.blue.observe(found.blue,now)};
  metrics.record(now,found,events);
  if(now-lastDisplay>=200){render();lastDisplay=now;}
 }
 raf=requestAnimationFrame(tick);
}

async function enumerateDevices(){
 if(!navigator.mediaDevices?.enumerateDevices)return [];
 try{return await navigator.mediaDevices.enumerateDevices();}catch{return [];}
}

async function refreshCapabilities(){
 const devices=await enumerateDevices();
 const cameraCount=devices.filter(device=>device.kind==='videoinput').length;
 const microphoneCount=devices.filter(device=>device.kind==='audioinput').length;
 capabilityInput={
  ...capabilityInput,
  camera:{
   ...capabilityInput.camera,
   state:cameraCount>0?'supported':navigator.mediaDevices?.getUserMedia?'unknown':'unsupported',
   deviceCount:cameraCount
  },
  microphone:{
   ...capabilityInput.microphone,
   state:microphoneCount>0?'supported':navigator.mediaDevices?.getUserMedia?'unknown':'unsupported',
   deviceCount:microphoneCount
  }
 };
 renderCapabilityMatrix();
 return capabilityInput;
}

async function enumerateCameras() {
 const devices=(await enumerateDevices()).filter(device=>device.kind==='videoinput');
 const selected=ui.select.value;
 ui.select.replaceChildren();
 for(const [i,device] of devices.entries()) {
  const option=document.createElement('option');
  option.value=device.deviceId;option.textContent=device.label||'Camera '+(i+1);
  ui.select.append(option);
 }
 if(devices.some(device=>device.deviceId===selected))ui.select.value=selected;
 await refreshCapabilities();
}

ui.start.addEventListener('click',async()=>{
 stopCamera({record:false});metrics.reset();runtimeBudget.reset();lastLongCheckpoint=0;
 trackers.green.reset();trackers.blue.reset();
 cameraOutcome='requested';lastDisplay=0;ui.camera.textContent='Requesting camera access…';
 try {
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera API unavailable; use localhost or HTTPS.');
  const constraints={width:{ideal:1280},height:{ideal:720},frameRate:{ideal:60,max:60}};
  if(ui.select.value)constraints.deviceId={exact:ui.select.value};
  else constraints.facingMode={ideal:'user'};
  stream=await navigator.mediaDevices.getUserMedia({video:constraints,audio:false});
  const track=stream.getVideoTracks()[0]||null;
  const settings=track?.getSettings?.()||{};
  capabilityInput={
   ...capabilityInput,
   camera:{
    ...capabilityInput.camera,state:'supported',
    width:Number(settings.width)||null,height:Number(settings.height)||null,
    frameRate:Number(settings.frameRate)||null
   }
  };
  track?.addEventListener('ended',()=>{
   recordEvidence('camera-ended','ended');
   if(stream)ui.camera.textContent='Camera track ended. Restore hardware and start the camera again to document recovery.';
   render();
  },{once:true});
  ui.video.srcObject=stream;
  await ui.video.play();
  await enumerateCameras();
  cameraOutcome='granted';
  recordEvidence('camera-start','granted',
   settings.width&&settings.height?settings.width+'x'+settings.height:null);
  ui.start.disabled=true;ui.stop.disabled=false;ui.select.disabled=true;
  ui.camera.textContent='Camera live. Move both markers through all four sections.';
  raf=requestAnimationFrame(tick);
  void refreshReleaseHealth();
 } catch(error) {
  cameraOutcome='failed:'+String(error?.name||'unknown');
  if(String(error?.name)==='NotFoundError')
   capabilityInput={...capabilityInput,camera:{...capabilityInput.camera,state:'unsupported'}};
  recordEvidence('camera-failed',String(error?.name||'unknown'),String(error?.message||error));
  stopCamera({record:false});
  ui.camera.textContent='Camera test failed: '+String(error?.message||error);
 }
 render();
});
ui.stop.addEventListener('click',()=>{stopCamera();render();});

ui.mic.addEventListener('click',async()=>{
 ui.mic.disabled=true;ui.micStatus.textContent='Requesting microphone access…';
 recordEvidence('microphone-start','requested');
 let audio=null,source=null,media=null;
 try {
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone API unavailable.');
  media=await navigator.mediaDevices.getUserMedia({
   audio:{echoCancellation:true,noiseSuppression:true,channelCount:{ideal:2}},video:false
  });
  const track=media.getAudioTracks()[0]||null;
  const settings=track?.getSettings?.()||{};
  const channelCount=Math.max(1,Number(settings.channelCount)||1);
  track?.addEventListener('ended',()=>recordEvidence('microphone-result','track-ended'),{once:true});
  capabilityInput={
   ...capabilityInput,
   microphone:{
    ...capabilityInput.microphone,state:'supported',channelCount,
    stereoAvailable:channelCount>=2
   }
  };
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)throw Error('Web Audio unavailable.');
  audio=new Audio();
  await audio.resume();
  source=audio.createMediaStreamSource(media);
  const analyser=audio.createAnalyser();
  analyser.fftSize=1024;source.connect(analyser);
  const silence=audio.createGain();silence.gain.value=0;
  analyser.connect(silence);silence.connect(audio.destination);
  const samples=new Float32Array(analyser.fftSize);
  let peak=0;
  for(let i=0;i<20;i++){
   await new Promise(resolve=>setTimeout(resolve,100));
   analyser.getFloatTimeDomainData(samples);
   let sum=0;for(const value of samples)sum+=value*value;
   const rms=Math.sqrt(sum/samples.length);
   peak=Math.max(peak,rms);
  }
  micOutcome={
   status:peak>.003?'signal-observed':'permission-granted-signal-weak',
   peakRms:Number(peak.toFixed(4)),channelCount,stereoAvailable:channelCount>=2
  };
  recordEvidence('microphone-result',micOutcome.status,channelCount+' channel');
  ui.micStatus.textContent='Microphone: '+micOutcome.status+
    ' · peak RMS '+micOutcome.peakRms+' · '+channelCount+' channel'+(channelCount===1?'':'s');
 } catch(error) {
  if(String(error?.name)==='NotFoundError')
   capabilityInput={...capabilityInput,microphone:{...capabilityInput.microphone,state:'unsupported'}};
  micOutcome={status:'failed:'+String(error?.name||'unknown'),peakRms:0,channelCount:null,stereoAvailable:null};
  recordEvidence('microphone-failed',String(error?.name||'unknown'),String(error?.message||error));
  ui.micStatus.textContent='Microphone test failed: '+String(error?.message||error);
 } finally {
  source?.disconnect();media?.getTracks().forEach(track=>track.stop());
  if(audio)await audio.close().catch(()=>{});
  ui.mic.disabled=false;render();void refreshReleaseHealth();void refreshCapabilities();
 }
});

function renderAcceptanceStatus(){
 if(!ui.acceptanceStatus)return;
 const result=releaseAcceptanceSummary({checks:acceptanceChecks()});
 const manual=manualOutcomes();
 const partial=Object.entries(manual).filter(([,value])=>value==='partial').map(([key])=>key);
 ui.acceptanceStatus.textContent=result.status==='device-acceptance-complete'&&!partial.length
  ?'Manual representative-device checks pass. Final certification also requires camera and microphone transport evidence.'
  :result.failed.length
   ?'Manual device checks include '+result.failed.length+' failure'+(result.failed.length===1?'':'s')+'.'
   :result.pending.length+' manual check'+(result.pending.length===1?'':'s')+
    ' not passed'+(partial.length?' · '+partial.length+' partial':'')+'.';
}

async function refreshReleaseHealth(){
 permissionHealth={
  camera:await queryMediaPermission(navigator.permissions,'camera'),
  microphone:await queryMediaPermission(navigator.permissions,'microphone')
 };
 for(const key of ['camera','microphone']){
  if(permissionHealth[key]!==previousPermissionHealth[key]){
   recordEvidence('permission-'+key,permissionHealth[key]);
   previousPermissionHealth[key]=permissionHealth[key];
  }
 }
 try{
  storageHealth=storagePressure(await navigator.storage?.estimate?.()||{});
  recordEvidence('storage-state',storageHealth.status,
   storageHealth.ratio===null?'ratio unavailable':String(storageHealth.ratio));
 }catch{storageHealth=storagePressure();}
 if(ui.permissionStatus)ui.permissionStatus.textContent='Permissions: camera '+permissionHealth.camera+
  ' · microphone '+permissionHealth.microphone;
 if(ui.storageStatus)ui.storageStatus.textContent=storageHealth.status==='unknown'
  ?'Storage: browser quota estimate unavailable'
  :'Storage: '+storageHealth.status+' · '+Math.round((storageHealth.ratio||0)*100)+'% of reported quota used';
 render();return {permissionHealth,storageHealth};
}

async function sha256Hex(value){
 const bytes=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function downloadText(filename,textContent,type='text/plain'){
 const blob=new Blob([textContent],{type});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

ui.healthRefresh?.addEventListener('click',()=>void Promise.all([
 refreshReleaseHealth(),refreshCapabilities()
]));
ui.acceptance?.addEventListener('change',render);
for(const input of [
 ui.certCameraLabel,ui.certMicrophoneLabel,ui.certEnvironmentLabel,
 ui.certLightingLabel,ui.certNoiseLabel,ui.acceptanceNotes
]) input?.addEventListener('input',render);

document.addEventListener('visibilitychange',()=>{
 recordEvidence(document.hidden?'visibility-hidden':'visibility-visible',
  document.hidden?'hidden':'visible');
 render();
});

ui.compareReport?.addEventListener('change',async()=>{
 const file=ui.compareReport.files?.[0];
 if(!file){ui.compareStatus.textContent='No prior certification report loaded.';return;}
 try{
  const parsed=JSON.parse(await file.text());
  const diff=compareHardwareCertificationReports(buildCurrentReport(),parsed);
  ui.compareStatus.textContent=diff.comparable
   ?'Prior '+diff.previousStatus.toUpperCase()+' → current '+diff.currentStatus.toUpperCase()+
    ' · '+diff.capabilityChanges.length+' capability change'+
    (diff.capabilityChanges.length===1?'':'s')+' · '+diff.exerciseChanges.length+
    ' exercise outcome change'+(diff.exerciseChanges.length===1?'':'s')
   :'Selected report is not a comparable Tracky2 hardware certification report.';
 }catch(error){
  ui.compareStatus.textContent='Comparison failed: '+String(error?.message||error);
 }
});

ui.export.addEventListener('click',async()=>{
 ui.export.disabled=true;ui.exportStatus.textContent='Building redacted certification report…';
 try{
  const report=buildCurrentReport(new Date().toISOString());
  const canonical=canonicalCertificationJson(report);
  const digest=await sha256Hex(canonical);
  const stamp=Date.now();
  const filename='tracky2-hardware-certification-'+stamp+'.json';
  const payload={...report,integrity:{
   algorithm:'SHA-256',digest,canonicalScope:'redacted-certification-report'
  }};
  downloadText(filename,JSON.stringify(payload,null,2),'application/json');
  downloadText(filename+'.sha256',digest+'  '+filename+'\n');
  ui.exportStatus.textContent='Certification '+report.summary.status.toUpperCase()+
   ' exported locally with SHA-256 '+digest+'. No raw media, transcript or biometric sample is included.';
 }catch(error){
  ui.exportStatus.textContent='Certification export failed: '+String(error?.message||error);
 }finally{
  ui.export.disabled=false;
 }
});

window.addEventListener('beforeunload',()=>stopCamera({record:false}));
recordEvidence('restart-note','page-loaded');
render();
void Promise.all([refreshReleaseHealth(),refreshCapabilities(),enumerateCameras()]);

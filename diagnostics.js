import { detectColorControllers, createColorCalibration, validateColorCalibration } from './src/color-controllers.js';
import { createControllerStability } from './src/controller-stability.js';
import { createHardwareDiagnostics } from './src/hardware-diagnostics.js';
import {
 RuntimeBudget,queryMediaPermission,storagePressure,releaseAcceptanceSummary
} from './src/runtime-resilience-core.js';

const $ = selector => document.querySelector(selector);
const ui = {
 start:$('#startTestCamera'),stop:$('#stopTestCamera'),select:$('#testCameraSelect'),
 video:$('#testVideo'),canvas:$('#testCanvas'),camera:$('#testCameraStatus'),
 metrics:$('#testMetrics'),mic:$('#testMicrophone'),micStatus:$('#testMicrophoneStatus'),
 export:$('#exportTestReport'),exportStatus:$('#testExportStatus'),
 healthRefresh:$('#refreshReleaseHealth'),permissionStatus:$('#releasePermissionStatus'),
 storageStatus:$('#releaseStorageStatus'),runtimeStatus:$('#releaseRuntimeStatus'),
 acceptance:$('#releaseAcceptanceChecks'),acceptanceStatus:$('#releaseAcceptanceStatus'),
 acceptanceNotes:$('#releaseAcceptanceNotes')
};
const context=ui.canvas.getContext('2d',{willReadFrequently:true});
const metrics=createHardwareDiagnostics();
const runtimeBudget=new RuntimeBudget();
const trackers={green:createControllerStability(),blue:createControllerStability()};
let stream=null,raf=0,lastDisplay=0,cameraOutcome='not-tested',micOutcome={status:'not-tested',peakRms:0};
let permissionHealth={camera:'unsupported',microphone:'unsupported'};
let storageHealth=storagePressure();
function calibration() {
 try {
  const saved=window.localStorage.getItem('tracky2-color-calibration-v1');
  return saved?validateColorCalibration(JSON.parse(saved)):createColorCalibration();
 } catch {return createColorCalibration();}
}
const currentCalibration=calibration();
function render() {
 const s=metrics.snapshot();
 ui.metrics.replaceChildren();
 const rows=[
  'Frames: '+s.frames+' · measured FPS: '+s.measuredFps+' · session: '+(s.durationMs/1000).toFixed(1)+' s',
  ...['green','blue'].map(color=>{
   const m=s.colors[color],lock=trackers[color].snapshot();
   return color.toUpperCase()+': '+m.detections+' detections · '+m.stableFrames+
    ' stable frames · '+Math.round(m.meanConfidence*100)+'% mean confidence · visited zones '+
    (m.visitedZones.length?m.visitedZones.map(i=>i+1).join(', '):'none')+
    ' · dropouts '+m.dropouts+' · rejected jumps '+m.rejectedJumps+' · '+lock.status;
  }),
  'Camera coverage/performance: '+s.cameraReadiness
 ];
 for(const line of rows) {
  const p=document.createElement('p');p.textContent=line;ui.metrics.append(p);
 }
 const runtime=runtimeBudget.snapshot();
 if(ui.runtimeStatus)ui.runtimeStatus.textContent='Runtime: '+runtime.status+
  ' · '+runtime.frames+' active frames · '+runtime.stalls+' stalls · max gap '+
  runtime.maxFrameGapMs+' ms';
 ui.export.disabled=s.frames===0 && micOutcome.status==='not-tested' && cameraOutcome==='not-tested';
 renderAcceptanceStatus();
}
function stopCamera() {
 cancelAnimationFrame(raf);
 stream?.getTracks().forEach(track=>track.stop());
 stream=null;ui.video.srcObject=null;
 ui.start.disabled=false;ui.stop.disabled=true;ui.select.disabled=false;
 ui.camera.textContent='Camera stopped. Results remain available for export.';
}
function tick(now) {
 if(!stream)return;
 runtimeBudget.recordFrame(now,{hidden:document.hidden});
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
  if(now-lastDisplay>=200) {render();lastDisplay=now;}
 }
 raf=requestAnimationFrame(tick);
}
async function enumerateCameras() {
 try {
  const devices=(await navigator.mediaDevices.enumerateDevices())
    .filter(d=>d.kind==='videoinput');
  const selected=ui.select.value;
  ui.select.replaceChildren();
  for(const [i,device] of devices.entries()) {
   const option=document.createElement('option');
   option.value=device.deviceId;option.textContent=device.label||'Camera '+(i+1);
   ui.select.append(option);
  }
  if(devices.some(d=>d.deviceId===selected))ui.select.value=selected;
 } catch {}
}
ui.start.addEventListener('click',async()=>{
 stopCamera();metrics.reset();runtimeBudget.reset();
 trackers.green.reset();trackers.blue.reset();
 cameraOutcome='requested';lastDisplay=0;ui.camera.textContent='Requesting camera access…';
 try {
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera API unavailable; use localhost or HTTPS.');
  const constraints={width:{ideal:1280},height:{ideal:720},frameRate:{ideal:60,max:60}};
  if(ui.select.value)constraints.deviceId={exact:ui.select.value};
  else constraints.facingMode={ideal:'user'};
  stream=await navigator.mediaDevices.getUserMedia({video:constraints,audio:false});
  ui.video.srcObject=stream;
  await ui.video.play();
  await enumerateCameras();
  cameraOutcome='granted';
  ui.start.disabled=true;ui.stop.disabled=false;ui.select.disabled=true;
  ui.camera.textContent='Camera live. Move both markers through all four sections.';
  raf=requestAnimationFrame(tick);
  void refreshReleaseHealth();
 } catch(error) {
  cameraOutcome='failed:'+String(error?.name||'unknown');
  stopCamera();
  ui.camera.textContent='Camera test failed: '+String(error?.message||error);
 }
 render();
});
ui.stop.addEventListener('click',()=>{stopCamera();render();});
ui.mic.addEventListener('click',async()=>{
 ui.mic.disabled=true;ui.micStatus.textContent='Requesting microphone access…';
 let audio=null,source=null,media=null;
 try {
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone API unavailable.');
  media=await navigator.mediaDevices.getUserMedia({
   audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false
  });
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
   const rms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);
   peak=Math.max(peak,rms);
  }
  micOutcome={status:peak>.003?'signal-observed':'permission-granted-signal-weak',
    peakRms:Number(peak.toFixed(4))};
  ui.micStatus.textContent='Microphone: '+micOutcome.status+
    ' · peak RMS '+micOutcome.peakRms;
 } catch(error) {
  micOutcome={status:'failed:'+String(error?.name||'unknown'),peakRms:0};
  ui.micStatus.textContent='Microphone test failed: '+String(error?.message||error);
 } finally {
  source?.disconnect();media?.getTracks().forEach(track=>track.stop());
  if(audio)await audio.close().catch(()=>{});
  ui.mic.disabled=false;render();void refreshReleaseHealth();
 }
});
function acceptanceChecks(){
 const checks={};
 for(const input of ui.acceptance?.querySelectorAll('[data-release-check]')||[])
  if(input.checked===true)checks[input.dataset.releaseCheck]=true;
 return checks;
}
function renderAcceptanceStatus(){
 if(!ui.acceptanceStatus)return;
 const result=releaseAcceptanceSummary({checks:acceptanceChecks()});
 ui.acceptanceStatus.textContent=result.status==='device-acceptance-complete'?
  'Representative-device checklist complete. This report is device evidence, not universal hardware certification.':
  result.pending.length+' real-device check'+(result.pending.length===1?'':'s')+' still pending.';
}
async function refreshReleaseHealth(){
 permissionHealth={
  camera:await queryMediaPermission(navigator.permissions,'camera'),
  microphone:await queryMediaPermission(navigator.permissions,'microphone')
 };
 try{storageHealth=storagePressure(await navigator.storage?.estimate?.()||{});}
 catch{storageHealth=storagePressure();}
 if(ui.permissionStatus)ui.permissionStatus.textContent='Permissions: camera '+permissionHealth.camera+
  ' · microphone '+permissionHealth.microphone;
 if(ui.storageStatus)ui.storageStatus.textContent=storageHealth.status==='unknown'?
  'Storage: browser quota estimate unavailable':
  'Storage: '+storageHealth.status+' · '+Math.round((storageHealth.ratio||0)*100)+'% of reported quota used';
 render();return {permissionHealth,storageHealth};
}
ui.healthRefresh?.addEventListener('click',()=>void refreshReleaseHealth());
ui.acceptance?.addEventListener('change',renderAcceptanceStatus);

ui.export.addEventListener('click',()=>{
 const acceptance=releaseAcceptanceSummary({checks:acceptanceChecks()});
 const report={
  product:'Tracky2',version:'0.12.7',measuredAt:new Date().toISOString(),
  cameraOutcome,camera:metrics.snapshot(),microphone:micOutcome,
  calibration:currentCalibration,
  resilience:{
   permissions:{...permissionHealth},
   storage:{status:storageHealth.status,ratio:storageHealth.ratio},
   runtime:runtimeBudget.snapshot(),
   acceptance,
   notes:String(ui.acceptanceNotes?.value||'').trim().slice(0,1200)
  },
  manualChecksRequired:[
   'enrolled face recognition','full-body occlusion recovery',
   'Voice Profile enrollment and speaker attribution','real gameplay turn acceptance',
   ...acceptance.required
  ]
 };
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');anchor.href=url;
 anchor.download='tracky2-hardware-test-'+Date.now()+'.json';
 anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 ui.exportStatus.textContent='Aggregate hardware report exported locally. Manual checks still required.';
});
window.addEventListener('beforeunload',stopCamera);
render();renderAcceptanceStatus();void refreshReleaseHealth();

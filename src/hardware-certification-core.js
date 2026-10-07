export const HARDWARE_CERT_SCHEMA=1;
export const HARDWARE_CERT_VERSION='0.13.0';
export const HARDWARE_CERT_OUTCOMES=Object.freeze(['not-run','pass','partial','fail']);
export const HARDWARE_LONG_SESSION_MIN_MS=20*60*1000;
export const HARDWARE_CERT_EVENT_LIMIT=160;

export const HARDWARE_CERT_REQUIRED_EXERCISES=Object.freeze([
 'camera-coverage','microphone-transport','camera-recovery','microphone-recovery',
 'permission-lifecycle','foreground-resume','long-session','restart-integrity',
 'storage-pressure'
]);

const text=(value,max=160)=>String(value??'').trim().slice(0,max);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const bool=value=>value===true?true:value===false?false:null;
const outcome=value=>HARDWARE_CERT_OUTCOMES.includes(String(value))?String(value):'not-run';

function freezeObject(input={}){
 return Object.freeze({...input});
}

function browserFamily(userAgent=''){
 const ua=String(userAgent);
 if(/Edg\//i.test(ua))return 'Edge';
 if(/OPR\//i.test(ua))return 'Opera';
 if(/Chrome\//i.test(ua)&&!/Edg\//i.test(ua))return 'Chrome';
 if(/Firefox\//i.test(ua))return 'Firefox';
 if(/Safari\//i.test(ua)&&!/Chrome\//i.test(ua))return 'Safari';
 return 'Other';
}

function browserMajor(userAgent='',family=browserFamily(userAgent)){
 const ua=String(userAgent);
 const patterns={
  Edge:/Edg\/(\d+)/i,Opera:/OPR\/(\d+)/i,Chrome:/Chrome\/(\d+)/i,
  Firefox:/Firefox\/(\d+)/i,Safari:/Version\/(\d+)/i
 };
 const match=ua.match(patterns[family]||/$a/);
 return match?Number(match[1]):null;
}

function osFamily(userAgent='',platform=''){
 const source=(String(userAgent)+' '+String(platform)).toLowerCase();
 if(/iphone|ipad|ipod/.test(source))return 'iOS/iPadOS';
 if(/android/.test(source))return 'Android';
 if(/windows/.test(source))return 'Windows';
 if(/mac os|macintosh|macintel/.test(source))return 'macOS';
 if(/linux/.test(source))return 'Linux';
 return 'Other';
}

export function coarseRuntimeProfile(input={}){
 const ua=String(input.userAgent||'');
 const family=browserFamily(ua);
 return freezeObject({
  browserFamily:family,
  browserMajor:browserMajor(ua,family),
  osFamily:osFamily(ua,input.platform),
  deviceClass:['mobile','tablet','desktop'].includes(input.deviceClass)
   ?input.deviceClass:'unknown',
  secureContext:bool(input.secureContext),
  locale:text(input.locale,24)||null
 });
}

export function normalizeOwnerDeviceProfile(input={}){
 return freezeObject({
  cameraLabel:text(input.cameraLabel,120)||null,
  microphoneLabel:text(input.microphoneLabel,120)||null,
  environmentLabel:text(input.environmentLabel,120)||null,
  lightingLabel:text(input.lightingLabel,120)||null,
  noiseLabel:text(input.noiseLabel,120)||null,
  notes:text(input.notes,1200)||null
 });
}

function capabilityState(value){
 const state=String(value||'unknown');
 return ['supported','unsupported','unknown','not-tested'].includes(state)?state:'unknown';
}

export function normalizeCapabilityMatrix(input={}){
 const media=input.mediaDevices&&typeof input.mediaDevices==='object'?input.mediaDevices:{};
 const mic=input.microphone&&typeof input.microphone==='object'?input.microphone:{};
 return freezeObject({
  camera:freezeObject({
   state:capabilityState(input.camera?.state),
   deviceCount:finite(input.camera?.deviceCount)?Math.max(0,Math.floor(input.camera.deviceCount)):null,
   width:finite(input.camera?.width)?Math.max(0,Math.floor(input.camera.width)):null,
   height:finite(input.camera?.height)?Math.max(0,Math.floor(input.camera.height)):null,
   frameRate:finite(input.camera?.frameRate)?Math.max(0,Number(input.camera.frameRate)):null
  }),
  microphone:freezeObject({
   state:capabilityState(mic.state),
   deviceCount:finite(mic.deviceCount)?Math.max(0,Math.floor(mic.deviceCount)):null,
   channelCount:finite(mic.channelCount)?Math.max(1,Math.min(8,Math.floor(mic.channelCount))):null,
   stereoAvailable:mic.stereoAvailable===true?true:mic.stereoAvailable===false?false:null
  }),
  mediaDevices:freezeObject({
   getUserMedia:bool(media.getUserMedia),
   enumerateDevices:bool(media.enumerateDevices)
  }),
  permissionsApi:capabilityState(input.permissionsApi),
  storageEstimate:capabilityState(input.storageEstimate),
  audioWorklet:capabilityState(input.audioWorklet),
  localModel:capabilityState(input.localModel)
 });
}

export function normalizeCertificationEvent(input={}){
 const allowedTypes=new Set([
  'camera-start','camera-stop','camera-ended','camera-failed',
  'microphone-start','microphone-result','microphone-failed',
  'permission-camera','permission-microphone','visibility-hidden','visibility-visible',
  'storage-state','long-session-checkpoint','restart-note'
 ]);
 const type=allowedTypes.has(String(input.type))?String(input.type):null;
 if(!type)return null;
 return freezeObject({
  type,at:finite(input.at)?Math.max(0,input.at):0,
  state:text(input.state,64)||null,
  detail:text(input.detail,180)||null
 });
}

export function normalizeCertificationEvents(events=[]){
 return Object.freeze((Array.isArray(events)?events:[])
  .map(normalizeCertificationEvent).filter(Boolean)
  .sort((a,b)=>a.at-b.at)
  .slice(-HARDWARE_CERT_EVENT_LIMIT));
}

export function normalizeCertificationExercise(key,input={}){
 const requested=outcome(input.outcome);
 const durationMs=finite(input.durationMs)?Math.max(0,input.durationMs):null;
 let finalOutcome=requested;
 let reason=text(input.reason,180)||null;
 if(key==='long-session'&&requested==='pass'&&
    (!finite(durationMs)||durationMs<HARDWARE_LONG_SESSION_MIN_MS)){
  finalOutcome='partial';
  reason='long-session-duration-below-20-minutes';
 }
 return freezeObject({
  key:text(key,64),outcome:finalOutcome,
  durationMs,observedAt:finite(input.observedAt)?Math.max(0,input.observedAt):null,
  evidence:text(input.evidence,240)||null,reason
 });
}

export function buildCertificationExercises(input={}){
 const source=input&&typeof input==='object'?input:{};
 const rows={};
 for(const key of HARDWARE_CERT_REQUIRED_EXERCISES)
  rows[key]=normalizeCertificationExercise(key,source[key]||{});
 return Object.freeze(rows);
}

function requiredCapabilityFailure(capabilities){
 if(capabilities.camera.state==='unsupported')return 'camera-unsupported';
 if(capabilities.microphone.state==='unsupported')return 'microphone-unsupported';
 if(capabilities.mediaDevices.getUserMedia===false)return 'get-user-media-unsupported';
 return null;
}

export function hardwareCertificationSummary({capabilities={},exercises={}}={}){
 const matrix=normalizeCapabilityMatrix(capabilities);
 const rows=buildCertificationExercises(exercises);
 const values=Object.values(rows);
 const capabilityFailure=requiredCapabilityFailure(matrix);
 const failed=values.filter(row=>row.outcome==='fail').map(row=>row.key);
 const partial=values.filter(row=>row.outcome==='partial').map(row=>row.key);
 const notRun=values.filter(row=>row.outcome==='not-run').map(row=>row.key);
 const passed=values.filter(row=>row.outcome==='pass').map(row=>row.key);
 let status='not-run';
 if(capabilityFailure||failed.length)status='fail';
 else if(!passed.length&&!partial.length)status='not-run';
 else if(partial.length||notRun.length)status='partial';
 else status='pass';
 return freezeObject({
  status,
  capabilityFailure,
  passed:Object.freeze(passed),
  partial:Object.freeze(partial),
  failed:Object.freeze(failed),
  notRun:Object.freeze(notRun),
  required:Object.freeze([...HARDWARE_CERT_REQUIRED_EXERCISES]),
  universalHardwareClaim:false
 });
}

function cleanCameraMetrics(input={}){
 return freezeObject({
  frames:Math.max(0,Number(input.frames)||0),
  durationMs:Math.max(0,Number(input.durationMs)||0),
  measuredFps:finite(input.measuredFps)?Math.max(0,input.measuredFps):0,
  meanFrameGapMs:finite(input.meanFrameGapMs)?Math.max(0,input.meanFrameGapMs):0,
  maxFrameGapMs:finite(input.maxFrameGapMs)?Math.max(0,input.maxFrameGapMs):0,
  cameraReadiness:text(input.cameraReadiness,64)||'hardware-review-incomplete'
 });
}

function cleanMicrophoneMetrics(input={}){
 return freezeObject({
  status:text(input.status,80)||'not-tested',
  peakRms:finite(input.peakRms)?Math.max(0,input.peakRms):0,
  channelCount:finite(input.channelCount)?Math.max(1,Math.min(8,Math.floor(input.channelCount))):null,
  stereoAvailable:input.stereoAvailable===true?true:input.stereoAvailable===false?false:null
 });
}

function cleanPerformance(input={}){
 return freezeObject({
  state:text(input.state,32)||'not-run',
  samples:Math.max(0,Math.floor(Number(input.samples)||0)),
  durationMs:Math.max(0,Number(input.durationMs)||0),
  p95FrameGapMs:finite(input.p95FrameGapMs)?Math.max(0,input.p95FrameGapMs):null,
  p95ScanMs:finite(input.p95ScanMs)?Math.max(0,input.p95ScanMs):null,
  medianScanMs:finite(input.medianScanMs)?Math.max(0,input.medianScanMs):null,
  maxAudioQueue:Math.max(0,Math.floor(Number(input.maxAudioQueue)||0)),
  maxHeapRatio:finite(input.maxHeapRatio)?Math.max(0,Math.min(1,input.maxHeapRatio)):null,
  minBatteryLevel:finite(input.minBatteryLevel)?Math.max(0,Math.min(1,input.minBatteryLevel)):null,
  maxStorageRatio:finite(input.maxStorageRatio)?Math.max(0,Math.min(1,input.maxStorageRatio)):null,
  worstLevel:['normal','reduced','critical'].includes(input.worstLevel)?input.worstLevel:'normal',
  degradationCount:Math.max(0,Math.floor(Number(input.degradationCount)||0),
  ),
  outcome:text(input.outcome,32)||'not-run',
  outcomeReason:text(input.outcomeReason,160)||null
 });
}

function cleanRuntime(input={}){
 return freezeObject({
  status:text(input.status,64)||'unknown',
  frames:Math.max(0,Number(input.frames)||0),
  stalls:Math.max(0,Number(input.stalls)||0),
  maxFrameGapMs:Math.max(0,Number(input.maxFrameGapMs)||0),
  durationMs:Math.max(0,Number(input.durationMs)||0),
  maxScanMs:Math.max(0,Number(input.maxScanMs)||0),
  maxAudioQueue:Math.max(0,Number(input.maxAudioQueue)||0),
  reasons:Object.freeze((input.reasons||[]).map(value=>text(value,96)).filter(Boolean).slice(0,16))
 });
}

export function buildHardwareCertificationReport(input={}){
 const capabilities=normalizeCapabilityMatrix(input.capabilities);
 const exercises=buildCertificationExercises(input.exercises);
 const summary=hardwareCertificationSummary({capabilities,exercises});
 return freezeObject({
  schema:'tracky2-hardware-certification-v1',
  schemaVersion:HARDWARE_CERT_SCHEMA,
  product:'Tracky2',
  version:text(input.version||input.releaseVersion,32)||HARDWARE_CERT_VERSION,
  certificationScope:'representative-device',
  universalHardwareClaim:false,
  measuredAt:text(input.measuredAt,40)||new Date(0).toISOString(),
  runtimeProfile:coarseRuntimeProfile(input.runtimeProfile),
  ownerDeviceProfile:normalizeOwnerDeviceProfile(input.ownerDeviceProfile),
  capabilities,
  exercises,
  summary,
  metrics:freezeObject({
   camera:cleanCameraMetrics(input.camera),
   microphone:cleanMicrophoneMetrics(input.microphone),
   runtime:cleanRuntime(input.runtime),
   performance:cleanPerformance(input.performance),
   permissionStates:freezeObject({
    camera:text(input.permissionStates?.camera,32)||'unsupported',
    microphone:text(input.permissionStates?.microphone,32)||'unsupported'
   }),
   storage:freezeObject({
    status:text(input.storage?.status,32)||'unknown',
    ratio:finite(input.storage?.ratio)?Math.max(0,Math.min(1,input.storage.ratio)):null
   })
  }),
  evidenceEvents:normalizeCertificationEvents(input.evidenceEvents)
 });
}

const TOP_LEVEL_ALLOWLIST=new Set([
 'schema','schemaVersion','product','version','certificationScope','universalHardwareClaim',
 'measuredAt','runtimeProfile','ownerDeviceProfile','capabilities','exercises','summary',
 'metrics','evidenceEvents'
]);

export function redactHardwareCertificationReport(report={}){
 const source=report&&typeof report==='object'?report:{};
 const cleaned={};
 for(const key of TOP_LEVEL_ALLOWLIST)if(Object.hasOwn(source,key))cleaned[key]=source[key];
 return buildHardwareCertificationReport(cleaned);
}

function stableValue(value){
 if(Array.isArray(value))return value.map(stableValue);
 if(value&&typeof value==='object'){
  const output={};
  for(const key of Object.keys(value).sort())output[key]=stableValue(value[key]);
  return output;
 }
 return value;
}

export function canonicalCertificationJson(report={}){
 return JSON.stringify(stableValue(redactHardwareCertificationReport(report)));
}

export function compareHardwareCertificationReports(current={},previous={}){
 const a=redactHardwareCertificationReport(current);
 const b=redactHardwareCertificationReport(previous);
 const capabilityChanges=[];
 for(const key of Object.keys(a.capabilities)){
  const left=JSON.stringify(a.capabilities[key]);
  const right=JSON.stringify(b.capabilities?.[key]);
  if(left!==right)capabilityChanges.push(key);
 }
 const exerciseChanges=[];
 for(const key of HARDWARE_CERT_REQUIRED_EXERCISES){
  const now=a.exercises[key]?.outcome||'not-run';
  const was=b.exercises?.[key]?.outcome||'not-run';
  if(now!==was)exerciseChanges.push(freezeObject({key,previous:was,current:now}));
 }
 return freezeObject({
  previousStatus:b.summary.status,
  currentStatus:a.summary.status,
  statusChanged:a.summary.status!==b.summary.status,
  capabilityChanges:Object.freeze(capabilityChanges),
  exerciseChanges:Object.freeze(exerciseChanges),
  comparable:a.product===b.product&&b.schema==='tracky2-hardware-certification-v1'
 });
}

export const DEVICE_PERFORMANCE_SCHEMA=1;
export const DEVICE_PERFORMANCE_MAX_SAMPLES=360;
export const DEVICE_PERFORMANCE_SAMPLE_MS=10000;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const numberOrNull=value=>finite(Number(value))?Number(value):null;

function percentile(values=[],p=.95){
 const rows=values.filter(finite).sort((a,b)=>a-b);
 if(!rows.length)return null;
 const index=Math.min(rows.length-1,Math.max(0,Math.ceil(rows.length*p)-1));
 return rows[index];
}
function median(values=[]){return percentile(values,.5);}

export function coarseDevicePerformanceCapabilities(input={}){
 const memory=numberOrNull(input.deviceMemory);
 const concurrency=numberOrNull(input.hardwareConcurrency);
 return Object.freeze({
  deviceMemoryClass:memory===null?'unknown':memory<=2?'low':memory<=4?'medium':'high',
  concurrencyClass:concurrency===null?'unknown':concurrency<=2?'low':concurrency<=4?'medium':'high',
  heapMetrics:input.heapMetrics===true?'supported':'unsupported',
  batteryMetrics:input.batteryMetrics===true?'supported':'unsupported'
 });
}

export function normalizePerformanceSample(input={}){
 return Object.freeze({
  at:Math.max(0,Number(input.at)||0),
  visible:input.visible!==false,
  frameCount:Math.max(0,Math.floor(Number(input.frameCount)||0)),
  stallCount:Math.max(0,Math.floor(Number(input.stallCount)||0)),
  meanFrameGapMs:Math.max(0,Number(input.meanFrameGapMs)||0),
  maxFrameGapMs:Math.max(0,Number(input.maxFrameGapMs)||0),
  meanScanMs:Math.max(0,Number(input.meanScanMs)||0),
  maxScanMs:Math.max(0,Number(input.maxScanMs)||0),
  audioQueueDepth:Math.max(0,Math.floor(Number(input.audioQueueDepth)||0)),
  heapRatio:numberOrNull(input.heapRatio)===null?null:clamp(Number(input.heapRatio)),
  batteryLevel:numberOrNull(input.batteryLevel)===null?null:clamp(Number(input.batteryLevel)),
  charging:input.charging===true?true:input.charging===false?false:null,
  storageRatio:numberOrNull(input.storageRatio)===null?null:clamp(Number(input.storageRatio))
 });
}

export function performanceSampleDelta(current={},previous=null){
 const now=normalizePerformanceSample(current);
 if(!previous)return Object.freeze({...now,stallRatio:0});
 const prior=normalizePerformanceSample(previous);
 const frames=Math.max(0,now.frameCount-prior.frameCount);
 const stalls=Math.max(0,now.stallCount-prior.stallCount);
 return Object.freeze({
  ...now,
  frameCount:frames,
  stallCount:stalls,
  stallRatio:frames>1?Math.min(1,stalls/Math.max(1,frames-1)):0
 });
}

export function performanceRisk(sample={}){
 const s=normalizePerformanceSample(sample);
 let score=0;
 const reasons=[];
 const stallRatio=finite(sample.stallRatio)?Math.max(0,Number(sample.stallRatio)):
  (s.frameCount>1?Math.min(1,s.stallCount/(s.frameCount-1)):0);
 if(stallRatio>.08){score+=.5;reasons.push('frame-stall-rate-critical');}
 else if(stallRatio>.025){score+=.28;reasons.push('frame-stall-rate-warning');}
 if(s.maxFrameGapMs>=1400){score+=.42;reasons.push('frame-gap-critical');}
 else if(s.maxFrameGapMs>=650){score+=.2;reasons.push('frame-gap-warning');}
 if(s.meanScanMs>=2200){score+=.35;reasons.push('scan-latency-critical');}
 else if(s.meanScanMs>=1400){score+=.18;reasons.push('scan-latency-warning');}
 if(s.audioQueueDepth>=8){score+=.45;reasons.push('audio-backlog-critical');}
 else if(s.audioQueueDepth>=4){score+=.22;reasons.push('audio-backlog-warning');}
 if(s.heapRatio!==null&&s.heapRatio>=.9){score+=.45;reasons.push('heap-pressure-critical');}
 else if(s.heapRatio!==null&&s.heapRatio>=.76){score+=.2;reasons.push('heap-pressure-warning');}
 if(s.storageRatio!==null&&s.storageRatio>=.9){score+=.38;reasons.push('storage-pressure-critical');}
 else if(s.storageRatio!==null&&s.storageRatio>=.75){score+=.15;reasons.push('storage-pressure-warning');}
 if(s.batteryLevel!==null&&s.charging===false&&s.batteryLevel<=.08){
  score+=.25;reasons.push('battery-critical');
 }else if(s.batteryLevel!==null&&s.charging===false&&s.batteryLevel<=.18){
  score+=.1;reasons.push('battery-low');
 }
 score=clamp(score);
 const level=score>=.62?'critical':score>=.28?'reduced':'normal';
 return Object.freeze({score:Number(score.toFixed(3)),level,reasons:Object.freeze(reasons)});
}

export function adaptivePerformancePolicy(input={}){
 const risk=input.level?input:performanceRisk(input);
 const level=['normal','reduced','critical'].includes(risk.level)?risk.level:'normal';
 return Object.freeze({
  level,
  identityScanMultiplier:level==='critical'?2.5:level==='reduced'?1.5:1,
  environmentalAudioAllowed:level!=='critical',
  optionalSceneAnalysisAllowed:level==='normal',
  recordingAllowed:true,
  transcriptionAllowed:true,
  microphoneAllowed:true,
  cameraAllowed:true,
  identityAuthorityChanged:false,
  reason:Array.from(risk.reasons||[]).slice(0,12).join(', ')||'within-performance-budget'
 });
}

export function summarizePerformanceTrend(samples=[]){
 const rows=(Array.isArray(samples)?samples:[]).map(normalizePerformanceSample)
  .filter(row=>row.visible).slice(-DEVICE_PERFORMANCE_MAX_SAMPLES);
 if(!rows.length)return Object.freeze({
  state:'not-run',samples:0,durationMs:0,
  p95FrameGapMs:null,p95ScanMs:null,medianScanMs:null,maxAudioQueue:0,
  maxHeapRatio:null,minBatteryLevel:null,maxStorageRatio:null,
  worstLevel:'normal',degradationCount:0
 });
 const levels=rows.map(row=>performanceRisk(row).level);
 const rank={normal:0,reduced:1,critical:2};
 const worstLevel=levels.reduce((a,b)=>rank[b]>rank[a]?b:a,'normal');
 return Object.freeze({
  state:'measured',samples:rows.length,
  durationMs:Math.max(0,rows.at(-1).at-rows[0].at),
  p95FrameGapMs:percentile(rows.map(row=>row.maxFrameGapMs),.95),
  p95ScanMs:percentile(rows.map(row=>row.meanScanMs),.95),
  medianScanMs:median(rows.map(row=>row.meanScanMs)),
  maxAudioQueue:Math.max(...rows.map(row=>row.audioQueueDepth)),
  maxHeapRatio:rows.some(row=>row.heapRatio!==null)
   ?Math.max(...rows.map(row=>row.heapRatio??0)):null,
  minBatteryLevel:rows.some(row=>row.batteryLevel!==null)
   ?Math.min(...rows.filter(row=>row.batteryLevel!==null).map(row=>row.batteryLevel)):null,
  maxStorageRatio:rows.some(row=>row.storageRatio!==null)
   ?Math.max(...rows.map(row=>row.storageRatio??0)):null,
  worstLevel,
  degradationCount:levels.filter(level=>level!=='normal').length
 });
}

export class DevicePerformanceGovernor{
 constructor({maxSamples=DEVICE_PERFORMANCE_MAX_SAMPLES,recoverySamples=3}={}){
  this.maxSamples=Math.max(12,Math.min(720,Math.floor(Number(maxSamples)||DEVICE_PERFORMANCE_MAX_SAMPLES)));
  this.recoverySamples=Math.max(2,Math.min(12,Math.floor(Number(recoverySamples)||3)));
  this.reset();
 }
 reset(){
  this.samples=[];this.level='normal';this.healthyStreak=0;this.lastRisk=performanceRisk({});
 }
 observe(input={}){
  const sample=normalizePerformanceSample(input);
  const risk=performanceRisk(sample);
  this.samples=[...this.samples,sample].slice(-this.maxSamples);
  const order={normal:0,reduced:1,critical:2};
  if(order[risk.level]>order[this.level]){
   this.level=risk.level;this.healthyStreak=0;
  }else if(risk.level==='normal'&&this.level!=='normal'){
   this.healthyStreak++;
   if(this.healthyStreak>=this.recoverySamples){
    this.level=this.level==='critical'?'reduced':'normal';
    this.healthyStreak=0;
   }
  }else if(order[risk.level]===order[this.level]){
   this.healthyStreak=0;
  }
  this.lastRisk=Object.freeze({...risk,level:this.level});
  return this.snapshot();
 }
 snapshot(){
  const policy=adaptivePerformancePolicy(this.lastRisk);
  return Object.freeze({
   schema:DEVICE_PERFORMANCE_SCHEMA,
   level:this.level,healthyStreak:this.healthyStreak,
   sampleCount:this.samples.length,
   riskScore:this.lastRisk.score,
   reasons:this.lastRisk.reasons,
   policy,
   trend:summarizePerformanceTrend(this.samples)
  });
 }
}

export function performanceCertificationOutcome(summary={}){
 if(summary.state!=='measured')return Object.freeze({outcome:'not-run',reason:'no-performance-samples'});
 const hours=Math.max(0,Number(summary.durationMs)||0)/(60*60*1000);
 if(summary.worstLevel==='critical')
  return Object.freeze({outcome:'partial',reason:'critical-performance-degradation-observed'});
 if(hours<2)
  return Object.freeze({outcome:'partial',reason:'less-than-two-hours-of-performance-evidence'});
 if(summary.degradationCount>Math.max(3,Math.ceil((summary.samples||0)*.08)))
  return Object.freeze({outcome:'partial',reason:'repeated-performance-degradation'});
 return Object.freeze({outcome:'pass',reason:'multi-hour-performance-within-bounds'});
}

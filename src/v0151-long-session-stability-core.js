// V0.15.1A installed-runtime long-session stability certification.
// Stores bounded aggregate runtime metrics only; no media, transcript, image, or chain-of-thought data.
const finite=v=>Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):0;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,num(v)));
const percentile=(values,p=.95)=>{
 const rows=(values||[]).filter(finite).map(Number).sort((a,b)=>a-b);
 if(!rows.length)return null;
 return rows[Math.min(rows.length-1,Math.max(0,Math.ceil(rows.length*p)-1))];
};

export const V0151_STABILITY_SCHEMA=1;
export const V0151_STABILITY_VERSION='0.15.1';
export const V0151_STABILITY_SAMPLE_MS=10000;
export const V0151_STABILITY_MIN_DURATION_MS=4*60*60*1000;
export const V0151_STABILITY_MAX_SAMPLES=1800;

export function normalizeV0151StabilitySample(input={}){
 return Object.freeze({
  at:Math.max(0,num(input.at)),
  visible:input.visible!==false,
  performanceLevel:['normal','reduced','critical'].includes(input.performanceLevel)
   ?input.performanceLevel:'normal',
  frameGapMs:Math.max(0,num(input.frameGapMs)),
  scanMs:Math.max(0,num(input.scanMs)),
  audioQueueDepth:Math.max(0,Math.floor(num(input.audioQueueDepth))),
  heapUsedBytes:Math.max(0,num(input.heapUsedBytes)),
  heapLimitBytes:Math.max(0,num(input.heapLimitBytes)),
  storageRatio:finite(input.storageRatio)?clamp(input.storageRatio):null
 });
}

export function evaluateV0151LongSessionStability(input={}){
 const durationMs=Math.max(0,num(input.durationMs));
 const expectedSamples=Math.max(1,Math.floor(durationMs/V0151_STABILITY_SAMPLE_MS));
 const sampleCount=Math.max(0,Math.floor(num(input.sampleCount)));
 const visibleSamples=Math.max(0,Math.floor(num(input.visibleSamples)));
 const evidenceCoverage=Math.min(1,sampleCount/expectedSamples);
 const visibleCoverage=sampleCount?visibleSamples/sampleCount:0;
 const checks=Object.freeze({
  'duration-4h':durationMs>=V0151_STABILITY_MIN_DURATION_MS,
  'sample-coverage':evidenceCoverage>=.75,
  'visible-coverage':visibleCoverage>=.8,
  'no-critical-performance':Math.max(0,num(input.criticalSamples))===0,
  'degradation-budget':Math.max(0,num(input.degradedRatio))<=.08,
  'frame-gap-budget':input.p95FrameGapMs===null||num(input.p95FrameGapMs)<650,
  'scan-latency-budget':input.p95ScanMs===null||num(input.p95ScanMs)<1400,
  'audio-backlog-budget':Math.max(0,num(input.p95AudioQueue))<4&&Math.max(0,num(input.maxAudioQueue))<12,
  'heap-growth-budget':input.heapGrowthRatio===null||num(input.heapGrowthRatio)<=.25,
  'heap-pressure-budget':input.maxHeapRatio===null||num(input.maxHeapRatio)<.9,
  'storage-pressure-budget':input.maxStorageRatio===null||num(input.maxStorageRatio)<.9,
  'scheduler-gap-budget':Math.max(0,num(input.longGapCount))<=6,
  'restart-integrity':Math.max(0,num(input.uncleanRestartCount))===0
 });
 const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 return Object.freeze({
  status:failed.length?'failed':'certified',
  failed:Object.freeze(failed),checks,
  snapshot:Object.freeze({
   schema:V0151_STABILITY_SCHEMA,version:V0151_STABILITY_VERSION,durationMs,
   sampleCount,visibleSamples,
   evidenceCoverage:Number(evidenceCoverage.toFixed(3)),
   visibleCoverage:Number(visibleCoverage.toFixed(3)),
   criticalSamples:Math.max(0,Math.floor(num(input.criticalSamples))),
   degradedRatio:Number(Math.max(0,num(input.degradedRatio)).toFixed(4)),
   p95FrameGapMs:input.p95FrameGapMs??null,p95ScanMs:input.p95ScanMs??null,
   p95AudioQueue:input.p95AudioQueue??null,maxAudioQueue:Math.max(0,num(input.maxAudioQueue)),
   heapGrowthRatio:input.heapGrowthRatio??null,maxHeapRatio:input.maxHeapRatio??null,
   maxStorageRatio:input.maxStorageRatio??null,longGapCount:Math.max(0,num(input.longGapCount)),
   restartCount:Math.max(0,num(input.restartCount)),
   uncleanRestartCount:Math.max(0,num(input.uncleanRestartCount))
  })
 });
}

export class V0151LongSessionStabilityMonitor{
 constructor({startedAt=Date.now(),maxSamples=V0151_STABILITY_MAX_SAMPLES,state=null}={}){
  this.maxSamples=Math.max(1440,Math.min(2160,Math.floor(num(maxSamples)||V0151_STABILITY_MAX_SAMPLES)));
  this.reset(startedAt);
  if(state)this.restore(state);
 }
 reset(startedAt=Date.now()){
  this.startedAt=Math.max(0,num(startedAt));
  this.samples=[];
  this.restartCount=0;this.uncleanRestartCount=0;this.lastAcceptedAt=0;
 }
 restore(state={}){
  if(state.schema!==V0151_STABILITY_SCHEMA)return false;
  this.startedAt=Math.max(0,num(state.startedAt)||this.startedAt);
  this.restartCount=Math.max(0,Math.floor(num(state.restartCount)));
  this.uncleanRestartCount=Math.max(0,Math.floor(num(state.uncleanRestartCount)));
  this.samples=(Array.isArray(state.samples)?state.samples:[]).map(normalizeV0151StabilitySample)
   .slice(-this.maxSamples);
  this.lastAcceptedAt=this.samples.at(-1)?.at||0;
  return true;
 }
 noteRestart({clean=true}={}){
  this.restartCount++;
  if(clean!==true)this.uncleanRestartCount++;
 }
 observe(input={},force=false){
  const sample=normalizeV0151StabilitySample(input);
  if(!force&&this.lastAcceptedAt&&sample.at-this.lastAcceptedAt<V0151_STABILITY_SAMPLE_MS)return false;
  if(this.lastAcceptedAt&&sample.visible&&sample.at-this.lastAcceptedAt>V0151_STABILITY_SAMPLE_MS*3)
   sample.longGap=true;
  this.samples=[...this.samples,sample].slice(-this.maxSamples);
  this.lastAcceptedAt=sample.at;
  return true;
 }
 snapshot(now=Date.now()){
  const rows=this.samples;
  const visible=rows.filter(row=>row.visible);
  const levels=visible.map(row=>row.performanceLevel);
  const heapRows=visible.filter(row=>row.heapUsedBytes>0&&row.heapLimitBytes>0);
  const baselineHeap=percentile(heapRows.slice(0,Math.min(18,heapRows.length)).map(row=>row.heapUsedBytes),.5);
  const recentHeap=percentile(heapRows.slice(-Math.min(18,heapRows.length)).map(row=>row.heapUsedBytes),.5);
  const heapGrowthRatio=baselineHeap&&recentHeap!==null
   ?Math.max(0,(recentHeap-baselineHeap)/baselineHeap):null;
  const maxHeapRatio=heapRows.length
   ?Math.max(...heapRows.map(row=>row.heapUsedBytes/row.heapLimitBytes)):null;
  const degraded=levels.filter(level=>level!=='normal').length;
  return Object.freeze({
   schema:V0151_STABILITY_SCHEMA,version:V0151_STABILITY_VERSION,
   durationMs:Math.max(0,num(now)-this.startedAt),
   sampleCount:rows.length,visibleSamples:visible.length,
   criticalSamples:levels.filter(level=>level==='critical').length,
   degradedRatio:visible.length?degraded/visible.length:0,
   p95FrameGapMs:percentile(visible.map(row=>row.frameGapMs),.95),
   p95ScanMs:percentile(visible.map(row=>row.scanMs),.95),
   p95AudioQueue:percentile(visible.map(row=>row.audioQueueDepth),.95),
   maxAudioQueue:visible.length?Math.max(...visible.map(row=>row.audioQueueDepth)):0,
   heapGrowthRatio,maxHeapRatio,
   maxStorageRatio:visible.some(row=>row.storageRatio!==null)
    ?Math.max(...visible.map(row=>row.storageRatio??0)):null,
   longGapCount:rows.filter(row=>row.longGap===true).length,
   restartCount:this.restartCount,uncleanRestartCount:this.uncleanRestartCount
  });
 }
 certify(now=Date.now()){return evaluateV0151LongSessionStability(this.snapshot(now));}
 exportState(){
  return Object.freeze({
   schema:V0151_STABILITY_SCHEMA,version:V0151_STABILITY_VERSION,
   startedAt:this.startedAt,restartCount:this.restartCount,
   uncleanRestartCount:this.uncleanRestartCount,samples:this.samples
  });
 }
}

export function v0151StabilityLabel(result={}){
 if(result.status==='certified')return 'V0.15.1A long-session stability · PASS';
 const failed=Array.isArray(result.failed)?result.failed:[];
 return 'V0.15.1A long-session stability · '+failed.length+' gate'+(failed.length===1?'':'s')+' pending/failed';
}

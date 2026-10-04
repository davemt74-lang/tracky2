// V0.10J standalone resilience primitives.
// Aggregate counters and lifecycle state only: no frames, audio, transcripts or identities.

export const STORAGE_WARNING_RATIO=.75;
export const STORAGE_CRITICAL_RATIO=.90;

export function storagePressure(estimate={}){
 const usage=Number(estimate?.usage),quota=Number(estimate?.quota);
 if(!Number.isFinite(usage)||!Number.isFinite(quota)||quota<=0||usage<0)
  return Object.freeze({status:'unknown',usage:null,quota:null,ratio:null,optionalPersistence:true});
 const ratio=Math.max(0,usage/quota);
 const status=ratio>=STORAGE_CRITICAL_RATIO?'critical':
  ratio>=STORAGE_WARNING_RATIO?'warning':'healthy';
 return Object.freeze({
  status,usage,quota,ratio:Number(ratio.toFixed(4)),
  optionalPersistence:status!=='critical'
 });
}

export function permissionState(value){
 const state=String(value||'unsupported').toLowerCase();
 return ['granted','prompt','denied'].includes(state)?state:'unsupported';
}
export function automaticRecoveryAllowed({permission='unsupported',visible=true,manualStop=false}={}){
 return !manualStop&&visible&&permissionState(permission)==='granted';
}
export async function queryMediaPermission(permissions,name){
 if(!['camera','microphone'].includes(name)||!permissions?.query)return 'unsupported';
 try{
  const result=await permissions.query({name});
  return permissionState(result?.state);
 }catch{return 'unsupported';}
}

export class RecoveryBudget{
 constructor({maxAttempts=3,windowMs=120000,delays=[750,2500,7500]}={}){
  this.maxAttempts=Math.max(1,Math.floor(maxAttempts));
  this.windowMs=Math.max(1000,Number(windowMs)||120000);
  this.delays=Array.isArray(delays)&&delays.length?delays.map(v=>Math.max(0,Number(v)||0)):[750,2500,7500];
  this.attempts=[];
 }
 prune(now){
  const cutoff=now-this.windowMs;
  this.attempts=this.attempts.filter(at=>at>=cutoff);
 }
 plan({now=Date.now(),permission='unsupported',visible=true,manualStop=false}={}){
  this.prune(now);
  if(manualStop)return Object.freeze({allowed:false,reason:'manual-stop',delayMs:null,attempts:this.attempts.length});
  if(!visible)return Object.freeze({allowed:false,reason:'page-hidden',delayMs:null,attempts:this.attempts.length});
  if(permissionState(permission)!=='granted')
   return Object.freeze({allowed:false,reason:'permission-'+permissionState(permission),delayMs:null,attempts:this.attempts.length});
  if(this.attempts.length>=this.maxAttempts)
   return Object.freeze({allowed:false,reason:'retry-budget-exhausted',delayMs:null,attempts:this.attempts.length});
  const delayMs=this.delays[Math.min(this.attempts.length,this.delays.length-1)];
  return Object.freeze({allowed:true,reason:'retry-scheduled',delayMs,attempts:this.attempts.length});
 }
 record(now=Date.now()){this.prune(now);this.attempts.push(now);return this.attempts.length;}
 reset(){this.attempts=[];}
 snapshot(now=Date.now()){this.prune(now);return Object.freeze({attempts:this.attempts.length,maxAttempts:this.maxAttempts,windowMs:this.windowMs});}
}

export class RuntimeBudget{
 constructor({frameStallMs=250,scanWarnMs=1200,audioQueueWarn=4}={}){
  this.frameStallMs=Math.max(50,Number(frameStallMs)||250);
  this.scanWarnMs=Math.max(50,Number(scanWarnMs)||1200);
  this.audioQueueWarn=Math.max(1,Number(audioQueueWarn)||4);
  this.reset();
 }
 reset(){
  this.frames=0;this.firstFrame=null;this.lastFrame=null;this.frameGapTotal=0;
  this.maxFrameGap=0;this.stalls=0;this.scans=0;this.scanTotal=0;this.maxScan=0;
  this.audioQueueMax=0;
 }
 recordFrame(now,{hidden=false}={}){
  if(!Number.isFinite(now)||now<0)return false;
  if(hidden){this.lastFrame=null;return false;}
  if(this.lastFrame!==null&&now<=this.lastFrame)return false;
  if(this.firstFrame===null)this.firstFrame=now;
  if(this.lastFrame!==null){
   const gap=now-this.lastFrame;this.frameGapTotal+=gap;this.maxFrameGap=Math.max(this.maxFrameGap,gap);
   if(gap>=this.frameStallMs)this.stalls++;
  }
  this.lastFrame=now;this.frames++;return true;
 }
 recordScan(durationMs){
  const value=Number(durationMs);if(!Number.isFinite(value)||value<0)return false;
  this.scans++;this.scanTotal+=value;this.maxScan=Math.max(this.maxScan,value);return true;
 }
 recordAudioQueue(depth){
  const value=Math.max(0,Math.floor(Number(depth)||0));this.audioQueueMax=Math.max(this.audioQueueMax,value);return value;
 }
 snapshot(){
  const durationMs=Math.max(0,this.frameGapTotal);
  const meanFrameGap=this.frames>1?this.frameGapTotal/(this.frames-1):0;
  const meanScanMs=this.scans?this.scanTotal/this.scans:0;
  const stallRatio=this.frames>1?this.stalls/(this.frames-1):0;
  const reasons=[];
  if(this.stalls>=3&&stallRatio>.01)reasons.push('frame-stalls');
  if(this.scans>=3&&meanScanMs>this.scanWarnMs)reasons.push('slow-room-scan');
  if(this.audioQueueMax>=this.audioQueueWarn)reasons.push('audio-backlog');
  return Object.freeze({
   status:reasons.length?'degraded':'healthy',reasons:Object.freeze(reasons),
   frames:this.frames,durationMs:Math.round(durationMs),
   meanFrameGapMs:Number(meanFrameGap.toFixed(1)),maxFrameGapMs:Number(this.maxFrameGap.toFixed(1)),
   stalls:this.stalls,scans:this.scans,meanScanMs:Number(meanScanMs.toFixed(1)),
   maxScanMs:Number(this.maxScan.toFixed(1)),audioQueueMax:this.audioQueueMax
  });
 }
}

export function releaseAcceptanceSummary(input={}){
 const checks=input.checks&&typeof input.checks==='object'?input.checks:{};
 const required=['camera-recovery','microphone-recovery','permission-lifecycle',
  'foreground-resume','long-session','restart-integrity','storage-pressure'];
 const passed=required.filter(key=>checks[key]===true);
 const failed=required.filter(key=>checks[key]===false);
 const pending=required.filter(key=>checks[key]!==true&&checks[key]!==false);
 return Object.freeze({
  required:Object.freeze(required),passed:Object.freeze(passed),failed:Object.freeze(failed),
  pending:Object.freeze(pending),
  status:failed.length?'failed':pending.length?'incomplete':'device-acceptance-complete'
 });
}

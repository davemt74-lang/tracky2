// V0.14.9H long-session certification and autonomy hardening.
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const AUTONOMY_CERT_SCHEMA=1;
export const AUTONOMY_CERT_MIN_DURATION_MS=2*60*60*1000;

export function autonomyCertificationSnapshot(input={}){
 const durationMs=Math.max(0,Number(input.durationMs)||0);
 const participantCycles=Math.max(0,Math.floor(Number(input.participantCycles)||0));
 const mediaTransitions=Math.max(0,Math.floor(Number(input.mediaTransitions)||0));
 const conversationOverMedia=Math.max(0,Math.floor(Number(input.conversationOverMedia)||0));
 const providerFailures=Math.max(0,Math.floor(Number(input.providerFailures)||0));
 const providerRecoveries=Math.max(0,Math.floor(Number(input.providerRecoveries)||0));
 const restartCount=Math.max(0,Math.floor(Number(input.restartCount)||0));
 const staleFollowThrough=Math.max(0,Math.floor(Number(input.staleFollowThrough)||0));
 const duplicateProactive=Math.max(0,Math.floor(Number(input.duplicateProactive)||0));
 const autonomousResearchWithoutConfirmation=Math.max(0,Math.floor(Number(input.autonomousResearchWithoutConfirmation)||0));
 const memoryEvents=Math.max(0,Math.floor(Number(input.memoryEvents)||0));
 const memoryFeedback=Math.max(0,Math.floor(Number(input.memoryFeedback)||0));
 const promotedWithoutOwnerApproval=Math.max(0,Math.floor(Number(input.promotedWithoutOwnerApproval)||0));
 const interruptionRate=Math.max(0,Number(input.interruptionsPerHour)||0);
 const performanceLevel=String(input.performanceLevel||'normal');
 const restartClean=input.restartClean===true;
 const mediaContinuityStable=input.mediaContinuityStable!==false;
 const providerFailClosed=input.providerFailClosed!==false;
 const memoryBoundsHealthy=memoryEvents<=180&&memoryFeedback<=80;
 return Object.freeze({
  schema:AUTONOMY_CERT_SCHEMA,durationMs,participantCycles,mediaTransitions,
  conversationOverMedia,providerFailures,providerRecoveries,restartCount,
  staleFollowThrough,duplicateProactive,autonomousResearchWithoutConfirmation,
  memoryEvents,memoryFeedback,promotedWithoutOwnerApproval,
  interruptionsPerHour:Number(interruptionRate.toFixed(3)),performanceLevel,
  restartClean,mediaContinuityStable,providerFailClosed,memoryBoundsHealthy
 });
}

export function evaluateAutonomyCertification(input={}){
 const s=autonomyCertificationSnapshot(input);
 const checks={
  'duration-2h':s.durationMs>=AUTONOMY_CERT_MIN_DURATION_MS,
  'participant-cycles':s.participantCycles>=3,
  'media-transitions':s.mediaTransitions>=6,
  'conversation-over-media':s.conversationOverMedia>=3,
  'provider-failure-recovery':s.providerFailures===0||s.providerRecoveries>=1,
  'provider-fails-closed':s.providerFailClosed,
  'restart-clean':s.restartCount===0||s.restartClean,
  'no-stale-followthrough':s.staleFollowThrough===0,
  'no-duplicate-proactive':s.duplicateProactive===0,
  'no-unconfirmed-research':s.autonomousResearchWithoutConfirmation===0,
  'memory-bounds':s.memoryBoundsHealthy,
  'no-silent-memory-promotion':s.promotedWithoutOwnerApproval===0,
  'interruption-budget':s.interruptionsPerHour<=3,
  'media-continuity':s.mediaContinuityStable,
  'performance-budget':s.performanceLevel!=='critical'
 };
 const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 return Object.freeze({
  snapshot:s,checks:Object.freeze(checks),failed:Object.freeze(failed),
  status:failed.length?'failed':'certified'
 });
}

export class LongSessionAutonomyMonitor{
 constructor({startedAt=Date.now()}={}){
  this.startedAt=startedAt;this.reset(startedAt);
 }
 reset(startedAt=Date.now()){
  this.startedAt=startedAt;this.participantCycles=0;this.mediaTransitions=0;
  this.conversationOverMedia=0;this.providerFailures=0;this.providerRecoveries=0;
  this.restartCount=0;this.staleFollowThrough=0;this.duplicateProactive=0;
  this.autonomousResearchWithoutConfirmation=0;this.promotedWithoutOwnerApproval=0;
  this.memoryEvents=0;this.memoryFeedback=0;this.interruptions=[];
  this.performanceLevel='normal';this.restartClean=true;
  this.mediaContinuityStable=true;this.providerFailClosed=true;
 }
 note(type,payload={},at=Date.now()){
  if(type==='participant-cycle')this.participantCycles++;
  else if(type==='media-transition')this.mediaTransitions++;
  else if(type==='conversation-over-media')this.conversationOverMedia++;
  else if(type==='provider-failure')this.providerFailures++;
  else if(type==='provider-recovery')this.providerRecoveries++;
  else if(type==='restart'){
   this.restartCount++;if(payload.clean===false)this.restartClean=false;
  }else if(type==='stale-followthrough')this.staleFollowThrough++;
  else if(type==='duplicate-proactive')this.duplicateProactive++;
  else if(type==='unconfirmed-research')this.autonomousResearchWithoutConfirmation++;
  else if(type==='silent-memory-promotion')this.promotedWithoutOwnerApproval++;
  else if(type==='interruption')this.interruptions.push(at);
  else if(type==='media-continuity-error')this.mediaContinuityStable=false;
  else if(type==='provider-open-failure')this.providerFailClosed=false;
  if(type==='memory-bounds'){
   this.memoryEvents=Math.max(0,Math.floor(Number(payload.events)||0));
   this.memoryFeedback=Math.max(0,Math.floor(Number(payload.feedback)||0));
  }
  if(type==='performance'){
   const level=String(payload.level||'normal');
   const rank={normal:0,reduced:1,critical:2};
   if((rank[level]||0)>(rank[this.performanceLevel]||0))this.performanceLevel=level;
  }
  this.interruptions=this.interruptions.filter(ts=>at-ts<=60*60*1000);
  return this.snapshot(at);
 }
 snapshot(now=Date.now()){
  return autonomyCertificationSnapshot({
   durationMs:Math.max(0,now-this.startedAt),participantCycles:this.participantCycles,
   mediaTransitions:this.mediaTransitions,conversationOverMedia:this.conversationOverMedia,
   providerFailures:this.providerFailures,providerRecoveries:this.providerRecoveries,
   restartCount:this.restartCount,restartClean:this.restartClean,
   staleFollowThrough:this.staleFollowThrough,duplicateProactive:this.duplicateProactive,
   autonomousResearchWithoutConfirmation:this.autonomousResearchWithoutConfirmation,
   promotedWithoutOwnerApproval:this.promotedWithoutOwnerApproval,
   memoryEvents:this.memoryEvents,memoryFeedback:this.memoryFeedback,
   interruptionsPerHour:this.interruptions.length,performanceLevel:this.performanceLevel,
   mediaContinuityStable:this.mediaContinuityStable,providerFailClosed:this.providerFailClosed
  });
 }
 certify(now=Date.now()){return evaluateAutonomyCertification(this.snapshot(now));}
}

export function certificationLabel(result={}){
 if(result.status==='certified')return 'Long-session autonomy certification · PASS';
 const failed=Array.isArray(result.failed)?result.failed:[];
 return 'Long-session autonomy certification · '+failed.length+' gate'+(failed.length===1?'':'s')+' pending/failed';
}

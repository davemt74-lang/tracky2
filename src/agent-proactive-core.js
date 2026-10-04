import {inQuietHours} from './agent-cognitive-core.js';

export const DEFAULT_PROACTIVE_POLICY=Object.freeze({
 enabled:true,
 followupsEnabled:true,
 statusNoticesEnabled:true,
 followupDelayMs:60000,
 opportunityTtlMs:180000,
 globalCooldownMs:120000,
 participantCooldownMs:180000,
 maxInterruptionsPerHour:3,
 requireVisibleAttention:true
});

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const short=(value,max=240)=>String(value??'').trim().slice(0,max);
const id=()=>globalThis.crypto?.randomUUID?.()||
 'op-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

export function normalizeProactivePolicy(input={}){
 const p=input&&typeof input==='object'?input:{};
 return Object.freeze({
  enabled:p.enabled!==false,
  followupsEnabled:p.followupsEnabled!==false,
  statusNoticesEnabled:p.statusNoticesEnabled!==false,
  followupDelayMs:Math.max(15000,Math.min(300000,
   finite(p.followupDelayMs)?p.followupDelayMs:DEFAULT_PROACTIVE_POLICY.followupDelayMs)),
  opportunityTtlMs:Math.max(30000,Math.min(900000,
   finite(p.opportunityTtlMs)?p.opportunityTtlMs:DEFAULT_PROACTIVE_POLICY.opportunityTtlMs)),
  globalCooldownMs:Math.max(30000,Math.min(1800000,
   finite(p.globalCooldownMs)?p.globalCooldownMs:DEFAULT_PROACTIVE_POLICY.globalCooldownMs)),
  participantCooldownMs:Math.max(30000,Math.min(3600000,
   finite(p.participantCooldownMs)?p.participantCooldownMs:DEFAULT_PROACTIVE_POLICY.participantCooldownMs)),
  maxInterruptionsPerHour:Math.max(1,Math.min(10,
   finite(p.maxInterruptionsPerHour)?Math.floor(p.maxInterruptionsPerHour):
    DEFAULT_PROACTIVE_POLICY.maxInterruptionsPerHour)),
  requireVisibleAttention:p.requireVisibleAttention!==false
 });
}

export function proactiveOpportunity(input={},now=Date.now(),policy=DEFAULT_PROACTIVE_POLICY){
 const p=normalizeProactivePolicy(policy);
 const type=String(input.type||'').trim();
 if(!['conversation-followup','task-status','meeting-followup'].includes(type))
  throw new Error('Unsupported proactive opportunity type.');
 const sourceAt=finite(input.sourceAt)?input.sourceAt:now;
 const eligibleAt=finite(input.eligibleAt)?Math.max(sourceAt,input.eligibleAt):
  type==='conversation-followup'?sourceAt+p.followupDelayMs:sourceAt;
 const expiresAt=finite(input.expiresAt)?Math.max(eligibleAt,input.expiresAt):
  eligibleAt+p.opportunityTtlMs;
 const participantId=short(input.participantId,96)||null;
 const scopeId=short(input.scopeId,240)||null;
 const text=short(input.text,500);
 if(!text)throw new Error('Proactive opportunity text required.');
 const dedupeKey=short(input.dedupeKey,220)||
  [type,participantId||'general',scopeId||'room'].join(':');
 return Object.freeze({
  id:short(input.id,96)||id(),type,text,participantId,scopeId,
  sourceAt,eligibleAt,expiresAt,dedupeKey,
  relatedEventId:short(input.relatedEventId,96)||null,
  requiresNoActiveTasks:input.requiresNoActiveTasks===true,
  source:String(input.source||'agent-proactive').slice(0,80)
 });
}

export function followupOpportunity(turn,now=Date.now(),policy=DEFAULT_PROACTIVE_POLICY){
 if(!turn?.id||!turn.participantId||turn.attribution==='unknown')return null;
 const p=normalizeProactivePolicy(policy);
 if(!p.followupsEnabled)return null;
 const sourceAt=finite(turn.at)?turn.at:(Date.parse(turn.createdAt||'')||now);
 return proactiveOpportunity({
  type:'conversation-followup',
  participantId:turn.participantId,
  scopeId:turn.conversationScopeId||('scope:p:'+turn.participantId),
  sourceAt,
  eligibleAt:sourceAt+p.followupDelayMs,
  text:'Would you like me to help with anything else?',
  dedupeKey:'followup:'+(turn.conversationScopeId||turn.participantId),
  source:'canonical-dialogue',
  requiresNoActiveTasks:true
 },now,p);
}

export function statusOpportunity(event,now=Date.now(),policy=DEFAULT_PROACTIVE_POLICY){
 if(!event?.semantic)return null;
 const p=normalizeProactivePolicy(policy);
 if(!p.statusNoticesEnabled)return null;
 if(event.semantic==='agent-task-outcome'){
  if(String(event.message||'').toLowerCase().includes('retry scheduled'))return null;
  return proactiveOpportunity({
   type:'task-status',
   sourceAt:finite(event.at)?event.at:now,
   text:String(event.message||'').toLowerCase().includes('failed')
    ?'An approved task finished with an error. The result is available in Tasks.'
    :'An approved task completed. The result is available in Tasks.',
   dedupeKey:'task-status:'+(event.relatedEventId||event.id||now),
   relatedEventId:event.id||null,
   source:'agent-task-runtime'
  },now,p);
 }
 if(event.semantic==='meeting-ended'){
  return proactiveOpportunity({
   type:'meeting-followup',
   sourceAt:finite(event.at)?event.at:now,
   text:'The meeting has ended. Its summary and action items are ready in the Meeting tab.',
   dedupeKey:'meeting-ended:'+(event.relatedEventId||event.id||now),
   relatedEventId:event.id||null,
   source:'meeting-runtime'
  },now,p);
 }
 return null;
}

function visibleIds(context){
 return new Set((context.visibleParticipantIds||[]).filter(Boolean).map(String));
}

export class ProactiveAgentGovernor{
 constructor(policy=DEFAULT_PROACTIVE_POLICY,{maxPending=20}={}){
  this.policy=normalizeProactivePolicy(policy);
  this.maxPending=Math.max(1,Math.min(60,Math.floor(maxPending)));
  this.pending=[];
  this.interruptions=[];
  this.participantLast=new Map();
  this.lastInterruptionAt=null;
  this.lastDecision=null;
 }
 setPolicy(policy){this.policy=normalizeProactivePolicy(policy);return this.policy;}
 offer(opportunity){
  if(!opportunity)return Object.freeze({accepted:false,reason:'missing-opportunity',opportunity:null});
  const i=this.pending.findIndex(item=>item.dedupeKey===opportunity.dedupeKey);
  if(i>=0){
   this.pending=[...this.pending.slice(0,i),opportunity,...this.pending.slice(i+1)];
   return Object.freeze({accepted:true,reason:'replaced-duplicate',opportunity});
  }
  this.pending=[...this.pending,opportunity].sort((a,b)=>a.eligibleAt-b.eligibleAt)
   .slice(-this.maxPending);
  return Object.freeze({accepted:true,reason:'queued',opportunity});
 }
 cancelByParticipant(participantId){
  const before=this.pending.length;
  this.pending=this.pending.filter(item=>item.participantId!==participantId);
  this.participantLast.delete(participantId);
  return before-this.pending.length;
 }
 forgetRemovedParticipants(validIds=[]){
  const allowed=new Set(validIds.map(String));
  const before=this.pending.length;
  this.pending=this.pending.filter(item=>!item.participantId||allowed.has(String(item.participantId)));
  for(const id of this.participantLast.keys())if(!allowed.has(String(id)))this.participantLast.delete(id);
  return before-this.pending.length;
 }
 noteDialogue(turn,now=Date.now()){
  if(!turn)return null;
  // Any new dialogue supersedes an older follow-up in the same conversation scope.
  const scope=turn.conversationScopeId|| (turn.participantId?'scope:p:'+turn.participantId:null);
  if(scope)this.pending=this.pending.filter(item=>
   !(item.type==='conversation-followup'&&item.scopeId===scope));
  const followup=followupOpportunity(turn,now,this.policy);
  return followup?this.offer(followup):null;
 }
 noteStatusEvent(event,now=Date.now()){
  const opportunity=statusOpportunity(event,now,this.policy);
  return opportunity?this.offer(opportunity):null;
 }
 prune(now=Date.now()){
  const expired=this.pending.filter(item=>now>item.expiresAt);
  this.pending=this.pending.filter(item=>now<=item.expiresAt);
  this.interruptions=this.interruptions.filter(item=>now-item.at>=0&&now-item.at<3600000);
  return expired;
 }
 interruptionGate({
  participantId=null,now=Date.now(),localMinute=null,quietPolicy=null,
  pageVisible=true,busy=false,meetingActive=false,participant=null,
  visibleParticipantIds=[],activeTaskCount=0,lastDialogueAt=0,opportunity=null,
  respectEnabled=true
 }={}){
  this.prune(now);
  const policy=this.policy;
  const minute=localMinute===null
   ? new Date(now).getHours()*60+new Date(now).getMinutes():localMinute;
  if(respectEnabled&&!policy.enabled)return Object.freeze({allow:false,reason:'proactivity disabled'});
  if(!pageVisible)return Object.freeze({allow:false,reason:'page not visible'});
  if(quietPolicy&&inQuietHours(minute,quietPolicy))
   return Object.freeze({allow:false,reason:'quiet hours'});
  if(meetingActive)return Object.freeze({allow:false,reason:'meeting active'});
  if(busy)return Object.freeze({allow:false,reason:'conversation or agent busy'});
  if(participantId&&participant?.agentProactiveEnabled===false)
   return Object.freeze({allow:false,reason:'participant proactive preference disabled'});
  const visible=visibleIds({visibleParticipantIds});
  if(policy.requireVisibleAttention){
   if(participantId&&!visible.has(String(participantId)))
    return Object.freeze({allow:false,reason:'target participant not currently visible'});
   if(!participantId&&visible.size!==1)
    return Object.freeze({allow:false,reason:'no single verified attention target'});
  }
  if(opportunity?.requiresNoActiveTasks&&activeTaskCount>0)
   return Object.freeze({allow:false,reason:'active task dependency'});
  if(opportunity?.type==='conversation-followup'&&
     finite(lastDialogueAt)&&lastDialogueAt>opportunity.sourceAt)
   return Object.freeze({allow:false,reason:'newer conversation superseded follow-up'});
  if(this.lastInterruptionAt!==null&&now-this.lastInterruptionAt<policy.globalCooldownMs)
   return Object.freeze({allow:false,reason:'global interruption cooldown'});
  if(participantId){
   const last=this.participantLast.get(participantId);
   if(last!==undefined&&now-last<policy.participantCooldownMs)
    return Object.freeze({allow:false,reason:'participant interruption cooldown'});
  }
  if(this.interruptions.length>=policy.maxInterruptionsPerHour)
   return Object.freeze({allow:false,reason:'hourly interruption budget exhausted'});
  return Object.freeze({allow:true,reason:'attention and interruption policy allow engagement'});
 }
 evaluateNext(context={}){
  const now=finite(context.now)?context.now:Date.now();
  const expired=this.prune(now);
  const opportunity=this.pending.find(item=>now>=item.eligibleAt)||null;
  if(!opportunity){
   this.lastDecision=Object.freeze({
    action:null,reason:expired.length?'expired opportunities pruned':'no eligible proactive opportunity',
    opportunityId:null,participantId:null,at:now,trace:Object.freeze([])
   });
   return this.lastDecision;
  }
  const participantId=opportunity.participantId||
   ((context.visibleParticipantIds||[]).length===1?context.visibleParticipantIds[0]:null);
  const participant=participantId&&typeof context.participantById==='function'
   ? context.participantById(participantId):context.participant||null;
  const gate=this.interruptionGate({...context,participantId,participant,opportunity,now});
  const waitReasons=new Set([
   'page not visible','quiet hours','meeting active','conversation or agent busy',
   'target participant not currently visible','no single verified attention target',
   'active task dependency','global interruption cooldown','participant interruption cooldown'
  ]);
  const hardCancel=!gate.allow&&!waitReasons.has(gate.reason);
  if(hardCancel)this.pending=this.pending.filter(item=>item.id!==opportunity.id);
  const trace=Object.freeze([
   Object.freeze({stage:'observe',ok:true,detail:opportunity.type+' opportunity'}),
   Object.freeze({stage:'attention',ok:gate.allow,detail:gate.reason}),
   Object.freeze({stage:'dependencies',ok:gate.allow,detail:opportunity.requiresNoActiveTasks?
    'requires no active tasks':'no task dependency'}),
   Object.freeze({stage:'decide',ok:gate.allow,detail:gate.allow?'speak':hardCancel?'cancel':'wait'})
  ]);
  this.lastDecision=Object.freeze({
   action:gate.allow?'speak':hardCancel?'cancel':null,
   reason:gate.reason,opportunityId:opportunity.id,
   participantId:participantId||null,at:now,opportunity,trace
  });
  return this.lastDecision;
 }
 recordOutcome(decision,{executed=false,at=Date.now()}={}){
  if(!decision?.opportunityId)return null;
  this.pending=this.pending.filter(item=>item.id!==decision.opportunityId);
  if(executed){
   this.lastInterruptionAt=at;
   this.interruptions.push({at,participantId:decision.participantId||null,
    type:decision.opportunity?.type||'proactive'});
   this.interruptions=this.interruptions.slice(-20);
   if(decision.participantId)this.participantLast.set(decision.participantId,at);
  }
  return Object.freeze({
   opportunityId:decision.opportunityId,participantId:decision.participantId||null,
   executed:Boolean(executed),at,
   reason:executed?'proactive message emitted':'proactive message cancelled or unavailable'
  });
 }
 recordExternalInterruption({participantId=null,type='external',at=Date.now()}={}){
  this.prune(at);this.lastInterruptionAt=at;
  this.interruptions.push({at,participantId,type});
  this.interruptions=this.interruptions.slice(-20);
  if(participantId)this.participantLast.set(participantId,at);
 }
 snapshot(now=Date.now()){
  this.prune(now);
  return Object.freeze({
   pending:this.pending.length,
   interruptionsThisHour:this.interruptions.length,
   maxInterruptionsPerHour:this.policy.maxInterruptionsPerHour,
   lastDecision:this.lastDecision
  });
 }
}

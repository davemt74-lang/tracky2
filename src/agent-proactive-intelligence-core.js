export const PROACTIVE_INTELLIGENCE_SCHEMA=1;
export const PROACTIVE_MAX_SESSION_PLANS=24;
export const PROACTIVE_MAX_HISTORY=60;
export const PROACTIVE_PLAN_TTL_MS=2*60*60*1000;
export const PROACTIVE_SEMANTIC_REPEAT_MS=30*60*1000;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const short=(value,max=180)=>String(value??'').trim().slice(0,max);

const TYPE_WEIGHTS=Object.freeze({
 'environment-alert':Object.freeze({usefulness:.9,urgency:.86}),
 'task-status':Object.freeze({usefulness:.82,urgency:.62}),
 'meeting-followup':Object.freeze({usefulness:.72,urgency:.38}),
 'conversation-followup':Object.freeze({usefulness:.58,urgency:.22}),
 'media-context':Object.freeze({usefulness:.64,urgency:.12}),
 'routine-status':Object.freeze({usefulness:.52,urgency:.2})
});

function words(value=''){
 return short(value,500).toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/)
  .filter(Boolean).filter(word=>!['a','an','the','is','are','to','of','and','or','with','in','on'].includes(word))
  .slice(0,12);
}
export function semanticOpportunityKey(input={}){
 const type=short(input.type,64)||'proactive';
 const participant=short(input.participantId,96)||'general';
 const scope=short(input.scopeId,160)||'room';
 const explicit=short(input.semanticKey,220);
 if(explicit)return explicit;
 const topic=words(input.text).slice(0,7).join('-')||'status';
 return [type,participant,scope,topic].join(':').slice(0,220);
}
export function proactiveOpportunityScore(input={},now=Date.now()){
 const type=short(input.type,64);
 const weights=TYPE_WEIGHTS[type]||{usefulness:.45,urgency:.2};
 const usefulness=clamp(finite(input.usefulness)?input.usefulness:weights.usefulness);
 const urgency=clamp(finite(input.urgency)?input.urgency:weights.urgency);
 const confidence=clamp(finite(input.confidence)?input.confidence:1);
 const sourceAt=finite(input.sourceAt)?input.sourceAt:now;
 const age=Math.max(0,now-sourceAt);
 const freshness=clamp(1-age/Math.max(60000,Number(input.ttlMs)||180000));
 const repeatPenalty=clamp(input.repeatPenalty);
 const dependencyPenalty=input.requiresNoActiveTasks===true?.08:0;
 const score=clamp(
  usefulness*.42+urgency*.28+confidence*.18+freshness*.12-
  repeatPenalty*.35-dependencyPenalty
 );
 return Object.freeze({
  usefulness:Number(usefulness.toFixed(3)),
  urgency:Number(urgency.toFixed(3)),
  confidence:Number(confidence.toFixed(3)),
  freshness:Number(freshness.toFixed(3)),
  repeatPenalty:Number(repeatPenalty.toFixed(3)),
  score:Number(score.toFixed(3))
 });
}
export function rankProactiveOpportunities(opportunities=[],now=Date.now()){
 return Object.freeze([...(opportunities||[])].map(item=>{
  const scoring=proactiveOpportunityScore(item,now);
  return Object.freeze({...item,...scoring,
   semanticKey:semanticOpportunityKey(item)});
 }).sort((a,b)=>b.score-a.score||
  b.urgency-a.urgency||a.eligibleAt-b.eligibleAt||a.sourceAt-b.sourceAt));
}
export function semanticRepeatState(opportunity,history=[],now=Date.now(),windowMs=PROACTIVE_SEMANTIC_REPEAT_MS){
 const key=semanticOpportunityKey(opportunity);
 const prior=[...(history||[])].filter(row=>row?.executed&&
  row.semanticKey===key&&finite(row.at)&&now-row.at>=0&&now-row.at<windowMs)
  .sort((a,b)=>b.at-a.at)[0]||null;
 return Object.freeze({
  allow:!prior,semanticKey:key,
  reason:prior?'semantically equivalent proactive message recently emitted':
   'no recent semantic duplicate',
  priorAt:prior?.at??null,
  ageMs:prior?now-prior.at:null
 });
}
function scopeKey(turn={}){
 return short(turn.conversationScopeId,180)||
  (turn.participantId?'scope:p:'+short(turn.participantId,96):null);
}
export class ProactiveSessionPlanner{
 constructor({maxPlans=PROACTIVE_MAX_SESSION_PLANS,ttlMs=PROACTIVE_PLAN_TTL_MS}={}){
  this.maxPlans=Math.max(1,Math.min(60,Math.floor(maxPlans)));
  this.ttlMs=Math.max(15*60*1000,Math.min(8*60*60*1000,Number(ttlMs)||PROACTIVE_PLAN_TTL_MS));
  this.plans=new Map();
 }
 prune(now=Date.now()){
  for(const [key,plan] of this.plans){
   if(now-plan.lastDialogueAt>this.ttlMs)this.plans.delete(key);
  }
  if(this.plans.size>this.maxPlans){
   const rows=[...this.plans.entries()].sort((a,b)=>a[1].lastDialogueAt-b[1].lastDialogueAt);
   for(const [key] of rows.slice(0,this.plans.size-this.maxPlans))this.plans.delete(key);
  }
 }
 noteDialogue(turn={},now=Date.now()){
  const key=scopeKey(turn);if(!key)return null;
  this.prune(now);
  const sourceAt=finite(turn.at)?turn.at:(Date.parse(turn.createdAt||'')||now);
  const prior=this.plans.get(key);
  const next=Object.freeze({
   scopeId:key,participantId:short(turn.participantId,96)||null,
   firstDialogueAt:prior?.firstDialogueAt??sourceAt,lastDialogueAt:sourceAt,
   turnCount:Math.min(500,(prior?.turnCount||0)+1),
   proactiveEmitted:prior?.proactiveEmitted||0,
   lastProactiveAt:prior?.lastProactiveAt??null
  });
  this.plans.set(key,next);this.prune(now);return next;
 }
 recordOutcome(opportunity={},executed=false,at=Date.now()){
  if(!executed)return null;
  const key=short(opportunity.scopeId,180);if(!key)return null;
  const prior=this.plans.get(key);if(!prior)return null;
  const next=Object.freeze({...prior,
   proactiveEmitted:Math.min(20,(prior.proactiveEmitted||0)+1),
   lastProactiveAt:at
  });
  this.plans.set(key,next);return next;
 }
 followupContext(turn={},now=Date.now()){
  const key=scopeKey(turn);
  const plan=key?this.plans.get(key):null;
  if(!plan)return Object.freeze({
   scopeId:key,turnCount:1,proactiveEmitted:0,usefulnessAdjustment:0,
   followupStyle:'brief'
  });
  const longSession=plan.turnCount>=6;
  const repeated=plan.proactiveEmitted>=1;
  return Object.freeze({
   scopeId:key,turnCount:plan.turnCount,proactiveEmitted:plan.proactiveEmitted,
   usefulnessAdjustment:repeated?-.16:longSession?.08:0,
   followupStyle:longSession?'continuity':'brief'
  });
 }
 forgetRemovedParticipants(validIds=[]){
  const allowed=new Set((validIds||[]).map(String));
  for(const [key,plan] of this.plans)
   if(plan.participantId&&!allowed.has(String(plan.participantId)))this.plans.delete(key);
 }
 snapshot(now=Date.now()){
  this.prune(now);
  return Object.freeze([...this.plans.values()].map(row=>Object.freeze({...row})));
 }
}
export function routineProactiveOpportunity({
 routine=null,deviation=null,event=null,now=Date.now()
}={}){
 if(!routine||routine.status!=='confirmed'||!event?.participantId||
    routine.participantId!==event.participantId||
    deviation?.state!=='outside-baseline-window')return null;
 return Object.freeze({
  type:'routine-status',participantId:event.participantId,
  scopeId:'routine:'+routine.id,sourceAt:finite(event.at)?event.at:now,
  text:'This observation is outside the timing window of a routine you confirmed.',
  semanticKey:'routine-status:'+routine.id,
  usefulness:.52,urgency:.18,confidence:clamp(deviation.confidence),
  requiresNoActiveTasks:true,source:'owner-confirmed-routine',
  relatedEventId:short(event.id,96)||null,
  routineId:short(routine.id,180)
 });
}

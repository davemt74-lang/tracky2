// V0.15C goal and intent tracking.
// Explicit dialogue requests and governed work only; ambient observations do not create goals.

const clean=(v,n=500)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const GOAL_SCHEMA=1;
export const GOAL_STATES=Object.freeze([
 'proposed','active','waiting-for-user','waiting-for-provider','blocked','completed','abandoned','expired'
]);
export const GOAL_MAX_ACTIVE=24;

const id=()=>globalThis.crypto?.randomUUID?.()||
 'goal-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);

export function explicitGoalFromDialogue(turn={},now=Date.now()){
 const text=clean(turn.transcript,700);
 if(!text||!turn.participantId)return null;
 const lower=text.toLowerCase();
 const request=/^(please\s+)?(can|could|would|will|do|tell|show|find|look|research|recommend|remind|help|explain|give|what|why|how|who|when|where)\b/.test(lower)||
  /\b(can you|could you|would you|please|i want you to|i need you to|help me|look up|find out|tell me|show me|recommend|research)\b/.test(lower);
 if(!request)return null;
 return Object.freeze({
  schema:GOAL_SCHEMA,id:id(),state:'active',source:'explicit-dialogue',
  participantId:clean(turn.participantId,96),intent:text,
  createdAt:now,updatedAt:now,expiresAt:now+30*60*1000,
  originId:clean(turn.id,96)||null,dependencyIds:Object.freeze([]),
  currentStep:'respond-to-user',completionCriteria:'address explicit request',
  lastProgress:null
 });
}

function goalFromWork(row={},now=Date.now()){
 if(!row?.id||!row?.status)return null;
 const state=['pending-confirmation','awaiting-owner'].includes(row.status)?'waiting-for-user':
  row.status==='running'?'active':
  row.status==='scheduled'?'active':
  row.status==='paused'?'blocked':null;
 if(!state)return null;
 return Object.freeze({
  schema:GOAL_SCHEMA,id:'work:'+clean(row.id,96),state,source:'governed-work',
  participantId:clean(row.participantId,96)||null,
  intent:clean(row.kind||'governed work',240),createdAt:now,updatedAt:now,
  expiresAt:0,originId:clean(row.id,96),dependencyIds:Object.freeze([]),
  currentStep:clean(row.status,80),completionCriteria:'governed work reaches terminal state',
  lastProgress:clean(row.status,80)
 });
}

function goalFromFollowThrough(row={},now=Date.now()){
 if(!row?.id||!row?.status)return null;
 const state=row.status==='pending-confirmation'?'waiting-for-user':
  row.status==='confirmed'?'waiting-for-provider':null;
 if(!state)return null;
 return Object.freeze({
  schema:GOAL_SCHEMA,id:'follow:'+clean(row.id,96),state,source:'context-followthrough',
  participantId:clean(row.participantId,96)||null,
  intent:clean(row.action+' follow-through · '+(row.topicKey||''),300),
  createdAt:Number(row.createdAt)||now,updatedAt:now,
  expiresAt:Number(row.expiresAt)||now+180000,originId:clean(row.id,96),
  dependencyIds:Object.freeze([]),currentStep:row.status,
  completionCriteria:'accepted follow-through completes or is declined/expired',
  lastProgress:null
 });
}

export function deriveSystemGoals(state={},now=Date.now()){
 const rows=[];
 for(const work of state.tasks||[]){
  const goal=goalFromWork(work,now);if(goal)rows.push(goal);
 }
 const follow=goalFromFollowThrough(state.followThrough,now);
 if(follow)rows.push(follow);
 return Object.freeze(rows.slice(0,GOAL_MAX_ACTIVE));
}

function terminal(state){return ['completed','abandoned','expired'].includes(state);}

export class GoalIntentTracker{
 constructor({maxGoals=60}={}){
  this.maxGoals=Math.max(24,Math.min(160,Math.floor(maxGoals)||60));
  this.goals=[];this.lastTransition=null;
 }
 upsert(goal,now=Date.now()){
  if(!goal?.id||!GOAL_STATES.includes(goal.state))return null;
  const index=this.goals.findIndex(row=>row.id===goal.id);
  const prior=index>=0?this.goals[index]:null;
  const next=Object.freeze({...goal,updatedAt:now});
  if(index>=0)this.goals[index]=next;else this.goals.push(next);
  this.goals=this.goals.slice(-this.maxGoals);
  this.lastTransition=Object.freeze({at:now,id:next.id,from:prior?.state||null,to:next.state});
  return next;
 }
 addDialogueGoal(turn,now=Date.now()){
  const goal=explicitGoalFromDialogue(turn,now);
  return goal?this.upsert(goal,now):null;
 }
 reconcileSystem(state={},now=Date.now()){
  const derived=deriveSystemGoals(state,now),ids=new Set(derived.map(row=>row.id));
  for(const row of derived)this.upsert(row,now);
  this.goals=this.goals.map(row=>{
   if(!['governed-work','context-followthrough'].includes(row.source)||terminal(row.state)||ids.has(row.id))return row;
   const next=Object.freeze({...row,state:'completed',updatedAt:now,lastProgress:'source reached terminal or disappeared'});
   this.lastTransition=Object.freeze({at:now,id:row.id,from:row.state,to:'completed'});
   return next;
  }).slice(-this.maxGoals);
  this.expire(now);
  return this.active();
 }
 transition(id,state,{step=null,progress=null,expiresAt=null,now=Date.now()}={}){
  if(!GOAL_STATES.includes(state))return null;
  const current=this.goals.find(row=>row.id===id);if(!current)return null;
  return this.upsert(Object.freeze({
   ...current,state,currentStep:step===null?current.currentStep:clean(step,160),
   lastProgress:progress===null?current.lastProgress:clean(progress,240),
   expiresAt:expiresAt===null?current.expiresAt:Number(expiresAt)||0
  }),now);
 }
 expire(now=Date.now()){
  this.goals=this.goals.map(row=>
   !terminal(row.state)&&finite(row.expiresAt)&&row.expiresAt>0&&now>row.expiresAt
    ?Object.freeze({...row,state:'expired',updatedAt:now,lastProgress:'goal expired'}):row
  );
 }
 active(){
  return Object.freeze(this.goals.filter(row=>!terminal(row.state)).slice(-GOAL_MAX_ACTIVE));
 }
 primary(){
  const rank={'active':5,'waiting-for-provider':4,'waiting-for-user':3,'blocked':2,'proposed':1};
  return [...this.active()].sort((a,b)=>(rank[b.state]||0)-(rank[a.state]||0)||b.updatedAt-a.updatedAt)[0]||null;
 }
 snapshot(){
  return Object.freeze({
   primary:this.primary(),active:this.active(),
   recent:Object.freeze(this.goals.slice(-20)),lastTransition:this.lastTransition
  });
 }
 reset(){this.goals=[];this.lastTransition=null;}
}

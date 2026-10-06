// V0.15D unified cognitive planning/orchestration.
// Chooses the next cognitive action. It never performs side effects itself.

const clean=(v,n=260)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const COGNITIVE_ORCHESTRATOR_SCHEMA=1;
export const COGNITIVE_ACTIONS=Object.freeze([
 'respond-user','continue-goal','ask-question','offer-contextual','process-proactive',
 'execute-approved','greet','monitor','wait','abstain'
]);

export function cognitiveCyclePlan({
 state=null,attention=null,goal=null,arrivalDecision=null,now=Date.now()
}={}){
 const primary=attention?.primary||null;
 const activeGoal=goal||null;
 const reasons=[];

 if(!state)return Object.freeze({
  schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'abstain',
  reason:'no-canonical-state',participantId:null,attentionId:null,goalId:null
 });

 if(state.meeting?.status==='active'&&
    !['direct-user','important-event'].includes(primary?.type||'')){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'wait',
   reason:'meeting-active',participantId:primary?.participantId||activeGoal?.participantId||null,
   attentionId:primary?.id||null,goalId:activeGoal?.id||null
  });
 }

 if(primary?.type==='direct-user'){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'respond-user',
   reason:'direct-user-has-priority',participantId:primary.participantId||activeGoal?.participantId||null,
   attentionId:primary.id,goalId:activeGoal?.id||null
  });
 }

 if(arrivalDecision?.action==='greet'&&arrivalDecision.expiresAt>=now){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'greet',
   reason:'approved-arrival-greeting-candidate',participantId:arrivalDecision.participantId||null,
   attentionId:primary?.id||null,goalId:null,arrivalDecisionId:arrivalDecision.id||null
  });
 }

 if(primary?.type==='important-event'){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'process-proactive',
   reason:'important-event-has-priority',participantId:primary.participantId||null,
   attentionId:primary.id,goalId:activeGoal?.id||null
  });
 }

 if(activeGoal){
  if(activeGoal.state==='waiting-for-user'){
   return Object.freeze({
    schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'wait',
    reason:'goal-waiting-for-user',participantId:activeGoal.participantId||null,
    attentionId:primary?.id||null,goalId:activeGoal.id
   });
  }
  if(activeGoal.state==='waiting-for-provider'||activeGoal.state==='blocked'){
   return Object.freeze({
    schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'wait',
    reason:'goal-not-executable-now',participantId:activeGoal.participantId||null,
    attentionId:primary?.id||null,goalId:activeGoal.id
   });
  }
  if(activeGoal.state==='active'){
   return Object.freeze({
    schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'continue-goal',
    reason:'active-goal-has-priority',participantId:activeGoal.participantId||null,
    attentionId:primary?.id||null,goalId:activeGoal.id
   });
  }
 }

 if(primary?.type==='required-followup'){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'wait',
   reason:'followthrough-awaiting-user',participantId:primary.participantId||null,
   attentionId:primary.id,goalId:null
  });
 }

 if(primary?.type==='contextual-opportunity'){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'offer-contextual',
   reason:'contextual-opportunity-selected',participantId:primary.participantId||null,
   attentionId:primary.id,goalId:null
  });
 }

 if((state.agent?.pendingProactive||0)>0){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'process-proactive',
   reason:'governed-proactive-opportunity-pending',participantId:primary?.participantId||null,
   attentionId:primary?.id||null,goalId:null
  });
 }

 if(primary?.type==='passive-observation'){
  return Object.freeze({
   schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'monitor',
   reason:'passive-observation-only',participantId:primary.participantId||null,
   attentionId:primary.id,goalId:null
  });
 }

 reasons.push('no-actionable-attention-or-goal');
 return Object.freeze({
  schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'abstain',
  reason:reasons[0],participantId:null,attentionId:null,goalId:null
 });
}

export class CognitiveOrchestrator{
 constructor({minCadenceMs=750,maxHistory=80}={}){
  this.minCadenceMs=Math.max(250,Number(minCadenceMs)||750);
  this.maxHistory=Math.max(20,Math.min(200,Math.floor(maxHistory)||80));
  this.lastAt=0;this.lastPlan=null;this.history=[];
 }
 evaluate(input={}){
  const now=Number(input.now)||Date.now();
  if(this.lastAt&&now-this.lastAt<this.minCadenceMs){
   return Object.freeze({
    schema:COGNITIVE_ORCHESTRATOR_SCHEMA,at:now,action:'wait',
    reason:'cognitive-cadence-budget',participantId:null,attentionId:null,goalId:null
   });
  }
  const plan=cognitiveCyclePlan({...input,now});
  this.lastAt=now;this.lastPlan=plan;
  this.history=[...this.history,Object.freeze({
   at:now,action:plan.action,reason:plan.reason,attentionId:plan.attentionId||null,goalId:plan.goalId||null
  })].slice(-this.maxHistory);
  return plan;
 }
 snapshot(){return Object.freeze({lastPlan:this.lastPlan,recent:Object.freeze(this.history.slice(-16))});}
 reset(){this.lastAt=0;this.lastPlan=null;this.history=[];}
}

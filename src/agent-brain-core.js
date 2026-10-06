// V0.15G Agent Brain operational observability.
// Exposes compact state/reason summaries only; never hidden chain-of-thought.

const clean=(v,n=260)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const AGENT_BRAIN_SCHEMA=1;

export function buildAgentBrainSnapshot({
 cognitiveState=null,attention=null,goal=null,orchestrator=null,
 conversation=null,outcome=null,memory=null,providers=null,runtime=null,
 followThrough=null,paused=false,proactivityEnabled=true,now=Date.now()
}={}){
 const participantIds=Object.freeze([...(cognitiveState?.visibleParticipantIds||[])].slice(0,16));
 return Object.freeze({
  schema:AGENT_BRAIN_SCHEMA,at:now,paused:Boolean(paused),proactivityEnabled:Boolean(proactivityEnabled),
  room:Object.freeze({
   id:clean(cognitiveState?.room?.id,96)||null,
   name:clean(cognitiveState?.room?.name,120)||null,
   visibleParticipantIds:participantIds,
   mediaKind:clean(cognitiveState?.media?.kind,48)||null,
   mediaStatus:clean(cognitiveState?.media?.status,32)||null
  }),
  attention:attention?.primary?Object.freeze({
   id:clean(attention.primary.id,120),type:clean(attention.primary.type,64),
   participantId:clean(attention.primary.participantId,96)||null,
   score:Number(attention.primary.score)||0,
   reason:clean(attention.reason,160)||'highest-ranked-attention'
  }):null,
  goal:goal?Object.freeze({
   id:clean(goal.id,120),state:clean(goal.state,48),
   participantId:clean(goal.participantId,96)||null,
   intent:clean(goal.intent,300),currentStep:clean(goal.currentStep,160)||null
  }):null,
  orchestrator:orchestrator?Object.freeze({
   action:clean(orchestrator.action,64),reason:clean(orchestrator.reason,220),
   participantId:clean(orchestrator.participantId,96)||null,
   goalId:clean(orchestrator.goalId,120)||null
  }):null,
  conversation:conversation?Object.freeze({
   disposition:clean(conversation.disposition,64)||null,
   reason:clean(conversation.reason,220)||null
  }):null,
  followThrough:followThrough?Object.freeze({
   id:clean(followThrough.id,120),status:clean(followThrough.status,48),
   action:clean(followThrough.action,64),participantId:clean(followThrough.participantId,96)||null
  }):null,
  outcome:outcome?Object.freeze({
   action:clean(outcome.action,64),kind:clean(outcome.kind,48),
   score:Number(outcome.score)||0,reason:clean(outcome.reason,220)
  }):null,
  memory:Object.freeze({
   active:Number(memory?.active)||0,proposals:Number(memory?.proposals)||0
  }),
  providers:Object.freeze({
   available:Object.freeze([...(providers?.available||[])].map(v=>clean(v,32)).filter(Boolean).slice(0,8)),
   degraded:Object.freeze([...(providers?.degraded||[])].map(v=>clean(v,32)).filter(Boolean).slice(0,8))
  }),
  runtime:Object.freeze({
   performanceLevel:clean(runtime?.performanceLevel,32)||'unknown',
   storageStatus:clean(runtime?.storageStatus,32)||'unknown'
  }),
  explanation:Object.freeze([
   attention?.primary?'Attention: '+clean(attention.primary.type,64)+' selected by deterministic priority.':'Attention: none.',
   goal?'Goal: '+clean(goal.state,48)+' · '+clean(goal.currentStep,120):'Goal: none active.',
   orchestrator?'Plan: '+clean(orchestrator.action,64)+' · '+clean(orchestrator.reason,180):'Plan: no cycle yet.'
  ]),
  hiddenReasoningExposed:false
 });
}

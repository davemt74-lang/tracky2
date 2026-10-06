// V0.15B attention and priority engine.
// Consumes canonical cognitive state and selects at most one primary attention target.

const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const clean=(v,n=220)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const ATTENTION_SCHEMA=1;
export const ATTENTION_MAX_CANDIDATES=32;

const BASE=Object.freeze({
 'direct-user':1,
 'important-event':.9,
 'active-goal':.82,
 'required-followup':.75,
 'active-work':.7,
 'contextual-opportunity':.58,
 'passive-observation':.28
});

function candidate(input={}){
 return Object.freeze({
  id:clean(input.id,120)||null,
  type:clean(input.type,64)||'passive-observation',
  participantId:clean(input.participantId,96)||null,
  sourceId:clean(input.sourceId,120)||null,
  topicKey:clean(input.topicKey,360)||null,
  createdAt:Number(input.createdAt)||0,
  expiresAt:Number(input.expiresAt)||0,
  base:clamp(input.base??BASE[input.type]??.2),
  urgency:clamp(input.urgency),
  confidence:clamp(input.confidence),
  salience:clamp(input.salience??.5),
  requiresVisibleParticipant:input.requiresVisibleParticipant===true,
  description:clean(input.description,240)||null
 });
}

export function attentionCandidatesFromState(state={},now=Date.now()){
 const rows=[];
 const speakers=state.speakerParticipantIds||[];
 for(const participantId of speakers){
  rows.push(candidate({
   id:'user:'+participantId,type:'direct-user',participantId,
   createdAt:state.conversation?.lastDialogueAt||now,expiresAt:now+15000,
   urgency:1,confidence:1,salience:1,description:'Verified participant is speaking'
  }));
 }

 for(const event of state.events||[]){
  if(event.freshness==='stale')continue;
  const important=event.semantic==='environmental-alert'||event.category==='alert'||event.salience>=.85;
  rows.push(candidate({
   id:'event:'+event.id,type:important?'important-event':'passive-observation',
   participantId:event.participantId,sourceId:event.id,topicKey:event.topicKey,
   createdAt:event.at||now,expiresAt:(event.at||now)+(important?120000:45000),
   urgency:important?.92:.18,confidence:event.confidence,salience:event.salience,
   description:event.semantic
  }));
 }

 for(const goal of state.goals||[]){
  rows.push(candidate({
   id:'goal:'+goal.id,type:'active-goal',participantId:goal.participantId,
   sourceId:goal.id,createdAt:now,expiresAt:goal.expiresAt||now+120000,
   urgency:goal.state==='blocked'?.78:
    goal.state==='waiting-for-user'?.74:
    goal.state==='waiting-for-provider'?.7:.62,
   confidence:1,salience:.82,
   description:goal.intent+' · '+goal.state
  }));
 }

 for(const work of state.tasks||[]){
  rows.push(candidate({
   id:'work:'+work.id,type:'active-work',participantId:work.participantId,
   sourceId:work.id,createdAt:now,expiresAt:now+60000,
   urgency:work.requiresOwnerAction?.82:.5,confidence:1,salience:.7,
   description:work.kind+' · '+work.status
  }));
 }

 if(state.followThrough?.status==='pending-confirmation'){
  rows.push(candidate({
   id:'follow:'+state.followThrough.id,type:'required-followup',
   participantId:state.followThrough.participantId,sourceId:state.followThrough.id,
   topicKey:state.followThrough.topicKey,createdAt:now,expiresAt:state.followThrough.expiresAt||now+60000,
   urgency:.72,confidence:1,salience:.8,requiresVisibleParticipant:true,
   description:'Pending '+state.followThrough.action+' confirmation'
  }));
 }

 if(state.media?.status==='active'&&state.media.identity&&
    state.media.lastAt&&now-state.media.lastAt<=60000){
  const identity=state.media.identity;
  rows.push(candidate({
   id:'media:'+String(state.media.continuityId||state.media.lastAt),
   type:'contextual-opportunity',sourceId:state.media.continuityId,
   topicKey:[state.media.kind,identity.artist,identity.series,identity.title].filter(Boolean).join(':').toLowerCase(),
   createdAt:state.media.lastAt,expiresAt:state.media.lastAt+90000,
   urgency:.12,confidence:identity.confidence,salience:.55,
   requiresVisibleParticipant:true,description:'Current '+state.media.kind+' context'
  }));
 }

 return Object.freeze(rows.slice(0,ATTENTION_MAX_CANDIDATES));
}

export function scoreAttention(candidate,state={},now=Date.now(),history=[]){
 const visible=new Set(state.visibleParticipantIds||[]);
 if(candidate.expiresAt&&now>candidate.expiresAt)return Object.freeze({score:0,blocked:'expired'});
 if(candidate.requiresVisibleParticipant&&candidate.participantId&&!visible.has(candidate.participantId))
  return Object.freeze({score:0,blocked:'participant-not-visible'});
 if(candidate.requiresVisibleParticipant&&!candidate.participantId&&visible.size!==1)
  return Object.freeze({score:0,blocked:'no-single-visible-target'});
 if(state.meeting?.status==='active'&&['contextual-opportunity','passive-observation'].includes(candidate.type))
  return Object.freeze({score:0,blocked:'meeting-active'});
 if(state.conversation?.userSpeaking&&candidate.type!=='direct-user'&&candidate.type!=='important-event')
  return Object.freeze({score:0,blocked:'user-speaking'});
 if(state.agent?.busy&&candidate.type==='contextual-opportunity')
  return Object.freeze({score:0,blocked:'agent-busy'});

 const age=Math.max(0,now-(candidate.createdAt||now));
 const freshness=Math.pow(.5,age/(candidate.type==='important-event'?120000:60000));
 const repeats=(history||[]).filter(row=>row?.sourceId&&row.sourceId===candidate.sourceId&&now-(row.at||0)<300000).length;
 const repeatPenalty=Math.min(.35,repeats*.12);
 const conflictPenalty=(state.conflicts||[]).length?Math.min(.25,(state.conflicts||[]).length*.08):0;
 const score=clamp(
  candidate.base*.55+
  candidate.urgency*.18+
  candidate.salience*.12+
  candidate.confidence*.08+
  freshness*.07-
  repeatPenalty-
  conflictPenalty
 );
 return Object.freeze({score:Number(score.toFixed(4)),blocked:null,freshness,repeatPenalty,conflictPenalty});
}

export function selectPrimaryAttention(state={},{
 candidates=null,history=[],now=Date.now()
}={}){
 const rows=(candidates||attentionCandidatesFromState(state,now)).map(row=>{
  const scored=scoreAttention(row,state,now,history);
  return Object.freeze({...row,...scored});
 });
 const eligible=rows.filter(row=>!row.blocked&&row.score>=.25)
  .sort((a,b)=>b.score-a.score||b.base-a.base||b.createdAt-a.createdAt);
 const primary=eligible[0]||null;
 return Object.freeze({
  schema:ATTENTION_SCHEMA,at:now,primary,
  candidates:Object.freeze(rows),
  reason:primary?'highest-ranked-attention':'no-attention-worthy-target'
 });
}

export class AttentionPriorityEngine{
 constructor({maxHistory=60}={}){
  this.maxHistory=Math.max(12,Math.min(180,Math.floor(maxHistory)||60));
  this.history=[];this.lastDecision=null;
 }
 evaluate(state,options={}){
  const decision=selectPrimaryAttention(state,{...options,history:this.history});
  this.lastDecision=decision;return decision;
 }
 record(decision,{acted=false,at=Date.now()}={}){
  if(!decision?.primary)return null;
  const row=Object.freeze({
   at,id:decision.primary.id,type:decision.primary.type,
   sourceId:decision.primary.sourceId||null,participantId:decision.primary.participantId||null,
   acted:Boolean(acted)
  });
  this.history=[...this.history,row].slice(-this.maxHistory);
  return row;
 }
 snapshot(){return Object.freeze({lastDecision:this.lastDecision,recent:Object.freeze(this.history.slice(-12))});}
 reset(){this.history=[];this.lastDecision=null;}
}

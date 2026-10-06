// V0.15.1C canonical conversation ownership and handoff coordination.
// Metadata-only: consumes canonical turn/presence fields and never opens sensors or network paths.
const short=(v,n=120)=>String(v??'').trim().slice(0,n);
const uniq=xs=>[...new Set((xs||[]).filter(Boolean).map(x=>short(x,96)))];
export const CONVERSATION_OWNERSHIP_SCHEMA=1;
export const CONVERSATION_OWNERSHIP_HISTORY_MAX=96;

function normalizedTurn(turn={}){
 return Object.freeze({
  id:short(turn.id,96)||null,
  participantId:short(turn.participantId,96)||null,
  scopeId:short(turn.conversationScopeId,180)||null,
  groupSize:Math.max(1,Number(turn.conversationGroupSize)||1),
  turnOwnership:short(turn.turnOwnership,48)||'unverified-speaker',
  multiPersonTurnOwnership:short(turn.multiPersonTurnOwnership,48)||null,
  ownershipChangeCount:Math.max(0,Number(turn.multiPersonOwnershipChangeCount)||0),
  addressedAgent:turn.addressedAgent===true,
  addressedParticipantIds:Object.freeze(uniq(turn.addressedParticipantIds)),
  attentionTarget:short(turn.attentionTarget,64)||'unknown',
  associationState:short(turn.associationState,64)||'unknown-speaker',
  attribution:short(turn.attribution,48)||'unknown'
 });
}
function event(input={}){
 return Object.freeze({
  schema:CONVERSATION_OWNERSHIP_SCHEMA,
  at:Math.max(0,Number(input.at)||0),
  type:short(input.type,48)||'ownership-observed',
  fromParticipantId:short(input.fromParticipantId,96)||null,
  toParticipantId:short(input.toParticipantId,96)||null,
  fromScopeId:short(input.fromScopeId,180)||null,
  toScopeId:short(input.toScopeId,180)||null,
  reason:short(input.reason,160)||null
 });
}

export function conversationReplyOwnershipPolicy(turn={},ownership={}){
 const t=normalizedTurn(turn);
 if(t.multiPersonTurnOwnership==='overlap')
  return Object.freeze({allow:false,reason:'abstain: overlapping speakers have no single conversation owner'});
 if(t.multiPersonTurnOwnership==='multi-speaker'||t.ownershipChangeCount>0)
  return Object.freeze({allow:false,reason:'abstain: speaker ownership changes inside canonical turn'});
 if(['ambiguous-speaker','multi-speaker-unresolved'].includes(t.turnOwnership))
  return Object.freeze({allow:false,reason:'abstain: current turn ownership unresolved'});
 if(t.addressedParticipantIds.length&&!t.addressedAgent)
  return Object.freeze({allow:false,reason:'abstain: another participant owns the addressed turn'});
 if(t.groupSize>1&&!t.addressedAgent)
  return Object.freeze({allow:false,reason:'abstain: group conversation not addressed to AGENT'});
 if(t.participantId&&ownership?.participantId&&
    t.participantId!==ownership.participantId&&ownership?.state==='contested')
  return Object.freeze({allow:false,reason:'abstain: conversation ownership contested'});
 return Object.freeze({allow:true,reason:t.addressedAgent?'engage: AGENT explicitly owns reply turn':'engage: stable single-party ownership'});
}

export class ConversationOwnershipTracker{
 constructor({historyMax=CONVERSATION_OWNERSHIP_HISTORY_MAX}={}){
  this.historyMax=Math.max(12,Math.min(240,Math.floor(Number(historyMax)||CONVERSATION_OWNERSHIP_HISTORY_MAX)));
  this.current=null;this.history=[];
 }
 reset(){this.current=null;this.history=[];}
 observe(turn={},at=Date.now()){
  const t=normalizedTurn(turn);
  let state='unowned',participantId=null,scopeId=t.scopeId,reason='speaker-unverified';
  if(t.multiPersonTurnOwnership==='overlap'||t.multiPersonTurnOwnership==='multi-speaker'||
     t.ownershipChangeCount>0||['ambiguous-speaker','multi-speaker-unresolved'].includes(t.turnOwnership)){
   state='contested';reason='multi-speaker-or-ambiguous-turn';
  }else if(t.participantId&&t.attribution!=='unknown'){
   participantId=t.participantId;
   state=t.groupSize>1?(t.addressedAgent?'agent-addressed-group':'participant-owned-group'):'participant-owned';
   reason=t.addressedAgent?'verified-speaker-addressed-agent':'verified-speaker';
  }else if(t.addressedAgent&&t.groupSize===1){
   state='agent-addressed-unverified';reason='agent-addressed-but-speaker-unverified';
  }
  const previous=this.current;
  const next=Object.freeze({
   schema:CONVERSATION_OWNERSHIP_SCHEMA,state,participantId,scopeId,
   groupSize:t.groupSize,attentionTarget:t.attentionTarget,reason,at,
   turnId:t.id
  });
  let transition=null;
  if(!previous){
   transition=event({at,type:participantId?'ownership-established':'ownership-unresolved',
    toParticipantId:participantId,toScopeId:scopeId,reason});
  }else if(previous.state!=='contested'&&state==='contested'){
   transition=event({at,type:'ownership-contested',
    fromParticipantId:previous.participantId,fromScopeId:previous.scopeId,
    toScopeId:scopeId,reason});
  }else if(previous.state==='contested'&&state!=='contested'){
   transition=event({at,type:'ownership-resolved',
    toParticipantId:participantId,toScopeId:scopeId,reason});
  }else if(previous.participantId&&participantId&&previous.participantId!==participantId){
   transition=event({at,type:'participant-handoff',
    fromParticipantId:previous.participantId,toParticipantId:participantId,
    fromScopeId:previous.scopeId,toScopeId:scopeId,reason:'verified-speaker-changed'});
  }else if(previous.scopeId&&scopeId&&previous.scopeId!==scopeId){
   transition=event({at,type:'scope-handoff',
    fromParticipantId:previous.participantId,toParticipantId:participantId,
    fromScopeId:previous.scopeId,toScopeId:scopeId,reason:'conversation-membership-changed'});
  }else if(previous.participantId&&!participantId){
   transition=event({at,type:'ownership-lost',
    fromParticipantId:previous.participantId,fromScopeId:previous.scopeId,
    toScopeId:scopeId,reason});
  }
  this.current=next;
  if(transition)this.history=[...this.history,transition].slice(-this.historyMax);
  return Object.freeze({state:next,transition,reply:conversationReplyOwnershipPolicy(t,next)});
 }
 snapshot(){
  return Object.freeze({
   schema:CONVERSATION_OWNERSHIP_SCHEMA,
   current:this.current?Object.freeze({...this.current}):null,
   history:Object.freeze([...this.history])
  });
 }
}

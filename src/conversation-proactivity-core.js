// V0.15E conversation entry/continuity/proactivity intelligence.
// Decides mention-now vs defer vs ignore vs continue-thread without performing speech.

const clean=(v,n=300)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const CONVERSATION_PROACTIVITY_SCHEMA=1;
export const PROACTIVITY_DISPOSITIONS=Object.freeze([
 'mention-now','defer','ignore','continue-thread','stop-thread'
]);
export const THREAD_TTL_MS=5*60*1000;
export const DEFER_TTL_MS=10*60*1000;

function participantState(state={},participantId){
 return (state.participants||[]).find(row=>String(row.id)===String(participantId))||null;
}

export function proactiveConversationDisposition({
 state={},candidate=null,goal=null,history=[],thread=null,now=Date.now()
}={}){
 if(!candidate?.participantId||!candidate?.topicKey)
  return Object.freeze({disposition:'ignore',reason:'missing-participant-or-topic'});

 const person=participantState(state,candidate.participantId);
 if(!person?.visible)
  return Object.freeze({disposition:'defer',reason:'participant-not-visible'});
 if(state.meeting?.status==='active')
  return Object.freeze({disposition:'defer',reason:'meeting-active'});
 if(state.conversation?.userSpeaking||state.conversation?.processing||state.agent?.speaking)
  return Object.freeze({disposition:'defer',reason:'conversation-active'});
 if(goal&&['active','waiting-for-provider','blocked'].includes(goal.state))
  return Object.freeze({disposition:'defer',reason:'active-goal-has-focus'});
 if(goal?.state==='waiting-for-user')
  return Object.freeze({disposition:'defer',reason:'waiting-for-user-on-existing-goal'});

 const recent=(history||[]).filter(row=>row.participantId===candidate.participantId&&
  now-(row.at||0)>=0&&now-(row.at||0)<=30*60*1000);
 const sameTopic=recent.filter(row=>row.topicKey===candidate.topicKey);
 const dismissed=sameTopic.some(row=>row.outcome==='dismissed');
 const ignored=sameTopic.filter(row=>row.outcome==='ignored').length;
 const positive=sameTopic.filter(row=>['positive','expanded'].includes(row.outcome)).length;

 if(dismissed&&sameTopic.some(row=>now-(row.at||0)<60*60*1000))
  return Object.freeze({disposition:'ignore',reason:'recent-topic-dismissal'});
 if(ignored>=2)
  return Object.freeze({disposition:'ignore',reason:'repeated-topic-nonresponse'});

 if(thread&&thread.participantId===candidate.participantId&&thread.topicKey===candidate.topicKey&&
    thread.status==='open'&&now-thread.lastAt<=THREAD_TTL_MS){
  return Object.freeze({
   disposition:'continue-thread',
   reason:positive?'active-topic-with-positive-engagement':'active-topic-thread'
  });
 }

 if(thread&&thread.status==='open'&&thread.participantId===candidate.participantId&&
    thread.topicKey!==candidate.topicKey&&now-thread.lastAt<90000){
  return Object.freeze({disposition:'defer',reason:'recent-other-topic-thread'});
 }

 const dialogueQuietMs=state.conversation?.lastDialogueAt
  ?Math.max(0,now-state.conversation.lastDialogueAt):Infinity;
 const availability=person.stationaryMs>=45000&&dialogueQuietMs>=30000;
 if(!availability)
  return Object.freeze({disposition:'defer',reason:'participant-not-yet-available'});

 return Object.freeze({disposition:'mention-now',reason:'available-and-contextually-relevant'});
}

export class ConversationProactivityEngine{
 constructor({maxHistory=80,maxDeferred=20}={}){
  this.maxHistory=Math.max(20,Math.min(200,Math.floor(maxHistory)||80));
  this.maxDeferred=Math.max(5,Math.min(60,Math.floor(maxDeferred)||20));
  this.history=[];this.thread=null;this.deferred=[];this.lastDecision=null;
 }
 evaluate(input={}){
  const now=Number(input.now)||Date.now();
  const decision=proactiveConversationDisposition({
   ...input,history:this.history,thread:this.thread,now
  });
  this.lastDecision=Object.freeze({
   at:now,participantId:input.candidate?.participantId||null,
   topicKey:input.candidate?.topicKey||null,...decision
  });
  if(decision.disposition==='defer'&&input.candidate?.topicKey){
   const row=Object.freeze({
    participantId:input.candidate.participantId,topicKey:input.candidate.topicKey,
    mediaKind:input.candidate.mediaKind||null,createdAt:now,expiresAt:now+DEFER_TTL_MS
   });
   this.deferred=[
    ...this.deferred.filter(x=>!(x.participantId===row.participantId&&x.topicKey===row.topicKey)),
    row
   ].slice(-this.maxDeferred);
  }
  if(['mention-now','continue-thread'].includes(decision.disposition)&&input.candidate){
   this.thread=Object.freeze({
    participantId:input.candidate.participantId,topicKey:input.candidate.topicKey,
    mediaKind:input.candidate.mediaKind||null,status:'open',startedAt:this.thread?.topicKey===input.candidate.topicKey
     ?this.thread.startedAt:now,lastAt:now,turns:(this.thread?.topicKey===input.candidate.topicKey?this.thread.turns:0)+1
   });
  }
  if(decision.disposition==='stop-thread'&&this.thread)
   this.thread=Object.freeze({...this.thread,status:'closed',lastAt:now});
  this.prune(now);return this.lastDecision;
 }
 noteOutcome({participantId=null,topicKey=null,outcome='neutral',at=Date.now()}={}){
  const allowed=['positive','expanded','neutral','ignored','dismissed','topic-changed'];
  const row=Object.freeze({
   participantId:clean(participantId,96)||null,topicKey:clean(topicKey,360)||null,
   outcome:allowed.includes(outcome)?outcome:'neutral',at
  });
  this.history=[...this.history,row].slice(-this.maxHistory);
  if(this.thread&&this.thread.participantId===row.participantId){
   if(row.outcome==='topic-changed'||row.outcome==='dismissed')
    this.thread=Object.freeze({...this.thread,status:'closed',lastAt:at});
   else if(row.topicKey===this.thread.topicKey)
    this.thread=Object.freeze({...this.thread,lastAt:at});
  }
  this.prune(at);return row;
 }
 prune(now=Date.now()){
  this.deferred=this.deferred.filter(row=>now<=row.expiresAt);
  if(this.thread&&now-this.thread.lastAt>THREAD_TTL_MS)
   this.thread=Object.freeze({...this.thread,status:'closed'});
 }
 snapshot(now=Date.now()){
  this.prune(now);
  return Object.freeze({
   thread:this.thread,lastDecision:this.lastDecision,
   deferred:Object.freeze(this.deferred.slice(-10)),
   recent:Object.freeze(this.history.slice(-12))
  });
 }
 reset(){this.history=[];this.thread=null;this.deferred=[];this.lastDecision=null;}
}

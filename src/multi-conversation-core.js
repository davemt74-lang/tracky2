// V0.11D conservative multi-participant conversation coordination.
// Consumes canonical turn/speaker metadata only. Never opens sensors, identifies
// speakers, transcribes audio, or infers addressees from camera proximity alone.

export const MULTI_CONVERSATION_SCHEMA=1;
export const GROUP_CONTEXT_MAX_TURNS=10;

const short=(value,max=96)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value)))];
const escapeRe=value=>String(value).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');

function explicitVocative(text,alias){
 const value=String(text||'').trim();
 const name=String(alias||'').trim();
 if(!value||!name)return false;
 const escaped=escapeRe(name);
 const start=new RegExp(
  '^(?:(?:hey|hi|hello|ok|okay)\\s+)?'+escaped+
  '(?:\\s*[,!?:-]|\\s+(?:can|could|would|will|please|what|why|how|do|did|are|is)\\b)','i'
 );
 // A trailing name is treated as a direct address only with explicit punctuation.
 const end=new RegExp('[,;:]\\s*'+escaped+'[.!?]+$','i');
 const tagged=new RegExp('(?:^|\\s)@'+escaped+'\\b','i');
 return start.test(value)||end.test(value)||tagged.test(value);
}

export function resolveConversationAddress(text,participants=[],{
 agentAliases=['agent','tracky']
}={}){
 const participantMentions=[];
 for(const person of Array.isArray(participants)?participants:[]){
  if(!person?.id)continue;
  const aliases=uniq([person.nickname,person.name]).filter(alias=>alias.length>=2);
  if(aliases.some(alias=>explicitVocative(text,alias)))
   participantMentions.push(short(person.id));
 }
 const addressedParticipantIds=uniq(participantMentions);
 const addressedAgent=(agentAliases||[]).some(alias=>explicitVocative(text,alias));
 let kind='unspecified';
 if(addressedAgent&&addressedParticipantIds.length)kind='agent+participants';
 else if(addressedAgent)kind='agent';
 else if(addressedParticipantIds.length===1)kind='participant';
 else if(addressedParticipantIds.length>1)kind='participants';
 return Object.freeze({
  kind,addressedAgent,
  addressedParticipantId:addressedParticipantIds.length===1?addressedParticipantIds[0]:null,
  addressedParticipantIds:Object.freeze(addressedParticipantIds)
 });
}

export function conversationScopeId({
 speakerParticipantId=null,participantIds=[],visitorIds=[],groupSize=1
}={}){
 const people=uniq([speakerParticipantId,...participantIds]).sort();
 const visitors=uniq(visitorIds).sort();
 const size=Math.max(1,Number(groupSize)||1);
 if(people.length||visitors.length)
  return 'scope:'+people.map(id=>'p:'+id).concat(visitors.map(id=>'v:'+id)).join('|');
 // Unknown scopes are display/audit labels only and MUST NOT be reused for memory/history.
 return size>1?'scope:unknown-group-'+size:'scope:unknown-solo';
}

export function multiConversationTurnFields(turn={},{
 visibleParticipants=[],visibleVisitorIds=[],groupSize=null
}={}){
 const speakerParticipantId=turn.participantId||null;
 const nearby=uniq(turn.nearbyParticipantIds||[]);
 const visiblePeople=(Array.isArray(visibleParticipants)?visibleParticipants:[])
  .filter(person=>person?.id);
 const participantIds=uniq([speakerParticipantId,...nearby,...visiblePeople.map(person=>person.id)]);
 const visitorIds=uniq([...(visibleVisitorIds||[]),turn.visitorId||null]);
 const inferredSize=Math.max(1,participantIds.length+visitorIds.length);
 const conversationGroupSize=Math.max(1,inferredSize,Number(groupSize)||0);
 const groupParticipants=visiblePeople.filter(person=>participantIds.includes(person.id));
 const address=resolveConversationAddress(turn.transcript,groupParticipants);
 const association=String(turn.associationState||'unknown-speaker');
 const overlapState=turn.overlapEvidence===true?'overlap-observed':'not-observed';
 const turnOwnership=speakerParticipantId&&turn.attribution!=='unknown'
  ? 'verified-speaker'
  : association==='ambiguous-voice'
    ? 'ambiguous-speaker'
    : 'unverified-speaker';
 const unresolvedGroupSpeaker=turnOwnership==='ambiguous-speaker'&&conversationGroupSize>1;

 let attentionTarget='unknown';
 if(overlapState==='overlap-observed')attentionTarget='unresolved-overlap';
 else if(unresolvedGroupSpeaker)attentionTarget='unresolved-speaker';
 else if(address.addressedAgent&&address.addressedParticipantIds.length)attentionTarget='agent-and-participants';
 else if(address.addressedAgent)attentionTarget='agent';
 else if(address.addressedParticipantIds.length===1)attentionTarget='participant';
 else if(address.addressedParticipantIds.length>1)attentionTarget='participants';
 else if(conversationGroupSize>1)attentionTarget='group-unspecified';
 else if(speakerParticipantId)attentionTarget='speaker';

 return Object.freeze({
  multiConversationSchema:MULTI_CONVERSATION_SCHEMA,
  turnOwnership,
  conversationGroupSize,
  conversationParticipantIds:Object.freeze(participantIds),
  conversationVisitorIds:Object.freeze(visitorIds),
  conversationScopeId:conversationScopeId({
   speakerParticipantId,participantIds,visitorIds,groupSize:conversationGroupSize
  }),
  addressKind:address.kind,
  addressedAgent:address.addressedAgent,
  addressedParticipantId:address.addressedParticipantId,
  addressedParticipantIds:address.addressedParticipantIds,
  attentionTarget,
  overlapState
 });
}

export function multiParticipantReplyPolicy(context={}){
 if(context.overlapState==='overlap-observed')
  return Object.freeze({allow:false,reason:'abstain: overlap evidence leaves turn ownership unresolved'});
 if(context.turnOwnership==='ambiguous-speaker'&&Number(context.conversationGroupSize||1)>1)
  return Object.freeze({allow:false,reason:'abstain: ambiguous speaker in multi-party conversation'});
 if(context.addressedAgent)
  return Object.freeze({allow:true,reason:'engage: AGENT explicitly addressed'});
 if((context.addressedParticipantIds||[]).length)
  return Object.freeze({allow:false,reason:'abstain: turn explicitly addressed to participant'});
 if(Number(context.conversationGroupSize||1)>1)
  return Object.freeze({allow:false,reason:'abstain: multi-party turn not explicitly addressed to AGENT'});
 return Object.freeze({allow:true,reason:'engage: single-party conversation'});
}

export function groupConversationContext(currentTurn,turns=[],participants=[],limit=GROUP_CONTEXT_MAX_TURNS){
 if(!currentTurn)return Object.freeze([]);
 const people=new Map((Array.isArray(participants)?participants:[]).map(person=>[person.id,person]));
 const allowed=new Set(currentTurn.conversationParticipantIds||[]);
 const scope=short(currentTurn.conversationScopeId);
 const session=short(currentTurn.sessionId);
 const speakerVerified=Boolean(currentTurn.participantId&&currentTurn.attribution!=='unknown');
 const scopeHasIdentity=(currentTurn.conversationParticipantIds||[]).length>0||
  (currentTurn.conversationVisitorIds||[]).length>0;
 if(!speakerVerified&&!scopeHasIdentity)return Object.freeze([]);

 const selected=(Array.isArray(turns)?turns:[])
  .filter(turn=>turn&&turn.id!==currentTurn.id&&String(turn.transcript||'').trim())
  .filter(turn=>!session||short(turn.sessionId)===session)
  .filter(turn=>{
   const turnScope=short(turn.conversationScopeId);
   // Once 11D scope metadata exists, exact scope is the privacy boundary.
   if(scope&&turnScope)return turnScope===scope;
   // Never import unscoped legacy turns into a multi-person conversation.
   if(Number(currentTurn.conversationGroupSize||1)>1)return false;
   if(turn.participantId)return allowed.has(turn.participantId);
   return false;
  })
  .sort((a,b)=>(Date.parse(a.createdAt||'')||a.at||0)-(Date.parse(b.createdAt||'')||b.at||0))
  .slice(-Math.max(1,Math.min(20,Number(limit)||GROUP_CONTEXT_MAX_TURNS)))
  .map(turn=>{
   const verified=Boolean(turn.participantId&&turn.attribution!=='unknown');
   const person=verified?people.get(turn.participantId):null;
   return Object.freeze({
    role:'participant',
    text:String(turn.transcript).slice(0,600),
    at:Date.parse(turn.createdAt||'')||Number(turn.at||0)||0,
    participantId:verified?turn.participantId:null,
    speakerName:verified?(person?.nickname||person?.name||turn.participantName||'Participant'):'Unknown speaker',
    verified
   });
  });
 return Object.freeze(selected);
}

export function agentHistoryForScope(entries=[],turn={}){
 const scope=short(turn.conversationScopeId);
 const participantId=turn.participantId||null;
 const groupSize=Math.max(1,Number(turn.conversationGroupSize)||1);
 // Anonymous room scopes are not identities. Never reuse their saved AGENT history
 // across later unknown people who happen to have the same group size.
 if(!scope||scope.startsWith('scope:unknown-'))return Object.freeze([]);
 return Object.freeze((Array.isArray(entries)?entries:[])
  .filter(entry=>entry&&entry.role==='agent'&&String(entry.text||'').trim())
  .filter(entry=>{
   if(entry.scopeId===scope)return true;
   return groupSize===1&&participantId&&entry.participantId===participantId&&!entry.scopeId;
  })
  .map(entry=>Object.freeze({...entry})));
}

export function conversationContextLabel(context={}){
 if(context.overlapState==='overlap-observed')return 'OVERLAP EVIDENCE · TURN UNRESOLVED';
 if(context.turnOwnership==='ambiguous-speaker'&&Number(context.conversationGroupSize||1)>1)
  return 'AMBIGUOUS SPEAKER · GROUP';
 if(context.addressedAgent&&context.addressedParticipantIds?.length)return 'AGENT + PARTICIPANT ADDRESSED';
 if(context.addressedAgent)return 'AGENT ADDRESSED';
 if(context.addressedParticipantId)return 'PARTICIPANT ADDRESSED';
 if((context.addressedParticipantIds||[]).length>1)return 'MULTIPLE PARTICIPANTS ADDRESSED';
 if(Number(context.conversationGroupSize||1)>1)return 'GROUP · AGENT NOT ADDRESSED';
 return context.turnOwnership==='verified-speaker'?'VERIFIED SPEAKER · SOLO':'UNVERIFIED SPEAKER · SOLO';
}

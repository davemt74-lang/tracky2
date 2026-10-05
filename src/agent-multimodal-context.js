export const AGENT_MULTIMODAL_CONTEXT_SCHEMA=1;
export const MAX_AGENT_EVIDENCE_LABELS=18;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const short=(value,max=120)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value,160)))];

function canonicalParticipant(turn,participants=[]){
 const id=short(turn?.participantId,96);
 if(!id)return null;
 return (participants||[]).find(person=>person?.id===id)||null;
}

function identityAuthority(turn={}){
 const participantId=short(turn.participantId,96)||null;
 const attribution=short(turn.attribution||turn.speakerAssociation,64)||'unknown';
 const multimodalDecision=short(turn.multimodalDecision,64)||null;
 const multimodalState=short(turn.multimodalState,64)||null;
 const conflicts=uniq(turn.multimodalConflicts).slice(0,8);
 const revoked=multimodalState==='revoked'||
  conflicts.includes('revoked-identity-authority')||
  turn.multimodalAbstentionReason==='participant-voice-authority-revoked';
 const overlap=turn.diarizationOverlap===true||
  turn.multiPersonPartialAttribution===true||
  ['overlap','unresolved-overlap','partial'].includes(String(turn.diarizationState||''))||
  String(turn.multiPersonAttributionState||'').includes('overlap');
 const verified=Boolean(participantId&&attribution!=='unknown'&&!revoked&&
  (multimodalDecision?['verified','verified-with-conflict'].includes(multimodalDecision):true));
 const identityConflict=Boolean(
  multimodalDecision==='verified-with-conflict'||
  conflicts.length||
  String(multimodalState||'').includes('conflict')
 );
 let state='unknown';
 if(revoked)state='revoked';
 else if(overlap)state='overlap-ambiguous';
 else if(verified&&identityConflict)state='verified-conflict';
 else if(verified)state='verified';
 else if(turn.multimodalDecision==='abstain'||attribution==='unknown')state='unknown';
 return Object.freeze({
  participantId,attribution,multimodalDecision,multimodalState,
  verified,identityConflict,overlap,revoked,state,conflicts:Object.freeze(conflicts)
 });
}

function evidenceLabels(turn={}){
 const labels=[];
 if(turn.multimodalState)labels.push('identity:'+short(turn.multimodalState,64));
 if(turn.multimodalDecision)labels.push('identity-decision:'+short(turn.multimodalDecision,64));
 for(const value of turn.multimodalConflicts||[])labels.push('identity-conflict:'+short(value,96));
 if(turn.multimodalAbstentionReason)labels.push('identity-abstain:'+short(turn.multimodalAbstentionReason,96));
 if(turn.diarizationState)labels.push('diarization:'+short(turn.diarizationState,64));
 if(turn.diarizationOverlap===true)labels.push('diarization:overlap');
 if(turn.currentContinuousFusionState)labels.push('continuous:'+short(turn.currentContinuousFusionState,64));
 for(const value of turn.currentContinuousFusionConflicts||turn.continuousFusionConflicts||[])
  labels.push('continuous-conflict:'+short(value,96));
 if(turn.multiPersonAttributionState)labels.push('turn-attribution:'+short(turn.multiPersonAttributionState,64));
 if(turn.multiPersonPartialAttribution===true)labels.push('turn-attribution:partial');
 if(turn.spatialAudioSourceState)labels.push('spatial-audio:'+short(turn.spatialAudioSourceState,64));
 if(turn.spatialAudioDirection)labels.push('source-direction:'+short(turn.spatialAudioDirection,32));
 if(turn.spatialAudioConflict)labels.push('spatial-audio-conflict:'+short(turn.spatialAudioConflict,96));
 if(turn.roomPresenceState)labels.push('room-presence:'+short(turn.roomPresenceState,64));
 return Object.freeze(uniq(labels).slice(0,MAX_AGENT_EVIDENCE_LABELS));
}

function meetingContext(turn={},meeting=null){
 if(!turn.meetingId&&!meeting)return Object.freeze({
  active:false,turnInMeeting:false,meetingId:null,policy:null,status:null,title:null
 });
 const same=Boolean(meeting?.id&&turn.meetingId===meeting.id);
 return Object.freeze({
  active:meeting?.status==='active',
  turnInMeeting:Boolean(turn.meetingId),
  sameActiveMeeting:same&&meeting?.status==='active',
  meetingId:short(turn.meetingId||meeting?.id,96)||null,
  policy:short(meeting?.agentPolicy,48)||null,
  status:short(meeting?.status,32)||null,
  title:short(meeting?.title,120)||null
 });
}

export function buildAgentMultimodalContext({
 turn={},participants=[],meeting=null,memoryLines=[]
}={}){
 const authority=identityAuthority(turn);
 const person=canonicalParticipant(turn,participants);
 const participantExists=Boolean(person&&authority.participantId===person.id);
 const canName=Boolean(authority.verified&&!authority.identityConflict&&!authority.overlap&&participantExists);
 const memoryAllowed=Boolean(canName&&Array.isArray(memoryLines));
 const meetingInfo=meetingContext(turn,meeting);
 const memory=memoryAllowed
  ?Object.freeze(memoryLines.filter(value=>typeof value==='string'&&value.trim())
    .slice(0,8).map(value=>short(value,560)))
  :Object.freeze([]);
 const safeParticipantName=canName?short(person.nickname||person.name,64):'';
 const labels=evidenceLabels(turn);
 return Object.freeze({
  schema:AGENT_MULTIMODAL_CONTEXT_SCHEMA,
  canonicalTurnId:short(turn.id,96)||null,
  speakerState:authority.state,
  speakerParticipantId:authority.verified?authority.participantId:null,
  participantName:safeParticipantName||null,
  mayUseParticipantName:canName,
  mayUseParticipantMemory:memoryAllowed,
  memoryLines:memory,
  identityOverrideAllowed:false,
  identityConflict:authority.identityConflict,
  overlapAmbiguous:authority.overlap,
  revoked:authority.revoked,
  attribution:authority.attribution,
  multimodalDecision:authority.multimodalDecision,
  multimodalState:authority.multimodalState,
  conflicts:authority.conflicts,
  evidenceLabels:labels,
  meeting:meetingInfo,
  conversation:Object.freeze({
   groupSize:Math.max(1,Number(turn.conversationGroupSize)||1),
   attentionTarget:short(turn.attentionTarget,48)||'unknown',
   addressedAgent:turn.addressedAgent===true,
   scopeId:short(turn.conversationScopeId,240)||null
  }),
  spatial:Object.freeze({
   state:short(turn.spatialAudioSourceState,64)||null,
   direction:short(turn.spatialAudioDirection,32)||null,
   metric:turn.spatialAudioMetric===true,
   distanceM:finite(turn.spatialAudioDistanceM)?turn.spatialAudioDistanceM:null,
   bearingDeg:finite(turn.spatialAudioBearingDeg)?turn.spatialAudioBearingDeg:null,
   conflict:short(turn.spatialAudioConflict,96)||null
  })
 });
}

export function agentMultimodalPromptLines(context={}){
 const c=context||{};
 const lines=[
  'Canonical speaker state: '+short(c.speakerState||'unknown',64)+'.',
  'Identity override: forbidden. AGENT must not infer or replace participant identity.',
  c.mayUseParticipantName&&c.participantName
   ?'Canonical verified speaker name: '+short(c.participantName,64)+'.'
   :'Speaker name unavailable for this turn.',
  c.mayUseParticipantMemory
   ?'Participant-specific owner memory is authorized only for this canonical verified speaker.'
   :'Participant-specific memory is unavailable for this turn.'
 ];
 if(c.identityConflict)lines.push('Canonical identity evidence contains a conflict; describe uncertainty if relevant and do not resolve it yourself.');
 if(c.overlapAmbiguous)lines.push('Speaker overlap/partial attribution is unresolved; do not collapse multiple speakers into one identity.');
 if(c.revoked)lines.push('Identity authority is revoked; treat the speaker as unverified.');
 if(c.evidenceLabels?.length)
  lines.push('Evidence labels: '+c.evidenceLabels.slice(0,MAX_AGENT_EVIDENCE_LABELS).join(', ')+'.');
 if(c.spatial?.state)
  lines.push('Spatial/audio source context: '+short(c.spatial.state,64)+'; direction '+
   short(c.spatial.direction||'unavailable',32)+
   (c.spatial.metric&&finite(c.spatial.distanceM)?'; approximate calibrated distance '+
    Number(c.spatial.distanceM).toFixed(2)+'m':'')+
   '. Spatial/audio context is not identity proof.');
 if(c.meeting?.turnInMeeting)
  lines.push('Meeting context: '+short(c.meeting.status||'unknown',32)+
   '; AGENT policy '+short(c.meeting.policy||'unavailable',48)+
   '. Meeting policy remains authoritative for whether AGENT may reply.');
 return Object.freeze(lines.map(line=>short(line,700)).slice(0,12));
}

export function agentTurnProactivityEligibility(turn={}){
 const authority=identityAuthority(turn);
 if(!turn?.id)return Object.freeze({allow:false,reason:'missing canonical turn'});
 if(!authority.verified)return Object.freeze({allow:false,reason:'speaker not canonically verified'});
 if(authority.identityConflict)return Object.freeze({allow:false,reason:'identity evidence conflict'});
 if(authority.overlap)return Object.freeze({allow:false,reason:'speaker overlap or partial attribution unresolved'});
 if(authority.revoked)return Object.freeze({allow:false,reason:'identity authority revoked'});
 if(turn.meetingId)return Object.freeze({allow:false,reason:'meeting dialogue uses meeting follow-up policy'});
 return Object.freeze({allow:true,reason:'canonical verified speaker eligible for bounded follow-up'});
}

export function agentContextSummary(context={}){
 const c=context||{};
 return Object.freeze({
  speakerState:short(c.speakerState,64)||'unknown',
  participantId:c.mayUseParticipantName?short(c.speakerParticipantId,96)||null:null,
  participantName:c.mayUseParticipantName?short(c.participantName,64)||null:null,
  memoryAllowed:c.mayUseParticipantMemory===true,
  identityOverrideAllowed:false,
  meetingId:short(c.meeting?.meetingId,96)||null,
  evidenceLabels:Object.freeze(uniq(c.evidenceLabels).slice(0,MAX_AGENT_EVIDENCE_LABELS))
 });
}

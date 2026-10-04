import {clamp} from './participant-core.js';

export const MULTIMODAL_FUSION_VERSION=1;
export const MAX_MULTIMODAL_EVIDENCE=16;
export const MULTIMODAL_CHANNELS=Object.freeze([
 'voice','face','body','track','spatial','conversation','revocation'
]);

const AUTHORITY=Object.freeze({
 voice:'identity-primary',face:'identity-secondary',body:'continuity',
 track:'continuity',spatial:'context',conversation:'context',revocation:'revocation'
});
const DEFAULT_MAX_AGE=Object.freeze({
 voice:45000,face:8000,body:8000,track:8000,
 spatial:8000,conversation:30000,revocation:86400000
});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,n=96)=>String(v??'').trim().slice(0,n);
const unique=values=>[...new Set((values||[]).filter(Boolean))];

export function normalizeIdentityEvidence(input={},referenceAt=Date.now()){
 const channel=MULTIMODAL_CHANNELS.includes(input.channel)?input.channel:'conversation';
 const observedAt=finite(input.observedAt)?input.observedAt:referenceAt;
 const maxAgeMs=Math.max(0,finite(input.maxAgeMs)?input.maxAgeMs:DEFAULT_MAX_AGE[channel]);
 const current=input.current!==false;
 const participantId=short(input.participantId)||null;
 const authority=AUTHORITY[channel];
 return Object.freeze({
  channel,authority,participantId,
  confidence:clamp(Number(input.confidence||0)),
  observedAt,maxAgeMs,current,
  source:short(input.source||channel,80)||channel,
  trackId:short(input.trackId)||null,
  ambiguous:input.ambiguous===true,
  revoked:input.revoked===true||channel==='revocation',
  calibrated:input.calibrated===true
 });
}

export function identityEvidenceAge(evidence,referenceAt=Date.now()){
 const observed=Number(evidence?.observedAt);
 if(!Number.isFinite(observed))return Infinity;
 return Math.max(0,referenceAt-observed);
}

export function identityEvidenceFresh(evidence,referenceAt=Date.now()){
 if(!evidence||evidence.current===false)return false;
 const age=identityEvidenceAge(evidence,referenceAt);
 if(!Number.isFinite(age))return false;
 if(Number(evidence.observedAt)>referenceAt+1000)return false;
 return age<=Math.max(0,Number(evidence.maxAgeMs)||0);
}

export function deriveMultimodalEvidence({
 voiceMatch={},roomTracks=[],conversationParticipantIds=[],referenceAt=Date.now(),
 revokedParticipantIds=[],spatialCalibrated=false
}={}){
 const rows=[];
 const voiceConfidence=clamp(Number(voiceMatch.similarity||0));
 if(voiceMatch.matched&&voiceMatch.participant?.id){
  rows.push(normalizeIdentityEvidence({
   channel:'voice',participantId:voiceMatch.participant.id,confidence:voiceConfidence,
   observedAt:referenceAt,source:'voice-profile-match'
  },referenceAt));
 }else{
  rows.push(normalizeIdentityEvidence({
   channel:'voice',confidence:voiceConfidence,observedAt:referenceAt,
   ambiguous:voiceMatch.ambiguous===true,
   source:voiceMatch.ambiguous?'voice-profile-ambiguous':'voice-profile-unmatched'
  },referenceAt));
 }

 for(const track of Array.isArray(roomTracks)?roomTracks:[]){
  const participantId=short(track?.participantId)||null;
  const status=String(track?.status||'');
  const live=!['occluded','reacquiring'].includes(status);
  if(participantId&&status==='matched'){
   rows.push(normalizeIdentityEvidence({
    channel:'face',participantId,confidence:clamp(Number(track.similarity||0)),
    observedAt:referenceAt,current:true,source:'live-face-identity',trackId:track.id
   },referenceAt));
   rows.push(normalizeIdentityEvidence({
    channel:'body',participantId,confidence:clamp(Number(track.bodyScore||.8)),
    observedAt:referenceAt,current:true,source:'live-body-track',trackId:track.id
   },referenceAt));
  }else if(participantId&&status==='body-lock'){
   rows.push(normalizeIdentityEvidence({
    channel:'body',participantId,confidence:clamp(Number(track.bodyScore||.72)),
    observedAt:referenceAt,current:true,source:'live-body-continuity',trackId:track.id
   },referenceAt));
  }else if(participantId&&status==='occluded'){
   rows.push(normalizeIdentityEvidence({
    channel:'track',participantId,confidence:clamp(Number(track.similarity||0)),
    observedAt:referenceAt,current:false,source:'visual-memory-not-current',trackId:track.id
   },referenceAt));
  }
  if(participantId&&live){
   rows.push(normalizeIdentityEvidence({
    channel:'spatial',participantId,confidence:.25,observedAt:referenceAt,current:true,
    source:spatialCalibrated?'calibrated-spatial-context':'camera-relative-spatial-context',
    trackId:track.id,calibrated:spatialCalibrated
   },referenceAt));
  }
 }

 for(const participantId of unique(conversationParticipantIds).slice(0,12)){
  rows.push(normalizeIdentityEvidence({
   channel:'conversation',participantId,confidence:.2,observedAt:referenceAt,
   source:'conversation-scope-context'
  },referenceAt));
 }
 for(const participantId of unique(revokedParticipantIds).slice(0,12)){
  rows.unshift(normalizeIdentityEvidence({
   channel:'revocation',participantId,confidence:1,observedAt:referenceAt,
   source:'participant-voice-authority-revoked',revoked:true
  },referenceAt));
 }
 return Object.freeze(rows.slice(0,MAX_MULTIMODAL_EVIDENCE));
}

function confidenceBand(value){
 const n=clamp(Number(value||0));
 if(n>=.85)return 'high';
 if(n>=.70)return 'medium';
 if(n>0)return 'low';
 return 'none';
}
function safeEvidence(evidence,referenceAt){
 return Object.freeze({
  channel:evidence.channel,authority:evidence.authority,
  participantId:evidence.participantId,confidence:evidence.confidence,
  ageMs:identityEvidenceAge(evidence,referenceAt),
  fresh:identityEvidenceFresh(evidence,referenceAt),
  current:evidence.current,source:evidence.source,trackId:evidence.trackId,
  ambiguous:evidence.ambiguous,revoked:evidence.revoked,calibrated:evidence.calibrated
 });
}
function finish(input,evidence,referenceAt){
 const confidence=clamp(Number(input.confidence||0));
 const summaries=evidence.slice(0,MAX_MULTIMODAL_EVIDENCE)
  .map(row=>safeEvidence(row,referenceAt));
 return Object.freeze({
  schema:MULTIMODAL_FUSION_VERSION,
  participantId:input.participantId||null,trackId:input.trackId||null,
  state:input.state||'unknown-speaker',decision:input.decision||'abstain',
  confidence,confidenceBand:confidenceBand(confidence),
  authority:input.authority||null,
  abstentionReason:input.abstentionReason||null,
  conflicts:Object.freeze(unique(input.conflicts).slice(0,8)),
  provenance:Object.freeze(unique(input.provenance).slice(0,16)),
  contextParticipantIds:Object.freeze(unique(input.contextParticipantIds).slice(0,12)),
  evidence:Object.freeze(summaries)
 });
}

export function fuseMultimodalIdentity({evidence=[],referenceAt=Date.now()}={}){
 const rows=(Array.isArray(evidence)?evidence:[])
  .map(row=>normalizeIdentityEvidence(row,referenceAt))
  .slice(0,MAX_MULTIMODAL_EVIDENCE);
 const fresh=rows.filter(row=>identityEvidenceFresh(row,referenceAt));
 const provenance=unique(fresh.map(row=>row.channel+':'+row.source));
 const contextParticipantIds=unique(fresh
  .filter(row=>row.authority==='context'&&row.participantId)
  .map(row=>row.participantId));
 const revoked=new Set(fresh.filter(row=>row.revoked&&row.participantId)
  .map(row=>row.participantId));
 const voices=fresh.filter(row=>row.channel==='voice'&&row.participantId&&!row.ambiguous);
 const voiceIds=unique(voices.map(row=>row.participantId));
 const ambiguousVoice=fresh.some(row=>row.channel==='voice'&&row.ambiguous);
 const staleIdentity=rows.some(row=>
  ['voice','face','body','track'].includes(row.channel)&&!identityEvidenceFresh(row,referenceAt));

 if(voiceIds.length>1){
  return finish({
   state:'ambiguous-voice',decision:'abstain',abstentionReason:'voice-identity-conflict',
   conflicts:['multiple-voice-identities'],provenance,contextParticipantIds
  },rows,referenceAt);
 }
 const voice=voices.slice().sort((a,b)=>b.confidence-a.confidence)[0]||null;
 if(!voice){
  const visual=fresh.filter(row=>['face','body'].includes(row.channel)&&row.participantId);
  return finish({
   state:ambiguousVoice?'ambiguous-voice':visual.length?'unknown-visual-context':'unknown-speaker',
   decision:'abstain',
   abstentionReason:ambiguousVoice?'voice-ambiguous':
    staleIdentity?'identity-evidence-stale':visual.length?'no-voice-identity':'no-identity-authority',
   provenance,contextParticipantIds:unique([
    ...contextParticipantIds,...visual.map(row=>row.participantId)
   ])
  },rows,referenceAt);
 }

 const participantId=voice.participantId;
 if(revoked.has(participantId)){
  return finish({
   state:'revoked',decision:'abstain',abstentionReason:'participant-voice-authority-revoked',
   conflicts:['revoked-identity-authority'],provenance,contextParticipantIds
  },rows,referenceAt);
 }

 const visual=fresh.filter(row=>['face','body'].includes(row.channel)&&row.participantId);
 const matching=visual.filter(row=>row.participantId===participantId);
 const matchingTrackIds=unique(matching.map(row=>row.trackId));
 const otherIds=unique(visual.filter(row=>row.participantId!==participantId)
  .map(row=>row.participantId));
 const conflicts=[];
 if(matchingTrackIds.length>1)conflicts.push('duplicate-visual-identity');
 if(!matchingTrackIds.length&&otherIds.length)conflicts.push('visual-identity-conflict');

 if(conflicts.includes('visual-identity-conflict')){
  return finish({
   participantId,state:'verified-voice-visual-conflict',decision:'verified-with-conflict',
   confidence:voice.confidence*.75,authority:'voice-profile',
   conflicts,provenance,contextParticipantIds
  },rows,referenceAt);
 }

 if(matchingTrackIds.length===1){
  const trackId=matchingTrackIds[0];
  const face=matching.find(row=>row.channel==='face'&&row.trackId===trackId);
  const body=matching.find(row=>row.channel==='body'&&row.trackId===trackId);
  if(face){
   return finish({
    participantId,trackId,state:'verified-multimodal',decision:'verified',
    confidence:Math.min(voice.confidence,face.confidence||voice.confidence),
    authority:'voice-profile',conflicts,provenance,contextParticipantIds
   },rows,referenceAt);
  }
  if(body){
   return finish({
    participantId,trackId,state:'verified-voice+continuity',decision:'verified',
    confidence:voice.confidence*.97,authority:'voice-profile',
    conflicts,provenance,contextParticipantIds
   },rows,referenceAt);
  }
 }

 return finish({
  participantId,state:'verified-voice-only',decision:'verified',
  confidence:voice.confidence*.95,authority:'voice-profile',
  conflicts,provenance,contextParticipantIds
 },rows,referenceAt);
}

export function multimodalFusionTurnFields(fusion){
 const value=fusion||fuseMultimodalIdentity();
 return Object.freeze({
  multimodalFusionVersion:MULTIMODAL_FUSION_VERSION,
  multimodalState:value.state,
  multimodalDecision:value.decision,
  multimodalConfidence:value.confidence,
  multimodalConfidenceBand:value.confidenceBand,
  multimodalAuthority:value.authority,
  multimodalAbstentionReason:value.abstentionReason,
  multimodalConflicts:Array.from(value.conflicts||[]).slice(0,8),
  multimodalProvenance:Array.from(value.provenance||[]).slice(0,16),
  multimodalContextParticipantIds:Array.from(value.contextParticipantIds||[]).slice(0,12),
  multimodalEvidence:Array.from(value.evidence||[]).slice(0,MAX_MULTIMODAL_EVIDENCE)
   .map(row=>({
    channel:row.channel,authority:row.authority,participantId:row.participantId||null,
    confidence:row.confidence,ageMs:row.ageMs,fresh:row.fresh,current:row.current,
    source:row.source,trackId:row.trackId||null,ambiguous:row.ambiguous,
    revoked:row.revoked,calibrated:row.calibrated
   }))
 });
}

export class MultimodalFusionTracker{
 constructor(){this.last=null;}
 reset(){this.last=null;}
 preview(fusion,at=Date.now()){
  if(!fusion)return null;
  const previous=this.last;
  if(!previous){
   return Object.freeze({
    type:fusion.participantId?'fusion-verified':'fusion-abstained',
    fromState:null,toState:fusion.state,at
   });
  }
  let type=null;
  if(previous.participantId&&fusion.participantId&&previous.participantId!==fusion.participantId)
   type='fusion-handoff';
  else if(previous.participantId&&!fusion.participantId)
   type=fusion.state==='revoked'?'fusion-revoked':'fusion-abstained';
  else if(!previous.participantId&&fusion.participantId)type='fusion-verified';
  else if(previous.participantId===fusion.participantId&&previous.trackId&&fusion.trackId&&
    previous.trackId!==fusion.trackId)type='fusion-track-handoff';
  else if(previous.state!==fusion.state||previous.decision!==fusion.decision)
   type='fusion-evidence-transition';
  return type?Object.freeze({type,fromState:previous.state,toState:fusion.state,at}):null;
 }
 commit(fusion){this.last=fusion||null;return this.last;}
 observe(fusion,at=Date.now()){
  const transition=this.preview(fusion,at);this.commit(fusion);return transition;
 }
 snapshot(){return this.last;}
}

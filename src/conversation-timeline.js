// One chronological chat view, joining canonical local transcript turns with agent replies.
// Attribution follows the verified voice turn; spatial proximity never establishes a speaker.
export function conversationTimeline(turns=[],history=[],participants=[]){
 const people=new Map(participants.map(p=>[p.id,p]));
 const rows=turns.filter(t=>String(t.transcript||'').trim()).map((t,i)=>{
  const verified=Boolean(t.participantId)&&t.attribution!=='unknown';
  const person=verified?people.get(t.participantId):null;
  const time=Date.parse(t.createdAt||'');
  return {id:t.id||'turn-'+i,role:'participant',text:t.transcript,
   at:Number.isFinite(time)?time:(Number.isFinite(t.at)?t.at:0),
   name:verified?(person?.nickname||person?.name||t.participantName||'Participant'):'Unknown speaker',
   photo:verified?(person?.primaryPhoto||null):null,
   verified,source:'transcript',edited:Boolean(t.transcriptEditedAt),
   participantId:t.participantId||null,
   associationState:String(t.associationState||(
    verified?(t.attribution==='voice+body'?'verified-voice+body':'verified-voice-only'):'unknown-speaker')),
   associationProvenance:Array.isArray(t.associationProvenance)?t.associationProvenance.slice(0,8):[],
   associationTransition:t.associationTransition||null,
   multimodalFusionVersion:Number(t.multimodalFusionVersion)||null,
   multimodalState:t.multimodalState||null,
   multimodalDecision:t.multimodalDecision||null,
   multimodalConfidence:Number.isFinite(t.multimodalConfidence)?t.multimodalConfidence:null,
   multimodalConfidenceBand:t.multimodalConfidenceBand||null,
   multimodalAuthority:t.multimodalAuthority||null,
   multimodalAbstentionReason:t.multimodalAbstentionReason||null,
   multimodalConflicts:Array.isArray(t.multimodalConflicts)?t.multimodalConflicts.slice(0,8):[],
   multimodalProvenance:Array.isArray(t.multimodalProvenance)?t.multimodalProvenance.slice(0,16):[],
   multimodalTransition:t.multimodalTransition||null,
   diarizationSchema:Number(t.diarizationSchema)||null,
   diarizationState:t.diarizationState||null,
   diarizationSpeakerCount:Math.max(0,Number(t.diarizationSpeakerCount)||0),
   diarizationWindowCount:Math.max(0,Number(t.diarizationWindowCount)||0),
   diarizationUnknownWindows:Math.max(0,Number(t.diarizationUnknownWindows)||0),
   diarizationOverlapObserved:t.diarizationOverlapObserved===true,
   diarizationSafeWholeTurnAttribution:t.diarizationSafeWholeTurnAttribution===true,
   diarizationReason:t.diarizationReason||null,
   diarizationAttributionSuppressed:t.diarizationAttributionSuppressed===true,
   diarizationAttributionReason:t.diarizationAttributionReason||null,
   diarizationSpans:Array.isArray(t.diarizationSpans)?t.diarizationSpans.slice(0,12):[],
   continuousFusionSchema:Number(t.continuousFusionSchema)||null,
   continuousFusionState:t.continuousFusionState||null,
   continuousFusionParticipantIds:Array.isArray(t.continuousFusionParticipantIds)
    ?t.continuousFusionParticipantIds.slice(0,12):[],
   continuousFusionUnresolvedWindows:Math.max(0,Number(t.continuousFusionUnresolvedWindows)||0),
   continuousFusionConflicts:Array.isArray(t.continuousFusionConflicts)
    ?t.continuousFusionConflicts.slice(0,8):[],
   continuousFusionClusterLinks:Array.isArray(t.continuousFusionClusterLinks)
    ?t.continuousFusionClusterLinks.slice(0,8):[],
   continuousFusionWindowLinks:Array.isArray(t.continuousFusionWindowLinks)
    ?t.continuousFusionWindowLinks.slice(0,12):[],
   overlapSeparationSchema:Number(t.overlapSeparationSchema)||null,
   overlapSeparationState:t.overlapSeparationState||null,
   overlapSeparationQuality:Number.isFinite(t.overlapSeparationQuality)
    ?t.overlapSeparationQuality:null,
   overlapSeparationSourceCount:Math.max(0,Number(t.overlapSeparationSourceCount)||0),
   overlapSeparationParticipantIds:Array.isArray(t.overlapSeparationParticipantIds)
    ?t.overlapSeparationParticipantIds.slice(0,2):[],
   overlapSeparationSources:Array.isArray(t.overlapSeparationSources)
    ?t.overlapSeparationSources.slice(0,2):[],
   overlapSeparationReason:t.overlapSeparationReason||null,
   overlapSeparationCorrelation:Number.isFinite(t.overlapSeparationCorrelation)
    ?t.overlapSeparationCorrelation:null,
   overlapSeparationSideRatio:Number.isFinite(t.overlapSeparationSideRatio)
    ?t.overlapSeparationSideRatio:null,
   overlapSeparationProvenance:Array.isArray(t.overlapSeparationProvenance)
    ?t.overlapSeparationProvenance.slice(0,12):[],
   multiPersonAttributionSchema:Number(t.multiPersonAttributionSchema)||null,
   multiPersonAttributionState:t.multiPersonAttributionState||null,
   multiPersonTurnOwnership:t.multiPersonTurnOwnership||null,
   multiPersonParticipantIds:Array.isArray(t.multiPersonParticipantIds)
    ?t.multiPersonParticipantIds.slice(0,12):[],
   multiPersonCandidateParticipantIds:Array.isArray(t.multiPersonCandidateParticipantIds)
    ?t.multiPersonCandidateParticipantIds.slice(0,12):[],
   multiPersonOwnershipChangeCount:Math.max(0,Number(t.multiPersonOwnershipChangeCount)||0),
   multiPersonInterruptionCount:Math.max(0,Number(t.multiPersonInterruptionCount)||0),
   multiPersonUnresolvedCount:Math.max(0,Number(t.multiPersonUnresolvedCount)||0),
   multiPersonPartialAttribution:t.multiPersonPartialAttribution===true,
   multiPersonAttributionIntervals:Array.isArray(t.multiPersonAttributionIntervals)
    ?t.multiPersonAttributionIntervals.slice(0,16):[],
   multiPersonAttributionCorrections:Array.isArray(t.multiPersonAttributionCorrections)
    ?t.multiPersonAttributionCorrections.slice(-10):[],
   speakerAttributionEditedAt:t.speakerAttributionEditedAt||null,
   speakerAttributionEditedBy:t.speakerAttributionEditedBy||null,
   roomId:t.roomId||null,roomName:t.roomName||null,
   roomPresenceState:t.roomPresenceState||null,
   currentRoomId:t.currentRoomId||null,lastKnownRoomId:t.lastKnownRoomId||null,
   candidateRoomIds:Array.isArray(t.candidateRoomIds)?t.candidateRoomIds.slice(0,8):[],
   roomTransition:t.roomTransition||null,
   roomHandoffReason:t.roomHandoffReason||null,
   roomHandoffProvenance:Array.isArray(t.roomHandoffProvenance)
    ?t.roomHandoffProvenance.slice(0,12):[],
   spatialAudioSourceState:t.spatialAudioSourceState||null,
   spatialAudioDirection:t.spatialAudioDirection||null,
   spatialAudioDirectionConfidence:Number.isFinite(t.spatialAudioDirectionConfidence)
    ?t.spatialAudioDirectionConfidence:null,
   spatialAudioAudioDirection:t.spatialAudioAudioDirection||null,
   spatialAudioVisualDirection:t.spatialAudioVisualDirection||null,
   spatialAudioAgreement:t.spatialAudioAgreement===true?true:
    t.spatialAudioAgreement===false?false:null,
   spatialAudioMetric:t.spatialAudioMetric===true,
   spatialAudioDistanceM:Number.isFinite(t.spatialAudioDistanceM)?t.spatialAudioDistanceM:null,
   spatialAudioBearingDeg:Number.isFinite(t.spatialAudioBearingDeg)?t.spatialAudioBearingDeg:null,
   spatialAudioConflict:t.spatialAudioConflict||null,
   spatialAudioReason:t.spatialAudioReason||null,
   spatialAudioProvenance:Array.isArray(t.spatialAudioProvenance)
    ?t.spatialAudioProvenance.slice(0,12):[],
   transcriptState:String(t.transcriptState||(t.transcriptEditedAt?'corrected':'final')),
   transcriptSource:String(t.transcriptSource||'local-whisper'),
   transcriptModelId:t.transcriptModelId||null,
   transcriptModelRevision:t.transcriptModelRevision||null,
   transcriptConfidence:Number.isFinite(t.transcriptConfidence)?t.transcriptConfidence:null,
   transcriptCaptureDurationMs:Number.isFinite(t.transcriptCaptureDurationMs)?t.transcriptCaptureDurationMs:null,
   transcriptProcessingDurationMs:Number.isFinite(t.transcriptProcessingDurationMs)?t.transcriptProcessingDurationMs:null,
   conversationGroupSize:Math.max(1,Number(t.conversationGroupSize)||1),
   conversationParticipantIds:Array.isArray(t.conversationParticipantIds)?t.conversationParticipantIds.slice(0,12):[],
   conversationVisitorIds:Array.isArray(t.conversationVisitorIds)?t.conversationVisitorIds.slice(0,12):[],
   conversationScopeId:t.conversationScopeId||null,
   addressKind:t.addressKind||'unspecified',
   addressedAgent:t.addressedAgent===true,
   addressedParticipantId:t.addressedParticipantId||null,
   addressedParticipantIds:Array.isArray(t.addressedParticipantIds)?t.addressedParticipantIds.slice(0,12):[],
   attentionTarget:t.attentionTarget||'unknown',
   overlapState:t.overlapState||'not-observed',
   turnOwnership:t.turnOwnership|| (verified?'verified-speaker':'unverified-speaker')};
 });
 // Remove historical duplicated participant entries in AGENT localStorage.
 // Canonical IndexedDB transcript changes/deletion must never resurrect stale copies.
 const saved=history.filter(h=>['agent','system'].includes(h.role)&&String(h.text||'').trim())
  .map((h,i)=>{
   const person=h.participantId?people.get(h.participantId):null;
   const verified=h.role==='participant'&&Boolean(h.participantId&&person&&h.verified===true);
   return {id:h.id||'agent-'+i,role:h.role,text:h.text,at:Number.isFinite(h.at)?h.at:0,
    name:h.role==='agent'?'AGENT':h.role==='system'?'System':verified?(person.nickname||person.name):'Unknown speaker',
    photo:verified?person.primaryPhoto||null:null,verified,source:'agent-history'};
  });
 return [...rows,...saved].sort((a,b)=>a.at-b.at).slice(-120);
}

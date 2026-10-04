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

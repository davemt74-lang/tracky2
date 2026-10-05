export const MULTI_PERSON_ATTRIBUTION_SCHEMA=1;
export const MAX_ATTRIBUTION_INTERVALS=16;
export const MAX_ATTRIBUTION_CORRECTIONS=10;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const short=(value,max=96)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value)))];
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));

function overlaps(aStart,aEnd,bStart,bEnd){
 const as=Math.max(0,Number(aStart)||0),ae=Math.max(as,Number(aEnd)||as);
 const bs=Math.max(0,Number(bStart)||0),be=Math.max(bs,Number(bEnd)||bs);
 return Math.max(as,bs)<Math.min(ae,be)||as===bs||ae===be;
}

function normalizeLink(link={}){
 return Object.freeze({
  clusterId:short(link.clusterId)||null,
  participantId:short(link.participantId)||null,
  state:short(link.state,48)||'unknown',
  confidence:clamp(link.confidence),
  startOffsetMs:Math.max(0,Math.round(Number(link.startOffsetMs)||0)),
  endOffsetMs:Math.max(0,Math.round(Number(link.endOffsetMs)||0)),
  trackId:short(link.trackId)||null,
  provenance:Object.freeze(uniq(link.provenance).slice(0,10)),
  conflicts:Object.freeze(uniq(link.conflicts).slice(0,6))
 });
}

function normalizeInterval(interval={},index=0){
 const start=Math.max(0,Math.round(Number(interval.startOffsetMs)||0));
 const end=Math.max(start,Math.round(Number(interval.endOffsetMs)||start));
 return Object.freeze({
  id:short(interval.id)||'attr-'+String(index+1).padStart(2,'0'),
  startOffsetMs:start,endOffsetMs:end,
  state:short(interval.state,48)||'unknown',
  observedState:short(interval.observedState||interval.state,48)||'unknown',
  speakerClusterId:short(interval.speakerClusterId)||null,
  candidateClusterIds:Object.freeze(uniq(interval.candidateClusterIds).slice(0,4)),
  participantId:short(interval.participantId)||null,
  candidateParticipantIds:Object.freeze(uniq(interval.candidateParticipantIds).slice(0,6)),
  confidence:clamp(interval.confidence),
  authority:short(interval.authority,48)||'derived',
  provenance:Object.freeze(uniq(interval.provenance).slice(0,12)),
  conflicts:Object.freeze(uniq(interval.conflicts).slice(0,8)),
  reason:short(interval.reason,120)||null,
  correctedAt:finite(interval.correctedAt)?interval.correctedAt:null,
  correctedBy:short(interval.correctedBy,48)||null
 });
}

function summarize(intervals=[],corrections=[]){
 const participantIds=uniq(intervals.map(row=>row.participantId));
 const candidateParticipantIds=uniq(intervals.flatMap(row=>row.candidateParticipantIds||[]));
 let previous=null,ownershipChangeCount=0;
 for(const row of intervals){
  if(!row.participantId)continue;
  if(previous&&previous!==row.participantId)ownershipChangeCount++;
  previous=row.participantId;
 }
 const interruptionCount=intervals.filter(row=>
  row.observedState==='overlap'||row.state==='overlap'
 ).length;
 const unresolvedCount=intervals.filter(row=>
  !row.participantId||['overlap','unknown','candidate','conflict','partial'].includes(row.state)
 ).length;
 const partialAttribution=unresolvedCount>0;
 let state='unresolved';
 let turnOwnership='unresolved';
 if(interruptionCount){
  state=participantIds.length?'overlap-partial':'overlap-unresolved';
  turnOwnership='overlap';
 }else if(participantIds.length>1){
  state=partialAttribution?'multi-speaker-partial':'multi-speaker';
  turnOwnership='multi-speaker';
 }else if(participantIds.length===1){
  state=partialAttribution?'single-speaker-partial':'single-speaker';
  turnOwnership=partialAttribution?'partial':'single-speaker';
 }else if(candidateParticipantIds.length){
  state='candidate-only';turnOwnership='partial';
 }
 return Object.freeze({
  schema:MULTI_PERSON_ATTRIBUTION_SCHEMA,state,turnOwnership,
  participantIds:Object.freeze(participantIds),
  candidateParticipantIds:Object.freeze(candidateParticipantIds),
  ownershipChangeCount,interruptionCount,unresolvedCount,partialAttribution,
  intervals:Object.freeze(intervals.slice(0,MAX_ATTRIBUTION_INTERVALS)),
  corrections:Object.freeze(corrections.slice(-MAX_ATTRIBUTION_CORRECTIONS))
 });
}

export function buildTurnAttribution({
 diarizationSpans=[],continuousFusionWindowLinks=[],overlapSeparation=null,turnDurationMs=0
}={}){
 const links=Array.from(continuousFusionWindowLinks||[]).map(normalizeLink);
 const duration=Math.max(0,Math.round(Number(turnDurationMs)||0));
 let spans=Array.from(diarizationSpans||[]).slice(0,MAX_ATTRIBUTION_INTERVALS);
 if(!spans.length&&duration>0)
  spans=[{state:'unknown',startOffsetMs:0,endOffsetMs:duration,confidence:0}];

 const intervals=spans.map((span,index)=>{
  const start=Math.max(0,Math.round(Number(span.startOffsetMs)||0));
  const end=Math.max(start,Math.round(Number(span.endOffsetMs)||start));
  const clusterId=short(span.speakerClusterId)||null;
  const candidateClusterIds=uniq(span.candidateClusterIds);
  const clusterSet=new Set([clusterId,...candidateClusterIds].filter(Boolean));
  const related=links.filter(link=>
   overlaps(start,end,link.startOffsetMs,link.endOffsetMs)&&
   (!clusterSet.size||clusterSet.has(link.clusterId))
  );
  const separatedParticipantIds=span.state==='overlap-unresolved'
   ?uniq(overlapSeparation?.overlapSeparationParticipantIds).slice(0,2):[];
  const participantIds=uniq([
   ...related.map(link=>link.participantId),...separatedParticipantIds
  ]);
  const conflicts=uniq(related.flatMap(link=>link.conflicts||[]));
  const unresolvedLinks=related.filter(link=>!link.participantId||
   ['identity-conflict','visual-conflict','unknown','expired'].includes(link.state));
  const provenance=uniq([
   'diarization:'+String(span.state||'unknown'),
   ...related.flatMap(link=>link.provenance||[]),
   ...(separatedParticipantIds.length
    ?['overlap-separation:'+String(overlapSeparation?.overlapSeparationState||'candidate')]:[])
  ]);

  let state='unknown',participantId=null,authority='derived';
  if(span.state==='overlap-unresolved'){
   state='overlap';
  }else if(conflicts.length){
   state='conflict';
  }else if(participantIds.length>1){
   state='candidate';
  }else if(participantIds.length===1){
   participantId=participantIds[0];
   state=unresolvedLinks.length?'partial':'identified';
   authority='voice-anchored-continuous-fusion';
  }else if(clusterId){
   state='unknown';
  }

  return normalizeInterval({
   id:'attr-'+String(index+1).padStart(2,'0'),
   startOffsetMs:start,endOffsetMs:end,state,
   speakerClusterId:clusterId,candidateClusterIds,
   participantId,candidateParticipantIds:participantIds,
   confidence:span.confidence,authority,provenance,conflicts,
   reason:span.reason||(
    state==='overlap'?(separatedParticipantIds.length
     ?'overlap-separated-participant-candidates':'overlap-unresolved'):
    state==='candidate'?'multiple-participant-candidates':
    state==='conflict'?'continuous-fusion-conflict':
    state==='partial'?'partial-window-attribution':
    state==='unknown'?'speaker-cluster-unresolved':null)
  },index);
 });
 return summarize(intervals,[]);
}

export function applyAttributionCorrection(attribution,correction={}){
 if(!attribution||Number(attribution.schema)!==MULTI_PERSON_ATTRIBUTION_SCHEMA)
  throw new TypeError('Invalid canonical multi-person attribution.');
 const intervalId=short(correction.intervalId);
 const at=Number(correction.at??Date.now());
 if(!intervalId||!finite(at)||at<0)throw new TypeError('Invalid attribution correction.');
 const index=attribution.intervals.findIndex(row=>row.id===intervalId);
 if(index<0)throw new Error('Attribution interval no longer exists.');
 const participantId=short(correction.participantId)||null;
 const current=attribution.intervals[index];
 if(current.participantId===participantId&&current.authority==='local-owner-correction')
  throw new RangeError('Speaker attribution is unchanged.');
 const revision=Object.freeze({
  at,intervalId,
  previousParticipantId:current.participantId||null,
  participantId,
  previousState:current.state,
  source:'local-owner',
  note:short(correction.note,160)||null
 });
 const intervals=attribution.intervals.map((row,i)=>i===index?normalizeInterval({
  ...row,
  state:participantId?'owner-corrected':'owner-cleared',
  participantId,
  candidateParticipantIds:participantId?uniq([participantId,...row.candidateParticipantIds]):row.candidateParticipantIds,
  authority:'local-owner-correction',
  provenance:uniq([...row.provenance,'owner-attribution-correction']),
  reason:participantId?'owner-assigned-speaker':'owner-cleared-speaker',
  correctedAt:at,correctedBy:'local-owner'
 },i):normalizeInterval(row,i));
 const corrections=[...(attribution.corrections||[]),revision].slice(-MAX_ATTRIBUTION_CORRECTIONS);
 return summarize(intervals,corrections);
}

export function scrubAttributionParticipant(attribution,participantId){
 if(!attribution||Number(attribution.schema)!==MULTI_PERSON_ATTRIBUTION_SCHEMA)return attribution;
 const id=short(participantId);
 if(!id)return attribution;
 const intervals=attribution.intervals.map((row,index)=>{
  const wasParticipant=row.participantId===id;
  const candidates=(row.candidateParticipantIds||[]).filter(candidate=>candidate!==id);
  return normalizeInterval({
   ...row,
   participantId:wasParticipant?null:row.participantId,
   candidateParticipantIds:candidates,
   state:wasParticipant?(candidates.length?'candidate':'unknown'):row.state,
   authority:wasParticipant?'deleted-participant':row.authority,
   provenance:wasParticipant?uniq([...row.provenance,'participant-reference-deleted']):row.provenance,
   reason:wasParticipant?'participant-reference-deleted':row.reason
  },index);
 });
 const corrections=(attribution.corrections||[])
  .filter(row=>row.participantId!==id&&row.previousParticipantId!==id);
 return summarize(intervals,corrections);
}

export function multiPersonAttributionTurnFields(attribution){
 const value=attribution||summarize([],[]);
 return Object.freeze({
  multiPersonAttributionSchema:MULTI_PERSON_ATTRIBUTION_SCHEMA,
  multiPersonAttributionState:value.state,
  multiPersonTurnOwnership:value.turnOwnership,
  multiPersonParticipantIds:Array.from(value.participantIds||[]).slice(0,12),
  multiPersonCandidateParticipantIds:Array.from(value.candidateParticipantIds||[]).slice(0,12),
  multiPersonOwnershipChangeCount:Math.max(0,Number(value.ownershipChangeCount)||0),
  multiPersonInterruptionCount:Math.max(0,Number(value.interruptionCount)||0),
  multiPersonUnresolvedCount:Math.max(0,Number(value.unresolvedCount)||0),
  multiPersonPartialAttribution:value.partialAttribution===true,
  multiPersonAttributionIntervals:Array.from(value.intervals||[]).slice(0,MAX_ATTRIBUTION_INTERVALS)
   .map((row,index)=>({...normalizeInterval(row,index)})),
  multiPersonAttributionCorrections:Array.from(value.corrections||[]).slice(-MAX_ATTRIBUTION_CORRECTIONS)
   .map(row=>({
    at:Number(row.at)||0,intervalId:short(row.intervalId),
    previousParticipantId:short(row.previousParticipantId)||null,
    participantId:short(row.participantId)||null,
    previousState:short(row.previousState,48)||null,
    source:'local-owner',note:short(row.note,160)||null
   }))
 });
}

export function attributionFromTurn(turn={}){
 return summarize(
  Array.from(turn.multiPersonAttributionIntervals||[]).map(normalizeInterval),
  Array.from(turn.multiPersonAttributionCorrections||[])
 );
}

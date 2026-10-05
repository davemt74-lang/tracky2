import {clamp} from './participant-core.js';

export const CONTINUOUS_FUSION_SCHEMA=1;
export const VISUAL_HISTORY_MAX_ENTRIES=72;
export const VISUAL_HISTORY_MAX_AGE_MS=30000;
export const VISUAL_WINDOW_MAX_SKEW_MS=1400;
export const CLUSTER_IDENTITY_CARRY_MS=10000;
export const CLUSTER_HANDOFF_CONFIRMATIONS=2;
export const CLUSTER_CHALLENGER_MAX_GAP_MS=4500;
export const CONTINUOUS_FUSION_MAX_LINKS=8;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const uniq=values=>[...new Set((values||[]).filter(Boolean))];
const short=(value,max=96)=>String(value??'').trim().slice(0,max);

function safeTrack(track={}){
 return Object.freeze({
  id:short(track.id)||null,
  participantId:short(track.participantId)||null,
  participantName:short(track.participantName,120)||null,
  visitorId:short(track.visitorId)||null,
  status:short(track.status,48)||null,
  identitySource:short(track.identitySource,48)||null,
  similarity:clamp(Number(track.similarity||0)),
  bodyScore:clamp(Number(track.bodyScore||0)),
  cx:finite(track.cx)?track.cx:null,
  cy:finite(track.cy)?track.cy:null
 });
}

export function recordVisualHistory(history=[],entry={},{
 now=entry?.at??0,maxEntries=VISUAL_HISTORY_MAX_ENTRIES,
 maxAgeMs=VISUAL_HISTORY_MAX_AGE_MS
}={}){
 const at=finite(entry?.at)?entry.at:Number(now)||0;
 const cutoff=at-Math.max(1000,Number(maxAgeMs)||VISUAL_HISTORY_MAX_AGE_MS);
 const rows=(Array.isArray(history)?history:[])
  .filter(item=>finite(item?.at)&&item.at>=cutoff)
  .map(item=>Object.freeze({
   at:item.at,tracks:Object.freeze((item.tracks||[]).map(safeTrack))
  }));
 rows.push(Object.freeze({
  at,tracks:Object.freeze((entry?.tracks||[]).map(safeTrack))
 }));
 const limit=Math.max(4,Math.min(200,Math.floor(Number(maxEntries)||VISUAL_HISTORY_MAX_ENTRIES)));
 return Object.freeze(rows.slice(-limit));
}

export function visualSnapshotForWindow(history=[],{
 segmentStartedAt=0,startOffsetMs=0,endOffsetMs=0,
 maxSkewMs=VISUAL_WINDOW_MAX_SKEW_MS
}={}){
 const start=Number(segmentStartedAt||0)+Math.max(0,Number(startOffsetMs)||0);
 const end=Number(segmentStartedAt||0)+Math.max(Number(startOffsetMs)||0,Number(endOffsetMs)||0);
 const midpoint=(start+end)/2;
 const rows=(Array.isArray(history)?history:[]).filter(row=>finite(row?.at));
 if(!rows.length)return Object.freeze({
  state:'camera-unavailable',at:null,skewMs:null,tracks:Object.freeze([]),
  currentParticipantIds:Object.freeze([]),occludedParticipantIds:Object.freeze([])
 });
 const nearest=rows.slice().sort((a,b)=>Math.abs(a.at-midpoint)-Math.abs(b.at-midpoint))[0];
 const skew=Math.abs(nearest.at-midpoint);
 if(skew>Math.max(100,Number(maxSkewMs)||VISUAL_WINDOW_MAX_SKEW_MS))
  return Object.freeze({
   state:'camera-stale',at:nearest.at,skewMs:skew,tracks:Object.freeze([]),
   currentParticipantIds:Object.freeze([]),occludedParticipantIds:Object.freeze([])
  });
 const tracks=(nearest.tracks||[]).map(safeTrack);
 const current=uniq(tracks.filter(track=>
  track.participantId&&!['occluded','reacquiring'].includes(track.status)
 ).map(track=>track.participantId));
 const occluded=uniq(tracks.filter(track=>
  track.participantId&&track.status==='occluded'
 ).map(track=>track.participantId));
 return Object.freeze({
  state:'camera-current',at:nearest.at,skewMs:skew,
  tracks:Object.freeze(tracks),
  currentParticipantIds:Object.freeze(current),
  occludedParticipantIds:Object.freeze(occluded)
 });
}

function result(input={}){
 return Object.freeze({
  clusterId:short(input.clusterId)||null,
  windowId:short(input.windowId)||null,
  participantId:short(input.participantId)||null,
  state:input.state||'unknown',
  confidence:clamp(Number(input.confidence||0)),
  at:Number(input.at)||0,
  startOffsetMs:Math.max(0,Math.round(Number(input.startOffsetMs)||0)),
  endOffsetMs:Math.max(0,Math.round(Number(input.endOffsetMs)||0)),
  trackId:short(input.trackId)||null,
  provenance:Object.freeze(uniq(input.provenance).slice(0,12)),
  conflicts:Object.freeze(uniq(input.conflicts).slice(0,6)),
  reason:input.reason||null
 });
}

function copiedState(value){
 return {
  participantId:value.participantId,
  confidence:value.confidence,
  lastVerifiedAt:value.lastVerifiedAt,
  lastObservedAt:value.lastObservedAt,
  trackId:value.trackId||null,
  challengerId:value.challengerId||null,
  challengerCount:Number(value.challengerCount)||0,
  challengerAt:Number(value.challengerAt)||0,
  provenance:Array.from(value.provenance||[])
 };
}

export class ContinuousSpeakerFusionTracker{
 constructor({
  carryMs=CLUSTER_IDENTITY_CARRY_MS,
  handoffConfirmations=CLUSTER_HANDOFF_CONFIRMATIONS,
  challengerMaxGapMs=CLUSTER_CHALLENGER_MAX_GAP_MS,
  maxLinks=CONTINUOUS_FUSION_MAX_LINKS
 }={}){
  this.carryMs=Math.max(1000,Math.min(30000,Number(carryMs)||CLUSTER_IDENTITY_CARRY_MS));
  this.handoffConfirmations=Math.max(2,Math.min(4,Math.floor(Number(handoffConfirmations)||2)));
  this.challengerMaxGapMs=Math.max(1000,Math.min(15000,
   Number(challengerMaxGapMs)||CLUSTER_CHALLENGER_MAX_GAP_MS));
  this.maxLinks=Math.max(1,Math.min(16,Math.floor(Number(maxLinks)||CONTINUOUS_FUSION_MAX_LINKS)));
  this.reset();
 }
 reset(){this.links=new Map();return this.snapshot();}
 fork(){
  const copy=new ContinuousSpeakerFusionTracker({
   carryMs:this.carryMs,handoffConfirmations:this.handoffConfirmations,
   challengerMaxGapMs:this.challengerMaxGapMs,maxLinks:this.maxLinks
  });
  copy.links=new Map([...this.links].map(([key,value])=>[key,copiedState(value)]));
  return copy;
 }
 commitFrom(other){
  if(!(other instanceof ContinuousSpeakerFusionTracker))
   throw new TypeError('Continuous fusion commit requires a compatible tracker.');
  this.links=new Map([...other.links].map(([key,value])=>[key,copiedState(value)]));
  return this.snapshot();
 }
 reconcile(activeParticipantIds=[]){
  const active=new Set(activeParticipantIds||[]);
  for(const [clusterId,link] of this.links){
   if(link.participantId&&!active.has(link.participantId))this.links.delete(clusterId);
  }
  this.trim();
  return this.snapshot();
 }
 trim(){
  if(this.links.size<=this.maxLinks)return 0;
  const rows=[...this.links.entries()].sort((a,b)=>
   (Number(a[1]?.lastObservedAt)||0)-(Number(b[1]?.lastObservedAt)||0));
  const remove=rows.slice(0,this.links.size-this.maxLinks);
  for(const [clusterId] of remove)this.links.delete(clusterId);
  return remove.length;
 }
 snapshot(){
  return Object.freeze([...this.links].map(([clusterId,link])=>Object.freeze({
   clusterId,participantId:link.participantId,confidence:link.confidence,
   lastVerifiedAt:link.lastVerifiedAt,lastObservedAt:link.lastObservedAt,
   trackId:link.trackId||null
  })));
 }
 observe({
  clusterId,fusion=null,at=0,windowId=null,startOffsetMs=0,endOffsetMs=0,
  activeParticipantIds=[],currentVisualParticipantIds=[],occludedParticipantIds=[]
 }={}){
  const id=short(clusterId);
  if(!id)return result({windowId,at,startOffsetMs,endOffsetMs,state:'unknown',
   reason:'missing-speaker-cluster'});
  const active=new Set(activeParticipantIds||[]);
  const currentVisual=new Set(currentVisualParticipantIds||[]);
  const occluded=new Set(occludedParticipantIds||[]);
  let link=this.links.get(id)||null;
  if(link?.participantId&&!active.has(link.participantId)){
   this.links.delete(id);link=null;
  }
  const verified=Boolean(fusion?.participantId&&
   ['verified','verified-with-conflict'].includes(fusion.decision)&&
   active.has(fusion.participantId));
  if(verified){
   const participantId=fusion.participantId;
   const confidence=clamp(Number(fusion.confidence||0));
   const provenance=uniq(['voice-anchored-fusion',...(fusion.provenance||[])]);
   if(!link){
    link={
     participantId,confidence,lastVerifiedAt:at,lastObservedAt:at,
     trackId:fusion.trackId||null,challengerId:null,challengerCount:0,challengerAt:0,
     provenance
    };
    this.links.set(id,link);
    this.trim();
    return result({clusterId:id,windowId,participantId,state:'verified',
     confidence,at,startOffsetMs,endOffsetMs,trackId:fusion.trackId,
     provenance,conflicts:fusion.conflicts});
   }
   if(link.participantId===participantId){
    link.confidence=Math.max(confidence,link.confidence*.8);
    link.lastVerifiedAt=at;link.lastObservedAt=at;link.trackId=fusion.trackId||link.trackId;
    link.challengerId=null;link.challengerCount=0;link.challengerAt=0;link.provenance=provenance;
    return result({clusterId:id,windowId,participantId,state:
      fusion.decision==='verified-with-conflict'?'verified-visual-conflict':'verified',
     confidence:link.confidence,at,startOffsetMs,endOffsetMs,trackId:link.trackId,
     provenance,conflicts:fusion.conflicts});
   }
   const sameChallenge=link.challengerId===participantId&&at-link.challengerAt<=this.challengerMaxGapMs;
   link.challengerId=participantId;
   link.challengerCount=sameChallenge?link.challengerCount+1:1;
   link.challengerAt=at;link.lastObservedAt=at;
   if(link.challengerCount<this.handoffConfirmations){
    return result({clusterId:id,windowId,state:'identity-conflict',at,startOffsetMs,endOffsetMs,
     confidence:Math.min(link.confidence,confidence),
     provenance:['cluster-continuity-conflict',...provenance],
     conflicts:['verified-participant-challenger'],reason:'handoff-awaiting-confirmation'});
   }
   link={
    participantId,confidence,lastVerifiedAt:at,lastObservedAt:at,
    trackId:fusion.trackId||null,challengerId:null,challengerCount:0,challengerAt:0,
    provenance:['confirmed-cluster-handoff',...provenance]
   };
   this.links.set(id,link);
   this.trim();
   return result({clusterId:id,windowId,participantId,state:'handoff',
    confidence,at,startOffsetMs,endOffsetMs,trackId:link.trackId,
    provenance:link.provenance});
  }

  if(!link)return result({clusterId:id,windowId,state:'unknown',at,startOffsetMs,endOffsetMs,
   provenance:fusion?.provenance||[],conflicts:fusion?.conflicts||[],
   reason:fusion?.abstentionReason||'cluster-not-identity-linked'});

  const age=Math.max(0,at-link.lastVerifiedAt);
  if(age>this.carryMs){
   this.links.delete(id);
   return result({clusterId:id,windowId,state:'expired',at,startOffsetMs,endOffsetMs,
    reason:'cluster-identity-carry-expired'});
  }
  if(currentVisual.size&&!currentVisual.has(link.participantId)&&!occluded.has(link.participantId)){
   link.lastObservedAt=at;
   return result({clusterId:id,windowId,state:'visual-conflict',at,startOffsetMs,endOffsetMs,
    confidence:link.confidence*.65,provenance:['voice-cluster-continuity'],
    conflicts:['mapped-participant-not-currently-visible'],reason:'visual-continuity-conflict'});
  }
  const decay=Math.max(.55,1-age/this.carryMs);
  link.lastObservedAt=at;
  const visualSupport=currentVisual.has(link.participantId)?'current-visual-support':
   occluded.has(link.participantId)?'occluded-visual-continuity':'camera-unavailable-or-unmatched';
  return result({clusterId:id,windowId,participantId:link.participantId,
   state:'continuity',confidence:link.confidence*decay,at,startOffsetMs,endOffsetMs,
   trackId:link.trackId,provenance:['voice-cluster-continuity',visualSupport],
   reason:'bounded-cluster-identity-carry'});
 }
}

export function summarizeContinuousFusion(windowResults=[]){
 const rows=Array.from(windowResults||[]);
 const identified=rows.filter(row=>row?.participantId);
 const participantIds=uniq(identified.map(row=>row.participantId));
 const clusterIds=uniq(rows.map(row=>row?.clusterId));
 const conflicts=uniq(rows.flatMap(row=>row?.conflicts||[]));
 const unresolved=rows.filter(row=>!row?.participantId).length;
 const links=[];
 for(const clusterId of clusterIds){
  const candidates=rows.filter(row=>row?.clusterId===clusterId&&row.participantId);
  const latest=candidates[candidates.length-1]||null;
  if(latest)links.push(Object.freeze({
   clusterId,participantId:latest.participantId,state:latest.state,
   confidence:latest.confidence,trackId:latest.trackId||null,
   provenance:Object.freeze(Array.from(latest.provenance||[]).slice(0,10))
  }));
 }
 let state='unresolved';
 if(participantIds.length&&unresolved)state='partial';
 else if(participantIds.length>1)state='multi-identified';
 else if(participantIds.length===1)state='identified';
 return Object.freeze({
  schema:CONTINUOUS_FUSION_SCHEMA,state,
  participantIds:Object.freeze(participantIds),
  unresolvedWindows:unresolved,
  conflicts:Object.freeze(conflicts),
  clusterLinks:Object.freeze(links.slice(0,8)),
  windowLinks:Object.freeze(rows.slice(0,12).map(row=>result(row)))
 });
}

export function continuousFusionTurnFields(summary){
 const value=summary||summarizeContinuousFusion();
 return Object.freeze({
  continuousFusionSchema:CONTINUOUS_FUSION_SCHEMA,
  continuousFusionState:value.state,
  continuousFusionParticipantIds:Array.from(value.participantIds||[]).slice(0,12),
  continuousFusionUnresolvedWindows:Math.max(0,Number(value.unresolvedWindows)||0),
  continuousFusionConflicts:Array.from(value.conflicts||[]).slice(0,8),
  continuousFusionClusterLinks:Array.from(value.clusterLinks||[]).slice(0,8).map(link=>({
   clusterId:link.clusterId,participantId:link.participantId,state:link.state,
   confidence:link.confidence,trackId:link.trackId||null,
   provenance:Array.from(link.provenance||[]).slice(0,10)
  })),
  continuousFusionWindowLinks:Array.from(value.windowLinks||[]).slice(0,12).map(link=>({
   clusterId:link.clusterId,windowId:link.windowId,participantId:link.participantId,
   state:link.state,confidence:link.confidence,startOffsetMs:link.startOffsetMs,
   endOffsetMs:link.endOffsetMs,trackId:link.trackId||null,
   provenance:Array.from(link.provenance||[]).slice(0,10),
   conflicts:Array.from(link.conflicts||[]).slice(0,6),reason:link.reason||null
  }))
 });
}

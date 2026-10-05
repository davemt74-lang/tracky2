export const PARTICIPANT_CONTINUITY_SCHEMA=1;
export const PARTICIPANT_CONTINUITY_SHORT_CARRY_MS=12000;
export const PARTICIPANT_CONTINUITY_LONG_REENTRY_MS=120000;
export const PARTICIPANT_CONTINUITY_HISTORY_MAX=36;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const short=(v,max=96)=>String(v??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).map(v=>short(v)).filter(Boolean))];

function boxOf(track={}){
 const box=track.box||{};
 return Object.freeze({
  cx:clamp(finite(track.cx)?track.cx:box.cx),
  cy:clamp(finite(track.cy)?track.cy:box.cy),
  width:clamp(box.width),height:clamp(box.height)
 });
}
function boxSimilarity(a,b){
 if(!a||!b)return 0;
 const distance=Math.hypot((a.cx||0)-(b.cx||0),(a.cy||0)-(b.cy||0));
 const areaA=Math.max(.001,(a.width||0)*(a.height||0));
 const areaB=Math.max(.001,(b.width||0)*(b.height||0));
 const sizePenalty=Math.min(1,Math.abs(Math.log(areaA/areaB)));
 const aspectA=Math.max(.05,(a.width||0)/Math.max(.01,a.height||0));
 const aspectB=Math.max(.05,(b.width||0)/Math.max(.01,b.height||0));
 const aspectPenalty=Math.min(1,Math.abs(Math.log(aspectA/aspectB)));
 return clamp(1-distance/.55)*.58+clamp(1-sizePenalty)*.27+clamp(1-aspectPenalty)*.15;
}
function decay(ageMs,maxMs){
 if(!finite(ageMs)||ageMs<0||ageMs>maxMs)return 0;
 return clamp(1-ageMs/maxMs);
}
function authority(value){
 const v=short(value,48);
 return ['face','voice','owner-correction'].includes(v)?v:null;
}
function historyRow(input={}){
 return Object.freeze({
  at:Math.max(0,Number(input.at)||0),
  type:short(input.type,48)||'observation',
  trackId:short(input.trackId)||null,
  authority:authority(input.authority),
  confidence:clamp(input.confidence),
  state:short(input.state,64)||null
 });
}
function frozenRecord(record){
 return Object.freeze({
  participantId:record.participantId,
  lastTrackId:record.lastTrackId||null,
  lastVerifiedAt:Number(record.lastVerifiedAt)||0,
  lastSeenAt:Number(record.lastSeenAt)||0,
  lastAuthority:record.lastAuthority||null,
  confidence:clamp(record.confidence),
  lastBox:record.lastBox?Object.freeze({...record.lastBox}):null,
  history:Object.freeze((record.history||[]).map(historyRow).slice(-PARTICIPANT_CONTINUITY_HISTORY_MAX))
 });
}

export function continuityCandidateScore(record,track,now=0){
 const age=Math.max(0,Number(now)-Number(record?.lastSeenAt||0));
 if(!record?.participantId||age>PARTICIPANT_CONTINUITY_LONG_REENTRY_MS)return 0;
 const time=age<=PARTICIPANT_CONTINUITY_SHORT_CARRY_MS
  ?.68+.32*decay(age,PARTICIPANT_CONTINUITY_SHORT_CARRY_MS)
  :.18+.42*decay(age,PARTICIPANT_CONTINUITY_LONG_REENTRY_MS);
 const geometry=boxSimilarity(record.lastBox,boxOf(track));
 const confidence=clamp(record.confidence);
 return clamp(time*.45+geometry*.35+confidence*.20);
}

export function continuityCandidateState({record,track,now=0,currentParticipantIds=[]}={}){
 if(!record?.participantId)return Object.freeze({state:'none',score:0,reason:'no-prior-participant'});
 if(currentParticipantIds.includes(record.participantId))
  return Object.freeze({state:'blocked',score:0,reason:'participant-already-visible'});
 const age=Math.max(0,Number(now)-Number(record.lastSeenAt||0));
 if(age>PARTICIPANT_CONTINUITY_LONG_REENTRY_MS)
  return Object.freeze({state:'expired',score:0,reason:'reentry-window-expired'});
 const score=continuityCandidateScore(record,track,now);
 if(age<=PARTICIPANT_CONTINUITY_SHORT_CARRY_MS&&score>=.74)
  return Object.freeze({state:'short-carry',score,reason:'recent-verified-track-fragment'});
 if(score>=.54)
  return Object.freeze({state:'verification-required',score,reason:'long-gap-reentry-candidate'});
 return Object.freeze({state:'weak',score,reason:'continuity-evidence-too-weak'});
}

export function applyOwnerContinuityCorrection(tracks=[],{
 trackId,participantId=null,participantName=null,at=Date.now()
}={}){
 const id=short(trackId);
 if(!id)throw new TypeError('Track ID is required.');
 const participant=short(participantId)||null;
 const visibleClaim=participant&&(tracks||[]).some(track=>
  track.id!==id&&track.participantId===participant&&
  !['occluded','reacquiring'].includes(track.status));
 if(visibleClaim)throw new Error('Participant is already assigned to another visible track.');
 return Object.freeze((tracks||[]).map(track=>{
  if(track.id!==id)return Object.freeze({...track});
  if(!participant)return Object.freeze({
   ...track,
   blockedParticipantIds:uniq([...(track.blockedParticipantIds||[]),track.participantId]),
   participantId:null,participantName:null,similarity:0,
   status:track.face?'ready':'body-detected',
   identitySource:'owner-cleared',
   continuityState:'owner-cleared',continuityConfidence:0,
   continuityParticipantId:null,continuityReason:'owner-cleared-identity',
   continuityCorrectedAt:at
  });
  return Object.freeze({
   ...track,
   participantId:participant,
   participantName:short(participantName,160)||track.participantName||participant,
   status:track.face?'matched':'body-lock',
   identitySource:'owner-correction',
   continuityState:'owner-corrected',
   continuityConfidence:1,
   continuityParticipantId:participant,
   continuityReason:'owner-assigned-identity',
   continuityCorrectedAt:at
  });
 }));
}

export class ParticipantContinuityTracker{
 constructor({
  shortCarryMs=PARTICIPANT_CONTINUITY_SHORT_CARRY_MS,
  longReentryMs=PARTICIPANT_CONTINUITY_LONG_REENTRY_MS
 }={}){
  this.shortCarryMs=Math.max(3000,Number(shortCarryMs)||PARTICIPANT_CONTINUITY_SHORT_CARRY_MS);
  this.longReentryMs=Math.max(this.shortCarryMs,Number(longReentryMs)||PARTICIPANT_CONTINUITY_LONG_REENTRY_MS);
  this.records=new Map();
 }
 reconcile(participantIds=[]){
  const allowed=new Set((participantIds||[]).map(String));
  for(const id of this.records.keys())if(!allowed.has(id))this.records.delete(id);
  return this.snapshot();
 }
 observeVerified({
  participantId,trackId=null,participantName=null,authority:source='face',
  confidence=1,at=Date.now(),track=null
 }={}){
  const id=short(participantId);
  const auth=authority(source);
  if(!id||!auth)throw new TypeError('Verified continuity requires participant and face/voice/owner authority.');
  const previous=this.records.get(id)||{
   participantId:id,lastTrackId:null,lastVerifiedAt:0,lastSeenAt:0,
   lastAuthority:null,confidence:0,lastBox:null,history:[]
  };
  const next={
   ...previous,participantId:id,
   participantName:short(participantName,160)||previous.participantName||null,
   lastTrackId:short(trackId)||previous.lastTrackId||null,
   lastVerifiedAt:Math.max(Number(previous.lastVerifiedAt)||0,Number(at)||0),
   lastSeenAt:Math.max(Number(previous.lastSeenAt)||0,Number(at)||0),
   lastAuthority:auth,confidence:clamp(confidence),
   lastBox:track?boxOf(track):previous.lastBox,
   history:[...(previous.history||[]),historyRow({
    at,type:'verified',trackId,authority:auth,confidence,state:'verified'
   })].slice(-PARTICIPANT_CONTINUITY_HISTORY_MAX)
  };
  this.records.set(id,next);
  return frozenRecord(next);
 }
 observeVisibleTrack(track,at=Date.now()){
  const id=short(track?.participantId);
  if(!id)return null;
  const previous=this.records.get(id);
  if(!previous)return null;
  const next={
   ...previous,lastTrackId:short(track.id)||previous.lastTrackId,
   lastSeenAt:Math.max(Number(previous.lastSeenAt)||0,Number(at)||0),
   lastBox:boxOf(track),
   confidence:Math.max(.35,clamp(track.continuityConfidence??previous.confidence)),
   history:[...(previous.history||[]),historyRow({
    at,type:'visible',trackId:track.id,authority:previous.lastAuthority,
    confidence:track.continuityConfidence??previous.confidence,state:track.status
   })].slice(-PARTICIPANT_CONTINUITY_HISTORY_MAX)
  };
  this.records.set(id,next);
  return frozenRecord(next);
 }
 annotateTracks(tracks=[],now=Date.now()){
  const currentIds=(tracks||[]).filter(t=>t.participantId&&
   !['occluded','reacquiring'].includes(t.status)).map(t=>String(t.participantId));
  const records=[...this.records.values()];
  const candidates=[];
  const rows=(tracks||[]).map(track=>{
   if(track.participantId)return {...track,participantId:String(track.participantId)};
   const blocked=new Set((track.blockedParticipantIds||[]).map(String));
   const available=records.filter(record=>!blocked.has(record.participantId));
   const visibleBlocked=available.map(record=>({
    record,score:continuityCandidateScore(record,track,now)
   })).filter(row=>currentIds.includes(row.record.participantId)&&row.score>=.54)
    .sort((a,b)=>b.score-a.score);
   const scored=available.map(record=>({
    record,result:continuityCandidateState({record,track,now,currentParticipantIds:currentIds})
   })).filter(row=>row.result.score>0).sort((a,b)=>b.result.score-a.result.score);
   const best=scored[0]||null,second=scored[1]||null;
   if(!best){
    const blockedCandidate=visibleBlocked[0]||null;
    return {...track,participantId:null,participantName:track.participantName||null,
     continuityState:blockedCandidate?'blocked':'none',
     continuityConfidence:blockedCandidate?Number(blockedCandidate.score.toFixed(3)):0,
     continuityParticipantId:blockedCandidate?.record.participantId||null,
     continuityReason:blockedCandidate?'participant-already-visible':'no-continuity-candidate'};
   }
   const margin=best.result.score-(second?.result.score||0);
   const ambiguous=Boolean(second&&second.result.score>=.50&&margin<.12);
   const state=ambiguous?'ambiguous':best.result.state;
   const participantId=state==='short-carry'?best.record.participantId:null;
   candidates.push({trackId:track.id,participantId:best.record.participantId,state,
    score:best.result.score,margin});
   return {
    ...track,
    participantId:participantId||null,
    participantName:participantId?(best.record.participantName||track.participantName||null):track.participantName||null,
    status:participantId?'body-lock':track.status,
    identitySource:participantId?'continuity-short-carry':track.identitySource,
    continuityState:state,
    continuityConfidence:Number(best.result.score.toFixed(3)),
    continuityParticipantId:best.record.participantId,
    continuityReason:ambiguous?'multiple-continuity-candidates':best.result.reason,
    continuityCandidateMargin:Number(margin.toFixed(3))
   };
  });
  // Never let two fragmented tracks acquire the same participant in one pass.
  const byParticipant=new Map();
  for(const row of rows){
   if(!row.participantId||row.identitySource!=='continuity-short-carry')continue;
   const list=byParticipant.get(row.participantId)||[];list.push(row);byParticipant.set(row.participantId,list);
  }
  const conflicts=new Set();
  for(const list of byParticipant.values())if(list.length>1)
   for(const row of list)conflicts.add(row.id);
  const safeRows=rows.map(row=>conflicts.has(row.id)?{
   ...row,participantId:null,participantName:null,status:row.face?'ready':'body-detected',
   identitySource:row.face?'face':'body',continuityState:'ambiguous',
   continuityReason:'duplicate-fragment-candidates'
  }:row);
  return Object.freeze({
   tracks:Object.freeze(safeRows.map(row=>Object.freeze(row))),
   candidates:Object.freeze(candidates.map(row=>Object.freeze(row)))
  });
 }
 recoverByVoice(tracks=[],{
  participantId,trackId,participantName=null,confidence=0,at=Date.now()
 }={}){
  const id=short(participantId),tid=short(trackId);
  if(!id||!tid||clamp(confidence)<.58)return Object.freeze((tracks||[]).map(t=>Object.freeze({
   ...t,participantId:t.participantId||null,participantName:t.participantName||null
  })));
  const duplicate=(tracks||[]).some(t=>t.id!==tid&&t.participantId===id&&
   !['occluded','reacquiring'].includes(t.status));
  if(duplicate)return Object.freeze((tracks||[]).map(t=>Object.freeze({
   ...t,participantId:t.participantId||null,participantName:t.participantName||null
  })));
  const rows=(tracks||[]).map(track=>track.id===tid?{
   ...track,participantId:id,
   participantName:short(participantName,160)||track.participantName||id,
   status:track.face?'matched':'body-lock',
   identitySource:'voice-continuity',
   continuityState:'voice-recovered',
   continuityConfidence:clamp(confidence),
   continuityParticipantId:id,
   continuityReason:'verified-voice-body-association'
  }:{...track,participantId:track.participantId||null,
   participantName:track.participantName||null});
  const target=rows.find(track=>track.id===tid);
  if(target)this.observeVerified({
   participantId:id,trackId:tid,participantName:target.participantName,
   authority:'voice',confidence,at,track:target
  });
  return Object.freeze(rows.map(row=>Object.freeze(row)));
 }
 noteOwnerCorrection(tracks=[],options={}){
  const rows=applyOwnerContinuityCorrection(tracks,options);
  const target=rows.find(track=>track.id===String(options.trackId||''));
  if(target?.participantId)this.observeVerified({
   participantId:target.participantId,trackId:target.id,participantName:target.participantName,
   authority:'owner-correction',confidence:1,at:options.at??Date.now(),track:target
  });
  return rows;
 }
 snapshot(){
  return Object.freeze([...this.records.values()].map(frozenRecord));
 }
}

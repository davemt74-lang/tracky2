// V0.15.1B participant/presence transition and targeting guard.
// Metadata-only: no images, audio, transcripts, embeddings, or provider payloads.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const short=(v,n=120)=>String(v??'').trim().slice(0,n);
const live=t=>Boolean(t&&!['occluded','reacquiring'].includes(t.status));
const confidenceOf=t=>clamp(
 t?.identitySource==='owner-correction'?1:
 t?.identitySource==='voice-continuity'?t?.continuityConfidence:
 t?.status==='matched'?t?.similarity:
 t?.identitySource==='continuity-short-carry'?t?.continuityConfidence:
 t?.status==='body-lock'?Math.max(.45,Number(t?.continuityConfidence)||0):0
);
export const PARTICIPANT_TRANSITION_SCHEMA=1;
export const PARTICIPANT_DEPARTURE_GRACE_MS=10000;
export const PARTICIPANT_REENTRY_WINDOW_MS=5*60*1000;
export const PARTICIPANT_TRANSITION_HISTORY_MAX=96;

function confidenceBand(value){
 const v=clamp(value);
 return v>=.82?'high':v>=.58?'medium':v>0?'low':'unverified';
}
function row(input={}){
 return Object.freeze({
  schema:PARTICIPANT_TRANSITION_SCHEMA,
  at:Math.max(0,Number(input.at)||0),
  type:short(input.type,48)||'observed',
  participantId:short(input.participantId,96)||null,
  trackId:short(input.trackId,96)||null,
  from:short(input.from,48)||null,
  to:short(input.to,48)||null,
  confidence:clamp(input.confidence),
  confidenceBand:confidenceBand(input.confidence),
  reason:short(input.reason,120)||null
 });
}
function frozenState(s){
 return Object.freeze({
  participantId:s.participantId,
  state:s.state,
  trackId:s.trackId||null,
  firstSeenAt:s.firstSeenAt||0,
  lastSeenAt:s.lastSeenAt||0,
  departedAt:s.departedAt||null,
  reentryCount:s.reentryCount||0,
  confidence:clamp(s.confidence),
  confidenceBand:confidenceBand(s.confidence),
  identitySource:s.identitySource||null
 });
}

export function participantTargetEligibility({
 participantId,tracks=[],association=null,now=Date.now(),maxVisualAgeMs=3000
}={}){
 const id=short(participantId,96);
 if(!id)return Object.freeze({allowed:false,reason:'no-participant',participantId:null,trackId:null});
 const candidates=(tracks||[]).filter(t=>String(t?.participantId||'')===id);
 const current=candidates.filter(live).sort((a,b)=>confidenceOf(b)-confidenceOf(a));
 if(current.length>1)return Object.freeze({
  allowed:false,reason:'duplicate-current-identity',participantId:id,trackId:null
 });
 const visual=current[0]||null;
 const lastSeen=Math.max(Number(visual?.lastBodySeenAt||0),Number(visual?.lastFaceSeenAt||0),Number(visual?.lastSeenAt||0));
 const visualFresh=Boolean(visual)&&(!lastSeen||Math.max(0,now-lastSeen)<=Math.max(500,maxVisualAgeMs));
 const voiceVerified=association?.participantId===id&&
  String(association?.state||'').startsWith('verified-voice')&&
  Number(association?.associationConfidence||association?.voiceConfidence||0)>=.58;
 if(voiceVerified)return Object.freeze({
  allowed:true,reason:visualFresh?'verified-voice+current-presence':'verified-voice-current-turn',
  participantId:id,trackId:visualFresh?visual.id:null
 });
 if(!visual)return Object.freeze({allowed:false,reason:'participant-not-current',participantId:id,trackId:null});
 if(!visualFresh)return Object.freeze({allowed:false,reason:'participant-presence-stale',participantId:id,trackId:null});
 if(confidenceOf(visual)<.58)return Object.freeze({allowed:false,reason:'identity-confidence-too-low',participantId:id,trackId:visual.id});
 return Object.freeze({allowed:true,reason:'current-verified-presence',participantId:id,trackId:visual.id});
}

export class ParticipantPresenceTransitionTracker{
 constructor({
  departureGraceMs=PARTICIPANT_DEPARTURE_GRACE_MS,
  reentryWindowMs=PARTICIPANT_REENTRY_WINDOW_MS,
  historyMax=PARTICIPANT_TRANSITION_HISTORY_MAX
 }={}){
  this.departureGraceMs=Math.max(1000,Number(departureGraceMs)||PARTICIPANT_DEPARTURE_GRACE_MS);
  this.reentryWindowMs=Math.max(this.departureGraceMs,Number(reentryWindowMs)||PARTICIPANT_REENTRY_WINDOW_MS);
  this.historyMax=Math.max(12,Math.min(240,Math.floor(Number(historyMax)||PARTICIPANT_TRANSITION_HISTORY_MAX)));
  this.states=new Map();this.history=[];this.available=true;
 }
 reset(){this.states.clear();this.history=[];this.available=true;}
 reconcile(participantIds=[]){
  const allowed=new Set((participantIds||[]).map(String));
  for(const id of this.states.keys())if(!allowed.has(id))this.states.delete(id);
  this.history=this.history.filter(e=>!e.participantId||allowed.has(e.participantId)).slice(-this.historyMax);
 }
 unavailable(){this.available=false;}
 observe(tracks=[],at=Date.now()){
  this.available=true;
  const events=[];
  const current=new Map();
  for(const track of tracks||[]){
   const id=short(track?.participantId,96);
   if(!id||!live(track))continue;
   const prior=current.get(id);
   if(!prior||confidenceOf(track)>confidenceOf(prior))current.set(id,track);
  }
  for(const [id,track] of current){
   const confidence=confidenceOf(track),band=confidenceBand(confidence);
   const previous=this.states.get(id);
   if(!previous){
    const next={participantId:id,state:'present',trackId:track.id||null,firstSeenAt:at,lastSeenAt:at,
     departedAt:null,reentryCount:0,confidence,identitySource:track.identitySource||null};
    this.states.set(id,next);
    events.push(row({at,type:'arrival',participantId:id,trackId:track.id,from:'absent',to:'present',
     confidence,reason:'current-participant-observed'}));
    continue;
   }
   const oldBand=confidenceBand(previous.confidence);
   const reentry=previous.state==='departed'&&previous.departedAt!==null&&at-previous.departedAt<=this.reentryWindowMs;
   const trackChanged=previous.trackId&&track.id&&previous.trackId!==track.id;
   const next={...previous,state:'present',trackId:track.id||previous.trackId,lastSeenAt:at,departedAt:null,
    reentryCount:(previous.reentryCount||0)+(reentry?1:0),confidence,identitySource:track.identitySource||previous.identitySource};
   this.states.set(id,next);
   if(reentry)events.push(row({at,type:'reentry',participantId:id,trackId:track.id,from:'departed',to:'present',
    confidence,reason:'verified-participant-returned'}));
   else if(trackChanged)events.push(row({at,type:'track-handoff',participantId:id,trackId:track.id,from:previous.trackId,to:track.id,
    confidence,reason:'participant-track-changed'}));
   if(oldBand!==band)events.push(row({at,type:'confidence-change',participantId:id,trackId:track.id,from:oldBand,to:band,
    confidence,reason:'identity-confidence-band-changed'}));
  }
  for(const [id,previous] of this.states){
   if(current.has(id)||previous.state==='departed')continue;
   if(at-previous.lastSeenAt<this.departureGraceMs)continue;
   const next={...previous,state:'departed',departedAt:at};
   this.states.set(id,next);
   events.push(row({at,type:'departure',participantId:id,trackId:previous.trackId,from:'present',to:'departed',
    confidence:previous.confidence,reason:'absence-grace-expired'}));
  }
  this.history=[...this.history,...events].slice(-this.historyMax);
  return Object.freeze(events);
 }
 snapshot(){
  return Object.freeze({
   schema:PARTICIPANT_TRANSITION_SCHEMA,
   available:this.available,
   participants:Object.freeze([...this.states.values()].map(frozenState)),
   history:Object.freeze([...this.history])
  });
 }
}

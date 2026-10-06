// V0.14.9B background-media continuity and interruption intelligence.
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const clean=(v,n=160)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const ROOM_MEDIA_CONTINUITY_SCHEMA=1;
export const ROOM_MEDIA_RESUME_GRACE_MS=90000;
export const ROOM_MEDIA_INTERSTITIAL_GRACE_MS=45000;
export const ROOM_MEDIA_FOREGROUND_GRACE_MS=120000;

function continuityId(kind,at){
 return 'room-media-cont-'+clean(kind,40)+'-'+Math.max(0,Math.floor(Number(at)||Date.now())).toString(36);
}
function identitySignature(state={}){
 const identity=state.identity||{};
 if(state.identityKey)return clean(state.identityKey,360);
 if(state.kind==='music'&&identity.artist&&identity.title)
  return 'music:'+clean(identity.artist,120).toLowerCase()+'::'+clean(identity.title,120).toLowerCase();
 const series=clean(identity.series,120).toLowerCase();
 const title=clean(identity.title,120).toLowerCase();
 if(series||title)return clean(state.kind,40)+':'+series+'::'+title;
 return '';
}
function publicState(state){
 if(!state)return null;
 return Object.freeze({
  schema:ROOM_MEDIA_CONTINUITY_SCHEMA,
  continuityId:state.continuityId,
  status:state.status,
  kind:state.kind,
  startedAt:state.startedAt,
  lastAt:state.lastAt,
  suspendedAt:state.suspendedAt??null,
  resumeDeadline:state.resumeDeadline??null,
  lowLevelSessionId:state.lowLevelSessionId||null,
  identityKey:state.identityKey||'',
  identity:state.identity?Object.freeze({...state.identity}):null,
  interruption:state.interruption||null,
  interruptions:state.interruptions||0,
  resumes:state.resumes||0,
  contentChanges:state.contentChanges||0,
  participantId:null,
  rawAudioStored:false
 });
}

export function mediaContinuityCompatibility(previous={},next={}){
 if(!previous?.kind||!next?.kind)return Object.freeze({compatible:false,reason:'missing-kind'});
 if(previous.kind!==next.kind)return Object.freeze({compatible:false,reason:'kind-changed'});
 const prevKey=identitySignature(previous),nextKey=identitySignature(next);
 if(!prevKey||!nextKey)return Object.freeze({compatible:true,reason:'same-kind-identity-unknown'});
 if(prevKey===nextKey)return Object.freeze({compatible:true,reason:'same-identity'});
 const prevSeries=clean(previous.identity?.series,120).toLowerCase();
 const nextSeries=clean(next.identity?.series,120).toLowerCase();
 if(prevSeries&&nextSeries&&prevSeries===nextSeries)
  return Object.freeze({compatible:true,reason:'same-series-content-change'});
 if(previous.kind==='music')
  return Object.freeze({compatible:true,reason:'same-music-session-track-change'});
 return Object.freeze({compatible:false,reason:'identity-changed'});
}

export class RoomMediaContinuityTracker{
 constructor({
  resumeGraceMs=ROOM_MEDIA_RESUME_GRACE_MS,
  interstitialGraceMs=ROOM_MEDIA_INTERSTITIAL_GRACE_MS,
  foregroundGraceMs=ROOM_MEDIA_FOREGROUND_GRACE_MS
 }={}){
  this.resumeGraceMs=Math.max(15000,Number(resumeGraceMs)||ROOM_MEDIA_RESUME_GRACE_MS);
  this.interstitialGraceMs=Math.max(10000,Number(interstitialGraceMs)||ROOM_MEDIA_INTERSTITIAL_GRACE_MS);
  this.foregroundGraceMs=Math.max(30000,Number(foregroundGraceMs)||ROOM_MEDIA_FOREGROUND_GRACE_MS);
  this.reset();
 }
 reset(){
  this.active=null;this.suspended=null;this.lastTransition='idle';this.lastReason='reset';
 }
 snapshot(){
  return Object.freeze({
   active:publicState(this.active),
   suspended:publicState(this.suspended),
   transition:this.lastTransition,
   reason:this.lastReason
  });
 }
 suspend(reason='background-stop',at=Date.now(),graceMs=this.resumeGraceMs){
  if(!this.active)return Object.freeze({emit:false,transition:'no-active-session',state:this.snapshot()});
  const suspended={
   ...this.active,status:'suspended',lastAt:at,suspendedAt:at,
   resumeDeadline:at+Math.max(10000,Number(graceMs)||this.resumeGraceMs),
   interruption:clean(reason,80)||'background-stop',
   interruptions:(this.active.interruptions||0)+1
  };
  this.suspended=suspended;this.active=null;
  this.lastTransition='suspended';this.lastReason=suspended.interruption;
  return Object.freeze({emit:true,transition:'suspended',state:this.snapshot(),continuity:publicState(suspended)});
 }
 observeForeground(policy={},at=Date.now()){
  const mode=clean(policy.mode,80);
  if(mode==='foreground-conversation-over-background'||mode==='mixed-uncertain'){
   if(this.active){
    this.active={...this.active,lastAt:at,interruption:mode,
     interruptions:(this.active.interruptions||0)+1};
    this.lastTransition='interrupted';this.lastReason=mode;
    return Object.freeze({emit:true,transition:'interrupted',state:this.snapshot(),continuity:publicState(this.active)});
   }
   if(this.suspended&&at<=this.suspended.resumeDeadline){
    this.suspended={...this.suspended,lastAt:at,interruption:mode,
     resumeDeadline:Math.max(this.suspended.resumeDeadline,at+this.foregroundGraceMs)};
    this.lastTransition='interruption-continued';this.lastReason=mode;
    return Object.freeze({emit:false,transition:'interruption-continued',state:this.snapshot(),continuity:publicState(this.suspended)});
   }
  }
  return Object.freeze({emit:false,transition:'ignored',state:this.snapshot()});
 }
 observeBackground(result={},at=Date.now()){
  const state=result.state||{};
  const kind=clean(state.kind,40);
  if(!kind||kind==='live-or-unknown-speech')
   return Object.freeze({emit:false,transition:'ignored',state:this.snapshot()});

  if(result.transition==='stopped'){
   const grace=result.reason==='stale-timeout'?this.resumeGraceMs:this.interstitialGraceMs;
   return this.suspend(result.reason||'background-stop',at,grace);
  }

  if(!['started','continued','source-changed','identity-confirmed','identity-changed','identity-reconfirmed'].includes(result.transition))
   return Object.freeze({emit:false,transition:'ignored',state:this.snapshot()});

  const next={
   kind,lowLevelSessionId:state.sessionId||null,identityKey:state.identityKey||'',
   identity:state.identity||null,lastAt:at
  };

  if(this.active){
   const compatibility=mediaContinuityCompatibility(this.active,next);
   if(compatibility.compatible){
    const priorKey=this.active.identityKey||'';
    const nextKey=next.identityKey||priorKey;
    const contentChanged=Boolean(priorKey&&nextKey&&priorKey!==nextKey);
    this.active={
     ...this.active,status:'active',lastAt:at,lowLevelSessionId:next.lowLevelSessionId||this.active.lowLevelSessionId,
     identityKey:nextKey,identity:next.identity||this.active.identity,
     interruption:null,contentChanges:(this.active.contentChanges||0)+(contentChanged?1:0)
    };
    this.lastTransition=contentChanged?'content-changed':'continued';
    this.lastReason=compatibility.reason;
    return Object.freeze({
     emit:contentChanged,transition:this.lastTransition,state:this.snapshot(),
     continuity:publicState(this.active),reason:compatibility.reason
    });
   }
   const ended=publicState({...this.active,status:'ended',lastAt:at});
   this.active=null;
   const created=this.start(next,at);
   return Object.freeze({
    ...created,transition:'source-changed',previous:ended,
    reason:compatibility.reason
   });
  }

  if(this.suspended){
   if(at>this.suspended.resumeDeadline){
    this.suspended=null;
   }else{
    const compatibility=mediaContinuityCompatibility(this.suspended,next);
    if(compatibility.compatible){
     const prior=this.suspended;
     this.active={
      ...prior,status:'active',lastAt:at,suspendedAt:null,resumeDeadline:null,
      lowLevelSessionId:next.lowLevelSessionId||prior.lowLevelSessionId,
      identityKey:next.identityKey||prior.identityKey,
      identity:next.identity||prior.identity,
      interruption:null,resumes:(prior.resumes||0)+1
     };
     this.suspended=null;
     this.lastTransition='resumed';this.lastReason=compatibility.reason;
     return Object.freeze({
      emit:true,transition:'resumed',state:this.snapshot(),
      continuity:publicState(this.active),reason:compatibility.reason
     });
    }
    this.suspended=null;
   }
  }

  return this.start(next,at);
 }
 start(next,at){
  this.active={
   continuityId:continuityId(next.kind,at),status:'active',kind:next.kind,
   startedAt:at,lastAt:at,suspendedAt:null,resumeDeadline:null,
   lowLevelSessionId:next.lowLevelSessionId||null,
   identityKey:next.identityKey||'',identity:next.identity||null,
   interruption:null,interruptions:0,resumes:0,contentChanges:0
  };
  this.lastTransition='started';this.lastReason='new-continuity-session';
  return Object.freeze({
   emit:true,transition:'started',state:this.snapshot(),
   continuity:publicState(this.active),reason:this.lastReason
  });
 }
 expire(now=Date.now()){
  if(!this.suspended||!finite(this.suspended.resumeDeadline)||now<=this.suspended.resumeDeadline)return null;
  const ended=publicState({...this.suspended,status:'ended',lastAt:now});
  this.suspended=null;this.lastTransition='ended';this.lastReason='resume-grace-expired';
  return Object.freeze({emit:true,transition:'ended',state:this.snapshot(),continuity:ended,reason:this.lastReason});
 }
}

export function roomMediaContinuityMessage(result={}){
 const row=result.continuity;
 if(!row)return '';
 const label=row.kind==='music'?'Music':
  row.kind==='television'?'TV / video':
  row.kind==='radio'?'Radio / podcast':
  row.kind==='video-game'?'Video game audio':'Recorded media';
 if(result.transition==='started')return label+' continuity started';
 if(result.transition==='suspended')return label+' paused or temporarily interrupted';
 if(result.transition==='resumed')return label+' resumed · same background session';
 if(result.transition==='interrupted')return label+' continues behind foreground conversation';
 if(result.transition==='content-changed')return label+' content changed within the same session';
 if(result.transition==='source-changed')return 'Background source changed · new continuity session';
 if(result.transition==='ended')return label+' continuity ended';
 return '';
}

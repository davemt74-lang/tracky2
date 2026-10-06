const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=(v,n=160)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const ROOM_AUDIO_INTELLIGENCE_SCHEMA=1;
export const ROOM_AUDIO_SESSION_STALE_MS=45000;
export const ROOM_AUDIO_REPEAT_MS=60000;

const KIND_BY_ENV=Object.freeze({
 'music:music':'music',
 'music:instrumental-music':'music',
 'media-playback:television':'television',
 'media-playback:radio':'radio',
 'media-playback:media-playback':'recorded-media',
 'media-playback:video-game':'video-game',
 'room-voice-activity:speech-like-activity':'live-or-unknown-speech'
});

function sessionId(kind,at){
 return 'room-audio-'+clean(kind,40)+'-'+Math.max(0,Math.floor(Number(at)||Date.now())).toString(36);
}
export function roomAudioKindFromEnvironmental(input={}){
 const key=clean(input.category,64)+':'+clean(input.subtype,64);
 return KIND_BY_ENV[key]||(
  input.category==='music'?'music':
  input.category==='media-playback'?'recorded-media':
  input.category==='room-voice-activity'?'live-or-unknown-speech':
  null
 );
}
export function roomAudioIdentityKey(identity={}){
 const kind=clean(identity.kind,40);
 if(kind==='music'){
  const artist=clean(identity.artist,120).toLowerCase();
  const title=clean(identity.title,120).toLowerCase();
  return artist&&title?'music:'+artist+'::'+title:'';
 }
 const series=clean(identity.series,120).toLowerCase();
 const title=clean(identity.title,120).toLowerCase();
 const season=Number.isInteger(identity.season)?identity.season:'';
 const episode=Number.isInteger(identity.episode)?identity.episode:'';
 return kind&&(series||title)
  ?kind+':'+series+'::'+title+'::'+season+'::'+episode:'';
}
function freezeState(state){
 return Object.freeze({
  schema:ROOM_AUDIO_INTELLIGENCE_SCHEMA,
  status:state.status,
  sessionId:state.sessionId,
  kind:state.kind,
  startedAt:state.startedAt,
  lastAt:state.lastAt,
  observations:state.observations,
  confidence:Number(clamp(state.confidence).toFixed(4)),
  sourceDirection:state.sourceDirection||'unavailable',
  identity:state.identity?Object.freeze({...state.identity}):null,
  identityKey:state.identityKey||'',
  provider:state.provider||null,
  reason:state.reason||null,
  participantId:null
 });
}
export class RoomAudioIntelligenceCoordinator{
 constructor({staleMs=ROOM_AUDIO_SESSION_STALE_MS,repeatMs=ROOM_AUDIO_REPEAT_MS}={}){
  this.staleMs=Math.max(10000,Number(staleMs)||ROOM_AUDIO_SESSION_STALE_MS);
  this.repeatMs=Math.max(10000,Number(repeatMs)||ROOM_AUDIO_REPEAT_MS);
  this.reset();
 }
 reset(reason='reset'){
  this.state=null;this.lastEmitKey='';this.lastEmitAt=0;this.resetReason=clean(reason,120)||'reset';
 }
 snapshot(){return this.state?freezeState(this.state):Object.freeze({
  schema:ROOM_AUDIO_INTELLIGENCE_SCHEMA,status:'idle',sessionId:null,kind:null,
  startedAt:null,lastAt:null,observations:0,confidence:0,sourceDirection:'unavailable',
  identity:null,identityKey:'',provider:null,reason:this.resetReason,participantId:null
 });}
 observeEnvironmental(transition={},now=Date.now()){
  const kind=roomAudioKindFromEnvironmental(transition);
  if(!kind)return Object.freeze({emit:false,transition:'ignored',state:this.snapshot(),reason:'unsupported-kind'});
  const at=finite(transition.at)?transition.at:now;
  if(transition.type==='stop'){
   if(!this.state||this.state.kind!==kind)
    return Object.freeze({emit:false,transition:'stale-stop',state:this.snapshot(),reason:'not-active'});
   const ended=freezeState({...this.state,status:'stopped',lastAt:at,reason:'environmental-stop'});
   this.state=null;
   return Object.freeze({emit:true,transition:'stopped',state:ended,reason:'environmental-stop'});
  }
  const same=this.state&&this.state.kind===kind&&at-this.state.lastAt<this.staleMs;
  let transitionType='continued';
  if(!same){
   transitionType=this.state?'source-changed':'started';
   this.state={
    status:'active',sessionId:sessionId(kind,at),kind,startedAt:at,lastAt:at,
    observations:0,confidence:0,sourceDirection:'unavailable',
    identity:null,identityKey:'',provider:null,reason:'environmental-'+transitionType
   };
  }
  this.state.lastAt=at;
  this.state.observations+=Math.max(1,Number(transition.observationCount)||1);
  this.state.confidence=Math.max(this.state.confidence,clamp(transition.peakConfidence??transition.confidence));
  const direction=clean(transition.sourceDirection,32);
  if(direction&&direction!=='unavailable'){
   if(this.state.sourceDirection==='unavailable')this.state.sourceDirection=direction;
   else if(this.state.sourceDirection!==direction)this.state.sourceDirection='mixed';
  }
  const key=[transitionType,kind,this.state.identityKey].join('|');
  const emit=transitionType!=='continued'||key!==this.lastEmitKey||at-this.lastEmitAt>=this.repeatMs;
  if(emit){this.lastEmitKey=key;this.lastEmitAt=at;}
  return Object.freeze({emit,transition:transitionType,state:this.snapshot(),reason:'environmental-'+transitionType});
 }
 observeIdentity(identity={},now=Date.now()){
  if(!this.state)return Object.freeze({emit:false,transition:'identity-without-session',state:this.snapshot(),reason:'no-active-session'});
  const kind=clean(identity.kind,40)||this.state.kind;
  const compatible=this.state.kind==='music'?kind==='music':
   ['television','radio','recorded-media','video-game'].includes(this.state.kind)&&
   ['television','radio','recorded-media','video-game','movie','episode','podcast-episode','radio-show'].includes(kind);
  if(!compatible)return Object.freeze({emit:false,transition:'identity-kind-mismatch',state:this.snapshot(),reason:'kind-mismatch'});
  const key=roomAudioIdentityKey({...identity,kind});
  if(!key)return Object.freeze({emit:false,transition:'identity-invalid',state:this.snapshot(),reason:'missing-identity'});
  const previous=this.state.identityKey;
  this.state.identity=Object.freeze({
   kind,
   title:clean(identity.title,120)||null,artist:clean(identity.artist,120)||null,
   series:clean(identity.series,120)||null,album:clean(identity.album,120)||null,
   season:Number.isInteger(identity.season)?identity.season:null,
   episode:Number.isInteger(identity.episode)?identity.episode:null,
   confidence:Number(clamp(identity.confidence).toFixed(4))
  });
  this.state.identityKey=key;
  this.state.provider=clean(identity.provider,64)||null;
  this.state.lastAt=finite(identity.at)?identity.at:now;
  this.state.reason=previous&&previous!==key?'identity-changed':'identity-confirmed';
  const transition=previous&&previous!==key?'identity-changed':previous===key?'identity-reconfirmed':'identity-confirmed';
  const emit=transition!=='identity-reconfirmed'||now-this.lastEmitAt>=this.repeatMs;
  if(emit){this.lastEmitKey=transition+'|'+this.state.kind+'|'+key;this.lastEmitAt=now;}
  return Object.freeze({emit,transition,state:this.snapshot(),reason:this.state.reason});
 }
 expire(now=Date.now()){
  if(!this.state||now-this.state.lastAt<this.staleMs)return null;
  const ended=freezeState({...this.state,status:'stopped',lastAt:now,reason:'stale-timeout'});
  this.state=null;
  return Object.freeze({emit:true,transition:'stopped',state:ended,reason:'stale-timeout'});
 }
}

export function roomAudioIntelligenceMessage(result){
 const state=result?.state;
 if(!state?.kind)return '';
 const label=state.kind==='music'?'Music':
  state.kind==='television'?'TV / video':
  state.kind==='radio'?'Radio / podcast':
  state.kind==='video-game'?'Video game audio':
  state.kind==='live-or-unknown-speech'?'Room speech-like activity':'Recorded media';
 if(result.transition==='started')return label+' session started';
 if(result.transition==='source-changed')return 'Background audio changed · '+label+' is now active';
 if(result.transition==='continued')return label+' continues';
 if(result.transition==='stopped')return label+' session ended';
 if(result.transition==='identity-confirmed'||result.transition==='identity-changed'){
  const identity=state.identity||{};
  if(state.kind==='music')return 'Music identified · '+(identity.artist||'Unknown artist')+' — '+(identity.title||'Unknown track');
  const name=identity.series&&identity.title&&identity.series!==identity.title
   ?identity.series+' · '+identity.title:(identity.title||identity.series||'Unknown media');
  return 'Background media identified · '+name;
 }
 return '';
}

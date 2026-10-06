// V0.14.9A live ROOM-audio behavior refinement and representative validation state.
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const clean=(v,n=160)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const ROOM_LIVE_VALIDATION_SCHEMA=1;
export const ROOM_LIVE_EVENT_LIMIT=96;
export const ROOM_LIVE_STALE_PROVIDER_MS=120000;

export function roomAudioBehaviorPolicy({background=null,speechOrigin=null}={}){
 const mediaKind=background?.kind||speechOrigin?.mediaContext?.kind||null;
 const speechState=speechOrigin?.state||'none';
 if(speechState==='live'&&mediaKind){
  return Object.freeze({
   mode:'foreground-conversation-over-background',
   allowConversation:true,allowParticipantAttribution:Boolean(speechOrigin?.allowParticipantAttribution),
   allowRemoteExactRecognition:false,allowRemoteDialogueLookup:false,
   preserveBackgroundSession:true,reason:'verified-live-speech-over-background'
  });
 }
 if(speechState==='uncertain'&&mediaKind){
  return Object.freeze({
   mode:'mixed-uncertain',
   allowConversation:false,allowParticipantAttribution:false,
   allowRemoteExactRecognition:false,allowRemoteDialogueLookup:false,
   preserveBackgroundSession:true,reason:'mixed-live-recorded-evidence'
  });
 }
 if(speechState==='recorded'&&mediaKind){
  return Object.freeze({
   mode:'background-media',
   allowConversation:false,allowParticipantAttribution:false,
   allowRemoteExactRecognition:true,allowRemoteDialogueLookup:true,
   preserveBackgroundSession:true,reason:'recorded-media-evidence'
  });
 }
 return Object.freeze({
  mode:'foreground-conversation',
  allowConversation:speechOrigin?.allowConversation!==false,
  allowParticipantAttribution:Boolean(speechOrigin?.allowParticipantAttribution),
  allowRemoteExactRecognition:false,allowRemoteDialogueLookup:false,
  preserveBackgroundSession:Boolean(background?.status==='active'),
  reason:'no-confirmed-recorded-media'
 });
}

export class RoomLiveValidationTracker{
 constructor({eventLimit=ROOM_LIVE_EVENT_LIMIT,providerStaleMs=ROOM_LIVE_STALE_PROVIDER_MS}={}){
  this.eventLimit=Math.max(24,Math.floor(Number(eventLimit)||ROOM_LIVE_EVENT_LIMIT));
  this.providerStaleMs=Math.max(30000,Number(providerStaleMs)||ROOM_LIVE_STALE_PROVIDER_MS);
  this.reset();
 }
 reset(){
  this.startedAt=null;this.lastAt=null;this.events=[];this.sourceChanges=0;
  this.foregroundOverBackground=0;this.uncertainMixed=0;this.providerFailures=0;
  this.providerRecoveries=0;this.lastProviderFailureAt=0;this.lastProvider='';
 }
 push(type,detail={},at=Date.now()){
  if(this.startedAt===null)this.startedAt=at;
  this.lastAt=at;
  this.events.push(Object.freeze({
   type:clean(type,48),at,
   kind:clean(detail.kind,48)||null,
   provider:clean(detail.provider,64)||null,
   reason:clean(detail.reason,120)||null,
   confidence:Number(clamp(detail.confidence).toFixed(4)),
   participantId:null,rawAudioStored:false
  }));
  if(this.events.length>this.eventLimit)this.events.splice(0,this.events.length-this.eventLimit);
 }
 observeBackground(result,at=Date.now()){
  if(!result)return this.snapshot(at);
  if(result.transition==='source-changed')this.sourceChanges++;
  this.push('background-'+String(result.transition||'unknown'),{
   kind:result.state?.kind,reason:result.reason,confidence:result.state?.confidence
  },at);
  return this.snapshot(at);
 }
 observeSpeechOrigin(result,at=Date.now()){
  if(!result)return this.snapshot(at);
  const policy=roomAudioBehaviorPolicy({speechOrigin:result});
  if(policy.mode==='foreground-conversation-over-background')this.foregroundOverBackground++;
  if(policy.mode==='mixed-uncertain')this.uncertainMixed++;
  this.push('speech-'+policy.mode,{
   kind:result.mediaContext?.kind,reason:result.reason,
   confidence:Math.max(Number(result.mediaContext?.confidence)||0,Number(result.evidence?.voiceConfidence)||0)
  },at);
  return Object.freeze({policy,snapshot:this.snapshot(at)});
 }
 observeProvider({provider='',status='',reason='',at=Date.now()}={}){
  const name=clean(provider,64)||'unknown';
  if(status==='failure'){
   this.providerFailures++;this.lastProviderFailureAt=at;this.lastProvider=name;
   this.push('provider-failure',{provider:name,reason},at);
  }else if(status==='success'&&this.lastProvider===name&&this.lastProviderFailureAt&&
    at-this.lastProviderFailureAt<=this.providerStaleMs){
   this.providerRecoveries++;this.push('provider-recovery',{provider:name,reason:'provider-recovered'},at);
   this.lastProviderFailureAt=0;this.lastProvider='';
  }
  return this.snapshot(at);
 }
 snapshot(now=Date.now()){
  const durationMs=this.startedAt===null?0:Math.max(0,now-this.startedAt);
  const recent=this.events.slice(-12);
  return Object.freeze({
   schema:ROOM_LIVE_VALIDATION_SCHEMA,status:this.startedAt===null?'idle':'active',
   startedAt:this.startedAt,lastAt:this.lastAt,durationMs,
   eventCount:this.events.length,sourceChanges:this.sourceChanges,
   foregroundOverBackground:this.foregroundOverBackground,uncertainMixed:this.uncertainMixed,
   providerFailures:this.providerFailures,providerRecoveries:this.providerRecoveries,
   recent:Object.freeze(recent),participantId:null,rawAudioStored:false
  });
 }
}

export function roomLiveValidationMessage(snapshot={}){
 if(snapshot.status!=='active')return 'Live ROOM validation idle';
 const parts=[
  'Live ROOM validation',
  Math.round((snapshot.durationMs||0)/1000)+'s',
  snapshot.sourceChanges+' source changes',
  snapshot.foregroundOverBackground+' foreground-over-background',
  snapshot.uncertainMixed+' uncertain mixed windows'
 ];
 if(snapshot.providerFailures)parts.push(snapshot.providerFailures+' provider failures');
 if(snapshot.providerRecoveries)parts.push(snapshot.providerRecoveries+' recoveries');
 return parts.join(' · ');
}

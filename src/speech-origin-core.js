const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const MEDIA_MAX_AGE_MS=45000;
const RECENT_CLASSIFICATION_MAX_AGE_MS=15000;

function visibleTracks(roomTracks=[]){
 return (Array.isArray(roomTracks)?roomTracks:[]).filter(track=>
  track?.id&&!['occluded','reacquiring'].includes(String(track.status||'')));
}
function trackDirection(track){
 const cx=Number(track?.cx);
 if(!Number.isFinite(cx))return 'unavailable';
 if(cx<.4)return 'left';
 if(cx>.6)return 'right';
 return 'center';
}
function audioDirection(audioSource){
 if(audioSource?.state!=='available'||clamp(audioSource?.confidence)<.8)return 'unavailable';
 return ['left','right','center'].includes(audioSource?.direction)?audioSource.direction:'unavailable';
}
function mediaKind(row){
 if(!row)return null;
 const category=String(row.category||'');
 const subtype=String(row.subtype||'');
 if(category==='media-playback'){
  if(subtype==='television')return 'television';
  if(subtype==='radio')return 'radio';
  if(subtype==='video-game')return 'video-game';
  return 'recorded-media';
 }
 if(category==='music')return 'music';
 return null;
}
function contextFromActivity(activity,now){
 if(!activity)return null;
 const kind=mediaKind(activity);
 const lastAt=Number(activity.lastAt??activity.at??0);
 if(!kind||!finite(lastAt)||now-lastAt>MEDIA_MAX_AGE_MS)return null;
 return Object.freeze({
  kind,category:String(activity.category||''),subtype:String(activity.subtype||''),
  confidence:clamp(activity.peakConfidence??activity.confidence),
  at:lastAt,source:'environmental-activity'
 });
}
function contextFromClassification(classification,now){
 if(!classification)return null;
 const kind=mediaKind(classification);
 const at=Number(classification.at||0);
 if(!kind||!finite(at)||now-at>RECENT_CLASSIFICATION_MAX_AGE_MS)return null;
 return Object.freeze({
  kind,category:String(classification.category||''),subtype:String(classification.subtype||''),
  confidence:clamp(classification.confidence),
  at,source:'recent-environmental-classification'
 });
}
export function currentRecordedMediaContext({
 activity=null,recentClassification=null,now=Date.now()
}={}){
 const current=contextFromActivity(activity,now);
 const recent=contextFromClassification(recentClassification,now);
 if(current&&recent)return recent.at>=current.at?recent:current;
 return recent||current||null;
}

export function resolveRoomSpeechOrigin({
 mediaActivity=null,recentEnvironmental=null,voiceMatch=null,association=null,
 roomTracks=[],audioSource=null,continuousFusion=null,now=Date.now()
}={}){
 const media=currentRecordedMediaContext({
  activity:mediaActivity,recentClassification:recentEnvironmental,now
 });
 const visible=visibleTracks(roomTracks);
 const sourceDirection=audioDirection(audioSource);
 const aligned=sourceDirection!=='unavailable'&&visible.some(track=>
  trackDirection(track)===sourceDirection);
 const voiceMatched=Boolean(voiceMatch?.matched&&voiceMatch?.participant?.id);
 const voiceConfidence=clamp(voiceMatch?.similarity);
 const bodyConfirmed=Boolean(association?.bodyConfirmed&&association?.trackId);
 const verifiedLive=Boolean(voiceMatched&&(
  bodyConfirmed||(!media&&voiceConfidence>=.72)
 ));
 const spatialLive=Boolean(visible.length===1&&aligned);
 const visualLive=Boolean(visible.length);
 const continuousParticipantIds=Array.from(continuousFusion?.participantIds||[]);
 const continuousLive=Boolean(
  continuousParticipantIds.length&&
  !(continuousFusion?.conflicts||[]).length
 );

 let state='uncertain',reason='insufficient-live-vs-recorded-evidence';
 let allowConversation=true;
 let allowParticipantAttribution=false;

 if(!media){
  if(verifiedLive||spatialLive||visualLive||voiceMatched){
   state='live';
   reason=verifiedLive?'verified-live-speaker':
    spatialLive?'camera-audio-direction-aligned':
    voiceMatched?'voice-profile-without-media-context':'visible-room-person-without-media-context';
   allowParticipantAttribution=Boolean(voiceMatched&&association?.participantId);
  }else{
   state='uncertain';
   reason='no-recorded-media-context-and-no-live-corroboration';
  }
 }else if(verifiedLive){
  state='live';
  reason='verified-live-speaker-over-recorded-media';
  allowParticipantAttribution=true;
 }else if(continuousLive){
  state='live';
  reason='verified-window-level-live-speaker-over-recorded-media';
  allowParticipantAttribution=false;
 }else if(spatialLive){
  state='live';
  reason='spatial-live-speaker-evidence-over-recorded-media';
  allowParticipantAttribution=false;
 }else if(!visualLive&&!voiceMatched){
  state='recorded';
  reason='recorded-media-context-without-live-room-speaker-evidence';
  allowConversation=false;
 }else{
  state='uncertain';
  reason='recorded-media-and-live-room-evidence-conflict';
  allowConversation=false;
 }

 return Object.freeze({
  state,reason,allowConversation,allowParticipantAttribution,
  mediaContext:media,
  evidence:Object.freeze({
   visibleTrackCount:visible.length,voiceMatched,voiceConfidence,bodyConfirmed,
   sourceDirection,spatialLive,verifiedLive,continuousLive,
   continuousParticipantCount:continuousParticipantIds.length
  })
 });
}

export function roomSpeechOriginMessage(result){
 if(!result)return '';
 const kind=result.mediaContext?.kind;
 const mediaLabel=kind==='television'?'TV / video':
  kind==='radio'?'radio':
  kind==='video-game'?'video game':
  kind==='music'?'music':'recorded media';
 if(result.state==='recorded')
  return 'Recorded speech likely · '+mediaLabel+' context · excluded from participant matching and Conversation';
 if(result.state==='uncertain'&&result.mediaContext)
  return 'Speech origin uncertain · '+mediaLabel+' and live-room evidence conflict · held out of Conversation';
 if(result.state==='live'&&result.mediaContext)
  return 'Live room speech verified while '+mediaLabel+' is active';
 return result.state==='live'?'Live room speech evidence accepted':
  'Speech origin uncertain · no recorded-media evidence';
}

export class RoomSpeechOriginTracker{
 constructor({repeatMs=30000}={}){
  this.repeatMs=Math.max(5000,Number(repeatMs)||30000);this.last=null;
 }
 reset(){this.last=null;}
 observe(result,now=Date.now()){
  if(!result)return Object.freeze({emit:false,reason:'no-result',result:null});
  const key=[result.state,result.mediaContext?.kind||'none',result.reason].join(':');
  const changed=!this.last||this.last.key!==key;
  const emit=changed||now-this.last.at>=this.repeatMs;
  if(emit)this.last={key,at:now};
  return Object.freeze({emit,reason:emit?(changed?'changed':'repeat-window'):'deduplicated',result});
 }
}

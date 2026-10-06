// V0.14.9C contextual ROOM cognition for media-aware proactive engagement.
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const clean=(v,n=240)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const ROOM_CONTEXTUAL_COGNITION_SCHEMA=1;
export const ROOM_CONTEXTUAL_MIN_IDLE_MS=45000;
export const ROOM_CONTEXTUAL_MIN_MEDIA_MS=30000;
export const ROOM_CONTEXTUAL_REPEAT_MS=30*60*1000;
export const ROOM_CONTEXTUAL_RETRY_MS=2*60*1000;

function mediaLabel(media={}){
 const kind=clean(media.kind,40);
 const identity=media.identity||{};
 if(kind==='music'){
  const artist=clean(identity.artist,120),title=clean(identity.title,120);
  return [artist,title].filter(Boolean).join(' — ');
 }
 const series=clean(identity.series,120),title=clean(identity.title,120);
 return series&&title&&series!==title?series+' · '+title:(title||series);
}
function mediaTopicKey(media={}){
 const id=clean(media.identityKey,360).toLowerCase();
 if(id)return id;
 const label=mediaLabel(media).toLowerCase();
 return label?clean(media.kind,40)+':'+label:'';
}
export function contextualMediaObservation({
 participant=null,temporal=null,continuity=null,audio=null,
 lastDialogueAt=0,now=Date.now()
}={}){
 const visible=Boolean(participant?.id&&temporal?.visibility==='observed');
 const idleMs=finite(temporal?.stationaryMs)?Math.max(0,temporal.stationaryMs):0;
 const media=continuity?.active||null;
 const mediaAgeMs=media&&finite(media.startedAt)?Math.max(0,now-media.startedAt):0;
 const identity=media?.identity||audio?.identity||null;
 const identityKey=clean(media?.identityKey||audio?.identityKey,360);
 const confidence=clamp(identity?.confidence??audio?.confidence??0);
 const dialogueQuietMs=finite(lastDialogueAt)&&lastDialogueAt>0?Math.max(0,now-lastDialogueAt):Infinity;
 const stableMedia=Boolean(media?.status==='active'&&!media?.provisionalInterstitial&&
   mediaAgeMs>=ROOM_CONTEXTUAL_MIN_MEDIA_MS);
 const identified=Boolean(identity&&identityKey&&confidence>=.72);
 const idle=visible&&idleMs>=ROOM_CONTEXTUAL_MIN_IDLE_MS&&dialogueQuietMs>=30000;
 return Object.freeze({
  schema:ROOM_CONTEXTUAL_COGNITION_SCHEMA,
  participantId:participant?.id||null,
  visible,idle,idleMs,dialogueQuietMs,
  stableMedia,mediaAgeMs,identified,confidence,
  media:media?Object.freeze({
   continuityId:media.continuityId,kind:media.kind,identityKey,
   identity:identity?Object.freeze({...identity}):null,
   interruptions:media.interruptions||0,resumes:media.resumes||0
  }):null,
  topicKey:mediaTopicKey({...media,identityKey,identity}),
  rawAudioStored:false
 });
}

export function contextualMediaEngagementCandidate(observation={},history=[],now=Date.now()){
 const reasons=[];
 if(!observation.participantId)reasons.push('no-verified-participant');
 if(!observation.visible)reasons.push('participant-not-visible');
 if(!observation.idle)reasons.push('participant-not-idle');
 if(!observation.stableMedia)reasons.push('media-not-stable');
 if(!observation.identified)reasons.push('media-not-confidently-identified');
 if(!observation.topicKey)reasons.push('missing-media-topic');
 const rows=(history||[]).filter(row=>row?.topicKey===observation.topicKey&&finite(row.at)&&now-row.at>=0)
  .sort((a,b)=>b.at-a.at);
 const priorSuccess=rows.find(row=>row.executed&&now-row.at<ROOM_CONTEXTUAL_REPEAT_MS)||null;
 const priorAttempt=rows.find(row=>!row.executed&&now-row.at<ROOM_CONTEXTUAL_RETRY_MS)||null;
 if(priorSuccess)reasons.push('recent-topic-engagement');
 else if(priorAttempt)reasons.push('recent-generation-attempt');
 const eligible=reasons.length===0;
 const media=observation.media||{};
 const identity=media.identity||{};
 return Object.freeze({
  eligible,reasons:Object.freeze(reasons),
  participantId:observation.participantId||null,
  topicKey:observation.topicKey||null,
  mediaKind:media.kind||null,
  mediaLabel:mediaLabel(media)||null,
  mediaIdentity:Object.freeze({
   kind:identity.kind||media.kind||null,title:identity.title||null,
   artist:identity.artist||null,series:identity.series||null,
   album:identity.album||null,season:identity.season??null,episode:identity.episode??null
  }),
  confidence:Number(clamp(observation.confidence).toFixed(4)),
  idleMs:observation.idleMs||0,
  mediaAgeMs:observation.mediaAgeMs||0,
  task:'Generate one brief, natural proactive engagement grounded only in the verified current media context. Ask or comment conversationally, and optionally offer one relevant next step such as research, recommendations, background, trivia, related works, or discussion. Do not claim the person is watching/listening unless phrased as a question when inference is indirect. Do not mention surveillance, confidence scores, detection systems, or internal observations.',
  source:'room-contextual-media-cognition'
 });
}

export class RoomContextualCognitionTracker{
 constructor({maxHistory=40}={}){
  this.maxHistory=Math.max(10,Math.min(100,Math.floor(maxHistory)||40));
  this.history=[];this.lastCandidate=null;this.lastObservation=null;
 }
 observe(input={},now=Date.now()){
  const observation=contextualMediaObservation({...input,now});
  const candidate=contextualMediaEngagementCandidate(observation,this.history,now);
  this.lastObservation=observation;this.lastCandidate=candidate;
  return Object.freeze({observation,candidate});
 }
 record(candidate,{executed=false,at=Date.now()}={}){
  if(!candidate?.topicKey)return null;
  const row=Object.freeze({
   at,topicKey:candidate.topicKey,participantId:candidate.participantId||null,
   mediaKind:candidate.mediaKind||null,executed:Boolean(executed)
  });
  this.history=[...this.history,row].slice(-this.maxHistory);
  return row;
 }
 snapshot(){
  return Object.freeze({
   lastObservation:this.lastObservation,lastCandidate:this.lastCandidate,
   recent:Object.freeze(this.history.slice(-10))
  });
 }
}

export function contextualMediaPrompt(candidate={}){
 if(!candidate?.eligible)return '';
 const identity=candidate.mediaIdentity||{};
 const context={
  mediaKind:candidate.mediaKind,
  title:identity.title||null,artist:identity.artist||null,series:identity.series||null,
  album:identity.album||null,season:identity.season??null,episode:identity.episode??null,
  participantIdleMs:candidate.idleMs,mediaStableMs:candidate.mediaAgeMs
 };
 return [
  candidate.task,
  'Context: '+JSON.stringify(context),
  'Return only the sentence(s) the agent should say. Keep it concise and optional, never pushy.'
 ].join('\n');
}

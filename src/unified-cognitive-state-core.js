// V0.15A canonical cognitive state.
// Metadata-only normalized snapshot: no raw frames, audio buffers, or transcript bodies.

const clean=(v,n=240)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));

export const COGNITIVE_STATE_SCHEMA=1;
export const COGNITIVE_STATE_MAX_PARTICIPANTS=16;
export const COGNITIVE_STATE_MAX_EVENTS=24;
export const COGNITIVE_STATE_MAX_MEMORIES=12;
export const COGNITIVE_STATE_MAX_TASKS=12;
export const COGNITIVE_STATE_FRESH_MS=30000;
export const COGNITIVE_STATE_STALE_MS=180000;

function freshness(at,now){
 if(!finite(at)||at<=0)return 'unknown';
 const age=Math.max(0,now-at);
 return age<=COGNITIVE_STATE_FRESH_MS?'fresh':
  age<=COGNITIVE_STATE_STALE_MS?'aging':'stale';
}
function participantRow(row={},now){
 return Object.freeze({
  id:clean(row.id||row.participantId,96)||null,
  name:clean(row.name||row.nickname,120)||null,
  visible:row.visible===true,
  attentionEligible:row.attentionEligible!==false,
  activity:clean(row.activity,64)||null,
  stationaryMs:Math.max(0,Number(row.stationaryMs)||0),
  speaking:row.speaking===true,
  lastObservedAt:finite(row.lastObservedAt)?row.lastObservedAt:null,
  freshness:freshness(row.lastObservedAt,now)
 });
}
function eventRow(row={},now){
 return Object.freeze({
  id:clean(row.id,96)||null,
  at:finite(row.at)?row.at:null,
  semantic:clean(row.semantic||row.type,120)||null,
  category:clean(row.category,64)||null,
  participantId:clean(row.participantId,96)||null,
  confidence:clamp(row.confidence),
  salience:clamp(row.salience??.5),
  topicKey:clean(row.topicKey,360)||null,
  freshness:freshness(row.at,now),
  source:clean(row.source,100)||null
 });
}
function memoryRow(row={},now){
 return Object.freeze({
  id:clean(row.id,96)||null,
  participantId:clean(row.participantId,96)||null,
  type:clean(row.type,48)||null,
  text:clean(row.text,360)||null,
  status:clean(row.status,32)||'active',
  persistent:row.persistent===true,
  expiresAt:finite(row.expiresAt)?row.expiresAt:null,
  freshness:row.expiresAt&&row.expiresAt<=now?'expired':'active'
 });
}
function goalRow(row={}){
 return Object.freeze({
  id:clean(row.id,120)||null,state:clean(row.state,48)||null,
  source:clean(row.source,80)||null,participantId:clean(row.participantId,96)||null,
  intent:clean(row.intent,360)||null,currentStep:clean(row.currentStep,160)||null,
  expiresAt:finite(row.expiresAt)?row.expiresAt:null
 });
}
function taskRow(row={}){
 return Object.freeze({
  id:clean(row.id,96)||null,
  kind:clean(row.kind||row.skillId||row.presetId,80)||null,
  status:clean(row.status,48)||null,
  participantId:clean(row.participantId,96)||null,
  requiresOwnerAction:row.requiresOwnerAction===true||row.status==='pending-confirmation'||row.status==='awaiting-owner'
 });
}
function mediaRow(media={}){
 const active=media.active||media.current||media;
 const identity=active?.identity||null;
 return Object.freeze({
  status:clean(active?.status,32)||'idle',
  kind:clean(active?.kind,48)||null,
  continuityId:clean(active?.continuityId||active?.sessionId,120)||null,
  startedAt:finite(active?.startedAt)?active.startedAt:null,
  lastAt:finite(active?.lastAt)?active.lastAt:null,
  identity:identity?Object.freeze({
   title:clean(identity.title,160)||null,
   artist:clean(identity.artist,160)||null,
   series:clean(identity.series,160)||null,
   album:clean(identity.album,160)||null,
   confidence:clamp(identity.confidence)
  }):null,
  interruption:clean(active?.interruption,80)||null
 });
}

export function buildUnifiedCognitiveState(input={},now=Date.now()){
 const participants=(Array.isArray(input.participants)?input.participants:[])
  .map(row=>participantRow(row,now))
  .filter(row=>row.id)
  .slice(0,COGNITIVE_STATE_MAX_PARTICIPANTS);
 const visibleIds=participants.filter(row=>row.visible).map(row=>row.id);
 const speakers=participants.filter(row=>row.speaking).map(row=>row.id);

 const events=(Array.isArray(input.events)?input.events:[])
  .map(row=>eventRow(row,now))
  .filter(row=>row.semantic)
  .sort((a,b)=>(b.at||0)-(a.at||0))
  .slice(0,COGNITIVE_STATE_MAX_EVENTS);

 const memories=(Array.isArray(input.memories)?input.memories:[])
  .map(row=>memoryRow(row,now))
  .filter(row=>row.id&&row.status==='active'&&row.freshness!=='expired')
  .slice(0,COGNITIVE_STATE_MAX_MEMORIES);

 const tasks=[...(Array.isArray(input.tasks)?input.tasks:[]),
  ...(Array.isArray(input.workflows)?input.workflows:[])]
  .map(taskRow)
  .filter(row=>row.id&&row.status&&!['succeeded','failed','cancelled','invalidated'].includes(row.status))
  .slice(0,COGNITIVE_STATE_MAX_TASKS);

 const goals=(Array.isArray(input.goals)?input.goals:[]).map(goalRow)
  .filter(row=>row.id&&row.state&&!['completed','abandoned','expired'].includes(row.state))
  .slice(0,24);
 const media=mediaRow(input.media||{});
 const meeting=input.meeting&&typeof input.meeting==='object'?Object.freeze({
  id:clean(input.meeting.id,96)||null,status:clean(input.meeting.status,48)||null,
  participantIds:Object.freeze((input.meeting.participantIds||[]).map(v=>clean(v,96)).filter(Boolean).slice(0,16))
 }):null;
 const followThrough=input.followThrough?Object.freeze({
  id:clean(input.followThrough.id,96)||null,
  status:clean(input.followThrough.status,48)||null,
  action:clean(input.followThrough.action,48)||null,
  participantId:clean(input.followThrough.participantId,96)||null,
  topicKey:clean(input.followThrough.topicKey,360)||null,
  expiresAt:finite(input.followThrough.expiresAt)?input.followThrough.expiresAt:null
 }):null;

 const conflicts=[];
 if(speakers.length>1)conflicts.push('multiple-current-speakers');
 if(meeting?.status==='active'&&followThrough?.status==='pending-confirmation')
  conflicts.push('meeting-with-pending-followthrough');
 if(input.agent?.speaking===true&&input.conversation?.userSpeaking===true)
  conflicts.push('agent-user-speech-overlap');
 if(media.status==='active'&&media.lastAt&&freshness(media.lastAt,now)==='stale')
  conflicts.push('stale-active-media');

 return Object.freeze({
  schema:COGNITIVE_STATE_SCHEMA,at:now,sessionId:clean(input.sessionId,120)||null,
  pageVisible:input.pageVisible!==false,
  room:Object.freeze({
   id:clean(input.room?.id,96)||null,name:clean(input.room?.name,120)||null,
   cameraActive:input.room?.cameraActive===true,microphoneActive:input.room?.microphoneActive===true
  }),
  participants:Object.freeze(participants),
  visibleParticipantIds:Object.freeze(visibleIds),
  speakerParticipantIds:Object.freeze(speakers),
  conversation:Object.freeze({
   userSpeaking:input.conversation?.userSpeaking===true,
   processing:input.conversation?.processing===true,
   lastDialogueAt:finite(input.conversation?.lastDialogueAt)?input.conversation.lastDialogueAt:null,
   freshness:freshness(input.conversation?.lastDialogueAt,now)
  }),
  media,
  events:Object.freeze(events),
  memories:Object.freeze(memories),
  tasks:Object.freeze(tasks),
  goals:Object.freeze(goals),
  meeting,
  followThrough,
  providers:Object.freeze({
   available:(input.providers?.available||[]).map(v=>clean(v,32)).filter(Boolean).slice(0,8),
   degraded:(input.providers?.degraded||[]).map(v=>clean(v,32)).filter(Boolean).slice(0,8)
  }),
  agent:Object.freeze({
   busy:input.agent?.busy===true,speaking:input.agent?.speaking===true,
   pendingProactive:Math.max(0,Number(input.agent?.pendingProactive)||0),
   interruptionsThisHour:Math.max(0,Number(input.agent?.interruptionsThisHour)||0)
  }),
  runtime:Object.freeze({
   performanceLevel:clean(input.runtime?.performanceLevel,32)||'normal',
   storageStatus:clean(input.runtime?.storageStatus,32)||'unknown',
   cameraRecoveryPending:input.runtime?.cameraRecoveryPending===true,
   microphoneRecoveryPending:input.runtime?.microphoneRecoveryPending===true
  }),
  conflicts:Object.freeze(conflicts),
  rawAudioStored:false,rawFramesStored:false
 });
}

export class UnifiedCognitiveStateStore{
 constructor(){this.current=null;this.previous=null;this.sequence=0;}
 update(input={},now=Date.now()){
  const next=buildUnifiedCognitiveState(input,now);
  this.previous=this.current;this.current=next;this.sequence++;
  return next;
 }
 snapshot(){return this.current;}
 transition(){
  return Object.freeze({sequence:this.sequence,previous:this.previous,current:this.current});
 }
 reset(){this.current=null;this.previous=null;this.sequence=0;}
}

export const SESSION_IDENTITY_SCHEMA=1;
export const MAX_SESSION_TIMELINE_ITEMS=500;
export const MAX_SESSION_EXPORT_ITEMS=500;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const short=(value,max=160)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value,96)))];
const atOf=value=>{
 if(finite(value))return value;
 const parsed=Date.parse(String(value||''));
 return Number.isFinite(parsed)?parsed:0;
};
const identifier=()=>globalThis.crypto?.randomUUID?.()||
 'session-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

export function normalizeSessionIdentity(input={}){
 const id=short(input.id||identifier(),96);
 if(!id)throw new TypeError('Session id required.');
 const startedAt=finite(input.startedAt)?input.startedAt:Date.now();
 const status=input.status==='ended'?'ended':'active';
 const endedAt=status==='ended'&&finite(input.endedAt)
  ?Math.max(startedAt,input.endedAt):null;
 return Object.freeze({
  id,schemaVersion:SESSION_IDENTITY_SCHEMA,
  status,startedAt,endedAt,
  endedReason:status==='ended'?short(input.endedReason||'ended',64)||'ended':null,
  runtimeScope:short(input.runtimeScope||'agent-room',48)||'agent-room',
  runtimeInstanceId:short(input.runtimeInstanceId,96)||null,
  updatedAt:finite(input.updatedAt)?Math.max(startedAt,input.updatedAt):startedAt
 });
}

export function createSessionIdentity({
 id=null,runtimeScope='agent-room',runtimeInstanceId=null
}={},now=Date.now()){
 return normalizeSessionIdentity({
  id:id||identifier(),status:'active',startedAt:now,updatedAt:now,
  runtimeScope,runtimeInstanceId
 });
}

export function endSessionIdentity(session,reason='ended',at=Date.now()){
 const current=normalizeSessionIdentity(session);
 if(current.status==='ended')return current;
 return normalizeSessionIdentity({
  ...current,status:'ended',endedAt:Math.max(current.startedAt,Number(at)||current.startedAt),
  endedReason:short(reason,64)||'ended',updatedAt:Math.max(current.startedAt,Number(at)||current.startedAt)
 });
}

export function recoverPriorSessionIdentities(records=[],current,at=Date.now()){
 const active=normalizeSessionIdentity(current);
 if(!active.runtimeInstanceId)return Object.freeze((records||[]).map(normalizeSessionIdentity));
 return Object.freeze((records||[]).map(raw=>{
  const record=normalizeSessionIdentity(raw);
  if(record.id===active.id||record.status!=='active'||
     record.runtimeInstanceId!==active.runtimeInstanceId)return record;
  return endSessionIdentity(record,'reload-recovered',Math.max(record.startedAt,Number(at)||active.startedAt));
 }));
}

function timelineItem(input={}){
 return Object.freeze({
  id:short(input.id,180),
  sessionId:short(input.sessionId,96),
  sourceType:short(input.sourceType,48),
  sourceId:short(input.sourceId,96),
  subtype:short(input.subtype,64)||null,
  at:Math.max(0,Number(input.at)||0),
  endAt:finite(input.endAt)?Math.max(0,input.endAt):null,
  title:short(input.title,180),
  text:short(input.text,800),
  participantId:short(input.participantId)||null,
  participantIds:Object.freeze(uniq(input.participantIds).slice(0,24)),
  roomId:short(input.roomId)||null,
  status:short(input.status,64)||null,
  provenance:Object.freeze(uniq(input.provenance).slice(0,16)),
  references:Object.freeze((input.references||[]).slice(0,12).map(ref=>Object.freeze({
   type:short(ref?.type,48),id:short(ref?.id,96),
   state:ref?.state==='stale'?'stale':'available'
  })))
 });
}

function participantName(id,people){
 if(!id)return 'Unknown participant';
 const person=people.get(id);
 return person?.nickname||person?.name||'Participant';
}

function meetingRefs(turn,meetingIds){
 const id=short(turn?.meetingId,96);
 return id?[{type:'meeting',id,state:meetingIds.has(id)?'available':'stale'}]:[];
}

function recordingItem(recording,sessionId,dialogueIds=new Set()){
 const id=short(recording?.id||recording?.recordingId,96);
 if(!id)return null;
 const startedAt=atOf(recording?.startedAt||recording?.createdAt||recording?.at);
 const endedAt=atOf(recording?.endedAt);
 const durationMs=finite(recording?.durationMs)
  ?Math.max(0,recording.durationMs)
  :endedAt&&startedAt?Math.max(0,endedAt-startedAt):null;
 return timelineItem({
  id:'recording:'+id,sessionId,sourceType:'recording',sourceId:id,
  subtype:'recording-reference',at:startedAt,endAt:endedAt||null,
  title:'Saved recording',
  text:[
   durationMs===null?'Recording metadata reference':
    'Recording metadata reference · '+Math.round(durationMs/1000)+'s',
   String(recording?.mediaState||recording?.status||'unknown'),
   (recording?.transcriptTurnIds||[]).length+' transcript refs'
  ].join(' · '),
  participantIds:recording?.participantIds||[],
  status:short(recording?.status||'available',64)||'available',
  provenance:['canonical-recording-reference','metadata-only','media-not-exported'],
  references:(recording?.transcriptTurnIds||[]).slice(0,12).map(id=>({
   type:'dialogue-turn',id:String(id).slice(0,96),
   state:dialogueIds.has(String(id))?'available':'stale'
  }))
 });
}

export function buildSessionIdentityTimeline({
 session,dialogueTurns=[],roomEvents=[],meetings=[],recordings=[],participants=[]
}={}){
 const record=normalizeSessionIdentity(session);
 const sessionId=record.id;
 const people=new Map((participants||[]).filter(Boolean).map(person=>[person.id,person]));
 const meetingRows=(meetings||[]).filter(row=>row?.id);
 const meetingIds=new Set(meetingRows.map(row=>String(row.id)));
 const dialogueIds=new Set((dialogueTurns||[]).filter(row=>row?.id).map(row=>String(row.id)));
 const items=[
  timelineItem({
   id:'session:'+sessionId+':start',sessionId,sourceType:'session',sourceId:sessionId,
   subtype:'session-start',at:record.startedAt,title:'Session started',
   text:'Canonical standalone session started',status:'active',
   provenance:['canonical-session-lifecycle']
  })
 ];

 for(const turn of Array.isArray(dialogueTurns)?dialogueTurns:[]){
  if(!turn?.id||String(turn.sessionId||'')!==sessionId)continue;
  const at=atOf(turn.createdAt)||Number(turn.at)||record.startedAt;
  const participantIds=uniq([
   turn.participantId,
   ...(turn.multiPersonParticipantIds||[]),
   ...(turn.multiPersonCandidateParticipantIds||[])
  ]);
  const primary=turn.participantId||participantIds[0]||null;
  items.push(timelineItem({
   id:'conversation:'+turn.id,sessionId,sourceType:'conversation',sourceId:turn.id,
   subtype:'dialogue-turn',at,
   title:primary?participantName(primary,people):'Unknown speaker',
   text:short(turn.transcript||'[transcription unavailable]',800),
   roomId:turn.roomId||null,
   participantId:primary,participantIds,
   status:String(turn.transcriptState||(
    turn.transcriptEditedAt?'corrected':'final')),
   provenance:[
    'canonical-dialogue',
    'speaker:'+String(turn.associationState||'unknown-speaker'),
    ...(turn.speakerAttributionEditedBy?['owner-speaker-correction']:[]),
    ...(turn.transcriptEditedBy?['owner-transcript-correction']:[])
   ],
   references:meetingRefs(turn,meetingIds)
  }));
 }

 for(const event of Array.isArray(roomEvents)?roomEvents:[]){
  if(!event?.id||String(event.sessionId||'')!==sessionId)continue;
  items.push(timelineItem({
   id:'room:'+event.id,sessionId,sourceType:'room',sourceId:event.id,
   subtype:event.kind||event.category||'observation',at:Number(event.at)||record.startedAt,
   title:'ROOM · '+String(event.category||'event').toUpperCase(),
   text:event.message||'ROOM event',participantId:event.participantId||null,
   roomId:event.roomId||null,
   participantIds:event.participantId?[event.participantId]:[],
   status:event.correctedBy?'corrected':event.status||event.kind||'observed',
   provenance:[
    'canonical-room-event',String(event.source||'local'),
    ...(event.correctedBy?['owner-corrected']:[])
   ]
  }));
 }

 for(const meeting of meetingRows){
  if(String(meeting.sessionId||'')!==sessionId)continue;
  const roster=uniq([
   ...(meeting.rosterParticipantIds||[]),
   ...(meeting.activeParticipantIds||[])
  ]);
  items.push(timelineItem({
   id:'meeting:'+meeting.id,sessionId,sourceType:'meeting',sourceId:meeting.id,
   subtype:'meeting',at:Number(meeting.startedAt)||record.startedAt,
   endAt:finite(meeting.endedAt)?meeting.endedAt:null,
   title:meeting.title||'Meeting',
   text:meeting.status==='ended'?'Meeting ended':'Meeting active',
   participantIds:roster,status:meeting.status||'active',
   provenance:['canonical-meeting-metadata'],
   references:[]
  }));
 }

 for(const recording of Array.isArray(recordings)?recordings:[]){
  if(String(recording?.sessionId||'')!==sessionId)continue;
  const item=recordingItem(recording,sessionId,dialogueIds);
  if(item)items.push(item);
 }

 if(record.status==='ended'){
  items.push(timelineItem({
   id:'session:'+sessionId+':end',sessionId,sourceType:'session',sourceId:sessionId,
   subtype:'session-end',at:record.endedAt,title:'Session ended',
   text:'Canonical standalone session ended · '+record.endedReason,
   status:'ended',provenance:['canonical-session-lifecycle']
  }));
 }

 return Object.freeze(items.sort((a,b)=>a.at-b.at||
  String(a.id).localeCompare(String(b.id))).slice(-MAX_SESSION_TIMELINE_ITEMS));
}

export function sessionIdentitySummary(timeline=[]){
 const rows=Array.from(timeline||[]);
 const sourceCounts={session:0,conversation:0,room:0,meeting:0,recording:0};
 const participants=new Set();
 let staleReferenceCount=0;
 for(const row of rows){
  if(Object.hasOwn(sourceCounts,row.sourceType))sourceCounts[row.sourceType]+=1;
  for(const id of row.participantIds||[])participants.add(id);
  staleReferenceCount+=(row.references||[]).filter(ref=>ref.state==='stale').length;
 }
 return Object.freeze({
  itemCount:rows.length,
  sourceCounts:Object.freeze({...sourceCounts}),
  participantIds:Object.freeze([...participants]),
  staleReferenceCount
 });
}

export function sessionIdentityExport(timeline=[],session){
 const record=normalizeSessionIdentity(session);
 const rows=Array.from(timeline||[]).filter(row=>row?.sessionId===record.id)
  .slice(-MAX_SESSION_EXPORT_ITEMS).map(row=>Object.freeze({
   id:short(row.id,180),sourceType:short(row.sourceType,48),
   sourceId:short(row.sourceId,96),subtype:short(row.subtype,64)||null,
   at:Number(row.at)||0,endAt:finite(row.endAt)?row.endAt:null,
   title:short(row.title,180),text:short(row.text,800),
   participantId:short(row.participantId)||null,
   participantIds:Object.freeze(uniq(row.participantIds).slice(0,24)),
   roomId:short(row.roomId)||null,
   status:short(row.status,64)||null,
   provenance:Object.freeze(uniq(row.provenance).slice(0,16)),
   references:Object.freeze((row.references||[]).slice(0,12).map(ref=>({
    type:short(ref?.type,48),id:short(ref?.id,96),
    state:ref?.state==='stale'?'stale':'available'
   })))
  }));
 return Object.freeze({
  schema:'tracky2-session-identity-export-v1',
  exportedAt:new Date().toISOString(),
  session:Object.freeze({
   id:record.id,status:record.status,startedAt:record.startedAt,
   endedAt:record.endedAt,endedReason:record.endedReason
  }),
  itemCount:rows.length,
  items:Object.freeze(rows)
 });
}

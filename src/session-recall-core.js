import {projectRoomState} from './room-event-core.js';
import {normalizeMemoryRecord,memoryExpired} from './agent-memory-core.js';
import {memoryEvidenceFingerprint} from './agent-memory-learning-core.js';

export const RECALL_SOURCE_TYPES=Object.freeze([
 'conversation','room','meeting','recording','decision','task','memory'
]);
export const MAX_RECALL_RESULTS=100;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const short=(value,max=500)=>clean(value).slice(0,max);
const atOf=value=>{
 if(finite(value))return value;
 const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?parsed:0;
};
const sourceAllowed=(row,filter)=>{
 if(!filter||filter==='all')return true;
 if(filter==='decision')return row.decisionLike===true||row.subtype==='decision';
 return row.sourceType===filter;
};
const participantAllowed=(item,participantId)=>{
 if(!participantId)return true;
 if(item.participantId===participantId)return true;
 return Array.isArray(item.participantIds)&&item.participantIds.includes(participantId);
};
const ref=(type,id,state='available')=>Object.freeze({
 type:String(type||'').slice(0,48),id:String(id||'').slice(0,96),state
});
const freezeItem=item=>Object.freeze({
 ...item,
 participantIds:Object.freeze([...(item.participantIds||[])]),
 provenance:Object.freeze([...(item.provenance||[])]),
 references:Object.freeze([...(item.references||[])])
});

function item(input){
 return freezeItem({
  id:short(input.id,180),sourceType:input.sourceType,
  sourceId:short(input.sourceId,96),subtype:short(input.subtype,64),
  at:finite(input.at)?input.at:0,title:short(input.title,180),
  text:short(input.text,800),participantId:input.participantId||null,
  participantIds:Array.from(new Set((input.participantIds||[]).filter(Boolean))),
  temporal:input.temporal==='current-session'?'current-session':'historical',
  provenance:(input.provenance||[]).map(v=>short(v,96)).filter(Boolean),
  references:input.references||[],
  status:short(input.status,64)||null,
  decisionLike:input.decisionLike===true
 });
}

function currentSession(sessionId,currentSessionId,currentSessionIds=[]){
 if(!sessionId)return false;
 const value=String(sessionId);
 if(currentSessionId&&value===String(currentSessionId))return true;
 return (Array.isArray(currentSessionIds)?currentSessionIds:[]).some(id=>id&&value===String(id));
}

export function buildRecallProjection({
 dialogueTurns=[],agentHistory=[],roomEvents=[],meetings=[],recordings=[],tasks=[],memories=[],
 participants=[],currentSessionId=null,currentSessionIds=[],currentSessionStartedAt=0,now=Date.now()
}={}){
 const people=new Map((participants||[]).filter(Boolean).map(person=>[person.id,person]));
 const dialogue=(Array.isArray(dialogueTurns)?dialogueTurns:[]).filter(turn=>turn?.id);
 const dialogueById=new Map(dialogue.map(turn=>[String(turn.id),turn]));
 const dialogueIds=new Set(dialogueById.keys());
 const roomProjection=projectRoomState(Array.isArray(roomEvents)?roomEvents:[]);
 const effectiveRoom=roomProjection.events||[];
 const roomById=new Map(effectiveRoom.filter(event=>event?.id).map(event=>[String(event.id),event]));
 const roomIds=new Set(roomById.keys());
 const meetingRows=Array.isArray(meetings)?meetings:[];
 const meetingNoteById=new Map(),meetingDecisionById=new Map();
 for(const meeting of meetingRows){
  for(const note of meeting?.notes||[])if(note?.id)meetingNoteById.set(String(note.id),{...note,meetingId:meeting.id});
  for(const decision of meeting?.decisions||[])if(decision?.id)meetingDecisionById.set(String(decision.id),{...decision,meetingId:meeting.id});
 }
 const meetingNoteIds=new Set(meetingNoteById.keys()),meetingDecisionIds=new Set(meetingDecisionById.keys());
 const rows=[];

 for(const turn of dialogue){
  const text=clean(turn.transcript);
  if(!text)continue;
  const pid=turn.participantId||null;
  const person=pid?people.get(pid):null;
  const createdAt=atOf(turn.createdAt)||Number(turn.at)||0;
  const transcriptState=String(turn.transcriptState||(
   turn.transcriptEditedAt?'corrected':'final'));
  const provenance=['canonical-dialogue',transcriptState];
  if(turn.transcriptSource)provenance.push('transcript:'+String(turn.transcriptSource));
  if(turn.associationState)provenance.push('speaker:'+String(turn.associationState));
  if(turn.roomId)provenance.push('room:'+String(turn.roomId));
  if(turn.roomPresenceState)provenance.push('room-state:'+String(turn.roomPresenceState));
  rows.push(item({
   id:'conversation:'+turn.id,sourceType:'conversation',sourceId:turn.id,
   subtype:'dialogue-turn',at:createdAt,
   title:pid?(person?.nickname||person?.name||turn.participantName||'Participant'):'Unknown speaker',
   text,participantId:pid,participantIds:pid?[pid]:[],
   temporal:currentSession(turn.sessionId,currentSessionId,currentSessionIds)?'current-session':'historical',
   provenance,
   references:[
    ...(turn.meetingId?[ref('meeting',turn.meetingId)]:[]),
    ...(turn.sessionId?[ref('session',turn.sessionId)]:[])
   ],
   status:transcriptState
  }));
 }

 for(const history of Array.isArray(agentHistory)?agentHistory:[]){
  if(!history?.id||!['agent','system'].includes(history.role)||!clean(history.text))continue;
  const at=Number(history.at)||0;
  rows.push(item({
   id:'conversation-history:'+history.id,sourceType:'conversation',sourceId:history.id,
   subtype:history.role==='agent'?'agent-reply':'system-message',at,
   title:history.role==='agent'?'AGENT reply':'System message',text:history.text,
   participantId:history.participantId||null,
   participantIds:history.participantId?[history.participantId]:[],
   temporal:currentSessionStartedAt&&at>=currentSessionStartedAt?'current-session':'historical',
   provenance:['agent-history',history.role==='agent'?'agent-generated-reply':'system-message'],
   references:history.scopeId?[ref('conversation-scope',history.scopeId)]:[],
   status:'available'
  }));
 }

 for(const event of effectiveRoom){
  if(!event?.id||!clean(event.message))continue;
  rows.push(item({
   id:'room:'+event.id,sourceType:'room',sourceId:event.id,
   subtype:event.kind||'observation',at:Number(event.at)||0,
   title:'ROOM · '+String(event.category||'event').toUpperCase(),
   text:event.message,participantId:event.participantId||null,
   participantIds:event.participantId?[event.participantId]:[],
   temporal:currentSession(event.sessionId,currentSessionId,currentSessionIds)?'current-session':'historical',
   provenance:[
    'canonical-room-event',String(event.source||'local'),
    ...(event.correctedBy?['owner-corrected']:[])
   ],
   references:event.relatedEventId?[ref('room-event',event.relatedEventId,
    roomIds.has(String(event.relatedEventId))?'available':'stale')]:[],
   status:event.correctedBy?'corrected':event.kind||'observation',
   decisionLike:event.category==='decision'||['decision','action','outcome'].includes(event.kind)
  }));
 }

 for(const raw of meetingRows){
  if(!raw?.id)continue;
  const roster=[...(raw.rosterParticipantIds||[])].filter(Boolean);
  const start=Number(raw.startedAt)||0;
  rows.push(item({
   id:'meeting:'+raw.id,sourceType:'meeting',sourceId:raw.id,subtype:'meeting',
   at:start,title:raw.title||'Meeting',
   text:'Meeting '+String(raw.status||'ended')+' · '+roster.length+' verified roster',
   participantIds:roster,temporal:raw.status==='active'?'current-session':'historical',
   provenance:['meeting-metadata','canonical-dialogue-references'],
   status:raw.status||'ended'
  }));
  for(const note of raw.notes||[]){
   if(!note?.id||!clean(note.text))continue;
   rows.push(item({
    id:'meeting:'+raw.id+':note:'+note.id,sourceType:'meeting',sourceId:raw.id,
    subtype:'owner-note',at:Number(note.at)||start,title:(raw.title||'Meeting')+' · Owner note',
    text:note.text,participantIds:roster,
    temporal:raw.status==='active'?'current-session':'historical',
    provenance:['meeting-metadata','owner-note'],status:'owner-note'
   }));
  }
  for(const decision of raw.decisions||[]){
   if(!decision?.id)continue;
   const sourceId=decision.sourceTurnId||null;
   const sourceTurn=sourceId?dialogueById.get(String(sourceId)):null;
   const state=sourceTurn?'available':'stale';
   const sourceText=sourceTurn?clean(sourceTurn.transcript):'';
   rows.push(item({
    id:'meeting:'+raw.id+':decision:'+decision.id,sourceType:'meeting',sourceId:raw.id,
    subtype:'decision',at:Number(decision.at)||start,
    title:(raw.title||'Meeting')+' · Decision',
    text:[decision.note||'Owner marked a canonical meeting turn as a decision',
     sourceText?('Current source turn: '+sourceText):''].filter(Boolean).join(' · '),
    participantIds:roster,temporal:raw.status==='active'?'current-session':'historical',
    provenance:['meeting-metadata','owner-marked-canonical-turn',
     ...(sourceTurn?.transcriptState==='corrected'||sourceTurn?.transcriptEditedAt?['source-turn-corrected']:[])],
    references:sourceId?[ref('dialogue-turn',sourceId,state)]:[],
    status:state==='stale'?'source-unavailable':'decision',
    decisionLike:true
   }));
  }
  for(const action of raw.actionItems||[]){
   if(!action?.id||!clean(action.text))continue;
   const sourceId=action.sourceTurnId||null;
   const sourceState=sourceId&&dialogueIds.has(String(sourceId))?'available':'stale';
   const assignee=action.assigneeParticipantId||null;
   rows.push(item({
    id:'meeting:'+raw.id+':action:'+action.id,sourceType:'meeting',sourceId:raw.id,
    subtype:'action-item',at:Number(action.createdAt)||start,
    title:(raw.title||'Meeting')+' · Action item',text:action.text,
    participantId:assignee,participantIds:Array.from(new Set([...roster,...(assignee?[assignee]:[])])),
    temporal:raw.status==='active'?'current-session':'historical',
    provenance:['meeting-metadata','owner-action-item'],
    references:sourceId?[ref('dialogue-turn',sourceId,sourceState)]:[],
    status:String(action.status||'open')+(sourceId&&sourceState==='stale'?' · source-unavailable':'')
   }));
  }
 }

 for(const recording of Array.isArray(recordings)?recordings:[]){
  if(!recording?.id)continue;
  const start=Number(recording.startedAt)||0;
  const turnIds=Array.from(recording.transcriptTurnIds||[]).filter(Boolean).slice(0,500);
  const stale=turnIds.filter(id=>!dialogueIds.has(String(id)));
  const participantIds=[...new Set(turnIds.map(id=>dialogueById.get(String(id))?.participantId)
   .filter(Boolean))];
  const durationMs=Number.isFinite(recording.durationMs)?Math.max(0,recording.durationMs):null;
  rows.push(item({
   id:'recording:'+recording.id,sourceType:'recording',sourceId:recording.id,
   subtype:'saved-recording',at:start,title:'Saved room recording',
   text:[
    durationMs===null?'duration unavailable':Math.round(durationMs/1000)+' seconds',
    turnIds.length+' canonical transcript reference'+(turnIds.length===1?'':'s'),
    'media '+String(recording.mediaState||recording.status||'unknown')
   ].join(' · '),
   temporal:currentSession(recording.sessionId,currentSessionId,currentSessionIds)
    ?'current-session':'historical',
   participantIds,
   provenance:['canonical-recording-metadata','media-not-indexed','participant-scope-derived-from-canonical-turns'],
   references:turnIds.slice(0,12).map(id=>ref('dialogue-turn',id,
    dialogueIds.has(String(id))?'available':'stale')),
   status:String(recording.status||'unknown')+
    (stale.length?' · '+stale.length+' transcript reference'+(stale.length===1?'':'s')+' stale':'')
  }));
 }

 for(const task of Array.isArray(tasks)?tasks:[]){
  if(!task?.id)continue;
  const related=task.relatedEventId||null;
  const relatedState=related&&roomIds.has(String(related))?'available':'stale';
  const description=[
   task.skillId?String(task.skillId).replaceAll('_',' '):'agent task',
   task.targetId?'target '+task.targetId:'',
   task.resultText||task.errorText||''
  ].filter(Boolean).join(' · ');
  rows.push(item({
   id:'task:'+task.id,sourceType:'task',sourceId:task.id,subtype:'agent-task',
   at:Number(task.updatedAt||task.createdAt)||0,
   title:'Task · '+String(task.status||'unknown').toUpperCase(),text:description,
   temporal:'historical',provenance:['agent-task-metadata','owner-confirmed-execution-path'],
   references:related?[ref('room-event',related,relatedState)]:[],
   status:String(task.status||'unknown')+(related&&relatedState==='stale'?' · event-reference-stale':'')
  }));
 }

 const memorySourceRef=source=>{
  const id=String(source?.sourceId||'');if(!id)return ref('memory-source','missing','stale');
  let type='memory-source',current=null,text='',participantId=null,meetingId=source?.meetingId||null,at=null;
  if(source.kind==='dialogue'){
   type='dialogue-turn';current=dialogueById.get(id)||null;
   text=current?.transcript||'';participantId=current?.participantId||null;
   at=current?(atOf(current.createdAt)||Number(current.at)||0):null;
  }else if(source.kind==='room-event'){
   type='room-event';current=roomById.get(id)||null;
   text=current?.message||'';participantId=current?.participantId||null;
   at=current?Number(current.at)||0:null;
  }else if(source.kind==='meeting-note'){
   type='meeting-note';current=meetingNoteById.get(id)||null;
   text=current?.text||'';meetingId=current?.meetingId||meetingId;
   at=current?Number(current.at)||0:null;
  }else if(source.kind==='meeting-decision'){
   type='meeting-decision';current=meetingDecisionById.get(id)||null;
   text=current?.note||'';meetingId=current?.meetingId||meetingId;
   at=current?Number(current.at)||0:null;
  }
  if(!current)return ref(type,id,'stale');
  const fingerprint=memoryEvidenceFingerprint({
   kind:source.kind,sourceId:id,participantId,meetingId,at,text
  });
  const state=source.fingerprint&&fingerprint!==source.fingerprint?'changed':'available';
  return ref(type,id,state);
 };
 const activeMemoryRows=(Array.isArray(memories)?memories:[])
  .map(row=>{try{return normalizeMemoryRecord(row,now);}catch{return null;}})
  .filter(Boolean)
  .filter(row=>row.status==='active'&&!memoryExpired(row,now))
  .sort((a,b)=>b.updatedAt-a.updatedAt||b.createdAt-a.createdAt)
  .slice(0,200);
 for(const memory of activeMemoryRows){
  const approved=memory.provenance==='owner-approved-proposal';
  const memoryRefs=approved?(memory.sourceRefs||[]).slice(0,5).map(memorySourceRef):[];
  const staleCount=memoryRefs.filter(reference=>reference.state==='stale').length;
  const changedCount=memoryRefs.filter(reference=>reference.state==='changed').length;
  rows.push(item({
   id:'memory:'+memory.id,sourceType:'memory',sourceId:memory.id,subtype:memory.type,
   at:Number(memory.updatedAt||memory.createdAt)||0,
   title:'Owner memory · '+memory.type,text:memory.text,
   participantId:memory.participantId||null,
   participantIds:memory.participantId?[memory.participantId]:[],
   temporal:memory.persistent?'historical':'current-session',
   provenance:[
    approved?'owner-approved-evidence-memory':'owner-authored-memory',
    memory.persistent?'saved-on-device':'session-only',
    ...(approved?[String(memory.proposalMethod||'canonical-evidence-approval')]:[])
   ],
   references:memoryRefs,
   status:'active'+(staleCount?' · '+staleCount+' source reference'+(staleCount===1?'':'s')+' stale':'')+
    (changedCount?' · '+changedCount+' source reference'+(changedCount===1?'':'s')+' changed':'')
  }));
 }

 return Object.freeze(rows.sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id)));
}

function tokenize(value){
 return [...new Set(clean(value).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u)
  .map(token=>token.trim()).filter(Boolean).slice(0,16))];
}
function searchable(row){
 return [
  row.title,row.text,row.sourceType,row.subtype,row.status,
  ...(row.provenance||[])
 ].join(' ').toLocaleLowerCase();
}
export function recallRowAllowed(row,options={}){
 const source=RECALL_SOURCE_TYPES.includes(options.sourceType)?options.sourceType:'all';
 const participantId=options.participantId||null;
 const includeCurrent=options.includeCurrent!==false;
 const includeHistorical=options.includeHistorical!==false;
 const fromAt=options.fromAt!==null&&options.fromAt!==undefined&&finite(Number(options.fromAt))?Number(options.fromAt):null;
 const toAt=options.toAt!==null&&options.toAt!==undefined&&finite(Number(options.toAt))?Number(options.toAt):null;
 if(!sourceAllowed(row,source)||!participantAllowed(row,participantId))return false;
 if(row.temporal==='current-session'&&!includeCurrent)return false;
 if(row.temporal!=='current-session'&&!includeHistorical)return false;
 if(fromAt!==null&&Number(row.at||0)<fromAt)return false;
 if(toAt!==null&&Number(row.at||0)>toAt)return false;
 return true;
}
export function searchRecall(rows=[],query='',options={}){
 const tokens=tokenize(query);
 const limit=Math.max(1,Math.min(MAX_RECALL_RESULTS,Number(options.limit)||50));
 const matched=[];
 for(const row of Array.isArray(rows)?rows:[]){
  if(!recallRowAllowed(row,options))continue;
  const hay=searchable(row);
  if(tokens.length&&!tokens.every(token=>hay.includes(token)))continue;
  let score=0;
  const title=row.title.toLocaleLowerCase(),text=row.text.toLocaleLowerCase();
  for(const token of tokens){
   if(title.includes(token))score+=4;
   if(text.includes(token))score+=2;
   if(row.provenance.some(p=>p.toLocaleLowerCase().includes(token)))score+=1;
  }
  matched.push(Object.freeze({...row,matchTerms:Object.freeze(tokens),score}));
 }
 return Object.freeze(matched.sort((a,b)=>b.score-a.score||b.at-a.at||a.id.localeCompare(b.id)).slice(0,limit));
}

export function explainRecallResult(result){
 if(!result)return Object.freeze({summary:'Unavailable recall result.',references:Object.freeze([])});
 const stale=(result.references||[]).filter(reference=>reference.state==='stale');
 const changed=(result.references||[]).filter(reference=>reference.state==='changed');
 const sourceLabels={
  conversation:'canonical dialogue turn',room:'effective canonical ROOM event',
  meeting:'meeting metadata',recording:'saved recording metadata',
  task:'agent task metadata',memory:'active owner-authorized memory'
 };
 const temporal=result.temporal==='current-session'?'current session':'historical';
 const summary=(sourceLabels[result.sourceType]||result.sourceType)+' · '+temporal+
  ' · provenance: '+(result.provenance.join(', ')||'unspecified')+
  (stale.length?' · '+stale.length+' referenced source'+(stale.length===1?' is':'s are')+' unavailable':'')+
  (changed.length?' · '+changed.length+' referenced source'+(changed.length===1?' has':'s have')+' changed since approval':'');
 return Object.freeze({summary,references:Object.freeze([...(result.references||[])])});
}

import {projectRoomState} from './room-event-core.js';
import {activeMemories} from './agent-memory-core.js';

export const RECALL_SOURCE_TYPES=Object.freeze([
 'conversation','room','meeting','task','memory'
]);
export const MAX_RECALL_RESULTS=100;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const short=(value,max=500)=>clean(value).slice(0,max);
const atOf=value=>{
 if(finite(value))return value;
 const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?parsed:0;
};
const sourceAllowed=(source,filter)=>!filter||filter==='all'||source===filter;
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
  status:short(input.status,64)||null
 });
}

function currentSession(sessionId,currentSessionId){
 return Boolean(currentSessionId&&sessionId&&String(sessionId)===String(currentSessionId));
}

export function buildRecallProjection({
 dialogueTurns=[],roomEvents=[],meetings=[],tasks=[],memories=[],
 participants=[],currentSessionId=null,now=Date.now()
}={}){
 const people=new Map((participants||[]).filter(Boolean).map(person=>[person.id,person]));
 const dialogue=(Array.isArray(dialogueTurns)?dialogueTurns:[]).filter(turn=>turn?.id);
 const dialogueIds=new Set(dialogue.map(turn=>String(turn.id)));
 const roomProjection=projectRoomState(Array.isArray(roomEvents)?roomEvents:[]);
 const effectiveRoom=roomProjection.events||[];
 const roomIds=new Set(effectiveRoom.map(event=>String(event.id)));
 const rows=[];

 for(const turn of dialogue){
  const text=clean(turn.transcript);
  if(!text)continue;
  const pid=turn.participantId||null;
  const person=pid?people.get(pid):null;
  const createdAt=atOf(turn.createdAt)||Number(turn.at)||0;
  const provenance=['canonical-dialogue',
   String(turn.transcriptState||turn.transcriptEditedAt?'corrected':'final')];
  if(turn.transcriptSource)provenance.push('transcript:'+String(turn.transcriptSource));
  if(turn.associationState)provenance.push('speaker:'+String(turn.associationState));
  rows.push(item({
   id:'conversation:'+turn.id,sourceType:'conversation',sourceId:turn.id,
   subtype:'dialogue-turn',at:createdAt,
   title:pid?(person?.nickname||person?.name||turn.participantName||'Participant'):'Unknown speaker',
   text,participantId:pid,participantIds:pid?[pid]:[],
   temporal:currentSession(turn.sessionId,currentSessionId)?'current-session':'historical',
   provenance,
   references:[
    ...(turn.meetingId?[ref('meeting',turn.meetingId)]:[]),
    ...(turn.sessionId?[ref('session',turn.sessionId)]:[])
   ],
   status:turn.transcriptState||turn.transcriptEditedAt?'corrected':'final'
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
   temporal:currentSession(event.sessionId,currentSessionId)?'current-session':'historical',
   provenance:[
    'canonical-room-event',String(event.source||'local'),
    ...(event.correctedBy?['owner-corrected']:[])
   ],
   references:event.relatedEventId?[ref('room-event',event.relatedEventId,
    roomIds.has(String(event.relatedEventId))?'available':'stale')]:[],
   status:event.correctedBy?'corrected':event.kind||'observation'
  }));
 }

 for(const raw of Array.isArray(meetings)?meetings:[]){
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
   const state=sourceId&&dialogueIds.has(String(sourceId))?'available':'stale';
   rows.push(item({
    id:'meeting:'+raw.id+':decision:'+decision.id,sourceType:'meeting',sourceId:raw.id,
    subtype:'decision',at:Number(decision.at)||start,
    title:(raw.title||'Meeting')+' · Decision',
    text:decision.note||'Owner marked a canonical meeting turn as a decision',
    participantIds:roster,temporal:raw.status==='active'?'current-session':'historical',
    provenance:['meeting-metadata','owner-marked-canonical-turn'],
    references:sourceId?[ref('dialogue-turn',sourceId,state)]:[],
    status:state==='stale'?'source-unavailable':'decision'
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

 for(const memory of activeMemories(memories,{now,limit:200})){
  rows.push(item({
   id:'memory:'+memory.id,sourceType:'memory',sourceId:memory.id,subtype:memory.type,
   at:Number(memory.updatedAt||memory.createdAt)||0,
   title:'Owner memory · '+memory.type,text:memory.text,
   participantId:memory.participantId||null,
   participantIds:memory.participantId?[memory.participantId]:[],
   temporal:memory.persistent?'historical':'current-session',
   provenance:['owner-authored-memory',memory.persistent?'saved-on-device':'session-only'],
   status:'active'
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
export function searchRecall(rows=[],query='',options={}){
 const tokens=tokenize(query);
 const source=RECALL_SOURCE_TYPES.includes(options.sourceType)?options.sourceType:'all';
 const participantId=options.participantId||null;
 const limit=Math.max(1,Math.min(MAX_RECALL_RESULTS,Number(options.limit)||50));
 const includeCurrent=options.includeCurrent!==false;
 const includeHistorical=options.includeHistorical!==false;
 const matched=[];
 for(const row of Array.isArray(rows)?rows:[]){
  if(!sourceAllowed(row.sourceType,source)||!participantAllowed(row,participantId))continue;
  if(row.temporal==='current-session'&&!includeCurrent)continue;
  if(row.temporal!=='current-session'&&!includeHistorical)continue;
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
 const sourceLabels={
  conversation:'canonical dialogue turn',room:'effective canonical ROOM event',
  meeting:'meeting metadata',task:'agent task metadata',memory:'active owner-authored memory'
 };
 const temporal=result.temporal==='current-session'?'current session':'historical';
 const summary=(sourceLabels[result.sourceType]||result.sourceType)+' · '+temporal+
  ' · provenance: '+(result.provenance.join(', ')||'unspecified')+
  (stale.length?' · '+stale.length+' referenced source'+(stale.length===1?' is':'s are')+' unavailable':'');
 return Object.freeze({summary,references:Object.freeze([...(result.references||[])])});
}

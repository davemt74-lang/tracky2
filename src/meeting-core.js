// V0.11E standalone meeting-session metadata.
// Meetings reference canonical dialogue turns by meetingId/sourceTurnId. They never
// duplicate transcript text, open media devices, transcribe audio, or identify speakers.

export const MEETING_SCHEMA=1;
export const MEETING_AGENT_POLICIES=Object.freeze(['listen-only','when-addressed']);
export const MAX_MEETING_ROSTER_EVENTS=160;
export const MAX_MEETING_NOTES=120;
export const MAX_MEETING_DECISIONS=120;
export const MAX_MEETING_ACTION_ITEMS=160;

const short=(value,max=240)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value,96)))];
const identifier=prefix=>globalThis.crypto?.randomUUID?.()||
 prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const finite=value=>typeof value==='number'&&Number.isFinite(value);

export function normalizeMeetingRecord(input={}){
 const id=short(input.id||identifier('meeting'),96);
 if(!id)throw new TypeError('Meeting id required.');
 const status=input.status==='ended'?'ended':'active';
 const startedAt=finite(input.startedAt)?input.startedAt:Date.now();
 const endedAt=status==='ended'&&finite(input.endedAt)?Math.max(startedAt,input.endedAt):null;
 const agentPolicy=MEETING_AGENT_POLICIES.includes(input.agentPolicy)
  ? input.agentPolicy : 'listen-only';
 const rosterEvents=(Array.isArray(input.rosterEvents)?input.rosterEvents:[])
  .filter(event=>event&&['joined','left'].includes(event.type)&&event.participantId)
  .slice(-MAX_MEETING_ROSTER_EVENTS)
  .map(event=>Object.freeze({
   type:event.type,participantId:short(event.participantId,96),
   at:finite(event.at)?event.at:startedAt
  }));
 const notes=(Array.isArray(input.notes)?input.notes:[]).slice(-MAX_MEETING_NOTES)
  .map(note=>Object.freeze({
   id:short(note.id||identifier('note'),96),text:short(note.text,800),
   at:finite(note.at)?note.at:startedAt,provenance:'owner-note'
  })).filter(note=>note.text);
 const decisions=(Array.isArray(input.decisions)?input.decisions:[]).slice(-MAX_MEETING_DECISIONS)
  .map(decision=>Object.freeze({
   id:short(decision.id||identifier('decision'),96),
   sourceTurnId:short(decision.sourceTurnId,96)||null,
   note:short(decision.note,500)||null,
   at:finite(decision.at)?decision.at:startedAt,
   provenance:'owner-marked-canonical-turn'
  })).filter(decision=>decision.sourceTurnId);
 const actionItems=(Array.isArray(input.actionItems)?input.actionItems:[])
  .slice(-MAX_MEETING_ACTION_ITEMS)
  .map(item=>Object.freeze({
   id:short(item.id||identifier('action'),96),
   text:short(item.text,800),
   sourceTurnId:short(item.sourceTurnId,96)||null,
   assigneeParticipantId:short(item.assigneeParticipantId,96)||null,
   assigneeDeleted:item.assigneeDeleted===true,
   status:item.status==='done'?'done':'open',
   createdAt:finite(item.createdAt)?item.createdAt:startedAt,
   completedAt:item.status==='done'&&finite(item.completedAt)?item.completedAt:null,
   provenance:'owner-action-item'
  })).filter(item=>item.text);
 return Object.freeze({
  id,schemaVersion:MEETING_SCHEMA,title:short(input.title||'Meeting',120)||'Meeting',
  sessionId:short(input.sessionId,96)||null,
  status,startedAt,endedAt,agentPolicy,
  rosterParticipantIds:Object.freeze(uniq(input.rosterParticipantIds)),
  activeParticipantIds:Object.freeze(uniq(input.activeParticipantIds)),
  currentUnverifiedCount:Math.max(0,Math.floor(Number(input.currentUnverifiedCount)||0)),
  peakUnverifiedCount:Math.max(0,Math.floor(Number(input.peakUnverifiedCount)||0)),
  rosterEvents:Object.freeze(rosterEvents),
  notes:Object.freeze(notes),decisions:Object.freeze(decisions),
  actionItems:Object.freeze(actionItems),
  updatedAt:finite(input.updatedAt)?input.updatedAt:startedAt
 });
}

export function createMeetingRecord({
 title='Meeting',agentPolicy='listen-only',sessionId=null
}={},now=Date.now()){
 return normalizeMeetingRecord({
  id:identifier('meeting'),title,agentPolicy,sessionId,status:'active',
  startedAt:now,updatedAt:now
 });
}

export function meetingTurnFields(meeting){
 const record=meeting&&meeting.status==='active'?meeting:null;
 return Object.freeze({
  meetingId:record?.id||null,
  meetingSchemaVersion:record?MEETING_SCHEMA:null
 });
}

export function updateMeetingRoster(meeting,{
 participantIds=[],unverifiedCount=0
}={},at=Date.now()){
 const current=normalizeMeetingRecord(meeting);
 if(current.status!=='active')return Object.freeze({meeting:current,events:Object.freeze([])});
 const nextIds=uniq(participantIds).sort();
 const priorIds=[...current.activeParticipantIds].sort();
 const prior=new Set(priorIds),next=new Set(nextIds);
 const events=[];
 for(const id of nextIds)if(!prior.has(id))events.push(Object.freeze({type:'joined',participantId:id,at}));
 for(const id of priorIds)if(!next.has(id))events.push(Object.freeze({type:'left',participantId:id,at}));
 const allRoster=uniq([...current.rosterParticipantIds,...nextIds]);
 const unknown=Math.max(0,Math.floor(Number(unverifiedCount)||0));
 const nextMeeting=normalizeMeetingRecord({
  ...current,rosterParticipantIds:allRoster,activeParticipantIds:nextIds,
  currentUnverifiedCount:unknown,
  peakUnverifiedCount:Math.max(current.peakUnverifiedCount,unknown),
  rosterEvents:[...current.rosterEvents,...events].slice(-MAX_MEETING_ROSTER_EVENTS),
  updatedAt:at
 });
 return Object.freeze({meeting:nextMeeting,events:Object.freeze(events)});
}

export function setMeetingAgentPolicy(meeting,policy,at=Date.now()){
 if(!MEETING_AGENT_POLICIES.includes(policy))throw new TypeError('Invalid meeting agent policy.');
 return normalizeMeetingRecord({...meeting,agentPolicy:policy,updatedAt:at});
}

export function addMeetingNote(meeting,text,at=Date.now()){
 const value=short(text,800);
 if(!value)throw new TypeError('Meeting note required.');
 return normalizeMeetingRecord({...meeting,notes:[...meeting.notes,{
  id:identifier('note'),text:value,at,provenance:'owner-note'
 }],updatedAt:at});
}

export function addMeetingDecision(meeting,sourceTurnId,{note=''}={},at=Date.now()){
 const turnId=short(sourceTurnId,96);
 if(!turnId)throw new TypeError('Canonical source turn required.');
 if(meeting.decisions.some(item=>item.sourceTurnId===turnId))return normalizeMeetingRecord(meeting);
 return normalizeMeetingRecord({...meeting,decisions:[...meeting.decisions,{
  id:identifier('decision'),sourceTurnId:turnId,note:short(note,500)||null,at,
  provenance:'owner-marked-canonical-turn'
 }],updatedAt:at});
}

export function addMeetingActionItem(meeting,{
 text,sourceTurnId=null,assigneeParticipantId=null
}={},at=Date.now()){
 const value=short(text,800);
 if(!value)throw new TypeError('Action item text required.');
 return normalizeMeetingRecord({...meeting,actionItems:[...meeting.actionItems,{
  id:identifier('action'),text:value,sourceTurnId:short(sourceTurnId,96)||null,
  assigneeParticipantId:short(assigneeParticipantId,96)||null,
  status:'open',createdAt:at,provenance:'owner-action-item'
 }],updatedAt:at});
}

export function setMeetingActionStatus(meeting,id,status,at=Date.now()){
 if(!['open','done'].includes(status))throw new TypeError('Invalid action status.');
 const target=short(id,96);let found=false;
 const actionItems=meeting.actionItems.map(item=>{
  if(item.id!==target)return item;
  found=true;return {...item,status,completedAt:status==='done'?at:null};
 });
 if(!found)throw new Error('Meeting action item not found.');
 return normalizeMeetingRecord({...meeting,actionItems,updatedAt:at});
}

export function endMeetingRecord(meeting,at=Date.now()){
 const current=normalizeMeetingRecord(meeting);
 if(current.status==='ended')return current;
 return normalizeMeetingRecord({...current,status:'ended',
  endedAt:Math.max(current.startedAt,at),activeParticipantIds:[],
  currentUnverifiedCount:0,updatedAt:at});
}

export function meetingTurns(meetingId,turns=[]){
 const id=short(meetingId,96);
 if(!id)return Object.freeze([]);
 return Object.freeze((Array.isArray(turns)?turns:[])
  .filter(turn=>turn?.meetingId===id)
  .sort((a,b)=>(Date.parse(a.createdAt||'')||a.at||0)-(Date.parse(b.createdAt||'')||b.at||0)));
}

export function meetingSummary(meeting,turns=[],participants=[]){
 const record=normalizeMeetingRecord(meeting);
 const rows=meetingTurns(record.id,turns);
 const people=new Map((participants||[]).map(person=>[person.id,person]));
 const verifiedSpeakerIds=uniq(rows.filter(turn=>
  turn.participantId&&turn.attribution!=='unknown').map(turn=>turn.participantId));
 const unknownTurnCount=rows.filter(turn=>!turn.participantId||turn.attribution==='unknown').length;
 const transcriptCount=rows.filter(turn=>String(turn.transcript||'').trim()).length;
 const openActions=record.actionItems.filter(item=>item.status==='open').length;
 const durationEnd=record.endedAt??Date.now();
 return Object.freeze({
  meetingId:record.id,sessionId:record.sessionId,title:record.title,status:record.status,
  startedAt:record.startedAt,endedAt:record.endedAt,
  durationMs:Math.max(0,durationEnd-record.startedAt),
  rosterParticipantIds:record.rosterParticipantIds,
  rosterNames:Object.freeze(record.rosterParticipantIds.map(id=>
   people.get(id)?.nickname||people.get(id)?.name||'Deleted participant')),
  peakUnverifiedCount:record.peakUnverifiedCount,
  turnCount:rows.length,transcriptCount,
  verifiedSpeakerIds:Object.freeze(verifiedSpeakerIds),
  unknownTurnCount,
  decisionCount:record.decisions.length,
  noteCount:record.notes.length,
  actionItemCount:record.actionItems.length,
  openActionItemCount:openActions,
  completedActionItemCount:record.actionItems.length-openActions
 });
}

export function meetingAgentReplyPolicy(meeting,turn={}){
 if(meeting?.status==='active'){
  if(turn.meetingId!==meeting.id)
   return Object.freeze({allow:false,reason:'turn predates or is outside active meeting'});
  if(meeting.agentPolicy==='listen-only')
   return Object.freeze({allow:false,reason:'meeting listen-only'});
  if(meeting.agentPolicy==='when-addressed')
   return turn.addressedAgent===true
    ? Object.freeze({allow:true,reason:'meeting AGENT explicitly addressed'})
    : Object.freeze({allow:false,reason:'meeting requires explicit AGENT address'});
  return Object.freeze({allow:false,reason:'meeting policy unavailable'});
 }
 if(turn.meetingId)
  return Object.freeze({allow:false,reason:'meeting no longer active; late reply suppressed'});
 return Object.freeze({allow:true,reason:'no-active-meeting'});
}

export function scrubMeetingParticipant(meeting,participantId,at=Date.now()){
 const id=short(participantId,96);
 if(!id)return normalizeMeetingRecord(meeting);
 const scrubEvent=event=>event.participantId===id?null:event;
 const scrubAction=item=>item.assigneeParticipantId===id
  ? {...item,assigneeParticipantId:null,assigneeDeleted:true}:item;
 return normalizeMeetingRecord({
  ...meeting,
  rosterParticipantIds:meeting.rosterParticipantIds.filter(value=>value!==id),
  activeParticipantIds:meeting.activeParticipantIds.filter(value=>value!==id),
  rosterEvents:meeting.rosterEvents.map(scrubEvent).filter(Boolean),
  actionItems:meeting.actionItems.map(scrubAction),
  updatedAt:at
 });
}

import {
 listDialogueTurns,listRoomObservations,listAgentTasks,listAgentMemories,listMeetings,
 listRecordings,listSessionIdentities
} from './participant-store.js';
import {buildRecallProjection,searchRecall,explainRecallResult} from './session-recall-core.js';
import {
 buildSessionIdentityTimeline,normalizeSessionIdentity,
 sessionIdentityExport,sessionIdentitySummary
} from './session-identity-core.js';

const byId=rows=>{
 const map=new Map();
 for(const row of rows||[])if(row?.id)map.set(String(row.id),row);
 return [...map.values()];
};
const when=at=>Number(at)>0?new Date(Number(at)).toLocaleString():'Time unavailable';
const sourceLabel=value=>({
 conversation:'Conversation',room:'ROOM',meeting:'Meeting',
 session:'Session',recording:'Recording',task:'Task',memory:'Owner memory'
})[value]||String(value||'Source');

export function createSessionRecallUi({
 participants=()=>[],
 getCurrentRoomEvents=()=>[],
 getSessionMemories=()=>[],
 getAgentHistory=()=>[],
 currentSessionIds=()=>[],
 currentSessionStartedAt=()=>0
}={}){
 const $=id=>document.getElementById(id);
 const ui={
  form:$('agentRecallForm'),query:$('agentRecallQuery'),source:$('agentRecallSource'),
  participant:$('agentRecallParticipant'),temporal:$('agentRecallTemporal'),
  recent:$('agentRecallRecent'),refresh:$('agentRecallRefresh'),
  status:$('agentRecallStatus'),results:$('agentRecallResults'),
  sessionSelect:$('agentSessionTimelineSelect'),
  sessionRefresh:$('agentSessionTimelineRefresh'),
  sessionExport:$('agentSessionTimelineExport'),
  sessionStatus:$('agentSessionTimelineStatus'),
  sessionTimeline:$('agentSessionTimeline')
 };
 let lastRows=[],lastSearch={query:'',sourceType:'all',participantId:null,temporal:'all'};

 function setStatus(message){if(ui.status)ui.status.textContent=message;}
 function participantOptions(){
  if(!ui.participant)return;
  const prior=ui.participant.value;
  ui.participant.replaceChildren(new Option('All participants',''));
  for(const person of participants()||[])
   ui.participant.add(new Option(person.nickname||person.name||person.id,person.id));
  ui.participant.value=(participants()||[]).some(person=>person.id===prior)?prior:'';
 }
 function participantNames(ids=[]){
  const people=new Map((participants()||[]).map(person=>[person.id,person.nickname||person.name||person.id]));
  return [...new Set(ids.filter(Boolean))].map(id=>people.get(id)||'Deleted participant');
 }
 async function projection(){
  const [dialogue,persistedRoom,tasks,persistedMemories,meetings,recordings]=await Promise.all([
   listDialogueTurns(),listRoomObservations(),listAgentTasks(),listAgentMemories(),listMeetings(),
   listRecordings()
  ]);
  const room=byId([...(persistedRoom||[]),...(getCurrentRoomEvents()||[])]);
  const memories=byId([...(persistedMemories||[]),...(getSessionMemories()||[])]);
  return buildRecallProjection({
   dialogueTurns:dialogue,agentHistory:getAgentHistory()||[],roomEvents:room,
   meetings,recordings,tasks,memories,participants:participants()||[],
   currentSessionIds:currentSessionIds()||[],
   currentSessionStartedAt:Number(currentSessionStartedAt())||0,
   now:Date.now()
  });
 }
 function sessionIdNow(){
  return String((currentSessionIds()||[])[0]||'');
 }
 function setSessionStatus(message){
  if(ui.sessionStatus)ui.sessionStatus.textContent=message;
 }
 function renderSessionTimeline(rows,summary){
  if(!ui.sessionTimeline)return;
  ui.sessionTimeline.replaceChildren();
  if(!rows.length){
   const empty=document.createElement('p');empty.className='agent-recall-empty';
   empty.textContent='No canonical records are available for this session.';
   ui.sessionTimeline.append(empty);return;
  }
  for(const row of rows.slice(-120).reverse()){
   const card=document.createElement('article');card.className='agent-recall-result';
   card.dataset.source=row.sourceType;card.dataset.subtype=row.subtype||'event';
   const head=document.createElement('div');head.className='agent-recall-result-head';
   const title=document.createElement('strong');title.textContent=row.title||sourceLabel(row.sourceType);
   const badge=document.createElement('span');badge.textContent=
    sourceLabel(row.sourceType)+' · '+(row.subtype||row.status||'event');
   head.append(title,badge);
   const body=document.createElement('p');body.textContent=row.text||'Metadata event';
   const meta=document.createElement('small');
   const people=participantNames(row.participantIds);
   meta.textContent=when(row.at)+(row.status?' · '+row.status:'')+
    (row.roomId?' · room '+row.roomId:'')+
    (people.length?' · '+people.join(', '):'');
   card.append(head,body,meta);
   if((row.references||[]).length){
    const refs=document.createElement('small');
    refs.textContent='References · '+row.references.map(ref=>
     ref.type+':'+ref.id+' ['+ref.state+']').join(' · ');
    card.append(refs);
   }
   ui.sessionTimeline.append(card);
  }
  if(summary?.staleReferenceCount){
   setSessionStatus(summary.itemCount+' timeline items · '+
    summary.staleReferenceCount+' stale reference'+
    (summary.staleReferenceCount===1?'':'s')+' reported explicitly');
  }
 }
 async function refreshSessionTimeline(){
  if(!ui.sessionTimeline)return false;
  setSessionStatus('Reading canonical session sources…');
  try{
   const [dialogue,persistedRoom,meetings,recordings,sessions]=await Promise.all([
    listDialogueTurns(),listRoomObservations(),listMeetings(),listRecordings(),
    listSessionIdentities()
   ]);
   const currentId=sessionIdNow();
   const prior=ui.sessionSelect?.value||currentId;
   if(ui.sessionSelect){
    ui.sessionSelect.replaceChildren();
    for(const record of sessions){
     const label=(record.id===currentId?'Current · ':'')+
      new Date(record.startedAt).toLocaleString()+' · '+record.status;
     ui.sessionSelect.add(new Option(label,record.id));
    }
    if(currentId&&!sessions.some(record=>record.id===currentId))
     ui.sessionSelect.add(new Option('Current session',currentId));
    ui.sessionSelect.value=[...ui.sessionSelect.options].some(option=>option.value===prior)
     ?prior:(currentId||sessions[0]?.id||'');
   }
   const selectedId=ui.sessionSelect?.value||currentId;
   if(!selectedId){
    ui.sessionTimeline.replaceChildren();
    setSessionStatus('No canonical session metadata is available yet.');
    return false;
   }
   const session=sessions.find(record=>record.id===selectedId)||
    normalizeSessionIdentity({
     id:selectedId,status:'active',
     startedAt:Number(currentSessionStartedAt())||Date.now(),
     runtimeScope:'agent-room'
    });
   const currentRoom=selectedId===currentId?(getCurrentRoomEvents()||[]):[];
   const room=byId([...(persistedRoom||[]),...currentRoom]);
   const rows=buildSessionIdentityTimeline({
    session,dialogueTurns:dialogue,roomEvents:room,meetings,
    recordings,participants:participants()||[]
   });
   const summary=sessionIdentitySummary(rows);
   renderSessionTimeline(rows,summary);
   if(!summary.staleReferenceCount)setSessionStatus(
    rows.length+' timeline item'+(rows.length===1?'':'s')+
    ' · rebuilt from canonical sources · no media duplicated'
   );
   return {session,rows,summary};
  }catch(error){
   console.error('Session timeline failed',error);
   setSessionStatus('Session timeline unavailable: '+error.message);
   return false;
  }
 }
 async function exportSessionTimeline(){
  const projection=await refreshSessionTimeline();
  if(!projection)return false;
  const payload=sessionIdentityExport(projection.rows,projection.session);
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='tracky2-session-'+projection.session.id+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),0);
  setSessionStatus(payload.itemCount+' timeline items exported · metadata/text only · no audio/video/biometrics');
  return true;
 }

 function searchOptions(){
  const temporal=ui.temporal?.value||'all';
  return {
   sourceType:ui.source?.value||'all',
   participantId:ui.participant?.value||null,
   includeCurrent:temporal!=='historical',
   includeHistorical:temporal!=='current-session',
   limit:60
  };
 }
 function render(rows){
  if(!ui.results)return;
  ui.results.replaceChildren();
  if(!rows.length){
   const empty=document.createElement('p');empty.className='agent-recall-empty';
   empty.textContent='No canonical/local records match this recall search.';
   ui.results.append(empty);return;
  }
  for(const result of rows){
   const card=document.createElement('article');card.className='agent-recall-result';
   card.dataset.source=result.sourceType;card.dataset.subtype=result.subtype;
   const head=document.createElement('div');head.className='agent-recall-result-head';
   const title=document.createElement('strong');title.textContent=result.title||sourceLabel(result.sourceType);
   const badge=document.createElement('span');badge.textContent=sourceLabel(result.sourceType)+' · '+result.subtype;
   head.append(title,badge);
   const body=document.createElement('p');body.textContent=result.text;
   const meta=document.createElement('small');
   const people=participantNames(result.participantIds);
   meta.textContent=when(result.at)+' · '+result.temporal+
    (result.status?' · '+result.status:'')+(people.length?' · '+people.join(', '):'');
   const why=document.createElement('details');why.className='agent-recall-why';
   const summary=document.createElement('summary');summary.textContent='Why this result';
   const explain=explainRecallResult(result);
   const explanation=document.createElement('p');explanation.textContent=explain.summary;
   why.append(summary,explanation);
   if(explain.references.length){
    const refs=document.createElement('ul');
    for(const reference of explain.references){
     const li=document.createElement('li');
     li.textContent=reference.type+' · '+reference.id+' · '+reference.state;
     refs.append(li);
    }
    why.append(refs);
   }
   card.append(head,body,meta,why);ui.results.append(card);
  }
 }
 async function run({recent=false}={}){
  if(!ui.form)return false;
  setStatus('Reading canonical/local sources…');
  try{
   participantOptions();
   lastRows=await projection();
   const query=recent?'':String(ui.query?.value||'').trim();
   const options=searchOptions();
   const rows=searchRecall(lastRows,query,options);
   lastSearch={query,sourceType:options.sourceType,participantId:options.participantId,
    temporal:ui.temporal?.value||'all'};
   render(rows);
   setStatus(rows.length+' result'+(rows.length===1?'':'s')+
    ' · generated live from '+lastRows.length+' current canonical/local references · no search index saved');
   return true;
  }catch(error){
   console.error('Recall search failed',error);
   setStatus('Recall unavailable: '+error.message);
   return false;
  }
 }
 async function init(){
  if(!ui.form)return false;
  participantOptions();
  ui.form.addEventListener('submit',event=>{event.preventDefault();void run();});
  ui.recent?.addEventListener('click',()=>void run({recent:true}));
  ui.refresh?.addEventListener('click',()=>{
   if(ui.query)ui.query.value=lastSearch.query||ui.query.value;
   void run({recent:!String(ui.query?.value||'').trim()});
  });
  ui.sessionRefresh?.addEventListener('click',()=>void refreshSessionTimeline());
  ui.sessionSelect?.addEventListener('change',()=>void refreshSessionTimeline());
  ui.sessionExport?.addEventListener('click',()=>void exportSessionTimeline());
  setStatus('Recall is ready. No persistent search index is created.');
  void refreshSessionTimeline();
  return true;
 }
 return {
  init,search:run,refreshParticipants:participantOptions,
  refreshTimeline:refreshSessionTimeline,
  lastProjection:()=>[...lastRows]
 };
}

import {
 addMeetingActionItem,addMeetingDecision,addMeetingNote,createMeetingRecord,
 endMeetingRecord,meetingAgentReplyPolicy,meetingSummary,meetingTurnFields,meetingTurns,
 setMeetingActionStatus,setMeetingAgentPolicy,updateMeetingRoster
} from './meeting-core.js';
import {
 deleteMeeting,getActiveMeeting,listDialogueTurns,listMeetings,saveMeeting
} from './participant-store.js';

export function createMeetingUi({
 participants=()=>[],recordEvent=()=>null,onChange=()=>{},sessionId=()=>null
}={}){
 const $=id=>document.getElementById(id);
 const ui={
  startForm:$('meetingStartForm'),title:$('meetingTitle'),startPolicy:$('meetingStartPolicy'),
  start:$('meetingStart'),end:$('meetingEnd'),activePolicy:$('meetingAgentPolicy'),
  status:$('meetingStatus'),elapsed:$('meetingElapsed'),roster:$('meetingRoster'),
  summary:$('meetingSummary'),turns:$('meetingTurns'),history:$('meetingHistory'),
  noteForm:$('meetingNoteForm'),note:$('meetingNote'),notes:$('meetingNotes'),
  decisionForm:$('meetingDecisionForm'),decisionTurn:$('meetingDecisionTurn'),
  decisionNote:$('meetingDecisionNote'),decisions:$('meetingDecisions'),
  actionForm:$('meetingActionForm'),actionText:$('meetingActionText'),
  actionTurn:$('meetingActionTurn'),actionAssignee:$('meetingActionAssignee'),
  actions:$('meetingActions'),message:$('meetingMessage'),refresh:$('meetingRefresh')
 };
 let active=null,selected=null,records=[],allTurns=[],ready=false,timer=null,lastRosterSignature='';
 const names=()=>new Map((participants()||[]).map(p=>[p.id,p.nickname||p.name||p.id]));
 const message=text=>{if(ui.message)ui.message.textContent=text;};
 const selectedMeeting=()=>records.find(row=>row.id===selected)||active||records[0]||null;

 async function reload(){
  [records,allTurns]=await Promise.all([listMeetings(),listDialogueTurns()]);
  active=records.find(row=>row.status==='active')||null;
  if(active)selected=active.id;
  else if(selected&&!records.some(row=>row.id===selected))selected=records[0]?.id||null;
  render();
  onChange(active);
 }
 function meetingTurnsFor(record){return record?meetingTurns(record.id,allTurns):[];}
 function participantName(id){return names().get(id)||'Deleted participant';}
 function formatAt(at){return Number.isFinite(at)?new Date(at).toLocaleString():'Unknown time';}
 function duration(ms){
  const seconds=Math.max(0,Math.floor(Number(ms)||0)/1000);
  const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),secs=Math.floor(seconds%60);
  return (hours?hours+'h ':'')+(minutes?minutes+'m ':'')+secs+'s';
 }
 function option(select,value,label){
  const item=document.createElement('option');item.value=value;item.textContent=label;select.append(item);
 }
 function turnLabel(turn){
  const speaker=turn.participantId?participantName(turn.participantId):'Unknown speaker';
  const text=String(turn.transcript||'').trim();
  return speaker+' · '+(text?text.slice(0,90):'[no transcript text]');
 }
 function renderSelectors(record,turns){
  for(const select of [ui.decisionTurn,ui.actionTurn]){
   if(!select)continue;
   const prior=select.value;select.replaceChildren();option(select,'','Choose canonical meeting turn');
   for(const turn of turns)option(select,turn.id,turnLabel(turn));
   if(turns.some(turn=>turn.id===prior))select.value=prior;
  }
  if(ui.actionAssignee){
   const prior=ui.actionAssignee.value;ui.actionAssignee.replaceChildren();
   option(ui.actionAssignee,'','Unassigned');
   for(const id of record?.rosterParticipantIds||[])option(ui.actionAssignee,id,participantName(id));
   if((record?.rosterParticipantIds||[]).includes(prior))ui.actionAssignee.value=prior;
  }
 }
 function renderRoster(record){
  if(!ui.roster)return;ui.roster.replaceChildren();
  if(!record){ui.roster.textContent='No active or selected meeting.';return;}
  for(const id of record.rosterParticipantIds){
   const row=document.createElement('span');row.textContent=participantName(id)+
    (record.activeParticipantIds.includes(id)?' · present':' · left');ui.roster.append(row);
  }
  if(record.peakUnverifiedCount){
   const unknown=document.createElement('span');
   unknown.textContent='Unverified people observed · peak '+record.peakUnverifiedCount+
    (record.status==='active'?' · current '+record.currentUnverifiedCount:'');
   ui.roster.append(unknown);
  }
  if(!ui.roster.children.length)ui.roster.textContent='No verified participants observed yet.';
 }
 function renderSummary(record,turns){
  if(!ui.summary)return;ui.summary.replaceChildren();
  if(!record){ui.summary.textContent='Start or select a meeting to see its summary.';return;}
  const summary=meetingSummary(record,turns,participants());
  const rows=[
   ['STATUS',summary.status.toUpperCase()],
   ['DURATION',duration(summary.durationMs)],
   ['ROSTER',summary.rosterNames.join(', ')||'No verified roster'],
   ['TRANSCRIPTS',String(summary.transcriptCount)],
   ['UNKNOWN TURNS',String(summary.unknownTurnCount)],
   ['DECISIONS',String(summary.decisionCount)],
   ['ACTION ITEMS',summary.openActionItemCount+' open · '+summary.completedActionItemCount+' done']
  ];
  for(const [key,value] of rows){
   const item=document.createElement('article');const label=document.createElement('span');
   const strong=document.createElement('strong');label.textContent=key;strong.textContent=value;
   item.append(label,strong);ui.summary.append(item);
  }
 }
 function renderTurns(record,turns){
  if(!ui.turns)return;ui.turns.replaceChildren();
  if(!record||!turns.length){ui.turns.textContent='Canonical meeting transcripts appear here as accepted turns are saved.';return;}
  for(const turn of turns.slice(-40).reverse()){
   const row=document.createElement('article');row.className='meeting-turn';
   const top=document.createElement('strong');top.textContent=turn.participantId?participantName(turn.participantId):'Unknown speaker';
   const text=document.createElement('p');text.textContent=turn.transcript||'[transcription unavailable]';
   const meta=document.createElement('small');
   meta.textContent=formatAt(Date.parse(turn.createdAt||'')||turn.at)+' · '+
    String(turn.turnOwnership||'unverified-speaker')+' · '+String(turn.attentionTarget||'unknown');
   row.append(top,text,meta);ui.turns.append(row);
  }
 }
 function renderNotes(record){
  if(!ui.notes)return;ui.notes.replaceChildren();
  for(const note of (record?.notes||[]).slice().reverse()){
   const row=document.createElement('article');row.className='meeting-meta-row';
   const text=document.createElement('p');text.textContent=note.text;
   const meta=document.createElement('small');meta.textContent='OWNER NOTE · '+formatAt(note.at);
   row.append(text,meta);ui.notes.append(row);
  }
  if(!ui.notes.children.length)ui.notes.textContent='No owner notes.';
 }
 function sourceTurnText(record,turnId){
  const turn=meetingTurnsFor(record).find(item=>item.id===turnId);
  return turn?turnLabel(turn):'Canonical source turn unavailable';
 }
 function renderDecisions(record){
  if(!ui.decisions)return;ui.decisions.replaceChildren();
  for(const decision of (record?.decisions||[]).slice().reverse()){
   const row=document.createElement('article');row.className='meeting-meta-row';
   const title=document.createElement('strong');title.textContent=decision.note||'Owner marked decision';
   const source=document.createElement('p');source.textContent=sourceTurnText(record,decision.sourceTurnId);
   const meta=document.createElement('small');meta.textContent='SOURCE TURN '+decision.sourceTurnId+' · '+formatAt(decision.at);
   row.append(title,source,meta);ui.decisions.append(row);
  }
  if(!ui.decisions.children.length)ui.decisions.textContent='No decisions marked.';
 }
 function renderActions(record){
  if(!ui.actions)return;ui.actions.replaceChildren();
  for(const item of (record?.actionItems||[]).slice().reverse()){
   const row=document.createElement('article');row.className='meeting-meta-row';row.dataset.status=item.status;
   const title=document.createElement('strong');title.textContent=item.text;
   const meta=document.createElement('small');
   meta.textContent=item.status.toUpperCase()+' · '+
    (item.assigneeParticipantId?participantName(item.assigneeParticipantId):
      item.assigneeDeleted?'Deleted participant':'Unassigned')+
    (item.sourceTurnId?' · source '+item.sourceTurnId:'');
   row.append(title,meta);
   if(record?.status==='active'){
    const button=document.createElement('button');button.type='button';
    button.textContent=item.status==='open'?'Mark done':'Reopen';
    button.addEventListener('click',()=>void mutate(current=>
     setMeetingActionStatus(current,item.id,item.status==='open'?'done':'open',Date.now()),
     'Action item status updated.'));
    row.append(button);
   }
   ui.actions.append(row);
  }
  if(!ui.actions.children.length)ui.actions.textContent='No action items.';
 }
 function renderHistory(){
  if(!ui.history)return;ui.history.replaceChildren();
  for(const meeting of records){
   const row=document.createElement('article');row.className='meeting-history-row';
   if(meeting.id===selected)row.dataset.selected='true';
   const title=document.createElement('strong');title.textContent=meeting.title;
   const meta=document.createElement('small');
   meta.textContent=meeting.status.toUpperCase()+' · '+formatAt(meeting.startedAt)+' · '+
    meeting.rosterParticipantIds.length+' verified roster';
   const view=document.createElement('button');view.type='button';view.textContent='View';
   view.addEventListener('click',()=>{selected=meeting.id;render();});
   row.append(title,meta,view);
   if(meeting.status==='ended'){
    const del=document.createElement('button');del.type='button';del.textContent='Delete meeting metadata';
    del.addEventListener('click',async()=>{
     if(!window.confirm('Delete this meeting metadata? Canonical transcripts are not deleted.'))return;
     try{await deleteMeeting(meeting.id);message('Meeting metadata deleted. Canonical transcripts remain.');await reload();}
     catch(error){message('Meeting delete failed: '+error.message);}
    });
    row.append(del);
   }
   ui.history.append(row);
  }
  if(!ui.history.children.length)ui.history.textContent='No saved meetings yet.';
 }
 function render(){
  const record=selectedMeeting(),turns=meetingTurnsFor(record);
  if(ui.status)ui.status.textContent=active
   ? 'ACTIVE · '+active.title+' · '+active.agentPolicy
   : record?'Viewing ended meeting · '+record.title:'No active meeting';
  if(ui.elapsed)ui.elapsed.textContent=record?duration((record.endedAt??Date.now())-record.startedAt):'—';
  if(ui.startForm)ui.startForm.hidden=Boolean(active);
  if(ui.end)ui.end.hidden=!active;
  if(ui.activePolicy){ui.activePolicy.disabled=!active;ui.activePolicy.value=active?.agentPolicy||'listen-only';}
  for(const form of [ui.noteForm,ui.decisionForm,ui.actionForm])if(form)form.hidden=!active;
  renderRoster(record);renderSummary(record,turns);renderTurns(record,turns);
  renderSelectors(record,turns);renderNotes(record);renderDecisions(record);renderActions(record);renderHistory();
 }
 async function mutate(transform,success){
  if(!active)return;
  try{
   const next=transform(active);
   const saved=await saveMeeting(next);active=saved;
   records=records.map(row=>row.id===saved.id?saved:row);selected=saved.id;
   message(success);render();onChange(active);
  }catch(error){message(error.message||'Meeting update failed.');}
 }
 async function init(){
  if(!ui.startForm)return false;
  try{await reload();ready=true;}
  catch(error){message('Meeting storage unavailable: '+error.message);return false;}
  ui.startForm.addEventListener('submit',async event=>{
   event.preventDefault();if(!ready||active)return;
   try{
    const created=createMeetingRecord({
      title:ui.title.value,agentPolicy:ui.startPolicy.value,sessionId:sessionId()
    },Date.now());
    const saved=await saveMeeting(created);active=saved;selected=saved.id;records=[saved,...records.filter(x=>x.id!==saved.id)];
    lastRosterSignature='';ui.title.value='';
    recordEvent('decision','Meeting started: '+saved.title,'meeting-runtime',{kind:'action',semantic:'meeting-started'});
    message('Meeting started. Existing camera/audio/transcription pipelines are reused.');render();onChange(active);
   }catch(error){message('Meeting start failed: '+error.message);}
  });
  ui.end?.addEventListener('click',async()=>{
   if(!active)return;
   await mutate(current=>endMeetingRecord(current,Date.now()),'Meeting ended. Post-meeting summary is derived from canonical turns.');
   const ended=active;active=null;lastRosterSignature='';
   if(ended)recordEvent('decision','Meeting ended: '+ended.title,'meeting-runtime',{kind:'outcome',semantic:'meeting-ended'});
   await reload();
  });
  ui.activePolicy?.addEventListener('change',()=>void mutate(current=>
   setMeetingAgentPolicy(current,ui.activePolicy.value,Date.now()),'Meeting AGENT policy updated.'));
  ui.noteForm?.addEventListener('submit',event=>{
   event.preventDefault();const value=ui.note.value;ui.note.value='';
   void mutate(current=>addMeetingNote(current,value,Date.now()),'Owner note added.');
  });
  ui.decisionForm?.addEventListener('submit',event=>{
   event.preventDefault();const turnId=ui.decisionTurn.value,note=ui.decisionNote.value;ui.decisionNote.value='';
   void mutate(current=>addMeetingDecision(current,turnId,{note},Date.now()),'Decision marked with canonical turn provenance.');
  });
  ui.actionForm?.addEventListener('submit',event=>{
   event.preventDefault();
   const spec={text:ui.actionText.value,sourceTurnId:ui.actionTurn.value||null,
    assigneeParticipantId:ui.actionAssignee.value||null};
   ui.actionText.value='';
   void mutate(current=>addMeetingActionItem(current,spec,Date.now()),'Action item added.');
  });
  ui.refresh?.addEventListener('click',()=>void reload());
  timer=setInterval(()=>{if(active){renderSummary(active,meetingTurnsFor(active));if(ui.elapsed)ui.elapsed.textContent=duration(Date.now()-active.startedAt);}},1000);
  return true;
 }
 async function updateRoster(tracks=[]){
  if(!ready||!active)return false;
  const current=(Array.isArray(tracks)?tracks:[]).filter(track=>track?.id&&!['occluded','reacquiring'].includes(track.status));
  const ids=[...new Set(current.map(track=>track.participantId).filter(Boolean))].sort();
  const unverified=current.filter(track=>!track.participantId).length;
  const signature=ids.join('|')+'#'+unverified;
  if(signature===lastRosterSignature)return false;
  lastRosterSignature=signature;
  const result=updateMeetingRoster(active,{participantIds:ids,unverifiedCount:unverified},Date.now());
  try{
   const saved=await saveMeeting(result.meeting);active=saved;records=records.map(row=>row.id===saved.id?saved:row);
   for(const event of result.events)recordEvent('presence',
    'Meeting roster · '+participantName(event.participantId)+' '+event.type,
    'meeting-runtime',{participantId:event.participantId,semantic:'meeting-roster'});
   render();onChange(active);return true;
  }catch(error){lastRosterSignature='';message('Meeting roster save failed: '+error.message);return false;}
 }
 async function refreshTurns(){
  if(!ready)return;
  try{allTurns=await listDialogueTurns();render();}
  catch(error){message('Meeting transcript refresh failed: '+error.message);}
 }
 function refreshParticipants(){if(ready)render();}
 return {
  init,render,updateRoster,refreshTurns,refreshParticipants,
  activeMeeting:()=>active,
  turnFields:()=>meetingTurnFields(active),
  replyPolicy:turn=>meetingAgentReplyPolicy(active,turn),
  destroy(){if(timer)clearInterval(timer);timer=null;ready=false;}
 };
}

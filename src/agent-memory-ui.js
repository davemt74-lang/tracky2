import {
 AgentMemoryLedger,MEMORY_TYPES,memoryExpired,sessionContextReferences
} from './agent-memory-core.js';
import {listAgentMemories,saveAgentMemory,deleteAgentMemory} from './participant-store.js';

export function createAgentMemoryUi({
 participants=()=>[],getDialogueTurns=()=>[],getRoomEvents=()=>[],onAudit=()=>null,onChanged=()=>{}
}={}){
 const $=id=>document.getElementById(id);
 const ui={
  form:$('agentMemoryForm'),person:$('agentMemoryParticipant'),type:$('agentMemoryType'),
  text:$('agentMemoryText'),persist:$('agentMemoryPersist'),expiry:$('agentMemoryExpiry'),
  list:$('agentMemoryList'),context:$('agentSessionContext'),status:$('agentMemoryStatus'),
  showRevoked:$('agentMemoryShowRevoked'),refresh:$('agentMemoryRefreshContext')
 };
 const ledger=new AgentMemoryLedger();let ready=false;
 const setStatus=text=>{if(ui.status)ui.status.textContent=text;};
 const names=()=>new Map((participants()||[]).map(p=>[p.id,p.nickname||p.name||p.id]));
 function participantOptions(){
  if(!ui.person)return;
  const prior=ui.person.value;ui.person.replaceChildren(new Option('Room / general context',''));
  for(const p of participants()||[])ui.person.add(new Option(p.nickname||p.name||p.id,p.id));
  ui.person.value=(participants()||[]).some(p=>p.id===prior)?prior:'';
 }
 function expiryAt(now){
  const days=Number(ui.expiry?.value||0);
  return days>0?now+days*86400000:null;
 }
 function scopeLabel(memory){
  return memory.participantId?(names().get(memory.participantId)||'Deleted participant'):'Room / general';
 }
 async function persistIfNeeded(memory){
  if(!memory.persistent)return memory;
  try{return await saveAgentMemory(memory);}
  catch(error){setStatus('Memory changed in this session, but local save failed: '+error.message);return memory;}
 }
 function renderContext(){
  if(!ui.context)return;
  const pid=ui.person?.value||null;
  const refs=sessionContextReferences({
   dialogueTurns:getDialogueTurns(),roomEvents:getRoomEvents(),participantId:pid,limit:8
  });
  ui.context.replaceChildren();
  if(!refs.length){
   const empty=document.createElement('p');empty.textContent='No matching current-session canonical context.';
   ui.context.append(empty);return;
  }
  for(const ref of refs){
   const row=document.createElement('article');row.className='agent-session-context-row';
   const label=document.createElement('strong');label.textContent=ref.label;
   const text=document.createElement('p');text.textContent=ref.text;
   const meta=document.createElement('small');
   meta.textContent='CURRENT SESSION · '+ref.kind+(ref.at?' · '+new Date(ref.at).toLocaleTimeString([],{
    hour:'2-digit',minute:'2-digit'}):'');
   row.append(label,text,meta);ui.context.append(row);
  }
 }
 function render(){
  if(!ui.list)return;
  participantOptions();ui.list.replaceChildren();
  const now=Date.now(),showRevoked=ui.showRevoked?.checked===true;
  const rows=ledger.entries().slice().sort((a,b)=>b.updatedAt-a.updatedAt);
  const visible=rows.filter(m=>showRevoked||m.status==='active');
  if(!visible.length){
   const empty=document.createElement('p');empty.className='agent-memory-empty';
   empty.textContent='No owner-authored memories in this view.';ui.list.append(empty);
  }
  for(const memory of visible){
   const row=document.createElement('article');row.className='agent-memory-row';
   row.dataset.status=memory.status;
   const heading=document.createElement('strong');
   heading.textContent=scopeLabel(memory)+' · '+memory.type;
   const body=document.createElement('p');body.textContent=memory.text;
   const meta=document.createElement('small');
   const expiry=memory.expiresAt?new Date(memory.expiresAt).toLocaleDateString():'no expiry';
   meta.textContent='HISTORICAL OWNER MEMORY · '+(memory.persistent?'saved on device':'session only')+
    ' · '+expiry+(memoryExpired(memory,now)?' · EXPIRED':'')+
    (memory.revisions.length?' · '+memory.revisions.length+' revision'+(memory.revisions.length===1?'':'s'):'')+
    (memory.status==='revoked'?' · REVOKED':'');
   row.append(heading,body,meta);
   const actions=document.createElement('div');actions.className='agent-memory-actions';
   if(memory.status==='active'&&!memoryExpired(memory,now)){
    const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';
    edit.addEventListener('click',async()=>{
     const revised=window.prompt('Revise this owner-authored memory:',memory.text);
     if(revised===null)return;
     try{
      const next=ledger.revise(memory.id,revised,Date.now());if(!next)return;
      await persistIfNeeded(next);
      onAudit('Owner revised historical memory',next);
      setStatus('Memory revised; previous wording retained in local revision history.');
      render();onChanged();
     }catch(error){setStatus(error.message);}
    });
    const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revoke';
    revoke.addEventListener('click',async()=>{
     const reason=window.prompt('Why revoke this memory?','No longer accurate');
     if(reason===null)return;
     const next=ledger.revoke(memory.id,reason,Date.now());if(!next)return;
     await persistIfNeeded(next);
     onAudit('Owner revoked historical memory',next);
     setStatus('Memory revoked. It is no longer supplied to AGENT.');
     render();onChanged();
    });
    actions.append(edit,revoke);
   }
   const del=document.createElement('button');del.type='button';del.textContent='Delete';
   del.addEventListener('click',async()=>{
    if(!window.confirm('Permanently delete this owner-authored memory?'))return;
    if(memory.persistent)await deleteAgentMemory(memory.id).catch(error=>setStatus('Delete failed: '+error.message));
    if(ledger.delete(memory.id)){
     onAudit('Owner deleted historical memory',memory);
     setStatus('Memory deleted.');render();onChanged();
    }
   });
   actions.append(del);row.append(actions);ui.list.append(row);
  }
  renderContext();
 }
 async function init(){
  if(!ui.form)return false;
  try{ledger.restore(await listAgentMemories());ready=true;}
  catch(error){setStatus('Memory storage unavailable: '+error.message);return false;}
  ui.type.replaceChildren(...MEMORY_TYPES.map(type=>new Option(type[0].toUpperCase()+type.slice(1),type)));
  participantOptions();render();
  ui.form.addEventListener('submit',async event=>{
   event.preventDefault();if(!ready)return;
   try{
    const now=Date.now(),memory=ledger.add({
     participantId:ui.person.value||null,type:ui.type.value,text:ui.text.value,
     expiresAt:expiryAt(now),persistent:ui.persist.checked
    },now);
    await persistIfNeeded(memory);
    onAudit('Owner added historical memory',memory);
    setStatus(memory.persistent?'Memory saved locally on this device.':'Session-only memory added.');
    ui.text.value='';render();onChanged();
   }catch(error){setStatus(error.message);}
  });
  ui.person.addEventListener('change',renderContext);
  ui.showRevoked?.addEventListener('change',render);
  ui.refresh?.addEventListener('click',renderContext);
  return true;
 }
 function syncParticipants(){
  const valid=new Set((participants()||[]).map(p=>p.id));
  for(const memory of ledger.entries()){
   if(memory.participantId&&!valid.has(memory.participantId))ledger.delete(memory.id);
  }
  if(ready)render();
 }
 return {init,render,refreshParticipants:syncParticipants,contextFor:(participantId)=>
  ledger.contextFor(participantId,Date.now()),getMemories:()=>ledger.entries()};
}

import {
 AgentMemoryLedger,MEMORY_TYPES,memoryExpired,sessionContextReferences
} from './agent-memory-core.js';
import {
 MemoryProposalLedger,approvedMemoryFromProposal,reviewMemoryProposal,
 validateMemoryProposalSources,situationalPatternEvidence
} from './agent-memory-learning-core.js';
import {
 listAgentMemories,saveAgentMemory,saveApprovedMemoryProposal,deleteAgentMemory
} from './participant-store.js';

export function createAgentMemoryUi({
 participants=()=>[],getDialogueTurns=()=>[],getRoomEvents=()=>[],getMeetings=()=>[],
 getSituationalAwareness=()=>({events:[],feedback:[]}),
 onAudit=()=>null,onChanged=()=>{}
}={}){
 const $=id=>document.getElementById(id);
 const ui={
  form:$('agentMemoryForm'),person:$('agentMemoryParticipant'),type:$('agentMemoryType'),
  text:$('agentMemoryText'),persist:$('agentMemoryPersist'),expiry:$('agentMemoryExpiry'),
  list:$('agentMemoryList'),context:$('agentSessionContext'),status:$('agentMemoryStatus'),
  showRevoked:$('agentMemoryShowRevoked'),refresh:$('agentMemoryRefreshContext'),
  proposals:$('agentMemoryProposalList'),scan:$('agentMemoryScanProposals')
 };
 const ledger=new AgentMemoryLedger(),proposalLedger=new MemoryProposalLedger();let ready=false;
 const setStatus=text=>{if(ui.status)ui.status.textContent=text;};
 const names=()=>new Map((participants()||[]).map(p=>[p.id,p.nickname||p.name||p.id]));
 const evidence=()=>({
  dialogueTurns:getDialogueTurns()||[],roomEvents:getRoomEvents()||[],meetings:getMeetings()||[],
  situationalPatterns:situationalPatternEvidence(getSituationalAwareness()||{})
 });
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
 function proposalExpiryAt(select,now){
  const days=Number(select?.value||0);return days>0?now+days*86400000:null;
 }
 function scopeLabel(memory){
  return memory.participantId?(names().get(memory.participantId)||'Deleted participant'):'Room / general';
 }
 async function persistIfNeeded(memory){
  if(!memory.persistent)return true;
  await saveAgentMemory(memory);return true;
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
 function reviewLabel(review){
  if(review.state==='contradiction')return 'POSSIBLE CONTRADICTION · '+review.contradictionIds.length+' active memory';
  if(review.state==='duplicate')return 'POSSIBLE DUPLICATE · '+review.duplicateIds.length+' active memory';
  if(review.state==='related')return 'RELATED MEMORY FOUND';
  return 'NO MEMORY CONFLICT FOUND';
 }
 function sourceLabel(ref){
  return ({dialogue:'Canonical dialogue', 'room-event':'Owner ROOM decision',
   'meeting-note':'Owner meeting note','meeting-decision':'Owner-marked meeting decision',
   'situational-pattern':'Adaptive situational pattern'})[ref.kind]||ref.kind;
 }
 async function approveProposal(proposal,{text,type,expiry}){
  const valid=validateMemoryProposalSources(proposal,evidence());
  if(!valid.valid){
   proposalLedger.remove(proposal.id);renderProposals();
   setStatus('Proposal source changed or was deleted. It was not saved. Scan evidence again.');
   return;
  }
  const draft={...proposal,text:text.value,type:type.value};
  const review=reviewMemoryProposal(draft,ledger.entries());
  if(review.duplicateIds.length){
   setStatus('This proposal duplicates active owner memory. Edit it or dismiss it instead of saving a duplicate.');
   return;
  }
  if(review.contradictionIds.length&&!window.confirm(
   'This proposal conflicts with '+review.contradictionIds.length+
   ' active memory record(s). Approve it and revoke those conflicting memories?'))return;
  const now=Date.now();
  try{
   const memory=approvedMemoryFromProposal(proposal,{
    text:text.value,type:type.value,participantId:proposal.participantId,
    expiresAt:proposalExpiryAt(expiry,now),persistent:true,now
   });
   const result=await saveApprovedMemoryProposal(memory,{
    revokeIds:review.contradictionIds,at:now,
    reason:'Superseded by owner-approved canonical-evidence memory'
   });
   for(const id of review.contradictionIds)ledger.revoke(id,
    'Superseded by owner-approved canonical-evidence memory',now);
   ledger.add({...result.memory,persistent:true},now);
   proposalLedger.remove(proposal.id);
   onAudit('Owner approved canonical-evidence memory proposal',memory);
   setStatus(review.contradictionIds.length
    ?'Proposal saved; conflicting owner memory was revoked in the same local transaction.'
    :'Proposal saved as durable owner-approved memory.');
   render();onChanged();
  }catch(error){setStatus('Proposal was not saved: '+error.message);}
 }
 function renderProposals(){
  if(!ui.proposals)return;
  ui.proposals.replaceChildren();
  const rows=proposalLedger.entries();
  if(!rows.length){
   const empty=document.createElement('p');empty.className='agent-memory-empty';
   empty.textContent='No pending memory proposals. Proposals are session-only until you approve one.';
   ui.proposals.append(empty);return;
  }
  for(const proposal of rows){
   const row=document.createElement('article');row.className='agent-memory-row agent-memory-proposal';
   const heading=document.createElement('strong');
   heading.textContent=(proposal.participantId?(names().get(proposal.participantId)||'Participant'):'Room / general')+
    ' · PROPOSED '+proposal.type.toUpperCase();
   const text=document.createElement('textarea');text.rows=2;text.maxLength=500;text.value=proposal.text;
   text.setAttribute('aria-label','Edit proposed memory before approval');
   const controls=document.createElement('div');controls.className='agent-memory-actions';
   const type=document.createElement('select');type.setAttribute('aria-label','Proposal memory type');
   for(const value of ['preference','note'])type.add(new Option(value[0].toUpperCase()+value.slice(1),value));
   type.value=proposal.type;
   const expiry=document.createElement('select');expiry.setAttribute('aria-label','Proposal expiry');
   for(const [value,label] of [['0','Never expires'],['1','1 day'],['7','7 days'],['30','30 days'],['90','90 days']])
    expiry.add(new Option(label,value));
   if(String(proposal.method||'').startsWith('adaptive-'))expiry.value='90';
   const review=document.createElement('small');review.className='agent-memory-proposal-review';
   review.textContent=reviewLabel(reviewMemoryProposal(proposal,ledger.entries()));
   const sources=document.createElement('div');sources.className='agent-session-context';
   for(const ref of proposal.sourceRefs){
    const source=document.createElement('article');source.className='agent-session-context-row';
    const label=document.createElement('strong');label.textContent=sourceLabel(ref);
    const excerpt=document.createElement('p');excerpt.textContent=ref.excerpt;
    const meta=document.createElement('small');meta.textContent='SOURCE ID · '+ref.sourceId+
     (ref.at?' · '+new Date(ref.at).toLocaleString():'');
    source.append(label,excerpt,meta);sources.append(source);
   }
   const approve=document.createElement('button');approve.type='button';approve.textContent='Approve & save';
   approve.addEventListener('click',()=>void approveProposal(proposal,{text,type,expiry}));
   const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss';
   dismiss.addEventListener('click',()=>{
    proposalLedger.dismiss(proposal.id);renderProposals();setStatus('Proposal dismissed for this page session.');
   });
   controls.append(type,expiry,approve,dismiss);
   row.append(heading,text,review,sources,controls);ui.proposals.append(row);
  }
 }
 function refreshProposals({announce=false}={}){
  if(!ready)return [];
  proposalLedger.scan(evidence());renderProposals();
  if(announce)setStatus(proposalLedger.entries().length
   ?proposalLedger.entries().length+' reviewable memory proposal(s) found. Nothing is saved until you approve.'
   :'No eligible explicit or repeated adaptive memory patterns found.');
  return proposalLedger.entries();
 }
 function render(){
  if(!ui.list)return;
  participantOptions();ui.list.replaceChildren();
  const now=Date.now(),showRevoked=ui.showRevoked?.checked===true;
  const rows=ledger.entries().slice().sort((a,b)=>b.updatedAt-a.updatedAt);
  const visible=rows.filter(m=>showRevoked||m.status==='active');
  if(!visible.length){
   const empty=document.createElement('p');empty.className='agent-memory-empty';
   empty.textContent='No owner-authorized memories in this view.';ui.list.append(empty);
  }
  for(const memory of visible){
   const row=document.createElement('article');row.className='agent-memory-row';row.dataset.status=memory.status;
   const heading=document.createElement('strong');heading.textContent=scopeLabel(memory)+' · '+memory.type;
   const body=document.createElement('p');body.textContent=memory.text;
   const meta=document.createElement('small');
   const expiry=memory.expiresAt?new Date(memory.expiresAt).toLocaleDateString():'no expiry';
   const provenance=memory.provenance==='owner-approved-proposal'
    ?'OWNER-APPROVED EVIDENCE MEMORY · '+memory.sourceRefs.length+' source ref'+(memory.sourceRefs.length===1?'':'s')
    :'HISTORICAL OWNER MEMORY';
   meta.textContent=provenance+' · '+(memory.persistent?'saved on device':'session only')+
    ' · '+expiry+(memoryExpired(memory,now)?' · EXPIRED':'')+
    (memory.revisions.length?' · '+memory.revisions.length+' revision'+(memory.revisions.length===1?'':'s'):'')+
    (memory.status==='revoked'?' · REVOKED':'');
   row.append(heading,body,meta);
   const actions=document.createElement('div');actions.className='agent-memory-actions';
   if(memory.status==='active'&&!memoryExpired(memory,now)){
    const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';
    edit.addEventListener('click',async()=>{
     const revised=window.prompt('Revise this owner-authorized memory:',memory.text);
     if(revised===null)return;
     try{
      const before=memory,next=ledger.revise(memory.id,revised,Date.now());if(!next)return;
      try{await persistIfNeeded(next);}
      catch(error){ledger.replace(before);setStatus('Revision not saved: '+error.message);render();return;}
      onAudit('Owner revised historical memory',next);
      setStatus('Memory revised; previous wording retained in local revision history.');
      render();onChanged();
     }catch(error){setStatus(error.message);}
    });
    const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revoke';
    revoke.addEventListener('click',async()=>{
     const reason=window.prompt('Why revoke this memory?','No longer accurate');
     if(reason===null)return;
     const before=memory,next=ledger.revoke(memory.id,reason,Date.now());if(!next)return;
     try{await persistIfNeeded(next);}
     catch(error){ledger.replace(before);setStatus('Revocation not saved: '+error.message);render();return;}
     onAudit('Owner revoked historical memory',next);
     setStatus('Memory revoked. It is no longer supplied to AGENT.');
     render();onChanged();
    });
    actions.append(edit,revoke);
   }
   const del=document.createElement('button');del.type='button';del.textContent='Delete';
   del.addEventListener('click',async()=>{
    if(!window.confirm('Permanently delete this owner-authorized memory?'))return;
    if(memory.persistent){
     try{await deleteAgentMemory(memory.id);}
     catch(error){setStatus('Delete failed; memory remains active locally: '+error.message);return;}
    }
    if(ledger.delete(memory.id)){
     onAudit('Owner deleted historical memory',memory);
     setStatus('Memory deleted.');render();onChanged();
    }
   });
   actions.append(del);row.append(actions);ui.list.append(row);
  }
  renderContext();renderProposals();
 }
 async function init(){
  if(!ui.form)return false;
  try{ledger.restore(await listAgentMemories());ready=true;}
  catch(error){setStatus('Memory storage unavailable: '+error.message);return false;}
  ui.type.replaceChildren(...MEMORY_TYPES.map(type=>new Option(type[0].toUpperCase()+type.slice(1),type)));
  participantOptions();render();refreshProposals();
  ui.form.addEventListener('submit',async event=>{
   event.preventDefault();if(!ready)return;
   try{
    const now=Date.now(),memory=ledger.add({
     participantId:ui.person.value||null,type:ui.type.value,text:ui.text.value,
     expiresAt:expiryAt(now),persistent:ui.persist.checked
    },now);
    try{await persistIfNeeded(memory);}
    catch(error){ledger.delete(memory.id);setStatus('Memory was not added because local save failed: '+error.message);render();return;}
    onAudit('Owner added historical memory',memory);
    setStatus(memory.persistent?'Memory saved locally on this device.':'Session-only memory added.');
    ui.text.value='';render();onChanged();
   }catch(error){setStatus(error.message);}
  });
  ui.person.addEventListener('change',renderContext);
  ui.showRevoked?.addEventListener('change',render);
  ui.refresh?.addEventListener('click',renderContext);
  ui.scan?.addEventListener('click',()=>refreshProposals({announce:true}));
  return true;
 }
 function syncParticipants(){
  const valid=new Set((participants()||[]).map(p=>p.id));
  for(const memory of ledger.entries()){
   if(memory.participantId&&!valid.has(memory.participantId))ledger.delete(memory.id);
  }
  if(ready){refreshProposals();render();}
 }
 return {
  init,render,refreshParticipants:syncParticipants,refreshProposals,
  contextFor:(participantId)=>ledger.contextFor(participantId,Date.now()),
  getMemories:()=>ledger.entries(),getProposals:()=>proposalLedger.entries()
 };
}

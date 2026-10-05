import {AGENT_SKILLS,AgentTaskQueue,executeRegisteredTask} from './agent-task-core.js';
import {localSkillTarget,nonReadOnlyScheduleAllowed} from './governed-skill-core.js';
import {executeServerProductSearch,loadServerSkillTargets} from './governed-skill-client.js';
import {listAgentTasks,saveAgentTask,deleteAgentTask} from './participant-store.js';

export function createAgentTaskUi({
 getScene=()=>({areas:[],objects:[]}),recordEvent=()=>null,
 captureImage=null,productSearch=executeServerProductSearch,
 cameraActive=()=>false,documentVisible=()=>!document.hidden,
 loadServerTargets=loadServerSkillTargets
}={}){
 const $=id=>document.getElementById(id);
 const ui={
  form:$('agentTaskForm'),skill:$('agentTaskSkill'),target:$('agentTaskTarget'),
  runAt:$('agentTaskRunAt'),list:$('agentTaskList'),status:$('agentTaskStatus'),
  clear:$('agentTaskClearDone'),refresh:$('agentTaskRefreshObjects')
 };
 const queue=new AgentTaskQueue(),running=new Set();
 let timer=null,ready=false,serverTargets=[];
 const setStatus=text=>{if(ui.status)ui.status.textContent=text;};
 const persist=task=>saveAgentTask(task).catch(error=>{
  console.warn('Task metadata save failed',error);setStatus('Task changed in memory, but local persistence failed.');
 });
 function localTargets(){
  const scene=getScene?.()||{},rows=[];
  for(const object of Array.isArray(scene.objects)?scene.objects:[]){
   const target=localSkillTarget(scene,object.id);if(target)rows.push(target);
  }
  return rows;
 }
 function allTargets(){return [...localTargets(),...serverTargets];}
 function targetFor(source,id){return allTargets().find(t=>t.targetSource===source&&t.id===id)||null;}
 function eligibleTargets(skillId){
  return allTargets().filter(target=>target.approved&&target.enabledSkills.includes(skillId)&&
   (AGENT_SKILLS[skillId]?.targetSources||[]).includes(target.targetSource));
 }
 function encodedTarget(target){return target.targetSource+'|'+target.id;}
 function decodedTarget(value){
  const [source,id]=String(value||'').split('|');
  return {targetSource:source==='server-approved'?'server-approved':'local-owner-defined',targetId:id||''};
 }
 function refreshTargetsOnly(){
  if(!ui.target)return;
  const selected=ui.target.value,skillId=ui.skill?.value||'describe_object';
  ui.target.replaceChildren(new Option('Choose approved object',''));
  for(const target of eligibleTargets(skillId)){
   const option=new Option(target.name+' · '+target.kind+' · '+
    (target.targetSource==='server-approved'?'server approved':'local owner-defined'),encodedTarget(target));
   ui.target.add(option);
  }
  if([...ui.target.options].some(option=>option.value===selected))ui.target.value=selected;
 }
 function refreshSelectors(){
  if(!ui.skill||!ui.target)return;
  const selected=ui.skill.value||'describe_object';
  ui.skill.replaceChildren();
  for(const skill of Object.values(AGENT_SKILLS)){
   const option=new Option(skill.label,skill.id);ui.skill.add(option);
  }
  ui.skill.value=AGENT_SKILLS[selected]?selected:'describe_object';refreshTargetsOnly();
 }
 async function refreshServerInventory({announce=false}={}){
  try{
   const result=await loadServerTargets();serverTargets=result?.available?[...(result.targets||[])]:[];
   refreshSelectors();
   if(announce)setStatus(result?.available
    ?'Approved self-hosted objects and local grants refreshed.'
    :'Self-hosted approved-object inventory unavailable; local governed skills remain available.');
  }catch(error){
   serverTargets=[];refreshSelectors();
   if(announce)setStatus('Self-hosted skill inventory unavailable: '+error.message);
  }
 }
 function taskTarget(task){return targetFor(task.targetSource,task.targetId);}
 function taskSummary(task){
  const skill=AGENT_SKILLS[task.skillId],target=taskTarget(task);
  return (skill?.label||task.skillId)+' · '+(target?.name||task.targetId||'no target')+
   (task.targetSource==='server-approved'?' · server approved':' · local');
 }
 function button(text,aria,handler){
  const b=document.createElement('button');b.type='button';b.textContent=text;
  if(aria)b.setAttribute('aria-label',aria);b.addEventListener('click',handler);return b;
 }
 function render(){
  if(!ui.list)return;
  refreshSelectors();ui.list.replaceChildren();
  const tasks=queue.entries().slice().reverse();
  if(!tasks.length){
   const empty=document.createElement('p');empty.className='agent-task-empty';
   empty.textContent='No governed agent tasks yet.';ui.list.append(empty);return;
  }
  for(const task of tasks){
   const skill=AGENT_SKILLS[task.skillId];
   const row=document.createElement('article');row.className='agent-task-row';row.dataset.status=task.status;
   const title=document.createElement('strong');title.textContent=taskSummary(task);
   const meta=document.createElement('small');
   const scheduled=new Date(task.runAt).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
   meta.textContent=task.status.toUpperCase()+' · '+skill.sideEffect+' · '+task.attempts+'/'+task.maxAttempts+
    ' attempts · '+scheduled;
   row.append(title,meta);
   if(task.resultText){const result=document.createElement('p');result.textContent=task.resultText;row.append(result);}
   if(task.resultSources?.length){
    const links=document.createElement('div');links.className='agent-task-sources';
    for(const source of task.resultSources){
     const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
     link.textContent=source.title||source.url;links.append(link);
    }row.append(links);
   }
   if(task.executionProvenance){
    const provenance=document.createElement('small');provenance.textContent=
     'Execution · '+task.executionProvenance.skillVersion+' · '+task.executionProvenance.targetSource+
     (task.executionProvenance.provider?' · '+task.executionProvenance.provider:'');
    row.append(provenance);
   }
   if(task.errorText){const error=document.createElement('p');error.className='agent-task-error';error.textContent=task.errorText;row.append(error);}
   const actions=document.createElement('div');actions.className='agent-task-actions';
   if(task.status==='pending-confirmation'){
    actions.append(button('Confirm','Confirm '+taskSummary(task),()=>{
     const next=queue.confirm(task.id,Date.now());if(!next)return;
     persist(next);recordEvent('decision','Owner confirmed agent task '+taskSummary(next),
      'agent-task-runtime',{kind:'decision',semantic:'agent-task-confirmed'});
     render();
     if(skill.sideEffect==='read-only')void executeDue();
     else void executeOne(next.id,{ownerAction:true});
    }));
    actions.append(button('Cancel','Cancel '+taskSummary(task),()=>cancel(task.id)));
   }else if(task.status==='scheduled'){
    actions.append(button(skill.sideEffect==='read-only'?'Run now':'Run now · owner action',
     'Run '+taskSummary(task)+' now',()=>{
      const next=queue.runNow(task.id,Date.now());
      if(next){persist(next);render();void executeOne(next.id,{ownerAction:true});}
     }));
    actions.append(button('Cancel','Cancel '+taskSummary(task),()=>cancel(task.id)));
   }
   if(actions.children.length)row.append(actions);ui.list.append(row);
  }
 }
 function cancel(id){
  const next=queue.cancel(id,Date.now());if(!next)return;
  persist(next);recordEvent('decision','Owner cancelled agent task '+taskSummary(next),
   'agent-task-runtime',{kind:'decision',semantic:'agent-task-cancelled'});render();
 }
 async function executeOne(id,{ownerAction=false}={}){
  if(running.has(id))return;running.add(id);
  try{
   const started=queue.start(id,Date.now());if(!started)return;
   await persist(started);
   const actionEvent=recordEvent('decision','Executing approved task '+taskSummary(started),
    'agent-task-runtime',{kind:'action',semantic:'agent-task-action'});
   try{
    if(started.targetSource==='server-approved')await refreshServerInventory();
    const result=await executeRegisteredTask(started,{
     scene:getScene?.(),serverTargets,explicitOwnerAction:ownerAction,
     cameraActive:cameraActive()===true,documentVisible:documentVisible()===true,
     captureImage,productSearch,now:Date.now()
    });
    const done=queue.succeed(id,result,Date.now(),actionEvent?.id||null);
    if(done){
     await persist(done);
     recordEvent('decision','Task completed: '+done.resultText,'agent-task-runtime',{
      kind:'outcome',semantic:'agent-task-outcome',relatedEventId:actionEvent?.id||null
     });
     setStatus('Governed task completed.');
    }
   }catch(error){
    const failed=queue.fail(id,error,{retryable:error?.retryable===true,now:Date.now(),
     relatedEventId:actionEvent?.id||null});
    if(failed){
     await persist(failed);
     recordEvent('decision',(failed.status==='scheduled'?'Task retry scheduled: ':'Task failed: ')+failed.errorText,
      'agent-task-runtime',{kind:'outcome',semantic:'agent-task-outcome',relatedEventId:actionEvent?.id||null});
     setStatus(failed.status==='scheduled'?'Task failed temporarily; retry scheduled.':'Task failed.');
    }
   }
  }finally{running.delete(id);render();}
 }
 async function executeDue(){
  if(!ready)return;
  for(const task of queue.due(Date.now())){
   const skill=AGENT_SKILLS[task.skillId];
   if(skill?.sideEffect==='read-only')await executeOne(task.id,{ownerAction:false});
  }
 }
 async function init(){
  if(!ui.form)return false;
  try{queue.restore(await listAgentTasks());ready=true;}
  catch(error){setStatus('Local task storage unavailable: '+error.message);return false;}
  await refreshServerInventory();refreshSelectors();render();
  ui.skill.addEventListener('change',refreshTargetsOnly);
  ui.form.addEventListener('submit',event=>{
   event.preventDefault();if(!ready)return;
   const skill=AGENT_SKILLS[ui.skill.value];if(!skill){setStatus('Skill unavailable.');return;}
   const target=decodedTarget(ui.target.value);
   const runAt=ui.runAt.value?Date.parse(ui.runAt.value):Date.now(),now=Date.now();
   if(skill.sideEffect!=='read-only'&&!nonReadOnlyScheduleAllowed(skill.id,runAt,now)){
    setStatus('Media capture and external search cannot be background-scheduled. Create them for immediate owner confirmation.');
    return;
   }
   try{
    const created=queue.create({skillId:skill.id,targetId:target.targetId,targetSource:target.targetSource,
     runAt:Number.isFinite(runAt)?runAt:now},now);
    if(!created.created){setStatus('An equivalent active task already exists.');return;}
    persist(created.task);
    recordEvent('decision','Agent task proposed: '+taskSummary(created.task),
     'agent-task-runtime',{kind:'decision',semantic:'agent-task-proposed'});
    setStatus(skill.sideEffect==='read-only'
     ?'Task created. Confirm it before execution.'
     :'Task created for foreground execution. Confirm it now; it will not run in the background.');
    ui.runAt.value='';render();
   }catch(error){setStatus(error.message);}
  });
  ui.refresh?.addEventListener('click',()=>void refreshServerInventory({announce:true}));
  ui.clear?.addEventListener('click',async()=>{
   const terminal=queue.entries().filter(x=>['succeeded','failed','cancelled'].includes(x.status));
   for(const task of terminal)await deleteAgentTask(task.id).catch(console.warn);
   queue.removeTerminal();render();setStatus('Completed/cancelled task records cleared.');
  });
  timer=setInterval(()=>void executeDue(),1000);void executeDue();return true;
 }
 return {init,render,refresh:()=>void refreshServerInventory(),getTasks:()=>queue.entries(),
  destroy(){if(timer)clearInterval(timer);timer=null;ready=false;}};
}

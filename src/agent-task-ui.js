import {AGENT_SKILLS,AgentTaskQueue,executeRegisteredTask} from './agent-task-core.js';
import {listAgentTasks,saveAgentTask,deleteAgentTask} from './participant-store.js';

export function createAgentTaskUi({getScene=()=>({areas:[],objects:[]}),recordEvent=()=>null}={}){
 const $=id=>document.getElementById(id);
 const ui={
  form:$('agentTaskForm'),skill:$('agentTaskSkill'),target:$('agentTaskTarget'),
  runAt:$('agentTaskRunAt'),list:$('agentTaskList'),status:$('agentTaskStatus'),
  clear:$('agentTaskClearDone'),refresh:$('agentTaskRefreshObjects')
 };
 const queue=new AgentTaskQueue(),running=new Set();
 let timer=null,ready=false;
 const setStatus=text=>{if(ui.status)ui.status.textContent=text;};
 const persist=task=>saveAgentTask(task).catch(error=>{
  console.warn('Task metadata save failed',error);
  setStatus('Task changed in memory, but local persistence failed.');
 });
 function sceneObjects(){
  const scene=getScene?.()||{};
  return Array.isArray(scene.objects)?scene.objects:[];
 }
 function skillLabel(skill){
  return skill.label+(skill.available?'':' · unavailable');
 }
 function refreshSelectors(){
  if(!ui.skill||!ui.target)return;
  const selected=ui.skill.value||'describe_object';
  ui.skill.replaceChildren();
  for(const skill of Object.values(AGENT_SKILLS)){
   const option=document.createElement('option');option.value=skill.id;
   option.textContent=skillLabel(skill);option.disabled=!skill.available;
   ui.skill.append(option);
  }
  ui.skill.value=AGENT_SKILLS[selected]?.available?selected:'describe_object';
  const target=ui.target.value;
  ui.target.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';
  placeholder.textContent='Choose owner-defined object';ui.target.append(placeholder);
  for(const object of sceneObjects()){
   const option=document.createElement('option');option.value=object.id;
   option.textContent=object.name+' · '+object.kind;ui.target.append(option);
  }
  if(sceneObjects().some(x=>x.id===target))ui.target.value=target;
 }
 function taskSummary(task){
  const skill=AGENT_SKILLS[task.skillId];
  const object=sceneObjects().find(x=>x.id===task.targetId);
  return (skill?.label||task.skillId)+' · '+(object?.name||task.targetId||'no target');
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
   empty.textContent='No local agent tasks yet.';ui.list.append(empty);return;
  }
  for(const task of tasks){
   const row=document.createElement('article');row.className='agent-task-row';row.dataset.status=task.status;
   const title=document.createElement('strong');title.textContent=taskSummary(task);
   const meta=document.createElement('small');
   const scheduled=new Date(task.runAt).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
   meta.textContent=task.status.toUpperCase()+' · '+task.attempts+'/'+task.maxAttempts+' attempts · '+scheduled;
   row.append(title,meta);
   if(task.resultText){
    const result=document.createElement('p');result.textContent=task.resultText;row.append(result);
   }
   if(task.errorText){
    const error=document.createElement('p');error.className='agent-task-error';error.textContent=task.errorText;row.append(error);
   }
   const actions=document.createElement('div');actions.className='agent-task-actions';
   if(task.status==='pending-confirmation'){
    actions.append(button('Confirm','Confirm '+taskSummary(task),()=>{
     const next=queue.confirm(task.id,Date.now());if(!next)return;
     persist(next);recordEvent('decision','Owner confirmed agent task '+taskSummary(next),
      'agent-task-runtime',{kind:'decision',semantic:'agent-task-confirmed'});
     render();void executeDue();
    }));
    actions.append(button('Cancel','Cancel '+taskSummary(task),()=>cancel(task.id)));
   }else if(task.status==='scheduled'){
    actions.append(button('Run now','Run '+taskSummary(task)+' now',()=>{
     const next=queue.runNow(task.id,Date.now());if(next){persist(next);render();void executeDue();}
    }));
    actions.append(button('Cancel','Cancel '+taskSummary(task),()=>cancel(task.id)));
   }
   if(actions.children.length)row.append(actions);
   ui.list.append(row);
  }
 }
 function cancel(id){
  const next=queue.cancel(id,Date.now());if(!next)return;
  persist(next);recordEvent('decision','Owner cancelled agent task '+taskSummary(next),
   'agent-task-runtime',{kind:'decision',semantic:'agent-task-cancelled'});
  render();
 }
 async function executeOne(id){
  if(running.has(id))return;running.add(id);
  try{
   const started=queue.start(id,Date.now());if(!started)return;
   await persist(started);
   const actionEvent=recordEvent('decision','Executing approved task '+taskSummary(started),
    'agent-task-runtime',{kind:'action',semantic:'agent-task-action'});
   try{
    const result=await executeRegisteredTask(started,{scene:getScene?.()});
    const done=queue.succeed(id,result,Date.now(),actionEvent?.id||null);
    if(done){
     await persist(done);
     recordEvent('decision','Task completed: '+result,'agent-task-runtime',{
      kind:'outcome',semantic:'agent-task-outcome',relatedEventId:actionEvent?.id||null
     });
     setStatus('Task completed locally.');
    }
   }catch(error){
    const failed=queue.fail(id,error,{retryable:error?.retryable===true,now:Date.now(),
     relatedEventId:actionEvent?.id||null});
    if(failed){
     await persist(failed);
     recordEvent('decision',(failed.status==='scheduled'?'Task retry scheduled: ':'Task failed: ')+failed.errorText,
      'agent-task-runtime',{kind:'outcome',semantic:'agent-task-outcome',
       relatedEventId:actionEvent?.id||null});
     setStatus(failed.status==='scheduled'?'Task failed temporarily; retry scheduled.':'Task failed.');
    }
   }
  }finally{running.delete(id);render();}
 }
 async function executeDue(){
  if(!ready)return;
  for(const task of queue.due(Date.now()))await executeOne(task.id);
 }
 async function init(){
  if(!ui.form)return false;
  try{queue.restore(await listAgentTasks());ready=true;}
  catch(error){setStatus('Local task storage unavailable: '+error.message);return false;}
  refreshSelectors();render();
  ui.form.addEventListener('submit',event=>{
   event.preventDefault();if(!ready)return;
   const skill=AGENT_SKILLS[ui.skill.value];
   if(!skill?.available){setStatus(skill?.unavailableReason||'Skill unavailable.');return;}
   const runAt=ui.runAt.value?Date.parse(ui.runAt.value):Date.now();
   try{
    const created=queue.create({skillId:skill.id,targetId:ui.target.value,
     runAt:Number.isFinite(runAt)?runAt:Date.now()},Date.now());
    if(!created.created){
     setStatus('An equivalent active task already exists.');return;
    }
    persist(created.task);
    recordEvent('decision','Agent task proposed: '+taskSummary(created.task),
     'agent-task-runtime',{kind:'decision',semantic:'agent-task-proposed'});
    setStatus('Task created. Confirm it before execution.');
    ui.runAt.value='';render();
   }catch(error){setStatus(error.message);}
  });
  ui.refresh?.addEventListener('click',()=>{refreshSelectors();setStatus('Owner-defined objects refreshed.');});
  ui.clear?.addEventListener('click',async()=>{
   const terminal=queue.entries().filter(x=>['succeeded','failed','cancelled'].includes(x.status));
   for(const task of terminal)await deleteAgentTask(task.id).catch(console.warn);
   queue.removeTerminal();render();setStatus('Completed/cancelled task records cleared.');
  });
  timer=setInterval(()=>void executeDue(),1000);
  void executeDue();
  return true;
 }
 return {init,render,refresh:refreshSelectors,getTasks:()=>queue.entries(),
  destroy(){if(timer)clearInterval(timer);timer=null;ready=false;}};
}

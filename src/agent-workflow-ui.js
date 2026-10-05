import {executeRegisteredTask} from './agent-task-core.js';
import {localSkillTarget,skillDefinition as governedSkillDefinition} from './governed-skill-core.js';
import {executeServerProductSearch,loadServerSkillTargets} from './governed-skill-client.js';
import {
 MAX_WORKFLOWS,workflowPreset,restoreAgentWorkflow,workflowDependencyState,workflowProgress,
 confirmWorkflow,resumeWorkflow,requestWorkflowCancel,invalidateWorkflow,readyWorkflowSteps,
 prepareWorkflowStep,completeWorkflowStep,failWorkflowStep,retryInterruptedStep
} from './agent-workflow-core.js';
import {
 listAgentWorkflows,saveAgentWorkflow,deleteAgentWorkflow
} from './participant-store.js';

export function createAgentWorkflowUi({
 getScene=()=>({areas:[],objects:[]}),getParticipants=()=>[],recordEvent=()=>null,
 captureImage=null,productSearch=executeServerProductSearch,
 cameraActive=()=>false,documentVisible=()=>!document.hidden,
 loadServerTargets=loadServerSkillTargets
}={}){
 const $=id=>document.getElementById(id);
 const ui={
  form:$('agentWorkflowForm'),preset:$('agentWorkflowPreset'),target:$('agentWorkflowTarget'),
  participant:$('agentWorkflowParticipant'),list:$('agentWorkflowList'),
  status:$('agentWorkflowStatus'),refresh:$('agentWorkflowRefresh'),
  clear:$('agentWorkflowClearDone')
 };
 let workflows=[],serverTargets=[],ready=false,executing=new Set();
 const setStatus=value=>{if(ui.status)ui.status.textContent=value;};
 const replace=workflow=>{
  const index=workflows.findIndex(row=>row.id===workflow.id);
  if(index<0)workflows=[...workflows,workflow].slice(-MAX_WORKFLOWS);
  else workflows=[...workflows.slice(0,index),workflow,...workflows.slice(index+1)];
  return workflow;
 };
 async function persist(workflow){
  replace(workflow);
  try{await saveAgentWorkflow(workflow);}
  catch(error){console.warn('Workflow metadata save failed',error);
   setStatus('Workflow changed in memory, but local persistence failed.');}
  return workflow;
 }
 function localTargets(){
  const scene=getScene?.()||{},targets=[];
  for(const object of Array.isArray(scene.objects)?scene.objects:[]){
   const target=localSkillTarget(scene,object.id);if(target)targets.push(target);
  }
  return targets;
 }
 function allTargets(){return [...localTargets(),...serverTargets];}
 function targetFor(workflow){
  return allTargets().find(target=>
   target.id===workflow.targetId&&target.targetSource===workflow.targetSource)||null;
 }
 function participantIds(){return (getParticipants?.()||[]).map(row=>String(row?.id||'')).filter(Boolean);}
 function presetTargets(kind){
  if(kind==='local-inspect')return localTargets().filter(target=>
   target.enabledSkills.includes('describe_object')&&target.enabledSkills.includes('capture_image')&&target.area?.rect);
  if(kind==='server-research')return serverTargets.filter(target=>
   target.approved&&target.enabledSkills.includes('describe_object')&&target.enabledSkills.includes('product_search'));
  return [];
 }
 function encoded(target){return target.targetSource+'|'+target.id;}
 function decoded(value){
  const [source,id]=String(value||'').split('|');
  return allTargets().find(target=>target.id===id&&target.targetSource===source)||null;
 }
 function refreshParticipantOptions(){
  if(!ui.participant)return;
  const selected=ui.participant.value;ui.participant.replaceChildren(new Option('No participant dependency',''));
  for(const participant of getParticipants?.()||[]){
   if(!participant?.id)continue;
   ui.participant.add(new Option(participant.name||participant.id,participant.id));
  }
  if([...ui.participant.options].some(option=>option.value===selected))ui.participant.value=selected;
 }
 function refreshTargetOptions(){
  if(!ui.target||!ui.preset)return;
  const selected=ui.target.value;ui.target.replaceChildren(new Option('Choose approved target',''));
  for(const target of presetTargets(ui.preset.value)){
   ui.target.add(new Option(target.name+' · '+
    (target.targetSource==='server-approved'?'server approved':'local owner-defined'),encoded(target)));
  }
  if([...ui.target.options].some(option=>option.value===selected))ui.target.value=selected;
  refreshParticipantOptions();
 }
 async function refreshServerInventory({announce=false}={}){
  try{
   const result=await loadServerTargets();
   serverTargets=result?.available?[...(result.targets||[])]:[];
   refreshTargetOptions();
   if(announce)setStatus(result?.available
    ?'Workflow targets refreshed. Current approval and skill grants will be rechecked before every step.'
    :'Self-hosted targets unavailable. Local workflows remain available.');
  }catch(error){
   serverTargets=[];refreshTargetOptions();
   if(announce)setStatus('Server workflow targets unavailable: '+error.message);
  }
 }
 function nameFor(workflow){
  const target=targetFor(workflow);
  return workflow.name+(target?' · '+target.name:'');
 }
 function button(label,handler,aria=''){
  const control=document.createElement('button');control.type='button';control.textContent=label;
  if(aria)control.setAttribute('aria-label',aria);control.addEventListener('click',handler);return control;
 }
 function terminal(workflow){return ['succeeded','failed','cancelled','invalidated'].includes(workflow.status);}
 function stepLabel(step){
  return step.skillId.replaceAll('_',' ')+' · '+step.status.toUpperCase()+
   (step.attempts?(' · attempt '+step.attempts+'/'+step.maxAttempts):'');
 }
 function render(){
  if(!ui.list)return;
  refreshTargetOptions();ui.list.replaceChildren();
  const rows=[...workflows].sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
  if(!rows.length){
   const empty=document.createElement('p');empty.className='agent-task-empty';
   empty.textContent='No governed workflows yet.';ui.list.append(empty);return;
  }
  for(const workflow of rows){
   const card=document.createElement('article');card.className='agent-task-row';card.dataset.status=workflow.status;
   const title=document.createElement('strong');title.textContent=nameFor(workflow);
   const progress=workflowProgress(workflow),meta=document.createElement('small');
   meta.textContent=workflow.status.toUpperCase()+' · '+progress.done+'/'+progress.total+
    ' steps · '+progress.percent+'%'+(workflow.participantId?' · participant dependency':'');
   card.append(title,meta);
   const bar=document.createElement('progress');bar.max=progress.total||1;bar.value=progress.done;
   bar.setAttribute('aria-label','Workflow progress');card.append(bar);
   const steps=document.createElement('ol');steps.className='agent-workflow-steps';
   for(const step of workflow.steps){
    const item=document.createElement('li');const label=document.createElement('span');
    label.textContent=stepLabel(step);item.append(label);
    if(step.resultText){const result=document.createElement('small');result.textContent=step.resultText;item.append(result);}
    if(step.errorText){const error=document.createElement('small');error.className='agent-task-error';error.textContent=step.errorText;item.append(error);}
    if(step.resultSources?.length){
     const sources=document.createElement('span');sources.className='agent-task-sources';
     for(const source of step.resultSources){
      const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent=source.title||source.url;sources.append(link);
     }item.append(sources);
    }
    steps.append(item);
   }
   card.append(steps);
   if(workflow.errorText){const error=document.createElement('p');error.className='agent-task-error';error.textContent=workflow.errorText;card.append(error);}
   const actions=document.createElement('div');actions.className='agent-task-actions';
   if(workflow.status==='pending-confirmation'){
    actions.append(button('Confirm workflow',()=>void confirmAndRun(workflow.id),'Confirm '+workflow.name));
    actions.append(button('Cancel',()=>void cancelWorkflow(workflow.id),'Cancel '+workflow.name));
   }else if(['running','awaiting-owner','paused'].includes(workflow.status)){
    const needsReview=workflow.steps.some(step=>step.status==='needs-review');
    const waitingOwner=workflow.steps.some(step=>step.status==='awaiting-owner');
    const nextReady=readyWorkflowSteps(workflow)[0];
    const foreground=workflow.status==='awaiting-owner'||needsReview||waitingOwner||
     governedSkillDefinition(nextReady?.skillId)?.foregroundOwnerAction===true;
    actions.append(button(foreground?'Run next step · owner action':'Resume',
     ()=>void runNext(workflow.id,{ownerAction:foreground}),
     (foreground?'Run next workflow step for ':'Resume ')+workflow.name));
    actions.append(button(workflow.cancelRequested?'Cancel pending':'Cancel workflow',
     ()=>void cancelWorkflow(workflow.id),'Cancel '+workflow.name));
   }
   if(actions.children.length)card.append(actions);
   ui.list.append(card);
  }
 }
 async function currentDependencies(workflow,{refreshServer=true}={}){
  if(refreshServer&&workflow.targetSource==='server-approved')await refreshServerInventory();
  const target=targetFor(workflow),state=workflowDependencyState(workflow,{target,participantIds:participantIds()});
  return {target,state};
 }
 async function validateOrInvalidate(workflow){
  const {target,state}=await currentDependencies(workflow);
  if(state.valid)return {workflow,target,valid:true};
  const next=invalidateWorkflow(workflow,state.reason,Date.now());
  await persist(next);
  recordEvent('decision','Workflow invalidated: '+state.reason,'agent-workflow-runtime',{
   kind:'outcome',semantic:'agent-workflow-invalidated'
  });
  setStatus('Workflow invalidated because its dependency or authorization changed.');
  return {workflow:next,target,valid:false};
 }
 async function executePrepared(workflow,step,{ownerAction=false,target=null}={}){
  const id=workflow.id;if(executing.has(id))return;
  executing.add(id);await persist(workflow);render();
  const actionEvent=recordEvent('decision','Executing workflow step '+step.skillId+' · '+workflow.name,
   'agent-workflow-runtime',{kind:'action',semantic:'agent-workflow-step-action'});
  try{
   const taskLike={status:'running',skillId:step.skillId,targetId:workflow.targetId,targetSource:workflow.targetSource};
   const result=await executeRegisteredTask(taskLike,{
    scene:getScene?.(),serverTargets,explicitOwnerAction:ownerAction,
    cameraActive:cameraActive()===true,documentVisible:documentVisible()===true,
    captureImage,productSearch,now:Date.now()
   });
   const latest=workflows.find(row=>row.id===id)||workflow;
   const done=completeWorkflowStep(latest,step.id,result,Date.now());
   await persist(done);
   recordEvent('decision','Workflow step completed: '+step.skillId,'agent-workflow-runtime',{
    kind:'outcome',semantic:'agent-workflow-step-outcome',relatedEventId:actionEvent?.id||null
   });
   setStatus(done.status==='succeeded'?'Workflow completed.':'Workflow step completed.');
  }catch(error){
   const latest=workflows.find(row=>row.id===id)||workflow;
   const failed=failWorkflowStep(latest,step.id,error,Date.now());
   await persist(failed);
   recordEvent('decision','Workflow step stopped: '+(failed.errorText||error.message),'agent-workflow-runtime',{
    kind:'outcome',semantic:'agent-workflow-step-outcome',relatedEventId:actionEvent?.id||null
   });
   setStatus(failed.status==='invalidated'?'Workflow authorization invalidated.':
    failed.status==='paused'?'Workflow paused for bounded retry/review.':
    failed.status==='awaiting-owner'?'Workflow requires a fresh owner action.':'Workflow step failed.');
  }finally{
   executing.delete(id);render();
   const latest=workflows.find(row=>row.id===id);
   if(latest?.status==='running')void runAutomatic(id);
  }
 }
 async function runAutomatic(id){
  if(executing.has(id))return;
  let workflow=workflows.find(row=>row.id===id);if(!workflow||workflow.status!=='running')return;
  const checked=await validateOrInvalidate(workflow);if(!checked.valid){render();return;}
  workflow=checked.workflow;
  const step=readyWorkflowSteps(workflow)[0];
  if(!step){
   render();return;
  }
  const prepared=prepareWorkflowStep(workflow,step.id,{ownerAction:false,now:Date.now()});
  await persist(prepared.workflow);render();
  if(!prepared.step){
   if(prepared.reason==='foreground-owner-action-required')
    setStatus('Workflow is waiting for a fresh owner action before '+step.skillId.replaceAll('_',' ')+'.');
   return;
  }
  await executePrepared(prepared.workflow,prepared.step,{ownerAction:false,target:checked.target});
 }
 async function runNext(id,{ownerAction=false}={}){
  if(executing.has(id))return;
  let workflow=workflows.find(row=>row.id===id);if(!workflow||terminal(workflow))return;
  const checked=await validateOrInvalidate(workflow);if(!checked.valid){render();return;}
  workflow=checked.workflow;
  if(workflow.status==='paused'){
   const review=workflow.steps.find(step=>step.status==='needs-review');
   const waiting=workflow.steps.find(step=>step.status==='awaiting-owner');
   if(review||waiting){
    if(!ownerAction){setStatus('Interrupted or owner-gated side-effect step requires explicit owner review.');return;}
    workflow=retryInterruptedStep(workflow,(review||waiting).id,Date.now());
   }
   workflow=resumeWorkflow(workflow,Date.now());
   await persist(workflow);
  }else if(workflow.status==='awaiting-owner'){
   const waiting=workflow.steps.find(step=>step.status==='awaiting-owner');
   if(waiting)workflow=retryInterruptedStep(workflow,waiting.id,Date.now());
   else workflow=resumeWorkflow(workflow,Date.now());
   await persist(workflow);
  }
  const step=readyWorkflowSteps(workflow)[0];
  if(!step){render();return;}
  const prepared=prepareWorkflowStep(workflow,step.id,{ownerAction,now:Date.now()});
  await persist(prepared.workflow);render();
  if(!prepared.step){
   setStatus(prepared.reason==='foreground-owner-action-required'
    ?'This step requires a fresh foreground owner action.':'Workflow step is not ready.');
   return;
  }
  await executePrepared(prepared.workflow,prepared.step,{ownerAction,target:checked.target});
 }
 async function confirmAndRun(id){
  let workflow=workflows.find(row=>row.id===id);if(!workflow)return;
  const checked=await validateOrInvalidate(workflow);if(!checked.valid){render();return;}
  workflow=confirmWorkflow(workflow,Date.now());await persist(workflow);
  recordEvent('decision','Owner confirmed workflow '+workflow.name,'agent-workflow-runtime',{
   kind:'decision',semantic:'agent-workflow-confirmed'
  });
  setStatus('Workflow confirmed. Read-only steps may run automatically; side-effect steps still require owner action.');
  render();void runAutomatic(id);
 }
 async function cancelWorkflow(id){
  const workflow=workflows.find(row=>row.id===id);if(!workflow)return;
  const next=requestWorkflowCancel(workflow,Date.now());await persist(next);
  recordEvent('decision','Owner cancelled workflow '+workflow.name,'agent-workflow-runtime',{
   kind:'decision',semantic:'agent-workflow-cancelled'
  });
  setStatus(next.cancelRequested?'Cancellation will apply after the running step finishes.':'Workflow cancelled.');
  render();
 }
 async function init(){
  if(!ui.form)return false;
  try{
   const saved=await listAgentWorkflows();
   workflows=saved.map(restoreAgentWorkflow).filter(Boolean).slice(-MAX_WORKFLOWS);
   for(const workflow of workflows)if(workflow.recoveryRequired)await saveAgentWorkflow(workflow);
   ready=true;
  }catch(error){setStatus('Workflow storage unavailable: '+error.message);return false;}
  await refreshServerInventory();refreshTargetOptions();render();
  ui.preset?.addEventListener('change',refreshTargetOptions);
  ui.form.addEventListener('submit',event=>{
   event.preventDefault();if(!ready)return;
   const target=decoded(ui.target.value);
   if(!target){setStatus('Choose an eligible approved target.');return;}
   try{
    const workflow=workflowPreset(ui.preset.value,target,{
     participantId:ui.participant?.value||null,now:Date.now()
    });
    workflows=[...workflows,workflow].slice(-MAX_WORKFLOWS);
    void saveAgentWorkflow(workflow);
    recordEvent('decision','Agent workflow proposed: '+workflow.name,'agent-workflow-runtime',{
     kind:'decision',semantic:'agent-workflow-proposed'
    });
    setStatus('Workflow created. Review and confirm it before any step executes.');render();
   }catch(error){setStatus(error.message);}
  });
  ui.refresh?.addEventListener('click',()=>void refreshServerInventory({announce:true}));
  ui.clear?.addEventListener('click',async()=>{
   const done=workflows.filter(terminal);
   for(const workflow of done)await deleteAgentWorkflow(workflow.id).catch(console.warn);
   workflows=workflows.filter(row=>!terminal(row));render();setStatus('Completed/cancelled/invalidated workflows cleared.');
  });
  // Do not auto-resume restored workflows. Read-only work resumes only after visible owner Resume.
  return true;
 }
 return {init,render,refresh:()=>void refreshServerInventory(),getWorkflows:()=>[...workflows],
  destroy(){ready=false;executing.clear();}};
}

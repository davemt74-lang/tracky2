import {GOVERNED_SKILL_CONTRACT,skillDefinition,normalizeEnabledSkills} from './governed-skill-core.js';

export const AGENT_WORKFLOW_SCHEMA=1;
export const AGENT_WORKFLOW_CONTRACT='14C.1';
export const MAX_WORKFLOW_STEPS=6;
export const MAX_WORKFLOWS=80;
export const MAX_STEP_ATTEMPTS=3;
export const WORKFLOW_STATUSES=Object.freeze([
 'pending-confirmation','running','awaiting-owner','paused','succeeded','failed','cancelled','invalidated'
]);
export const STEP_STATUSES=Object.freeze([
 'pending','running','awaiting-owner','needs-review','succeeded','failed','cancelled','invalidated'
]);

const clean=(value,max=120)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const uid=(prefix='workflow')=>globalThis.crypto?.randomUUID?.()||
 prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const targetSource=value=>value==='server-approved'?'server-approved':'local-owner-defined';
const freezeRows=rows=>Object.freeze(rows.map(row=>Object.freeze({...row,
 dependsOn:Object.freeze([...(row.dependsOn||[])]),
 resultSources:Object.freeze([...(row.resultSources||[])])
})));

export function workflowTargetFingerprint(target){
 if(!target?.id)return '';
 const skills=normalizeEnabledSkills(target.enabledSkills).slice().sort().join(',');
 return [clean(target.targetSource,48),clean(target.id,96),target.approved===true?'approved':'unapproved',skills].join('|');
}
export function workflowPolicySnapshot({target,participantId=null,createdAt=Date.now()}={}){
 if(!target?.id||target.approved!==true)throw new Error('Approved workflow target required.');
 const skills=normalizeEnabledSkills(target.enabledSkills);
 return Object.freeze({
  contract:AGENT_WORKFLOW_CONTRACT,skillContract:GOVERNED_SKILL_CONTRACT,
  createdAt:finite(createdAt)?createdAt:Date.now(),
  targetId:clean(target.id,96),targetSource:targetSource(target.targetSource),
  targetFingerprint:workflowTargetFingerprint(target),
  allowedSkills:Object.freeze([...skills].sort()),
  participantId:clean(participantId,96)||null
 });
}
function stepId(index,inputId=''){
 return clean(inputId,64)||'step-'+String(index+1);
}
function normalizedDependencies(input,knownIds){
 const deps=[...new Set((Array.isArray(input)?input:[]).map(v=>clean(v,64)).filter(Boolean))];
 for(const id of deps)if(!knownIds.has(id))throw new Error('Workflow dependency must reference an earlier step.');
 return Object.freeze(deps);
}
export function normalizeWorkflowSteps(steps=[],policySnapshot){
 if(!Array.isArray(steps)||steps.length<1||steps.length>MAX_WORKFLOW_STEPS)
  throw new Error('Workflow must contain 1-'+MAX_WORKFLOW_STEPS+' steps.');
 const knownIds=new Set(),rows=[];
 for(let index=0;index<steps.length;index++){
  const input=steps[index]||{},id=stepId(index,input.id);
  if(knownIds.has(id))throw new Error('Workflow step IDs must be unique.');
  const skill=skillDefinition(input.skillId);
  if(!skill)throw new Error('Unknown workflow skill.');
  if(!policySnapshot.allowedSkills.includes(skill.id))
   throw new Error('Workflow skill is not included in the policy snapshot.');
  const dependsOn=normalizedDependencies(input.dependsOn,knownIds);
  knownIds.add(id);
  const key=clean(input.idempotencyKey,180)||
   [policySnapshot.contract,id,skill.id,policySnapshot.targetSource,policySnapshot.targetId].join(':');
  rows.push({
   id,skillId:skill.id,dependsOn,idempotencyKey:key,status:'pending',
   attempts:0,maxAttempts:Math.max(1,Math.min(MAX_STEP_ATTEMPTS,Number(input.maxAttempts)||2)),
   startedAt:null,completedAt:null,resultText:'',resultSources:Object.freeze([]),
   executionProvenance:null,errorText:'',lastAttemptId:null
  });
 }
 return freezeRows(rows);
}
export function createAgentWorkflow({
 id=null,name='',target,participantId=null,steps=[],createdAt=Date.now()
}={}){
 const workflowId=clean(id,96)||uid('workflow'),policySnapshot=workflowPolicySnapshot({target,participantId,createdAt});
 return Object.freeze({
  schema:AGENT_WORKFLOW_SCHEMA,id:workflowId,name:clean(name,120)||'Agent workflow',
  targetId:policySnapshot.targetId,targetSource:policySnapshot.targetSource,
  participantId:policySnapshot.participantId,policySnapshot,
  status:'pending-confirmation',createdAt,updatedAt:createdAt,confirmedAt:null,
  completedAt:null,cancelRequested:false,recoveryRequired:false,currentStepId:null,
  steps:normalizeWorkflowSteps(steps,policySnapshot),errorText:''
 });
}
export function workflowPreset(kind,target,{participantId=null,now=Date.now()}={}){
 const skills=new Set(normalizeEnabledSkills(target?.enabledSkills));
 if(kind==='local-inspect'){
  if(target?.targetSource!=='local-owner-defined'||!skills.has('describe_object')||!skills.has('capture_image'))
   throw new Error('Local inspect requires describe and capture grants.');
  return createAgentWorkflow({name:'Inspect & capture '+target.name,target,participantId,createdAt:now,steps:[
   {id:'describe',skillId:'describe_object'},
   {id:'capture',skillId:'capture_image',dependsOn:['describe'],maxAttempts:1}
  ]});
 }
 if(kind==='server-research'){
  if(target?.targetSource!=='server-approved'||!skills.has('describe_object')||!skills.has('product_search'))
   throw new Error('Server research requires describe and product-search grants.');
  return createAgentWorkflow({name:'Describe & research '+target.name,target,participantId,createdAt:now,steps:[
   {id:'describe',skillId:'describe_object'},
   {id:'research',skillId:'product_search',dependsOn:['describe']}
  ]});
 }
 throw new Error('Unknown workflow preset.');
}
function normalizeStoredSources(input=[]){
 const rows=[];for(const item of Array.isArray(input)?input:[]){
  if(rows.length>=5)break;
  const url=clean(item?.url,700);if(!/^https:\/\//i.test(url))continue;
  rows.push(Object.freeze({url,title:clean(item?.title,160)||url.slice(0,120)}));
 }return Object.freeze(rows);
}
function normalizeStoredStep(input,index,policy){
 const skill=skillDefinition(input?.skillId);if(!skill||!policy.allowedSkills.includes(skill.id))return null;
 const id=stepId(index,input?.id),status=STEP_STATUSES.includes(input?.status)?input.status:'failed';
 let restoredStatus=status,recovery=false;
 if(status==='running'){
  if(skill.sideEffect==='read-only')restoredStatus='pending';
  else{restoredStatus='needs-review';recovery=true;}
 }
 return {step:Object.freeze({
  id,skillId:skill.id,dependsOn:Object.freeze((Array.isArray(input?.dependsOn)?input.dependsOn:[]).map(v=>clean(v,64)).filter(Boolean)),
  idempotencyKey:clean(input?.idempotencyKey,180)||[policy.contract,id,skill.id,policy.targetSource,policy.targetId].join(':'),
  status:restoredStatus,attempts:Math.max(0,Math.min(MAX_STEP_ATTEMPTS,Number(input?.attempts)||0)),
  maxAttempts:Math.max(1,Math.min(MAX_STEP_ATTEMPTS,Number(input?.maxAttempts)||2)),
  startedAt:restoredStatus==='pending'||restoredStatus==='needs-review'?null:(finite(input?.startedAt)?input.startedAt:null),
  completedAt:finite(input?.completedAt)?input.completedAt:null,
  resultText:clean(input?.resultText,900),resultSources:normalizeStoredSources(input?.resultSources),
  executionProvenance:input?.executionProvenance&&typeof input.executionProvenance==='object'
   ?Object.freeze({...input.executionProvenance}):null,
  errorText:clean(input?.errorText,240),lastAttemptId:clean(input?.lastAttemptId,96)||null
 }),recovery};
}
export function restoreAgentWorkflow(input={}){
 if(Number(input?.schema)!==AGENT_WORKFLOW_SCHEMA||!input?.policySnapshot)return null;
 const p=input.policySnapshot;
 const policy=Object.freeze({
  contract:p.contract===AGENT_WORKFLOW_CONTRACT?AGENT_WORKFLOW_CONTRACT:AGENT_WORKFLOW_CONTRACT,
  skillContract:GOVERNED_SKILL_CONTRACT,createdAt:finite(p.createdAt)?p.createdAt:Date.now(),
  targetId:clean(p.targetId||input.targetId,96),targetSource:targetSource(p.targetSource||input.targetSource),
  targetFingerprint:clean(p.targetFingerprint,500),
  allowedSkills:Object.freeze([...new Set((Array.isArray(p.allowedSkills)?p.allowedSkills:[])
   .map(v=>clean(v,48)).filter(v=>skillDefinition(v)))].sort()),
  participantId:clean(p.participantId||input.participantId,96)||null
 });
 if(!policy.targetId||!policy.allowedSkills.length)return null;
 const rows=[];let recovery=false;const restoredIds=new Set();
 const stored=(Array.isArray(input.steps)?input.steps:[]).slice(0,MAX_WORKFLOW_STEPS);
 for(let i=0;i<stored.length;i++){
  const result=normalizeStoredStep(stored[i],i,policy);if(!result)return null;
  if(restoredIds.has(result.step.id))return null;
  if(result.step.dependsOn.some(id=>!restoredIds.has(id)))return null;
  restoredIds.add(result.step.id);rows.push(result.step);recovery ||= result.recovery;
 }
 if(!rows.length)return null;
 let status=WORKFLOW_STATUSES.includes(input.status)?input.status:'failed';
 if(status==='running'||status==='awaiting-owner'){status='paused';recovery=true;}
 return Object.freeze({
  schema:AGENT_WORKFLOW_SCHEMA,id:clean(input.id,96)||uid('workflow'),name:clean(input.name,120)||'Agent workflow',
  targetId:policy.targetId,targetSource:policy.targetSource,participantId:policy.participantId,
  policySnapshot:policy,status,createdAt:finite(input.createdAt)?input.createdAt:Date.now(),
  updatedAt:finite(input.updatedAt)?input.updatedAt:Date.now(),
  confirmedAt:finite(input.confirmedAt)?input.confirmedAt:null,
  completedAt:finite(input.completedAt)?input.completedAt:null,
  cancelRequested:Boolean(input.cancelRequested),recoveryRequired:recovery||Boolean(input.recoveryRequired),
  currentStepId:null,steps:freezeRows(rows),errorText:clean(input.errorText,240)
 });
}
export function workflowDependencyState(workflow,{target=null,participantIds=[]}={}){
 if(!workflow?.policySnapshot)return Object.freeze({valid:false,reason:'workflow-policy-missing'});
 if(!target||target.id!==workflow.targetId||target.targetSource!==workflow.targetSource)
  return Object.freeze({valid:false,reason:'target-deleted-or-unavailable'});
 if(target.approved!==true)return Object.freeze({valid:false,reason:'target-approval-revoked'});
 const currentSkills=normalizeEnabledSkills(target.enabledSkills);
 for(const step of workflow.steps){
  if(!workflow.policySnapshot.allowedSkills.includes(step.skillId))
   return Object.freeze({valid:false,reason:'policy-snapshot-missing-skill',stepId:step.id});
  if(!currentSkills.includes(step.skillId))
   return Object.freeze({valid:false,reason:'skill-authorization-revoked',stepId:step.id});
 }
 if(workflow.participantId&&!new Set((participantIds||[]).map(String)).has(workflow.participantId))
  return Object.freeze({valid:false,reason:'participant-deleted-or-unavailable'});
 if(workflow.policySnapshot.targetFingerprint!==workflowTargetFingerprint(target))
  return Object.freeze({valid:false,reason:'authorization-snapshot-stale'});
 return Object.freeze({valid:true,reason:null,authorizationChanged:false});
}
export function readyWorkflowSteps(workflow){
 const succeeded=new Set(workflow.steps.filter(step=>step.status==='succeeded').map(step=>step.id));
 return Object.freeze(workflow.steps.filter(step=>step.status==='pending'&&step.dependsOn.every(id=>succeeded.has(id))));
}
export function workflowProgress(workflow){
 const total=workflow?.steps?.length||0,done=(workflow?.steps||[]).filter(step=>step.status==='succeeded').length;
 const failed=(workflow?.steps||[]).filter(step=>['failed','invalidated'].includes(step.status)).length;
 return Object.freeze({total,done,failed,percent:total?Math.round(done/total*100):0,
  next:readyWorkflowSteps(workflow)[0]?.id||null});
}
function replaceStep(workflow,stepId,patch,workflowPatch={}){
 const steps=workflow.steps.map(step=>step.id===stepId?Object.freeze({...step,...patch}):step);
 return Object.freeze({...workflow,...workflowPatch,steps:freezeRows(steps)});
}
export function confirmWorkflow(workflow,now=Date.now()){
 if(workflow?.status!=='pending-confirmation')return workflow;
 return Object.freeze({...workflow,status:'running',confirmedAt:now,updatedAt:now,errorText:''});
}
export function resumeWorkflow(workflow,now=Date.now()){
 if(!['paused','awaiting-owner'].includes(workflow?.status))return workflow;
 return Object.freeze({...workflow,status:'running',recoveryRequired:false,updatedAt:now,errorText:''});
}
export function requestWorkflowCancel(workflow,now=Date.now()){
 if(!workflow||['succeeded','failed','cancelled','invalidated'].includes(workflow.status))return workflow;
 if(workflow.currentStepId)
  return Object.freeze({...workflow,cancelRequested:true,updatedAt:now});
 const steps=workflow.steps.map(step=>['pending','awaiting-owner','needs-review'].includes(step.status)
  ?Object.freeze({...step,status:'cancelled',completedAt:now}):step);
 return Object.freeze({...workflow,status:'cancelled',cancelRequested:false,completedAt:now,updatedAt:now,steps:freezeRows(steps)});
}
export function invalidateWorkflow(workflow,reason='authorization-invalid',now=Date.now()){
 const steps=workflow.steps.map(step=>['pending','awaiting-owner','needs-review'].includes(step.status)
  ?Object.freeze({...step,status:'invalidated',completedAt:now,errorText:clean(reason,240)}):step);
 return Object.freeze({...workflow,status:'invalidated',cancelRequested:false,currentStepId:null,
  completedAt:now,updatedAt:now,errorText:clean(reason,240),steps:freezeRows(steps)});
}
export function prepareWorkflowStep(workflow,stepId,{ownerAction=false,now=Date.now()}={}){
 if(workflow?.status!=='running')return Object.freeze({workflow,step:null,reason:'workflow-not-running'});
 const step=workflow.steps.find(row=>row.id===stepId);
 if(!step||!['pending','needs-review'].includes(step.status))
  return Object.freeze({workflow,step:null,reason:'step-not-ready'});
 const ready=readyWorkflowSteps(workflow).some(row=>row.id===stepId)||step.status==='needs-review';
 if(!ready)return Object.freeze({workflow,step:null,reason:'dependencies-incomplete'});
 const skill=skillDefinition(step.skillId);
 if(skill.foregroundOwnerAction&&ownerAction!==true){
  const next=replaceStep(workflow,stepId,{status:'awaiting-owner'},{status:'awaiting-owner',updatedAt:now,currentStepId:null});
  return Object.freeze({workflow:next,step:null,reason:'foreground-owner-action-required'});
 }
 if(step.status==='needs-review'&&ownerAction!==true)
  return Object.freeze({workflow:Object.freeze({...workflow,status:'paused',recoveryRequired:true}),step:null,reason:'interrupted-step-review-required'});
 const attemptId=uid('attempt');
 const next=replaceStep(workflow,stepId,{
  status:'running',attempts:step.attempts+1,startedAt:now,errorText:'',lastAttemptId:attemptId
 },{status:'running',updatedAt:now,currentStepId:stepId,recoveryRequired:false});
 return Object.freeze({workflow:next,step:next.steps.find(row=>row.id===stepId),reason:null});
}
export function completeWorkflowStep(workflow,stepId,result={},now=Date.now()){
 const step=workflow.steps.find(row=>row.id===stepId);
 if(!step||step.status!=='running')return workflow;
 let next=replaceStep(workflow,stepId,{
  status:'succeeded',completedAt:now,resultText:clean(result?.summary,900),
  resultSources:normalizeStoredSources(result?.sources),
  executionProvenance:result?.provenance&&typeof result.provenance==='object'?Object.freeze({...result.provenance}):null,
  errorText:''
 },{updatedAt:now,currentStepId:null});
 if(next.cancelRequested)return requestWorkflowCancel({...next,cancelRequested:false},now);
 if(next.steps.every(row=>row.status==='succeeded'))
  next=Object.freeze({...next,status:'succeeded',completedAt:now,updatedAt:now});
 return next;
}
export function classifyWorkflowError(error={}){
 const reason=clean(error?.reason||'',96),status=Number(error?.status)||0,message=clean(error?.message||error,240);
 if(['skill-authorization-revoked','target-approval-revoked','target-deleted-or-unavailable',
  'participant-deleted-or-unavailable','skill-not-enabled-for-object','object-approval-required',
  'target-source-not-allowed','authorization-snapshot-stale'].includes(reason))
  return Object.freeze({class:'authorization',retryable:false,invalidates:true,message});
 if(['foreground-owner-action-required','interrupted-step-review-required','camera-not-active','page-not-visible'].includes(reason))
  return Object.freeze({class:'owner-action',retryable:false,invalidates:false,message});
 if(error?.name==='AbortError'||[408,425,429,500,502,503,504].includes(status)||error?.retryable===true)
  return Object.freeze({class:'transient',retryable:true,invalidates:false,message});
 return Object.freeze({class:'terminal',retryable:false,invalidates:false,message});
}
export function failWorkflowStep(workflow,stepId,error,now=Date.now()){
 const step=workflow.steps.find(row=>row.id===stepId);if(!step||step.status!=='running')return workflow;
 const classification=classifyWorkflowError(error);
 if(classification.invalidates)return invalidateWorkflow(workflow,classification.message||classification.class,now);
 if(classification.class==='owner-action'){
  return replaceStep(workflow,stepId,{status:'awaiting-owner',startedAt:null,errorText:classification.message},
   {status:'awaiting-owner',currentStepId:null,updatedAt:now,errorText:classification.message});
 }
 if(classification.retryable&&step.attempts<step.maxAttempts){
  return replaceStep(workflow,stepId,{status:'pending',startedAt:null,errorText:classification.message},
   {status:'paused',currentStepId:null,updatedAt:now,recoveryRequired:true,errorText:classification.message});
 }
 return replaceStep(workflow,stepId,{status:'failed',completedAt:now,errorText:classification.message},
  {status:'failed',currentStepId:null,completedAt:now,updatedAt:now,errorText:classification.message});
}
export function retryInterruptedStep(workflow,stepId,now=Date.now()){
 const step=workflow.steps.find(row=>row.id===stepId);if(!step||!['needs-review','awaiting-owner'].includes(step.status))return workflow;
 return replaceStep(workflow,stepId,{status:'pending',startedAt:null,errorText:''},
  {status:'running',recoveryRequired:false,currentStepId:null,updatedAt:now,errorText:''});
}

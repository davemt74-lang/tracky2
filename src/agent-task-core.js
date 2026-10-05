import {normalizeRoomScene} from './room-scene-graph.js';
import {
 GOVERNED_SKILLS,boundedWebSources,executionProvenance,localSkillTarget,
 normalizeServerSkillTarget,skillDefinition as governedSkillDefinition,skillExecutionPolicy
} from './governed-skill-core.js';

export const AGENT_TASK_SCHEMA=2;
export const MAX_AGENT_TASKS=200;
export const DEFAULT_TASK_RETRY_DELAY_MS=30000;
export const DEFAULT_TASK_MAX_ATTEMPTS=2;
export const AGENT_SKILLS=Object.freeze(Object.fromEntries(
 Object.entries(GOVERNED_SKILLS).map(([id,skill])=>[id,Object.freeze({...skill,available:true})])
));
const TERMINAL=new Set(['succeeded','failed','cancelled']);
const STATUSES=new Set(['pending-confirmation','scheduled','running','succeeded','failed','cancelled']);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const taskId=()=>globalThis.crypto?.randomUUID?.()||
 'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const targetSource=value=>value==='server-approved'?'server-approved':'local-owner-defined';

export function skillDefinition(id){
 const skill=governedSkillDefinition(id);return skill?Object.freeze({...skill,available:true}):null;
}
export function availableSkills(){return Object.values(AGENT_SKILLS);}

function safeProvenance(value){
 if(!value||typeof value!=='object')return null;
 const allowed=['contract','skillId','skillVersion','sideEffect','targetId','targetSource','outcome',
  'executedAt','authorization','provider','model','resultCount','mediaBytes','mediaWidth','mediaHeight'];
 const result={};
 for(const key of allowed)if(value[key]!==undefined){
  const v=value[key];
  result[key]=typeof v==='string'?short(v,key==='model'?80:96):Number.isFinite(v)?v:v;
 }
 return Object.freeze(result);
}
export function normalizedTaskRecord(input={},now=Date.now()){
 const skill=skillDefinition(input.skillId);
 if(!skill)throw new Error('Unknown skill.');
 const source=targetSource(input.targetSource);
 const targetId=short(input.targetId,96);
 if(skill.target==='scene-object'&&!targetId)throw new Error('Choose an approved room object.');
 const runAt=finite(input.runAt)?Math.max(0,input.runAt):now;
 const id=short(input.id,96)||taskId();
 const key=short(input.idempotencyKey,180)||
  [skill.id,source,targetId,String(Math.floor(runAt/60000))].join(':');
 return Object.freeze({
  schema:AGENT_TASK_SCHEMA,id,skillId:skill.id,targetId,targetSource:source,
  idempotencyKey:key,status:'pending-confirmation',
  runAt,createdAt:finite(input.createdAt)?input.createdAt:now,
  updatedAt:now,confirmedAt:null,startedAt:null,completedAt:null,
  attempts:0,maxAttempts:Math.max(1,Math.min(5,
   Number.isFinite(input.maxAttempts)?Math.floor(input.maxAttempts):DEFAULT_TASK_MAX_ATTEMPTS)),
  resultText:'',resultSources:Object.freeze([]),executionProvenance:null,
  errorText:'',relatedEventId:short(input.relatedEventId,96)||null
 });
}
export function restoreTaskRecord(input={}){
 const skill=skillDefinition(input.skillId);if(!skill)return null;
 const status=STATUSES.has(input.status)?input.status:'failed';
 const legacy=Number(input.schema)===1;
 const base=normalizedTaskRecord({...input,targetSource:legacy?'local-owner-defined':input.targetSource},
  finite(input.createdAt)?input.createdAt:Date.now());
 return Object.freeze({...base,status:status==='running'?'scheduled':status,
  runAt:finite(input.runAt)?input.runAt:base.runAt,
  updatedAt:finite(input.updatedAt)?input.updatedAt:base.updatedAt,
  confirmedAt:finite(input.confirmedAt)?input.confirmedAt:null,
  startedAt:status==='running'?null:(finite(input.startedAt)?input.startedAt:null),
  completedAt:finite(input.completedAt)?input.completedAt:null,
  attempts:Math.max(0,Math.min(base.maxAttempts,Number(input.attempts)||0)),
  resultText:short(input.resultText,900),resultSources:boundedWebSources(input.resultSources),
  executionProvenance:safeProvenance(input.executionProvenance),
  errorText:short(input.errorText,240),relatedEventId:short(input.relatedEventId,96)||null});
}
const frozenCopy=t=>Object.freeze({...t,
 resultSources:Object.freeze([...(t.resultSources||[])]),
 executionProvenance:t.executionProvenance?Object.freeze({...t.executionProvenance}):null
});
export class AgentTaskQueue{
 constructor({max=MAX_AGENT_TASKS,retryDelayMs=DEFAULT_TASK_RETRY_DELAY_MS}={}){
  this.max=Math.max(1,Math.min(MAX_AGENT_TASKS,Math.floor(max)));
  this.retryDelayMs=Math.max(1000,Math.min(3600000,Number(retryDelayMs)||DEFAULT_TASK_RETRY_DELAY_MS));
  this.tasks=[];
 }
 restore(rows=[]){
  this.tasks=[];
  for(const row of Array.isArray(rows)?rows:[]){
   const task=restoreTaskRecord(row);if(!task)continue;
   if(this.tasks.some(x=>x.id===task.id||(!TERMINAL.has(x.status)&&x.idempotencyKey===task.idempotencyKey)))continue;
   this.tasks.push(task);
  }
  this.tasks.sort((a,b)=>a.createdAt-b.createdAt);this.tasks=this.tasks.slice(-this.max);
  return this.entries();
 }
 create(input={},now=Date.now()){
  const task=normalizedTaskRecord(input,now);
  const duplicate=this.tasks.find(x=>!TERMINAL.has(x.status)&&x.idempotencyKey===task.idempotencyKey);
  if(duplicate)return Object.freeze({created:false,reason:'duplicate-active-task',task:duplicate});
  this.tasks=[...this.tasks,task].slice(-this.max);
  return Object.freeze({created:true,reason:null,task});
 }
 find(id){return this.tasks.find(x=>x.id===id)||null;}
 replace(next){
  const i=this.tasks.findIndex(x=>x.id===next.id);if(i<0)return null;
  this.tasks=[...this.tasks.slice(0,i),Object.freeze(next),...this.tasks.slice(i+1)];return this.tasks[i];
 }
 confirm(id,now=Date.now()){
  const task=this.find(id);if(!task||task.status!=='pending-confirmation')return null;
  return this.replace({...task,status:'scheduled',confirmedAt:now,updatedAt:now,runAt:Math.max(now,task.runAt)});
 }
 cancel(id,now=Date.now()){
  const task=this.find(id);if(!task||TERMINAL.has(task.status)||task.status==='running')return null;
  return this.replace({...task,status:'cancelled',updatedAt:now,completedAt:now,errorText:''});
 }
 runNow(id,now=Date.now()){
  const task=this.find(id);if(!task||task.status!=='scheduled')return null;
  return this.replace({...task,runAt:now,updatedAt:now});
 }
 due(now=Date.now()){
  return this.tasks.filter(x=>x.status==='scheduled'&&x.runAt<=now)
   .sort((a,b)=>a.runAt-b.runAt||a.createdAt-b.createdAt).map(frozenCopy);
 }
 start(id,now=Date.now()){
  const task=this.find(id);if(!task||task.status!=='scheduled'||task.runAt>now)return null;
  return this.replace({...task,status:'running',attempts:task.attempts+1,startedAt:now,updatedAt:now,errorText:''});
 }
 succeed(id,result='',now=Date.now(),relatedEventId=null){
  const task=this.find(id);if(!task||task.status!=='running')return null;
  const structured=result&&typeof result==='object'?result:{summary:result};
  return this.replace({...task,status:'succeeded',completedAt:now,updatedAt:now,
   resultText:short(structured.summary,900),resultSources:boundedWebSources(structured.sources),
   executionProvenance:safeProvenance(structured.provenance),errorText:'',
   relatedEventId:short(relatedEventId,96)||task.relatedEventId});
 }
 fail(id,error,{retryable=false,now=Date.now(),relatedEventId=null}={}){
  const task=this.find(id);if(!task||task.status!=='running')return null;
  const message=short(error?.message||error||'Task failed',240);
  const common={...task,updatedAt:now,errorText:message,resultText:'',resultSources:Object.freeze([]),
   executionProvenance:null,relatedEventId:short(relatedEventId,96)||task.relatedEventId};
  if(retryable&&task.attempts<task.maxAttempts)
   return this.replace({...common,status:'scheduled',runAt:now+this.retryDelayMs,startedAt:null,completedAt:null});
  return this.replace({...common,status:'failed',completedAt:now});
 }
 removeTerminal(){const before=this.tasks.length;this.tasks=this.tasks.filter(x=>!TERMINAL.has(x.status));return before-this.tasks.length;}
 entries(){return this.tasks.map(frozenCopy);}
}

export function resolveTaskTarget(task,{scene,serverTargets=[]}={}){
 if(task?.targetSource==='server-approved')
  return normalizeServerSkillTarget((serverTargets||[]).find(target=>target?.id===task.targetId)||{});
 return localSkillTarget(normalizeRoomScene(scene||{}),task?.targetId);
}
export function describeApprovedObject(target){
 if(!target)throw Object.assign(new Error('Approved object no longer exists.'),{retryable:false});
 if(target.targetSource==='local-owner-defined')
  return target.name+' is an owner-defined '+target.kind+
   (target.area?' linked to the '+target.area.name+' camera area.':' with no owner-defined camera area assigned.')+
   ' This description comes from owner-entered scene metadata, not visual recognition.';
 return target.name+' is an approved self-hosted scene object. This description comes from approved scene metadata, not identity or visual inference.';
}
export function describeOwnerDefinedObject(scene,targetId){
 const target=localSkillTarget(normalizeRoomScene(scene),targetId);
 if(!target)throw Object.assign(new Error('Owner-defined object no longer exists.'),{retryable:false});
 return describeApprovedObject(target);
}
export async function executeRegisteredTask(task,{
 scene,serverTargets=[],explicitOwnerAction=false,cameraActive=false,documentVisible=true,
 captureImage=null,productSearch=null,now=Date.now()
}={}){
 if(!task||task.status!=='running')throw new Error('Task must be running.');
 const skill=skillDefinition(task.skillId);if(!skill)throw new Error('Skill executor unavailable.');
 const target=resolveTaskTarget(task,{scene,serverTargets});
 const policy=skillExecutionPolicy({skillId:skill.id,target,explicitOwnerAction,cameraActive,documentVisible});
 if(!policy.allow)throw Object.assign(new Error('Skill blocked: '+policy.reason),{retryable:false,reason:policy.reason});
 if(skill.id==='describe_object'){
  const summary=describeApprovedObject(target);
  return Object.freeze({summary,provenance:executionProvenance({skillId:skill.id,target,outcome:'succeeded',executedAt:now})});
 }
 if(skill.id==='capture_image'){
  if(typeof captureImage!=='function')throw Object.assign(new Error('Foreground camera capture executor unavailable.'),{retryable:false});
  const result=await captureImage({target});
  return Object.freeze({
   summary:short(result?.summary||('Captured current mapped camera area for '+target.name+'.'),900),
   sources:Object.freeze([]),
   provenance:executionProvenance({skillId:skill.id,target,outcome:'succeeded',executedAt:now,
    mediaBytes:Number(result?.mediaBytes)||0,mediaWidth:Number(result?.width)||0,mediaHeight:Number(result?.height)||0})
  });
 }
 if(skill.id==='product_search'){
  if(typeof productSearch!=='function')throw Object.assign(new Error('Product search executor unavailable.'),{retryable:false});
  const result=await productSearch({objectId:target.id});
  return Object.freeze({
   summary:short(result?.summary,900),sources:boundedWebSources(result?.sources),
   provenance:executionProvenance({skillId:skill.id,target,outcome:'succeeded',executedAt:now,
    provider:result?.provider,model:result?.model,resultCount:(result?.sources||[]).length})
  });
 }
 throw Object.assign(new Error('No executable handler for this registered skill.'),{retryable:false});
}

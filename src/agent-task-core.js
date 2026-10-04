import {normalizeRoomScene} from './room-scene-graph.js';

export const AGENT_TASK_SCHEMA=1;
export const MAX_AGENT_TASKS=200;
export const DEFAULT_TASK_RETRY_DELAY_MS=30000;
export const DEFAULT_TASK_MAX_ATTEMPTS=2;

export const AGENT_SKILLS=Object.freeze({
 describe_object:Object.freeze({
  id:'describe_object',label:'Describe owner-defined object',available:true,
  target:'scene-object',confirmation:'required',sideEffect:'read-only',
  executor:'local-describe-object'
 }),
 capture_image:Object.freeze({
  id:'capture_image',label:'Capture image',available:false,
  target:'scene-object',confirmation:'required',sideEffect:'media-capture',
  unavailableReason:'Media capture executor is not enabled in V0.10F.'
 }),
 product_search:Object.freeze({
  id:'product_search',label:'Product search',available:false,
  target:'scene-object',confirmation:'required',sideEffect:'external-network',
  unavailableReason:'External product-search provider is not enabled in V0.10F.'
 })
});
const TERMINAL=new Set(['succeeded','failed','cancelled']);
const STATUSES=new Set(['pending-confirmation','scheduled','running','succeeded','failed','cancelled']);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,n)=>String(v??'').trim().slice(0,n);
const taskId=()=>globalThis.crypto?.randomUUID?.()||
 'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

export function skillDefinition(id){return AGENT_SKILLS[String(id||'')]||null;}
export function availableSkills(){return Object.values(AGENT_SKILLS).filter(s=>s.available);}

export function normalizedTaskRecord(input={},now=Date.now()){
 const skill=skillDefinition(input.skillId);
 if(!skill)throw new Error('Unknown skill.');
 if(!skill.available)throw new Error(skill.unavailableReason||'Skill executor unavailable.');
 const targetId=short(input.targetId,96);
 if(skill.target==='scene-object'&&!targetId)throw new Error('Choose an owner-defined room object.');
 const runAt=finite(input.runAt)?Math.max(0,input.runAt):now;
 const id=short(input.id,96)||taskId();
 const key=short(input.idempotencyKey,180)||
  [skill.id,targetId,String(Math.floor(runAt/60000))].join(':');
 return Object.freeze({
  schema:AGENT_TASK_SCHEMA,id,skillId:skill.id,targetId,
  idempotencyKey:key,status:'pending-confirmation',
  runAt,createdAt:finite(input.createdAt)?input.createdAt:now,
  updatedAt:now,confirmedAt:null,startedAt:null,completedAt:null,
  attempts:0,maxAttempts:Math.max(1,Math.min(5,
   Number.isFinite(input.maxAttempts)?Math.floor(input.maxAttempts):DEFAULT_TASK_MAX_ATTEMPTS)),
  resultText:'',errorText:'',relatedEventId:short(input.relatedEventId,96)||null
 });
}
export function restoreTaskRecord(input={}){
 const skill=skillDefinition(input.skillId);
 if(!skill||!skill.available)return null;
 const status=STATUSES.has(input.status)?input.status:'failed';
 const base=normalizedTaskRecord(input,finite(input.createdAt)?input.createdAt:Date.now());
 return Object.freeze({...base,status:status==='running'?'scheduled':status,
  runAt:finite(input.runAt)?input.runAt:base.runAt,
  updatedAt:finite(input.updatedAt)?input.updatedAt:base.updatedAt,
  confirmedAt:finite(input.confirmedAt)?input.confirmedAt:null,
  startedAt:status==='running'?null:(finite(input.startedAt)?input.startedAt:null),
  completedAt:finite(input.completedAt)?input.completedAt:null,
  attempts:Math.max(0,Math.min(base.maxAttempts,Number(input.attempts)||0)),
  resultText:short(input.resultText,500),errorText:short(input.errorText,240),
  relatedEventId:short(input.relatedEventId,96)||null});
}
const frozenCopy=t=>Object.freeze({...t});
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
  this.tasks.sort((a,b)=>a.createdAt-b.createdAt);
  this.tasks=this.tasks.slice(-this.max);
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
  this.tasks=[...this.tasks.slice(0,i),Object.freeze(next),...this.tasks.slice(i+1)];
  return this.tasks[i];
 }
 confirm(id,now=Date.now()){
  const task=this.find(id);if(!task||task.status!=='pending-confirmation')return null;
  return this.replace({...task,status:'scheduled',confirmedAt:now,updatedAt:now,
   runAt:Math.max(now,task.runAt)});
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
  return this.replace({...task,status:'running',attempts:task.attempts+1,
   startedAt:now,updatedAt:now,errorText:''});
 }
 succeed(id,resultText='',now=Date.now(),relatedEventId=null){
  const task=this.find(id);if(!task||task.status!=='running')return null;
  return this.replace({...task,status:'succeeded',completedAt:now,updatedAt:now,
   resultText:short(resultText,500),errorText:'',
   relatedEventId:short(relatedEventId,96)||task.relatedEventId});
 }
 fail(id,error,{retryable=false,now=Date.now(),relatedEventId=null}={}){
  const task=this.find(id);if(!task||task.status!=='running')return null;
  const message=short(error?.message||error||'Task failed',240);
  const common={...task,updatedAt:now,errorText:message,resultText:'',
   relatedEventId:short(relatedEventId,96)||task.relatedEventId};
  if(retryable&&task.attempts<task.maxAttempts)
   return this.replace({...common,status:'scheduled',runAt:now+this.retryDelayMs,
    startedAt:null,completedAt:null});
  return this.replace({...common,status:'failed',completedAt:now});
 }
 removeTerminal(){
  const before=this.tasks.length;this.tasks=this.tasks.filter(x=>!TERMINAL.has(x.status));
  return before-this.tasks.length;
 }
 entries(){return this.tasks.map(frozenCopy);}
}

export function describeOwnerDefinedObject(scene,targetId){
 const safe=normalizeRoomScene(scene),object=safe.objects.find(x=>x.id===targetId);
 if(!object)throw Object.assign(new Error('Owner-defined object no longer exists.'),{retryable:false});
 const area=safe.areas.find(x=>x.id===object.areaId);
 return object.name+' is an owner-defined '+object.kind+
  (area?' linked to the '+area.name+' camera area.':
   ' with no owner-defined camera area assigned.')+
  ' This description comes from owner-entered scene metadata, not visual recognition.';
}

export async function executeRegisteredTask(task,{scene}={}){
 if(!task||task.status!=='running')throw new Error('Task must be running.');
 const skill=skillDefinition(task.skillId);
 if(!skill?.available)throw new Error('Skill executor unavailable.');
 if(skill.id==='describe_object')return describeOwnerDefinedObject(scene,task.targetId);
 throw new Error('No executable handler for this registered skill.');
}

import {normalizeRoomScene} from './room-scene-graph.js';
import {normalizeMemoryRecord} from './agent-memory-core.js';

export const RESOURCE_SYNC_SCHEMA=1;
export const RESOURCE_SYNC_TYPES=Object.freeze(['memory','task','scene']);
export const MAX_RESOURCE_SYNC_JOURNAL=200;
export const MAX_RESOURCE_SYNC_CHANGES=50;
export const RESOURCE_SYNC_QUOTAS=Object.freeze({
 memory:262144,task:262144,scene:65536
});
const TERMINAL_TASK_STATUSES=new Set(['succeeded','failed','cancelled']);
const short=(v,n=180)=>String(v??'').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const fnv=value=>{
 let h=0x811c9dc5;
 for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(16).padStart(8,'0');
};
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object'){
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 }
 return value;
}
export function canonicalResourceJson(value){return JSON.stringify(stable(value));}
export function resourceFingerprint(type,payload){
 return type+':'+fnv(canonicalResourceJson(projectSyncPayload(type,payload)));
}
export function resourceSyncKey(type,id){
 if(!RESOURCE_SYNC_TYPES.includes(type))throw new Error('Unsupported sync resource type.');
 const rid=short(id,96);if(!rid)throw new Error('Sync resource ID required.');
 return type+':'+rid;
}
export function defaultResourceSyncState(type,id){
 return Object.freeze({
  key:resourceSyncKey(type,id),resourceType:type,resourceId:String(id),
  serverVersion:0,lastSyncedFingerprint:null,serverUpdatedAt:null,updatedAt:0
 });
}
function boundedSources(input=[]){
 return (Array.isArray(input)?input:[]).slice(0,5).map(row=>({
  title:short(row?.title,160),url:short(row?.url,700)
 })).filter(row=>/^https:\/\//i.test(row.url));
}
function boundedTaskProvenance(input){
 if(!input||typeof input!=='object')return null;
 const keys=['contract','skillId','skillVersion','sideEffect','targetId','targetSource','outcome',
  'executedAt','authorization','provider','model','resultCount','mediaBytes','mediaWidth','mediaHeight'];
 return Object.fromEntries(Object.entries(input).filter(([key,value])=>
  keys.includes(key)&&(typeof value==='string'||finite(value))));
}
function projectTask(input={}){
 if(!input.id||!TERMINAL_TASK_STATUSES.has(input.status))
  throw new Error('Only terminal approved task metadata is sync eligible.');
 return {
  schema:Number(input.schema)||1,id:short(input.id,96),
  skillId:['describe_object','capture_image','product_search'].includes(input.skillId)?input.skillId:'describe_object',
  targetId:short(input.targetId,96),targetSource:input.targetSource==='server-approved'?'server-approved':'local-owner-defined',
  idempotencyKey:short(input.idempotencyKey,180),status:input.status,
  runAt:finite(input.runAt)?input.runAt:null,createdAt:finite(input.createdAt)?input.createdAt:null,
  updatedAt:finite(input.updatedAt)?input.updatedAt:null,confirmedAt:finite(input.confirmedAt)?input.confirmedAt:null,
  startedAt:finite(input.startedAt)?input.startedAt:null,completedAt:finite(input.completedAt)?input.completedAt:null,
  attempts:Math.max(0,Math.min(5,Number(input.attempts)||0)),
  maxAttempts:Math.max(1,Math.min(5,Number(input.maxAttempts)||2)),
  resultText:short(input.resultText,900),resultSources:boundedSources(input.resultSources),
  executionProvenance:boundedTaskProvenance(input.executionProvenance),
  errorText:short(input.errorText,240),relatedEventId:short(input.relatedEventId,96)||null
 };
}
function projectMemory(input={}){
 const memory=normalizeMemoryRecord({...input,persistent:true});
 if(memory.authority!=='owner'||memory.persistent!==true)
  throw new Error('Only owner-authorized durable memory is sync eligible.');
 return {
  schema:memory.schema,id:memory.id,type:memory.type,participantId:memory.participantId,
  text:memory.text,authority:'owner',provenance:memory.provenance,
  sourceRefs:memory.sourceRefs.map(ref=>({
   kind:ref.kind,sourceId:ref.sourceId,meetingId:ref.meetingId,
   participantId:ref.participantId,at:ref.at,fingerprint:ref.fingerprint
  })),
  approvedAt:memory.approvedAt,proposalMethod:memory.proposalMethod,
  createdAt:memory.createdAt,updatedAt:memory.updatedAt,expiresAt:memory.expiresAt,
  status:memory.status,revokedAt:memory.revokedAt,revokeReason:memory.revokeReason,
  revisions:memory.revisions.map(row=>({text:row.text,at:row.at})),persistent:true
 };
}
export function projectSyncPayload(type,input){
 if(type==='memory')return Object.freeze(projectMemory(input));
 if(type==='task')return Object.freeze(projectTask(input));
 if(type==='scene')return normalizeRoomScene(input);
 throw new Error('Unsupported sync resource type.');
}
export function resourceUpdatedMs(type,input){
 const payload=projectSyncPayload(type,input);
 if(type==='memory'||type==='task')return finite(payload.updatedAt)?payload.updatedAt:
  finite(payload.completedAt)?payload.completedAt:finite(payload.createdAt)?payload.createdAt:0;
 return 0;
}
export function syncEligibleResource(type,input){
 try{projectSyncPayload(type,input);return true;}catch{return false;}
}
export function planResourceSync({type,local=null,server=null,state=null}={}){
 const id=local?.id||server?.id||state?.resourceId||'';
 const s=state||defaultResourceSyncState(type,id);
 const sv=Math.max(0,Number(s.serverVersion)||0);
 const remoteVersion=Math.max(0,Number(server?.version)||0);
 const localFingerprint=local?resourceFingerprint(type,local):null;
 const localChanged=Boolean(local)&&s.lastSyncedFingerprint!==localFingerprint;
 if(!local){
  if(!server)return Object.freeze({action:sv>0?'clear-state':'none',reason:sv>0?'record-gone-both-sides':'no-record'});
  if(server.deleted)return Object.freeze({action:'ack-delete',reason:'server-tombstone'});
  if(sv===0)return Object.freeze({action:'pull-server',reason:'server-only-initial'});
  if(remoteVersion===sv)return Object.freeze({action:'push-delete',reason:'local-delete-pending'});
  return Object.freeze({action:'conflict',reason:'server-changed-after-local-delete'});
 }
 if(!server){
  if(sv>0)return Object.freeze({action:'conflict',reason:'server-record-missing-after-sync'});
  return Object.freeze({action:'push-upsert',reason:'browser-only-initial'});
 }
 if(sv===0)return Object.freeze({action:'conflict',reason:'initial-record-exists-both-sides'});
 if(remoteVersion<sv)return Object.freeze({action:'conflict',reason:'server-version-regressed'});
 if(server.deleted){
  if(remoteVersion>sv)return localChanged
   ?Object.freeze({action:'conflict',reason:'local-edited-after-server-delete'})
   :Object.freeze({action:'pull-delete',reason:'server-delete-newer'});
  return Object.freeze({action:'conflict',reason:'server-deleted-at-synced-version'});
 }
 if(remoteVersion>sv)return localChanged
  ?Object.freeze({action:'conflict',reason:'both-sides-changed'})
  :Object.freeze({action:'pull-server',reason:'server-newer'});
 if(localChanged)return Object.freeze({action:'push-upsert',reason:'browser-newer'});
 return Object.freeze({action:'none',reason:'already-synchronized'});
}
export function changeForResourceServer(action,{type,local=null,server=null,state=null,changeId,resolution=''}={}){
 if(!['push-upsert','push-delete'].includes(action))throw new Error('No server change for '+action);
 const id=local?.id||server?.id||state?.resourceId;
 const baseVersion=Math.max(0,Number(server?.version??state?.serverVersion)||0);
 const cid=short(changeId,96);if(!cid)throw new Error('Stable sync change ID required.');
 const base={changeId:cid,resourceType:type,resourceId:String(id),baseVersion,
  clientUpdatedAt:local?resourceUpdatedMs(type,local):Date.now(),
  ...(resolution==='browser'?{resolution:'browser'}:{})};
 if(action==='push-delete')return Object.freeze({...base,operation:'delete'});
 return Object.freeze({...base,operation:'upsert',payload:projectSyncPayload(type,local)});
}
export function resourceSyncStateAfterRecord(type,state,server,local=null,now=Date.now()){
 return Object.freeze({
  key:resourceSyncKey(type,server?.id||local?.id||state?.resourceId),
  resourceType:type,resourceId:String(server?.id||local?.id||state?.resourceId||''),
  serverVersion:Math.max(0,Number(server?.version)||0),
  lastSyncedFingerprint:local?resourceFingerprint(type,local):null,
  serverUpdatedAt:Number(server?.serverUpdatedAt)||now,updatedAt:now
 });
}
export function journalEntry({type,id,operation,baseVersion=0,serverVersion=0,changeId=null,now=Date.now()}={}){
 if(!RESOURCE_SYNC_TYPES.includes(type))throw new Error('Unsupported sync resource type.');
 if(!['push-upsert','push-delete','pull-upsert','pull-delete'].includes(operation))
  throw new Error('Invalid sync journal operation.');
 const resourceId=short(id,96);if(!resourceId)throw new Error('Resource ID required.');
 const cid=short(changeId,96)||('sync-'+fnv(type+'|'+resourceId+'|'+operation+'|'+now+'|'+Math.random()));
 return Object.freeze({
  id:cid,key:resourceSyncKey(type,resourceId),resourceType:type,resourceId,
  operation,baseVersion:Math.max(0,Number(baseVersion)||0),
  serverVersion:Math.max(0,Number(serverVersion)||0),
  status:'pending',attempts:0,createdAt:now,updatedAt:now,errorText:''
 });
}
export function retryJournalEntry(entry,error='',now=Date.now()){
 return Object.freeze({...entry,status:'pending',attempts:Math.min(9,(Number(entry.attempts)||0)+1),
  updatedAt:now,errorText:short(error,240)});
}
export function completeJournalEntry(entry,now=Date.now()){
 return Object.freeze({...entry,status:'applied',updatedAt:now,errorText:''});
}

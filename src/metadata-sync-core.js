// V0.14F pure reconciliation for explicit encrypted metadata sync.
// No network, IndexedDB, DOM, transcripts, recordings or participant biometrics here.
export const METADATA_SYNC_SCOPES=Object.freeze(['memory','task','scene']);
export const MAX_METADATA_SYNC_JOURNAL=200;
export const METADATA_SCOPE_QUOTAS=Object.freeze({memory:200,task:200,scene:4});
const clean=(v,n=120)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const stable=value=>{
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object'){
  const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;
 }
 return value;
};
function hash(value=''){
 let h=0x811c9dc5;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(16).padStart(8,'0');
}
export function metadataPayloadFingerprint(payload){
 return hash(JSON.stringify(stable(payload??null)));
}
export function metadataResourceKey(scope,id){
 if(!METADATA_SYNC_SCOPES.includes(scope))throw new Error('Unsupported metadata sync scope.');
 const resourceId=clean(id,96);if(!resourceId)throw new Error('Metadata sync resource id required.');
 return scope+':'+resourceId;
}
function sanitizeSourceRefs(input=[]){
 return (Array.isArray(input)?input:[]).slice(0,5).map(ref=>({
  kind:clean(ref?.kind,32),sourceId:clean(ref?.sourceId,96),
  meetingId:clean(ref?.meetingId,96)||null,participantId:clean(ref?.participantId,96)||null,
  at:finite(ref?.at)?ref.at:null,fingerprint:clean(ref?.fingerprint,96)||null
 })).filter(ref=>ref.kind&&ref.sourceId);
}
export function sanitizeMetadataPayload(scope,input={}){
 if(!METADATA_SYNC_SCOPES.includes(scope)||!input||typeof input!=='object')throw new Error('Invalid metadata sync payload.');
 if(scope==='memory'){
  if(input.authority!=='owner'||!['owner-authored','owner-approved-proposal'].includes(input.provenance))
   throw new Error('Only owner-authorized memory can sync.');
  const type=['preference','relationship','note'].includes(input.type)?input.type:'note';
  const text=clean(input.text,500);if(!text)throw new Error('Memory text required.');
  return Object.freeze({
   schema:Number(input.schema)>=2?2:1,id:clean(input.id,96),type,
   participantId:clean(input.participantId,96)||null,text,authority:'owner',
   provenance:input.provenance,
   sourceRefs:Object.freeze(input.provenance==='owner-approved-proposal'?sanitizeSourceRefs(input.sourceRefs):[]),
   approvedAt:finite(input.approvedAt)?input.approvedAt:null,proposalMethod:clean(input.proposalMethod,64)||null,
   createdAt:finite(input.createdAt)?input.createdAt:0,updatedAt:finite(input.updatedAt)?input.updatedAt:0,
   expiresAt:finite(input.expiresAt)?input.expiresAt:null,status:input.status==='revoked'?'revoked':'active',
   revokedAt:finite(input.revokedAt)?input.revokedAt:null,revokeReason:clean(input.revokeReason,160),
   revisions:Object.freeze((Array.isArray(input.revisions)?input.revisions:[]).slice(-20)
    .map(row=>({text:clean(row?.text,500),at:finite(row?.at)?row.at:0})).filter(row=>row.text)),
   persistent:true
  });
 }
 if(scope==='task'){
  if(!['describe_object','capture_image','product_search'].includes(input.skillId))throw new Error('Unsupported task skill.');
  const statuses=['pending-confirmation','scheduled','running','succeeded','failed','cancelled'];
  const sourceRefs=(Array.isArray(input.resultSources)?input.resultSources:[]).slice(0,5)
   .map(row=>({title:clean(row?.title,160),url:clean(row?.url,700)}))
   .filter(row=>/^https:\/\//i.test(row.url));
  const provenance=input.executionProvenance&&typeof input.executionProvenance==='object'
   ?Object.fromEntries(Object.entries(input.executionProvenance).filter(([key,value])=>
     ['contract','skillId','skillVersion','sideEffect','targetId','targetSource','outcome','executedAt',
      'authorization','provider','model','resultCount','mediaBytes','mediaWidth','mediaHeight'].includes(key)&&
     (typeof value==='string'||finite(value))))
   :null;
  return Object.freeze({
   schema:Number(input.schema)>=2?2:1,id:clean(input.id,96),skillId:input.skillId,
   targetId:clean(input.targetId,96),targetSource:input.targetSource==='server-approved'?'server-approved':'local-owner-defined',
   idempotencyKey:clean(input.idempotencyKey,180),status:statuses.includes(input.status)?input.status:'failed',
   runAt:finite(input.runAt)?input.runAt:0,createdAt:finite(input.createdAt)?input.createdAt:0,
   updatedAt:finite(input.updatedAt)?input.updatedAt:0,confirmedAt:finite(input.confirmedAt)?input.confirmedAt:null,
   startedAt:finite(input.startedAt)?input.startedAt:null,completedAt:finite(input.completedAt)?input.completedAt:null,
   attempts:Math.max(0,Math.min(5,Number(input.attempts)||0)),maxAttempts:Math.max(1,Math.min(5,Number(input.maxAttempts)||2)),
   resultText:clean(input.resultText,900),resultSources:Object.freeze(sourceRefs),executionProvenance:provenance,
   errorText:clean(input.errorText,240),relatedEventId:clean(input.relatedEventId,96)||null
  });
 }
 const areas=(Array.isArray(input.areas)?input.areas:[]).slice(0,16).map(area=>({
  id:clean(area?.id,96),name:clean(area?.name,64),
  kind:['zone','entrance','desk','seat','other'].includes(area?.kind)?area.kind:'zone',
  rect:area?.rect&&['x','y','width','height'].every(k=>finite(area.rect[k]))
   ?{x:area.rect.x,y:area.rect.y,width:area.rect.width,height:area.rect.height}:null,
  provenance:'owner-defined'
 })).filter(area=>area.id&&area.name&&area.rect);
 const areaIds=new Set(areas.map(area=>area.id));
 const objects=(Array.isArray(input.objects)?input.objects:[]).slice(0,32).map(object=>({
  id:clean(object?.id,96),name:clean(object?.name,64),
  kind:['furniture','device','other'].includes(object?.kind)?object.kind:'other',
  areaId:areaIds.has(object?.areaId)?object.areaId:null,
  skills:Object.freeze([...new Set((Array.isArray(object?.skills)?object.skills:[])
   .filter(skill=>['describe_object','capture_image','product_search'].includes(skill)))].slice(0,3)),
  provenance:'owner-defined'
 })).filter(object=>object.id&&object.name);
 const calibration=input.calibration&&typeof input.calibration==='object'
  ?JSON.parse(JSON.stringify(input.calibration)):null;
 return Object.freeze({
  version:Math.max(1,Math.min(20,Number(input.version)||1)),id:'local-room',
  roomIdentityId:clean(input.roomIdentityId,96)||'room-local',
  roomName:clean(input.roomName,96)||'Local room',
  areas:Object.freeze(areas),objects:Object.freeze(objects),calibration
 });
}
export function metadataLocalResource(scope,input){
 if(!input)return null;
 const payload=sanitizeMetadataPayload(scope,input);
 const id=scope==='scene'?'local-room':clean(payload.id,96);
 if(!id)return null;
 return Object.freeze({scope,id,key:metadataResourceKey(scope,id),payload,
  fingerprint:metadataPayloadFingerprint(payload)});
}
export function defaultMetadataSyncState(scope,id){
 return Object.freeze({key:metadataResourceKey(scope,id),scope,id:clean(id,96),enabled:false,
  serverVersion:0,lastSyncedFingerprint:null,serverUpdatedAt:null,updatedAt:0});
}
export function normalizeMetadataSyncState(input={}){
 const scope=String(input.scope||''),id=clean(input.id,96),key=metadataResourceKey(scope,id);
 return Object.freeze({key,scope,id,enabled:input.enabled===true,
  serverVersion:Math.max(0,Number(input.serverVersion)||0),
  lastSyncedFingerprint:clean(input.lastSyncedFingerprint,96)||null,
  serverUpdatedAt:finite(input.serverUpdatedAt)?input.serverUpdatedAt:null,
  updatedAt:finite(input.updatedAt)?input.updatedAt:0});
}
export function planMetadataSync({local=null,server=null,state=null}={}){
 const scope=local?.scope||server?.scope||state?.scope;
 const id=local?.id||server?.id||state?.id;
 const s=state?normalizeMetadataSyncState(state):defaultMetadataSyncState(scope,id);
 if(!s.enabled)return Object.freeze({action:'disabled',reason:'sync-disabled'});
 const sv=s.serverVersion,remoteVersion=Math.max(0,Number(server?.version)||0);
 const localChanged=Boolean(local)&&local.fingerprint!==s.lastSyncedFingerprint;
 if(!local){
  if(!server)return Object.freeze({action:'none',reason:'no-record'});
  if(server.deleted)return Object.freeze({action:'ack-delete',reason:'server-tombstone'});
  if(sv===0)return Object.freeze({action:'pull-server',reason:'server-only-initial'});
  if(remoteVersion!==sv)return Object.freeze({action:'conflict',reason:'server-changed-after-local-delete'});
  return Object.freeze({action:'push-delete',reason:'local-delete-pending'});
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
  return localChanged
   ?Object.freeze({action:'conflict',reason:'local-recreated-after-server-delete'})
   :Object.freeze({action:'pull-delete',reason:'server-tombstone-at-synced-version'});
 }
 if(remoteVersion>sv)return localChanged
  ?Object.freeze({action:'conflict',reason:'both-sides-changed'})
  :Object.freeze({action:'pull-server',reason:'server-newer'});
 if(localChanged)return Object.freeze({action:'push-upsert',reason:'browser-newer'});
 return Object.freeze({action:'none',reason:'already-synchronized'});
}
export function metadataChangeForServer(action,{local=null,server=null,state=null,resolution='',deviceId=''}={}){
 const scope=local?.scope||server?.scope||state?.scope,id=local?.id||server?.id||state?.id;
 metadataResourceKey(scope,id);
 const baseVersion=Math.max(0,Number(server?.version??state?.serverVersion)||0);
 const base={scope,id,baseVersion,deviceId:clean(deviceId,96),clientUpdatedAt:Date.now(),
  ...(resolution==='browser'?{resolution:'browser'}:{})};
 if(!base.deviceId)throw new Error('Authorized sync device required.');
 if(action==='push-delete')return Object.freeze({...base,operation:'delete'});
 if(action==='push-upsert'){
  if(!local?.payload)throw new Error('Local metadata resource required.');
  return Object.freeze({...base,operation:'upsert',payload:local.payload,fingerprint:local.fingerprint});
 }
 throw new Error('No metadata server change for '+action);
}
export function metadataStateAfterServerRecord(state,server,local=null,now=Date.now()){
 return normalizeMetadataSyncState({
  scope:server?.scope||local?.scope||state?.scope,id:server?.id||local?.id||state?.id,
  enabled:true,serverVersion:Math.max(0,Number(server?.version)||0),
  lastSyncedFingerprint:server?.deleted?null:(local?.fingerprint||metadataPayloadFingerprint(server?.payload)),
  serverUpdatedAt:Number(server?.serverUpdatedAt)||now,updatedAt:now
 });
}
export function normalizeMetadataJournalEntry(input={}){
 const scope=String(input.scope||''),id=clean(input.id,96),key=metadataResourceKey(scope,id);
 const operation=input.operation==='delete'?'delete':'upsert';
 return Object.freeze({
  id:clean(input.journalId,96)||'journal-'+hash([key,operation,input.baseVersion||0,input.createdAt||Date.now()].join('|')),
  key,scope,id,operation,baseVersion:Math.max(0,Number(input.baseVersion)||0),
  attempts:Math.max(0,Math.min(5,Number(input.attempts)||0)),
  createdAt:finite(input.createdAt)?input.createdAt:Date.now(),
  updatedAt:finite(input.updatedAt)?input.updatedAt:Date.now(),
  lastError:clean(input.lastError,240)
 });
}
export function journalForPlan(plan,{scope,id,server=null,state=null,now=Date.now()}={}){
 if(!['push-upsert','push-delete'].includes(plan?.action))return null;
 return normalizeMetadataJournalEntry({scope,id,operation:plan.action==='push-delete'?'delete':'upsert',
  baseVersion:Math.max(0,Number(server?.version??state?.serverVersion)||0),createdAt:now,updatedAt:now});
}

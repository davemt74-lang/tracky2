// V0.10H pure reconciliation rules for explicit/manual participant sync.
// No network, IndexedDB or DOM access here.
const BIOMETRIC_FIELDS=Object.freeze([
 'primaryPhoto','latestPhoto','faceSamples','faceEmbeddings','embeddings',
 'voiceSamples','voiceEmbedding','voiceEmbeddings','voiceProfileSamples'
]);
export function participantUpdatedMs(local){
 const parsed=Date.parse(local?.updatedAt||'');
 return Number.isFinite(parsed)?parsed:0;
}
export function participantHasBiometrics(local){
 if(!local||typeof local!=='object')return false;
 return BIOMETRIC_FIELDS.some(key=>{
  const value=local[key];
  return Array.isArray(value)?value.length>0:Boolean(value);
 });
}
export function defaultParticipantSyncState(participantId){
 return Object.freeze({participantId:String(participantId||''),enabled:false,serverVersion:0,
  lastSyncedLocalUpdatedAt:null,localDeletedAt:null,consentConfirmedAt:null,
  serverUpdatedAt:null,updatedAt:0});
}
export function localParticipantChanged(local,state){
 if(!local)return false;
 const at=participantUpdatedMs(local);
 return !Number.isFinite(state?.lastSyncedLocalUpdatedAt)||
  at!==Number(state.lastSyncedLocalUpdatedAt);
}
export function planParticipantSync({local=null,server=null,state=null}={}){
 const s=state||defaultParticipantSyncState(local?.id||server?.id||'');
 if(!s.enabled)return Object.freeze({action:'disabled',reason:'sync-disabled'});
 const localChanged=localParticipantChanged(local,s);
 const sv=Math.max(0,Number(s.serverVersion)||0);
 const remoteVersion=Math.max(0,Number(server?.version)||0);
 if(s.localDeletedAt){
  if(!server)return Object.freeze({action:'clear-local-state',reason:'never-existed-on-server'});
  if(server.deleted)return Object.freeze({action:'ack-delete',reason:'server-already-deleted'});
  if(remoteVersion!==sv)return Object.freeze({action:'conflict',reason:'server-changed-after-local-delete'});
  return Object.freeze({action:'push-delete',reason:'local-delete-pending'});
 }
 if(!local){
  if(!server)return Object.freeze({action:'none',reason:'no-record'});
  if(server.deleted)return Object.freeze({action:'ack-delete',reason:'server-tombstone'});
  if(sv===0)return Object.freeze({action:'pull-server',reason:'server-only-initial'});
  return Object.freeze({action:'conflict',reason:'local-record-missing'});
 }
 if(!server){
  if(sv>0)return Object.freeze({action:'conflict',reason:'server-record-missing-after-sync'});
  return Object.freeze({action:'push-upsert',reason:'browser-only-initial'});
 }
 if(sv===0)return Object.freeze({action:'conflict',reason:'initial-record-exists-both-sides'});
 if(remoteVersion<sv)return Object.freeze({action:'conflict',reason:'server-version-regressed'});
 if(server.deleted){
  if(remoteVersion>sv){
   return localChanged?
    Object.freeze({action:'conflict',reason:'local-edited-after-server-delete'}):
    Object.freeze({action:'pull-delete',reason:'server-delete-newer'});
  }
  return Object.freeze({action:'conflict',reason:'server-deleted-at-synced-version'});
 }
 if(remoteVersion>sv){
  return localChanged?
   Object.freeze({action:'conflict',reason:'both-sides-changed'}):
   Object.freeze({action:'pull-server',reason:'server-newer'});
 }
 if(localChanged)return Object.freeze({action:'push-upsert',reason:'browser-newer'});
 return Object.freeze({action:'none',reason:'already-synchronized'});
}
export function syncStateAfterServerRecord(state,server,local=null,now=Date.now()){
 return Object.freeze({
  participantId:String(server?.id||local?.id||state?.participantId||''),
  enabled:true,serverVersion:Math.max(0,Number(server?.version)||0),
  lastSyncedLocalUpdatedAt:local?participantUpdatedMs(local):null,
  localDeletedAt:null,consentConfirmedAt:Number(state?.consentConfirmedAt)||null,
  serverUpdatedAt:Number(server?.serverUpdatedAt)||now,updatedAt:now
 });
}
export function changeForServer(action,{local=null,server=null,state=null,resolution=''}={}){
 const baseVersion=Math.max(0,Number(server?.version??state?.serverVersion)||0);
 if(action==='push-delete')return Object.freeze({
  id:String(state?.participantId||server?.id||local?.id||''),operation:'delete',baseVersion,
  clientUpdatedAt:Number(state?.localDeletedAt)||Date.now(),
  ...(resolution==='browser'?{resolution:'browser'}:{})
 });
 if(action==='push-upsert'){
  if(!local)throw new Error('Local participant required.');
  return Object.freeze({id:String(local.id),operation:'upsert',baseVersion,
   name:String(local.name||''),profile:local,consent:Boolean(state?.consentConfirmedAt),
   clientUpdatedAt:participantUpdatedMs(local)||Date.now(),
   ...(resolution==='browser'?{resolution:'browser'}:{})});
 }
 throw new Error('No server change for '+action);
}

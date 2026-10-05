// Account-backed participant persistence for signed-in Tracky2 installs.
// Ordinary profile fields may sync automatically; biometric material is included only
// when the participant explicitly enables encrypted cross-device biometric sync.
const BIOMETRIC_FIELDS=Object.freeze([
 'primaryPhoto','latestPhoto','embeddings','faceSamples',
 'voiceEmbeddings','voiceProfileSamples','voiceProfileReady','voiceUpdatedAt'
]);
const PROFILE_FIELDS=Object.freeze([
 'nickname','notes','recognitionEnabled','agentGreetingEnabled','agentProactiveEnabled',
 'voiceRecognitionEnabled','createdAt','updatedAt','lastSeenAt','gamesPlayed'
]);
const short=(v,n=500)=>String(v??'').trim().slice(0,n);

export function participantServerProfile(input={},biometricConsent=false){
 const profile={};
 for(const key of PROFILE_FIELDS){
  const value=input[key];
  if(value!==undefined)profile[key]=value;
 }
 profile.nickname=short(profile.nickname,80);
 profile.notes=short(profile.notes,500);
 if(biometricConsent){
  for(const key of BIOMETRIC_FIELDS){
   const value=input[key];
   if(value!==undefined)profile[key]=value;
  }
 }
 return Object.freeze(profile);
}
export function participantHasLocalBiometrics(input={}){
 return BIOMETRIC_FIELDS.some(key=>{
  const value=input?.[key];
  return Array.isArray(value)?value.length>0:Boolean(value);
 });
}
export function mergeServerParticipant(local,serverRecord){
 if(!serverRecord||serverRecord.deleted)return null;
 const server=serverRecord.profile&&typeof serverRecord.profile==='object'?serverRecord.profile:{};
 const biometricConsent=serverRecord.biometricConsent===true||serverRecord.consent===true;
 const base={...(local||{}),...server,id:serverRecord.id,name:serverRecord.name};
 if(!biometricConsent&&local){
  for(const key of BIOMETRIC_FIELDS){
   if(local[key]!==undefined)base[key]=local[key];
   else delete base[key];
  }
 }
 base.accountBiometricSyncEnabled=biometricConsent;
 return base;
}
export function accountSyncDecision({local=null,server=null,state=null}={}){
 const serverVersion=Math.max(0,Number(state?.serverVersion)||0);
 const pending=state?.pending===true;
 if(!local&&!server)return Object.freeze({action:'none',reason:'no-record'});
 if(!local&&server){
  if(server.deleted)return Object.freeze({action:'ack-delete',reason:'deleted-both-sides'});
  if(state?.localDeletedAt&&Number(server.version)===serverVersion)
   return Object.freeze({action:'push-delete',reason:'offline-local-delete'});
  return Object.freeze({action:'pull-server',reason:'server-participant'});
 }
 if(local&&!server)return Object.freeze({action:'push-local',reason:pending?'offline-local-create':'initial-local-create'});
 if(server?.deleted){
  if(pending)return Object.freeze({action:'conflict',reason:'local-edit-after-server-delete'});
  return Object.freeze({action:'pull-delete',reason:'server-delete'});
 }
 if(!pending)return Object.freeze({action:'pull-server',reason:'server-authoritative'});
 if(Number(server.version)!==serverVersion)
  return Object.freeze({action:'conflict',reason:'server-changed-during-local-edit'});
 return Object.freeze({action:'push-local',reason:'pending-local-edit'});
}
export function normalizeAccountParticipantState(input={}){
 const participantId=short(input.participantId,96);
 if(!participantId)throw new Error('participantId required');
 return Object.freeze({
  participantId,
  serverVersion:Math.max(0,Number(input.serverVersion)||0),
  serverUpdatedAt:Number.isFinite(input.serverUpdatedAt)?input.serverUpdatedAt:null,
  lastSyncedLocalUpdatedAt:input.lastSyncedLocalUpdatedAt||null,
  pending:input.pending===true,
  localDeletedAt:Number.isFinite(input.localDeletedAt)?input.localDeletedAt:null,
  conflict:input.conflict===true,
  errorText:short(input.errorText,240),
  updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now()
 });
}
export function stateAfterServerRecord(state,server,local=null,now=Date.now()){
 return normalizeAccountParticipantState({
  participantId:server.id,serverVersion:server.version,
  serverUpdatedAt:server.serverUpdatedAt,
  lastSyncedLocalUpdatedAt:local?.updatedAt||null,
  pending:false,localDeletedAt:null,conflict:false,errorText:'',updatedAt:now
 });
}

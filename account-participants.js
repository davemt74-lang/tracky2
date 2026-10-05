import {
 deleteAccountParticipantSyncState,deleteParticipant,getParticipant,listAccountParticipantSyncStates,
 listParticipants,saveAccountParticipantSyncState,saveParticipant
} from './src/participant-store.js';
import {
 accountSyncDecision,mergeServerParticipant,normalizeAccountParticipantState,
 participantServerProfile,stateAfterServerRecord
} from './src/account-participant-core.js';

let running=false,scheduled=0,lastSession=null;
const emit=detail=>{
 try{window.dispatchEvent(new CustomEvent('tracky:account-participant-sync',{detail}));}catch{}
};
const session=async()=>{
 const response=await fetch('./server/session.php',{credentials:'same-origin',headers:{Accept:'application/json'}});
 if(response.status===401)return {authenticated:false,permissions:[]};
 if(!response.ok)throw new Error('Tracky2 account session unavailable.');
 return response.json();
};
const inventory=async()=>{
 const response=await fetch('./server/account-participants-api.php',{credentials:'same-origin',headers:{Accept:'application/json'}});
 if(response.status===401||response.status===403)throw new Error('Participant account access is not authorized.');
 if(!response.ok)throw new Error('Account participant inventory failed ('+response.status+').');
 const data=await response.json();if(!Array.isArray(data.records))throw new Error('Invalid participant account inventory.');
 return data.records;
};
const post=async(change,csrf)=>{
 const response=await fetch('./server/account-participants-api.php',{
  method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,Accept:'application/json'},
  body:JSON.stringify({changes:[change]})
 });
 const data=await response.json().catch(()=>({}));
 if(response.status===401||response.status===403)throw new Error('Participant account write is no longer authorized.');
 if(!response.ok)throw new Error(data.error||'Participant account write failed ('+response.status+').');
 const result=data.results?.[0];if(!result)throw new Error('Participant account write returned no result.');
 return result;
};
const localUpdatedAt=local=>{
 const parsed=Date.parse(local?.updatedAt||'');return Number.isFinite(parsed)?parsed:Date.now();
};
async function applyServer(server,state,local){
 if(server.deleted){
  if(local)await deleteParticipant(server.id,{accountSync:false});
  await saveAccountParticipantSyncState(normalizeAccountParticipantState({
   participantId:server.id,serverVersion:server.version,serverUpdatedAt:server.serverUpdatedAt,
   lastSyncedLocalUpdatedAt:null,pending:false,localDeletedAt:null,conflict:false,updatedAt:Date.now()
  }));
  return null;
 }
 const merged=mergeServerParticipant(local,server);
 const saved=await saveParticipant(merged,{accountSync:false});
 await saveAccountParticipantSyncState(stateAfterServerRecord(state,server,saved,Date.now()));
 return saved;
}
async function pushLocal(id,local,server,state,csrf){
 const deleting=!local;
 const change={
  id,operation:deleting?'delete':'upsert',
  baseVersion:Number(server?.version??state?.serverVersion)||0,
  clientUpdatedAt:deleting?Date.now():localUpdatedAt(local)
 };
 if(local){
  change.name=local.name;
  change.biometricConsent=local.accountBiometricSyncEnabled===true;
  change.profile=participantServerProfile(local,change.biometricConsent);
 }
 const result=await post(change,csrf);
 if(result.status==='conflict'){
  const remote=result.server||server;
  const remoteVersion=Math.max(0,Number(remote?.version)||0);
  await saveAccountParticipantSyncState(normalizeAccountParticipantState({
   ...state,participantId:id,serverVersion:remoteVersion,
   serverUpdatedAt:remote?.serverUpdatedAt??state?.serverUpdatedAt??null,
   pending:false,conflict:true,errorText:'Changed on another signed-in device. Edit and save again to keep this device copy.',
   updatedAt:Date.now()
  }));
  emit({status:'conflict',participantId:id});
  return 'conflict';
 }
 if(result.status!=='applied'||!result.record)throw new Error(result.error||'Participant account write was rejected.');
 const current=result.record.deleted?null:await getParticipant(id);
 await saveAccountParticipantSyncState(stateAfterServerRecord(state,result.record,current,Date.now()));
 return 'applied';
}
export async function syncAccountParticipants({reason='manual'}={}){
 if(running)return {status:'busy'};running=true;
 let applied=0,conflicts=0;
 try{
  const account=await session();lastSession=account;
  const permissions=Array.isArray(account.permissions)?account.permissions:[];
  if(!account.authenticated){
   emit({status:'signed-out',reason});return {status:'signed-out'};
  }
  if(!permissions.includes('participants.read')){
   emit({status:'read-denied',reason});return {status:'read-denied'};
  }
  const canWrite=permissions.includes('participants.write');
  const [locals,states,servers]=await Promise.all([listParticipants(),listAccountParticipantSyncStates(),inventory()]);
  const localMap=new Map(locals.map(row=>[row.id,row]));
  const stateMap=new Map(states.map(row=>[row.participantId,row]));
  const serverMap=new Map(servers.map(row=>[row.id,row]));
  const ids=[...new Set([...localMap.keys(),...stateMap.keys(),...serverMap.keys()])].sort();
  for(const id of ids){
   const local=localMap.get(id)||null,server=serverMap.get(id)||null;
   let state=normalizeAccountParticipantState(stateMap.get(id)||{participantId:id});
   if(state.conflict&&!state.pending){conflicts++;continue;}
   if(!local&&!server){
    if(state.pending||state.localDeletedAt)await deleteAccountParticipantSyncState(id);
    continue;
   }
   const plan=accountSyncDecision({local,server,state});
   if(plan.action==='none')continue;
   if(plan.action==='ack-delete'){
    await saveAccountParticipantSyncState(normalizeAccountParticipantState({
     ...state,participantId:id,serverVersion:Number(server?.version)||state.serverVersion,
     serverUpdatedAt:server?.serverUpdatedAt??state.serverUpdatedAt,pending:false,
     localDeletedAt:null,conflict:false,errorText:'',updatedAt:Date.now()
    }));continue;
   }
   if(plan.action==='conflict'){
    await saveAccountParticipantSyncState(normalizeAccountParticipantState({
     ...state,serverVersion:Number(server?.version)||state.serverVersion,
     serverUpdatedAt:server?.serverUpdatedAt??state.serverUpdatedAt,pending:false,conflict:true,
     errorText:'Changed on another signed-in device. Edit and save again to keep this device copy.',
     updatedAt:Date.now()
    }));conflicts++;continue;
   }
   if(plan.action==='pull-server'||plan.action==='pull-delete'){
    await applyServer(server,state,local);applied++;continue;
   }
   if(plan.action==='push-local'||plan.action==='push-delete'){
    if(!canWrite)continue;
    const result=await pushLocal(id,local,server,state,account.csrf);
    if(result==='conflict')conflicts++;else applied++;
   }
  }
  emit({status:conflicts?'conflict':'connected',reason,applied,conflicts,
   username:account.user?.username||'',role:account.user?.role||''});
  return {status:conflicts?'conflict':'connected',applied,conflicts};
 }catch(error){
  emit({status:'error',reason,error:error.message});return {status:'error',error:error.message};
 }finally{running=false;}
}
function schedule(reason='local-change'){
 clearTimeout(scheduled);scheduled=setTimeout(()=>void syncAccountParticipants({reason}),180);
}
window.addEventListener('tracky:participant-account-change',()=>schedule('local-change'));
window.addEventListener('online',()=>schedule('online'));
window.addEventListener('focus',()=>schedule('focus'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule('visible');});
window.trackyAccountParticipants=Object.freeze({
 syncNow:()=>syncAccountParticipants({reason:'control-center'}),
 session:()=>lastSession
});
void syncAccountParticipants({reason:'page-load'});

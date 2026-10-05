import {
 clearAppliedResourceSyncJournal,clearRoomScene,deleteAgentMemory,deleteAgentTask,
 deleteResourceSyncJournal,deleteResourceSyncState,getResourceSyncConfig,listAgentMemories,
 listAgentTasks,listResourceSyncJournal,listResourceSyncStates,loadRoomScene,
 saveAgentMemory,saveAgentTask,saveResourceSyncConfig,saveResourceSyncJournal,
 saveResourceSyncState,saveRoomScene
} from '../src/participant-store.js';
import {
 changeForResourceServer,completeJournalEntry,defaultResourceSyncState,journalEntry,
 planResourceSync,projectSyncPayload,resourceFingerprint,resourceSyncKey,
 resourceSyncStateAfterRecord,retryJournalEntry,syncEligibleResource
} from '../src/resource-sync-core.js';

const form=document.getElementById('resourceSyncDeviceForm');
const label=document.getElementById('resourceSyncDeviceLabel');
const refreshButton=document.getElementById('resourceSyncRefresh');
const resumeButton=document.getElementById('resourceSyncResume');
const revokeButton=document.getElementById('resourceSyncRevoke');
const status=document.getElementById('resourceSyncStatus');
const list=document.getElementById('resourceSyncList');
const token=document.querySelector('input[name="csrf"]')?.value||'';
let busy=false,serverCache=new Map();

const text=(value,max=180)=>String(value??'').trim().slice(0,max);
const makeDeviceId=()=>globalThis.crypto?.randomUUID
 ?'device-'+crypto.randomUUID()
 :'device-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
const scopeInputs=()=>[...(form?.querySelectorAll('input[name="resourceScope"]')||[])];
const selectedScopes=()=>scopeInputs().filter(input=>input.checked).map(input=>input.value);
const setStatus=value=>{if(status)status.textContent=value;};
const node=(tag,value='',className='')=>{
 const el=document.createElement(tag);if(value)el.textContent=value;if(className)el.className=className;return el;
};
function recordKey(record){return resourceSyncKey(record.resourceType,record.id);}
function typeLabel(type){return ({memory:'Memory',task:'Terminal task',scene:'Scene configuration'})[type]||type;}
async function post(body){
 const response=await fetch('./resource-sync-api.php',{
  method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json','X-CSRF-Token':token,Accept:'application/json'},
  body:JSON.stringify(body)
 });
 const data=await response.json().catch(()=>({}));
 if(response.status===401||response.status===403)
  throw new Error('Your server session, CSRF token or sync permission is no longer valid.');
 if(!response.ok)throw new Error(data.error||'Metadata sync request failed ('+response.status+').');
 return data;
}
async function configOrNew(){
 const existing=await getResourceSyncConfig();
 if(existing)return existing;
 return saveResourceSyncConfig({
  deviceId:makeDeviceId(),label:'This browser',scopes:[],cursor:0,registered:false,updatedAt:Date.now()
 });
}
async function serverInventory(config,{snapshot=true}={}){
 if(!config.registered)throw new Error('Register this browser and choose resource scopes first.');
 const cursor=snapshot?0:config.cursor;
 const response=await fetch('./resource-sync-api.php?deviceId='+encodeURIComponent(config.deviceId)+
  '&cursor='+encodeURIComponent(cursor),{credentials:'same-origin',headers:{Accept:'application/json'}});
 const data=await response.json().catch(()=>({}));
 if(response.status===401||response.status===403)throw new Error('This browser sync device or server session is no longer authorized.');
 if(!response.ok)throw new Error(data.error||'Metadata sync inventory failed ('+response.status+').');
 const records=[];
 if(snapshot)serverCache.clear();
 if(Array.isArray(data.records))records.push(...data.records);
 for(const event of Array.isArray(data.events)?data.events:[])if(event?.record)records.push(event.record);
 for(const record of records)serverCache.set(recordKey(record),record);
 const next=await saveResourceSyncConfig({...config,cursor:Number(data.cursor)||0,
  scopes:(data.scopes||[]).filter(row=>row?.enabled).map(row=>row.resource_type),
  registered:true,revokedAt:null,lastSyncAt:Date.now(),updatedAt:Date.now()});
 return {config:next,data};
}
async function localResources(scopes){
 const map=new Map();
 if(scopes.includes('memory')){
  for(const memory of await listAgentMemories())
   if(syncEligibleResource('memory',memory))map.set(resourceSyncKey('memory',memory.id),{type:'memory',record:memory});
 }
 if(scopes.includes('task')){
  for(const task of await listAgentTasks())
   if(syncEligibleResource('task',task))map.set(resourceSyncKey('task',task.id),{type:'task',record:task});
 }
 if(scopes.includes('scene')){
  const scene=await loadRoomScene();
  if(syncEligibleResource('scene',scene))map.set(resourceSyncKey('scene',scene.id),{type:'scene',record:scene});
 }
 return map;
}
function currentRecord(localMap,type,id){return localMap.get(resourceSyncKey(type,id))?.record||null;}
async function applyServerRecord(type,server,state){
 if(!server)throw new Error('Server resource disappeared. Refresh and review again.');
 if(server.deleted){
  if(type==='memory')await deleteAgentMemory(server.id);
  else if(type==='task')await deleteAgentTask(server.id);
  else throw new Error('Scene configuration cannot be deleted through metadata sync.');
  const next=resourceSyncStateAfterRecord(type,state,server,null,Date.now());
  await saveResourceSyncState(next);return null;
 }
 if(!server.payload||typeof server.payload!=='object')throw new Error('Server resource payload is unavailable.');
 let saved;
 if(type==='memory')saved=await saveAgentMemory(server.payload);
 else if(type==='task')saved=await saveAgentTask(server.payload);
 else if(type==='scene')saved=await saveRoomScene(server.payload);
 else throw new Error('Unsupported sync resource type.');
 await saveResourceSyncState(resourceSyncStateAfterRecord(type,state,server,saved,Date.now()));
 return saved;
}
async function postJournal(entry,localMap,{resolution=''}={}){
 const local=currentRecord(localMap,entry.resourceType,entry.resourceId);
 if(entry.operation==='push-upsert'){
  if(!local)throw new Error('Local resource was deleted after this journal entry was created.');
  const nowFingerprint=resourceFingerprint(entry.resourceType,local);
  if(entry.localFingerprint&&entry.localFingerprint!==nowFingerprint)
   throw new Error('Local resource changed after this journal entry was created. Refresh and review again.');
 }else if(entry.operation==='push-delete'&&local){
  throw new Error('Local resource exists again. The pending delete is stale.');
 }
 const stateMap=new Map((await listResourceSyncStates()).map(row=>[row.key,row]));
 const state=stateMap.get(entry.key)||defaultResourceSyncState(entry.resourceType,entry.resourceId);
 const server={id:entry.resourceId,version:entry.baseVersion};
 const action=entry.operation==='push-delete'?'push-delete':'push-upsert';
 const change=changeForResourceServer(action,{
  type:entry.resourceType,local,server,state,changeId:entry.id,resolution
 });
 const data=await post({action:'sync',deviceId:(await configOrNew()).deviceId,changes:[change]});
 const result=data.results?.[0];
 if(!result)throw new Error('Server returned no metadata sync result.');
 if(result.status==='conflict')throw Object.assign(new Error('Server changed before this write completed.'),{conflict:true});
 if(result.status!=='applied'||!result.record)throw new Error(result.error||'Server rejected metadata sync.');
 const finalLocal=result.record.deleted?null:local;
 await saveResourceSyncState(resourceSyncStateAfterRecord(entry.resourceType,state,result.record,finalLocal,Date.now()));
 await saveResourceSyncJournal(completeJournalEntry(entry,Date.now()));
 serverCache.set(recordKey(result.record),result.record);
 return result.record;
}
async function clearPendingForKey(key){
 const rows=await listResourceSyncJournal();
 for(const row of rows)if(row.status==='pending'&&row.key===key)await deleteResourceSyncJournal(row.id);
}
async function pushPlan(type,id,plan,local,server,state,{resolution=''}={}){
 if(type==='scene'&&plan.action==='push-delete')throw new Error('Scene deletion is not a sync operation; save an empty scene configuration instead.');
 const operation=plan.action==='push-delete'?'push-delete':'push-upsert';
 await clearPendingForKey(resourceSyncKey(type,id));
 const entry=journalEntry({
  type,id,operation,baseVersion:Number(server?.version??state?.serverVersion)||0,
  localFingerprint:local?resourceFingerprint(type,local):null,now:Date.now()
 });
 await saveResourceSyncJournal(entry);
 try{
  const localMap=await localResources((await configOrNew()).scopes);
  await postJournal(entry,localMap,{resolution});
  setStatus(typeLabel(type)+' synchronized to server.');
 }catch(error){
  await saveResourceSyncJournal(retryJournalEntry(entry,error.message,Date.now()));
  throw error;
 }
}
async function pullPlan(type,id,server,state){
 await clearPendingForKey(resourceSyncKey(type,id));
 const operation=server?.deleted?'pull-delete':'pull-upsert';
 const entry=journalEntry({type,id,operation,serverVersion:Number(server?.version)||0,now:Date.now()});
 await saveResourceSyncJournal(entry);
 try{
  await applyServerRecord(type,server,state);
  await saveResourceSyncJournal(completeJournalEntry(entry,Date.now()));
  setStatus(typeLabel(type)+' synchronized to this browser.');
 }catch(error){
  await saveResourceSyncJournal(retryJournalEntry(entry,error.message,Date.now()));
  throw error;
 }
}
function planText(plan){
 return ({
  none:'Already synchronized','push-upsert':'Browser version ready to send',
  'push-delete':'Browser deletion ready to send','pull-server':'Server version ready to apply',
  'pull-delete':'Server deletion ready to apply','ack-delete':'Deleted on both sides',
  'clear-state':'No copy remains','conflict':'Conflict requires owner choice'
 })[plan.action]||plan.action;
}
async function render(){
 if(busy||!list)return;
 busy=true;list.replaceChildren(node('p','Reading bounded local metadata and encrypted server inventory…'));
 try{
  let config=await configOrNew();
  if(label)label.value=config.label||'This browser';
  for(const input of scopeInputs())input.checked=config.scopes.includes(input.value);
  if(!config.registered){
   list.replaceChildren(node('p','Register this browser and choose at least one metadata resource type. Nothing syncs until you do.'));
   setStatus('Metadata sync is disabled for this browser.');return;
  }
  const inventory=await serverInventory(config,{snapshot:true});config=inventory.config;
  const scopes=config.scopes,localMap=await localResources(scopes);
  const states=new Map((await listResourceSyncStates()).map(row=>[row.key,row]));
  const servers=new Map([...serverCache].filter(([key])=>scopes.some(type=>key.startsWith(type+':'))));
  const keys=[...new Set([...localMap.keys(),...states.keys(),...servers.keys()])]
   .filter(key=>scopes.some(type=>key.startsWith(type+':'))).sort();
  list.replaceChildren();
  const journal=(await listResourceSyncJournal()).filter(row=>row.status==='pending');
  const summary=node('p','Device '+config.deviceId+' · scopes: '+(scopes.join(', ')||'none')+
   ' · pending journal: '+journal.length);
  list.append(summary);
  if(!keys.length){list.append(node('p','No eligible metadata resources exist for the enabled scopes.'));return;}
  for(const key of keys){
   const [type,...rest]=key.split(':'),id=rest.join(':');
   const local=localMap.get(key)?.record||null,server=servers.get(key)||null;
   const state=states.get(key)||defaultResourceSyncState(type,id);
   const plan=planResourceSync({type,local,server,state});
   const card=node('section','','participant-sync-card');
   const title=node('strong',typeLabel(type)+' · '+id);
   const meta=node('p',planText(plan)+' · '+plan.reason);
   const details=node('small','Browser: '+(local?'present':'missing')+
    ' · Server: '+(server?(server.deleted?'deleted · v':'present · v')+server.version:'not changed / absent')+
    ' · Last acknowledged v'+(state.serverVersion||0));
   card.append(title,meta,details);
   const action=async fn=>{
    if(busy)return;busy=true;
    try{await fn();}catch(error){setStatus(error.message);}finally{busy=false;await render();}
   };
   if(['push-upsert','push-delete'].includes(plan.action)){
    const button=node('button','Send browser version');button.type='button';
    button.addEventListener('click',()=>void action(()=>pushPlan(type,id,plan,local,server,state)));
    card.append(button);
   }else if(['pull-server','pull-delete'].includes(plan.action)){
    const button=node('button','Apply server version');button.type='button';
    button.addEventListener('click',()=>void action(()=>pullPlan(type,id,server,state)));
    card.append(button);
   }else if(plan.action==='ack-delete'){
    const button=node('button','Acknowledge deletion');button.type='button';
    button.addEventListener('click',()=>void action(async()=>{
     await clearPendingForKey(key);
     await saveResourceSyncState(resourceSyncStateAfterRecord(type,state,server,null,Date.now()));
     setStatus('Deletion acknowledged.');
    }));card.append(button);
   }else if(plan.action==='clear-state'){
    const button=node('button','Clear sync state');button.type='button';
    button.addEventListener('click',()=>void action(async()=>{
     await clearPendingForKey(key);await deleteResourceSyncState(type,id);
    }));card.append(button);
   }else if(plan.action==='conflict'){
    const browser=node('button','Keep browser copy');browser.type='button';
    browser.addEventListener('click',()=>void action(()=>pushPlan(type,id,{action:local?'push-upsert':'push-delete'},local,server,state,{resolution:'browser'})));
    const remote=node('button','Keep server copy');remote.type='button';
    remote.disabled=!server;
    remote.addEventListener('click',()=>void action(()=>pullPlan(type,id,server,state)));
    card.append(browser,remote);
   }
   list.append(card);
  }
  setStatus('Metadata sync review loaded. No change is applied until you choose an action.');
 }catch(error){
  list.replaceChildren(node('p','Metadata sync unavailable: '+error.message));setStatus(error.message);
 }finally{busy=false;}
}
async function register(event){
 event.preventDefault();if(busy)return;
 const scopes=selectedScopes();if(!scopes.length){setStatus('Choose at least one metadata resource type.');return;}
 busy=true;
 try{
  const prior=await configOrNew();
  const deviceLabel=text(label?.value||'This browser',80)||'This browser';
  const data=await post({action:'register-device',deviceId:prior.deviceId,label:deviceLabel,scopes});
  const config=await saveResourceSyncConfig({...prior,label:deviceLabel,scopes,registered:true,
   revokedAt:null,updatedAt:Date.now()});
  setStatus('Browser registered. Metadata sync remains manual.');busy=false;await render();
 }catch(error){setStatus(error.message);busy=false;}
}
async function resume(){
 if(busy)return;busy=true;
 try{
  let config=await configOrNew();if(!config.registered)throw new Error('Register this browser first.');
  const inv=await serverInventory(config,{snapshot:true});config=inv.config;
  const localMap=await localResources(config.scopes);
  const pending=(await listResourceSyncJournal()).filter(row=>row.status==='pending');
  let applied=0,stopped=0;
  for(const entry of pending){
   if(!config.scopes.includes(entry.resourceType)){stopped++;continue;}
   try{
    if(entry.operation.startsWith('push-'))await postJournal(entry,localMap);
    else{
     const server=serverCache.get(entry.key);
     if(!server||Number(server.version)!==Number(entry.serverVersion))
      throw new Error('Server resource changed since this pull was queued. Refresh and review.');
     const states=new Map((await listResourceSyncStates()).map(row=>[row.key,row]));
     await applyServerRecord(entry.resourceType,server,
      states.get(entry.key)||defaultResourceSyncState(entry.resourceType,entry.resourceId));
     await saveResourceSyncJournal(completeJournalEntry(entry,Date.now()));
    }
    applied++;
   }catch(error){
    await saveResourceSyncJournal(retryJournalEntry(entry,error.message,Date.now()));stopped++;
   }
  }
  await clearAppliedResourceSyncJournal();
  setStatus('Journal resume finished · '+applied+' applied · '+stopped+' require review.');
 }catch(error){setStatus(error.message);}finally{busy=false;await render();}
}
async function revoke(){
 if(busy)return;
 const config=await configOrNew();
 if(!config.registered){setStatus('This browser is not registered.');return;}
 if(!window.confirm('Revoke metadata sync for this browser ID? Pending journal entries will remain local for review.'))return;
 busy=true;
 try{
  await post({action:'revoke-device',deviceId:config.deviceId});
  await saveResourceSyncConfig({...config,registered:false,revokedAt:Date.now(),updatedAt:Date.now()});
  serverCache.clear();setStatus('This browser sync device is revoked.');
 }catch(error){setStatus(error.message);}finally{busy=false;await render();}
}
form?.addEventListener('submit',event=>void register(event));
refreshButton?.addEventListener('click',()=>void render());
resumeButton?.addEventListener('click',()=>void resume());
revokeButton?.addEventListener('click',()=>void revoke());
void (async()=>{
 try{
  const config=await configOrNew();if(label)label.value=config.label;
  for(const input of scopeInputs())input.checked=config.scopes.includes(input.value);
  const pending=(await listResourceSyncJournal()).filter(row=>row.status==='pending').length;
  setStatus(config.registered
   ?'Registered metadata sync device · '+pending+' pending journal entr'+(pending===1?'y':'ies')+'.'
   :'Metadata sync is disabled for this browser.');
 }catch(error){setStatus('Metadata sync local state unavailable: '+error.message);}
})();

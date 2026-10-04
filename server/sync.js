import {
 deleteParticipant,getParticipant,listParticipants,listParticipantSyncStates,
 saveParticipant,saveParticipantSyncState,deleteParticipantSyncState
} from '../src/participant-store.js';
import {
 changeForServer,defaultParticipantSyncState,participantHasBiometrics,
 planParticipantSync,syncStateAfterServerRecord
} from '../src/server-sync-core.js';

// V0.10H: explicit/manual participant sync only. No background transport.
// Dialogue, ROOM events, tasks, memories and scene data are never uploaded here.
const load=document.getElementById('loadLocalParticipants');
const area=document.getElementById('migrationArea');
const token=document.querySelector('input[name="csrf"]')?.value||'';
let busy=false;

function node(tag,text='',className=''){
 const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;
}
function statusText(plan){
 return ({
  disabled:'Sync off',none:'Already synchronized','push-upsert':'Browser change ready',
  'push-delete':'Browser deletion ready','pull-server':'Server change ready',
  'pull-delete':'Server deletion ready','ack-delete':'Deleted on both sides',
  'clear-local-state':'No server copy exists',conflict:'Conflict requires owner choice'
 })[plan.action]||plan.action;
}
async function fetchServer(){
 const response=await fetch('./sync-api.php',{credentials:'same-origin',headers:{Accept:'application/json'}});
 if(response.status===401||response.status===403)throw new Error('Your server session or sync permission is no longer valid.');
 if(!response.ok)throw new Error('Server sync inventory failed ('+response.status+').');
 const data=await response.json();
 if(!Array.isArray(data.records))throw new Error('Server returned an invalid sync inventory.');
 return data.records;
}
async function postChange(change){
 const response=await fetch('./sync-api.php',{
  method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json','X-CSRF-Token':token,Accept:'application/json'},
  body:JSON.stringify({changes:[change]})
 });
 if(response.status===401||response.status===403)throw new Error('Your server session, CSRF token or sync permission is no longer valid.');
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Server sync write failed ('+response.status+').');
 const result=data.results?.[0];
 if(!result)throw new Error('Server did not return a sync result.');
 return result;
}
function consentNeeded(local,server){
 return participantHasBiometrics(local)||participantHasBiometrics(server?.profile);
}
async function applyServerRecord(server,state){
 if(server.deleted){
  const local=await getParticipant(server.id);
  if(local)await deleteParticipant(server.id,{remoteSyncState:{
   serverVersion:server.version,serverUpdatedAt:server.serverUpdatedAt,
   consentConfirmedAt:state.consentConfirmedAt
  }});
  else await saveParticipantSyncState({...state,enabled:true,serverVersion:server.version,
   localDeletedAt:null,lastSyncedLocalUpdatedAt:null,
   serverUpdatedAt:server.serverUpdatedAt,updatedAt:Date.now()});
  return;
 }
 if(!server.profile||typeof server.profile!=='object')throw new Error('Server profile is unavailable.');
 const saved=await saveParticipant({...server.profile,id:server.id,name:server.name});
 await saveParticipantSyncState(syncStateAfterServerRecord(state,server,saved,Date.now()));
}
async function acceptApplied(result,state){
 if(result.status==='conflict')return result;
 if(result.status!=='applied'||!result.record)throw new Error(result.error||'Server rejected the sync change.');
 const local=result.record.deleted?null:await getParticipant(result.record.id);
 await saveParticipantSyncState(syncStateAfterServerRecord(state,result.record,local,Date.now()));
 return result;
}
async function executePlan(id,plan,local,server,state,resolution=''){
 if(plan.action==='disabled')throw new Error('Enable participant sync first.');
 if(plan.action==='none')return;
 if(plan.action==='clear-local-state'){await deleteParticipantSyncState(id);return;}
 if(plan.action==='pull-server'||plan.action==='pull-delete'||plan.action==='ack-delete'){
  if(!server)throw new Error('Server record disappeared. Refresh and try again.');
  await applyServerRecord(server,state);return;
 }
 if(plan.action==='push-upsert'||plan.action==='push-delete'){
  if(plan.action==='push-upsert'&&consentNeeded(local,server)&&!state.consentConfirmedAt)
   throw new Error('Confirm participant consent before synchronizing biometric profile data.');
  const result=await postChange(changeForServer(plan.action,{local,server,state,resolution}));
  if(result.status==='conflict')throw Object.assign(new Error('Server changed before this write completed.'),{conflict:true});
  await acceptApplied(result,state);return;
 }
 throw new Error('This sync state requires an explicit conflict choice.');
}
async function snapshot(){
 const [locals,states,servers]=await Promise.all([listParticipants(),listParticipantSyncStates(),fetchServer()]);
 return {
  locals:new Map(locals.map(x=>[x.id,x])),
  states:new Map(states.map(x=>[x.participantId,x])),
  servers:new Map(servers.map(x=>[x.id,x]))
 };
}
async function render(){
 if(busy)return;
 area.replaceChildren(node('p','Reading this browser and the self-hosted participant store…'));
 let data;
 try{data=await snapshot();}
 catch(error){area.replaceChildren(node('p','Sync inventory unavailable: '+error.message));return;}
 area.replaceChildren();
 const ids=[...new Set([...data.locals.keys(),...data.states.keys(),...data.servers.keys()])].sort();
 if(!ids.length){area.append(node('p','No browser or server participant records exist yet.'));return;}
 area.append(node('p','Participant sync is manual. Enable each person separately. Biometric profiles require explicit participant consent. Conflicts never auto-merge; choose which copy wins.'));
 for(const id of ids){
  const local=data.locals.get(id)||null,server=data.servers.get(id)||null;
  const state=data.states.get(id)||defaultParticipantSyncState(id);
  const plan=planParticipantSync({local,server,state});
  const card=node('section','','participant-sync-card');card.dataset.profileId=id;
  const title=node('strong',local?.name||server?.name||'Deleted participant');
  const meta=node('p',statusText(plan)+' · '+plan.reason);
  const details=node('small',
   'Browser: '+(local?'present':'missing')+' · Server: '+(server?(server.deleted?'deleted · v':'present · v')+server.version:'missing')+
   ' · Stored sync version: '+(state.serverVersion||0));
  card.append(title,meta,details);

  if(!state.enabled){
   const consent=node('label');const consentBox=document.createElement('input');consentBox.type='checkbox';
   consentBox.className='sync-consent';
   consent.append(consentBox,document.createTextNode(' I confirm this participant permits browser/server biometric synchronization.'));
   if(consentNeeded(local,server))card.append(consent);
   const enable=node('button','Enable sync for this participant');enable.type='button';
   enable.addEventListener('click',async()=>{
    if(consentNeeded(local,server)&&!consentBox.checked){
     meta.textContent='Consent confirmation is required before enabling biometric sync.';return;
    }
    busy=true;enable.disabled=true;
    try{
     await saveParticipantSyncState({...state,participantId:id,enabled:true,
      consentConfirmedAt:consentNeeded(local,server)?Date.now():null,updatedAt:Date.now()});
    }catch(error){meta.textContent='Could not enable sync: '+error.message;}
    finally{busy=false;void render();}
   });
   card.append(enable);area.append(card);continue;
  }

  const controls=node('div','','participant-sync-actions');
  if(plan.action==='conflict'){
   const browser=node('button','Keep browser copy');browser.type='button';
   const serverButton=node('button','Keep server copy');serverButton.type='button';
   browser.addEventListener('click',()=>void resolveConflict('browser'));
   serverButton.addEventListener('click',()=>void resolveConflict('server'));
   async function resolveConflict(choice){
    if(choice==='browser'&&local&&consentNeeded(local,server)&&!state.consentConfirmedAt){
     meta.textContent='Consent confirmation is required before sending biometric data.';return;
    }
    busy=true;browser.disabled=true;serverButton.disabled=true;
    try{
     if(choice==='server'){
      if(!server)throw new Error('There is no server copy to keep.');
      await applyServerRecord(server,state);
     }else{
      const action=state.localDeletedAt?'push-delete':'push-upsert';
      const result=await postChange(changeForServer(action,{local,server,state,resolution:'browser'}));
      if(result.status!=='applied')throw new Error(result.error||'Conflict was not resolved.');
      await acceptApplied(result,state);
     }
    }catch(error){meta.textContent='Conflict resolution failed: '+error.message;}
    finally{busy=false;void render();}
   }
   controls.append(browser,serverButton);
  }else if(plan.action!=='none'&&plan.action!=='disabled'){
   const sync=node('button','Apply '+statusText(plan).toLowerCase());sync.type='button';
   sync.addEventListener('click',async()=>{
    busy=true;sync.disabled=true;
    try{await executePlan(id,plan,local,server,state);}
    catch(error){meta.textContent='Sync not completed: '+error.message;}
    finally{busy=false;void render();}
   });
   controls.append(sync);
  }
  const disable=node('button','Disable sync');disable.type='button';
  disable.addEventListener('click',async()=>{
   busy=true;
   try{await saveParticipantSyncState({...state,enabled:false,localDeletedAt:null,updatedAt:Date.now()});}
   catch(error){meta.textContent='Could not disable sync: '+error.message;}
   finally{busy=false;void render();}
  });
  controls.append(disable);card.append(controls);area.append(card);
 }
 const refresh=node('button','Refresh sync status');refresh.type='button';refresh.addEventListener('click',()=>void render());
 area.append(refresh);
}
load?.addEventListener('click',()=>void render());

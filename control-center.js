let participantStorePromise=null;
function participantStore(){
 if(!participantStorePromise)participantStorePromise=import('./src/participant-store.js');
 return participantStorePromise;
}

const $=id=>document.getElementById(id);
const ui={
 modal:$('agentControlCenter'),backdrop:$('agentControlCenterBackdrop'),close:$('agentControlCenterClose'),
 open:$('agentControlCenterButton'),refresh:$('agentControlCenterRefresh'),
 status:$('agentControlCenterStatus'),username:$('agentAccountUsername'),role:$('agentAccountRole'),
 participants:$('agentAccountParticipants'),sync:$('agentAccountSyncState'),syncDetail:$('agentAccountSyncDetail'),
 accountTab:$('controlCenterAccountTab'),roomTab:$('controlCenterRoomTab'),meetingTab:$('controlCenterMeetingTab'),
 accountPanel:$('controlCenterAccountPanel'),roomPanel:$('controlCenterRoomPanel'),meetingPanel:$('controlCenterMeetingPanel'),
 roomOpen:$('roomOpenControlCenter')
};
const PANES=Object.freeze(['account','room','meeting']);
let lastFocus=null,open=false,activePane='account';

function setStatus(text){if(ui.status)ui.status.textContent=text;}
function selectPane(name='account'){
 activePane=PANES.includes(name)?name:'account';
 for(const [pane,node] of [['account',ui.accountPanel],['room',ui.roomPanel],['meeting',ui.meetingPanel]])
  if(node)node.hidden=activePane!==pane;
 for(const [pane,node] of [['account',ui.accountTab],['room',ui.roomTab],['meeting',ui.meetingTab]]){
  if(!node)continue;
  const selected=activePane===pane;
  node.setAttribute('aria-selected',String(selected));
  node.tabIndex=selected?0:-1;
 }
}
function setOpen(value,pane=activePane){
 open=value===true;if(!ui.modal)return;
 selectPane(pane);
 if(open){
  lastFocus=document.activeElement;ui.modal.hidden=false;ui.modal.setAttribute('aria-hidden','false');
  document.body.classList.add('control-center-open');
  if(activePane==='account')void refresh();
  requestAnimationFrame(()=>ui.close?.focus());
 }else{
  ui.modal.hidden=true;ui.modal.setAttribute('aria-hidden','true');document.body.classList.remove('control-center-open');
  lastFocus?.focus?.();
 }
}
async function session(){
 const response=await fetch('./server/session.php',{credentials:'same-origin',headers:{Accept:'application/json'}});
 if(response.status===401)return {authenticated:false};
 if(!response.ok)throw new Error('Account session unavailable');
 return response.json();
}
async function serverParticipants(){
 const response=await fetch('./server/account-participants-api.php',{credentials:'same-origin',headers:{Accept:'application/json'}});
 if(response.status===401||response.status===403)return null;
 if(!response.ok)throw new Error('Account participant inventory unavailable');
 const data=await response.json();return Array.isArray(data.records)?data.records:null;
}
async function refresh(){
 if(!open)return;
 setStatus('Refreshing account state…');
 try{
  const account=await session();
  let local=[],states=[];
  try{
   const store=await participantStore();
   [local,states]=await Promise.all([
    store.listParticipants?.().catch(()=>[])??[],
    store.listAccountParticipantSyncStates?.().catch(()=>[])??[]
   ]);
  }catch(error){console.warn('Participant store unavailable in Control Center',error);}
  if(!account.authenticated){
   if(ui.username)ui.username.textContent='Not signed in';
   if(ui.role)ui.role.textContent='Open Admin to sign in';
   if(ui.participants)ui.participants.textContent=String(local.length);
   if(ui.sync)ui.sync.textContent='Local only';
   if(ui.syncDetail)ui.syncDetail.textContent='Sign in to enable account-backed desktop/mobile participants.';
   setStatus('This browser is not signed in to Tracky2.');return;
  }
  if(ui.username)ui.username.textContent=account.user?.username||'Signed in';
  if(ui.role)ui.role.textContent=(account.user?.role||'account').toUpperCase();
  let remote=null;
  try{remote=await serverParticipants();}catch{}
  const pending=states.filter(row=>row?.pending).length;
  const conflicts=states.filter(row=>row?.conflict).length;
  if(ui.participants)ui.participants.textContent=remote?String(remote.filter(row=>!row.deleted).length):String(local.length);
  if(ui.sync)ui.sync.textContent=conflicts?'Needs review':pending?'Pending':'Connected';
  if(ui.syncDetail)ui.syncDetail.textContent=conflicts
   ?conflicts+' participant conflict'+(conflicts===1?'':'s')+' require review.'
   :pending?pending+' offline change'+(pending===1?'':'s')+' waiting to sync.'
   :'Signed-in participant profiles are available across devices.';
  setStatus('Signed in as '+(account.user?.username||'account')+' · '+(account.user?.role||'user')+'.');
 }catch(error){setStatus('Control Center could not refresh: '+error.message);}
}
ui.open?.addEventListener('click',()=>setOpen(true,'account'));
ui.roomOpen?.addEventListener('click',()=>setOpen(true,'room'));
ui.accountTab?.addEventListener('click',()=>{selectPane('account');if(open)void refresh();});
ui.roomTab?.addEventListener('click',()=>selectPane('room'));
ui.meetingTab?.addEventListener('click',()=>selectPane('meeting'));
ui.close?.addEventListener('click',()=>setOpen(false));
ui.backdrop?.addEventListener('click',()=>setOpen(false));
ui.refresh?.addEventListener('click',()=>void (async()=>{await window.trackyAccountParticipants?.syncNow?.();await refresh();})());
window.addEventListener('tracky:control-center-toggle',event=>{
 const pane=event.detail?.pane||activePane;
 setOpen(!open,pane);
});
window.addEventListener('tracky:account-participant-sync',()=>{if(open&&activePane==='account')void refresh();});
document.addEventListener('keydown',event=>{
 if(!open)return;
 if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
 if(event.key!=='Tab')return;
 const focusable=[...ui.modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')]
  .filter(node=>!node.hidden);
 if(!focusable.length)return;
 const first=focusable[0],last=focusable.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
const requestedAdminPane=new URLSearchParams(window.location.search).get('admin');
if(requestedAdminPane==='meeting')setOpen(true,'meeting');

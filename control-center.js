import {listParticipants,listAccountParticipantSyncStates} from './src/participant-store.js';

const $=id=>document.getElementById(id);
const ui={
 modal:$('agentControlCenter'),backdrop:$('agentControlCenterBackdrop'),close:$('agentControlCenterClose'),
 open:$('agentControlCenterButton'),refresh:$('agentControlCenterRefresh'),
 status:$('agentControlCenterStatus'),username:$('agentAccountUsername'),role:$('agentAccountRole'),
 participants:$('agentAccountParticipants'),sync:$('agentAccountSyncState'),syncDetail:$('agentAccountSyncDetail')
};
let lastFocus=null,open=false;

function setStatus(text){if(ui.status)ui.status.textContent=text;}
function setOpen(value){
 open=value===true;if(!ui.modal)return;
 if(open){lastFocus=document.activeElement;ui.modal.hidden=false;ui.modal.setAttribute('aria-hidden','false');
  document.body.classList.add('control-center-open');void refresh();requestAnimationFrame(()=>ui.close?.focus());}
 else{ui.modal.hidden=true;ui.modal.setAttribute('aria-hidden','true');document.body.classList.remove('control-center-open');
  lastFocus?.focus?.();}
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
  const [account,local,states]=await Promise.all([
   session(),listParticipants().catch(()=>[]),listAccountParticipantSyncStates().catch(()=>[])
  ]);
  if(!account.authenticated){
   ui.username.textContent='Not signed in';ui.role.textContent='Open Admin to sign in';
   ui.participants.textContent=String(local.length);ui.sync.textContent='Local only';
   ui.syncDetail.textContent='Sign in to enable account-backed desktop/mobile participants.';
   setStatus('This browser is not signed in to Tracky2.');return;
  }
  ui.username.textContent=account.user?.username||'Signed in';
  ui.role.textContent=(account.user?.role||'account').toUpperCase();
  let remote=null;
  try{remote=await serverParticipants();}catch{}
  const pending=states.filter(row=>row?.pending).length;
  const conflicts=states.filter(row=>row?.conflict).length;
  ui.participants.textContent=remote?String(remote.filter(row=>!row.deleted).length):String(local.length);
  ui.sync.textContent=conflicts?'Needs review':pending?'Pending':'Connected';
  ui.syncDetail.textContent=conflicts
   ?conflicts+' participant conflict'+(conflicts===1?'':'s')+' require review.'
   :pending?pending+' offline change'+(pending===1?'':'s')+' waiting to sync.'
   :'Signed-in participant profiles are available across devices.';
  setStatus('Signed in as '+(account.user?.username||'account')+' · '+(account.user?.role||'user')+'.');
 }catch(error){setStatus('Control Center could not refresh: '+error.message);}
}
ui.open?.addEventListener('click',()=>setOpen(true));
ui.close?.addEventListener('click',()=>setOpen(false));
ui.backdrop?.addEventListener('click',()=>setOpen(false));
ui.refresh?.addEventListener('click',()=>void (async()=>{await window.trackyAccountParticipants?.syncNow?.();await refresh();})());
window.addEventListener('tracky:control-center-toggle',()=>setOpen(!open));
window.addEventListener('tracky:account-participant-sync',()=>{if(open)void refresh();});
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

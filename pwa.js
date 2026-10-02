// UI-only PWA lifecycle. Installation and applying updates always require user action.
const BANNER_ID='tracky2-pwa-banner';
let installPrompt=null,refreshing=false,pendingUpdate=null;
function banner(message,action,handler){
 let el=document.getElementById(BANNER_ID);
 if(!el){el=document.createElement('aside');el.id=BANNER_ID;
   el.setAttribute('role','status');el.className='pwa-banner';
   document.body.append(el);
 }
 el.replaceChildren();
 const text=document.createElement('span');text.textContent=message;el.append(text);
 if(action){const btn=document.createElement('button');btn.type='button';
   btn.textContent=action;btn.addEventListener('click',handler,{once:true});el.append(btn);}
 const close=document.createElement('button');close.type='button';close.textContent='Dismiss';
 close.setAttribute('aria-label','Dismiss PWA notice');
 close.addEventListener('click',()=>el.remove());el.append(close);
}
function safeToReload(){
 // Never interrupt an active timed round or classic game to apply a service worker update.
 return !document.querySelector('#endGame:not([disabled])') &&
   !document.querySelector('#stopCamera:not([disabled])');
}
function offerUpdate(worker){
 pendingUpdate=worker;
 banner('A Tracky2 update is ready. Finish and stop any active game before updating.',
   'Update now',()=>{
     if(!safeToReload()){banner('Stop the active game and camera before updating.',
       'Check again',()=>offerUpdate(pendingUpdate));return;}
     worker.postMessage({type:'SKIP_WAITING'});
   });
}
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();installPrompt=event;
 banner('Install Tracky2 as an app on this device.','Install',async()=>{
  const prompt=installPrompt;installPrompt=null;
  if(prompt){await prompt.prompt();await prompt.userChoice;}
 });
});
window.addEventListener('appinstalled',()=>{
 installPrompt=null;document.getElementById(BANNER_ID)?.remove();
});
window.addEventListener('offline',()=>{
 banner('Offline mode: saved app screens work, but new AI models and some recognition features require connectivity.');
});
if('serviceWorker' in navigator && (window.isSecureContext ||
  location.hostname==='localhost'||location.hostname==='127.0.0.1')){
 window.addEventListener('load',async()=>{
  try {
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    if(registration.waiting && navigator.serviceWorker.controller)offerUpdate(registration.waiting);
    registration.addEventListener('updatefound',()=>{
      const installing=registration.installing;
      installing?.addEventListener('statechange',()=>{
        if(installing.state==='installed' && navigator.serviceWorker.controller)offerUpdate(installing);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(refreshing)return;refreshing=true;window.location.reload();
    });
  }catch(error){console.warn('Tracky2 offline install is not available:',error);}
 });
}

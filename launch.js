import { startupReport,shouldAutoEnter } from './src/launch-core.js';
const status=document.getElementById('launchStatus'),progress=document.getElementById('launchProgress');
const link=document.getElementById('launchGames'),opt=document.getElementById('launchAuto');
let optedOut=false, timer=null, available=false, seen=false;
try {seen=window.sessionStorage.getItem('tracky2-launch-seen')==='1';} catch {}
try {
  const test='tracky2-storage-probe';
  window.localStorage.setItem(test,'1');
  available=window.localStorage.getItem(test)==='1';
  window.localStorage.removeItem(test);
} catch { available=false; }
const report=startupReport({secureContext:window.isSecureContext || location.hostname==='localhost' ||
  location.hostname==='127.0.0.1',storageAvailable:available,hasParticipantStorage:available});
status.textContent=report.message;
progress.style.width='100%';
document.body.classList.add('launch-ready');
try {window.sessionStorage.setItem('tracky2-launch-seen','1');} catch {}
const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
function cancel(){
  optedOut=true;
  if(timer!==null){clearTimeout(timer);timer=null;}
  opt.textContent='Splash retained';
  opt.disabled=true;
  status.textContent=report.message+' Choose Enter game lobby when ready.';
}
opt.addEventListener('click',cancel);
link.addEventListener('click',()=>{if(timer!==null)clearTimeout(timer);});
if(shouldAutoEnter({seenThisTab:seen,optedOut,reducedMotion:reduce})&&report.ready){
  opt.textContent='Stay on splash';
  timer=window.setTimeout(()=>{if(!optedOut)window.location.assign('./games.html');},2200);
} else {opt.textContent='Stay on splash';}
// The Enter game lobby link remains usable even if startup checks or navigation timers fail.

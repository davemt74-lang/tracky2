import {normalizeAgentView,orbPresentation} from './src/agent-presentation.js';
import {nextTripleShortcut} from './src/agent-shortcuts.js';
// Presentation-only: camera, microphone and tracking continue while visuals/panels are hidden.
const $=id=>document.getElementById(id);
const ui={nav:$('agentViewChooser'),camera:$('agentCameraView'),orb:$('agentOrbView'),
 stage:$('agentOrbStage'),orbArt:$('agentVoiceOrb'),follower:$('agentOrbFollower'),
 caption:$('agentOrbCaption'),leftRail:$('agentMobileLeftRail'),
 rightRail:$('agentMobileRightRail'),backdrop:$('agentMobileBackdrop')};
const requested=new URLSearchParams(window.location.search).get('mode')==='agent';
const initialView=new URLSearchParams(window.location.search).get('view');
let mode=normalizeAgentView(initialView),speaking=false,agentEnabled=requested,panelsHidden=false;
let mobilePanel=null,shortcut={key:'',count:0,lastAt:0};
if(requested)document.body.classList.add('agent-mode');
if(ui.follower)ui.follower.dataset.follow='idle';
function render(){
 const state=orbPresentation({view:mode,speaking});
 ui.nav.hidden=!agentEnabled;
 ui.stage.hidden=!agentEnabled||!state.orb;
 ui.orbArt.dataset.speech=state.orbSpeaking?'speaking':'idle';
 ui.camera.setAttribute('aria-pressed',String(mode==='camera'));
 ui.orb.setAttribute('aria-pressed',String(mode==='orb'));
 document.body.classList.toggle('agent-orb-view',agentEnabled&&state.orb);
 document.body.classList.toggle('room-sidebars-hidden',agentEnabled&&panelsHidden);
 document.body.classList.toggle('agent-mobile-panel-left',agentEnabled&&mobilePanel==='left'&&!panelsHidden);
 document.body.classList.toggle('agent-mobile-panel-right',agentEnabled&&mobilePanel==='right'&&!panelsHidden);
 if(ui.leftRail){ui.leftRail.hidden=!agentEnabled;ui.leftRail.setAttribute('aria-expanded',String(agentEnabled&&mobilePanel==='left'&&!panelsHidden));}
 if(ui.rightRail){ui.rightRail.hidden=!agentEnabled;ui.rightRail.setAttribute('aria-expanded',String(agentEnabled&&mobilePanel==='right'&&!panelsHidden));}
 if(ui.backdrop)ui.backdrop.hidden=!agentEnabled||!mobilePanel||panelsHidden;
 ui.caption.textContent=speaking?'Agent speaking':'Listening for participants';
}
function select(view){mode=normalizeAgentView(view);render();}
function slide(panel){
 if(!agentEnabled)return;
 panelsHidden=false;mobilePanel=mobilePanel===panel?null:panel;
 render();
}
ui.camera.addEventListener('click',()=>select('camera'));
ui.orb.addEventListener('click',()=>select('orb'));
ui.leftRail?.addEventListener('click',()=>slide('left'));
ui.rightRail?.addEventListener('click',()=>slide('right'));
ui.backdrop?.addEventListener('click',()=>{mobilePanel=null;render();});
document.addEventListener('keydown',event=>{
 if(!agentEnabled||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
 const target=event.target;
 if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)
     ||target?.closest?.('[contenteditable="true"]'))return;
 if(event.key==='Escape'&&mobilePanel){mobilePanel=null;render();return;}
 const key=event.key?.toLowerCase();
 if(key!=='x'&&key!=='z'){shortcut={key:'',count:0,lastAt:0};return;}
 const next=nextTripleShortcut(shortcut,key,performance.now());shortcut=next.state;
 if(next.trigger==='z')select(mode==='camera'?'orb':'camera');
 if(next.trigger==='x'){panelsHidden=!panelsHidden;mobilePanel=null;render();}
});
window.addEventListener('tracky:agent-room-tracks',event=>{
 // Coordinates come from the shared, stable body/face tracker. No new camera.
 const t=event.detail?.target;
 if(!ui.follower?.style)return;
 ui.follower.dataset.follow=t?'track':'idle';
 if(!t){ui.follower.style.removeProperty?.('--orb-x');ui.follower.style.removeProperty?.('--orb-y');ui.follower.style.removeProperty?.('--orb-scale');return;}
 ui.follower.style.setProperty('--orb-x',(t.x*100).toFixed(2)+'%');
 ui.follower.style.setProperty('--orb-y',(t.y*100).toFixed(2)+'%');
 ui.follower.style.setProperty('--orb-scale',String(t.scale));
});
window.addEventListener('tracky:agent-speech-cadence',event=>{
 if(!speaking||!ui.orbArt?.animate)return;
 const strength=Math.max(.08,Math.min(1,Number(event.detail?.strength)||.4));
 const duration=Math.max(150,Math.min(520,Number(event.detail?.durationMs)||300));
 // Pulse independent inner layers, never the tracking-positioned wrapper.
 for(const node of [ui.orbArt.querySelector?.('.agent-orb-core'),...Array.from(ui.orbArt.querySelectorAll?.('.agent-orb-ring')||[])]){
  node?.animate?.([{transform:'scale(1)',opacity:.83,filter:'brightness(1)'},
   {transform:'scale('+(1+strength*.2)+')',opacity:1,filter:'brightness('+(1+strength*.35)+')'},
   {transform:'scale(1)',opacity:.92,filter:'brightness(1)'}],
  {duration,easing:'ease-out',iterations:1});
 }
});
window.addEventListener('tracky:agent-speech-state',event=>{
 speaking=event.detail?.speaking===true;render();
});
window.addEventListener('tracky:agent-ready',event=>{
 if(event.detail?.enabled===true)agentEnabled=true;
 else if(!requested)agentEnabled=false;
 if(!agentEnabled){speaking=false;mode='camera';mobilePanel=null;}
 render();
});
// Available immediately, even if camera/model initialization fails.
render();

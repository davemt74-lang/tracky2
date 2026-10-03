import {normalizeAgentView,orbPresentation} from './src/agent-presentation.js';
// Presentation-only: camera, microphone and tracking continue while video is hidden.
const $=id=>document.getElementById(id);
const ui={nav:$('agentViewChooser'),camera:$('agentCameraView'),orb:$('agentOrbView'),
 stage:$('agentOrbStage'),orbArt:$('agentVoiceOrb'),caption:$('agentOrbCaption')};
const requested=new URLSearchParams(window.location.search).get('mode')==='agent';
const initialView=new URLSearchParams(window.location.search).get('view');
let mode=normalizeAgentView(initialView),speaking=false,agentEnabled=requested;
if(requested)document.body.classList.add('agent-mode');
function render(){
 const state=orbPresentation({view:mode,speaking});
 ui.nav.hidden=!agentEnabled;
 ui.stage.hidden=!agentEnabled||!state.orb;
 ui.orbArt.dataset.speech=state.orbSpeaking?'speaking':'idle';
 ui.camera.setAttribute('aria-pressed',String(mode==='camera'));
 ui.orb.setAttribute('aria-pressed',String(mode==='orb'));
 document.body.classList.toggle('agent-orb-view',agentEnabled&&state.orb);
 ui.caption.textContent=speaking?'Agent speaking':'Listening for participants';
}
function select(view){
 mode=normalizeAgentView(view);
 render();
}
ui.camera.addEventListener('click',()=>select('camera'));
ui.orb.addEventListener('click',()=>select('orb'));
window.addEventListener('tracky:agent-speech-state',event=>{
 speaking=event.detail?.speaking===true;
 render();
});
window.addEventListener('tracky:agent-ready',event=>{
 if(event.detail?.enabled===true)agentEnabled=true;
 else if(!requested)agentEnabled=false;
 if(!agentEnabled){speaking=false;mode='camera';}
 render();
});
// Show the switch (and requested Orb stage) immediately, even while the
// heavy recognition/transcription engines are initializing or unavailable.
render();

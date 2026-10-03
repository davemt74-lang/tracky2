import {normalizeAgentView,orbPresentation} from './src/agent-presentation.js';
// Pure presentation switch: keeps the existing camera, identity and microphone
// streams running. The Orb mode hides the video; it never stops camera hardware.
const $=id=>document.getElementById(id);
const ui={nav:$('agentViewChooser'),camera:$('agentCameraView'),orb:$('agentOrbView'),
 stage:$('agentOrbStage'),orbArt:$('agentVoiceOrb'),caption:$('agentOrbCaption')};
let mode='camera',speaking=false,agentEnabled=false;
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
 agentEnabled=event.detail?.enabled===true;
 if(!agentEnabled){speaking=false;mode='camera';}
 render();
});
render();

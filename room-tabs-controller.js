// Isolated tab controller: a transient camera/model error cannot break tab clicks.
import {nextRoomTab} from './src/room-tabs-state.js';
import {nextAgentTab} from './src/agent-presentation.js';
const dialogue=document.getElementById('roomDialogueTab');
const activity=document.getElementById('playerActivityTab');
const agent=document.getElementById('roomAgentTab');
const panes={dialogue:document.getElementById('roomDialoguePanel'),
 activity:document.getElementById('playerActivityPanel'),agent:document.getElementById('roomAgentPanel')};
let selected='dialogue';
function show(tab,focus=false){
 const activeAgent=Boolean(agent&&!agent.hidden);
 selected=activeAgent?nextAgentTab(selected,tab):nextRoomTab(selected,tab);
 const entries=[['dialogue',dialogue],['activity',activity]];
 if(activeAgent)entries.push(['agent',agent]);
 for(const [name,button] of entries){
  const on=name===selected;
  button.setAttribute('aria-selected',String(on));
  button.tabIndex=on?0:-1;
  panes[name].hidden=!on;
  panes[name].style.display=on?'block':'none';
 }
 if(focus)(selected==='dialogue'?dialogue:selected==='activity'?activity:agent).focus();
}
for(const [name,button] of [['dialogue',dialogue],['activity',activity],...(agent?[['agent',agent]]:[])]){
 button.addEventListener('click',()=>show(name));
 button.addEventListener('keydown',event=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();show(event.key,true);
 });
}
show('dialogue');
(typeof window!=='undefined'?window:null)?.addEventListener?.('tracky:agent-tab-ready',()=>{
 if(agent){agent.hidden=false;show('dialogue');}
});

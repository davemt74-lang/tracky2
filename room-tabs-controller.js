// AGENT-only tab controller. Primary navigation is intentionally limited to four tabs.
import {nextAgentTab} from './src/agent-presentation.js';

const dialogue=document.getElementById('roomDialogueTab');
const activity=document.getElementById('playerActivityTab');
const agent=document.getElementById('roomAgentTab');
const room=document.getElementById('roomTab');
const panes={
 dialogue:document.getElementById('roomDialoguePanel'),
 activity:document.getElementById('playerActivityPanel'),
 agent:document.getElementById('roomAgentPanel'),
 room:document.getElementById('roomObservationsPanel')
};
const entries=[['dialogue',dialogue],['activity',activity],['agent',agent],['room',room]]
 .filter(([,button])=>Boolean(button));

const params=typeof window!=='undefined'
 ? new URLSearchParams(window.location?.search||'') : new URLSearchParams();
const requestedTab=params.get('tab');
const initialTab=['dialogue','activity','agent','room'].includes(requestedTab)?requestedTab:'dialogue';
let selected='dialogue';

function show(tab,focus=false){
 selected=nextAgentTab(selected,tab);
 for(const [name,button] of entries){
  const on=name===selected;
  button.setAttribute('aria-selected',String(on));
  button.tabIndex=on?0:-1;
  if(panes[name]){
   panes[name].hidden=!on;
   panes[name].style.display=on?'block':'none';
  }
 }
 if(focus)entries.find(([name])=>name===selected)?.[1]?.focus();
 if(selected==='dialogue'&&typeof window!=='undefined'&&typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')
  window.dispatchEvent(new CustomEvent('tracky:conversation-visible'));
}

for(const [name,button] of entries){
 button.addEventListener('click',()=>show(name));
 button.addEventListener('keydown',event=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();show(event.key,true);
 });
}
show(initialTab);

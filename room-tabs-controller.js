// Isolated tab controller: a transient camera/model error cannot break tab clicks.
import {nextRoomTab} from './src/room-tabs-state.js';
const dialogue=document.getElementById('roomDialogueTab');
const activity=document.getElementById('playerActivityTab');
const panes={dialogue:document.getElementById('roomDialoguePanel'),
 activity:document.getElementById('playerActivityPanel')};
let selected='dialogue';
function show(tab,focus=false){
 selected=nextRoomTab(selected,tab);
 for(const [name,button] of [['dialogue',dialogue],['activity',activity]]){
  const on=name===selected;
  button.setAttribute('aria-selected',String(on));
  button.tabIndex=on?0:-1;
  panes[name].hidden=!on;
  panes[name].style.display=on?'block':'none';
 }
 if(focus)(selected==='dialogue'?dialogue:activity).focus();
}
for(const [name,button] of [['dialogue',dialogue],['activity',activity]]){
 button.addEventListener('click',()=>show(name));
 button.addEventListener('keydown',event=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();show(event.key,true);
 });
}
show('dialogue');

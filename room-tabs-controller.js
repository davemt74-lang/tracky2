// Isolated tab controller: a transient camera/model error cannot break tab clicks.
import {nextRoomTab} from './src/room-tabs-state.js';
import {nextAgentTab} from './src/agent-presentation.js';
const dialogue=document.getElementById('roomDialogueTab');
const activity=document.getElementById('playerActivityTab');
const agent=document.getElementById('roomAgentTab');
const meeting=document.getElementById('roomMeetingTab');
const room=document.getElementById('roomTab');
const panes={dialogue:document.getElementById('roomDialoguePanel'),
 activity:document.getElementById('playerActivityPanel'),agent:document.getElementById('roomAgentPanel'),meeting:document.getElementById('roomMeetingPanel'),room:document.getElementById('roomObservationsPanel')};
// Tabs must not depend on camera/model initialization to become visible.
const params=typeof window!=='undefined'
 ? new URLSearchParams(window.location?.search||'') : new URLSearchParams();
const requestedMode=params.get('mode');
const requestedAgent=requestedMode==='agent'||requestedMode==='meeting';
const requestedMeeting=requestedMode==='meeting'||params.get('tab')==='meeting';
const initialTab=requestedMeeting?'meeting':'dialogue';
if(agent&&requestedAgent){
 agent.hidden=false;if(meeting)meeting.hidden=false;if(room)room.hidden=false;
 const controls=document.getElementById('agentLeftControls');
 if(controls)controls.hidden=false;
}
let selected='dialogue';
function show(tab,focus=false){
 const activeAgent=Boolean(agent&&!agent.hidden);
 selected=activeAgent?nextAgentTab(selected,tab):nextRoomTab(selected,tab);
 const entries=[['dialogue',dialogue],['activity',activity]];
 if(activeAgent){entries.push(['agent',agent]);if(meeting)entries.push(['meeting',meeting]);if(room)entries.push(['room',room]);}
 for(const [name,button] of entries){
  const on=name===selected;
  button.setAttribute('aria-selected',String(on));
  button.tabIndex=on?0:-1;
  panes[name].hidden=!on;
  panes[name].style.display=on?'block':'none';
 }
 if(focus)(selected==='dialogue'?dialogue:selected==='activity'?activity:selected==='agent'?agent:selected==='meeting'?meeting:room).focus();
}
for(const [name,button] of [['dialogue',dialogue],['activity',activity],...(agent?[['agent',agent]]:[]),...(meeting?[['meeting',meeting]]:[]),...(room?[['room',room]]:[])]){
 button.addEventListener('click',()=>show(name));
 button.addEventListener('keydown',event=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();show(event.key,true);
 });
}
show(initialTab);
(typeof window!=='undefined'?window:null)?.addEventListener?.('tracky:agent-tab-ready',()=>{
 if(agent){agent.hidden=false;if(meeting)meeting.hidden=false;if(room)room.hidden=false;show(initialTab);}
});

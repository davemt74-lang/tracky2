import {ROSTER_STATE_KEY,rosterView,nextRosterState} from './src/roster-layout.js';
const $=id=>document.getElementById(id);
const ui={
  layout:$('participantsLayout'),roster:$('participantRoster'),
  expand:$('expandParticipantRoster'),collapse:$('collapseParticipantRoster'),
  open:$('openParticipantRoster'),backdrop:$('participantRosterBackdrop'),
  add:$('newParticipant')
};
const viewport=window.matchMedia('(max-width: 900px)');
let collapsed=false;
try{collapsed=window.sessionStorage.getItem(ROSTER_STATE_KEY)==='true';}catch{}
let state=rosterView({wide:!viewport.matches,collapsed});
let lastFocus=null;
function render(){
  const wide=!viewport.matches;
  ui.layout.dataset.roster=state.state;
  ui.roster.classList.toggle('roster-visible',state.expanded);
  ui.roster.setAttribute('aria-hidden',String(!wide&&!state.expanded));
  if(!wide&&!state.expanded){ui.roster.inert=true;}else{ui.roster.inert=false;}
  ui.backdrop.hidden=!state.backdrop;
  ui.expand.hidden=!wide||state.expanded;
  ui.collapse.hidden=wide&&!state.expanded;
  ui.collapse.setAttribute('aria-expanded',String(state.expanded));
  ui.open.setAttribute('aria-expanded',String(state.expanded));
  ui.expand.setAttribute('aria-expanded',String(state.expanded));
  ui.open.setAttribute('aria-label',state.expanded?'Collapse Participants sidebar':'Expand Participants sidebar');
  ui.open.querySelector('span').textContent=state.expanded?'Hide list':'Participants';
  document.body.classList.toggle('participant-roster-modal',state.modal);
}
function apply(action){
  const before=state;
  state=nextRosterState(state,action,!viewport.matches);
  if(!viewport.matches){
    collapsed=!state.expanded;
    try{window.sessionStorage.setItem(ROSTER_STATE_KEY,String(collapsed));}catch{}
  }
  render();
  if(state.modal&&!before.modal){lastFocus=document.activeElement;ui.collapse.focus();}
  if(!state.modal&&before.modal){(lastFocus?.isConnected?lastFocus:ui.open).focus();}
}
ui.open.addEventListener('click',()=>apply(state.expanded?'close':'open'));
ui.expand.addEventListener('click',()=>apply('open'));
ui.collapse.addEventListener('click',()=>apply('close'));
ui.backdrop.addEventListener('click',()=>apply('close'));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&state.modal){event.preventDefault();apply('close');}
  if(event.key==='Tab'&&state.modal){
    const nodes=[...ui.roster.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(node=>!node.disabled&&!node.hidden&&node.getClientRects().length);
    if(!nodes.length)return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
ui.add.addEventListener('click',()=>{if(state.modal)apply('close');});
viewport.addEventListener('change',event=>{
  state=rosterView({wide:!event.matches,collapsed,mobileOpen:false});
  render();
});
render();

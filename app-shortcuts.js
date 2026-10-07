import {nextTripleShortcut,shortcutNavigationTarget} from './src/agent-shortcuts.js';

let shortcut={key:'',count:0,lastAt:0};

function editableTarget(target){
 return Boolean(target?.isContentEditable||
  ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)||
  target?.closest?.('[contenteditable="true"]'));
}

document.addEventListener('keydown',event=>{
 if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||editableTarget(event.target))return;
 const key=String(event.key||'').toLowerCase();
 if(key!=='v'&&key!=='b'){shortcut={key:'',count:0,lastAt:0};return;}
 const next=nextTripleShortcut(shortcut,key,performance.now());
 shortcut=next.state;
 if(!next.trigger)return;
 if(next.trigger==='b'&&document.getElementById('roomDialogueTab')){
  window.dispatchEvent(new CustomEvent('tracky:agent-show-conversation',{detail:{source:'bbb-shortcut'}}));
  document.getElementById('roomDialogueTab')?.click();
  return;
 }
 const target=shortcutNavigationTarget(next.trigger);
 if(target)window.location.assign(target);
});

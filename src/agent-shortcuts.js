// Shared triple-key shortcut logic.
// AGENT-local: ZZZ Camera/Orb, XXX sidebar visibility, CCC Control Center.
// Global navigation: VVV Participants, BBB AGENT Conversation.
export const TRIPLE_SHORTCUT_KEYS=Object.freeze(['x','z','c','v','b']);

export function nextTripleShortcut(state={key:'',count:0,lastAt:0},key,at,gapMs=650){
 const current=String(key||'').toLowerCase();
 if(!TRIPLE_SHORTCUT_KEYS.includes(current)||!Number.isFinite(at))
  return {state:{key:'',count:0,lastAt:0},trigger:null};
 const count=state.key===current&&at-state.lastAt<=gapMs?state.count+1:1;
 return count===3?{state:{key:'',count:0,lastAt:0},trigger:current}:
  {state:{key:current,count,lastAt:at},trigger:null};
}

export function shortcutNavigationTarget(trigger){
 const key=String(trigger||'').toLowerCase();
 if(key==='v')return './participants.html';
 if(key==='b')return './vertical-motion.html?tab=dialogue';
 return null;
}

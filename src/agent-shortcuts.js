// Shared shortcut logic for ZZZ Camera/Orb, XXX immersive sidebar visibility and CCC Control Center.
export function nextTripleShortcut(state={key:'',count:0,lastAt:0},key,at,gapMs=650){
 const current=String(key||'').toLowerCase();
 if(!['x','z','c'].includes(current)||!Number.isFinite(at))return {state:{key:'',count:0,lastAt:0},trigger:null};
 const count=state.key===current&&at-state.lastAt<=gapMs?state.count+1:1;
 return count===3?{state:{key:'',count:0,lastAt:0},trigger:current}:
  {state:{key:current,count,lastAt:at},trigger:null};
}

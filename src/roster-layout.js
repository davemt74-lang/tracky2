// Pure responsive roster-state rules. Do not manipulate participant/biometric storage.
export const ROSTER_STATE_KEY='tracky2-roster-collapsed-v1';
export function rosterView({wide=true,collapsed=false,mobileOpen=false}={}){
  if(!wide)return Object.freeze({state:mobileOpen?'mobile-open':'mobile-closed',
    expanded:mobileOpen,modal:mobileOpen,backdrop:mobileOpen});
  return Object.freeze({state:collapsed?'collapsed':'expanded',
    expanded:!collapsed,modal:false,backdrop:false});
}
export function nextRosterState(current,action,wide=true){
  if(!['toggle','open','close','mobile-close'].includes(action))throw new RangeError('Invalid roster action.');
  const view=current||rosterView({wide});
  if(!wide){
    const open=action==='open'?true:action==='toggle'?!view.expanded:false;
    return rosterView({wide:false,mobileOpen:open});
  }
  if(action==='mobile-close')return rosterView({wide,collapsed:!view.expanded});
  return rosterView({wide,collapsed:action==='close'?true:action==='open'?false:view.expanded});
}

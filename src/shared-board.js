// Pure shared four-section board view, reusable by all game rules.
export function sharedBoardView({ zoneCount=4, active=false, activeZone=null,
  repsRemaining=0, activeColor=null } = {}) {
  if (zoneCount!==4) throw new RangeError('Shared Tracky2 board has exactly four sections.');
  const color=active&&['green','blue'].includes(activeColor)?activeColor:'idle';
  const target=active && Number.isInteger(activeZone) &&
    activeZone>=0 && activeZone<4 ? activeZone:null;
  return Object.freeze({
    color,
    zones:Object.freeze(Array.from({length:4},(_,index)=>Object.freeze({
      index,target:index===target,label:index===target?String(repsRemaining):String(index+1)
    })))
  });
}
export function paintSharedBoard(element, view) {
  if (!element || !view) throw new TypeError('Board and view are required.');
  element.dataset.activeColor=view.color;
  for (const cell of element.querySelectorAll('[data-board-zone]')) {
    const state=view.zones[Number(cell.dataset.boardZone)];
    if (!state) continue;
    cell.classList.toggle('target',state.target);
    cell.querySelector('b').textContent=state.label;
  }
}

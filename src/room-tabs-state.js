export const ROOM_TABS=Object.freeze(['dialogue','activity']);
export function nextRoomTab(current,action){
 if(!ROOM_TABS.includes(current))current='dialogue';
 if(action==='dialogue'||action==='activity')return action;
 if(action==='Home')return 'dialogue';
 if(action==='End')return 'activity';
 if(action==='ArrowLeft')return current==='dialogue'?'activity':'dialogue';
 if(action==='ArrowRight')return current==='activity'?'dialogue':'activity';
 return current;
}

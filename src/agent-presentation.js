// Presentation-only AGENT UI state: camera processing and voice permissions
// remain owned by the canonical runtime when the ORB visualization is selected.
export const AGENT_VIEWS=Object.freeze(['camera','orb']);
export function normalizeAgentView(value){return AGENT_VIEWS.includes(value)?value:'camera';}
export function nextAgentTab(current,action){
 const tabs=['dialogue','activity','agent','room'];
 const index=tabs.indexOf(current);
 if(tabs.includes(action))return action;
 if(action==='Home')return tabs[0];
 if(action==='End')return tabs[3];
 if(action==='ArrowRight')return tabs[((index<0?0:index)+1)%4];
 if(action==='ArrowLeft')return tabs[((index<0?0:index)+3)%4];
 return index<0?'dialogue':current;
}
export function orbPresentation({view='camera',speaking=false}={}){
 const orb=normalizeAgentView(view)==='orb';
 return Object.freeze({orb,videoVisible:!orb,orbSpeaking:orb&&!!speaking});
}

export const ROOM_TIMELINE_FILTERS=Object.freeze([
 'all','presence','audio','decision','activity','system'
]);

export function normalizeRoomTimelineFilter(value){
 const key=String(value||'').toLowerCase();
 return ROOM_TIMELINE_FILTERS.includes(key)?key:'all';
}

export function roomEventMatchesFilter(event,filter='all'){
 const selected=normalizeRoomTimelineFilter(filter);
 if(selected==='all')return true;
 const category=String(event?.category||'').toLowerCase();
 const kind=String(event?.kind||'observation').toLowerCase();
 if(selected==='decision')
  return category==='decision'||['decision','action','outcome','correction'].includes(kind);
 if(selected==='activity')return ['activity','media'].includes(category);
 return category===selected;
}

export function roomUiOverview({
 events=[],stableParticipants=0,camera='offline',microphone='offline'
}={}){
 const rows=Array.isArray(events)?events:[];
 const decisions=rows.filter(event=>
  String(event?.category||'').toLowerCase()==='decision'||
  ['decision','action','outcome'].includes(String(event?.kind||'').toLowerCase())
 ).length;
 const corrections=rows.filter(event=>String(event?.kind||'').toLowerCase()==='correction').length;
 return Object.freeze({
  participants:Math.max(0,Number(stableParticipants)||0),
  evidence:rows.length,
  decisions,
  corrections,
  camera:String(camera||'offline'),
  microphone:String(microphone||'offline')
 });
}

// Transient, bounded confirmed-participant activity timeline. No faces, embeddings,
// photos, raw audio, unknown detections, gameplay scoring or persistent storage.
export const MAX_ACTIVITY_ITEMS=36;
export function activityEvent({participantId,name,kind,detail='',at,source='confirmed-tracking'}={}){
 if(typeof participantId!=='string'||!participantId||typeof name!=='string'||!name.trim())
   return null;
 if(!['present','arrived','departed','matched'].includes(kind))return null;
 if(!Number.isFinite(at)||at<0)return null;
 const safeSource=['confirmed-tracking','visitor-observation','participant-activity'].includes(source)
   ?source:'confirmed-tracking';
 return Object.freeze({participantId,name:name.trim().slice(0,70),kind,
  detail:String(detail).slice(0,120),at,source:safeSource});
}
export function addActivity(history,event,limit=MAX_ACTIVITY_ITEMS){
 if(!event||!Array.isArray(history))return Array.isArray(history)?history.slice():[];
 const safe=history.filter(x=>x&&x.participantId&&Number.isFinite(x.at));
 const last=safe[safe.length-1];
 if(last?.participantId===event.participantId&&last?.kind===event.kind&&
    last?.detail===event.detail&&event.at-last.at<1100)return safe.slice(-limit);
 return [...safe,event].slice(-Math.max(1,Math.min(MAX_ACTIVITY_ITEMS,limit)));
}
export function presentParticipants(tracks){
 return Array.isArray(tracks)?tracks.filter(t=>t?.participantId&&
  ['matched','body-lock','occluded'].includes(t.status)):[];
}

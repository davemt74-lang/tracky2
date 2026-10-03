// Local, factual ROOM observation stream. Inference (sitting/sleep) and capture
// are separate opt-in skills; this module never silently collects media.
export const MAX_ROOM_EVENTS=120;
export const ROOM_ABSENCE_GRACE_MS=10000;
const CATEGORIES=new Set(['presence','audio','system','activity','media','decision']);
export function roomObservation(input={},now=Date.now()){
 const at=Number.isFinite(input.at)?input.at:now;
 if(!CATEGORIES.has(input.category)||!Number.isFinite(at))return null;
 const confidence=Number.isFinite(input.confidence)?Math.min(1,Math.max(0,input.confidence)):null;
 return Object.freeze({
  id:String(input.id||('room-'+at+'-'+Math.random().toString(36).slice(2,10))),
  at,category:input.category,
  message:String(input.message||'').trim().slice(0,240),
  participantId:input.participantId||null,confidence,
  source:String(input.source||'local').slice(0,40),
  evidence:input.evidence&&typeof input.evidence==='object'?
   Object.freeze({durationMs:Number.isFinite(input.evidence.durationMs)?Math.max(0,input.evidence.durationMs):null}):null
 });
}
export function appendRoomObservation(entries,event,max=MAX_ROOM_EVENTS){
 if(!event?.message)return [...entries];
 return [...entries,event].slice(-max);
}
export class RoomPresenceLedger{
 constructor({graceMs=ROOM_ABSENCE_GRACE_MS}={}){
  this.graceMs=graceMs;this.active=new Map();this.available=false;
 }
 update(tracks,at=Date.now()){
  this.available=true;
  const events=[],visible=new Set();
  for(const track of tracks||[]){
   // Only stable public tracks supplied by the existing detector qualify.
   // A nearby visible face is NEVER enough to identify the current speaker.
   const key=track?.participantId?'participant:'+track.participantId:
     track?.visitorId?'visitor:'+track.visitorId:track?.id?'track:'+track.id:null;
   if(!key||visible.has(key))continue;
   visible.add(key);
   const previous=this.active.get(key);
   if(previous){previous.lastAt=at;continue;}
   const known=Boolean(track.participantId);
   const name=known?String(track.participantName||'Enrolled participant'):'Unidentified visitor';
   this.active.set(key,{firstAt:at,lastAt:at,name,participantId:known?track.participantId:null});
   events.push(roomObservation({at,category:'presence',message:name+' observed in room',
    participantId:known?track.participantId:null,source:'stable-camera-track'}));
  }
  for(const [key,item] of this.active){
   if(visible.has(key)||at-item.lastAt<this.graceMs)continue;
   this.active.delete(key);
   events.push(roomObservation({at,category:'presence',message:item.name+' no longer visible',
    participantId:item.participantId,source:'camera-absence',
    evidence:{durationMs:item.lastAt-item.firstAt}}));
  }
  return events;
 }
 unavailable(){this.available=false;this.active.clear();}
}

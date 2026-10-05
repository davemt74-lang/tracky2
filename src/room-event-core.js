// V0.10A: ONE canonical, local-first ROOM event path. No media or biometrics.
export const MAX_ROOM_EVENTS=120;
export const ROOM_ABSENCE_GRACE_MS=10000;
export const ROOM_EVENT_SCHEMA=1;
export const ROOM_DEDUPE_WINDOW_MS=2500;
const CATEGORIES=new Set(['presence','audio','system','activity','media','decision']);
const KINDS=new Set(['observation','inference','decision','action','outcome','correction']);
const SENSORS=new Set(['camera','microphone']);
const STATUSES=new Set(['online','offline','paused','degraded']);
const RETENTION=new Set(['session','local']);
const short=(v,n=120)=>String(v??'').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function eventId(){
 return globalThis.crypto?.randomUUID?.()||
  'room-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
}
function boundedEvidence(input){
 const e=input&&typeof input==='object'?input:{};
 const env=e.environmental&&typeof e.environmental==='object'?e.environmental:null;
 const environmental=env?Object.freeze({
  category:short(env.category,64)||null,
  subtype:short(env.subtype,64)||null,
  modelLabel:short(env.modelLabel,96)||null,
  groupId:short(env.groupId,96)||null,
  observationCount:finite(env.observationCount)?Math.max(1,Math.floor(env.observationCount)):null,
  sourceDirection:['left','right','center','unavailable'].includes(env.sourceDirection)
   ?env.sourceDirection:'unavailable',
  rawConfidence:finite(env.rawConfidence)?Math.max(0,Math.min(1,env.rawConfidence)):null,
  calibratedConfidence:finite(env.calibratedConfidence)?
   Math.max(0,Math.min(1,env.calibratedConfidence)):null,
  observableOnly:env.observableOnly===true,
  healthInference:'none'
 }):null;
 return Object.freeze({
  durationMs:finite(e.durationMs)?Math.max(0,e.durationMs):null,
  environmental
 });
}
export function roomObservation(input={},now=Date.now()){
 if(!input||typeof input!=='object'||!CATEGORIES.has(input.category))return null;
 const at=finite(input.at)?input.at:now;
 if(!finite(at)||at<0||at>8.64e15)return null;
 const kind=input.kind??(input.category==='decision'?'decision':'observation');
 if(!KINDS.has(kind))return null;
 const sensor=SENSORS.has(input.sensor)?input.sensor:null;
 const status=STATUSES.has(input.status)?input.status:null;
 const semantic=short(input.semantic,48);
 if(semantic==='sensor-state'&&(!sensor||!status))return null;
 let correction=null;
 if(kind==='correction'){
  const targetId=short(input.correction?.targetId,96);
  const operation=input.correction?.operation;
  if(!targetId||!['retract','replace'].includes(operation))return null;
  const patch=input.correction?.replacement;
  if(operation==='replace'&&(!patch||typeof patch.message!=='string'||!patch.message.trim()))return null;
  correction=Object.freeze({targetId,operation,replacement:operation==='replace'?
   Object.freeze({message:short(patch.message,240),confidence:finite(patch.confidence)?
    Math.max(0,Math.min(1,patch.confidence)):null}):null});
 }
 const evidence=boundedEvidence(input.evidence);
 return Object.freeze({
  version:ROOM_EVENT_SCHEMA,id:short(input.id,96)||eventId(),
  at,atUtc:new Date(at).toISOString(),
  kind,category:input.category,semantic,message:short(input.message,240),
  source:short(input.source||'local',40),deviceId:short(input.deviceId||'browser',40),
  sessionId:short(input.sessionId||'room-session',64),
  roomId:short(input.roomId,96)||null,
  participantId:input.participantId?short(input.participantId,96):null,
  relatedEventId:input.relatedEventId?short(input.relatedEventId,96):null,
  confidence:finite(input.confidence)?Math.max(0,Math.min(1,input.confidence)):null,
  evidence,dedupeKey:short(input.dedupeKey,96)||null,
  sensor,status,retention:RETENTION.has(input.retention)?input.retention:'session',
  correction
 });
}
export function appendRoomObservation(entries,event,max=MAX_ROOM_EVENTS){
 if(!event?.message)return [...entries];
 return [...entries,event].slice(-Math.max(1,max));
}
const ordered=rows=>[...rows].map((event,index)=>({event,index}))
 .sort((a,b)=>a.event.at-b.event.at||a.index-b.index).map(x=>x.event);
export class RoomEventLedger{
 constructor({max=MAX_ROOM_EVENTS,dedupeWindowMs=ROOM_DEDUPE_WINDOW_MS}={}){
  this.max=Math.max(1,Math.floor(max));this.dedupeWindowMs=Math.max(0,dedupeWindowMs);
  this.events=[];
 }
 append(input){
  const event=roomObservation(input);
  if(!event||!event.message)return Object.freeze({added:false,reason:'invalid',event:null});
  if(this.events.some(old=>old.id===event.id))
   return Object.freeze({added:false,reason:'duplicate-id',event:null});
  if(event.kind==='correction'){
   const target=this.events.find(e=>e.id===event.correction.targetId);
   if(!target||target.kind==='correction'||target.participantId!==event.participantId||
      this.events.some(e=>e.kind==='correction'&&e.correction.targetId===target.id))
    return Object.freeze({added:false,reason:'invalid-correction-target',event:null});
  }
  if(event.dedupeKey&&event.kind!=='correction'&&this.events.some(old=>
   old.dedupeKey===event.dedupeKey&&old.source===event.source&&
   old.sessionId===event.sessionId&&old.roomId===event.roomId&&
   old.participantId===event.participantId&&
   old.category===event.category&&old.kind===event.kind&&
   Math.abs(event.at-old.at)<=this.dedupeWindowMs)){
   return Object.freeze({added:false,reason:'duplicate-observation',event:null});
  }
  this.events=ordered([...this.events,event]).slice(-this.max);
  return Object.freeze({added:true,reason:null,event});
 }
 restore(rows){
  // Canonical normalization also accepts old opt-in V0.9 rows.
  this.events=[];
  for(const row of ordered((Array.isArray(rows)?rows:[]).filter(e=>e&&finite(e.at)))){
   this.append(row);
  }
  return this.entries();
 }
 entries(){return [...this.events];}
 clear(){this.events=[];}
 project(at=Infinity){return projectRoomState(this.events,at);}
}
export function projectRoomState(rows,at=Infinity){
 const list=ordered((Array.isArray(rows)?rows:[]).map(row=>roomObservation(row))
  .filter(e=>e&&e.at<=at));
 const originals=new Map(list.filter(e=>e.kind!=='correction').map(e=>[e.id,e]));
 const corrections=new Map();
 for(const e of list){
  if(e.kind!=='correction')continue;
  const target=originals.get(e.correction.targetId);
  if(target&&target.at<=e.at&&target.participantId===e.participantId&&!corrections.has(target.id))
   corrections.set(target.id,e);
 }
 const effectiveEvents=[];
 const sensors={camera:'unknown',microphone:'unknown'};
 const participants={};
 let cameraLastOnlineAt=-Infinity;
 for(const event of list){
  if(event.kind==='correction')continue;
  const fix=corrections.get(event.id);
  if(fix?.correction.operation==='retract')continue;
  const e=fix?.correction.operation==='replace'?
   Object.freeze({...event,message:fix.correction.replacement.message,
    confidence:fix.correction.replacement.confidence,correctedBy:fix.id}):event;
  effectiveEvents.push(e);
  if(e.semantic==='sensor-state'&&e.sensor&&e.status){
   sensors[e.sensor]=e.status;
   if(e.sensor==='camera'&&e.status==='online')cameraLastOnlineAt=e.at;
  }
  if(e.participantId&&['participant-observed','participant-out-of-view'].includes(e.semantic)){
   const current=participants[e.participantId]||{firstObservedAt:e.at,lastObservedAt:null,
    lastOutOfViewAt:null,visibility:'unknown'};
   if(e.semantic==='participant-observed'){
    current.lastObservedAt=e.at;current.visibility='observed';
   }else{
    current.lastOutOfViewAt=e.at;current.visibility='out-of-view';
   }
   participants[e.participantId]=current;
  }
 }
 // Camera unavailable invalidates CURRENT visibility, not historical observation.
 for(const p of Object.values(participants)){
  if(sensors.camera!=='online')p.visibility='unavailable';
  else if(p.lastObservedAt===null||p.lastObservedAt<cameraLastOnlineAt)p.visibility='unknown';
 }
 return Object.freeze({sensors:Object.freeze(sensors),participants:Object.freeze(participants),
  events:Object.freeze(effectiveEvents),corrections:Object.freeze(Object.fromEntries(corrections))});
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
    participantId:known?track.participantId:null,source:'stable-camera-track',
    semantic:'participant-observed',dedupeKey:key+':observed'}));
  }
  for(const [key,item] of this.active){
   if(visible.has(key)||at-item.lastAt<this.graceMs)continue;
   this.active.delete(key);
   events.push(roomObservation({at,category:'presence',message:item.name+' no longer visible',
    participantId:item.participantId,source:'camera-absence',
    semantic:'participant-out-of-view',dedupeKey:key+':out-of-view',
    evidence:{durationMs:item.lastAt-item.firstAt}}));
  }
  return events;
 }
 unavailable(){this.available=false;this.active.clear();}
}

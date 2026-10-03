import {sceneTrackAssociation,normalizeRoomScene} from './room-scene-graph.js';
import {roomObservation} from './room-event-core.js';

// Bounded, in-memory camera-relative temporal estimates; NOT posture, sleep,
// physical distance or permission for proactive engagement.
export const MAX_TEMPORAL_TRACKS=8;
export const DEFAULT_TEMPORAL_OPTIONS=Object.freeze({
 areaConfirmationSamples:3,areaConfirmationMs:1800,areaDwellMs:15000,
 stationaryMs:20000,stationaryRadius:.025,motionThreshold:.075,
 motionCooldownMs:5000,gapResetMs:5000,expireMs:12000
});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const displayName=t=>t.participantId?String(t.participantName||'Enrolled participant').slice(0,64):
 'Unverified visitor';
const trackKey=t=>t.participantId?'participant:'+t.participantId:
 t.visitorId?'visitor:'+t.visitorId:null;
const asPoint=t=>{
 const b=t?.box;
 if(!b||![b.x,b.y,b.width,b.height].every(finite)||b.width<=0||b.height<=0)return null;
 const x=b.x+b.width/2,y=b.y+b.height;
 if(x<0||x>1||y<0||y>=.985)return null;
 return {x,y};
};
export class RoomTemporalLedger{
 constructor(options={}){
  this.options={...DEFAULT_TEMPORAL_OPTIONS,...options};this.records=new Map();
 }
 unavailable(){this.records.clear();}
 sceneChanged(){
  for(const record of this.records.values()){
   record.candidateKey=null;record.candidateSince=null;record.candidateCount=0;
   record.confirmedKey=null;record.areaSince=null;record.dwellEmitted=false;
  }
 }
 update(publicTracks,scene,at=Date.now()){
  if(!finite(at)||at<0||!Array.isArray(publicTracks))return [];
  const areas=normalizeRoomScene(scene),options=this.options;
  const events=[],seen=new Set();
  for(const track of publicTracks.slice(0,MAX_TEMPORAL_TRACKS)){
   const key=trackKey(track);
   if(!key||seen.has(key))continue;
   seen.add(key);
   const point=asPoint(track);
   const association=sceneTrackAssociation(areas,track);
   let record=this.records.get(key);
   // An occluded body is not evidence for motion, location or stationary time.
   if(!point||association.status==='unavailable'||association.status==='uncertain-footpoint'){
    if(record){record.visibility='uncertain';record.lastAt=at;}
    continue;
   }
   const name=displayName(track),participantId=track.participantId||null;
   if(!record){
    record={key,name,participantId,lastAt:at,lastSeenAt:at,visibility:'observed',
     anchor:point,stationarySince:at,stationaryEmitted:false,
     candidateKey:null,candidateSince:null,candidateCount:0,
     confirmedKey:null,areaSince:null,dwellEmitted:false,motionEvents:0,
     lastMotionEventAt:-Infinity,lastActivity:'First stable observation'};
    this.records.set(key,record);
   }else{
    if(at-record.lastSeenAt>options.gapResetMs){
     record.anchor=point;record.stationarySince=at;record.stationaryEmitted=false;
     record.candidateKey=null;record.candidateSince=null;record.candidateCount=0;
     record.confirmedKey=null;record.areaSince=null;record.dwellEmitted=false;
     record.lastActivity='Reacquired; earlier activity continuity uncertain';
    }
    record.lastAt=at;record.lastSeenAt=at;record.visibility='observed';
   }
   record.name=name;record.participantId=participantId;
   const delta=distance(record.anchor,point);
   if(delta>options.motionThreshold){
    const priorStationary=record.stationarySince;
    record.anchor=point;record.stationarySince=at;record.stationaryEmitted=false;
    if(at-record.lastMotionEventAt>=options.motionCooldownMs){
     events.push(roomObservation({at,category:'activity',semantic:'camera-motion',
      message:name+' moved within the camera view · physical distance unknown',
      participantId,source:'stable-camera-temporal',
      dedupeKey:key+':motion:'+at,
      evidence:{durationMs:Math.max(0,at-priorStationary)}}));
     record.motionEvents++;record.lastMotionEventAt=at;record.lastActivity='Camera-relative movement';
    }
   }else if(delta>options.stationaryRadius){
    // Moderate drift is not a confidently stationary interval.
    record.anchor=point;record.stationarySince=at;record.stationaryEmitted=false;
   }else if(!record.stationaryEmitted&&at-record.stationarySince>=options.stationaryMs){
    events.push(roomObservation({at,category:'activity',semantic:'stationary-period',
     message:name+' remained relatively stationary in camera view · posture and sleep unknown',
     participantId,source:'stable-camera-temporal',
     dedupeKey:key+':stationary:'+record.stationarySince,
     evidence:{durationMs:Math.max(0,at-record.stationarySince)}}));
    record.stationaryEmitted=true;record.lastActivity='Relative stillness observed';
   }
   // Ambiguous overlap, missing footpoint or occlusion never advances dwell.
   const nextKey=association.status==='camera-relative'?
     'area:'+association.areaId:association.status==='unmapped'?'unmapped':null;
   if(nextKey===null){
    record.candidateKey=null;record.candidateSince=null;record.candidateCount=0;
    // Invalid/overlapping positions break location continuity; never infer a
    // transition when the camera regains an unambiguous position.
    record.confirmedKey=null;record.previousAreaSince=null;
    record.areaSince=null;record.dwellEmitted=false;
    continue;
   }
   if(nextKey!==record.candidateKey){
    record.candidateKey=nextKey;record.candidateSince=at;record.candidateCount=1;
   }else record.candidateCount++;
   const stable=record.candidateCount>=options.areaConfirmationSamples&&
     at-record.candidateSince>=options.areaConfirmationMs;
   if(!stable)continue;
   if(nextKey!==record.confirmedKey){
    const previous=record.confirmedKey;
    record.confirmedKey=nextKey;record.areaSince=at;record.dwellEmitted=false;
    const area=areas.areas.find(a=>'area:'+a.id===nextKey);
    const before=areas.areas.find(a=>'area:'+a.id===previous);
    if(previous!==null){
     const detail=area?'entered owner-defined camera area '+area.name:
      'moved outside mapped camera areas';
     events.push(roomObservation({at,category:'activity',semantic:'area-transition',
      message:name+' '+detail+' · room departure not inferred',
      participantId,source:'stable-camera-temporal',
      dedupeKey:key+':area:'+nextKey+':'+record.candidateSince,
      evidence:{durationMs:Math.max(0,at-(record.previousAreaSince??at))}}));
     record.lastActivity=before&&area?'Camera-area transition':detail;
    }
    record.previousAreaSince=at;
   }else if(nextKey!=='unmapped'&&!record.dwellEmitted&&record.areaSince!==null&&
     at-record.areaSince>=options.areaDwellMs){
    const area=areas.areas.find(a=>'area:'+a.id===nextKey);
    if(area){
     events.push(roomObservation({at,category:'activity',semantic:'area-dwell',
      message:name+' observed within '+area.name+' camera area for '+
       Math.floor((at-record.areaSince)/1000)+'s · physical activity unknown',
      participantId,source:'stable-camera-temporal',
      dedupeKey:key+':dwell:'+nextKey+':'+record.areaSince,
      evidence:{durationMs:Math.max(0,at-record.areaSince)}}));
     record.dwellEmitted=true;record.lastActivity='Area dwell observed';
    }
   }
  }
  // Temporary loss doesn't imply leaving a room or an occupied mapped area.
  for(const [key,record] of this.records){
   if(seen.has(key))continue;
   record.visibility='unavailable';
   if(at-record.lastSeenAt>options.expireMs)this.records.delete(key);
  }
  while(this.records.size>MAX_TEMPORAL_TRACKS){
   const oldest=[...this.records].sort((a,b)=>a[1].lastSeenAt-b[1].lastSeenAt)[0];
   this.records.delete(oldest[0]);
  }
  return events.filter(Boolean);
 }
 summary(scene,at=Date.now()){
  const areas=normalizeRoomScene(scene);
  return Object.freeze([...this.records.values()].map(record=>{
   const areaId=record.confirmedKey?.startsWith('area:')?
    record.confirmedKey.slice(5):null;
   const area=areas.areas.find(a=>a.id===areaId);
   const continuous=record.visibility==='observed'&&
     at-record.lastSeenAt<=this.options.gapResetMs;
   return Object.freeze({participantId:record.participantId,name:record.name,
    visibility:continuous?'observed':'uncertain',
    areaName:area?.name||null,motionEvents:record.motionEvents,
    stationaryMs:continuous?Math.max(0,at-record.stationarySince):null,
    areaDwellMs:continuous&&area&&record.areaSince!==null?
     Math.max(0,at-record.areaSince):null,
    lastActivity:record.lastActivity});
  }));
 }
}

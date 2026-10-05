export const ROOM_HANDOFF_SCHEMA=1;
export const ROOM_OBSERVATION_STALE_MS=15000;
export const ROOM_SIMULTANEOUS_WINDOW_MS=6000;
export const ROOM_HANDOFF_CONFIRM_MS=30000;
export const ROOM_REENTRY_WINDOW_MS=60000;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const short=(value,max=96)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value)))];

function snapshotRecord(record){
 return Object.freeze({
  schema:ROOM_HANDOFF_SCHEMA,
  participantId:record.participantId,
  state:record.state,
  currentRoomId:record.currentRoomId||null,
  lastKnownRoomId:record.lastKnownRoomId||null,
  candidateRoomIds:Object.freeze(uniq(record.candidateRoomIds).slice(0,8)),
  lastObservedAt:finite(record.lastObservedAt)?record.lastObservedAt:null,
  lastOutOfViewAt:finite(record.lastOutOfViewAt)?record.lastOutOfViewAt:null,
  pendingHandoff:record.pendingHandoff?Object.freeze({...record.pendingHandoff}):null,
  transition:record.transition?Object.freeze({...record.transition}):null,
  reason:record.reason||null,
  provenance:Object.freeze(uniq(record.provenance).slice(0,12))
 });
}

function baseRecord(participantId){
 return {
  participantId,state:'unknown',currentRoomId:null,lastKnownRoomId:null,
  candidateRoomIds:[],lastObservedAt:null,lastOutOfViewAt:null,
  pendingHandoff:null,transition:null,reason:null,provenance:[],
  roomObservations:new Map()
 };
}

export class RoomHandoffTracker{
 constructor({
  staleMs=ROOM_OBSERVATION_STALE_MS,
  simultaneousWindowMs=ROOM_SIMULTANEOUS_WINDOW_MS,
  handoffConfirmMs=ROOM_HANDOFF_CONFIRM_MS,
  reentryWindowMs=ROOM_REENTRY_WINDOW_MS
 }={}){
  this.staleMs=Math.max(1000,Number(staleMs)||ROOM_OBSERVATION_STALE_MS);
  this.simultaneousWindowMs=Math.max(500,Number(simultaneousWindowMs)||ROOM_SIMULTANEOUS_WINDOW_MS);
  this.handoffConfirmMs=Math.max(1000,Number(handoffConfirmMs)||ROOM_HANDOFF_CONFIRM_MS);
  this.reentryWindowMs=Math.max(1000,Number(reentryWindowMs)||ROOM_REENTRY_WINDOW_MS);
  this.records=new Map();
 }
 record(participantId){
  const id=short(participantId);
  if(!id)throw new TypeError('Participant id required.');
  if(!this.records.has(id))this.records.set(id,baseRecord(id));
  return this.records.get(id);
 }
 prune(record,at){
  for(const [roomId,seenAt] of record.roomObservations){
   if(at-seenAt>this.staleMs)record.roomObservations.delete(roomId);
  }
 }
 observe({participantId,roomId,at=Date.now(),source='stable-camera-track'}={}){
  const id=short(participantId),room=short(roomId);
  if(!id||!room||!finite(at))throw new TypeError('Valid participant, room and timestamp required.');
  const record=this.record(id);this.prune(record,at);
  const previousState=record.state,previousRoom=record.currentRoomId||record.lastKnownRoomId||null;
  const priorSame=record.roomObservations.get(room)||null;
  record.roomObservations.set(room,at);
  const competing=[...record.roomObservations.entries()]
   .filter(([candidate,seenAt])=>candidate!==room&&at-seenAt<=this.simultaneousWindowMs)
   .map(([candidate])=>candidate);
  let pending=record.pendingHandoff;
  if(pending&&at-pending.at>this.handoffConfirmMs){
   record.pendingHandoff=null;pending=null;
  }
  if(pending&&pending.toRoomId===room&&at-pending.at<=this.handoffConfirmMs){
   record.state='handoff-confirmed';
   record.currentRoomId=room;record.lastKnownRoomId=room;
   record.candidateRoomIds=[room];record.lastObservedAt=at;
   record.transition={
    type:'explicit-room-handoff',fromRoomId:pending.fromRoomId,toRoomId:room,
    declaredAt:pending.at,confirmedAt:at,authority:pending.authority
   };
   record.pendingHandoff=null;record.reason='explicit-handoff-confirmed-by-current-observation';
   record.provenance=['explicit-handoff',source,'current-room-observation'];
   return snapshotRecord(record);
  }
  if(competing.length){
   record.state='simultaneous-room-conflict';
   record.currentRoomId=null;
   record.candidateRoomIds=uniq([room,...competing]);
   record.lastObservedAt=at;
   record.transition=null;
   record.reason='participant-observed-in-multiple-rooms-without-resolved-handoff';
   record.provenance=[source,'cross-room-conflict','no-teleport-inference'];
   return snapshotRecord(record);
  }
  const sameKnown=previousRoom===room;
  if(sameKnown){
   const reentered=previousState==='uncertain-departure'&&record.lastOutOfViewAt!==null&&
    at-record.lastOutOfViewAt<=this.reentryWindowMs;
   record.state=reentered?'reentered':'observed';
   record.currentRoomId=room;record.lastKnownRoomId=room;
   record.candidateRoomIds=[room];record.lastObservedAt=at;
   record.transition=reentered?{
    type:'same-room-reentry',roomId:room,outOfViewAt:record.lastOutOfViewAt,reenteredAt:at
   }:null;
   record.reason=reentered?'same-room-reentry-after-uncertain-absence':'current-room-observation';
   record.provenance=[source,reentered?'same-room-reentry':'same-room-observation'];
   return snapshotRecord(record);
  }
  if(previousRoom&&previousRoom!==room){
   const previousSeen=record.roomObservations.get(previousRoom);
   const priorFresh=finite(previousSeen)&&at-previousSeen<=this.staleMs;
   if(previousState==='departed'){
    record.state='observed-after-explicit-departure';
    record.currentRoomId=room;record.lastKnownRoomId=room;record.candidateRoomIds=[room];
    record.lastObservedAt=at;record.transition=null;
    record.reason='new-room-observed-after-explicit-departure-no-route-inferred';
    record.provenance=[source,'explicit-prior-departure','no-route-inference'];
    return snapshotRecord(record);
   }
   if(priorFresh||previousState==='uncertain-departure'){
    record.state='cross-room-unlinked';
    record.currentRoomId=null;record.candidateRoomIds=uniq([previousRoom,room]);
    record.lastObservedAt=at;record.transition=null;
    record.reason='new-room-observation-without-explicit-handoff';
    record.provenance=[source,'cross-room-observation','no-teleport-inference'];
    return snapshotRecord(record);
   }
   record.state='observed-after-stale-gap';
   record.currentRoomId=room;record.lastKnownRoomId=room;record.candidateRoomIds=[room];
   record.lastObservedAt=at;record.transition=null;
   record.reason='prior-room-evidence-stale-current-room-observed-no-transition-inferred';
   record.provenance=[source,'prior-room-stale','no-route-inference'];
   return snapshotRecord(record);
  }
  record.state=priorSame?'observed':'observed';
  record.currentRoomId=room;record.lastKnownRoomId=room;record.candidateRoomIds=[room];
  record.lastObservedAt=at;record.transition=null;
  record.reason='first-current-room-observation';
  record.provenance=[source];
  return snapshotRecord(record);
 }
 outOfView({participantId,roomId,at=Date.now(),source='camera-absence'}={}){
  const id=short(participantId),room=short(roomId);
  if(!id||!room||!finite(at))throw new TypeError('Valid participant, room and timestamp required.');
  const record=this.record(id);
  record.lastOutOfViewAt=at;
  if(record.currentRoomId===room||record.lastKnownRoomId===room){
   record.state='uncertain-departure';
   record.currentRoomId=null;record.lastKnownRoomId=room;
   record.candidateRoomIds=[room];record.transition=null;
   record.reason='camera-loss-does-not-prove-room-departure';
   record.provenance=[source,'absence-only','no-departure-inference'];
  }
  return snapshotRecord(record);
 }
 declareDeparture({participantId,roomId,at=Date.now(),authority='local-owner'}={}){
  const id=short(participantId),room=short(roomId);
  if(!id||!room||!finite(at))throw new TypeError('Valid participant, room and timestamp required.');
  const record=this.record(id);
  record.state='departed';record.currentRoomId=null;record.lastKnownRoomId=room;
  record.candidateRoomIds=[];record.lastOutOfViewAt=at;record.pendingHandoff=null;
  record.roomObservations.delete(room);
  record.transition={type:'explicit-room-departure',roomId:room,at,authority:short(authority,48)};
  record.reason='explicit-room-departure';
  record.provenance=['explicit-departure',short(authority,48)];
  return snapshotRecord(record);
 }
 declareHandoff({
  participantId,fromRoomId,toRoomId,at=Date.now(),authority='local-owner'
 }={}){
  const id=short(participantId),from=short(fromRoomId),to=short(toRoomId);
  if(!id||!from||!to||from===to||!finite(at))
   throw new TypeError('Valid participant and distinct room ids required.');
  const record=this.record(id);
  record.pendingHandoff={
   fromRoomId:from,toRoomId:to,at,authority:short(authority,48)||'local-owner'
  };
  record.state='handoff-pending';
  record.currentRoomId=null;record.lastKnownRoomId=from;
  record.candidateRoomIds=[to];
  record.transition={type:'explicit-room-handoff-declared',fromRoomId:from,toRoomId:to,at,
   authority:short(authority,48)||'local-owner'};
  record.reason='explicit-handoff-awaiting-target-room-observation';
  record.provenance=['explicit-handoff',short(authority,48)||'local-owner'];
  return snapshotRecord(record);
 }
 reconcileParticipants(participantIds=[]){
  const active=new Set((participantIds||[]).map(short).filter(Boolean));
  for(const id of this.records.keys())if(!active.has(id))this.records.delete(id);
  return this.snapshot();
 }
 snapshot(){
  return Object.freeze([...this.records.values()].map(snapshotRecord));
 }
}

export function roomHandoffTurnFields(record){
 const value=record||{};
 return Object.freeze({
  roomHandoffSchema:ROOM_HANDOFF_SCHEMA,
  roomPresenceState:short(value.state,64)||'unknown',
  currentRoomId:short(value.currentRoomId)||null,
  lastKnownRoomId:short(value.lastKnownRoomId)||null,
  candidateRoomIds:Object.freeze(uniq(value.candidateRoomIds).slice(0,8)),
  roomTransition:value.transition?Object.freeze({...value.transition}):null,
  roomHandoffReason:short(value.reason,160)||null,
  roomHandoffProvenance:Object.freeze(uniq(value.provenance).slice(0,12))
 });
}

export function roomHandoffMessage(record,roomName=id=>id){
 if(!record)return 'Room handoff state unavailable';
 const name=id=>short(roomName(id)||id,96);
 if(record.state==='handoff-confirmed')
  return 'Explicit handoff confirmed · '+name(record.transition?.fromRoomId)+' → '+
   name(record.transition?.toRoomId);
 if(record.state==='handoff-pending')
  return 'Explicit handoff declared · '+name(record.transition?.fromRoomId)+' → '+
   name(record.transition?.toRoomId)+' · awaiting target-room observation';
 if(record.state==='departed')
  return 'Explicit departure confirmed from '+name(record.lastKnownRoomId)+
   ' · destination not inferred';
 if(record.state==='observed-after-explicit-departure')
  return 'Participant observed in '+name(record.currentRoomId)+
   ' after explicit departure · route not inferred';
 if(record.state==='reentered')
  return 'Participant re-observed in '+name(record.currentRoomId)+
   ' · prior camera loss did not imply departure';
 if(record.state==='uncertain-departure')
  return 'Participant out of view in '+name(record.lastKnownRoomId)+
   ' · room departure remains unconfirmed';
 if(record.state==='simultaneous-room-conflict')
  return 'Conflicting room observations · '+record.candidateRoomIds.map(name).join(' / ')+
   ' · no room transition inferred';
 if(record.state==='cross-room-unlinked')
  return 'Participant observed across rooms without explicit handoff · '+
   record.candidateRoomIds.map(name).join(' / ')+' · no route inferred';
 return 'Room presence · '+String(record.state||'unknown').replaceAll('-',' ');
}

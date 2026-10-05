export const MULTI_ROOM_SCHEMA=1;
export const MULTI_ROOM_NODE_STALE_MS=15000;
export const MULTI_ROOM_EVENT_MAX_AGE_MS=120000;
export const MULTI_ROOM_CLOCK_SKEW_LIMIT_MS=30000;
export const MULTI_ROOM_EVENT_LIMIT=512;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,max=96)=>String(v??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).map(v=>short(v)).filter(Boolean))];

export function normalizeRoomNode(input={},serverNow=Date.now()){
 const id=short(input.id||input.nodeId);
 const roomId=short(input.roomId);
 if(!id||!roomId)return null;
 const serverSeenAt=finite(input.serverSeenAt)?Math.max(0,input.serverSeenAt):serverNow;
 const clientAt=finite(input.clientAt)?Math.max(0,input.clientAt):null;
 const skew=clientAt===null?null:Math.max(
  -MULTI_ROOM_CLOCK_SKEW_LIMIT_MS,
  Math.min(MULTI_ROOM_CLOCK_SKEW_LIMIT_MS,serverSeenAt-clientAt)
 );
 return Object.freeze({
  schema:MULTI_ROOM_SCHEMA,id,roomId,
  roomName:short(input.roomName,96)||roomId,
  runtimeInstanceId:short(input.runtimeInstanceId,96)||null,
  serverSeenAt,clientAt,
  clockSkewMs:skew,
  preferredPrimary:input.preferredPrimary===true,
  connectedAt:finite(input.connectedAt)?Math.max(0,input.connectedAt):serverSeenAt
 });
}

export function roomNodeHealth(node,now=Date.now()){
 if(!node)return Object.freeze({state:'missing',ageMs:null,healthy:false});
 const age=Math.max(0,Number(now)-Number(node.serverSeenAt||0));
 if(age>MULTI_ROOM_NODE_STALE_MS)
  return Object.freeze({state:'stale',ageMs:age,healthy:false});
 return Object.freeze({state:age>MULTI_ROOM_NODE_STALE_MS*.6?'degraded':'online',
  ageMs:age,healthy:true});
}

export function arbitratePrimaryNode(nodes=[],{
 roomId,preferredNodeId=null,now=Date.now()
}={}){
 const room=short(roomId);
 const healthy=(nodes||[]).map(node=>normalizeRoomNode(node,now)).filter(Boolean)
  .filter(node=>node.roomId===room&&roomNodeHealth(node,now).healthy);
 if(!healthy.length)return Object.freeze({
  roomId:room,state:'unavailable',primaryNodeId:null,candidateNodeIds:Object.freeze([])
 });
 const preferred=short(preferredNodeId);
 if(preferred&&healthy.some(node=>node.id===preferred))return Object.freeze({
  roomId:room,state:'explicit-primary',primaryNodeId:preferred,
  candidateNodeIds:Object.freeze(healthy.map(node=>node.id).sort())
 });
 const marked=healthy.filter(node=>node.preferredPrimary);
 const pool=marked.length?marked:healthy;
 pool.sort((a,b)=>a.connectedAt-b.connectedAt||a.id.localeCompare(b.id));
 return Object.freeze({
  roomId:room,state:marked.length===1?'preferred-primary':marked.length>1?'preferred-conflict-resolved':'deterministic-primary',
  primaryNodeId:pool[0].id,
  candidateNodeIds:Object.freeze(healthy.map(node=>node.id).sort())
 });
}

const ALLOWED_SEMANTICS=new Set([
 'participant-observed','participant-out-of-view',
 'room-handoff-declared','room-departure-confirmed'
]);

export function normalizeMultiRoomObservation(input={},node=null,serverNow=Date.now()){
 const id=short(input.id||input.eventId,128);
 const nodeId=short(input.nodeId||node?.id);
 const roomId=short(input.roomId||node?.roomId);
 const participantId=short(input.participantId);
 const semantic=short(input.semantic,64);
 if(!id||!nodeId||!roomId||!participantId||!ALLOWED_SEMANTICS.has(semantic))return null;
 const clientObservedAt=finite(input.clientObservedAt??input.at)
  ?Math.max(0,Number(input.clientObservedAt??input.at)):null;
 const serverReceivedAt=finite(input.serverReceivedAt)
  ?Math.max(0,input.serverReceivedAt):serverNow;
 const rawSkew=clientObservedAt===null?null:serverReceivedAt-clientObservedAt;
 const clockSkewMs=rawSkew===null?null:Math.max(
  -MULTI_ROOM_CLOCK_SKEW_LIMIT_MS,Math.min(MULTI_ROOM_CLOCK_SKEW_LIMIT_MS,rawSkew)
 );
 const normalizedAt=serverReceivedAt;
 return Object.freeze({
  schema:MULTI_ROOM_SCHEMA,id,nodeId,roomId,participantId,semantic,
  fromRoomId:short(input.fromRoomId)||null,
  toRoomId:short(input.toRoomId)||null,
  authority:short(input.authority,48)||null,
  clientObservedAt,serverReceivedAt,normalizedAt,clockSkewMs,
  source:'multi-room-node'
 });
}

export class MultiRoomEventLedger{
 constructor({maxEvents=MULTI_ROOM_EVENT_LIMIT,maxAgeMs=MULTI_ROOM_EVENT_MAX_AGE_MS}={}){
  this.maxEvents=Math.max(32,Math.min(2048,Math.floor(maxEvents)));
  this.maxAgeMs=Math.max(10000,Number(maxAgeMs)||MULTI_ROOM_EVENT_MAX_AGE_MS);
  this.rows=[];this.ids=new Set();
 }
 ingest(input,node=null,serverNow=Date.now()){
  const event=normalizeMultiRoomObservation(input,node,serverNow);
  if(!event)return Object.freeze({added:false,reason:'invalid-event',event:null});
  if(this.ids.has(event.id))return Object.freeze({added:false,reason:'duplicate-event',event});
  if(serverNow-event.serverReceivedAt>this.maxAgeMs)
   return Object.freeze({added:false,reason:'stale-event',event});
  this.rows.push(event);this.ids.add(event.id);
  while(this.rows.length>this.maxEvents){
   const removed=this.rows.shift();this.ids.delete(removed.id);
  }
  this.prune(serverNow);
  return Object.freeze({added:true,reason:'accepted',event});
 }
 prune(now=Date.now()){
  const keep=this.rows.filter(row=>now-row.serverReceivedAt<=this.maxAgeMs);
  this.rows=keep;this.ids=new Set(keep.map(row=>row.id));
  return this.rows.length;
 }
 reconcileParticipants(participantIds=[]){
  const allowed=new Set((participantIds||[]).map(String));
  this.rows=this.rows.filter(row=>allowed.has(row.participantId));
  this.ids=new Set(this.rows.map(row=>row.id));
  return this.snapshot();
 }
 snapshot(){return Object.freeze(this.rows.map(row=>Object.freeze({...row})));}
}

export class MultiRoomNodeRegistry{
 constructor({staleMs=MULTI_ROOM_NODE_STALE_MS}={}){
  this.staleMs=Math.max(3000,Number(staleMs)||MULTI_ROOM_NODE_STALE_MS);
  this.nodes=new Map();
 }
 update(input,serverNow=Date.now()){
  const node=normalizeRoomNode(input,serverNow);
  if(!node)return null;
  const prior=this.nodes.get(node.id);
  const merged=Object.freeze({...node,connectedAt:prior?.connectedAt||node.connectedAt});
  this.nodes.set(node.id,merged);
  return merged;
 }
 prune(now=Date.now()){
  for(const [id,node] of this.nodes)
   if(now-Number(node.serverSeenAt||0)>this.staleMs)this.nodes.delete(id);
  return this.snapshot(now);
 }
 snapshot(now=Date.now()){
  return Object.freeze([...this.nodes.values()].map(node=>Object.freeze({
   ...node,health:roomNodeHealth(node,now)
  })).sort((a,b)=>a.roomId.localeCompare(b.roomId)||a.id.localeCompare(b.id)));
 }
 primary(roomId,options={}){
  return arbitratePrimaryNode([...this.nodes.values()],{roomId,...options});
 }
}

export function participantRoomArbitration(events=[],{
 participantId,now=Date.now(),windowMs=6000,explicitTargetRoomId=null
}={}){
 const id=short(participantId),target=short(explicitTargetRoomId)||null;
 const rows=(events||[]).filter(row=>row?.participantId===id&&
  row.semantic==='participant-observed'&&now-Number(row.normalizedAt||0)<=windowMs);
 const rooms=uniq(rows.map(row=>row.roomId));
 if(target&&rooms.includes(target))return Object.freeze({
  state:'explicit-target-observed',roomId:target,candidateRoomIds:Object.freeze(rooms),
  reason:'explicit-handoff-target-has-current-observation'
 });
 if(rooms.length===1)return Object.freeze({
  state:'observed',roomId:rooms[0],candidateRoomIds:Object.freeze(rooms),
  reason:'single-current-room-observation'
 });
 if(rooms.length>1)return Object.freeze({
  state:'conflict',roomId:null,candidateRoomIds:Object.freeze(rooms),
  reason:'simultaneous-current-room-observations-no-teleport-inference'
 });
 return Object.freeze({state:'unknown',roomId:null,candidateRoomIds:Object.freeze([]),
  reason:'no-current-room-observation'});
}

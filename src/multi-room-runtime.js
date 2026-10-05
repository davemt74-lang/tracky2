import {
 MultiRoomEventLedger,MultiRoomNodeRegistry,arbitratePrimaryNode
} from './multi-room-runtime-core.js';

const MAX_PENDING=32;
const SYNC_INTERVAL_MS=4000;
const short=(value,max=96)=>String(value??'').trim().slice(0,max);
const allowed=new Set([
 'participant-observed','participant-out-of-view',
 'room-handoff-declared','room-departure-confirmed'
]);
const eventId=()=>globalThis.crypto?.randomUUID?.()||
 'room-event-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

export class MultiRoomRuntimeClient{
 constructor({
  sessionUrl='./server/session.php',
  relayUrl='./server/room-node-api.php',
  onRemoteObservation=()=>{},
  onState=()=>{}
 }={}){
  this.sessionUrl=sessionUrl;this.relayUrl=relayUrl;
  this.onRemoteObservation=onRemoteObservation;this.onState=onState;
  this.nodeRegistry=new MultiRoomNodeRegistry();
  this.eventLedger=new MultiRoomEventLedger();
  this.csrf='';this.permissions=new Set();this.authenticated=false;
  this.node=null;this.pending=[];this.timer=0;this.lastCursor=0;
  this.running=false;this.syncing=false;this.failures=0;this.lastError=null;
  this.primaryState='unavailable';
 }
 state(){
  const now=Date.now();
  const primary=this.node?this.nodeRegistry.primary(this.node.roomId,{
   preferredNodeId:this.node.preferredPrimary?this.node.id:null,now
  }):{primaryNodeId:null,state:'unavailable',candidateNodeIds:[]};
  const nodes=this.nodeRegistry.snapshot(now);
  return Object.freeze({
   running:this.running,authenticated:this.authenticated,
   transport:this.authenticated?'self-hosted':'local-only',
   nodeId:this.node?.id||null,roomId:this.node?.roomId||null,
   nodeCount:nodes.length,nodes,primaryNodeId:primary.primaryNodeId,
   isPrimary:Boolean(this.node&&primary.primaryNodeId===this.node.id),
   primaryState:primary.state,pending:this.pending.length,
   failures:this.failures,lastError:this.lastError
  });
 }
 emit(){const state=this.state();this.primaryState=state.primaryState;this.onState(state);return state;}
 async authenticate(){
  try{
   const response=await fetch(this.sessionUrl,{credentials:'same-origin',headers:{Accept:'application/json'}});
   if(!response.ok){this.authenticated=false;this.csrf='';this.permissions.clear();this.emit();return false;}
   const data=await response.json();
   this.authenticated=Boolean(data.authenticated);
   this.csrf=short(data.csrf,128);
   this.permissions=new Set(Array.isArray(data.permissions)?data.permissions:[]);
   if(!this.authenticated||!this.csrf||
      !this.permissions.has('rooms.read')||!this.permissions.has('rooms.write')){
    this.authenticated=false;this.csrf='';this.emit();return false;
   }
   this.emit();return true;
  }catch(error){
   this.lastError=String(error?.message||error).slice(0,180);
   this.authenticated=false;this.emit();return false;
  }
 }
 async start({nodeId,roomId,roomName,runtimeInstanceId,preferredPrimary=false}={}){
  this.stop();
  const id=short(nodeId,80),room=short(roomId),name=short(roomName,96)||room;
  if(!id||!room)throw new TypeError('Multi-room node requires node and room IDs.');
  this.node={id,roomId:room,roomName:name,
   runtimeInstanceId:short(runtimeInstanceId,96)||null,
   preferredPrimary:Boolean(preferredPrimary),connectedAt:Date.now(),clientAt:Date.now()};
  this.running=true;this.lastCursor=Math.max(0,Date.now()-30000);
  await this.authenticate();
  if(this.authenticated)await this.sync().catch(()=>{});
  this.timer=setInterval(()=>{if(this.running)void this.sync();},SYNC_INTERVAL_MS);
  return this.emit();
 }
 stop(){
  if(this.timer)clearInterval(this.timer);
  this.timer=0;this.running=false;this.syncing=false;this.pending=[];this.emit();
 }
 updateRoom({roomId,roomName}={}){
  if(!this.node)return this.state();
  const id=short(roomId),name=short(roomName,96)||id;
  if(!id)return this.state();
  this.node={...this.node,roomId:id,roomName:name,clientAt:Date.now(),connectedAt:Date.now()};
  this.nodeRegistry.update({...this.node,serverSeenAt:Date.now()},Date.now());
  this.emit();void this.sync();return this.state();
 }
 publishObservation(input={}){
  if(!this.running||!this.node)return false;
  const semantic=short(input.semantic,64),participantId=short(input.participantId,80);
  if(!allowed.has(semantic)||!participantId)return false;
  const current=this.state();
  if(['participant-observed','participant-out-of-view'].includes(semantic)&&
     current.primaryNodeId&&current.primaryNodeId!==this.node.id)return false;
  const row=Object.freeze({
   id:short(input.id,128)||eventId(),
   roomId:short(input.roomId)||this.node.roomId,
   participantId,semantic,
   fromRoomId:short(input.fromRoomId)||null,
   toRoomId:short(input.toRoomId)||null,
   authority:short(input.authority,48)||null,
   clientObservedAt:Number.isFinite(input.clientObservedAt??input.at)
    ?Number(input.clientObservedAt??input.at):Date.now()
  });
  if(this.pending.some(item=>item.id===row.id))return false;
  this.pending.push(row);
  if(this.pending.length>MAX_PENDING)this.pending.splice(0,this.pending.length-MAX_PENDING);
  void this.sync();this.emit();return true;
 }
 ingestPayload(data={}){
  const now=Number(data.serverNow)||Date.now();
  for(const node of Array.isArray(data.nodes)?data.nodes:[])this.nodeRegistry.update(node,now);
  this.nodeRegistry.prune(now);
  let cursor=this.lastCursor;
  for(const input of Array.isArray(data.observations)?data.observations:[]){
   cursor=Math.max(cursor,Number(input.serverReceivedAt)||0);
   if(input.nodeId===this.node?.id)continue;
   const result=this.eventLedger.ingest(input,null,now);
   if(result.added)this.onRemoteObservation(result.event);
  }
  this.lastCursor=cursor;
  this.eventLedger.prune(now);
  this.emit();
 }
 async sync(){
  if(!this.running||!this.node||this.syncing)return this.state();
  if(!this.authenticated){
   const ok=await this.authenticate();
   if(!ok)return this.state();
  }
  this.syncing=true;
  const sending=this.pending.slice(0,MAX_PENDING);
  try{
   const response=await fetch(this.relayUrl+'?since='+encodeURIComponent(this.lastCursor),{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-CSRF-Token':this.csrf,Accept:'application/json'},
    body:JSON.stringify({
     node:{...this.node,clientAt:Date.now()},
     observations:sending
    })
   });
   if(response.status===401||response.status===403){
    this.authenticated=false;this.csrf='';throw new Error('Multi-room session or permission expired.');
   }
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Multi-room relay failed ('+response.status+').');
   const sentIds=new Set(sending.map(row=>row.id));
   this.pending=this.pending.filter(row=>!sentIds.has(row.id));
   this.failures=0;this.lastError=null;this.ingestPayload(data);
  }catch(error){
   this.failures++;this.lastError=String(error?.message||error).slice(0,180);this.emit();
  }finally{this.syncing=false;}
  return this.state();
 }
 reconcileParticipants(participantIds=[]){
  this.eventLedger.reconcileParticipants(participantIds);
  const allowedIds=new Set((participantIds||[]).map(String));
  this.pending=this.pending.filter(row=>allowedIds.has(row.participantId));
  this.emit();
 }
}

export function multiRoomNodeId(runtimeInstanceId){
 const seed=short(runtimeInstanceId,72);
 return ('node-'+(seed||'local')).slice(0,80);
}

export {arbitratePrimaryNode};

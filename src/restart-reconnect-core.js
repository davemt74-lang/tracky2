// V0.15.1F restart/reconnect integrity coordinator.
// Metadata-only: tracks runtime epochs, replay tombstones, reconnect state and stale transient cleanup.
const short=(v,n=220)=>String(v??'').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const RESTART_RECONNECT_SCHEMA=1;
export const REPLAY_TOMBSTONE_TTL_MS=15*60*1000;
export const TRANSIENT_MAX_AGE_MS=3*60*1000;
export const RESTART_HISTORY_MAX=96;

export function reconcileTransientState(input={},now=Date.now()){
 const fresh=(row,maxAge=TRANSIENT_MAX_AGE_MS)=>Boolean(row&&finite(row.at)&&now-row.at>=0&&now-row.at<=maxAge);
 const future=(row)=>Boolean(row&&finite(row.expiresAt)&&row.expiresAt>=now);
 const pendingArrivalDecision=fresh(input.pendingArrivalDecision,30000)&&future(input.pendingArrivalDecision)
  ?input.pendingArrivalDecision:null;
 const pendingSituationalEngagement=fresh(input.pendingSituationalEngagement,TRANSIENT_MAX_AGE_MS)
  ?input.pendingSituationalEngagement:null;
 const pendingContextualFollowThrough=fresh(input.pendingContextualFollowThrough,TRANSIENT_MAX_AGE_MS)&&
  future(input.pendingContextualFollowThrough)?input.pendingContextualFollowThrough:null;
 return Object.freeze({
  pendingArrivalDecision,pendingSituationalEngagement,pendingContextualFollowThrough,
  cleared:Object.freeze([
   input.pendingArrivalDecision&&!pendingArrivalDecision?'arrival':null,
   input.pendingSituationalEngagement&&!pendingSituationalEngagement?'situational-engagement':null,
   input.pendingContextualFollowThrough&&!pendingContextualFollowThrough?'context-followthrough':null
  ].filter(Boolean))
 });
}

export class RestartReconnectCoordinator{
 constructor({epochId='',replayTtlMs=REPLAY_TOMBSTONE_TTL_MS,maxHistory=RESTART_HISTORY_MAX,state=null}={}){
  this.epochId=short(epochId,96)||'epoch';
  this.replayTtlMs=Math.max(60000,Math.min(60*60*1000,Number(replayTtlMs)||REPLAY_TOMBSTONE_TTL_MS));
  this.maxHistory=Math.max(24,Math.min(240,Math.floor(maxHistory)||RESTART_HISTORY_MAX));
  this.networkOnline=true;this.reconnectGeneration=0;this.startedAt=Date.now();
  this.completed=new Map();this.history=[];
  if(state)this.restore(state);
 }
 restore(state={}){
  if(state.schema!==RESTART_RECONNECT_SCHEMA)return false;
  const rows=Array.isArray(state.completed)?state.completed:[];
  this.completed=new Map(rows.filter(row=>Array.isArray(row)&&row.length===2&&finite(row[1]))
   .map(row=>[short(row[0],220),Number(row[1])]).filter(row=>row[0]));
  this.history=(Array.isArray(state.recent)?state.recent:[]).slice(-this.maxHistory).map(row=>Object.freeze({...row}));
  this.prune(Date.now());return true;
 }
 exportState(now=Date.now()){
  this.prune(now);
  return Object.freeze({schema:RESTART_RECONNECT_SCHEMA,completed:Object.freeze([...this.completed.entries()]),
   recent:Object.freeze(this.history.slice(-this.maxHistory))});
 }
 prune(now=Date.now()){
  for(const [key,at] of this.completed)if(now-at>this.replayTtlMs)this.completed.delete(key);
 }
 markCompleted(key,now=Date.now()){
  const k=short(key,220);if(!k)return false;
  this.prune(now);this.completed.set(k,now);
  this.history.push(Object.freeze({at:now,type:'completed',key:k,epochId:this.epochId}));
  this.history=this.history.slice(-this.maxHistory);return true;
 }
 replayAllowed(key,now=Date.now()){
  this.prune(now);const k=short(key,220);
  if(!k)return Object.freeze({allow:false,reason:'missing-replay-key'});
  return this.completed.has(k)
   ?Object.freeze({allow:false,reason:'replay-suppressed'})
   :Object.freeze({allow:true,reason:'not-completed'});
 }
 setNetwork(online,now=Date.now()){
  const next=online!==false;
  if(next===this.networkOnline)return Object.freeze({changed:false,online:next,generation:this.reconnectGeneration});
  this.networkOnline=next;
  if(next)this.reconnectGeneration++;
  this.history.push(Object.freeze({at:now,type:next?'network-reconnected':'network-offline',
   epochId:this.epochId,generation:this.reconnectGeneration}));
  this.history=this.history.slice(-this.maxHistory);
  return Object.freeze({changed:true,online:next,generation:this.reconnectGeneration});
 }
 restart({clean=true,priorEpochId=null,now=Date.now()}={}){
  const event=Object.freeze({at:now,type:'runtime-restart',clean:clean===true,
   priorEpochId:short(priorEpochId,96)||null,epochId:this.epochId});
  this.history.push(event);this.history=this.history.slice(-this.maxHistory);return event;
 }
 snapshot(now=Date.now()){
  this.prune(now);
  return Object.freeze({
   schema:RESTART_RECONNECT_SCHEMA,epochId:this.epochId,startedAt:this.startedAt,
   networkOnline:this.networkOnline,reconnectGeneration:this.reconnectGeneration,
   completedRecent:this.completed.size,recent:Object.freeze(this.history.slice(-20))
  });
 }
}

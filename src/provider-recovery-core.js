// V0.15.1E provider failure/recovery coordinator.
// Metadata-only. Tracks logical request keys, health, bounded backoff and completion tombstones.
const short=(v,n=180)=>String(v??'').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const PROVIDER_RECOVERY_SCHEMA=1;
export const PROVIDER_RECOVERY_MAX_HISTORY=120;
export const PROVIDER_RECOVERY_COMPLETE_TTL_MS=10*60*1000;
export const PROVIDER_RECOVERY_BASE_BACKOFF_MS=15000;
export const PROVIDER_RECOVERY_MAX_BACKOFF_MS=5*60*1000;

function snap(row){
 return Object.freeze({
  provider:row.provider,state:row.state,failures:row.failures,
  lastFailureAt:row.lastFailureAt||null,lastSuccessAt:row.lastSuccessAt||null,
  retryAfter:row.retryAfter||0,lastReason:row.lastReason||null
 });
}
export class ProviderRecoveryCoordinator{
 constructor({maxHistory=PROVIDER_RECOVERY_MAX_HISTORY,completeTtlMs=PROVIDER_RECOVERY_COMPLETE_TTL_MS}={}){
  this.maxHistory=Math.max(24,Math.min(300,Math.floor(maxHistory)||PROVIDER_RECOVERY_MAX_HISTORY));
  this.completeTtlMs=Math.max(60000,Math.min(60*60*1000,Number(completeTtlMs)||PROVIDER_RECOVERY_COMPLETE_TTL_MS));
  this.providers=new Map();this.inFlight=new Map();this.completed=new Map();this.history=[];
 }
 _provider(name){
  const provider=short(name,64)||'unknown';
  if(!this.providers.has(provider))this.providers.set(provider,{
   provider,state:'healthy',failures:0,lastFailureAt:null,lastSuccessAt:null,retryAfter:0,lastReason:null
  });
  return this.providers.get(provider);
 }
 prune(now=Date.now()){
  for(const [key,at] of this.completed)if(now-at>this.completeTtlMs)this.completed.delete(key);
 }
 canAttempt(provider,now=Date.now()){
  const row=this._provider(provider);
  if(row.state==='degraded'&&now<row.retryAfter)
   return Object.freeze({allow:false,reason:'provider-backoff',retryAfter:row.retryAfter,state:snap(row)});
  return Object.freeze({allow:true,reason:row.state==='degraded'?'provider-recovery-probe':'provider-healthy',state:snap(row)});
 }
 begin({requestKey,provider,now=Date.now()}={}){
  this.prune(now);
  const key=short(requestKey,220);
  if(!key)return Object.freeze({allow:false,reason:'missing-request-key'});
  if(this.completed.has(key))return Object.freeze({allow:false,reason:'logical-request-already-completed'});
  if(this.inFlight.has(key))return Object.freeze({allow:false,reason:'logical-request-in-flight'});
  const gate=this.canAttempt(provider,now);
  if(!gate.allow)return Object.freeze({allow:false,reason:gate.reason,retryAfter:gate.retryAfter,state:gate.state});
  this.inFlight.set(key,{provider:short(provider,64)||'unknown',startedAt:now});
  return Object.freeze({allow:true,reason:gate.reason,requestKey:key,state:gate.state});
 }
 failure({requestKey,provider,reason='provider-failure',now=Date.now()}={}){
  const key=short(requestKey,220);
  if(key)this.inFlight.delete(key);
  const row=this._provider(provider);
  row.failures=Math.min(8,row.failures+1);
  row.state='degraded';row.lastFailureAt=now;row.lastReason=short(reason,180)||'provider-failure';
  const backoff=Math.min(PROVIDER_RECOVERY_MAX_BACKOFF_MS,
   PROVIDER_RECOVERY_BASE_BACKOFF_MS*Math.pow(2,Math.max(0,row.failures-1)));
  row.retryAfter=now+backoff;
  this.history.push(Object.freeze({at:now,provider:row.provider,type:'failure',requestKey:key||null,reason:row.lastReason}));
  this.history=this.history.slice(-this.maxHistory);
  return snap(row);
 }
 success({requestKey,provider,reason='success',now=Date.now()}={}){
  const key=short(requestKey,220);
  if(key){this.inFlight.delete(key);this.completed.set(key,now);}
  const row=this._provider(provider);
  const recovered=row.state==='degraded'||row.failures>0;
  row.state='healthy';row.failures=0;row.lastSuccessAt=now;row.retryAfter=0;row.lastReason=short(reason,180)||'success';
  this.history.push(Object.freeze({at:now,provider:row.provider,type:recovered?'recovered':'success',requestKey:key||null,reason:row.lastReason}));
  this.history=this.history.slice(-this.maxHistory);
  return Object.freeze({state:snap(row),recovered});
 }
 cancel({requestKey}={}){
  const key=short(requestKey,220);
  return key?this.inFlight.delete(key):false;
 }
 snapshot(now=Date.now()){
  this.prune(now);
  return Object.freeze({
   schema:PROVIDER_RECOVERY_SCHEMA,
   providers:Object.freeze([...this.providers.values()].map(snap)),
   inFlight:this.inFlight.size,completedRecent:this.completed.size,
   recent:Object.freeze(this.history.slice(-20))
  });
 }
}

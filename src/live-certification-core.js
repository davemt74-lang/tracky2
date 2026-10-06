// V0.15.1G installed-device live certification harness.
// Metadata-only scenario evidence. No raw media, transcript bodies, embeddings, or provider payloads.
const clean=(v,n=240)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const LIVE_CERT_SCHEMA=1;
export const LIVE_CERT_VERSION='0.15.1';
export const LIVE_CERT_SCENARIOS=Object.freeze([
 'long-session-stability',
 'participant-arrival-departure-reentry',
 'conversation-ownership-handoff',
 'media-transition-awareness',
 'proactivity-accept',
 'proactivity-reject',
 'correct-silence',
 'provider-failure-recovery',
 'network-reconnect-no-replay',
 'browser-restart-integrity',
 'resource-growth'
]);

export function normalizeLiveRuntimeSnapshot(input={},now=Date.now()){
 const participants=Array.isArray(input.participants)?input.participants:[];
 const providers=Array.isArray(input.providers)?input.providers:[];
 return Object.freeze({
  schema:LIVE_CERT_SCHEMA,at:finite(input.at)?input.at:now,
  runtimeEpochId:clean(input.runtimeEpochId,96)||null,
  visibleParticipantIds:Object.freeze(participants.map(x=>clean(x?.id||x?.participantId,96)).filter(Boolean).slice(0,16)),
  conversationOwnershipState:clean(input.conversationOwnershipState,64)||null,
  conversationOwnerId:clean(input.conversationOwnerId,96)||null,
  mediaKind:clean(input.mediaKind,64)||null,
  mediaIdentity:clean(input.mediaIdentity,160)||null,
  proactivityPending:Math.max(0,Number(input.proactivityPending)||0),
  interruptionsThisHour:Math.max(0,Number(input.interruptionsThisHour)||0),
  providerStates:Object.freeze(providers.slice(0,12).map(row=>Object.freeze({
   provider:clean(row?.provider,64)||'unknown',state:clean(row?.state,32)||'unknown',
   failures:Math.max(0,Number(row?.failures)||0)
  }))),
  reconnectGeneration:Math.max(0,Number(input.reconnectGeneration)||0),
  replayTombstones:Math.max(0,Number(input.replayTombstones)||0),
  longSessionStatus:clean(input.longSessionStatus,32)||null,
  longSessionDurationMs:Math.max(0,Number(input.longSessionDurationMs)||0),
  longSessionFailures:Object.freeze((Array.isArray(input.longSessionFailures)?input.longSessionFailures:[])
   .map(x=>clean(x,80)).filter(Boolean).slice(0,24)),
  performanceLevel:clean(input.performanceLevel,32)||null,
  heapGrowthRatio:finite(input.heapGrowthRatio)?Number(input.heapGrowthRatio):null,
  maxHeapRatio:finite(input.maxHeapRatio)?Number(input.maxHeapRatio):null
 });
}

export function evaluateLiveScenario(id,{manual='not-run',snapshot=null,notes=''}={}){
 const scenario=clean(id,96);
 const allowed=new Set(['not-run','pass','partial','fail']);
 const manualOutcome=allowed.has(manual)?manual:'not-run';
 const s=snapshot?normalizeLiveRuntimeSnapshot(snapshot):null;
 let auto=null,reason='manual-evidence-required';
 if(scenario==='long-session-stability'&&s){
  auto=s.longSessionStatus==='certified'?'pass':s.longSessionDurationMs>=4*60*60*1000?'fail':'partial';
  reason=s.longSessionStatus==='certified'?'four-hour-runtime-certified':'long-session-gate-not-certified';
 }else if(scenario==='resource-growth'&&s){
  auto=s.heapGrowthRatio===null&&s.maxHeapRatio===null?'partial':
   ((s.heapGrowthRatio??0)<=.25&&(s.maxHeapRatio??0)<.9?'pass':'fail');
  reason=auto==='pass'?'resource-budgets-within-limit':'resource-budget-needs-review';
 }else if(scenario==='provider-failure-recovery'&&s){
  const hasRecovered=s.providerStates.some(p=>p.state==='healthy'&&p.failures===0);
  auto=s.providerStates.length?(hasRecovered?'partial':'fail'):'not-run';
  reason='provider-recovery-requires-observed-failure-and-recovery';
 }else if(scenario==='network-reconnect-no-replay'&&s){
  auto=s.reconnectGeneration>0?(s.replayTombstones>=0?'partial':'fail'):'not-run';
  reason='reconnect-observed-replay-review-required';
 }
 const outcome=manualOutcome!=='not-run'?manualOutcome:(auto||'not-run');
 return Object.freeze({id:scenario,outcome,autoOutcome:auto,reason,notes:clean(notes,500)});
}

export class LiveCertificationHarness{
 constructor({startedAt=Date.now()}={}){
  this.startedAt=startedAt;this.snapshots=[];this.scenarios=new Map();
 }
 observeSnapshot(input={},now=Date.now()){
  const row=normalizeLiveRuntimeSnapshot(input,now);
  this.snapshots=[...this.snapshots,row].slice(-240);
  return row;
 }
 setScenario(id,outcome,notes=''){
  const row=evaluateLiveScenario(id,{manual:outcome,snapshot:this.snapshots.at(-1)||null,notes});
  this.scenarios.set(row.id,row);return row;
 }
 summary(){
  const rows=LIVE_CERT_SCENARIOS.map(id=>this.scenarios.get(id)||
   evaluateLiveScenario(id,{snapshot:this.snapshots.at(-1)||null}));
  const counts={pass:0,partial:0,fail:0,'not-run':0};
  for(const row of rows)counts[row.outcome]=(counts[row.outcome]||0)+1;
  const status=counts.fail?'failed':counts['not-run']?'incomplete':counts.partial?'partial':'certified';
  return Object.freeze({status,counts:Object.freeze(counts),scenarios:Object.freeze(rows)});
 }
 report({releaseVersion=LIVE_CERT_VERSION,deviceProfile={},notes=''}={}){
  return Object.freeze({
   schema:LIVE_CERT_SCHEMA,version:LIVE_CERT_VERSION,releaseVersion,
   measuredAt:new Date().toISOString(),startedAt:this.startedAt,
   durationMs:Math.max(0,Date.now()-this.startedAt),
   deviceProfile:Object.freeze({...deviceProfile}),
   summary:this.summary(),latestSnapshot:this.snapshots.at(-1)||null,
   snapshotCount:this.snapshots.length,
   notes:clean(notes,1200),
   privacy:Object.freeze({
    rawMedia:false,transcripts:false,biometrics:false,providerPayloads:false,
    scope:'aggregate-and-operator-confirmed-live-certification-evidence'
   })
  });
 }
}

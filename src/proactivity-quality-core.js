// V0.15.1D adaptive proactivity quality and silence policy.
// Metadata-only: no raw media, transcripts, embeddings, or provider payloads.
const short=(v,n=180)=>String(v??'').trim().slice(0,n);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));

export const PROACTIVITY_QUALITY_SCHEMA=1;
export const PROACTIVITY_QUALITY_MAX=120;
export const PROACTIVITY_DISMISSAL_WINDOW_MS=6*60*60*1000;
export const PROACTIVITY_REPEAT_WINDOW_MS=60*60*1000;

function outcomeScore(outcome){
 return ({accepted:1,expanded:1,positive:.85,neutral:.5,ignored:.2,dismissed:0,
  'topic-changed':.15,'silence-correct':.8,'silence-wrong':.2})[outcome]??.5;
}
function row(input={}){
 return Object.freeze({
  schema:PROACTIVITY_QUALITY_SCHEMA,
  at:Math.max(0,Number(input.at)||0),
  participantId:short(input.participantId,96)||null,
  topicKey:short(input.topicKey,360)||null,
  action:short(input.action,80)||'proactive',
  outcome:short(input.outcome,48)||'neutral',
  score:outcomeScore(input.outcome),
  semanticKey:short(input.semanticKey,360)||null,
  reason:short(input.reason,180)||null
 });
}
export function adaptiveProactivityPolicy({
 participantId=null,topicKey=null,semanticKey=null,history=[],now=Date.now(),
 baseMaxInterruptionsPerHour=3
}={}){
 const recent=(history||[]).filter(r=>now-r.at>=0&&now-r.at<=30*24*60*60*1000)
  .filter(r=>(!participantId||!r.participantId||r.participantId===participantId));
 const exact=recent.filter(r=>
  (!topicKey||r.topicKey===topicKey)&&(!semanticKey||!r.semanticKey||r.semanticKey===semanticKey));
 const dismissals=exact.filter(r=>r.outcome==='dismissed'&&now-r.at<=PROACTIVITY_DISMISSAL_WINDOW_MS).length;
 const ignored=exact.filter(r=>r.outcome==='ignored'&&now-r.at<=PROACTIVITY_REPEAT_WINDOW_MS).length;
 const positive=exact.filter(r=>['accepted','expanded','positive'].includes(r.outcome)).length;
 const silencePositive=recent.filter(r=>r.outcome==='silence-correct').length;
 const silenceNegative=recent.filter(r=>r.outcome==='silence-wrong').length;
 let maxInterruptions=Math.max(1,Math.min(6,Math.floor(baseMaxInterruptionsPerHour)||3));
 if(dismissals>=1)maxInterruptions=Math.min(maxInterruptions,2);
 if(dismissals>=2||ignored>=3)maxInterruptions=1;
 if(positive>=4&&dismissals===0)maxInterruptions=Math.min(4,maxInterruptions+1);
 const silenceBias=clamp(.5+(silencePositive-silenceNegative)*.08+dismissals*.12+ignored*.06-positive*.04);
 const repeatBlocked=dismissals>0||ignored>=2;
 return Object.freeze({
  maxInterruptionsPerHour:maxInterruptions,
  silenceBias:Number(silenceBias.toFixed(3)),
  repeatBlocked,
  reason:dismissals?'recent-dismissal':
   ignored>=2?'repeated-nonresponse':
   silenceBias>=.68?'learned-silence-preference':
   positive>=3?'positive-engagement-history':'baseline'
 });
}

export class ProactivityQualityTracker{
 constructor({maxEntries=PROACTIVITY_QUALITY_MAX}={}){
  this.maxEntries=Math.max(24,Math.min(300,Math.floor(maxEntries)||PROACTIVITY_QUALITY_MAX));
  this.entries=[];this.lastDecision=null;
 }
 reset(){this.entries=[];this.lastDecision=null;}
 note(input={},at=Date.now()){
  const r=row({...input,at});
  this.entries=[...this.entries,r].slice(-this.maxEntries);
  return r;
 }
 policy(input={}){
  const p=adaptiveProactivityPolicy({...input,history:this.entries});
  this.lastDecision=Object.freeze({at:Number(input.now)||Date.now(),...p,
   participantId:input.participantId||null,topicKey:input.topicKey||null});
  return this.lastDecision;
 }
 shouldSpeak({participantId=null,topicKey=null,semanticKey=null,interestingness=.5,
  now=Date.now(),baseMaxInterruptionsPerHour=3}={}){
  const policy=this.policy({participantId,topicKey,semanticKey,now,baseMaxInterruptionsPerHour});
  if(policy.repeatBlocked)return Object.freeze({allow:false,reason:policy.reason,policy});
  const threshold=.52+policy.silenceBias*.28;
  if(Number(interestingness||0)<threshold)
   return Object.freeze({allow:false,reason:'adaptive-silence-threshold',policy,
    threshold:Number(threshold.toFixed(3))});
  return Object.freeze({allow:true,reason:'adaptive-quality-allows-engagement',policy,
   threshold:Number(threshold.toFixed(3))});
 }
 snapshot(){
  return Object.freeze({
   schema:PROACTIVITY_QUALITY_SCHEMA,count:this.entries.length,
   recent:Object.freeze(this.entries.slice(-16)),lastDecision:this.lastDecision
  });
 }
}

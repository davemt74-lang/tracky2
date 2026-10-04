// V0.11A conversation/listening coordination around the existing RoomAudioCapture.
// This module never opens media devices, transcribes audio or identifies speakers.
export const LISTENING_QUEUE_MAX=4;
export const LISTENING_QUEUE_MAX_AGE_MS=8000;
export const LISTENING_RESULT_MAX_AGE_MS=45000;
export const AGENT_REPLY_MAX_TURN_AGE_MS=30000;
export const AGENT_REPLY_MIN_GAP_MS=1200;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const id=()=>globalThis.crypto?.randomUUID?.()||
 'listen-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

export function createListeningSegment(segment,{
 generation=0,roomTracks=[],queuedAt=Date.now(),segmentId=null
}={}){
 if(!segment?.samples?.length)throw new Error('Listening segment requires PCM samples.');
 if(!Number.isInteger(generation)||generation<0)throw new Error('Invalid listening generation.');
 const startedAt=finite(segment.startedAt)?segment.startedAt:0;
 const endedAt=finite(segment.endedAt)?segment.endedAt:startedAt;
 return Object.freeze({
  ...segment,
  segmentId:String(segmentId||id()).slice(0,96),
  generation,
  roomTracks:Array.isArray(roomTracks)?roomTracks.map(track=>({...track})):[],
  queuedAt,
  queueDeadlineAt:queuedAt+LISTENING_QUEUE_MAX_AGE_MS,
  resultDeadlineAt:queuedAt+LISTENING_RESULT_MAX_AGE_MS,
  captureDurationMs:Math.max(0,endedAt-startedAt)
 });
}

export function segmentValidity(segment,{generation,now=Date.now(),phase='queue'}={}){
 if(!segment)return Object.freeze({valid:false,reason:'missing-segment'});
 if(segment.generation!==generation)return Object.freeze({valid:false,reason:'generation-invalidated'});
 const deadline=phase==='result'?segment.resultDeadlineAt:segment.queueDeadlineAt;
 if(!finite(deadline)||now>deadline)
  return Object.freeze({valid:false,reason:phase==='result'?'result-deadline-exceeded':'queue-deadline-exceeded'});
 return Object.freeze({valid:true,reason:'current'});
}

export function explicitStopIntent(text){
 return /\b(?:stop talking|be quiet|silence|stop speaking|quiet now)\b/i.test(String(text||'').trim());
}

export function replyEligibility({
 turn,now=Date.now(),lastReplyAt=0,responsePending=false,modalOpen=false,
 agentSpeaking=false,minGapMs=AGENT_REPLY_MIN_GAP_MS,maxTurnAgeMs=AGENT_REPLY_MAX_TURN_AGE_MS
}={}){
 if(!turn?.id)return Object.freeze({allow:false,action:'none',reason:'missing-turn'});
 const at=finite(turn.at)?turn.at:Date.parse(turn.createdAt||'');
 if(finite(at)&&at>0&&now-at>maxTurnAgeMs)
  return Object.freeze({allow:false,action:'none',reason:'turn-stale'});
 const verified=Boolean(turn.participantId&&turn.attribution!=='unknown');
 if(explicitStopIntent(turn.transcript)){
  return verified?
   Object.freeze({allow:false,action:'cancel-agent-speech',reason:'verified-stop-intent'}):
   Object.freeze({allow:false,action:'none',reason:'unverified-stop-intent'});
 }
 if(modalOpen)return Object.freeze({allow:false,action:'none',reason:'modal-open'});
 if(responsePending)return Object.freeze({allow:false,action:'none',reason:'response-pending'});
 if(agentSpeaking)return Object.freeze({allow:false,action:'none',reason:'agent-speaking'});
 if(finite(lastReplyAt)&&lastReplyAt>0&&now-lastReplyAt<Math.max(0,minGapMs))
  return Object.freeze({allow:false,action:'none',reason:'reply-cooldown'});
 return Object.freeze({allow:true,action:'reply',reason:'reply-eligible'});
}

export class ConversationListeningController{
 constructor({
  maxQueue=LISTENING_QUEUE_MAX,
  queueMaxAgeMs=LISTENING_QUEUE_MAX_AGE_MS,
  resultMaxAgeMs=LISTENING_RESULT_MAX_AGE_MS
 }={}){
  this.maxQueue=Math.max(1,Math.min(12,Math.floor(maxQueue)));
  this.queueMaxAgeMs=Math.max(1000,Number(queueMaxAgeMs)||LISTENING_QUEUE_MAX_AGE_MS);
  this.resultMaxAgeMs=Math.max(this.queueMaxAgeMs,Number(resultMaxAgeMs)||LISTENING_RESULT_MAX_AGE_MS);
  this.generation=0;this.active=false;this.vad=false;this.suppressed=false;
  this.agentSpeaking=false;this.recovering=false;this.processing=null;this.queue=[];
  this.lastReason='standby';this.lastTransitionAt=0;
  this.stats={enqueued:0,completed:0,droppedStale:0,droppedOverflow:0,
   droppedGeneration:0,cancelled:0};
 }
 transition(reason,now=Date.now()){this.lastReason=String(reason||'');this.lastTransitionAt=now;}
 start(generation,now=Date.now()){
  this.generation=generation;this.active=true;this.vad=false;this.suppressed=false;
  this.recovering=false;this.processing=null;this.queue=[];this.transition('audio-started',now);
 }
 stop(generation=this.generation,reason='audio-stopped',now=Date.now()){
  this.generation=generation;this.active=false;this.vad=false;this.suppressed=false;
  this.recovering=false;
  if(this.processing)this.stats.cancelled++;
  this.stats.cancelled+=this.queue.length;
  this.processing=null;this.queue=[];this.transition(reason,now);
 }
 setVad(value,now=Date.now()){this.vad=Boolean(value);this.transition(this.vad?'speech-detected':'speech-ended',now);}
 setSuppressed(value,reason='capture-suppressed',now=Date.now()){
  this.suppressed=Boolean(value);this.transition(this.suppressed?reason:'suppression-released',now);
 }
 setAgentSpeaking(value,now=Date.now()){
  this.agentSpeaking=Boolean(value);this.transition(this.agentSpeaking?'agent-speaking':'agent-speech-ended',now);
 }
 setRecovering(value,reason='sensor-recovery',now=Date.now()){
  this.recovering=Boolean(value);this.transition(this.recovering?reason:'recovery-ended',now);
 }
 prune(now=Date.now()){
  const kept=[],dropped=[];
  for(const segment of this.queue){
   const validity=segmentValidity(segment,{generation:this.generation,now,phase:'queue'});
   if(validity.valid)kept.push(segment);
   else{
    dropped.push({segment,reason:validity.reason});
    if(validity.reason==='generation-invalidated')this.stats.droppedGeneration++;
    else this.stats.droppedStale++;
   }
  }
  this.queue=kept;return dropped;
 }
 enqueue(raw,{generation=this.generation,roomTracks=[],now=Date.now()}={}){
  if(!this.active)return Object.freeze({accepted:false,segment:null,dropped:[],reason:'audio-inactive'});
  if(generation!==this.generation){
   this.stats.droppedGeneration++;
   return Object.freeze({accepted:false,segment:null,dropped:[],reason:'generation-invalidated'});
  }
  const segment=createListeningSegment(raw,{generation,roomTracks,queuedAt:now});
  // Instance thresholds can be stricter/looser than exported defaults.
  const adjusted=Object.freeze({...segment,queueDeadlineAt:now+this.queueMaxAgeMs,
   resultDeadlineAt:now+this.resultMaxAgeMs});
  const dropped=this.prune(now);
  while(this.queue.length>=this.maxQueue){
   const oldest=this.queue.shift();
   dropped.push({segment:oldest,reason:'queue-overflow-oldest'});
   this.stats.droppedOverflow++;
  }
  this.queue.push(adjusted);this.stats.enqueued++;this.transition('segment-queued',now);
  return Object.freeze({accepted:true,segment:adjusted,dropped:Object.freeze(dropped),reason:'queued'});
 }
 beginNext(now=Date.now()){
  const dropped=this.prune(now);
  const segment=this.queue.shift()||null;
  this.processing=segment;
  if(segment)this.transition('segment-processing',now);
  return Object.freeze({segment,dropped:Object.freeze(dropped)});
 }
 canContinue(segment,now=Date.now()){
  return segmentValidity(segment,{generation:this.generation,now,phase:'result'});
 }
 complete(segment,outcome='completed',now=Date.now()){
  if(this.processing?.segmentId===segment?.segmentId)this.processing=null;
  if(outcome==='completed')this.stats.completed++;
  else if(outcome==='cancelled')this.stats.cancelled++;
  this.transition('segment-'+outcome,now);
 }
 invalidateGeneration(generation,reason='generation-invalidated',now=Date.now()){
  const cancelled=this.queue.length+(this.processing?1:0);
  this.stats.cancelled+=cancelled;
  this.generation=generation;this.queue=[];this.processing=null;this.vad=false;
  this.transition(reason,now);return cancelled;
 }
 snapshot(){
  const state=!this.active?'offline':
   this.recovering?'recovering':
   this.agentSpeaking?'agent-speaking':
   this.suppressed?'suppressed':
   this.vad?'speech':
   this.processing?'processing':
   this.queue.length?'queued':'listening';
  return Object.freeze({
   state,generation:this.generation,queueDepth:this.queue.length,
   processingSegmentId:this.processing?.segmentId||null,
   lastReason:this.lastReason,lastTransitionAt:this.lastTransitionAt,
   ...this.stats,droppedTotal:this.stats.droppedStale+this.stats.droppedOverflow+
    this.stats.droppedGeneration
  });
 }
}

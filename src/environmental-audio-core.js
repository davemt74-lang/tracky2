import {
 ENVIRONMENT_AUDIO_MODEL_ID,ENVIRONMENT_AUDIO_MODEL_REVISION
} from './model-config.js';

export const ENVIRONMENT_AUDIO_MIN_SCORE=.62;
export const ENVIRONMENT_AUDIO_MIN_MARGIN=.08;
export const ENVIRONMENT_AUDIO_QUEUE_MAX=2;
export const ENVIRONMENT_AUDIO_MAX_AGE_MS=12000;
export const ENVIRONMENT_AUDIO_EMIT_COOLDOWN_MS=30000;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const workId=()=>globalThis.crypto?.randomUUID?.()||
 'env-audio-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);

const BLOCKED_LABEL=/(?:speech|conversation|narration|whisper|shout|yell|scream|cry|baby|child|male|female|human voice|cough|sneeze|snor|breath|gasp|hiccup|throat|heartbeat|heart murmur|wheeze)/i;

const CATEGORY_RULES=Object.freeze([
 ['music',/(?:\bmusic\b|musical instrument|guitar|piano|keyboard \(musical\)|drum|violin|cello|flute|saxophone|trumpet|orchestra|choir)/i],
 ['media-playback',/(?:television|radio|video game|soundtrack|recorded media)/i],
 ['alarm',/(?:alarm|siren|smoke detector|fire alarm|doorbell|buzzer|telephone bell)/i],
 ['animal',/(?:\banimal\b|dog|bark|cat|meow|bird|chirp|tweet|insect|cricket|frog|horse|cow|sheep|pig)/i],
 ['weather-water',/(?:rain|thunder|wind noise|water|stream|ocean|wave|waterfall)/i],
 ['transport',/(?:vehicle|car|truck|bus|train|rail|aircraft|airplane|helicopter|motorcycle|traffic)/i],
 ['household-mechanical',/(?:vacuum|blender|washing machine|dishwasher|microwave|fan|air conditioning|printer|mechanical fan|power tool|drill|sawing|typing|computer keyboard|door|drawer)/i],
 ['impact-crowd',/(?:applause|clapping|knock|slam|crash|breaking|thump|bang)/i]
]);

function cleanLabel(value){
 return String(value||'').replace(/[\r\n\t]+/g,' ').trim().slice(0,96);
}
export function environmentalCategoryForLabel(label){
 const value=cleanLabel(label);
 if(!value||BLOCKED_LABEL.test(value))return null;
 for(const [category,pattern] of CATEGORY_RULES)if(pattern.test(value))return category;
 return null;
}
export function environmentalLabelBlocked(label){
 return BLOCKED_LABEL.test(cleanLabel(label));
}

export function normalizeEnvironmentalPredictions(predictions,{
 minScore=ENVIRONMENT_AUDIO_MIN_SCORE,minMargin=ENVIRONMENT_AUDIO_MIN_MARGIN,
 modelId=ENVIRONMENT_AUDIO_MODEL_ID,modelRevision=ENVIRONMENT_AUDIO_MODEL_REVISION,
 at=Date.now(),durationMs=null
}={}){
 const rows=(Array.isArray(predictions)?predictions:[])
  .map(item=>({label:cleanLabel(item?.label),score:Number(item?.score)}))
  .filter(item=>item.label&&finite(item.score)&&item.score>=0&&item.score<=1)
  .sort((a,b)=>b.score-a.score)
  .slice(0,12);
 if(!rows.length)return Object.freeze({accepted:false,reason:'no-predictions',classification:null});

 // If the strongest model result is speech/health/human-sensitive, do not fall
 // through to a weaker environmental label and misrepresent the window.
 if(environmentalLabelBlocked(rows[0].label)&&rows[0].score>=.35)
  return Object.freeze({accepted:false,reason:'speech-or-sensitive-filtered',classification:null});

 const allowed=rows.map(item=>({...item,category:environmentalCategoryForLabel(item.label)}))
  .filter(item=>item.category);
 if(!allowed.length)return Object.freeze({accepted:false,reason:'no-approved-category',classification:null});

 const top=allowed[0];
 if(top.score<minScore)
  return Object.freeze({accepted:false,reason:'low-confidence',classification:null});

 const secondCategory=allowed.find(item=>item.category!==top.category);
 const margin=secondCategory?top.score-secondCategory.score:top.score;
 if(top.score<.85&&margin<minMargin)
  return Object.freeze({accepted:false,reason:'ambiguous-category',classification:null});

 const classification=Object.freeze({
  category:top.category,modelLabel:top.label,
  confidence:Number(top.score.toFixed(4)),
  margin:Number(Math.max(0,margin).toFixed(4)),
  at:finite(at)?at:Date.now(),
  durationMs:finite(durationMs)?Math.max(0,Math.round(durationMs)):null,
  source:'local-audioset-classifier',
  modelId:String(modelId||ENVIRONMENT_AUDIO_MODEL_ID),
  modelRevision:String(modelRevision||ENVIRONMENT_AUDIO_MODEL_REVISION),
  participantId:null,speakerAttribution:'none',exactMediaId:null
 });
 return Object.freeze({accepted:true,reason:'classified',classification});
}

export function environmentalClassificationMessage(classification){
 if(!classification)return '';
 const label=classification.category.replaceAll('-',' ');
 return 'Environmental audio classification: '+label+' · model label “'+
  classification.modelLabel+'” · '+Math.round(classification.confidence*100)+
  '% confidence · source not attributed to a participant';
}

export function createEnvironmentalAudioWork(segment,{
 generation=0,queuedAt=Date.now(),id=null
}={}){
 if(!segment?.samples?.length)throw new Error('Environmental classification requires PCM samples.');
 return {
  id:String(id||workId()).slice(0,96),
  generation:Number.isInteger(generation)?generation:0,
  samples:segment.samples,
  sampleRate:Number(segment.sampleRate)||16000,
  durationMs:Number.isFinite(segment.durationSeconds)
   ?Math.max(0,Math.round(segment.durationSeconds*1000))
   :Number.isFinite(segment.captureDurationMs)?Math.max(0,Math.round(segment.captureDurationMs)):null,
  audioSource:segment.audioSource&&typeof segment.audioSource==='object'?Object.freeze({
   state:String(segment.audioSource.state||'unavailable').slice(0,48),
   direction:['left','right','center'].includes(segment.audioSource.direction)
    ?segment.audioSource.direction:'unavailable',
   confidence:finite(segment.audioSource.confidence)?
    Math.max(0,Math.min(1,segment.audioSource.confidence)):0
  }):Object.freeze({state:'unavailable',direction:'unavailable',confidence:0}),
  queuedAt,
  deadlineAt:queuedAt+ENVIRONMENT_AUDIO_MAX_AGE_MS
 };
}

export class EnvironmentalAudioQueue{
 constructor({maxQueue=ENVIRONMENT_AUDIO_QUEUE_MAX,maxAgeMs=ENVIRONMENT_AUDIO_MAX_AGE_MS}={}){
  this.maxQueue=Math.max(1,Math.min(4,Math.floor(maxQueue)));
  this.maxAgeMs=Math.max(1000,Number(maxAgeMs)||ENVIRONMENT_AUDIO_MAX_AGE_MS);
  this.enabled=false;this.generation=0;this.queue=[];this.processing=null;
  this.stats={enqueued:0,classified:0,droppedOverflow:0,droppedStale:0,cancelled:0,errors:0};
 }
 enable(now=Date.now()){
  this.generation++;this.enabled=true;this.queue=[];this.processing=null;this.enabledAt=now;return this.generation;
 }
 disable(){
  this.stats.cancelled+=this.queue.length+(this.processing?1:0);
  this.generation++;this.enabled=false;this.queue=[];this.processing=null;return this.generation;
 }
 prune(now=Date.now()){
  const kept=[],dropped=[];
  for(const work of this.queue){
   if(work.generation!==this.generation){
    dropped.push({work,reason:'generation-invalidated'});this.stats.cancelled++;
   }else if(now>work.deadlineAt){
    dropped.push({work,reason:'classification-deadline-exceeded'});this.stats.droppedStale++;
   }else kept.push(work);
  }
  this.queue=kept;return dropped;
 }
 enqueue(segment,now=Date.now()){
  if(!this.enabled)return Object.freeze({accepted:false,reason:'disabled',dropped:[]});
  const work=createEnvironmentalAudioWork(segment,{generation:this.generation,queuedAt:now});
  work.deadlineAt=now+this.maxAgeMs;
  const dropped=this.prune(now);
  while(this.queue.length>=this.maxQueue){
   dropped.push({work:this.queue.shift(),reason:'queue-overflow-oldest'});
   this.stats.droppedOverflow++;
  }
  this.queue.push(work);this.stats.enqueued++;
  return Object.freeze({accepted:true,reason:'queued',work,dropped:Object.freeze(dropped)});
 }
 beginNext(now=Date.now()){
  const dropped=this.prune(now);
  const work=this.queue.shift()||null;
  this.processing=work;
  return Object.freeze({work,dropped:Object.freeze(dropped)});
 }
 current(work,now=Date.now()){
  return Boolean(this.enabled&&work&&work.generation===this.generation&&now<=work.deadlineAt);
 }
 complete(work,outcome='classified'){
  if(this.processing?.id===work?.id)this.processing=null;
  if(outcome==='classified')this.stats.classified++;
  else if(outcome==='error')this.stats.errors++;
  else if(outcome==='cancelled')this.stats.cancelled++;
 }
 snapshot(){
  return Object.freeze({
   enabled:this.enabled,generation:this.generation,queueDepth:this.queue.length,
   processing:Boolean(this.processing),...this.stats
  });
 }
}

export class EnvironmentalClassificationTracker{
 constructor({cooldownMs=ENVIRONMENT_AUDIO_EMIT_COOLDOWN_MS}={}){
  this.cooldownMs=Math.max(1000,Number(cooldownMs)||ENVIRONMENT_AUDIO_EMIT_COOLDOWN_MS);
  this.last=null;
 }
 reset(){this.last=null;}
 observe(classification,now=Date.now()){
  if(!classification)return Object.freeze({emit:false,reason:'no-classification'});
  const prior=this.last;
  const same=prior&&prior.category===classification.category&&
   prior.modelLabel===classification.modelLabel;
  const confidenceGain=prior?classification.confidence-prior.confidence:1;
  const emit=!same||!prior||now-prior.emittedAt>=this.cooldownMs||confidenceGain>=.15;
  if(emit)this.last={...classification,emittedAt:now};
  return Object.freeze({emit,reason:emit?'emit': 'deduplicated'});
 }
}

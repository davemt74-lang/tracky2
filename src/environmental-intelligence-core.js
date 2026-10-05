import {normalizeEnvironmentalPredictions} from './environmental-audio-core.js';

export const ENVIRONMENTAL_V2_SCHEMA=1;
export const ENVIRONMENTAL_V2_MAX_GROUPS=80;
export const ENVIRONMENTAL_V2_MAX_FEEDBACK=200;
export const ENVIRONMENTAL_V2_GROUP_WINDOW_MS=8000;
export const ENVIRONMENTAL_V2_CURRENT_HALF_LIFE_MS=30000;
export const ENVIRONMENTAL_V2_CURRENT_MAX_AGE_MS=90000;
export const ENVIRONMENTAL_V2_COUGH_MIN_SCORE=.78;
export const ENVIRONMENTAL_V2_COUGH_MIN_MARGIN=.12;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const short=(v,n=120)=>String(v??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,n);
const id=()=>globalThis.crypto?.randomUUID?.()||
 'environment-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

const SUBTYPE_RULES=Object.freeze([
 ['television',/(?:television|tv\b)/i],
 ['radio',/\bradio\b/i],
 ['video-game',/(?:video game|game soundtrack)/i],
 ['door-impact',/(?:door slam|slam|knock)/i],
 ['door-motion',/(?:door|drawer)/i],
 ['appliance',/(?:vacuum|blender|washing machine|dishwasher|microwave|fan|air conditioning|printer)/i],
 ['typing',/(?:typing|computer keyboard)/i],
 ['impact',/(?:crash|breaking|thump|bang)/i],
 ['applause',/(?:applause|clapping)/i],
 ['instrumental-music',/(?:guitar|piano|keyboard \(musical\)|drum|violin|cello|flute|saxophone|trumpet|orchestra)/i],
 ['music',/\bmusic\b|choir/i]
]);

export function environmentalSubtypeForLabel(label,category=''){
 const value=short(label,96);
 for(const [subtype,pattern] of SUBTYPE_RULES)if(pattern.test(value))return subtype;
 return category==='media-playback'?'media-playback':
  category==='household-mechanical'?'household-mechanical':
  category==='impact-crowd'?'impact-crowd':short(category,64)||'environmental';
}
function sourceContext(audioSource){
 const source=audioSource&&typeof audioSource==='object'?audioSource:{};
 const state=short(source.state,48);
 const direction=['left','right','center'].includes(source.direction)?source.direction:'unavailable';
 return Object.freeze({
  state:state||'unavailable',
  direction:state==='available'?direction:'unavailable',
  confidence:state==='available'?clamp(source.confidence):0,
  participantId:null
 });
}
function predictionRows(predictions=[]){
 return (Array.isArray(predictions)?predictions:[])
  .map(row=>({label:short(row?.label,96),score:Number(row?.score)}))
  .filter(row=>row.label&&finite(row.score)&&row.score>=0&&row.score<=1)
  .sort((a,b)=>b.score-a.score)
  .slice(0,12);
}
export function normalizeEnvironmentalV2Predictions(predictions,{
 at=Date.now(),durationMs=null,audioSource=null,modelId=null,modelRevision=null
}={}){
 const legacy=normalizeEnvironmentalPredictions(predictions,{
  at,durationMs,modelId:modelId||undefined,modelRevision:modelRevision||undefined
 });
 let classification=null;
 if(legacy.accepted){
  const base=legacy.classification;
  classification={
   ...base,schema:ENVIRONMENTAL_V2_SCHEMA,
   subtype:environmentalSubtypeForLabel(base.modelLabel,base.category),
   observableOnly:true,healthInference:'none',emotionInference:'none',
   sourceContext:sourceContext(audioSource)
  };
 }else if(legacy.reason==='speech-or-sensitive-filtered'){
  const rows=predictionRows(predictions),top=rows[0],second=rows[1];
  const margin=top&&second?top.score-second.score:top?.score||0;
  if(top&&/\bcough(?:ing)?\b/i.test(top.label)&&
     top.score>=ENVIRONMENTAL_V2_COUGH_MIN_SCORE&&margin>=ENVIRONMENTAL_V2_COUGH_MIN_MARGIN){
   classification={
    schema:ENVIRONMENTAL_V2_SCHEMA,
    category:'observable-human-acoustic',subtype:'cough-like',
    modelLabel:'Cough-like acoustic event',confidence:Number(top.score.toFixed(4)),
    margin:Number(Math.max(0,margin).toFixed(4)),
    at:finite(at)?at:Date.now(),
    durationMs:finite(durationMs)?Math.max(0,Math.round(durationMs)):null,
    source:'local-audioset-classifier',modelId:short(modelId,160)||null,
    modelRevision:short(modelRevision,80)||null,
    participantId:null,speakerAttribution:'none',exactMediaId:null,
    observableOnly:true,healthInference:'none',emotionInference:'none',
    sourceContext:sourceContext(audioSource)
   };
  }
 }
 if(!classification)return Object.freeze({
  accepted:false,reason:legacy.reason,classification:null
 });
 return Object.freeze({
  accepted:true,reason:'classified-v2',
  classification:Object.freeze(classification)
 });
}

export function environmentalV2Message(classification){
 if(!classification)return '';
 if(classification.category==='observable-human-acoustic')
  return 'Environmental audio: cough-like acoustic event · observable sound only · no person or health meaning inferred';
 const label=classification.subtype.replaceAll('-',' ');
 const source=classification.sourceContext?.direction&&classification.sourceContext.direction!=='unavailable'
  ?' · approximate source '+classification.sourceContext.direction
  :' · source direction unavailable';
 return 'Environmental audio: '+label+' · '+Math.round(classification.confidence*100)+
  '% model confidence'+source+' · not attributed to a participant';
}

export function normalizeEnvironmentalFeedback(input={},now=Date.now()){
 const outcome=['confirmed','incorrect'].includes(input.outcome)?input.outcome:null;
 const category=short(input.category,64),subtype=short(input.subtype,64);
 if(!outcome||!category||!subtype)throw new TypeError('Valid environmental feedback required.');
 const eventId=short(input.eventId,96)||null;
 return Object.freeze({
  id:short(input.id,96)||(eventId?'env-feedback-'+eventId:id()),
  schema:ENVIRONMENTAL_V2_SCHEMA,eventId,
  category,subtype,modelLabel:short(input.modelLabel,96)||null,
  outcome,at:finite(input.at)?input.at:now,
  source:'local-owner',participantId:null
 });
}
export function environmentalCalibrationSummary(feedback=[],classification=null){
 const category=short(classification?.category,64),subtype=short(classification?.subtype,64);
 const rows=(feedback||[]).map(row=>{
  try{return normalizeEnvironmentalFeedback(row,row?.at);}catch{return null;}
 }).filter(row=>row&&row.category===category&&row.subtype===subtype)
  .slice(-ENVIRONMENTAL_V2_MAX_FEEDBACK);
 const confirmed=rows.filter(row=>row.outcome==='confirmed').length;
 const incorrect=rows.filter(row=>row.outcome==='incorrect').length;
 const total=confirmed+incorrect;
 const reliability=total?((confirmed+1)/(total+2)):.5;
 return Object.freeze({category,subtype,total,confirmed,incorrect,
  reliability:Number(reliability.toFixed(4))});
}
export function calibrateEnvironmentalClassification(classification,feedback=[]){
 if(!classification)return null;
 const summary=environmentalCalibrationSummary(feedback,classification);
 const raw=clamp(classification.confidence);
 const factor=summary.total<2?1:(.7+.3*summary.reliability);
 return Object.freeze({
  ...classification,
  rawConfidence:raw,
  confidence:Number(Math.min(raw,raw*factor).toFixed(4)),
  calibration:summary
 });
}

function groupSnapshot(group,now=Date.now()){
 const age=Math.max(0,now-group.lastAt);
 const decayed=group.peakConfidence*Math.pow(.5,age/ENVIRONMENTAL_V2_CURRENT_HALF_LIFE_MS);
 const directions=[...group.directions].filter(value=>value!=='unavailable');
 const direction=directions.length&&new Set(directions).size===1?directions[0]:'unavailable';
 return Object.freeze({
  id:group.id,category:group.category,subtype:group.subtype,
  modelLabel:group.modelLabel,startedAt:group.startedAt,lastAt:group.lastAt,
  observationCount:group.observationCount,
  peakConfidence:Number(group.peakConfidence.toFixed(4)),
  meanConfidence:Number((group.totalConfidence/group.observationCount).toFixed(4)),
  currentConfidence:Number(clamp(decayed).toFixed(4)),
  current:age<=ENVIRONMENTAL_V2_CURRENT_MAX_AGE_MS,
  sourceDirection:direction,
  healthInference:'none',participantId:null,
  provenance:Object.freeze(['environmental-v2-group','unattributed-room-audio'])
 });
}
export class EnvironmentalEventGrouper{
 constructor({windowMs=ENVIRONMENTAL_V2_GROUP_WINDOW_MS,maxGroups=ENVIRONMENTAL_V2_MAX_GROUPS}={}){
  this.windowMs=Math.max(1000,Number(windowMs)||ENVIRONMENTAL_V2_GROUP_WINDOW_MS);
  this.maxGroups=Math.max(1,Math.min(200,Math.floor(Number(maxGroups)||ENVIRONMENTAL_V2_MAX_GROUPS)));
  this.groups=[];
 }
 reset(){this.groups=[];}
 observe(classification,now=Date.now()){
  if(!classification)return Object.freeze({emit:false,reason:'no-classification',group:null});
  const at=finite(classification.at)?classification.at:now;
  let group=this.groups.at(-1)||null;
  const same=group&&group.category===classification.category&&
   group.subtype===classification.subtype&&at-group.lastAt<=this.windowMs;
  if(!same){
   group={
    id:id(),category:classification.category,subtype:classification.subtype,
    modelLabel:classification.modelLabel,startedAt:at,lastAt:at,
    observationCount:0,peakConfidence:0,totalConfidence:0,directions:new Set()
   };
   this.groups.push(group);
   this.groups=this.groups.slice(-this.maxGroups);
  }
  group.lastAt=at;group.observationCount++;
  group.peakConfidence=Math.max(group.peakConfidence,clamp(classification.confidence));
  group.totalConfidence+=clamp(classification.confidence);
  group.directions.add(classification.sourceContext?.direction||'unavailable');
  const emit=!same||[3,6,10].includes(group.observationCount);
  return Object.freeze({
   emit,reason:emit?(same?'group-milestone':'new-group'):'grouped',
   group:groupSnapshot(group,now)
  });
 }
 current(now=Date.now()){
  const group=this.groups.at(-1);
  return group?groupSnapshot(group,now):null;
 }
 snapshot(now=Date.now()){return Object.freeze(this.groups.map(group=>groupSnapshot(group,now)));}
}

export function environmentalFeedbackFromRoomEvent(event,outcome,now=Date.now()){
 const meta=event?.evidence?.environmental;
 if(!meta)return null;
 try{
  return normalizeEnvironmentalFeedback({
   eventId:event.id,category:meta.category,subtype:meta.subtype,
   modelLabel:meta.modelLabel,outcome,at:now
  },now);
 }catch{return null;}
}

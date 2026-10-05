export const ROUTINE_SCHEMA=1;
export const ROUTINE_MIN_OCCURRENCES=3;
export const ROUTINE_MAX_CANDIDATES=60;
export const ROUTINE_MAX_FEEDBACK=160;
export const ROUTINE_EXPIRY_MS=45*24*60*60*1000;
export const ROUTINE_BUCKET_MINUTES=30;
export const ROUTINE_DEVIATION_MINUTES=90;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,max=96)=>String(v??'').trim().slice(0,max);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(v=>short(v)))];

const SAFE_SEMANTICS=new Set([
 'participant-observed','participant-reentered-room','area-dwell','camera-motion',
 'room-handoff-confirmed','room-observed-after-stale-gap'
]);

function localParts(at){
 const d=new Date(at);
 return {date:d.toISOString().slice(0,10),weekday:d.getUTCDay(),
  minute:d.getUTCHours()*60+d.getUTCMinutes()};
}
function circularDistanceMinutes(a,b){
 const raw=Math.abs(a-b);return Math.min(raw,1440-raw);
}
function median(values=[]){
 if(!values.length)return null;
 const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);
 return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
function routineKey(row){
 const subject=short(row.areaId||row.roomId||row.subtype||'general',96);
 return [short(row.participantId,96),short(row.semantic,64),subject].join('|');
}
export function normalizeRoutineObservation(input={}){
 const participantId=short(input.participantId,96)||null;
 const semantic=short(input.semantic,64);
 const at=finite(input.at)?input.at:null;
 if(!participantId||!SAFE_SEMANTICS.has(semantic)||!finite(at))return null;
 const parts=localParts(at);
 return Object.freeze({
  id:short(input.id,96)||[participantId,semantic,at].join(':'),
  participantId,semantic,at,sessionId:short(input.sessionId,96)||null,
  roomId:short(input.roomId,96)||null,areaId:short(input.areaId,96)||null,
  subtype:short(input.subtype,96)||null,
  date:parts.date,weekday:parts.weekday,minute:parts.minute,
  privacy:'observable-routine-metadata',
  healthInference:'none',protectedTraitInference:'none',emotionInference:'none'
 });
}
function confidenceFor(rows,spread){
 const occurrenceScore=clamp((rows.length-ROUTINE_MIN_OCCURRENCES+1)/6);
 const spreadScore=clamp(1-(spread||0)/180);
 return Number((.45+.35*occurrenceScore+.2*spreadScore).toFixed(3));
}
export function deriveRoutineCandidates(observations=[],feedback=[],now=Date.now()){
 const rows=(observations||[]).map(normalizeRoutineObservation).filter(Boolean)
  .filter(row=>now-row.at<=ROUTINE_EXPIRY_MS);
 const feedbackById=new Map((feedback||[]).map(row=>[short(row.routineId,180),row]));
 const groups=new Map();
 for(const row of rows){
  const key=routineKey(row);
  if(!groups.has(key))groups.set(key,[]);
  const bucket=groups.get(key);
  if(!bucket.some(existing=>existing.date===row.date&&
     circularDistanceMinutes(existing.minute,row.minute)<ROUTINE_BUCKET_MINUTES))
    bucket.push(row);
 }
 const candidates=[];
 for(const [key,group] of groups){
  if(group.length<ROUTINE_MIN_OCCURRENCES)continue;
  const minutes=group.map(row=>row.minute),center=Math.round(median(minutes));
  const distances=minutes.map(min=>circularDistanceMinutes(min,center));
  const spread=Math.max(ROUTINE_BUCKET_MINUTES,Math.ceil(median(distances)||0));
  const sample=group[0],routineId='routine:'+key;
  const review=feedbackById.get(routineId)||null;
  const status=['confirmed','rejected','revoked'].includes(review?.outcome)
   ?review.outcome:'candidate';
  candidates.push(Object.freeze({
   schema:ROUTINE_SCHEMA,id:routineId,participantId:sample.participantId,
   semantic:sample.semantic,roomId:sample.roomId,areaId:sample.areaId,
   subtype:sample.subtype,occurrences:group.length,distinctDays:uniq(group.map(r=>r.date)).length,
   centerMinute:center,windowMinutes:Math.min(180,Math.max(30,spread+ROUTINE_BUCKET_MINUTES)),
   confidence:confidenceFor(group,spread),firstObservedAt:Math.min(...group.map(r=>r.at)),
   lastObservedAt:Math.max(...group.map(r=>r.at)),status,
   ownerReviewedAt:finite(review?.at)?review.at:null,
   privacy:'observable-routine-metadata',memoryAuthority:'none',
   healthInference:'none',protectedTraitInference:'none',emotionInference:'none'
  }));
 }
 return Object.freeze(candidates.sort((a,b)=>b.confidence-a.confidence||
  b.lastObservedAt-a.lastObservedAt).slice(0,ROUTINE_MAX_CANDIDATES));
}
export function routineDeviation(routine,event,now=Date.now()){
 if(!routine||!event)return Object.freeze({state:'unavailable',reason:'missing-input',confidence:0});
 const row=normalizeRoutineObservation(event);
 if(!row||row.participantId!==routine.participantId||row.semantic!==routine.semantic)
  return Object.freeze({state:'unavailable',reason:'not-comparable',confidence:0});
 if(now-routine.lastObservedAt>ROUTINE_EXPIRY_MS)
  return Object.freeze({state:'expired',reason:'routine-stale',confidence:0});
 const distance=circularDistanceMinutes(row.minute,routine.centerMinute);
 const threshold=Math.max(ROUTINE_DEVIATION_MINUTES,routine.windowMinutes||0);
 return Object.freeze({
  state:distance>threshold?'outside-baseline-window':'within-baseline-window',
  distanceMinutes:distance,thresholdMinutes:threshold,
  confidence:Number((clamp(routine.confidence)*(distance>threshold?.8:1)).toFixed(3)),
  reason:distance>threshold?'timing-differs-from-observed-routine':'timing-within-observed-routine',
  healthInference:'none',emotionInference:'none'
 });
}
export function normalizeRoutineFeedback(input={},now=Date.now()){
 const outcome=['confirmed','rejected','revoked'].includes(input.outcome)?input.outcome:null;
 const routineId=short(input.routineId,180);
 if(!routineId||!outcome)throw new Error('Invalid routine feedback');
 return Object.freeze({
  schema:ROUTINE_SCHEMA,id:'routine-feedback:'+routineId,
  routineId,outcome,at:finite(input.at)?input.at:now,
  note:short(input.note,240)||null,authority:'owner',
  provenance:'owner-reviewed',memoryAuthority:'none'
 });
}
export function routineFeedbackIdsToPrune(rows=[],maxRows=ROUTINE_MAX_FEEDBACK){
 if(!Array.isArray(rows)||rows.length<=maxRows)return [];
 return [...rows].sort((a,b)=>(a.at||0)-(b.at||0))
  .slice(0,Math.max(0,rows.length-maxRows)).map(row=>row.id).filter(Boolean);
}
export function scrubRoutineFeedbackParticipant(rows=[],participantId=''){
 const id=short(participantId,96);
 return (rows||[]).filter(row=>!String(row.routineId||'').startsWith('routine:'+id+'|'));
}
export function routineLabel(routine){
 if(!routine)return 'Routine unavailable';
 const hour=Math.floor((routine.centerMinute||0)/60);
 const minute=(routine.centerMinute||0)%60;
 const time=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
 const subject=routine.areaId||routine.roomId||routine.subtype||routine.semantic;
 return String(routine.semantic||'activity').replaceAll('-',' ')+' · '+subject+
  ' · around '+time+' · '+Math.round((routine.confidence||0)*100)+'% confidence';
}

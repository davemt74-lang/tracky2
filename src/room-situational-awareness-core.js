// V0.14.9D bounded persistent situational awareness with adaptive interest scoring.
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const clean=(v,n=220)=>String(v??'').replace(/[
	]+/g,' ').replace(/s+/g,' ').trim().slice(0,n);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export const ROOM_SITUATIONAL_SCHEMA=1;
export const ROOM_SITUATIONAL_EVENT_LIMIT=180;
export const ROOM_SITUATIONAL_FEEDBACK_LIMIT=80;
export const ROOM_SITUATIONAL_MIN_INTEREST=.58;

function decay(ageMs,halfLifeMs){
 if(!finite(ageMs)||ageMs<0)return 1;
 return Math.pow(.5,ageMs/Math.max(1,halfLifeMs));
}
function eventKey(input={}){
 const participant=clean(input.participantId,96)||'general';
 const type=clean(input.type,64)||'observation';
 const topic=clean(input.topicKey,360)||clean(input.semantic,180)||clean(input.message,180);
 return [participant,type,topic||'untitled'].join(':').toLowerCase();
}
export function normalizeSituationalEvent(input={},at=Date.now()){
 const type=clean(input.type||input.semantic||'observation',64);
 return Object.freeze({
  schema:ROOM_SITUATIONAL_SCHEMA,
  id:clean(input.id,96)||('sit-'+Math.floor(at).toString(36)+'-'+Math.random().toString(36).slice(2,8)),
  at,participantId:clean(input.participantId,96)||null,
  type,semantic:clean(input.semantic,120)||null,
  topicKey:clean(input.topicKey,360)||null,
  mediaKind:clean(input.mediaKind,48)||null,
  message:clean(input.message,220)||null,
  confidence:clamp(input.confidence),
  novelty:clamp(input.novelty??.5),
  salience:clamp(input.salience??.5),
  source:clean(input.source,100)||null,
  relatedEventId:clean(input.relatedEventId,96)||null,
  rawAudioStored:false
 });
}

export function normalizeSituationalFeedback(input={},at=Date.now()){
 const outcome=clean(input.outcome,48).toLowerCase();
 const allowed=['positive','expanded','neutral','ignored','dismissed','topic-changed'];
 return Object.freeze({
  at,participantId:clean(input.participantId,96)||null,
  topicKey:clean(input.topicKey,360)||null,
  eventType:clean(input.eventType,64)||null,
  outcome:allowed.includes(outcome)?outcome:'neutral',
  weight:clamp(input.weight??1)
 });
}

function feedbackValue(outcome){
 if(outcome==='expanded')return 1;
 if(outcome==='positive')return .75;
 if(outcome==='neutral')return .05;
 if(outcome==='ignored')return -.35;
 if(outcome==='topic-changed')return -.55;
 if(outcome==='dismissed')return -.9;
 return 0;
}

export function adaptiveInterestProfile(events=[],feedback=[],{
 participantId=null,topicKey=null,eventType=null,now=Date.now()
}={}){
 const pid=clean(participantId,96)||null,topic=clean(topicKey,360)||null,type=clean(eventType,64)||null;
 let weighted=0,total=0,positive=0,negative=0;
 for(const row of feedback){
  if(pid&&row.participantId&&row.participantId!==pid)continue;
  const topicMatch=topic&&row.topicKey===topic;
  const typeMatch=type&&row.eventType===type;
  if(!topicMatch&&!typeMatch)continue;
  const age=Math.max(0,now-(row.at||0));
  const w=decay(age,14*24*60*60*1000)*clamp(row.weight??1);
  const value=feedbackValue(row.outcome);
  weighted+=value*w;total+=w;
  if(value>0)positive+=w;
  if(value<0)negative+=w;
 }
 const score=total?clamp(.5+weighted/(Math.max(1,total)*2)):.5;
 const relevantEvents=events.filter(row=>
  (!pid||!row.participantId||row.participantId===pid)&&
  ((!topic&& !type)||(topic&&row.topicKey===topic)||(type&&row.type===type))
 );
 const recurrence=Math.min(1,relevantEvents.length/8);
 return Object.freeze({score,positive,negative,samples:total,recurrence});
}

export function situationalInterestingness(event,context={}){
 const profile=adaptiveInterestProfile(context.events||[],context.feedback||[],{
  participantId:event.participantId,topicKey:event.topicKey,eventType:event.type,now:context.now
 });
 const ageMs=Math.max(0,(context.now??Date.now())-event.at);
 const freshness=decay(ageMs,30*60*1000);
 const novelty=clamp(event.novelty);
 const salience=clamp(event.salience);
 const confidence=clamp(event.confidence);
 const recurrencePenalty=clamp(profile.recurrence*.22);
 const interruptionFatigue=clamp((context.recentInterruptions||0)/6)*.28;
 const score=clamp(
  .22*novelty+
  .22*salience+
  .16*confidence+
  .2*freshness+
  .2*profile.score-
  recurrencePenalty-
  interruptionFatigue
 );
 return Object.freeze({
  score,profile,freshness,novelty,salience,confidence,
  threshold:ROOM_SITUATIONAL_MIN_INTEREST,
  interesting:score>=ROOM_SITUATIONAL_MIN_INTEREST
 });
}

export class RoomSituationalAwarenessTracker{
 constructor({eventLimit=ROOM_SITUATIONAL_EVENT_LIMIT,feedbackLimit=ROOM_SITUATIONAL_FEEDBACK_LIMIT}={}){
  this.eventLimit=Math.max(40,Math.min(500,Math.floor(eventLimit)||ROOM_SITUATIONAL_EVENT_LIMIT));
  this.feedbackLimit=Math.max(20,Math.min(200,Math.floor(feedbackLimit)||ROOM_SITUATIONAL_FEEDBACK_LIMIT));
  this.events=[];this.feedback=[];this.lastDecision=null;
 }
 observe(input={},at=Date.now()){
  const row=normalizeSituationalEvent(input,at);
  this.events=[...this.events,row].slice(-this.eventLimit);
  return row;
 }
 noteFeedback(input={},at=Date.now()){
  const row=normalizeSituationalFeedback(input,at);
  this.feedback=[...this.feedback,row].slice(-this.feedbackLimit);
  return row;
 }
 evaluate(event,{participantId=null,recentInterruptions=0,now=Date.now()}={}){
  const scored=situationalInterestingness(event,{
   events:this.events,feedback:this.feedback,
   recentInterruptions,now
  });
  const decision=Object.freeze({
   eventId:event.id,participantId:participantId||event.participantId||null,
   topicKey:event.topicKey||null,type:event.type,
   interesting:scored.interesting,score:Number(scored.score.toFixed(4)),
   threshold:scored.threshold,
   reason:scored.interesting?'adaptive-interest-above-threshold':'adaptive-interest-below-threshold',
   profile:scored.profile
  });
  this.lastDecision=decision;
  return decision;
 }
 relatedContext({participantId=null,topicKey=null,limit=8}={}){
  return Object.freeze(this.events.filter(row=>
   (!participantId||!row.participantId||row.participantId===participantId)&&
   (!topicKey||row.topicKey===topicKey)
  ).slice(-Math.max(1,Math.min(20,limit))));
 }
 snapshot(){
  return Object.freeze({
   eventCount:this.events.length,feedbackCount:this.feedback.length,
   recent:Object.freeze(this.events.slice(-12)),
   recentFeedback:Object.freeze(this.feedback.slice(-12)),
   lastDecision:this.lastDecision
  });
 }
}

export function situationalPromptContext(tracker,event,decision){
 const related=tracker.relatedContext({
  participantId:event.participantId,topicKey:event.topicKey,limit:6
 }).map(row=>({
  at:row.at,type:row.type,topicKey:row.topicKey,mediaKind:row.mediaKind,
  message:row.message,confidence:row.confidence
 }));
 return Object.freeze({
  current:{
   type:event.type,topicKey:event.topicKey,mediaKind:event.mediaKind,
   message:event.message,confidence:event.confidence
  },
  adaptive:{
   interestScore:decision.score,
   samples:Number(decision.profile.samples.toFixed(3)),
   positive:Number(decision.profile.positive.toFixed(3)),
   negative:Number(decision.profile.negative.toFixed(3)),
   recurrence:Number(decision.profile.recurrence.toFixed(3))
  },
  related
 });
}

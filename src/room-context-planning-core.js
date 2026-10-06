// V0.14.9E higher-order contextual planning for proactive ROOM cognition.
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const clean=(v,n=220)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const ROOM_CONTEXT_PLAN_SCHEMA=1;
export const ROOM_CONTEXT_ACTIONS=Object.freeze([
 'conversation','recommendation','research','explanation','follow-up','silence'
]);

function baseActionWeights(candidate={},situationalDecision={}){
 const kind=clean(candidate.mediaKind,48);
 const profile=situationalDecision.profile||{};
 const positive=Number(profile.positive)||0;
 const negative=Number(profile.negative)||0;
 const recurrence=clamp(profile.recurrence);
 const interest=clamp(situationalDecision.score);
 const common={
  conversation:.48,recommendation:.34,research:.28,explanation:.3,'follow-up':.18,silence:.2
 };
 if(kind==='music'){
  common.conversation+=.14;common.recommendation+=.18;common.research+=.08;common.explanation+=.06;
 }else if(['television','recorded-media','radio','video-game'].includes(kind)){
  common.conversation+=.12;common.recommendation+=.16;common.research+=.1;common.explanation+=.1;
 }
 common.conversation+=interest*.12;
 common.recommendation+=positive*.04;
 common.research+=positive*.035;
 common.explanation+=positive*.025;
 common['follow-up']+=positive*.03;
 common.silence+=negative*.08+recurrence*.18+(1-interest)*.22;
 return common;
}

export function contextualActionPlan(candidate={},situationalDecision={},{
 recentPlans=[],recentDialogueTopicShift=false,now=Date.now()
}={}){
 const reasons=[];
 if(!candidate?.eligible)reasons.push('candidate-ineligible');
 if(!situationalDecision?.interesting)reasons.push('below-interest-threshold');
 const scores=baseActionWeights(candidate,situationalDecision);
 if(recentDialogueTopicShift){
  scores.silence+=.24;scores['follow-up']-=.08;
 }
 const recentSame=(recentPlans||[]).filter(row=>row?.topicKey===candidate.topicKey&&
  now-(row.at||0)>=0&&now-(row.at||0)<30*60*1000);
 for(const row of recentSame){
  if(row.action&&scores[row.action]!==undefined)scores[row.action]-=.2;
 }
 for(const key of Object.keys(scores))scores[key]=clamp(scores[key]);
 const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
 const [action,score]=ranked[0]||['silence',1];
 const abstain=Boolean(reasons.length||action==='silence'||score<.42);
 return Object.freeze({
  schema:ROOM_CONTEXT_PLAN_SCHEMA,
  action:abstain?'silence':action,
  score:Number((abstain?Math.max(score,scores.silence):score).toFixed(4)),
  reasons:Object.freeze(abstain?[...reasons,...(action==='silence'?['silence-ranked-highest']:[])]:[]),
  ranked:Object.freeze(ranked.map(([name,value])=>Object.freeze({action:name,score:Number(value.toFixed(4))}))),
  participantId:candidate.participantId||null,
  topicKey:candidate.topicKey||null,
  mediaKind:candidate.mediaKind||null,
  rawAudioStored:false
 });
}

export class RoomContextPlanner{
 constructor({maxHistory=40}={}){
  this.maxHistory=Math.max(12,Math.min(120,Math.floor(maxHistory)||40));
  this.history=[];this.lastPlan=null;
 }
 plan(candidate,situationalDecision,context={}){
  const plan=contextualActionPlan(candidate,situationalDecision,{
   ...context,recentPlans:this.history
  });
  this.lastPlan=plan;
  return plan;
 }
 record(plan,{executed=false,at=Date.now()}={}){
  if(!plan?.topicKey)return null;
  const row=Object.freeze({
   at,topicKey:plan.topicKey,participantId:plan.participantId||null,
   action:plan.action,executed:Boolean(executed)
  });
  this.history=[...this.history,row].slice(-this.maxHistory);
  return row;
 }
 snapshot(){
  return Object.freeze({lastPlan:this.lastPlan,recent:Object.freeze(this.history.slice(-12))});
 }
}

export function contextualPlanPrompt(plan={},candidate={},awarenessContext={}){
 if(!plan||plan.action==='silence')return '';
 const guidance={
  conversation:'Open a brief natural conversation about the current media context. Prefer a light question or observation.',
  recommendation:'Offer one concise, relevant recommendation direction based on the current media context, without pretending to know personal taste beyond the evidence.',
  research:'Offer to research or look up a useful related fact, comparison, creator, background detail, or similar work. Do not claim research was already performed.',
  explanation:'Offer or give a concise explanation/background point that is directly grounded in the current verified context.',
  'follow-up':'Reconnect to a recent related context only when it is genuinely useful; otherwise ask a light optional follow-up.'
 }[plan.action]||'Respond briefly and naturally.';
 const identity=candidate.mediaIdentity||{};
 return [
  'Higher-order proactive plan: '+plan.action,
  guidance,
  'Verified media context: '+JSON.stringify({
   kind:candidate.mediaKind||null,title:identity.title||null,artist:identity.artist||null,
   series:identity.series||null,album:identity.album||null,
   season:identity.season??null,episode:identity.episode??null
  }),
  'Situational context: '+JSON.stringify(awarenessContext||{}),
  'Return only what the agent should say. Keep it brief, optional, and natural. Never expose internal scores, planning labels, surveillance mechanics, or inferred private traits.'
 ].join('\n');
}

// V0.15F unified cognitive outcome evaluation.
// Central operational outcome ledger; no hidden reasoning and no governance overrides.

const clean=(v,n=320)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));

export const OUTCOME_SCHEMA=1;
export const OUTCOME_TYPES=Object.freeze([
 'expanded','positive','accepted-action','completed-goal','neutral',
 'ignored','dismissed','corrected','topic-changed','failed','abstained','silence-appropriate'
]);

const VALUE=Object.freeze({
 expanded:1,positive:.7,'accepted-action':.85,'completed-goal':1,
 neutral:0,ignored:-.3,dismissed:-.85,corrected:-.75,'topic-changed':-.45,
 failed:-.5,abstained:.05,'silence-appropriate':.45
});

export function cognitiveOutcome(input={},at=Date.now()){
 const type=OUTCOME_TYPES.includes(input.type)?input.type:'neutral';
 const value=VALUE[type]??0;
 const weight=clamp(input.weight??1);
 return Object.freeze({
  schema:OUTCOME_SCHEMA,id:clean(input.id,120)||('out-'+at.toString(36)+'-'+Math.random().toString(36).slice(2,8)),
  at,type,value:Number((value*weight).toFixed(4)),weight,
  participantId:clean(input.participantId,96)||null,
  topicKey:clean(input.topicKey,360)||null,
  action:clean(input.action,64)||null,
  goalId:clean(input.goalId,120)||null,
  sourceId:clean(input.sourceId,120)||null,
  completedGoal:input.completedGoal===true||type==='completed-goal',
  useful:value>0,
  source:clean(input.source,100)||'cognitive-outcome',
  rawAudioStored:false
 });
}

export function outcomeSummary(rows=[],{
 participantId=null,topicKey=null,action=null,now=Date.now(),windowMs=30*24*60*60*1000
}={}){
 const relevant=(rows||[]).filter(row=>
  now-(row.at||0)>=0&&now-(row.at||0)<=windowMs&&
  (!participantId||!row.participantId||row.participantId===participantId)&&
  (!topicKey||row.topicKey===topicKey)&&
  (!action||row.action===action)
 );
 let weighted=0,total=0,positive=0,negative=0,completed=0;
 for(const row of relevant){
  const age=Math.max(0,now-row.at);
  const recency=Math.pow(.5,age/(14*24*60*60*1000));
  weighted+=row.value*recency;total+=Math.abs(row.weight||1)*recency;
  if(row.value>0)positive+=recency;
  if(row.value<0)negative+=recency;
  if(row.completedGoal)completed++;
 }
 const utility=total?Math.max(-1,Math.min(1,weighted/total)):0;
 return Object.freeze({
  samples:relevant.length,utility:Number(utility.toFixed(4)),
  positive:Number(positive.toFixed(3)),negative:Number(negative.toFixed(3)),
  completedGoals:completed
 });
}

export class CognitiveOutcomeEvaluator{
 constructor({maxHistory=160}={}){
  this.maxHistory=Math.max(40,Math.min(400,Math.floor(maxHistory)||160));
  this.history=[];this.lastOutcome=null;
 }
 record(input={},at=Date.now()){
  const row=cognitiveOutcome(input,at);
  this.history=[...this.history,row].slice(-this.maxHistory);
  this.lastOutcome=row;return row;
 }
 summary(filters={}){return outcomeSummary(this.history,filters);}
 recommendation({participantId=null,topicKey=null,action=null,now=Date.now()}={}){
  const summary=this.summary({participantId,topicKey,action,now});
  const adjustment=summary.samples<2?0:
   Math.max(-.25,Math.min(.25,summary.utility*.25));
  return Object.freeze({
   summary,adjustment:Number(adjustment.toFixed(4)),
   recommendation:adjustment>.08?'increase':adjustment<-.08?'decrease':'hold'
  });
 }
 snapshot(){
  return Object.freeze({
   lastOutcome:this.lastOutcome,recent:Object.freeze(this.history.slice(-16))
  });
 }
 reset(){this.history=[];this.lastOutcome=null;}
}

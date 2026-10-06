// V0.15F unified outcome evaluation and adaptive cognition.
// Consolidates action/result/user-response signals without weakening hard governance.

const clean=(v,n=300)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));

export const COGNITIVE_OUTCOME_SCHEMA=1;
export const OUTCOME_KINDS=Object.freeze([
 'completed','useful','engaging','neutral','ignored','dismissed','failed','abstained'
]);

function outcomeScore(kind){
 return ({
  completed:1,useful:.86,engaging:.72,neutral:.5,abstained:.5,
  ignored:.28,dismissed:.08,failed:.12
 })[kind]??.5;
}

export function evaluateCognitiveOutcome(input={},now=Date.now()){
 const executed=input.executed===true;
 const action=clean(input.action,64)||'unknown';
 const feedback=clean(input.feedback,48).toLowerCase();
 const status=clean(input.status,48).toLowerCase();
 let kind='neutral',reason='no-strong-outcome-signal';

 if(status==='failed'||input.error===true){
  kind='failed';reason='execution-failed';
 }else if(status==='completed'||status==='succeeded'||input.goalCompleted===true){
  kind='completed';reason='goal-or-followthrough-completed';
 }else if(feedback==='dismissed'){
  kind='dismissed';reason='explicit-user-dismissal';
 }else if(feedback==='ignored'){
  kind='ignored';reason='no-user-engagement';
 }else if(feedback==='expanded'){
  kind='useful';reason='user-expanded-the-action';
 }else if(feedback==='positive'){
  kind='engaging';reason='positive-user-response';
 }else if(!executed){
  kind=input.intentionallyAbstained===true?'abstained':'failed';
  reason=input.intentionallyAbstained===true?'intentional-abstention':'action-not-executed';
 }

 return Object.freeze({
  schema:COGNITIVE_OUTCOME_SCHEMA,at:now,
  action,kind,reason,score:outcomeScore(kind),
  participantId:clean(input.participantId,96)||null,
  topicKey:clean(input.topicKey,360)||null,
  goalId:clean(input.goalId,120)||null,
  attentionId:clean(input.attentionId,120)||null,
  sourceId:clean(input.sourceId,120)||null,
  executed,hardGovernanceChanged:false
 });
}

export class CognitiveOutcomeLedger{
 constructor({maxEntries=120}={}){
  this.maxEntries=Math.max(24,Math.min(300,Math.floor(maxEntries)||120));
  this.entries=[];this.lastOutcome=null;
 }
 record(input={},now=Date.now()){
  const row=evaluateCognitiveOutcome(input,now);
  this.entries=[...this.entries,row].slice(-this.maxEntries);
  this.lastOutcome=row;return row;
 }
 adaptiveSignal({action=null,participantId=null,topicKey=null,now=Date.now()}={}){
  const rows=this.entries.filter(row=>
   (!action||row.action===action)&&
   (!participantId||!row.participantId||row.participantId===participantId)&&
   (!topicKey||!row.topicKey||row.topicKey===topicKey)&&
   now-row.at>=0&&now-row.at<=30*24*60*60*1000
  );
  if(!rows.length)return Object.freeze({score:.5,samples:0,positive:0,negative:0});
  let weighted=0,total=0,positive=0,negative=0;
  for(const row of rows){
   const age=Math.max(0,now-row.at);
   const weight=Math.pow(.5,age/(14*24*60*60*1000));
   weighted+=row.score*weight;total+=weight;
   if(row.score>.6)positive+=weight;
   if(row.score<.4)negative+=weight;
  }
  return Object.freeze({
   score:Number(clamp(weighted/Math.max(.0001,total)).toFixed(4)),
   samples:rows.length,positive:Number(positive.toFixed(3)),negative:Number(negative.toFixed(3))
  });
 }
 snapshot(){
  return Object.freeze({
   lastOutcome:this.lastOutcome,recent:Object.freeze(this.entries.slice(-16)),
   count:this.entries.length
  });
 }
 reset(){this.entries=[];this.lastOutcome=null;}
}

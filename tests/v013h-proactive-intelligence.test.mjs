import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 PROACTIVE_MAX_SESSION_PLANS,ProactiveSessionPlanner,proactiveOpportunityScore,
 rankProactiveOpportunities,routineProactiveOpportunity,semanticOpportunityKey,
 semanticRepeatState
} from '../src/agent-proactive-intelligence-core.js';

test('13H usefulness and urgency rank failed task above generic follow-up',()=>{
 const rows=rankProactiveOpportunities([
  {id:'follow',type:'conversation-followup',text:'Would you like more help?',
   sourceAt:1000,eligibleAt:1000,expiresAt:200000},
  {id:'task',type:'task-status',text:'An approved task finished with an error.',
   sourceAt:1000,eligibleAt:1000,expiresAt:200000,usefulness:.9,urgency:.9}
 ],2000);
 assert.equal(rows[0].id,'task');
 assert.ok(rows[0].score>rows[1].score);
 assert.ok(rows[0].urgency>rows[1].urgency);
});

test('13H semantic key normalizes equivalent repeated prompt text',()=>{
 const a=semanticOpportunityKey({type:'conversation-followup',participantId:'p1',
  scopeId:'scope:p:p1',text:'Would you like me to help with anything else?'});
 const b=semanticOpportunityKey({type:'conversation-followup',participantId:'p1',
  scopeId:'scope:p:p1',text:'Would you like me to help with anything else!!'});
 assert.equal(a,b);
});

test('13H recent executed semantic equivalent is suppressed',()=>{
 const op={type:'task-status',text:'Task completed',semanticKey:'task:complete'};
 const state=semanticRepeatState(op,[
  {semanticKey:'task:complete',executed:true,at:1000}
 ],2000,10000);
 assert.equal(state.allow,false);
 assert.match(state.reason,/semantically equivalent/);
 assert.equal(semanticRepeatState(op,[],2000).allow,true);
});

test('13H session planner stays bounded and penalizes repeated follow-ups',()=>{
 const planner=new ProactiveSessionPlanner({maxPlans:3});
 for(let p=0;p<5;p++)planner.noteDialogue({
  id:'t'+p,participantId:'p'+p,conversationScopeId:'scope:p:p'+p,at:1000+p
 },1000+p);
 assert.equal(planner.snapshot(2000).length,3);
 assert.ok(planner.snapshot(2000).length<=PROACTIVE_MAX_SESSION_PLANS);
 const turn={id:'x',participantId:'p4',conversationScopeId:'scope:p:p4',at:3000};
 for(let i=0;i<6;i++)planner.noteDialogue({...turn,id:'x'+i,at:3000+i},3000+i);
 let context=planner.followupContext(turn,4000);
 assert.equal(context.followupStyle,'continuity');
 planner.recordOutcome({scopeId:'scope:p:p4'},true,5000);
 context=planner.followupContext(turn,5001);
 assert.ok(context.usefulnessAdjustment<0);
});

test('13H routine opportunity requires owner-confirmed routine and real deviation',()=>{
 const routine={id:'r1',status:'confirmed',participantId:'p1'};
 const event={id:'e1',participantId:'p1',at:1000};
 const op=routineProactiveOpportunity({
  routine,event,deviation:{state:'outside-baseline-window',confidence:.8},now:1000
 });
 assert.equal(op.type,'routine-status');
 assert.equal(op.participantId,'p1');
 assert.match(op.text,/routine you confirmed/);
 assert.equal(routineProactiveOpportunity({
  routine:{...routine,status:'candidate'},event,
  deviation:{state:'outside-baseline-window',confidence:.8}
 }),null);
 assert.equal(routineProactiveOpportunity({
  routine,event,deviation:{state:'within-baseline-window',confidence:.8}
 }),null);
});

test('13H proactive scoring remains bounded',()=>{
 for(const input of [
  {usefulness:-2,urgency:9,confidence:2},
  {usefulness:.5,urgency:.5,confidence:.5,repeatPenalty:4}
 ]){
  const score=proactiveOpportunityScore(input,1000);
  for(const key of ['usefulness','urgency','confidence','freshness','repeatPenalty','score'])
   assert.ok(score[key]>=0&&score[key]<=1,key);
 }
});

test('13H planner stores no transcript text, biometrics or durable memory',()=>{
 const core=fs.readFileSync('src/agent-proactive-intelligence-core.js','utf8');
 assert.doesNotMatch(core,/indexedDB|localStorage|getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket|saveAgentMemory|embedding/);
 const planner=new ProactiveSessionPlanner();
 const plan=planner.noteDialogue({
  id:'t1',participantId:'p1',conversationScopeId:'scope:p:p1',
  transcript:'this text must not be copied',at:1000
 },1000);
 assert.equal(JSON.stringify(plan).includes('this text'),false);
});

test('13H governor integrates ranking, semantic history and planner',()=>{
 const source=fs.readFileSync('src/agent-proactive-core.js','utf8');
 assert.match(source,/rankProactiveOpportunities/);
 assert.match(source,/semanticRepeatState/);
 assert.match(source,/ProactiveSessionPlanner/);
 assert.match(source,/routine-status/);
 assert.match(source,/priorityScore/);
});

test('13H runtime offers only confirmed routine deviations to proactive governor',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/routineProactiveOpportunity/);
 assert.match(runtime,/proactiveGovernor\.offer/);
 assert.match(runtime,/routine\.status==='confirmed'/);
});

test('13H no new identity authority or proactive persistence is introduced',()=>{
 const core=fs.readFileSync('src/agent-proactive-intelligence-core.js','utf8');
 const governor=fs.readFileSync('src/agent-proactive-core.js','utf8');
 assert.doesNotMatch(core+governor,/saveParticipant|patchParticipant|reviseDialogueAttribution|ROUTINE_FEEDBACK|AGENT_MEMORIES/);
});

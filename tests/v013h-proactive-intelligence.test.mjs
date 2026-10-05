import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 PROACTIVE_MAX_SESSION_PLANS,ProactiveSessionPlanner,proactiveOpportunityScore,
 rankProactiveOpportunities,routineProactiveOpportunity,semanticOpportunityKey,
 semanticRepeatState
} from '../src/agent-proactive-intelligence-core.js';
import {
 DEFAULT_PROACTIVE_POLICY,ProactiveAgentGovernor,proactiveOpportunity
} from '../src/agent-proactive-core.js';

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

test('13H governor chooses higher-value eligible task over earlier generic follow-up',()=>{
 const governor=new ProactiveAgentGovernor({
  ...DEFAULT_PROACTIVE_POLICY,globalCooldownMs:30000,participantCooldownMs:30000
 });
 governor.offer(proactiveOpportunity({
  id:'follow',type:'conversation-followup',participantId:'p1',scopeId:'scope:p:p1',
  sourceAt:1000,eligibleAt:1000,text:'Would you like more help?',
  usefulness:.5,urgency:.1,semanticKey:'follow:p1'
 },1000,governor.policy));
 governor.offer(proactiveOpportunity({
  id:'task',type:'task-status',participantId:'p1',scopeId:'scope:p:p1',
  sourceAt:1100,eligibleAt:1100,text:'Task failed',
  usefulness:.95,urgency:.95,semanticKey:'task:failed'
 },1100,governor.policy));
 const decision=governor.evaluateNext({
  now:2000,pageVisible:true,busy:false,meetingActive:false,
  visibleParticipantIds:['p1'],activeTaskCount:0,lastDialogueAt:1000,
  participantById:id=>({id,agentProactiveEnabled:true}),
  quietPolicy:{quietEnabled:false}
 });
 assert.equal(decision.action,'speak');
 assert.equal(decision.opportunity.id,'task');
 assert.ok(decision.opportunity.priorityScore>0);
 assert.equal(decision.trace.some(row=>row.stage==='rank'),true);
});

test('13H governor hard-cancels recent semantic repeats after ordinary cooldown passes',()=>{
 const governor=new ProactiveAgentGovernor({
  ...DEFAULT_PROACTIVE_POLICY,globalCooldownMs:30000,participantCooldownMs:30000,
  semanticRepeatMs:5*60*1000
 });
 const make=at=>proactiveOpportunity({
  type:'task-status',participantId:'p1',scopeId:'scope:p:p1',
  sourceAt:at,eligibleAt:at,text:'Approved task completed',
  semanticKey:'task-status:completed',usefulness:.8,urgency:.4
 },at,governor.policy);
 governor.offer(make(1000));
 const context=now=>({
  now,pageVisible:true,busy:false,meetingActive:false,visibleParticipantIds:['p1'],
  activeTaskCount:0,lastDialogueAt:0,participantById:id=>({id,agentProactiveEnabled:true}),
  quietPolicy:{quietEnabled:false}
 });
 const first=governor.evaluateNext(context(1000));
 governor.recordOutcome(first,{executed:true,at:1000});
 governor.offer(make(40000));
 const repeat=governor.evaluateNext(context(40000));
 assert.equal(repeat.action,'cancel');
 assert.equal(repeat.reason,'semantic repeat cooldown');
 assert.equal(governor.snapshot(40000).pending,0);
});

test('13H long verified conversation changes follow-up style without storing transcript',()=>{
 const governor=new ProactiveAgentGovernor({...DEFAULT_PROACTIVE_POLICY,followupDelayMs:15000});
 for(let i=0;i<6;i++)governor.noteDialogue({
  id:'t'+i,participantId:'p1',attribution:'voice-profile',
  multimodalDecision:'verified',multimodalState:'verified-multimodal',
  conversationScopeId:'scope:p:p1',transcript:'private words '+i,at:1000+i
 },1000+i);
 assert.equal(governor.snapshot(2000).sessionPlans,1);
 assert.equal(governor.pending.length,1);
 assert.match(governor.pending[0].text,/keep helping/i);
 assert.equal(JSON.stringify(governor.planner.snapshot(2000)).includes('private words'),false);
});

test('13H identity conflict does not create a proactive session plan',()=>{
 const governor=new ProactiveAgentGovernor();
 const result=governor.noteDialogue({
  id:'conflict',participantId:'p1',attribution:'voice-profile',
  multimodalDecision:'verified-with-conflict',
  multimodalState:'verified-voice-visual-conflict',
  multimodalConflicts:['visual-identity-conflict'],
  conversationScopeId:'scope:p:p1',transcript:'hello',at:1000
 },1000);
 assert.equal(result,null);
 assert.equal(governor.snapshot(1000).sessionPlans,0);
 assert.equal(governor.snapshot(1000).pending,0);
});

test('13H no new identity authority or proactive persistence is introduced',()=>{
 const core=fs.readFileSync('src/agent-proactive-intelligence-core.js','utf8');
 const governor=fs.readFileSync('src/agent-proactive-core.js','utf8');
 assert.doesNotMatch(core+governor,/saveParticipant|patchParticipant|reviseDialogueAttribution|ROUTINE_FEEDBACK|AGENT_MEMORIES/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 DEFAULT_PROACTIVE_POLICY,ProactiveAgentGovernor,followupOpportunity,
 normalizeProactivePolicy,proactiveOpportunity,statusOpportunity
} from '../src/agent-proactive-core.js';

const participant=(id='p1',more={})=>({id,name:id==='p1'?'Pat':'Sam',agentProactiveEnabled:true,...more});
const turn=(more={})=>({
 id:'t1',participantId:'p1',participantName:'Pat',attribution:'voice+body',
 transcript:'Thanks',at:1000,conversationScopeId:'scope:p:p1',...more
});
const ctx=(more={})=>({
 now:70000,pageVisible:true,busy:false,meetingActive:false,
 visibleParticipantIds:['p1'],activeTaskCount:0,lastDialogueAt:1000,
 participantById:id=>participant(id),
 quietPolicy:{quietEnabled:false,quietStart:'22:00',quietEnd:'07:00'},
 ...more
});

test('11H proactive policy is bounded and session-oriented',()=>{
 const p=normalizeProactivePolicy({
  followupDelayMs:1,opportunityTtlMs:9999999,globalCooldownMs:1,
  participantCooldownMs:99999999,maxInterruptionsPerHour:99
 });
 assert.equal(p.followupDelayMs,15000);
 assert.equal(p.opportunityTtlMs,900000);
 assert.equal(p.globalCooldownMs,30000);
 assert.equal(p.participantCooldownMs,3600000);
 assert.equal(p.maxInterruptionsPerHour,10);
 assert.equal(p.enabled,true);
});

test('11H follow-up requires verified participant turn and keeps canonical scope reference only',()=>{
 const opportunity=followupOpportunity(turn(),1000,{...DEFAULT_PROACTIVE_POLICY,followupDelayMs:60000});
 assert.equal(opportunity.type,'conversation-followup');
 assert.equal(opportunity.participantId,'p1');
 assert.equal(opportunity.scopeId,'scope:p:p1');
 assert.equal(opportunity.source,'canonical-dialogue');
 assert.equal(opportunity.eligibleAt,61000);
 assert.equal(opportunity.requiresNoActiveTasks,true);
 assert.match(opportunity.text,/help with anything else/i);
 assert.equal(followupOpportunity(turn({participantId:null,attribution:'unknown'}),1000),null);
});

test('11H task/meeting status opportunities are narrow and retry notices are not proactive',()=>{
 const task=statusOpportunity({
  id:'e1',semantic:'agent-task-outcome',message:'Task completed: monitor described',at:1000
 },1000);
 assert.equal(task.type,'task-status');
 assert.match(task.text,/completed/);
 const failed=statusOpportunity({
  id:'e2',semantic:'agent-task-outcome',message:'Task failed: unavailable',at:1000
 },1000);
 assert.match(failed.text,/error/);
 assert.equal(statusOpportunity({
  id:'e3',semantic:'agent-task-outcome',message:'Task retry scheduled: temporary',at:1000
 },1000),null);
 const meeting=statusOpportunity({
  id:'m1',semantic:'meeting-ended',message:'Meeting ended',at:1000
 },1000);
 assert.equal(meeting.type,'meeting-followup');
 assert.match(meeting.text,/summary and action items/i);
});

test('11H dedupe replaces equivalent pending follow-up and newer dialogue supersedes older one',()=>{
 const g=new ProactiveAgentGovernor({...DEFAULT_PROACTIVE_POLICY,followupDelayMs:60000});
 const first=g.noteDialogue(turn({id:'t1',at:1000}),1000);
 assert.equal(first.accepted,true);
 assert.equal(g.snapshot(1000).pending,1);
 const second=g.noteDialogue(turn({id:'t2',at:2000,transcript:'one more thing'}),2000);
 assert.equal(second.accepted,true);
 assert.equal(g.snapshot(2000).pending,1);
 assert.equal(g.pending[0].sourceAt,2000);
});

test('11H attention gate abstains for quiet hours, meeting, busy, hidden page and participant opt-out',()=>{
 const g=new ProactiveAgentGovernor();
 assert.equal(g.interruptionGate({...ctx(),pageVisible:false}).reason,'page not visible');
 assert.equal(g.interruptionGate({...ctx(),meetingActive:true}).reason,'meeting active');
 assert.equal(g.interruptionGate({...ctx(),busy:true}).reason,'conversation or agent busy');
 assert.equal(g.interruptionGate({...ctx(),
  quietPolicy:{quietEnabled:true,quietStart:'00:00',quietEnd:'23:59'},localMinute:12*60}).reason,'quiet hours');
 assert.equal(g.interruptionGate({...ctx(),participantId:'p1',
  participant:participant('p1',{agentProactiveEnabled:false})}).reason,
  'participant proactive preference disabled');
});

test('11H proactive opportunity requires a verified visible attention target',()=>{
 const g=new ProactiveAgentGovernor();
 assert.equal(g.interruptionGate({...ctx(),participantId:'p1',
  participant:participant('p1'),visibleParticipantIds:[]}).reason,
  'target participant not currently visible');
 assert.equal(g.interruptionGate({...ctx(),participantId:null,
  visibleParticipantIds:['p1','p2']}).reason,'no single verified attention target');
 assert.equal(g.interruptionGate({...ctx(),participantId:null,
  visibleParticipantIds:['p1']}).allow,true);
});

test('11H follow-up waits for active task dependency and cancels if newer conversation supersedes it',()=>{
 const g=new ProactiveAgentGovernor({...DEFAULT_PROACTIVE_POLICY,followupDelayMs:15000});
 g.noteDialogue(turn({at:1000}),1000);
 let decision=g.evaluateNext(ctx({now:20000,activeTaskCount:1,lastDialogueAt:1000}));
 assert.equal(decision.action,null);
 assert.equal(decision.reason,'active task dependency');
 decision=g.evaluateNext(ctx({now:20000,activeTaskCount:0,lastDialogueAt:1500}));
 assert.equal(decision.action,'cancel');
 assert.equal(decision.reason,'newer conversation superseded follow-up');
 assert.equal(g.snapshot(20000).pending,0);
});

test('11H successful proactive outcome consumes opportunity and counts shared interruption budget',()=>{
 const g=new ProactiveAgentGovernor({
  ...DEFAULT_PROACTIVE_POLICY,followupDelayMs:15000,globalCooldownMs:30000,
  participantCooldownMs:30000,maxInterruptionsPerHour:2
 });
 g.noteDialogue(turn({at:1000}),1000);
 const decision=g.evaluateNext(ctx({now:20000}));
 assert.equal(decision.action,'speak');
 const outcome=g.recordOutcome(decision,{executed:true,at:20000});
 assert.equal(outcome.executed,true);
 assert.equal(g.snapshot(20000).pending,0);
 assert.equal(g.snapshot(20000).interruptionsThisHour,1);
 assert.equal(g.interruptionGate({...ctx({now:25000}),participantId:'p1',
  participant:participant('p1')}).reason,'global interruption cooldown');
 g.recordExternalInterruption({participantId:'p2',type:'greeting',at:60000});
 assert.equal(g.snapshot(60000).interruptionsThisHour,2);
 assert.equal(g.interruptionGate({...ctx({now:100000}),participantId:'p1',
  participant:participant('p1')}).reason,'hourly interruption budget exhausted');
});

test('11H existing greeting can share interruption budget even when proactive follow-ups are disabled',()=>{
 const g=new ProactiveAgentGovernor({...DEFAULT_PROACTIVE_POLICY,enabled:false,maxInterruptionsPerHour:1});
 const gate=g.interruptionGate({...ctx(),participantId:'p1',participant:null,respectEnabled:false});
 assert.equal(gate.allow,true);
 g.recordExternalInterruption({participantId:'p1',type:'greeting',at:70000});
 const blocked=g.interruptionGate({...ctx({now:200000}),participantId:'p1',
  participant:null,respectEnabled:false});
 assert.equal(blocked.allow,false);
 assert.equal(blocked.reason,'hourly interruption budget exhausted');
});

test('11H participant removal scrubs pending/cooldown/history/last-decision references',()=>{
 const g=new ProactiveAgentGovernor({...DEFAULT_PROACTIVE_POLICY,followupDelayMs:15000});
 g.noteDialogue(turn({at:1000}),1000);
 const decision=g.evaluateNext(ctx({now:20000}));
 g.recordOutcome(decision,{executed:true,at:20000});
 g.noteDialogue(turn({id:'t2',at:40000}),40000);
 assert.equal(g.snapshot(40000).pending,1);
 g.forgetRemovedParticipants(['p2']);
 assert.equal(g.snapshot(40000).pending,0);
 assert.equal(g.interruptions.some(x=>x.participantId==='p1'),false);
 assert.equal(g.participantLast.has('p1'),false);
 assert.equal(g.snapshot(40000).lastDecision,null);
});

test('11H integration uses existing speech/task/meeting/dialogue systems and never auto-executes tasks',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const core=fs.readFileSync('src/agent-proactive-core.js','utf8');
 assert.match(runtime,/proactiveGovernor\.noteDialogue\(savedTurn/);
 assert.match(runtime,/recordProactiveSourceEvent/);
 assert.match(runtime,/semantic:'agent-proactive-decision'/);
 assert.match(runtime,/semantic:'agent-proactive-outcome'/);
 assert.match(runtime,/proactiveGovernor\.interruptionGate/);
 assert.match(runtime,/proactiveGovernor\.recordExternalInterruption/);
 assert.match(runtime,/activeAgentTaskCount\(\)/);
 assert.match(agent,/proactiveSpeak\(text,/);
 assert.match(agent,/return say\(text,participantId,scopeId\)===true/);
 assert.doesNotMatch(core,/executeRegisteredTask|executeDue|getUserMedia|MediaRecorder|AudioContext|fetch\(/);
 assert.equal((runtime.match(/new RoomAudioCapture\(/g)||[]).length,1);
});

test('11H UI exposes session policy and participant opt-out without adding persistence or permission system',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const participantsHtml=fs.readFileSync('participants.html','utf8');
 const participantsJs=fs.readFileSync('participants.js','utf8');
 const participantCore=fs.readFileSync('src/participant-core.js','utf8');
 for(const id of ['agentProactiveEnabled','agentFollowupsEnabled','agentFollowupDelay','agentInterruptionBudget'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Tasks still require their existing owner confirmation/i);
 assert.match(participantsHtml,/id="agentProactiveEnabled"/);
 assert.match(participantsJs,/agentProactiveEnabled: ui\.agentProactiveEnabled\.checked/);
 assert.match(participantCore,/agentProactiveEnabled: input\.agentProactiveEnabled !== false/);
});

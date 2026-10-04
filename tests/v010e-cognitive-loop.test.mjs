import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AgentCognitiveLoop,DEFAULT_COGNITIVE_POLICY,inQuietHours,normalizedCognitivePolicy}
 from '../src/agent-cognitive-core.js';
import {participantRecord} from '../src/participant-core.js';

const arrival=(id='evt-1',participantId='p1')=>({
 id,at:1000,category:'presence',semantic:'participant-observed',
 source:'stable-camera-track',participantId,message:'Participant observed'
});
const person=(id='p1',extra={})=>({id,name:'Person',recognitionEnabled:true,agentGreetingEnabled:true,...extra});
const track=(id='p1',status='matched')=>({id:'track-1',participantId:id,status});

test('10E quiet-hours policy handles same-day and overnight windows deterministically',()=>{
 assert.equal(inQuietHours(23*60,{...DEFAULT_COGNITIVE_POLICY,quietEnabled:true}),true);
 assert.equal(inQuietHours(6*60,{...DEFAULT_COGNITIVE_POLICY,quietEnabled:true}),true);
 assert.equal(inQuietHours(12*60,{...DEFAULT_COGNITIVE_POLICY,quietEnabled:true}),false);
 const day={...DEFAULT_COGNITIVE_POLICY,quietEnabled:true,quietStart:'08:00',quietEnd:'12:00'};
 assert.equal(inQuietHours(9*60,day),true);
 assert.equal(inQuietHours(13*60,day),false);
 assert.equal(inQuietHours(5,{...day,quietStart:'bad'}),false);
});

test('10E policy normalization is bounded and invalid input fails to safe defaults',()=>{
 const p=normalizedCognitivePolicy({quietEnabled:true,quietStart:'99:99',quietEnd:'06:30',
  cooldownMs:10,maxGreetsPerHour:999,autoGreet:false});
 assert.equal(p.autoGreet,false);
 assert.equal(p.quietStart,'22:00');
 assert.equal(p.quietEnd,'06:30');
 assert.equal(p.cooldownMs,120000);
 assert.equal(p.maxGreetsPerHour,10);
 assert.ok(Object.isFrozen(p));
});

test('10E verified arrival produces explicit cognitive trace and approved low-priority greeting only',()=>{
 const loop=new AgentCognitiveLoop();
 const decision=loop.evaluate(arrival(),{participant:person(),track:track(),now:10000,localMinute:12*60});
 assert.equal(decision.action,'greet');
 assert.equal(decision.stage,'approved-opportunity');
 assert.equal(decision.priority,'low');
 assert.deepEqual(decision.trace.map(x=>x.stage),['observe','verify','interpret','evaluate','decide']);
 assert.equal(decision.trace[1].ok,true);
 assert.equal(decision.trace.at(-1).detail,'greet');
 assert.equal(loop.evaluate(arrival(),{participant:person(),track:track(),now:10001,localMinute:12*60}),null,
  'same canonical evidence event is idempotent');
});

test('10E abstains for unknown identity, participant opt-out, quiet hours, busy agent and disabled auto-greet',()=>{
 const cases=[
  {name:'unknown',event:arrival('u',null),participant:null,track:{id:'u',participantId:null,status:'matched'},
   policy:DEFAULT_COGNITIVE_POLICY,reason:/identity/},
  {name:'optout',event:arrival('o'),participant:person('p1',{agentGreetingEnabled:false}),track:track(),
   policy:DEFAULT_COGNITIVE_POLICY,reason:/participant greeting preference/},
  {name:'quiet',event:arrival('q'),participant:person(),track:track(),
   policy:{...DEFAULT_COGNITIVE_POLICY,quietEnabled:true},localMinute:23*60,reason:/quiet hours/},
  {name:'busy',event:arrival('b'),participant:person(),track:track(),
   policy:DEFAULT_COGNITIVE_POLICY,busy:true,reason:/busy/},
  {name:'off',event:arrival('x'),participant:person(),track:track(),
   policy:{...DEFAULT_COGNITIVE_POLICY,autoGreet:false},reason:/disabled/}
 ];
 for(const item of cases){
  const loop=new AgentCognitiveLoop(item.policy);
  const d=loop.evaluate(item.event,{participant:item.participant,track:item.track,busy:item.busy||false,
   now:10000,localMinute:item.localMinute??12*60});
  assert.equal(d.action,null,item.name);
  assert.equal(d.stage,'abstain',item.name);
  assert.match(d.reason,item.reason,item.name);
  assert.equal(d.trace.at(-1).detail,'abstain',item.name);
 }
});

test('10E successful outcome activates cooldown; failed execution does not fabricate a greeting',()=>{
 const loop=new AgentCognitiveLoop({...DEFAULT_COGNITIVE_POLICY,cooldownMs:120000});
 const d1=loop.evaluate(arrival('a'),{participant:person(),track:track(),now:100000,localMinute:12*60});
 const failed=loop.recordOutcome(d1,{executed:false,at:100001});
 assert.equal(failed.executed,false);
 const d2=loop.evaluate(arrival('b'),{participant:person(),track:track(),now:100010,localMinute:12*60});
 assert.equal(d2.action,'greet','failed output must not consume cooldown');
 loop.recordOutcome(d2,{executed:true,at:100020});
 const d3=loop.evaluate(arrival('c'),{participant:person(),track:track(),now:160000,localMinute:12*60});
 assert.equal(d3.action,null);
 assert.match(d3.reason,/cooldown/);
 const d4=loop.evaluate(arrival('d'),{participant:person(),track:track(),now:230021,localMinute:12*60});
 assert.equal(d4.action,'greet');
});

test('10E hourly interruption cap and participant deletion cleanup are bounded',()=>{
 const loop=new AgentCognitiveLoop({...DEFAULT_COGNITIVE_POLICY,cooldownMs:120000,maxGreetsPerHour:2});
 for(let i=0;i<2;i++){
  const id='p'+i,now=100000+i*130000;
  const d=loop.evaluate(arrival('e'+i,id),{participant:person(id),track:track(id),now,localMinute:12*60});
  assert.equal(d.action,'greet');
  loop.recordOutcome(d,{executed:true,at:now});
 }
 const blocked=loop.evaluate(arrival('e3','p3'),{participant:person('p3'),track:track('p3'),
  now:370000,localMinute:12*60});
 assert.equal(blocked.action,null);
 assert.match(blocked.reason,/hourly/);
 loop.forgetRemovedParticipants(['p3']);
 assert.equal(loop.snapshot().greetedThisHour,0);
 assert.equal(loop.snapshot().lastDecision?.participantId,'p3');
 loop.forgetRemovedParticipants([]);
 assert.equal(loop.snapshot().lastDecision,null);
});

test('10E participant profile persists a conservative greeting preference without creating a new consent system',()=>{
 const enabled=participantRecord({id:'p',name:'P'});
 const disabled=participantRecord({...enabled,agentGreetingEnabled:false,createdAt:enabled.createdAt});
 assert.equal(enabled.agentGreetingEnabled,true);
 assert.equal(disabled.agentGreetingEnabled,false);
});

test('10E integration routes stable arrival through one canonical decision/outcome path with no arbitrary skills',()=>{
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const core=fs.readFileSync('src/agent-cognitive-core.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(controller,/considerCognitiveObservation\(accepted\.event\)/);
 assert.match(controller,/semantic:'agent-engagement-decision'/);
 assert.match(controller,/semantic:'agent-greeting-outcome'/);
 assert.match(controller,/relatedEventId:event\.id/);
 assert.match(controller,/participant\.agentGreetingEnabled===false/);
 assert.match(controller,/cognitiveLoop\.forgetRemovedParticipants/);
 assert.match(agent,/function greet\(track,person\)/);
 assert.match(html,/id="agentAutoGreet"/);
 assert.match(html,/id="agentQuietHours"/);
 assert.match(html,/id="agentCognitiveStatus"/);
 assert.match(store,/relatedEventId:record\.relatedEventId/);
 assert.doesNotMatch(core,/fetch\(|getUserMedia|MediaRecorder|eval\(|Function\(/);
 assert.doesNotMatch(core,/\b(?:executeTask|executeSkill|runSkill|runCommand|execShell)\s*\(/i);
});

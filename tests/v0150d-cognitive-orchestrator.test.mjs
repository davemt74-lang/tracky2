import test from 'node:test';
import assert from 'node:assert/strict';
import {cognitiveCyclePlan,CognitiveOrchestrator} from '../src/cognitive-orchestrator-core.js';

const state=()=>({meeting:null,agent:{pendingProactive:0}});

test('15D direct user wins cognitive cycle',()=>{
 const p=cognitiveCyclePlan({
  state:state(),attention:{primary:{id:'a',type:'direct-user',participantId:'p1'}},
  goal:{id:'g',state:'active',participantId:'p1'},now:1000
 });
 assert.equal(p.action,'respond-user');
});

test('15D active goal outranks contextual opportunity',()=>{
 const p=cognitiveCyclePlan({
  state:state(),attention:{primary:{id:'m',type:'contextual-opportunity',participantId:'p1'}},
  goal:{id:'g',state:'active',participantId:'p1'},now:1000
 });
 assert.equal(p.action,'continue-goal');
});

test('15D waiting-for-user goal waits rather than interrupting',()=>{
 const p=cognitiveCyclePlan({
  state:state(),attention:{primary:{id:'m',type:'contextual-opportunity',participantId:'p1'}},
  goal:{id:'g',state:'waiting-for-user',participantId:'p1'},now:1000
 });
 assert.equal(p.action,'wait');
 assert.equal(p.reason,'goal-waiting-for-user');
});

test('15D contextual media only becomes offer when no higher goal owns cycle',()=>{
 const p=cognitiveCyclePlan({
  state:state(),attention:{primary:{id:'m',type:'contextual-opportunity',participantId:'p1'}},now:1000
 });
 assert.equal(p.action,'offer-contextual');
});

test('15D arrival greeting is selected by orchestrator not executed by source subsystem',()=>{
 const p=cognitiveCyclePlan({
  state:state(),attention:{primary:{id:'e',type:'passive-observation',participantId:'p1'}},
  arrivalDecision:{id:'arr1',action:'greet',participantId:'p1',expiresAt:5000},now:1000
 });
 assert.equal(p.action,'greet');
});

test('15D meeting suppresses ordinary autonomy',()=>{
 const s=state();s.meeting={status:'active'};
 const p=cognitiveCyclePlan({state:s,attention:{primary:{id:'m',type:'contextual-opportunity'}},now:1000});
 assert.equal(p.action,'wait');
});

test('15D no actionable state explicitly abstains',()=>{
 const p=cognitiveCyclePlan({state:state(),attention:{primary:null},now:1000});
 assert.equal(p.action,'abstain');
});

test('15D orchestrator enforces bounded cadence/history',()=>{
 const o=new CognitiveOrchestrator({minCadenceMs:1000,maxHistory:20});
 const first=o.evaluate({state:state(),attention:{primary:null},now:1000});
 const second=o.evaluate({state:state(),attention:{primary:null},now:1500});
 assert.equal(first.action,'abstain');
 assert.equal(second.reason,'cognitive-cadence-budget');
 for(let i=0;i<40;i++)o.evaluate({state:state(),attention:{primary:null},now:3000+i*1001});
 assert.ok(o.history.length<=20);
});

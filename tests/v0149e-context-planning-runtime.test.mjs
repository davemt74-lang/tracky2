import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9E runtime places contextual planner between interest gate and proactive governor',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/RoomContextPlanner/);
 assert.match(runtime,/roomContextPlanner\.plan\(candidate,situationalDecision/);
 assert.match(runtime,/if\(plan\.action==='silence'\)return candidate/);
 assert.match(runtime,/contextualPlanPrompt\(plan,candidate,awarenessContext\)/);
 const planAt=runtime.indexOf('roomContextPlanner.plan(candidate,situationalDecision');
 const offerAt=runtime.indexOf('proactiveGovernor.offer(proactiveOpportunity',planAt);
 assert.ok(planAt>=0&&offerAt>planAt);
});

test('14.9E chosen action becomes part of semantic dedupe identity',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/candidate\.topicKey\+'\:'+plan\.action/);
});

test('14.9E successful proactive outcomes record planner action and later user feedback',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/roomContextPlanner\.record\(contextualPlan/);
 assert.match(runtime,/roomContextPlanner\.noteFeedback/);
 assert.match(runtime,/pendingSituationalEngagement\.action/);
});

test('14.9E planning remains intent-only and does not bypass governed action systems',()=>{
 const core=read('src/room-context-planning-core.js');
 assert.doesNotMatch(core,/fetch\(|XMLHttpRequest|WebSocket|window\.open|location\.|executeRegisteredTask|createAgentTask/i);
 assert.match(core,/Do not claim research was already performed/);
});

test('14.9E planner exposes silence as an explicit first-class action',()=>{
 const core=read('src/room-context-planning-core.js');
 assert.match(core,/'silence'/);
 assert.match(core,/plan\.action==='silence'/);
});

test('14.9E core and runtime contain no hardcoded show or song examples',()=>{
 const source=read('src/room-context-planning-core.js')+'\n'+read('vertical-motion.js');
 assert.doesNotMatch(source,/The Outpost|Eyes of the World|Grateful Dead|Greatful Dead/i);
});

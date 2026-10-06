import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15D autonomous loop is owned by CognitiveOrchestrator',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/CognitiveOrchestrator/);
 assert.match(runtime,/cognitiveOrchestrator\.evaluate/);
 assert.match(runtime,/renderOrchestratorStatus/);
});

test('15D media opportunity is created only when orchestrator selects offer-contextual',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function tickProactive');
 const end=runtime.indexOf('function considerCognitiveObservation',start);
 const block=runtime.slice(start,end);
 assert.match(block,/orchestratorPlan\.action==='offer-contextual'\)considerContextualMediaEngagement/);
 assert.doesNotMatch(block,/settlePendingSituationalFeedback\(now\);\n considerContextualMediaEngagement\(now\)/);
});

test('15D arrival subsystem no longer speaks independently',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function considerCognitiveObservation');
 const end=runtime.indexOf('function roomSensorState',start);
 const block=runtime.slice(start,end);
 assert.match(block,/pendingArrivalDecision=/);
 assert.doesNotMatch(block,/agentRuntime\?\.greet|recordExternalInterruption/);
});

test('15D orchestrator owns greeting execution and rechecks governor gate',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function tickProactive');
 const end=runtime.indexOf('function considerCognitiveObservation',start);
 const block=runtime.slice(start,end);
 assert.match(block,/orchestratorPlan\.action==='greet'/);
 assert.match(block,/proactiveGovernor\.interruptionGate/);
 assert.match(block,/agentRuntime\?\.greet/);
});

test('15D ordinary wait monitor abstain cycles do not call proactive governor execution',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/if\(!\['offer-contextual','process-proactive'\]\.includes\(orchestratorPlan\.action\)\)/);
});

test('15D Control Center exposes operational decision not hidden reasoning',()=>{
 const html=read('vertical-motion.html'),runtime=read('vertical-motion.js');
 assert.match(html,/id="agentOrchestratorStatus"/);
 assert.match(runtime,/Orchestrator · /);
 assert.doesNotMatch(runtime,/chain[- ]of[- ]thought|hidden chain/i);
});

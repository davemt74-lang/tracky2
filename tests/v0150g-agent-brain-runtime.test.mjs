import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15G Agent Brain consumes canonical subsystem snapshots only',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function renderAgentBrain');
 const end=runtime.indexOf('function clearTransientCognition',start);
 const block=runtime.slice(start,end);
 assert.match(block,/unifiedCognitiveState\.snapshot\(\)/);
 assert.match(block,/attentionPriorityEngine\.snapshot\(\)/);
 assert.match(block,/goalIntentTracker\.primary\(\)/);
 assert.match(block,/cognitiveOrchestrator\.snapshot\(\)/);
 assert.match(block,/cognitiveOutcomeLedger\.snapshot\(\)/);
});

test('15G pause gate prevents cognitive cycle execution',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/proactiveComposePending\|\|cognitionPaused/);
});

test('15G owner controls cancel goal and clear only transient cognition',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/brainCancelGoal/);
 assert.match(runtime,/goalIntentTracker\.transition\(goal\.id,'abandoned'/);
 const start=runtime.indexOf('function clearTransientCognition');
 const end=runtime.indexOf('function renderCognitiveStatus',start);
 const block=runtime.slice(start,end);
 assert.match(block,/unifiedCognitiveState\.reset/);
 assert.match(block,/cognitiveOutcomeLedger\.reset/);
 assert.doesNotMatch(block,/localStorage\.removeItem|clearRoomObservations|deleteAgentMemory/i);
});

test('15G UI exposes operational state without chain-of-thought',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="agentBrainPanel"/);
 assert.match(html,/Hidden chain-of-thought is not exposed/);
 assert.match(html,/id="agentBrainPause"/);
 assert.match(html,/id="agentBrainCancelGoal"/);
 assert.match(html,/id="agentBrainClearState"/);
});

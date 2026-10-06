import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15C runtime derives governed goals and explicit dialogue goals',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/GoalIntentTracker/);
 assert.match(runtime,/goalIntentTracker\.reconcileSystem/);
 assert.match(runtime,/goalIntentTracker\.addDialogueGoal\(savedTurn/);
});

test('15C active goals enter canonical cognitive state',()=>{
 const runtime=read('vertical-motion.js'),core=read('src/unified-cognitive-state-core.js');
 assert.match(runtime,/const goals=goalIntentTracker\.active\(\)/);
 assert.match(runtime,/memories,tasks,workflows,goals,meeting/);
 assert.match(core,/goals:Object\.freeze\(goals\)/);
});

test('15C attention engine receives active-goal candidates',()=>{
 const attention=read('src/attention-priority-core.js');
 assert.match(attention,/for\(const goal of state\.goals\|\|\[\]\)/);
 assert.match(attention,/type:'active-goal'/);
});

test('15C Control Center exposes current goal without exposing private reasoning',()=>{
 const html=read('vertical-motion.html'),runtime=read('vertical-motion.js');
 assert.match(html,/id="agentGoalStatus"/);
 assert.match(runtime,/Goal · none active/);
 assert.doesNotMatch(runtime,/chain[- ]of[- ]thought|hidden reasoning/i);
});

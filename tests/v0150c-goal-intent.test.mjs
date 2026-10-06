import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitGoalFromDialogue,deriveSystemGoals,GoalIntentTracker} from '../src/goal-intent-core.js';

test('15C explicit request creates a goal while ambient statement does not',()=>{
 const g=explicitGoalFromDialogue({id:'d1',participantId:'p1',transcript:'Can you find shows like this?'},1000);
 assert.equal(g.state,'active');
 assert.equal(g.source,'explicit-dialogue');
 assert.equal(explicitGoalFromDialogue({participantId:'p1',transcript:'This room is quiet.'},1000),null);
});

test('15C governed tasks and pending follow-through derive system goals',()=>{
 const goals=deriveSystemGoals({
  tasks:[{id:'t1',status:'running',kind:'research'},{id:'t2',status:'succeeded',kind:'done'}],
  followThrough:{id:'f1',status:'pending-confirmation',participantId:'p1',action:'research',topicKey:'music:x',createdAt:1,expiresAt:5000}
 },1000);
 assert.equal(goals.length,2);
 assert.ok(goals.some(g=>g.id==='work:t1'&&g.state==='active'));
 assert.ok(goals.some(g=>g.id==='follow:f1'&&g.state==='waiting-for-user'));
});

test('15C disappearing governed work becomes completed on reconciliation',()=>{
 const t=new GoalIntentTracker();
 t.reconcileSystem({tasks:[{id:'t1',status:'running',kind:'research'}]},1000);
 assert.equal(t.primary().id,'work:t1');
 t.reconcileSystem({tasks:[]},2000);
 assert.equal(t.snapshot().recent.find(g=>g.id==='work:t1').state,'completed');
});

test('15C explicit goal can wait, block, complete and expire',()=>{
 const t=new GoalIntentTracker();
 const g=t.addDialogueGoal({participantId:'p1',transcript:'Please explain that'},1000);
 t.transition(g.id,'waiting-for-provider',{step:'provider',now:1100});
 assert.equal(t.primary().state,'waiting-for-provider');
 t.transition(g.id,'blocked',{progress:'provider unavailable',now:1200});
 assert.equal(t.primary().state,'blocked');
 t.transition(g.id,'completed',{progress:'answered',now:1300});
 assert.equal(t.primary(),null);
 const g2=t.addDialogueGoal({participantId:'p1',transcript:'Can you help me?'},2000);
 t.transition(g2.id,'active',{expiresAt:2100,now:2000});
 t.expire(2200);
 assert.equal(t.snapshot().recent.find(x=>x.id===g2.id).state,'expired');
});

test('15C goal tracker remains bounded',()=>{
 const t=new GoalIntentTracker({maxGoals:24});
 for(let i=0;i<60;i++)t.addDialogueGoal({id:'d'+i,participantId:'p1',transcript:'Can you explain item '+i+'?'},1000+i);
 assert.equal(t.snapshot().recent.length,20);
 assert.ok(t.goals.length<=24);
});

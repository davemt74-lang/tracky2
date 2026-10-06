import test from 'node:test';
import assert from 'node:assert/strict';
import {cognitiveOutcome,outcomeSummary,CognitiveOutcomeEvaluator} from '../src/cognitive-outcome-core.js';

test('15F maps user engagement and rejection to bounded utility',()=>{
 assert.ok(cognitiveOutcome({type:'expanded'},1000).value>0);
 assert.ok(cognitiveOutcome({type:'dismissed'},1000).value<0);
 assert.equal(cognitiveOutcome({type:'neutral'},1000).value,0);
});

test('15F completed goals count as high-value outcomes',()=>{
 const row=cognitiveOutcome({type:'completed-goal',goalId:'g1'},1000);
 assert.equal(row.completedGoal,true);
 assert.equal(row.useful,true);
});

test('15F summary filters by participant/topic/action',()=>{
 const rows=[
  cognitiveOutcome({type:'expanded',participantId:'p1',topicKey:'x',action:'research'},1000),
  cognitiveOutcome({type:'dismissed',participantId:'p1',topicKey:'x',action:'recommendation'},1100),
  cognitiveOutcome({type:'positive',participantId:'p2',topicKey:'x',action:'research'},1200)
 ];
 const s=outcomeSummary(rows,{participantId:'p1',topicKey:'x',action:'research',now:2000});
 assert.equal(s.samples,1);
 assert.ok(s.utility>0);
});

test('15F repeated outcomes gradually tune recommendation without overriding policy',()=>{
 const e=new CognitiveOutcomeEvaluator();
 for(let i=0;i<5;i++)e.record({type:'expanded',participantId:'p1',topicKey:'x',action:'research'},1000+i);
 const rec=e.recommendation({participantId:'p1',topicKey:'x',action:'research',now:2000});
 assert.equal(rec.recommendation,'increase');
 assert.ok(rec.adjustment<=.25);
});

test('15F correction/dismissal can reduce future action preference',()=>{
 const e=new CognitiveOutcomeEvaluator();
 for(let i=0;i<4;i++)e.record({type:i%2?'corrected':'dismissed',participantId:'p1',action:'recommendation'},1000+i);
 const rec=e.recommendation({participantId:'p1',action:'recommendation',now:2000});
 assert.equal(rec.recommendation,'decrease');
});

test('15F ledger remains bounded and metadata-only',()=>{
 const e=new CognitiveOutcomeEvaluator({maxHistory:40});
 for(let i=0;i<90;i++)e.record({type:'neutral',participantId:'p1',topicKey:'x'},i);
 assert.ok(e.history.length<=40);
 assert.equal(e.snapshot().lastOutcome.rawAudioStored,false);
});

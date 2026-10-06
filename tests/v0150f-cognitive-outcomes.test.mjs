import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCognitiveOutcome,CognitiveOutcomeLedger} from '../src/cognitive-outcome-core.js';

test('15F completed governed follow-through scores highest',()=>{
 const o=evaluateCognitiveOutcome({action:'research',status:'succeeded',executed:true});
 assert.equal(o.kind,'completed');
 assert.equal(o.score,1);
 assert.equal(o.hardGovernanceChanged,false);
});

test('15F user expansion is useful, dismissal is negative',()=>{
 assert.equal(evaluateCognitiveOutcome({action:'recommendation',feedback:'expanded',executed:true}).kind,'useful');
 assert.equal(evaluateCognitiveOutcome({action:'recommendation',feedback:'dismissed',executed:true}).kind,'dismissed');
});

test('15F intentional silence can be represented without failure',()=>{
 const o=evaluateCognitiveOutcome({action:'abstain',executed:false,intentionallyAbstained:true});
 assert.equal(o.kind,'abstained');
 assert.equal(o.score,.5);
});

test('15F adaptive signals improve gradually from repeated outcomes',()=>{
 const l=new CognitiveOutcomeLedger();
 const now=1000000;
 for(let i=0;i<4;i++)l.record({action:'research',participantId:'p1',feedback:'expanded',executed:true},now+i);
 const good=l.adaptiveSignal({action:'research',participantId:'p1',now:now+10});
 for(let i=0;i<4;i++)l.record({action:'recommendation',participantId:'p1',feedback:'dismissed',executed:true},now+i);
 const bad=l.adaptiveSignal({action:'recommendation',participantId:'p1',now:now+10});
 assert.ok(good.score>bad.score);
 assert.equal(good.samples,4);
});

test('15F ledger is bounded',()=>{
 const l=new CognitiveOutcomeLedger({maxEntries:24});
 for(let i=0;i<60;i++)l.record({action:'x',executed:true,feedback:'positive'},i);
 assert.equal(l.snapshot().count,24);
});

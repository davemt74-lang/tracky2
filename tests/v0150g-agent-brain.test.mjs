import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAgentBrainSnapshot} from '../src/agent-brain-core.js';

test('15G snapshot exposes operational state without hidden reasoning',()=>{
 const s=buildAgentBrainSnapshot({
  cognitiveState:{room:{id:'r1',name:'Room'},visibleParticipantIds:['p1'],media:{kind:'music',status:'active'}},
  attention:{reason:'highest-ranked-attention',primary:{id:'a1',type:'direct-user',participantId:'p1',score:.9}},
  goal:{id:'g1',state:'active',participantId:'p1',intent:'answer request',currentStep:'respond'},
  orchestrator:{action:'respond-user',reason:'direct-user-has-priority',participantId:'p1',goalId:'g1'},
  outcome:{action:'research',kind:'completed',score:1,reason:'goal-or-followthrough-completed'}
 });
 assert.equal(s.hiddenReasoningExposed,false);
 assert.equal(s.attention.type,'direct-user');
 assert.equal(s.goal.id,'g1');
 assert.match(s.explanation[2],/Plan:/);
});

test('15G snapshot is compact when subsystems are empty',()=>{
 const s=buildAgentBrainSnapshot({});
 assert.equal(s.attention,null);
 assert.equal(s.goal,null);
 assert.equal(s.orchestrator,null);
 assert.equal(s.memory.active,0);
});

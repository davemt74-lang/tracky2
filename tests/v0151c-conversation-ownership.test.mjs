import test from 'node:test';
import assert from 'node:assert/strict';
import {ConversationOwnershipTracker,conversationReplyOwnershipPolicy} from '../src/conversation-ownership-core.js';

const turn=(participantId='p1',more={})=>({
 id:'t1',participantId,attribution:participantId?'voice+body':'unknown',
 associationState:participantId?'verified-voice+face-body':'unknown-speaker',
 conversationScopeId:participantId?'scope:p:'+participantId:'scope:unknown-solo',
 conversationGroupSize:1,turnOwnership:participantId?'verified-speaker':'unverified-speaker',
 addressedAgent:false,addressedParticipantIds:[],attentionTarget:participantId?'speaker':'unknown',...more
});

test('15.1C verified speakers establish ownership and explicit handoff',()=>{
 const t=new ConversationOwnershipTracker();
 assert.equal(t.observe(turn('p1'),1000).state.participantId,'p1');
 const next=t.observe(turn('p2',{id:'t2',conversationScopeId:'scope:p:p2'}),2000);
 assert.equal(next.transition.type,'participant-handoff');
 assert.equal(next.transition.fromParticipantId,'p1');
 assert.equal(next.transition.toParticipantId,'p2');
});

test('15.1C group membership change is a scope handoff without inventing a new speaker',()=>{
 const t=new ConversationOwnershipTracker();
 t.observe(turn('p1',{conversationScopeId:'scope:p:p1|p:p2',conversationGroupSize:2,addressedAgent:true}),1000);
 const next=t.observe(turn('p1',{id:'t2',conversationScopeId:'scope:p:p1|p:p2|p:p3',
  conversationGroupSize:3,addressedAgent:true}),2000);
 assert.equal(next.transition.type,'scope-handoff');
 assert.equal(next.state.participantId,'p1');
});

test('15.1C overlap and internal speaker changes force contested ownership and abstention',()=>{
 const t=new ConversationOwnershipTracker();
 t.observe(turn('p1'),1000);
 const result=t.observe(turn(null,{multiPersonTurnOwnership:'overlap',turnOwnership:'multi-speaker-unresolved',
  conversationGroupSize:2,conversationScopeId:'scope:p:p1|p:p2'}),2000);
 assert.equal(result.state.state,'contested');
 assert.equal(result.transition.type,'ownership-contested');
 assert.equal(result.reply.allow,false);
});

test('15.1C participant-addressed and unaddressed group turns abstain',()=>{
 assert.equal(conversationReplyOwnershipPolicy(turn('p1',{conversationGroupSize:2,
  addressedParticipantIds:['p2'],attentionTarget:'participant'}),{}).allow,false);
 assert.equal(conversationReplyOwnershipPolicy(turn('p1',{conversationGroupSize:2,
  conversationScopeId:'scope:p:p1|p:p2'}),{}).allow,false);
 assert.equal(conversationReplyOwnershipPolicy(turn('p1',{conversationGroupSize:2,
  conversationScopeId:'scope:p:p1|p:p2',addressedAgent:true}),{}).allow,true);
});

test('15.1C contested ownership resolves only on later unambiguous canonical turn',()=>{
 const t=new ConversationOwnershipTracker();
 t.observe(turn(null,{multiPersonTurnOwnership:'multi-speaker',multiPersonOwnershipChangeCount:1,
  turnOwnership:'multi-speaker-unresolved'}),1000);
 const result=t.observe(turn('p2',{id:'t2',addressedAgent:true}),2000);
 assert.equal(result.transition.type,'ownership-resolved');
 assert.equal(result.state.participantId,'p2');
});

test('15.1C history is bounded metadata only',()=>{
 const t=new ConversationOwnershipTracker({historyMax:12});
 for(let i=0;i<40;i++)t.observe(turn(i%2?'p1':'p2',{id:'t'+i,conversationScopeId:'scope:p:'+(i%2?'p1':'p2')}),i+1);
 assert.ok(t.snapshot().history.length<=12);
 const json=JSON.stringify(t.snapshot());
 for(const bad of ['rawAudio','embedding','transcript','photo'])assert.equal(json.includes(bad),false);
});

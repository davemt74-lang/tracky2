import test from 'node:test';import assert from 'node:assert/strict';
import {greetingFor,respondToAgentTurn,appendAgentHistory,readAgentHistory,
 selectAgentVoice,agentTranscriptEligible,AGENT_HISTORY_KEY} from '../src/agent-conversation.js';
test('one verified participant receives a natural greeting and safe bounded responses',()=>{
 assert.equal(greetingFor({id:'d',name:'David',nickname:'Dave'}),'Hello, Dave. Welcome back. How is your day going?');
 assert.equal(greetingFor({name:'Unknown'}),null);
 assert.match(respondToAgentTurn('hello',{person:{name:'Dave'}}),/Hello, Dave/);
 assert.match(respondToAgentTurn('weather'),/don't have live information/);
 assert.equal(respondToAgentTurn(''),null);
});
test('unverified nearby audio cannot be misattributed to visible person for agent conversation',()=>{
 assert.equal(agentTranscriptEligible({mode:true,text:'hello there'}),false);
 assert.equal(agentTranscriptEligible({mode:true,text:'hello there',voiceParticipantId:'d'}),true);
 assert.equal(agentTranscriptEligible({mode:false,text:'hello there',voiceParticipantId:'d'}),false);
});
test('history is explicitly bounded, local-only and rejects malformed storage',()=>{
 let rows=[];for(let i=0;i<100;i++)rows=appendAgentHistory(rows,{role:'user',text:'turn'+i,at:i});
 assert.equal(rows.length,80);
 assert.equal(rows[0].text,'turn20');
 const store={getItem:key=>key===AGENT_HISTORY_KEY?JSON.stringify(rows):'[]'};
 assert.equal(readAgentHistory(store).length,80);
 assert.deepEqual(readAgentHistory({getItem(){throw Error('blocked')}}),[]);
});
test('agent voice chooses saved browser voice or falls back without fabricated catalog',()=>{
 const voices=[{voiceURI:'one',default:true},{voiceURI:'two'}];
 assert.equal(selectAgentVoice(voices,'two').voiceURI,'two');
 assert.equal(selectAgentVoice(voices,'missing').voiceURI,'one');
 assert.equal(selectAgentVoice([]),null);
});

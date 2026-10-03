import test from 'node:test';import assert from 'node:assert/strict';
import {greetingForParticipant,localAgentReply,appendAgentHistory,shouldGreet,loadAgentHistory,saveAgentHistory,AGENT_HISTORY_KEY} from '../src/agent-conversation.js';
test('verified participant greeted by enrolled name, unknown people not guessed',()=>{
 assert.match(greetingForParticipant({name:'Dave'}),/Dave/);
 assert.doesNotMatch(greetingForParticipant(null),/Dave/);
 assert.equal(shouldGreet('p',new Map(),100),true);
 assert.equal(shouldGreet('p',new Map([['p',200]]),300),false);
});
test('local responses disclose limited reasoning and never assert unknown voice identification',()=>{
 assert.match(localAgentReply('What can you do?'),/language model/i);
 assert.match(localAgentReply('Who am I?'),/cannot confirm/);
 assert.match(localAgentReply('last time',{previousTopics:['games']}),/games/);
 assert.equal(localAgentReply(''), '');
});
test('agent session history is bounded and only persisted with explicit opt-in',()=>{
 let h=[];for(let i=0;i<130;i++)h=appendAgentHistory(h,{role:'agent',text:'hello',at:i});
 assert.equal(h.length,120);
 const data=new Map(),store={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(saveAgentHistory(store,h,false),false);assert.equal(data.has(AGENT_HISTORY_KEY),false);
 assert.equal(saveAgentHistory(store,h,true),true);
 assert.equal(loadAgentHistory(store).length,120);
});

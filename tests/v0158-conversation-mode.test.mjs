import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.15.8 transcribes before speaker identity and ROOM enrichment',()=>{
 const runtime=read('vertical-motion.js');
 const process=runtime.indexOf('async function processRoomSegment');
 const transcribe=runtime.indexOf('await transcribeLiveConversationSegment(segment)',process);
 const dispatch=runtime.indexOf('dispatchLiveAgentConversationTurn(liveConversationTurn)',transcribe);
 const speaker=runtime.indexOf('await ensureSpeakerEngine()',dispatch);
 assert.ok(process>0&&transcribe>process);
 assert.ok(dispatch>transcribe);
 assert.ok(speaker>dispatch,'speaker identity must enrich conversation after live handoff');
});

test('V0.15.8 live AGENT handoff precedes local persistence',()=>{
 const runtime=read('vertical-motion.js');
 const helper=runtime.indexOf('function dispatchLiveAgentConversationTurn');
 const agent=runtime.indexOf('agentRuntime?.onDialogue(turn)',helper);
 const save=runtime.indexOf('void saveDialogueTurn(turn).catch',helper);
 assert.ok(helper>0&&agent>helper&&save>agent);
 assert.match(runtime,/Persistence is secondary to live conversation/);
 assert.match(runtime,/Conversation is live, but this turn could not be saved locally/);
});

test('V0.15.8 speaker and ROOM failures cannot erase an already dispatched transcript',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/outcome=liveConversationTurn\?'completed':'failed'/);
 assert.match(runtime,/Conversation continued; speaker\/ROOM enrichment could not be completed/);
 assert.match(runtime,/!speechOrigin\.allowConversation&&!\(state\.mode==='agent'&&transcript\.trim\(\)\)/);
 assert.match(runtime,/const keepLiveConversation=Boolean\(state\.mode==='agent'&&transcript\.trim\(\)\)/);
 assert.match(runtime,/if\(!keepLiveConversation\)return/);
});

test('V0.15.8 enriched analysis replaces the same live turn instead of replying twice',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/turn\.id=liveConversationTurn\?\.id\|\|turn\.id\|\|segment\.segmentId/);
 assert.match(runtime,/const liveIndex=state\.voice\.turns\.findIndex\(row=>row\.id===savedTurn\.id\)/);
 assert.match(runtime,/if\(liveIndex>=0\)state\.voice\.turns\[liveIndex\]=savedTurn/);
 assert.match(runtime,/if\(!liveConversationTurn\)\{/);
 assert.match(runtime,/Normal conversation was already dispatched immediately after transcription/);
});

test('V0.15.8 live turn still carries meeting/address semantics',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function createLiveAgentConversationTurn');
 const end=runtime.indexOf('function dispatchLiveAgentConversationTurn',start);
 const block=runtime.slice(start,end);
 assert.match(block,/meetingId:segment\.meetingId\|\|null/);
 assert.match(block,/multiConversationTurnFields\(base/);
 const agent=read('agent-mode.js');
 assert.match(agent,/meetingAgentReplyPolicy\(getMeeting\(\),turn\)/);
});

test('V0.15.8 basic AGENT conversation still works without an AI provider',()=>{
 const agent=read('agent-mode.js');
 const model=agent.indexOf('if(ui.useModel.checked)');
 const local=agent.indexOf('const reply=localAgentReply(turn.transcript',model);
 assert.ok(model>0&&local>model);
 assert.match(agent,/if\(reply\)say\(reply/);
});

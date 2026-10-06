import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15E contextual engagement passes through conversation timing before situational scoring',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function considerContextualMediaEngagement');
 const end=runtime.indexOf('function renderCognitiveStatus',start);
 const block=runtime.slice(start,end);
 assert.match(block,/conversationProactivityEngine\.evaluate/);
 assert.match(block,/if\(!\['mention-now','continue-thread'\]\.includes\(conversationDecision\.disposition\)\)return candidate/);
 const timingAt=block.indexOf('conversationProactivityEngine.evaluate');
 const situationAt=block.indexOf('situationalMediaEvent');
 assert.ok(timingAt>=0&&situationAt>timingAt);
});

test('15E feedback from silence and participant reply updates topic continuity',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/conversationProactivityEngine\.noteOutcome\([\s\S]*outcome:'ignored'/);
 assert.match(runtime,/conversationProactivityEngine\.noteOutcome\([\s\S]*classified\.outcome/);
});

test('15E owner ROOM reset clears conversation-thread/deferred state',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function clearSituationalAwareness');
 const end=runtime.indexOf('function situationalEventFromRoomEvent',start);
 assert.match(runtime.slice(start,end),/conversationProactivityEngine\.reset\(\)/);
});

test('15E Control Center shows operational timing decision',()=>{
 const html=read('vertical-motion.html'),runtime=read('vertical-motion.js');
 assert.match(html,/id="agentConversationProactivityStatus"/);
 assert.match(runtime,/Conversation timing · /);
});

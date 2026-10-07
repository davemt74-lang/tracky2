import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1C runtime persists canonical ownership fields before dialogue save',()=>{
 const runtime=read('vertical-motion.js');
 const own=runtime.indexOf('conversationOwnershipTracker.observe(turn');
 const save=runtime.indexOf('savedTurn = await saveDialogueTurn',own);
 assert.ok(own>0&&save>own);
 assert.match(runtime,/conversationOwnershipState/);
 assert.match(runtime,/conversationOwnershipParticipantId/);
 assert.match(runtime,/conversationOwnershipTransition/);
});

test('15.1C runtime logs handoff and contested ownership through ROOM',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/semantic:'conversation-owner-handoff'/);
 assert.match(runtime,/semantic:'conversation-ownership-contested'/);
 assert.match(runtime,/semantic:'conversation-scope-handoff'/);
});

test('15.1C ownership metadata remains observable without becoming a hard AGENT reply gate',()=>{
 const agent=read('agent-mode.js');
 const runtime=read('vertical-motion.js');
 assert.doesNotMatch(agent,/conversationReplyOwnershipPolicy/);
 assert.match(runtime,/conversationOwnershipTracker\.observe\(turn,Date\.now\(\)\)/);
 assert.match(agent,/buildAgentMessages\(/);
 assert.match(agent,/localAgentReply\(turn\.transcript/);
});

test('15.1C ownership core is metadata-only and local',()=>{
 const core=read('src/conversation-ownership-core.js');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket|indexedDB|localStorage/);
});

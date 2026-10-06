import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9F runtime creates follow-through proposal only after proactive speech executed',()=>{
 const runtime=read('vertical-motion.js');
 const execAt=runtime.indexOf('if(executed){');
 const proposalAt=runtime.indexOf('pendingContextualFollowThrough=contextualFollowThroughProposal',execAt);
 assert.ok(execAt>=0&&proposalAt>execAt);
 assert.match(runtime,/context-followthrough-proposed/);
 assert.match(runtime,/awaiting explicit user acceptance/);
});

test('14.9F explicit confirmation is evaluated from verified participant dialogue',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/followThroughReplyDecision\(turn\.transcript,proposal,now\)/);
 assert.match(runtime,/String\(turn\.participantId\)!==String\(proposal\.participantId\)/);
 assert.match(runtime,/confirmedFollowThrough\(proposal,now\)/);
});

test('14.9F handled follow-through suppresses duplicate ordinary AGENT response',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/const followThroughHandled=await handleContextualFollowThrough\(savedTurn,Date\.now\(\)\)/);
 assert.match(runtime,/if\(!followThroughHandled\)agentRuntime\?\.onDialogue\(savedTurn\)/);
});

test('14.9F research executes only after confirmed proposal and logs bounded outcome provenance',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function handleContextualFollowThrough');
 const end=runtime.indexOf('function noteSituationalDialogueFeedback',start);
 const block=runtime.slice(start,end);
 assert.match(block,/confirmed\.action==='research'/);
 assert.match(block,/agentRuntime\.researchContext\(confirmed\.query\)/);
 assert.match(block,/completedFollowThrough/);
 assert.match(block,/context-followthrough-outcome/);
 assert.match(block,/evidence:\{contextualFollowThrough:completed\}/);
});

test('14.9F provider failure degrades to logged failure without automatic retry loop',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function handleContextualFollowThrough');
 const end=runtime.indexOf('function noteSituationalDialogueFeedback',start);
 const block=runtime.slice(start,end);
 assert.match(block,/status:'failed'/);
 assert.doesNotMatch(block,/setInterval|setTimeout\(.*research|retry/i);
});

test('14.9F follow-through state clears with situational awareness reset',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function clearSituationalAwareness');
 const end=runtime.indexOf('function situationalEventFromRoomEvent',start);
 const block=runtime.slice(start,end);
 assert.match(block,/pendingContextualFollowThrough=null/);
});

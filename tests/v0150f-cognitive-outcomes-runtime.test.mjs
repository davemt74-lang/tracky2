import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15F runtime centralizes outcome signals in one ledger',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/CognitiveOutcomeLedger/);
 assert.match(runtime,/function recordUnifiedCognitiveOutcome/);
 assert.match(runtime,/cognitiveOutcomeLedger\.record/);
});

test('15F user response outcomes feed unified learning',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function noteSituationalDialogueFeedback');
 const end=runtime.indexOf('function considerContextualMediaEngagement',start);
 const block=runtime.slice(start,end);
 assert.match(block,/recordUnifiedCognitiveOutcome/);
 assert.match(block,/feedback:classified\.outcome/);
});

test('15F governed follow-through completion and failure both become outcomes',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function handleContextualFollowThrough');
 const end=runtime.indexOf('function noteSituationalDialogueFeedback',start);
 const block=runtime.slice(start,end);
 assert.match(block,/status:spoken\?'succeeded':'failed'/);
 assert.match(block,/status:'failed'/);
 assert.match(block,/goalId:goalIntentTracker\.primary/);
});

test('15F adaptive outcome can suppress repeatedly poor contextual action without bypassing governor',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function considerContextualMediaEngagement');
 const end=runtime.indexOf('function renderCognitiveStatus',start);
 const block=runtime.slice(start,end);
 assert.match(block,/cognitiveOutcomeLedger\.adaptiveSignal/);
 assert.match(block,/learnedOutcome\.samples>=3&&learnedOutcome\.score<\.3/);
 assert.match(block,/proactiveGovernor\.offer/);
});

test('15F owner ROOM reset clears transient outcome learning',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function clearSituationalAwareness');
 const end=runtime.indexOf('function situationalEventFromRoomEvent',start);
 assert.match(runtime.slice(start,end),/cognitiveOutcomeLedger\.reset\(\)/);
});

test('15F Control Center exposes last evaluated action outcome',()=>{
 const html=read('vertical-motion.html'),runtime=read('vertical-motion.js');
 assert.match(html,/id="agentOutcomeStatus"/);
 assert.match(runtime,/Outcome · /);
});

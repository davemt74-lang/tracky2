import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9C runtime derives contextual media opportunities from live room state',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/RoomContextualCognitionTracker/);
 assert.match(runtime,/roomTemporal\.summary\(effectiveRoomScene\(\),now\)/);
 assert.match(runtime,/roomMediaContinuity\.snapshot\(\)/);
 assert.match(runtime,/roomAudioIntelligence\.snapshot\(\)/);
 assert.match(runtime,/type:'media-context'/);
 assert.match(runtime,/generationPrompt:prompt/);
});

test('14.9C media cognition uses the existing proactive governor before speaking',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function tickProactive');
 const end=runtime.indexOf('function considerCognitiveObservation',start);
 const block=runtime.slice(start,end);
 assert.match(block,/proactiveGovernor\.evaluateNext/);
 assert.match(block,/decision\.opportunity\.type==='media-context'/);
 assert.match(block,/agentRuntime\.composeProactive/);
 assert.match(block,/agentRuntime\.proactiveSpeak/);
 assert.match(block,/proactiveGovernor\.recordOutcome/);
});

test('14.9C contextual generation is provider-backed and not a canned response path',()=>{
 const agent=read('agent-mode.js');
 assert.match(agent,/async function composeProactive/);
 assert.match(agent,/querySelfHostedProvider/);
 assert.match(agent,/providerFallbackPlan/);
 assert.match(agent,/queryLocalOllama/);
 assert.doesNotMatch(agent,/Are you watching The Outpost|Eyes of the World by the Grateful Dead/i);
});

test('14.9C approved remote cognition auto-routes configured remote provider independent of chat checkbox',()=>{
 const agent=read('agent-mode.js');
 const start=agent.indexOf('async function composeProactive');
 const end=agent.indexOf('return {init,greet',start);
 const block=agent.slice(start,end);
 assert.match(block,/const selected=ui\.provider\?\.value\|\|'auto'/);
 assert.match(block,/providerFallbackPlan\(selected,runtime\?\.providers\|\|\[\]\)/);
 assert.doesNotMatch(block,/if\(!ui\.useModel\.checked\).*model-disabled/s);
 assert.match(block,/selected==='ollama'/);
 assert.match(block,/local-model-disabled/);
});

test('14.9C only bounded media metadata is placed into provider prompt',()=>{
 const core=read('src/room-contextual-cognition-core.js');
 assert.match(core,/participantIdleMs/);
 assert.match(core,/mediaStableMs/);
 assert.doesNotMatch(core,/samples|Float32Array|pcm|audioData|transcriptText|rawAudio/i);
});

test('14.9C media-context type is a first-class proactive opportunity',()=>{
 const proactive=read('src/agent-proactive-core.js');
 const intelligence=read('src/agent-proactive-intelligence-core.js');
 assert.match(proactive,/media-context/);
 assert.match(proactive,/generationPrompt/);
 assert.match(intelligence,/'media-context'/);
});

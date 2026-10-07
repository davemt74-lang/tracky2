import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.15.9 serializes provisional and enriched writes for one canonical turn',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/const liveConversationPersistence=new Map\(\)/);
 assert.match(runtime,/const previous=liveConversationPersistence\.get\(id\)\|\|Promise\.resolve\(\)/);
 assert.match(runtime,/const task=previous\.catch\(\(\)=>null\)\.then\(\(\)=>saveDialogueTurn\(turn\)\)/);
 const dispatch=runtime.indexOf('function dispatchLiveAgentConversationTurn');
 const provisional=runtime.indexOf('void queueConversationPersistence(turn).catch',dispatch);
 const enriched=runtime.indexOf('savedTurn = await queueConversationPersistence({',provisional);
 assert.ok(dispatch>0&&provisional>dispatch&&enriched>provisional);
});

test('V0.15.9 observes async AGENT reply failures without blocking live Conversation',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function dispatchLiveAgentConversationTurn');
 const end=runtime.indexOf('async function transcribeLiveConversationSegment',start);
 const block=runtime.slice(start,end);
 assert.match(block,/Promise\.resolve\(\)\.then\(\(\)=>agentRuntime\?\.onDialogue\(turn\)\)\.catch/);
 assert.match(block,/AGENT heard the turn, but the reply pipeline failed/);
});

test('V0.15.9 prewarms transcription when room listening starts',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function startRoomAudio');
 const end=runtime.indexOf('function stopRoomAudio',start);
 const block=runtime.slice(start,end);
 const warm=block.indexOf('if(ui.liveTranscription.checked)void ensureTranscriptionEngine()');
 const speaker=block.indexOf('void ensureSpeakerEngine()');
 assert.ok(warm>0&&speaker>warm);
});

test('V0.15.9 remote TTS keeps listening while voice audio is only loading',()=>{
 const agent=read('agent-mode.js');
 const start=agent.indexOf('async function speakElevenLabs');
 const end=agent.indexOf('function say(',start);
 const block=agent.slice(start,end);
 const query=block.indexOf('querySelfHostedSpeech');
 const suppress=block.indexOf('suppressMic(true)');
 assert.ok(query>0&&suppress>query,'mic suppression begins only when generated audio plays');
 assert.match(block,/const controller=new AbortController\(\);speechController=controller/);
 assert.match(block,/signal:controller\.signal/);
 assert.match(block,/if\(token!==speechGeneration\)return null/);
 assert.match(block,/remoteAudioCleanup=release/);
});

test('V0.15.9 newer turns can cancel stale remote voice generation',()=>{
 const agent=read('agent-mode.js');
 assert.match(agent,/if\(speechController&&!remoteAudio\)stopSpeech\(\)/);
 assert.match(agent,/speechController\?\.abort\(\);speechController=null/);
 assert.match(agent,/if\(error\?\.name==='AbortError'\)return/);
});

test('V0.15.9 browser and remote speech share one busy contract',()=>{
 const agent=read('agent-mode.js');
 assert.match(agent,/const speechBusy=\(\)=>Boolean\(speech\?\.speaking\|\|speechController\|\|remoteAudio\)/);
 assert.match(agent,/agentSpeaking:speechBusy\(\)/);
 assert.match(agent,/isBusy:\(\)=>Boolean\(open\|\|responsePending\|\|speechBusy\(\)\)/);
 assert.match(agent,/!text\|\|open\|\|responsePending\|\|speechBusy\(\)\|\|getMeeting\(\)\?\.status==='active'/);
});

test('V0.15.9 explicit AI-model opt-in survives reload without silently enabling new users',()=>{
 const agent=read('agent-mode.js');
 assert.match(agent,/localStorage\.getItem\('tracky2-agent-model-enabled'\)==='yes'/);
 assert.match(agent,/localStorage\.setItem\('tracky2-agent-model-enabled','yes'\)/);
 assert.match(agent,/localStorage\.setItem\('tracky2-agent-model-enabled','no'\)/);
 assert.doesNotMatch(agent,/ui\.useModel\.checked=false;\s*if\(ui\.provider\)/);
});

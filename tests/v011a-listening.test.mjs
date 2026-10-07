import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 AGENT_REPLY_MAX_TURN_AGE_MS,ConversationListeningController,
 createListeningSegment,explicitStopIntent,replyEligibility,segmentValidity
} from '../src/conversation-listening-core.js';

const pcm=(n=160)=>new Float32Array(n).fill(.1);
const raw=(more={})=>({samples:pcm(),startedAt:100,endedAt:300,avgDb:-28,peakDb:-20,noiseFloorDb:-62,...more});

test('11A listening segment has stable ID, bounded deadlines and copied room-track evidence',()=>{
 const tracks=[{id:'t1',participantId:'p1',box:{x:.1,y:.2,width:.2,height:.3}}];
 const segment=createListeningSegment(raw(),{generation:4,roomTracks:tracks,queuedAt:1000,segmentId:'seg-1'});
 assert.equal(segment.segmentId,'seg-1');
 assert.equal(segment.generation,4);
 assert.equal(segment.captureDurationMs,200);
 assert.ok(segment.queueDeadlineAt>segment.queuedAt);
 assert.ok(segment.resultDeadlineAt>segment.queueDeadlineAt);
 tracks[0].participantId='mutated';
 assert.equal(segment.roomTracks[0].participantId,'p1');
 assert.ok(Object.isFrozen(segment));
});

test('11A queue drops oldest work deterministically and expires stale queued segments',()=>{
 const q=new ConversationListeningController({maxQueue:2,queueMaxAgeMs:1000,resultMaxAgeMs:5000});
 q.start(1,0);
 q.enqueue(raw(),{generation:1,now:100});
 q.enqueue(raw(),{generation:1,now:200});
 const third=q.enqueue(raw(),{generation:1,now:300});
 assert.equal(third.accepted,true);
 assert.equal(third.dropped.length,1);
 assert.equal(third.dropped[0].reason,'queue-overflow-oldest');
 assert.equal(q.snapshot().queueDepth,2);
 assert.equal(q.snapshot().droppedOverflow,1);
 const next=q.beginNext(1301);
 assert.equal(next.segment,null);
 assert.equal(next.dropped.length,2);
 assert.ok(next.dropped.every(x=>x.reason==='queue-deadline-exceeded'));
 assert.equal(q.snapshot().droppedStale,2);
});

test('11A generation invalidation cancels queued/processing work and rejects late segments',()=>{
 const q=new ConversationListeningController();
 q.start(2,0);
 const a=q.enqueue(raw(),{generation:2,now:100}).segment;
 q.enqueue(raw(),{generation:2,now:110});
 q.beginNext(120);
 assert.equal(q.snapshot().processingSegmentId,a.segmentId);
 const cancelled=q.invalidateGeneration(3,'audio-restarted',130);
 assert.equal(cancelled,2);
 assert.equal(q.snapshot().queueDepth,0);
 assert.equal(q.snapshot().processingSegmentId,null);
 assert.equal(q.snapshot().cancelled,2);
 const late=q.enqueue(raw(),{generation:2,now:140});
 assert.equal(late.accepted,false);
 assert.equal(late.reason,'generation-invalidated');
});

test('11A result deadline rejects expensive work that finishes too late',()=>{
 const segment=createListeningSegment(raw(),{generation:1,queuedAt:1000,segmentId:'late'});
 assert.equal(segmentValidity(segment,{generation:1,now:segment.resultDeadlineAt,phase:'result'}).valid,true);
 assert.deepEqual(segmentValidity(segment,{generation:1,now:segment.resultDeadlineAt+1,phase:'result'}),
  {valid:false,reason:'result-deadline-exceeded'});
 assert.equal(segmentValidity(segment,{generation:2,now:1001,phase:'result'}).reason,'generation-invalidated');
});

test('11A listening state transitions are edge-triggered and explain suppression/recovery',()=>{
 const q=new ConversationListeningController();
 q.start(1,100);
 assert.equal(q.snapshot().state,'listening');
 const at=q.snapshot().lastTransitionAt;
 assert.equal(q.setVad(false,110),false);
 assert.equal(q.snapshot().lastTransitionAt,at);
 assert.equal(q.setVad(true,120),true);
 assert.equal(q.snapshot().state,'speech');
 q.setSuppressed(true,'agent-tts',130);
 assert.equal(q.snapshot().state,'suppressed');
 q.setAgentSpeaking(true,140);
 assert.equal(q.snapshot().state,'agent-speaking');
 q.setRecovering(true,'microphone-interrupted',150);
 assert.equal(q.snapshot().state,'recovering');
 q.stop(2,'audio-stopped',160);
 assert.equal(q.snapshot().state,'offline');
});

test('11A stop intent is conservative and only verified explicit commands can cancel speech',()=>{
 assert.equal(explicitStopIntent('please be quiet'),true);
 assert.equal(explicitStopIntent('stop talking!'),true);
 assert.equal(explicitStopIntent('I like silence in the morning'),false);
 assert.equal(explicitStopIntent('can you stop talking about pizza'),false);
 const verified={id:'t1',at:1000,participantId:'p1',attribution:'voice-only',transcript:'be quiet'};
 const stop=replyEligibility({turn:verified,now:1100,agentSpeaking:true});
 assert.deepEqual(stop,{allow:false,action:'cancel-agent-speech',reason:'verified-stop-intent'});
 const unknown={...verified,participantId:null,attribution:'unknown'};
 assert.equal(replyEligibility({turn:unknown,now:1100,agentSpeaking:true}).reason,'unverified-stop-intent');
});

test('11A newer turn supersedes pending reply, while stale/modal/speaking/cooldown turns abstain',()=>{
 const turn={id:'t2',at:10000,participantId:'p1',attribution:'voice+body',transcript:'hello'};
 assert.deepEqual(replyEligibility({turn,now:10100,responsePending:true}),
  {allow:true,action:'replace-pending-reply',reason:'newer-turn-supersedes-pending'});
 assert.equal(replyEligibility({turn,now:10100,modalOpen:true}).reason,'modal-open');
 assert.equal(replyEligibility({turn,now:10100,agentSpeaking:true}).reason,'agent-speaking');
 assert.equal(replyEligibility({turn,now:10100,lastReplyAt:10000}).reason,'reply-cooldown');
 assert.equal(replyEligibility({turn,now:10000+AGENT_REPLY_MAX_TURN_AGE_MS+1}).reason,'turn-stale');
 assert.equal(replyEligibility({turn,now:12000,lastReplyAt:0}).action,'reply');
});

test('11A integration preserves one live room microphone and routes all segments through one controller',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const audio=fs.readFileSync('src/room-audio-engine.js','utf8');
 const core=fs.readFileSync('src/conversation-listening-core.js','utf8');
 const count=(runtime.match(/new RoomAudioCapture\(/g)||[]).length;
 assert.equal(count,1,'main room runtime must own exactly one RoomAudioCapture');
 const enqueueStart=runtime.indexOf('listeningController.enqueue({');
 const enqueueEnd=runtime.indexOf('},{',enqueueStart);
 const enqueueBlock=runtime.slice(enqueueStart,enqueueEnd);
 assert.ok(enqueueStart>0&&enqueueEnd>enqueueStart);
 assert.match(enqueueBlock,/\.\.\.segment/);
 assert.match(enqueueBlock,/\.\.\.meetingFields/);
 assert.match(runtime,/listeningController\.beginNext\(Date\.now\(\)\)/);
 assert.match(runtime,/listeningController\.canContinue\(segment,Date\.now\(\)\)/);
 assert.doesNotMatch(runtime,/state\.voice\.queue/);
 assert.match(audio,/navigator\.mediaDevices\.getUserMedia/);
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|transcribe\(|embedding\(/);
});

test('11A live AGENT conversation cannot be vetoed by dialogue persistence',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const helper=runtime.indexOf('function dispatchLiveAgentConversationTurn');
 const agent=runtime.indexOf('agentRuntime?.onDialogue(turn)',helper);
 const save=runtime.indexOf('void queueConversationPersistence(turn)',helper);
 assert.ok(helper>0);
 assert.ok(agent>helper);
 assert.ok(save>agent,'live AGENT handoff must happen before best-effort persistence');
 assert.match(runtime,/liveConversationPersistence=new Map\(\)/);
 assert.match(runtime,/previous\.catch\(\(\)=>null\)\.then\(\(\)=>saveDialogueTurn\(turn\)\)/);
 assert.match(runtime,/Conversation is live, but this turn could not be saved locally\./);
 assert.doesNotMatch(runtime,/Speech turn was not saved; AGENT reply skipped\./);
});

test('11A AGENT reply policy cancels superseded local-model work without clobbering newer state',()=>{
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.match(agent,/replyEligibility\(\{/);
 assert.match(agent,/policy\.action==='replace-pending-reply'/);
 assert.match(agent,/Newer eligible turn replaced the pending reply\./);
 assert.match(agent,/const controller=new AbortController\(\)/);
 assert.match(agent,/if\(modelController===controller\)modelController=null/);
 assert.match(agent,/if\(responseToken===responseGeneration\)responsePending=false/);
 assert.match(agent,/policy\.action==='cancel-agent-speech'/);
 assert.match(agent,/responsePending=false;\n   modelController\?\.abort\(\);\n   stopSpeech\(\)/);
});

test('11A ROOM exposes explainable listening state without raw audio persistence',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(html,/id="roomListeningHealth"/);
 assert.match(html,/id="roomListeningState"/);
 assert.match(html,/id="roomListeningQueue"/);
 assert.match(html,/id="roomListeningDrops"/);
 assert.match(html,/Stale or superseded work is discarded/);
 assert.match(runtime,/semantic:'listening-backpressure'/);
 assert.match(runtime,/Listening backlog discarded/);
});

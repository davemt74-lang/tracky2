import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.15.5 AGENT participant cards end at the live voice meter',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function createParticipantCard');
 const end=runtime.indexOf('function noteVisitorEvent',start);
 const block=runtime.slice(start,end);
 const cutoff=block.indexOf("if (state.mode === 'agent') return card;");
 assert.ok(cutoff>0);
 assert.ok(cutoff<block.indexOf("const actions = document.createElement('div')"));
 const renderStart=runtime.indexOf('function renderParticipantCards');
 const renderEnd=runtime.indexOf('function updateParticipantAudioMeters',renderStart);
 const render=runtime.slice(renderStart,renderEnd);
 assert.doesNotMatch(render,/agent-participant-voice-button|◉ Voice|openVoice\(/);
});

test('V0.15.5 enrolled voice association is not discarded by camera targeting policy',()=>{
 const runtime=read('vertical-motion.js');
 assert.doesNotMatch(runtime,/participantTargetEligibility/);
 assert.match(runtime,/const rawVoiceMatch = bestVoiceMatch\(embedding, state\.identity\.participants\)/);
 assert.match(runtime,/noteLiveVoiceProfileMatch\(rawVoiceMatch,segment\)/);
});

test('V0.15.5 conversation ownership is metadata and cannot suppress a normal AGENT reply',()=>{
 const agent=read('agent-mode.js');
 const runtime=read('vertical-motion.js');
 assert.doesNotMatch(agent,/conversationReplyOwnershipPolicy/);
 assert.match(runtime,/conversationOwnershipTracker\.observe\(turn,Date\.now\(\)\)/);
 assert.match(agent,/multiParticipantReplyPolicy\(turn\)/);
 assert.match(agent,/meetingAgentReplyPolicy\(getMeeting\(\),turn\)/);
 assert.match(agent,/if\(reply\)say\(reply/);
});

test('V0.15.5 AGENT microphone lifecycle does not require camera running',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/async function maybeStartApprovedMicrophone\(\)/);
 assert.match(runtime,/queryMediaPermission\(navigator\.permissions,'microphone'\)/);
 assert.match(runtime,/return startRoomAudio\(\)/);
 const recoveryStart=runtime.indexOf('async function scheduleMicrophoneRecovery');
 const recoveryEnd=runtime.indexOf('async function watchMediaPermission',recoveryStart);
 const recovery=runtime.slice(recoveryStart,recoveryEnd);
 assert.doesNotMatch(recovery,/!state\.running|camera-offline/);
 assert.match(recovery,/state\.mode!=='agent'/);
});

test('V0.15.5 preserves the direct enrolled voice-profile meter path',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/voiceProfileMatchedSegment=true/);
 assert.match(runtime,/voiceProfileMatchConfidence=Number\(match\.similarity\)/);
 assert.match(runtime,/updateParticipantAudioMeters\(true\)/);
});

test('V0.15.5+ keeps the end-to-end live turn to AGENT handoff wired',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/dispatchLiveAgentConversationTurn\(liveConversationTurn\)/);
 assert.match(runtime,/agentRuntime\?\.onDialogue\(turn\)/);
 assert.match(runtime,/void saveDialogueTurn\(turn\)\.catch/);
 const agent=read('agent-mode.js');
 assert.match(agent,/async function onDialogue\(turn\)/);
 assert.match(agent,/say\(result\.reply/);
 assert.match(agent,/localAgentReply\(turn\.transcript/);
});

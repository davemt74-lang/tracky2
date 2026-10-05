import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 agentContextSummary,agentMultimodalPromptLines,agentTurnProactivityEligibility,
 buildAgentMultimodalContext
} from '../src/agent-multimodal-context.js';

const participant={id:'p1',name:'Pat',nickname:'P'};
const verifiedTurn=(extra={})=>({
 id:'t1',participantId:'p1',attribution:'voice-profile',
 multimodalDecision:'verified',multimodalState:'verified-multimodal',
 multimodalConflicts:[],diarizationState:'speaker',diarizationOverlap:false,
 multiPersonAttributionState:'single-speaker',multiPersonPartialAttribution:false,
 conversationGroupSize:1,attentionTarget:'agent',addressedAgent:true,
 ...extra
});

test('12H verified canonical speaker may receive name and owner memory context',()=>{
 const context=buildAgentMultimodalContext({
  turn:verifiedTurn(),participants:[participant],
  memoryLines:['Historical owner memory [preference]: likes tea']
 });
 assert.equal(context.speakerState,'verified');
 assert.equal(context.participantName,'P');
 assert.equal(context.mayUseParticipantMemory,true);
 assert.equal(context.memoryLines.length,1);
 assert.equal(context.identityOverrideAllowed,false);
});

test('12H unknown speaker may converse but receives no participant name or memory',()=>{
 const context=buildAgentMultimodalContext({
  turn:verifiedTurn({participantId:null,attribution:'unknown',
   multimodalDecision:'abstain',multimodalState:'unknown-speaker'}),
  participants:[participant],
  memoryLines:['Historical owner memory [note]: secret for p1']
 });
 assert.equal(context.speakerState,'unknown');
 assert.equal(context.participantName,null);
 assert.equal(context.mayUseParticipantMemory,false);
 assert.deepEqual(context.memoryLines,[]);
 assert.match(agentMultimodalPromptLines(context).join(' '),/Speaker name unavailable/);
});

test('12H canonical identity conflict blocks name-specific memory without AGENT resolving identity',()=>{
 const context=buildAgentMultimodalContext({
  turn:verifiedTurn({
   multimodalDecision:'verified-with-conflict',
   multimodalState:'verified-voice-visual-conflict',
   multimodalConflicts:['visual-identity-conflict']
  }),
  participants:[participant],
  memoryLines:['Historical owner memory [note]: participant-only']
 });
 assert.equal(context.speakerState,'verified-conflict');
 assert.equal(context.speakerParticipantId,'p1');
 assert.equal(context.mayUseParticipantName,false);
 assert.equal(context.mayUseParticipantMemory,false);
 assert.ok(context.conflicts.includes('visual-identity-conflict'));
 assert.match(agentMultimodalPromptLines(context).join(' '),/do not resolve it yourself/);
});

test('12H overlap or partial attribution disables participant-specific memory and proactive follow-up',()=>{
 const turn=verifiedTurn({
  diarizationOverlap:true,multiPersonPartialAttribution:true,
  multiPersonAttributionState:'overlap-partial'
 });
 const context=buildAgentMultimodalContext({
  turn,participants:[participant],memoryLines:['Historical owner memory [note]: private']
 });
 assert.equal(context.speakerState,'overlap-ambiguous');
 assert.equal(context.mayUseParticipantMemory,false);
 assert.equal(agentTurnProactivityEligibility(turn).allow,false);
});

test('12H spatial/audio direction is labeled context and never identity proof',()=>{
 const context=buildAgentMultimodalContext({
  turn:verifiedTurn({
   spatialAudioSourceState:'audio-visual-agreement',
   spatialAudioDirection:'left',spatialAudioMetric:true,
   spatialAudioDistanceM:1.42
  }),
  participants:[participant]
 });
 assert.equal(context.spatial.direction,'left');
 assert.equal(context.spatial.metric,true);
 assert.match(agentMultimodalPromptLines(context).join(' '),/not identity proof/);
});

test('12H meeting context is bounded and proactive dialogue follow-up is suppressed',()=>{
 const turn=verifiedTurn({meetingId:'m1'});
 const meeting={id:'m1',title:'Review',status:'active',agentPolicy:'when-addressed'};
 const context=buildAgentMultimodalContext({turn,participants:[participant],meeting});
 assert.equal(context.meeting.sameActiveMeeting,true);
 assert.equal(context.meeting.policy,'when-addressed');
 assert.equal(agentTurnProactivityEligibility(turn).allow,false);
 assert.match(agentMultimodalPromptLines(context).join(' '),/Meeting policy remains authoritative/);
});

test('12H clean verified non-meeting turn remains eligible for bounded proactive follow-up',()=>{
 const result=agentTurnProactivityEligibility(verifiedTurn());
 assert.equal(result.allow,true);
});

test('12H revoked identity authority remains unverified for AGENT memory/name use',()=>{
 const context=buildAgentMultimodalContext({
  turn:verifiedTurn({
   multimodalDecision:'abstain',multimodalState:'revoked',
   multimodalConflicts:['revoked-identity-authority']
  }),
  participants:[participant],memoryLines:['Historical owner memory [note]: private']
 });
 assert.equal(context.revoked,true);
 assert.equal(context.mayUseParticipantName,false);
 assert.equal(context.mayUseParticipantMemory,false);
});

test('12H summary cannot expose participant identity when name use is not allowed',()=>{
 const context=buildAgentMultimodalContext({
  turn:verifiedTurn({multimodalDecision:'verified-with-conflict',
   multimodalConflicts:['visual-identity-conflict']}),
  participants:[participant]
 });
 const summary=agentContextSummary(context);
 assert.equal(summary.participantId,null);
 assert.equal(summary.participantName,null);
 assert.equal(summary.identityOverrideAllowed,false);
});

test('12H local model prompt consumes explicit reasoning context and preserves no-override rule',()=>{
 const provider=fs.readFileSync('src/agent-provider.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.match(provider,/agentMultimodalPromptLines/);
 assert.match(provider,/Never override canonical identity/i);
 assert.match(agent,/buildAgentMultimodalContext/);
 assert.match(agent,/reasoningContext\.mayUseParticipantMemory/);
 assert.match(agent,/reasoningContext\.mayUseParticipantName/);
});

test('12H AGENT UI exposes bounded canonical reasoning status',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.match(html,/id="agentReasoningStatus"/);
 assert.match(html,/cannot create or override participant identity/i);
 assert.match(agent,/reasoningStatus:\$\('agentReasoningStatus'\)/);
 assert.match(agent,/Reasoning context ·/);
});

test('12H proactive follow-up uses multimodal eligibility rather than participant id alone',()=>{
 const proactive=fs.readFileSync('src/agent-proactive-core.js','utf8');
 assert.match(proactive,/agentTurnProactivityEligibility/);
 assert.match(proactive,/eligibility\.allow/);
});

test('12H pure reasoning context cannot mutate identity, storage, sensors, network or memory',()=>{
 const core=fs.readFileSync('src/agent-multimodal-context.js','utf8');
 assert.doesNotMatch(core,/patchParticipant|saveParticipant|reviseDialogueAttribution|indexedDB|localStorage|getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
 V015AutonomyCertificationMonitor,evaluateV015AutonomyCertification,
 v015CertificationLabel,V015_AUTONOMY_CERT_VERSION
} from '../src/v015-autonomy-certification-core.js';

test('15H complete four-hour unified autonomy scenario certifies',()=>{
 const good={
  durationMs:4*60*60*1000,canonicalStatePresent:true,cognitiveStateSequence:100,
  attentionPrimaryCount:1,orchestratorDecisionCount:100,
  participantCycles:4,mediaTransitions:8,conversationOverMedia:4,
  acceptedProactive:2,rejectedProactive:2,silenceWindows:3,
  providerFailures:1,providerRecoveries:1,restartCount:1,restartClean:true,
  pauseRespected:true,singleAttentionOwner:true,singleOrchestratorOwner:true,
  staleGoalExecutions:0,competingPlans:0,duplicateSpeech:0,unapprovedActions:0,
  unconfirmedResearch:0,participantMisTarget:0,retryLoopViolations:0,
  silentMemoryPromotions:0,staleFollowThrough:0,activeGoals:2,outcomeEntries:80,
  memoryEvents:120,memoryFeedback:50,interruptionsPerHour:2,providerCallsPerHour:20,
  resourceGrowthRatio:.08,performanceLevel:'reduced'
 };
 const result=evaluateV015AutonomyCertification(good);
 assert.equal(result.status,'certified');
 assert.equal(V015_AUTONOMY_CERT_VERSION,'0.15.0');
 assert.match(v015CertificationLabel(result),/PASS/);
});

test('15H governance violations hard-fail certification',()=>{
 const result=evaluateV015AutonomyCertification({
  durationMs:4*60*60*1000,canonicalStatePresent:true,cognitiveStateSequence:1,
  participantCycles:4,mediaTransitions:8,conversationOverMedia:4,
  acceptedProactive:2,rejectedProactive:2,silenceWindows:3,
  unapprovedActions:1,unconfirmedResearch:1,silentMemoryPromotions:1,
  pauseRespected:true,restartClean:true
 });
 assert.ok(result.failed.includes('no-unapproved-actions'));
 assert.ok(result.failed.includes('no-unconfirmed-research'));
 assert.ok(result.failed.includes('no-silent-memory-promotion'));
});

test('15H architecture ownership and pause violations fail',()=>{
 const result=evaluateV015AutonomyCertification({
  durationMs:4*60*60*1000,canonicalStatePresent:true,cognitiveStateSequence:1,
  participantCycles:4,mediaTransitions:8,conversationOverMedia:4,
  acceptedProactive:2,rejectedProactive:2,silenceWindows:3,
  singleAttentionOwner:false,singleOrchestratorOwner:false,pauseRespected:false
 });
 assert.ok(result.failed.includes('single-attention-owner'));
 assert.ok(result.failed.includes('single-orchestrator-owner'));
 assert.ok(result.failed.includes('pause-respected'));
});

test('15H resource, provider and fatigue budgets are enforced',()=>{
 const result=evaluateV015AutonomyCertification({
  durationMs:4*60*60*1000,canonicalStatePresent:true,cognitiveStateSequence:1,
  participantCycles:4,mediaTransitions:8,conversationOverMedia:4,
  acceptedProactive:2,rejectedProactive:2,silenceWindows:3,
  interruptionsPerHour:4,providerCallsPerHour:61,resourceGrowthRatio:.3,
  performanceLevel:'critical'
 });
 assert.ok(result.failed.includes('interruption-budget'));
 assert.ok(result.failed.includes('provider-call-budget'));
 assert.ok(result.failed.includes('resource-growth'));
 assert.ok(result.failed.includes('performance-budget'));
});

test('15H live monitor detects cognition during pause',()=>{
 const m=new V015AutonomyCertificationMonitor({startedAt:0});
 m.observe({
  cognitiveState:{},attention:{primary:null},goalSnapshot:{active:[]},
  orchestrator:{action:'continue-goal'},outcomes:{count:0},
  situational:{eventCount:0,feedbackCount:0},cognitionPaused:true,now:1000
 });
 assert.equal(m.metrics.pauseRespected,false);
});

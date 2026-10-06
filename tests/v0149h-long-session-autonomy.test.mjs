import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LongSessionAutonomyMonitor,evaluateAutonomyCertification,certificationLabel
} from '../src/long-session-autonomy-core.js';

test('14.9H complete two-hour autonomy scenario certifies',()=>{
 const start=1000, m=new LongSessionAutonomyMonitor({startedAt:start});
 for(let i=0;i<3;i++)m.note('participant-cycle',{},start+1000+i);
 for(let i=0;i<6;i++)m.note('media-transition',{},start+2000+i);
 for(let i=0;i<3;i++)m.note('conversation-over-media',{},start+3000+i);
 m.note('provider-failure',{},start+4000);
 m.note('provider-recovery',{},start+5000);
 m.note('restart',{clean:true},start+6000);
 m.note('memory-bounds',{events:180,feedback:80},start+7000);
 for(let i=0;i<3;i++)m.note('interruption',{},start+7100000+i);
 m.note('performance',{level:'reduced'},start+7200000);
 const result=m.certify(start+7200001);
 assert.equal(result.status,'certified');
 assert.match(certificationLabel(result),/PASS/);
});

test('14.9H unconfirmed research is an automatic certification failure',()=>{
 const result=evaluateAutonomyCertification({
  durationMs:7200000,participantCycles:3,mediaTransitions:6,conversationOverMedia:3,
  providerFailures:0,restartCount:0,restartClean:true,
  autonomousResearchWithoutConfirmation:1,interruptionsPerHour:0
 });
 assert.equal(result.status,'failed');
 assert.ok(result.failed.includes('no-unconfirmed-research'));
});

test('14.9H stale follow-through and silent memory promotion fail closed',()=>{
 const result=evaluateAutonomyCertification({
  durationMs:7200000,participantCycles:3,mediaTransitions:6,conversationOverMedia:3,
  staleFollowThrough:1,promotedWithoutOwnerApproval:1,restartClean:true
 });
 assert.ok(result.failed.includes('no-stale-followthrough'));
 assert.ok(result.failed.includes('no-silent-memory-promotion'));
});

test('14.9H critical performance or memory overflow blocks certification',()=>{
 const result=evaluateAutonomyCertification({
  durationMs:7200000,participantCycles:3,mediaTransitions:6,conversationOverMedia:3,
  memoryEvents:181,memoryFeedback:81,performanceLevel:'critical',restartClean:true
 });
 assert.ok(result.failed.includes('memory-bounds'));
 assert.ok(result.failed.includes('performance-budget'));
});

test('14.9H interruption budget is evaluated over the rolling hour',()=>{
 const start=0,m=new LongSessionAutonomyMonitor({startedAt:start});
 for(let i=0;i<4;i++)m.note('interruption',{},1000+i);
 assert.equal(m.snapshot(2000).interruptionsPerHour,4);
 m.note('memory-bounds',{events:10,feedback:5},3601001);
 assert.equal(m.snapshot(3601001).interruptionsPerHour,3);
});

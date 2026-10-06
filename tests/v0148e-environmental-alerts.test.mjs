import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 EnvironmentalAlertTracker,EnvironmentalMechanicalTracker,
 environmentalAlertAgentNotice,environmentalAlertMessage,environmentalMechanicalMessage
} from '../src/environmental-alert-core.js';

const c=(more={})=>({
 category:'alarm',subtype:'alarm',modelLabel:'Alarm',confidence:.8,at:1000,
 sourceContext:{direction:'unavailable'},...more
});

test('V2D high-confidence smoke/fire-alarm-like sound is observable and eligible for governed notice without claiming an emergency',()=>{
 const tracker=new EnvironmentalAlertTracker();
 const result=tracker.observe(c({modelLabel:'Smoke detector',confidence:.91}),1000);
 assert.equal(result.accepted,true);
 assert.equal(result.proactiveEligible,true);
 assert.equal(result.event.key,'smoke-fire-alarm-like');
 assert.equal(result.event.emergencyConfirmed,false);
 assert.equal(result.event.sourceVerified,false);
 assert.equal(result.event.participantId,null);
 assert.match(environmentalAlertMessage(result),/no emergency inferred/);
 assert.match(environmentalAlertAgentNotice(result),/cannot verify the source or whether there is an emergency/);
});

test('V2D moderate alarm requires repetition before it is eligible for a notice',()=>{
 const tracker=new EnvironmentalAlertTracker();
 let result=tracker.observe(c({modelLabel:'Siren',confidence:.8,at:1000}),1000);
 assert.equal(result.proactiveEligible,false);
 result=tracker.observe(c({modelLabel:'Siren',confidence:.81,at:6000}),6000);
 assert.equal(result.event.observationCount,2);
 assert.equal(result.proactiveEligible,true);
 assert.match(environmentalAlertAgentNotice(result),/alarm- or siren-like/);
});

test('V2D doorbell and repeated knocking are grouped and deduplicated conservatively',()=>{
 const tracker=new EnvironmentalAlertTracker();
 const bell=tracker.observe(c({modelLabel:'Doorbell',confidence:.86}),1000);
 assert.equal(bell.proactiveEligible,true);
 assert.equal(bell.event.key,'doorbell-chime-like');
 assert.match(environmentalAlertAgentNotice(bell),/doorbell or chime/);

 const knock1=tracker.observe(c({
  category:'impact-crowd',subtype:'door-impact',modelLabel:'Knock',confidence:.8,at:3000
 }),3000);
 assert.equal(knock1.proactiveEligible,false);
 const knock2=tracker.observe(c({
  category:'impact-crowd',subtype:'door-impact',modelLabel:'Knock',confidence:.81,at:7000
 }),7000);
 assert.equal(knock2.proactiveEligible,true);
 assert.equal(knock2.event.observationCount,2);
 assert.match(environmentalAlertAgentNotice(knock2),/repeated knocking/);
 const knock4=tracker.observe(c({
  category:'impact-crowd',subtype:'door-impact',modelLabel:'Knock',confidence:.8,at:9000
 }),9000);
 assert.equal(knock4.emit,true,'third observation is a bounded repeat milestone');
});

test('V2D animal and applause observations never become proactive notices',()=>{
 const tracker=new EnvironmentalAlertTracker();
 const dog=tracker.observe(c({
  category:'animal',subtype:'animal',modelLabel:'Dog',confidence:.95
 }),1000);
 assert.equal(dog.accepted,true);
 assert.equal(dog.proactiveEligible,false);
 assert.equal(environmentalAlertAgentNotice(dog),'');
 const applause=tracker.observe(c({
  category:'impact-crowd',subtype:'applause',modelLabel:'Applause',confidence:.95,at:3000
 }),3000);
 assert.equal(applause.proactiveEligible,false);
});

test('V2D appliance-like sounds use start continue stop lifecycle instead of burst spam',()=>{
 const tracker=new EnvironmentalMechanicalTracker({staleMs:10000,continueMs:30000});
 const appliance=at=>c({
  category:'household-mechanical',subtype:'appliance',
  modelLabel:'Vacuum cleaner',confidence:.88,at
 });
 let observed=tracker.observe(appliance(1000),1000);
 assert.deepEqual(observed.transitions.map(row=>row.type),['start']);
 assert.match(environmentalMechanicalMessage(observed.transitions[0]),/Vacuum cleaner-like appliance sound detected/);
 assert.equal(tracker.observe(appliance(9000),9000).transitions.length,0);
 observed=tracker.observe(appliance(32000),32000);
 assert.deepEqual(observed.transitions.map(row=>row.type),['stop','start'],
  'evidence gap beyond stale threshold closes prior appliance state');
 const tracker2=new EnvironmentalMechanicalTracker({staleMs:60000,continueMs:30000});
 tracker2.observe(appliance(1000),1000);
 const continuing=tracker2.observe(appliance(32000),32000);
 assert.deepEqual(continuing.transitions.map(row=>row.type),['continue']);
 assert.match(environmentalMechanicalMessage(continuing.transitions[0]),/continues/);
 const stopped=tracker2.expire(93000);
 assert.equal(stopped.type,'stop');
 assert.match(environmentalMechanicalMessage(stopped),/no longer detected/);
});

test('V2D runtime routes notices through proactive governor and suppresses duplicate generic feed events',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const helperAt=runtime.indexOf('function logEnvironmentalAlertResult');
 const tickAt=runtime.indexOf('function tickProactive');
 assert.ok(helperAt>0&&tickAt>0);
 const helper=runtime.slice(helperAt,runtime.indexOf('function logEnvironmentalMechanicalTransition',helperAt));
 assert.match(helper,/recordProactiveSourceEvent/);
 assert.doesNotMatch(helper,/proactiveSpeak/);
 assert.match(runtime,/if\(!specialized&&emit&&grouped\.group&&state\.mode==='agent'\)/);
 assert.match(runtime,/environmentalMechanicalTracker\.expire\(summary\.at\)/);
 assert.match(runtime,/environmentalAlertTracker\.reset\(\)/);
 assert.match(runtime,/environmentalMechanicalTracker\.reset\(\)/);
});

test('V2D Basic ROOM control is enabled by default and states conservative boundaries',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(html,/id="roomImportantSoundEvents" checked/);
 assert.match(html,/No emergency is inferred/);
 assert.match(html,/no external action is taken automatically/);
 assert.match(html,/quiet-hours and interruption policy/);
 assert.match(runtime,/tracky2-room-important-sounds/);
 assert.match(runtime,/importantEnvironmentalEventsEnabled=savedImportant!=='no'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 EnvironmentalEventGrouper,calibrateEnvironmentalClassification,
 environmentalCalibrationSummary,environmentalFeedbackFromRoomEvent,
 environmentalSubtypeForLabel,environmentalV2Message,
 normalizeEnvironmentalFeedback,normalizeEnvironmentalV2Predictions
} from '../src/environmental-intelligence-core.js';

test('13F V2 preserves music vs television vs door/impact subtype discrimination',()=>{
 assert.equal(environmentalSubtypeForLabel('Music','music'),'music');
 assert.equal(environmentalSubtypeForLabel('Television','media-playback'),'television');
 assert.equal(environmentalSubtypeForLabel('Radio','media-playback'),'radio');
 assert.equal(environmentalSubtypeForLabel('Door','household-mechanical'),'door-motion');
 assert.equal(environmentalSubtypeForLabel('Door slam','impact-crowd'),'door-impact');
 assert.equal(environmentalSubtypeForLabel('Vacuum cleaner','household-mechanical'),'appliance');
 assert.equal(environmentalSubtypeForLabel('Bang','impact-crowd'),'impact');
});

test('13F speech stays filtered while high-confidence cough-like sound is observable-only',()=>{
 const speech=normalizeEnvironmentalV2Predictions([
  {label:'Speech',score:.92},{label:'Music',score:.3}
 ],{at:1000});
 assert.equal(speech.accepted,false);
 const cough=normalizeEnvironmentalV2Predictions([
  {label:'Cough',score:.91},{label:'Music',score:.2}
 ],{at:1000,durationMs:900});
 assert.equal(cough.accepted,true);
 assert.equal(cough.classification.category,'observable-human-acoustic');
 assert.equal(cough.classification.subtype,'cough-like');
 assert.equal(cough.classification.participantId,null);
 assert.equal(cough.classification.healthInference,'none');
 assert.match(environmentalV2Message(cough.classification),/no person or health meaning inferred/);
});

test('13F weak or ambiguous cough-like predictions remain filtered',()=>{
 assert.equal(normalizeEnvironmentalV2Predictions([
  {label:'Cough',score:.64},{label:'Music',score:.1}
 ]).accepted,false);
 assert.equal(normalizeEnvironmentalV2Predictions([
  {label:'Cough',score:.86},{label:'Music',score:.8}
 ]).accepted,false);
});

test('13F source direction is optional context and never participant identity',()=>{
 const result=normalizeEnvironmentalV2Predictions([{label:'Television',score:.9}],{
  audioSource:{state:'available',direction:'right',confidence:.7}
 });
 assert.equal(result.classification.sourceContext.direction,'right');
 assert.equal(result.classification.sourceContext.participantId,null);
 const none=normalizeEnvironmentalV2Predictions([{label:'Music',score:.9}],{
  audioSource:{state:'unavailable',direction:'left',confidence:.9}
 });
 assert.equal(none.classification.sourceContext.direction,'unavailable');
});

test('13F repeated short bursts group into one bounded event with milestone emission',()=>{
 const grouper=new EnvironmentalEventGrouper({windowMs:8000,maxGroups:2});
 const c=at=>normalizeEnvironmentalV2Predictions([{label:'Door',score:.9}],{at}).classification;
 assert.equal(grouper.observe(c(1000),1000).reason,'new-group');
 assert.equal(grouper.observe(c(3000),3000).emit,false);
 const third=grouper.observe(c(5000),5000);
 assert.equal(third.emit,true);
 assert.equal(third.group.observationCount,3);
 grouper.observe(c(20000),20000);
 grouper.observe(normalizeEnvironmentalV2Predictions([{label:'Music',score:.9}],{at:30000}).classification,30000);
 assert.equal(grouper.snapshot(30000).length,2);
});

test('13F current event confidence decays and eventually becomes non-current',()=>{
 const grouper=new EnvironmentalEventGrouper();
 const c=normalizeEnvironmentalV2Predictions([{label:'Music',score:.8}],{at:1000}).classification;
 grouper.observe(c,1000);
 const early=grouper.current(1000),later=grouper.current(31000),expired=grouper.current(92000);
 assert.equal(early.current,true);
 assert.ok(later.currentConfidence<early.currentConfidence);
 assert.equal(expired.current,false);
});

test('13F owner feedback calibration is bounded, local-owner, and can only reduce model confidence',()=>{
 const c=normalizeEnvironmentalV2Predictions([{label:'Television',score:.9}],{at:1000}).classification;
 const feedback=[
  normalizeEnvironmentalFeedback({category:c.category,subtype:c.subtype,modelLabel:c.modelLabel,outcome:'incorrect'},2000),
  normalizeEnvironmentalFeedback({category:c.category,subtype:c.subtype,modelLabel:c.modelLabel,outcome:'incorrect'},3000),
  normalizeEnvironmentalFeedback({category:c.category,subtype:c.subtype,modelLabel:c.modelLabel,outcome:'confirmed'},4000)
 ];
 const summary=environmentalCalibrationSummary(feedback,c);
 assert.equal(summary.total,3);
 const calibrated=calibrateEnvironmentalClassification(c,feedback);
 assert.ok(calibrated.confidence<c.confidence);
 assert.equal(calibrated.participantId,null);
 assert.ok(feedback.every(row=>row.source==='local-owner'));
});

test('13F room-event feedback derives only bounded environmental metadata',()=>{
 const feedback=environmentalFeedbackFromRoomEvent({
  evidence:{environmental:{category:'music',subtype:'music',modelLabel:'Music'}}
 },'confirmed',1000);
 assert.equal(feedback.category,'music');
 assert.equal(feedback.participantId,null);
 assert.equal(environmentalFeedbackFromRoomEvent({evidence:{}},'confirmed'),null);
});

test('13F participant store preserves bounded calibration feedback after later schema upgrades',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(store,/const DB_VERSION = 12/);
 assert.match(store,/const ENVIRONMENTAL_FEEDBACK = 'environmental-feedback'/);
 assert.match(store,/export async function saveEnvironmentalFeedback/);
 assert.match(store,/export function listEnvironmentalFeedback/);
 assert.match(store,/MAX_PERSISTED_ENVIRONMENTAL_FEEDBACK=200/);
});

test('13F ROOM evidence permits bounded environmental metadata but no raw audio or identity',()=>{
 const events=fs.readFileSync('src/room-event-core.js','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(events,/environmental:/);
 assert.match(store,/environmental:/);
 const block=events.slice(events.indexOf('function boundedEvidence'),events.indexOf('export function roomObservation'));
 assert.doesNotMatch(block,/samples|pcm|rawAudio|embedding|participantId/);
});

test('13F runtime loads owner feedback, groups V2 events, and exposes confirm/incorrect feedback',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/normalizeEnvironmentalV2Predictions/);
 assert.match(runtime,/calibrateEnvironmentalClassification/);
 assert.match(runtime,/EnvironmentalEventGrouper/);
 assert.match(runtime,/listEnvironmentalFeedback/);
 assert.match(runtime,/saveEnvironmentalFeedback/);
 assert.match(runtime,/environmentalFeedbackFromRoomEvent/);
 assert.match(runtime,/environmental-audio-classification-v2/);
 assert.match(runtime,/Confirm event/);
});

test('13F pure environmental intelligence opens no sensor, persistence, network or identity authority',()=>{
 const core=fs.readFileSync('src/environmental-intelligence-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|saveParticipant|patchParticipant/);
});

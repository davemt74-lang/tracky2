import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 EnvironmentalActivityTracker,environmentalActivityMessage,
 isPersistentEnvironmentalClassification,normalizeEnvironmentalV2Predictions
} from '../src/environmental-intelligence-core.js';
import {RoomAcousticPatternTracker,describeAcousticPattern} from '../src/room-acoustic-patterns.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('ROOM environmental awareness tracks music as start continue stop lifecycle',()=>{
 const classify=at=>normalizeEnvironmentalV2Predictions([{label:'Music',score:.93}],{at}).classification;
 const tracker=new EnvironmentalActivityTracker({staleMs:30000,continueMs:15000});
 const first=tracker.observe(classify(1000),1000);
 assert.equal(first.persistent,true);
 assert.deepEqual(first.transitions.map(row=>row.type),['start']);
 assert.match(environmentalActivityMessage(first.transitions[0]),/Music started playing/);
 assert.equal(tracker.observe(classify(8000),8000).transitions.length,0);
 const continuing=tracker.observe(classify(17000),17000);
 assert.deepEqual(continuing.transitions.map(row=>row.type),['continue']);
 assert.match(environmentalActivityMessage(continuing.transitions[0]),/still playing/);
 assert.equal(tracker.expire(46000),null);
 const stopped=tracker.expire(48000);
 assert.equal(stopped.type,'stop');
 assert.match(environmentalActivityMessage(stopped),/no longer detected/);
});

test('ROOM environmental awareness distinguishes television and generic media without inventing show identity',()=>{
 const tv=normalizeEnvironmentalV2Predictions([{label:'Television',score:.94}],{at:1000}).classification;
 const radio=normalizeEnvironmentalV2Predictions([{label:'Radio',score:.91}],{at:2000}).classification;
 assert.equal(tv.subtype,'television');
 assert.equal(radio.subtype,'radio');
 assert.equal(tv.exactMediaId,null);
 assert.equal(radio.exactMediaId,null);
 assert.equal(isPersistentEnvironmentalClassification(tv),true);
 const tracker=new EnvironmentalActivityTracker();
 assert.match(environmentalActivityMessage(tracker.observe(tv,1000).transitions[0]),/TV \/ video audio detected/);
 const switched=tracker.observe(radio,2000);
 assert.deepEqual(switched.transitions.map(row=>row.type),['stop','start']);
 assert.match(environmentalActivityMessage(switched.transitions[1]),/Radio audio detected/);
});

test('ROOM may record high-confidence speech-like room activity but never speaker identity or spoken content',()=>{
 const result=normalizeEnvironmentalV2Predictions([
  {label:'Conversation',score:.94},{label:'Music',score:.22}
 ],{at:1000,durationMs:4000});
 assert.equal(result.accepted,true);
 const c=result.classification;
 assert.equal(c.category,'room-voice-activity');
 assert.equal(c.subtype,'speech-like-activity');
 assert.equal(c.participantId,null);
 assert.equal(c.speakerAttribution,'none');
 assert.equal(c.contentInference,'none');
 assert.equal(c.exactMediaId,null);
 assert.match(environmentalActivityMessage(
  new EnvironmentalActivityTracker().observe(c,1000).transitions[0]
 ),/Room voice-like activity detected/);
});

test('ROOM acoustic metadata repeats are rate-limited until the pattern changes',()=>{
 const tracker=new RoomAcousticPatternTracker({repeatMs:60000});
 const heavy=describeAcousticPattern({
  at:1000,durationMs:15000,frames:100,meanDb:-30,peakDb:-20,noiseFloorDb:-55,
  speechFrames:75
 });
 assert.equal(heavy.pattern,'voice-activity-heavy');
 assert.equal(tracker.observe(heavy,1000).emit,true);
 assert.equal(tracker.observe({...heavy,at:16000},16000).emit,false);
 assert.equal(tracker.observe({...heavy,at:61001},61001).emit,true);
 const peaks=describeAcousticPattern({
  at:62000,durationMs:15000,frames:100,meanDb:-44,peakDb:-20,noiseFloorDb:-58,
  speechFrames:10
 });
 assert.equal(peaks.pattern,'intermittent-peaks');
 assert.equal(tracker.observe(peaks,62000).emit,true);
});

test('ROOM runtime uses activity lifecycles and does not dump raw 15-second dB summaries into feed',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/new EnvironmentalActivityTracker\(\)/);
 assert.match(runtime,/environmentalActivityTracker\.observe/);
 assert.match(runtime,/environmentalActivityTracker\.expire/);
 assert.match(runtime,/environmentalActivityMessage/);
 assert.match(runtime,/new RoomAcousticPatternTracker\(\)/);
 assert.match(runtime,/roomAcousticPatternTracker\.observe/);
 assert.doesNotMatch(runtime,/roomAudioAuditMessage/);
 assert.match(runtime,/environmentalActivityTracker\.reset\(\)/);
});

test('Basic ROOM UI explains music TV and aggregate voice-like activity boundaries',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/Detect music, TV\/video and other environmental audio locally/);
 assert.match(html,/Music and TV\/video\/radio\/game audio can be tracked/);
 assert.match(html,/no speaker identity or spoken content is inferred/);
 assert.match(html,/Exact song, movie or TV-title identification is not performed/);
});

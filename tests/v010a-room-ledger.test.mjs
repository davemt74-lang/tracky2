import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROOM_EVENT_SCHEMA,roomObservation,RoomEventLedger,RoomPresenceLedger,
 projectRoomState} from '../src/room-event-core.js';
const ev=(id,at,more={})=>({id,at,category:'system',message:'event '+id,source:'test',...more});
const sensor=(id,at,name,status)=>ev(id,at,{semantic:'sensor-state',sensor:name,status});
test('10A normalizes legacy observations into bounded versioned, explainable metadata',()=>{
 const old={id:'v09',category:'audio',at:1000,message:'Ambient observation',
  source:'shared-room-mic',evidence:{durationMs:15100,rawAudio:[1,2,3]},
  transcript:'DO NOT COPY',frame:'image data'};
 const n=roomObservation(old);
 assert.equal(n.version,ROOM_EVENT_SCHEMA);
 assert.equal(n.atUtc,new Date(1000).toISOString());
 assert.equal(n.evidence.durationMs,15100);
 assert.equal(n.evidence.rawAudio,undefined);
 assert.equal(n.transcript,undefined);
 assert.equal(n.frame,undefined);
 assert.equal(roomObservation({category:'medical',message:'diagnosis'}),null);
 assert.equal(roomObservation({category:'audio',at:-5,message:'bad time'}),null);
 assert.equal(roomObservation({category:'audio',kind:'correction',message:'bad correction'}),null);
});
test('10A idempotently deduplicates source-specific observations but not other microphones or sessions',()=>{
 const l=new RoomEventLedger({dedupeWindowMs:2500});
 assert.equal(l.append(ev('same-id',1000,{dedupeKey:'loud-room'})).added,true);
 assert.equal(l.append(ev('same-id',1000,{dedupeKey:'loud-room'})).reason,'duplicate-id');
 assert.equal(l.append(ev('same-fingerprint',1200,{dedupeKey:'loud-room'})).reason,'duplicate-observation');
 assert.equal(l.append(ev('other-source',1300,{source:'second-mic',dedupeKey:'loud-room'})).added,true);
 assert.equal(l.append(ev('other-session',1400,{sessionId:'second-session',dedupeKey:'loud-room'})).added,true);
 assert.equal(l.append(ev('much-later',7000,{dedupeKey:'loud-room'})).added,true);
 assert.deepEqual(l.entries().map(e=>e.id),['same-id','other-source','other-session','much-later']);
});
test('10A correction is append-only, linked, cannot reassign identity, and time-travel stays deterministic',()=>{
 const l=new RoomEventLedger();
 const original=ev('original',1000,{category:'activity',kind:'inference',
  participantId:'person-a',message:'Possibly seated',confidence:.3});
 assert.equal(l.append(original).added,true);
 const bad=ev('wrong-person',2000,{kind:'correction',participantId:'person-b',
  correction:{targetId:'original',operation:'retract'}});
 assert.equal(l.append(bad).reason,'invalid-correction-target');
 const updated=ev('correction',3000,{kind:'correction',participantId:'person-a',
  message:'Owner corrected inference',
  correction:{targetId:'original',operation:'replace',replacement:{message:'Unknown posture',confidence:.1}}});
 assert.equal(l.append(updated).added,true);
 assert.equal(l.append(ev('double-correction',4000,{kind:'correction',participantId:'person-a',
  correction:{targetId:'original',operation:'retract'}})).reason,'invalid-correction-target');
 assert.equal(l.project(1500).events[0].message,'Possibly seated');
 assert.equal(l.project().events[0].message,'Unknown posture');
 assert.equal(l.project().events[0].confidence,.1);
 assert.equal(l.entries()[0].message,'Possibly seated','raw original is never rewritten');
 const copy=new RoomEventLedger();
 copy.restore([...l.entries()].reverse());
 assert.deepEqual(copy.project().events,l.project().events);
});
test('10A sensor outage cannot manufacture room departures or microphone silence',()=>{
 const l=new RoomEventLedger();
 const p=new RoomPresenceLedger({graceMs:10000});
 l.append(sensor('cam-on',0,'camera','online'));
 l.append(sensor('mic-on',1,'microphone','online'));
 for(const e of p.update([{participantId:'p',participantName:'P',id:'track-1'}],1000))l.append(e);
 let s=l.project();
 assert.equal(s.participants.p.visibility,'observed');
 assert.equal(s.sensors.microphone,'online');
 p.unavailable();
 l.append(sensor('cam-off',2000,'camera','offline'));
 l.append(sensor('mic-off',2100,'microphone','paused'));
 s=l.project();
 assert.equal(s.participants.p.visibility,'unavailable');
 assert.equal(s.participants.p.lastOutOfViewAt,null);
 assert.equal(s.sensors.microphone,'paused');
 assert.equal(l.entries().filter(e=>e.semantic==='participant-out-of-view').length,0);
 p.update([],4000);
 assert.equal(l.entries().filter(e=>e.semantic==='participant-out-of-view').length,0);
 l.append(sensor('cam-resumed',5000,'camera','online'));
 assert.equal(l.project().sensors.camera,'online');
 assert.equal(l.project().participants.p.visibility,'unknown','camera reconnection must wait for new evidence before claiming presence');
});
test('10A project replay, retraction and max memory enforce deterministic bounded history',()=>{
 const l=new RoomEventLedger({max:4});
 l.append(sensor('cam',10,'camera','online'));
 l.append(ev('one',20,{category:'activity',kind:'inference',message:'Unconfirmed movement'}));
 l.append(ev('two',30,{category:'audio',message:'Noise'}));
 l.append(ev('undo',40,{kind:'correction',message:'Owner retracted inference',
   correction:{targetId:'one',operation:'retract'}}));
 const projected=l.project();
 assert.deepEqual(projected.events.map(e=>e.id),['cam','two']);
 assert.equal(projected.corrections.one.id,'undo');
 assert.equal(projectRoomState(l.entries(),35).events.length,3);
 l.append(ev('five',50));
 assert.equal(l.entries().length,4);
 l.clear();assert.deepEqual(l.entries(),[]);
});
test('10A UI adopts same event ledger, privacy write queue and permission-safe correction controls',()=>{
 const ui=fs.readFileSync('vertical-motion.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const core=fs.readFileSync('src/room-event-core.js','utf8');
 assert.match(ui,/const roomLedger=new RoomEventLedger\(\)/);
 assert.match(ui,/roomLedger\.append\(observation\)/);
 assert.match(ui,/roomLedger\.restore\(\[\.\.\.rows,\.\.\.roomHistory\]\)/);
 assert.match(ui,/roomPrivacyEpoch\+\+/);
 assert.match(ui,/await roomWrites\.catch/);
 assert.match(ui,/roomSensorState\('camera','offline'/);
 assert.match(ui,/roomSensorState\('microphone','offline'/);
 assert.match(ui,/window\.prompt\('Correction reason/);
 assert.match(html,/id="roomSensorStates"/);
 assert.match(store,/retention:'local',correction/);
 assert.match(store,/event\.participantId === id\) observations\.delete\(event\.id\)/);
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|fetch\(/);
});

test('10A device shutdown and revocation hooks are wired only to canonical captures',()=>{
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const capture=fs.readFileSync('src/room-audio-engine.js','utf8');
 assert.match(controller,/track\.addEventListener\('ended'/);
 assert.match(controller,/roomSensorState\('camera','degraded','Camera interrupted/);
 assert.match(controller,/roomSensorState\('microphone','degraded','Microphone interrupted/);
 assert.match(capture,/getAudioTracks\(\)/);
 assert.match(capture,/this\.onUnavailable\('microphone-track-ended'\)/);
 assert.match(controller,/roomSensorState\('camera','degraded','Camera unavailable/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ParticipantPresenceTransitionTracker,participantTargetEligibility,
 PARTICIPANT_DEPARTURE_GRACE_MS
} from '../src/participant-transition-core.js';

const track=(id='T1',participantId='p1',extra={})=>({
 id,participantId,participantName:'Pat',status:'matched',similarity:.91,
 identitySource:'face',lastSeenAt:1000,lastBodySeenAt:1000,lastFaceSeenAt:1000,...extra
});

test('15.1B arrival departure and bounded reentry are explicit transitions',()=>{
 const t=new ParticipantPresenceTransitionTracker();
 let e=t.observe([track()],1000);
 assert.equal(e[0].type,'arrival');
 assert.equal(t.observe([],1000+PARTICIPANT_DEPARTURE_GRACE_MS-1).length,0);
 e=t.observe([],1000+PARTICIPANT_DEPARTURE_GRACE_MS);
 assert.equal(e[0].type,'departure');
 e=t.observe([track('T2','p1',{lastSeenAt:12000,lastBodySeenAt:12000,lastFaceSeenAt:12000})],12000);
 assert.equal(e[0].type,'reentry');
 assert.equal(t.snapshot().participants[0].reentryCount,1);
});

test('15.1B track handoff does not become a second arrival',()=>{
 const t=new ParticipantPresenceTransitionTracker();
 t.observe([track('T1')],1000);
 const e=t.observe([track('T9','p1',{lastSeenAt:2000,lastBodySeenAt:2000,lastFaceSeenAt:2000})],2000);
 assert.equal(e.some(x=>x.type==='arrival'),false);
 assert.equal(e.find(x=>x.type==='track-handoff').to,'T9');
});

test('15.1B confidence transitions are visible without changing identity',()=>{
 const t=new ParticipantPresenceTransitionTracker();
 t.observe([track()],1000);
 const e=t.observe([track('T1','p1',{status:'body-lock',identitySource:'continuity-short-carry',
  continuityConfidence:.61,lastSeenAt:2000,lastBodySeenAt:2000,lastFaceSeenAt:0})],2000);
 assert.equal(e.find(x=>x.type==='confidence-change').to,'medium');
});

test('15.1B targeting blocks stale, duplicate and weak participant identity',()=>{
 assert.equal(participantTargetEligibility({participantId:'p1',tracks:[],now:5000}).reason,'participant-not-current');
 assert.equal(participantTargetEligibility({participantId:'p1',tracks:[track('A'),track('B')],now:1000}).reason,'duplicate-current-identity');
 assert.equal(participantTargetEligibility({participantId:'p1',tracks:[track('A','p1',{status:'body-lock',
  identitySource:'continuity-short-carry',continuityConfidence:.4})],now:1000}).reason,'identity-confidence-too-low');
});

test('15.1B verified current-turn voice can target after visual departure without reviving stale visual identity',()=>{
 const association={participantId:'p1',state:'verified-voice-only',associationConfidence:.92};
 const result=participantTargetEligibility({participantId:'p1',tracks:[],association,now:5000});
 assert.equal(result.allowed,true);
 assert.equal(result.reason,'verified-voice-current-turn');
 assert.equal(result.trackId,null);
});

test('15.1B transition snapshots contain no biometric/media payload',()=>{
 const t=new ParticipantPresenceTransitionTracker();
 t.observe([{...track(),embedding:[1],photo:'secret',rawAudio:'x'}],1000);
 const json=JSON.stringify(t.snapshot());
 for(const word of ['embedding','secret','rawAudio','transcript'])assert.equal(json.includes(word),false);
});

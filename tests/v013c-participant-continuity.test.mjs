import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 ParticipantContinuityTracker,applyOwnerContinuityCorrection,
 continuityCandidateState,PARTICIPANT_CONTINUITY_LONG_REENTRY_MS
} from '../src/participant-continuity-core.js';

const track=(id,cx=.5,extra={})=>({id,cx,cy:.5,box:{cx,cy:.5,width:.25,height:.7},
 bodyScore:.85,status:'body-detected',...extra});

test('13C short fragmented body track can carry a previously verified identity conservatively',()=>{
 const t=new ParticipantContinuityTracker();
 t.observeVerified({participantId:'p1',participantName:'Alex',trackId:'T1',
  authority:'face',confidence:.92,at:1000,track:track('T1',.4,{participantId:'p1'})});
 const result=t.annotateTracks([track('T2',.42)],5000);
 assert.equal(result.tracks[0].participantId,'p1');
 assert.equal(result.tracks[0].identitySource,'continuity-short-carry');
 assert.equal(result.tracks[0].status,'body-lock');
});

test('13C long-gap re-entry remains a candidate until face or voice re-verifies identity',()=>{
 const t=new ParticipantContinuityTracker();
 t.observeVerified({participantId:'p1',trackId:'T1',authority:'face',confidence:.95,
  at:1000,track:track('T1',.4,{participantId:'p1'})});
 const result=t.annotateTracks([track('T9',.41)],70000);
 assert.equal(result.tracks[0].participantId,null);
 assert.equal(result.tracks[0].continuityState,'verification-required');
 assert.equal(result.tracks[0].continuityParticipantId,'p1');
});

test('13C re-entry expires after the bounded long window',()=>{
 const record={participantId:'p1',lastSeenAt:1000,lastBox:track('T1',.4).box,confidence:.9};
 const state=continuityCandidateState({record,track:track('T2',.4),
  now:1000+PARTICIPANT_CONTINUITY_LONG_REENTRY_MS+1,currentParticipantIds:[]});
 assert.equal(state.state,'expired');
});

test('13C appearance change is irrelevant because continuity uses geometry and verified anchors, not clothing',()=>{
 const t=new ParticipantContinuityTracker();
 t.observeVerified({participantId:'p1',trackId:'T1',authority:'face',confidence:.94,
  at:1000,track:{...track('T1',.4,{participantId:'p1'}),shirtColor:'blue'}});
 const result=t.annotateTracks([{...track('T2',.41),shirtColor:'red',orientation:'back'}],4000);
 assert.equal(result.tracks[0].participantId,'p1');
 const core=fs.readFileSync('src/participant-continuity-core.js','utf8');
 assert.doesNotMatch(core,/shirt|clothing|skin|race|emotion/);
});

test('13C duplicate visible participant blocks continuity transfer to another track',()=>{
 const t=new ParticipantContinuityTracker();
 t.observeVerified({participantId:'p1',trackId:'T1',authority:'face',confidence:.95,
  at:1000,track:track('T1',.4,{participantId:'p1'})});
 const result=t.annotateTracks([
  track('T1',.4,{participantId:'p1',status:'matched'}),
  track('T2',.41)
 ],3000);
 assert.equal(result.tracks[1].participantId,null);
 assert.equal(result.tracks[1].continuityReason,'participant-already-visible');
});

test('13C two fragmented tracks cannot both inherit one participant',()=>{
 const t=new ParticipantContinuityTracker();
 t.observeVerified({participantId:'p1',trackId:'T1',authority:'face',confidence:.95,
  at:1000,track:track('T1',.5,{participantId:'p1'})});
 const result=t.annotateTracks([track('A',.49),track('B',.51)],2500);
 assert.ok(result.tracks.every(row=>row.participantId===null));
 assert.ok(result.tracks.every(row=>row.continuityState==='ambiguous'));
});

test('13C verified voice can recover a specific associated body track without stealing a visible identity',()=>{
 const t=new ParticipantContinuityTracker();
 let rows=t.recoverByVoice([track('T7',.6)],{
  participantId:'p2',participantName:'Jordan',trackId:'T7',confidence:.88,at:9000
 });
 assert.equal(rows[0].participantId,'p2');
 assert.equal(rows[0].identitySource,'voice-continuity');
 rows=t.recoverByVoice([
  track('T7',.6,{participantId:'p2',status:'matched'}),
  track('T8',.2)
 ],{participantId:'p2',trackId:'T8',confidence:.92,at:10000});
 assert.equal(rows[1].participantId,null);
});

test('13C owner correction can assign or clear identity and rejects visible duplicates',()=>{
 let rows=applyOwnerContinuityCorrection([track('T1')],{
  trackId:'T1',participantId:'p1',participantName:'Alex',at:100
 });
 assert.equal(rows[0].participantId,'p1');
 assert.equal(rows[0].identitySource,'owner-correction');
 rows=applyOwnerContinuityCorrection(rows,{trackId:'T1',participantId:null,at:200});
 assert.equal(rows[0].participantId,null);
 assert.equal(rows[0].identitySource,'owner-cleared');
 assert.throws(()=>applyOwnerContinuityCorrection([
  track('T1',.3,{participantId:'p1',status:'matched'}),track('T2',.7)
 ],{trackId:'T2',participantId:'p1'}),/already assigned/);
});

test('13C participant deletion/revocation removes continuity records',()=>{
 const t=new ParticipantContinuityTracker();
 t.observeVerified({participantId:'p1',trackId:'T1',authority:'face',at:1,track:track('T1')});
 t.observeVerified({participantId:'p2',trackId:'T2',authority:'voice',at:2,track:track('T2')});
 t.reconcile(['p2']);
 assert.deepEqual(t.snapshot().map(row=>row.participantId),['p2']);
});

test('13C confidence history is bounded and contains no image/audio/embedding payload',()=>{
 const t=new ParticipantContinuityTracker();
 for(let i=0;i<100;i++)t.observeVerified({
  participantId:'p1',trackId:'T1',authority:'face',confidence:.8,at:i+1,track:track('T1')
 });
 const snap=t.snapshot()[0];
 assert.ok(snap.history.length<=36);
 const json=JSON.stringify(snap);
 for(const forbidden of ['embedding','photo','imageData','rawAudio','transcript'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('13C pure continuity core opens no media, persistence, model or network path',()=>{
 const core=fs.readFileSync('src/participant-continuity-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|embedding\(|match\.similarity/);
});

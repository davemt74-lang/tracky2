import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 MULTIMODAL_FUSION_VERSION,MultimodalFusionTracker,deriveMultimodalEvidence,
 fuseMultimodalIdentity,identityEvidenceFresh,multimodalFusionTurnFields,
 normalizeIdentityEvidence
} from '../src/multimodal-identity-core.js';

const person=(id,name=id)=>({id,name});
const voice=(id='p1',extra={})=>({
 matched:true,participant:person(id,id==='p1'?'Pat':'Sam'),
 similarity:.91,margin:.7,ambiguous:false,...extra
});
const track=(id,participantId,status='matched',extra={})=>({
 id,participantId,participantName:participantId==='p1'?'Pat':'Sam',status,
 similarity:.86,bodyScore:.82,...extra
});
const fuse=(input={})=>{
 const referenceAt=input.referenceAt??10000;
 const evidence=deriveMultimodalEvidence({...input,referenceAt});
 return fuseMultimodalIdentity({evidence,referenceAt});
};

test('12A voice plus matching current face/body yields conservative verified multimodal identity',()=>{
 const result=fuse({voiceMatch:voice('p1'),roomTracks:[track('T1','p1')]});
 assert.equal(result.schema,MULTIMODAL_FUSION_VERSION);
 assert.equal(result.participantId,'p1');
 assert.equal(result.trackId,'T1');
 assert.equal(result.state,'verified-multimodal');
 assert.equal(result.decision,'verified');
 assert.equal(result.authority,'voice-profile');
 assert.equal(result.confidence,.86);
 assert.ok(result.provenance.includes('voice:voice-profile-match'));
 assert.ok(result.provenance.includes('face:live-face-identity'));
 assert.ok(Object.isFrozen(result));
});

test('12A body continuity can support verified voice but never becomes primary identity authority',()=>{
 const result=fuse({voiceMatch:voice('p1'),roomTracks:[track('T1','p1','body-lock')]});
 assert.equal(result.participantId,'p1');
 assert.equal(result.state,'verified-voice+continuity');
 assert.equal(result.authority,'voice-profile');
 assert.equal(result.trackId,'T1');
 assert.ok(result.confidence<.91);
 assert.ok(result.provenance.includes('body:live-body-continuity'));
});

test('12A conflicting current visual identity is explicit and cannot override verified voice authority',()=>{
 const result=fuse({voiceMatch:voice('p1'),roomTracks:[track('T2','p2','matched')]});
 assert.equal(result.participantId,'p1');
 assert.equal(result.trackId,null);
 assert.equal(result.state,'verified-voice-visual-conflict');
 assert.equal(result.decision,'verified-with-conflict');
 assert.deepEqual(result.conflicts,['visual-identity-conflict']);
 assert.ok(result.confidence<.91);
});

test('12A duplicate visual identity is not used to strengthen or select a body track',()=>{
 const result=fuse({voiceMatch:voice('p1'),roomTracks:[
  track('T1','p1','matched'),track('T2','p1','body-lock')
 ]});
 assert.equal(result.participantId,'p1');
 assert.equal(result.trackId,null);
 assert.equal(result.state,'verified-voice-only');
 assert.ok(result.conflicts.includes('duplicate-visual-identity'));
});

test('12A ambiguous or unmatched voice never promotes a sole nearby visual participant to speaker',()=>{
 const ambiguous=fuse({
  voiceMatch:{matched:false,similarity:.88,ambiguous:true},
  roomTracks:[track('T1','p1','matched')]
 });
 assert.equal(ambiguous.participantId,null);
 assert.equal(ambiguous.state,'ambiguous-voice');
 assert.equal(ambiguous.abstentionReason,'voice-ambiguous');
 assert.ok(ambiguous.contextParticipantIds.includes('p1'));

 const unmatched=fuse({
  voiceMatch:{matched:false,similarity:.25,ambiguous:false},
  roomTracks:[track('T1','p1','matched')]
 });
 assert.equal(unmatched.participantId,null);
 assert.equal(unmatched.state,'unknown-visual-context');
 assert.equal(unmatched.abstentionReason,'no-voice-identity');
});

test('12A camera-relative spatial and conversation evidence remain context-only',()=>{
 const result=fuse({
  voiceMatch:{matched:false,similarity:0,ambiguous:false},
  roomTracks:[track('T1','p1','body-lock')],
  conversationParticipantIds:['p1']
 });
 assert.equal(result.participantId,null);
 const spatial=result.evidence.find(row=>row.channel==='spatial');
 assert.equal(spatial.authority,'context');
 assert.equal(spatial.calibrated,false);
 assert.equal(spatial.source,'camera-relative-spatial-context');
 const conversation=result.evidence.find(row=>row.channel==='conversation');
 assert.equal(conversation.authority,'context');
});

test('12A stale identity evidence causes abstention rather than stale identity carry-forward',()=>{
 const old=normalizeIdentityEvidence({
  channel:'voice',participantId:'p1',confidence:.92,observedAt:1000,maxAgeMs:1000,
  source:'voice-profile-match'
 },1000);
 assert.equal(identityEvidenceFresh(old,3000),false);
 const result=fuseMultimodalIdentity({evidence:[old],referenceAt:3000});
 assert.equal(result.participantId,null);
 assert.equal(result.abstentionReason,'identity-evidence-stale');
 assert.equal(result.evidence[0].fresh,false);
});

test('12A explicit voice-authority revocation blocks even otherwise valid matched evidence',()=>{
 const result=fuse({
  voiceMatch:voice('p1'),roomTracks:[track('T1','p1')],
  revokedParticipantIds:['p1']
 });
 assert.equal(result.participantId,null);
 assert.equal(result.state,'revoked');
 assert.equal(result.decision,'abstain');
 assert.equal(result.abstentionReason,'participant-voice-authority-revoked');
});

test('12A fusion transition tracker never carries a prior participant into abstained evidence',()=>{
 const tracker=new MultimodalFusionTracker();
 const p1=fuse({voiceMatch:voice('p1'),roomTracks:[track('T1','p1')]});
 const unknown=fuse({voiceMatch:{matched:false,similarity:.1},roomTracks:[]});
 const p2=fuse({voiceMatch:voice('p2'),roomTracks:[track('T2','p2')]});
 assert.equal(tracker.preview(p1,100).type,'fusion-verified');
 assert.equal(tracker.snapshot(),null);
 tracker.commit(p1);
 assert.equal(tracker.observe(unknown,200).type,'fusion-abstained');
 assert.equal(unknown.participantId,null);
 assert.equal(tracker.observe(p2,300).type,'fusion-verified');
 const p1Again=fuse({voiceMatch:voice('p1'),roomTracks:[track('T3','p1')]});
 assert.equal(tracker.observe(p1Again,400).type,'fusion-handoff');
});

test('12A canonical turn fields are bounded metadata only with no embeddings/media',()=>{
 const result=fuse({voiceMatch:voice('p1'),roomTracks:[track('T1','p1')]});
 const fields=multimodalFusionTurnFields(result);
 assert.equal(fields.multimodalFusionVersion,1);
 assert.equal(fields.multimodalState,'verified-multimodal');
 assert.ok(fields.multimodalEvidence.length<=16);
 const json=JSON.stringify(fields);
 for(const forbidden of ['embedding','rawAudio','samples','primaryPhoto','pcm'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('12A runtime integrates fusion additively after legacy association without new capture or network path',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/deriveMultimodalEvidence\(/);
 assert.match(runtime,/fuseMultimodalIdentity\(/);
 assert.match(runtime,/multimodalFusionTurnFields\(/);
 assert.match(runtime,/MultimodalFusionTracker/);
 const core=fs.readFileSync('src/multimodal-identity-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|embedding\(/);
});

test('12A participant deletion scrubs unverified multimodal context references',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const start=store.indexOf('export async function deleteParticipant(');
 const end=store.indexOf('export async function prunePendingCaptures',start);
 const block=store.slice(start,end);
 assert.match(block,/multimodalContextParticipantIds/);
 assert.match(block,/multimodalEvidence/);
 assert.match(block,/evidence\?\.participantId !== id/);
});

test('12A conversation projection exposes fusion state/provenance without changing transcript authority',()=>{
 const timeline=fs.readFileSync('src/conversation-timeline.js','utf8');
 assert.match(timeline,/multimodalState/);
 assert.match(timeline,/multimodalProvenance/);
 assert.doesNotMatch(timeline,/saveDialogueTurn|indexedDB/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 SpeakerAssociationTracker,resolveSpeakerAssociation,speakerAssociationLabel,
 speakerAssociationTurnFields
} from '../src/speaker-participant-core.js';
import {createSpeakerTurn} from '../src/voice-core.js';
import {conversationTimeline} from '../src/conversation-timeline.js';

const person=(id,name=id)=>({id,name});
const voice=(id='p1',extra={})=>({
 matched:true,participant:person(id,id==='p1'?'Pat':'Sam'),similarity:.91,
 secondSimilarity:.21,margin:.70,ambiguous:false,...extra
});
const track=(id,participantId,status='matched',extra={})=>({
 id,participantId,participantName:participantId==='p1'?'Pat':'Sam',status,
 identitySource:status==='matched'?'face':status==='occluded'?'body-memory':'body',
 similarity:.86,...extra
});

test('11B verified voice plus current face/body produces explicit strongest association without boosting voice confidence',()=>{
 const a=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[track('T1','p1','matched')]});
 assert.equal(a.participantId,'p1');
 assert.equal(a.trackId,'T1');
 assert.equal(a.state,'verified-voice+face-body');
 assert.equal(a.attribution,'voice+body');
 assert.equal(a.bodyConfirmed,true);
 assert.equal(a.faceConfirmed,true);
 assert.equal(a.associationConfidence,.91);
 assert.deepEqual(a.provenance,['voice-profile-match','live-face-identity','live-body-track']);
 assert.equal(speakerAssociationLabel(a.state),'VOICE + FACE/BODY');
});

test('11B body continuity supports current speaker context while face is unavailable',()=>{
 const a=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[track('T1','p1','body-lock')]});
 assert.equal(a.state,'verified-voice+body');
 assert.equal(a.participantId,'p1');
 assert.equal(a.trackId,'T1');
 assert.equal(a.bodyConfirmed,true);
 assert.equal(a.faceConfirmed,false);
 assert.ok(a.provenance.includes('live-body-continuity'));
});

test('11B occlusion memory never counts as current body confirmation',()=>{
 const a=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[track('T1','p1','occluded')]});
 assert.equal(a.state,'verified-voice-only');
 assert.equal(a.participantId,'p1');
 assert.equal(a.trackId,null);
 assert.equal(a.bodyConfirmed,false);
 assert.equal(a.faceConfirmed,false);
 assert.equal(a.visualStatus,'occluded');
 assert.ok(a.provenance.includes('visual-memory-not-current'));
});

test('11B duplicate visual identity evidence is not used to strengthen a voice match',()=>{
 const a=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[
  track('T1','p1','matched'),track('T2','p1','body-lock')
 ]});
 assert.equal(a.participantId,'p1');
 assert.equal(a.trackId,null);
 assert.equal(a.bodyConfirmed,false);
 assert.equal(a.state,'verified-voice-only');
 assert.ok(a.provenance.includes('visual-duplicate-not-used'));
});

test('11B verified voice remains authoritative but exposes conflicting current enrolled visual identity',()=>{
 const a=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[track('T2','p2','matched')]});
 assert.equal(a.participantId,'p1');
 assert.equal(a.trackId,null);
 assert.equal(a.attribution,'voice-only');
 assert.equal(a.bodyConfirmed,false);
 assert.equal(a.state,'verified-voice-visual-conflict');
 assert.ok(a.provenance.includes('current-visual-identity-conflicts-with-voice'));
 assert.equal(speakerAssociationLabel(a.state),'VOICE VERIFIED · VISUAL CONFLICT');
});

test('11B ambiguous voice may retain sole-person context but never assigns that person as speaker',()=>{
 const ambiguous={matched:false,participant:null,similarity:.88,secondSimilarity:.86,margin:.02,ambiguous:true};
 const a=resolveSpeakerAssociation({voiceMatch:ambiguous,roomTracks:[track('T1','p1','matched')]});
 assert.equal(a.state,'ambiguous-voice');
 assert.equal(a.participantId,null);
 assert.equal(a.trackId,null);
 assert.equal(a.attribution,'unknown');
 assert.equal(a.nearbyParticipantId,'p1');
 assert.ok(a.provenance.includes('voice-profile-ambiguous'));
 assert.ok(a.provenance.includes('single-visible-person-context-unverified'));
});

test('11B unmatched speech keeps one visible participant or visitor as context only',()=>{
 const noMatch={matched:false,participant:null,similarity:.43,margin:.1,ambiguous:false};
 const enrolled=resolveSpeakerAssociation({voiceMatch:noMatch,roomTracks:[track('T1','p1','matched')]});
 assert.equal(enrolled.state,'unknown-nearby-participant');
 assert.equal(enrolled.participantId,null);
 assert.equal(enrolled.nearbyParticipantId,'p1');
 assert.deepEqual(enrolled.provenance,['speaker-unverified','single-visible-participant-context']);

 const visitor=resolveSpeakerAssociation({voiceMatch:noMatch,roomTracks:[
  {id:'V1',visitorId:'visitor-1',visitorLabel:'Visitor 1',status:'new'}
 ]});
 assert.equal(visitor.state,'unknown-nearby-visitor');
 assert.equal(visitor.participantId,null);
 assert.equal(visitor.nearbyVisitorId,'visitor-1');

 const group=resolveSpeakerAssociation({voiceMatch:noMatch,roomTracks:[
  track('T1','p1','matched'),track('T2','p2','matched')
 ]});
 assert.equal(group.state,'unknown-speaker');
 assert.equal(group.nearbyParticipantId,null);
});

test('11B association tracker reports transitions without carrying prior identity into new evidence',()=>{
 const tracker=new SpeakerAssociationTracker();
 const p1Face=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[track('T1','p1','matched')]});
 const p1Voice=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[]});
 const unknown=resolveSpeakerAssociation({voiceMatch:{matched:false,similarity:.2},roomTracks:[]});
 const p2=resolveSpeakerAssociation({voiceMatch:voice('p2'),roomTracks:[track('T2','p2','body-lock')]});
 const p1NewTrack=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[track('T3','p1','matched')]});

 assert.equal(tracker.preview(p1Face,100).type,'speaker-verified');
 assert.equal(tracker.snapshot(),null,'preview must not mutate accepted speaker state');
 tracker.commit(p1Face);
 assert.equal(tracker.observe(p1Voice,200).type,'evidence-transition');
 const becameUnknown=tracker.observe(unknown,300);
 assert.equal(becameUnknown.type,'speaker-became-unverified');
 assert.equal(unknown.participantId,null,'tracker must not carry p1 identity into unknown speech');
 assert.equal(tracker.observe(p2,400).type,'speaker-verified');
 assert.equal(tracker.observe(p1Face,500).type,'speaker-handoff');
 assert.equal(tracker.observe(p1NewTrack,600).type,'visual-track-handoff');
 assert.equal(tracker.snapshot().participantId,'p1');
 assert.equal(tracker.snapshot().trackId,'T3');
});

test('11B canonical turn stores association provenance and owner correction can preserve it',()=>{
 const a=resolveSpeakerAssociation({voiceMatch:voice('p1'),roomTracks:[track('T1','p1','matched')]});
 const turn=createSpeakerTurn({
  id:'turn-1',participantId:a.participantId,participantName:a.participantName,
  trackId:a.trackId,attribution:a.attribution,transcript:'hello',
  ...speakerAssociationTurnFields(a),
  associationTransition:{type:'speaker-verified',fromState:null,toState:a.state,at:1000}
 });
 assert.equal(turn.associationState,'verified-voice+face-body');
 assert.equal(turn.associationConfidence,.91);
 assert.deepEqual(turn.associationProvenance,a.provenance);
 assert.equal(turn.bodyConfirmed,true);
 assert.equal(turn.faceConfirmed,true);
 assert.equal(turn.associationTransition.type,'speaker-verified');

 const rows=conversationTimeline([{...turn,createdAt:'2026-10-04T13:00:00Z'}],[],[person('p1','Pat')]);
 assert.equal(rows[0].verified,true);
 assert.equal(rows[0].associationState,'verified-voice+face-body');
 assert.deepEqual(rows[0].associationProvenance,a.provenance);
});

test('11B runtime uses live-only body evidence, canonical transition commit and privacy-safe handoff logs',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/resolveSpeakerAssociation\(\{voiceMatch,roomTracks\}\)/);
 assert.match(runtime,/bodyConfirmed:association\.bodyConfirmed/);
 assert.doesNotMatch(runtime,/const bodyConfirmed = Boolean\(track\)/);
 assert.match(runtime,/speakerAssociationTracker\.preview\(association/);
 assert.match(runtime,/speakerAssociationTracker\.commit\(association\)/);
 const save=runtime.indexOf('savedTurn = await queueConversationPersistence({');
 const commit=runtime.indexOf('speakerAssociationTracker.commit(association)',save);
 assert.ok(save>0&&commit>save,'association transition must commit only after canonical save/current check');
 assert.match(runtime,/prior identity not carried forward/);
 assert.match(runtime,/semantic:'speaker-handoff'/);
 assert.match(runtime,/semantic:'speaker-unverified'/);
 assert.match(runtime,/participant&&track&&association\.bodyConfirmed/);
});

test('11B room-track snapshot carries evidence provenance but no media or embeddings',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const start=runtime.indexOf('function roomTrackSnapshot()');
 const end=runtime.indexOf('function onRoomAudioSegment',start);
 const block=runtime.slice(start,end);
 assert.match(block,/identitySource:track\.identitySource/);
 assert.match(block,/similarity:Number\(track\.similarity/);
 assert.match(block,/lastBodySeenAt/);
 assert.match(block,/lastFaceSeenAt/);
 assert.match(block,/visitorLabel/);
 assert.doesNotMatch(block,/embedding|latestPhoto|primaryPhoto|samples/);
});

test('11B participant/voice revocation clears current association and session resets never preserve old speaker identity',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/currentSpeaker\.voiceRecognitionEnabled===false/);
 assert.match(runtime,/voice-recognition-disabled/);
 assert.match(runtime,/participant-record-unavailable/);
 assert.match(runtime,/speakerAssociationTracker\.reset\(\)/);
 assert.match(runtime,/currentAssociationState='unknown-speaker'/);
});

test('11B UI exposes association/provenance and recent participant speaker link without a new media path',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const core=fs.readFileSync('src/speaker-participant-core.js','utf8');
 assert.match(html,/id="roomSpeakerAssociation"/);
 assert.match(html,/id="roomSpeakerProvenance"/);
 assert.match(runtime,/\['SPEAKER LINK', recentlySpoke&&track\.lastSpeakerAssociationState/);
 assert.match(agent,/Speaker link · /);
 assert.match(agent,/Speaker unverified · /);
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|transcribe\(|embedding\(/);
});

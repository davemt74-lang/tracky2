import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 currentRecordedMediaContext,resolveRoomSpeechOrigin,
 roomSpeechOriginMessage,RoomSpeechOriginTracker
} from '../src/speech-origin-core.js';
import {recordedMediaCueFromPredictions,normalizeEnvironmentalV2Predictions} from '../src/environmental-intelligence-core.js';
import {createEnvironmentalAudioWork} from '../src/environmental-audio-core.js';

const tv=(at=1000)=>({
 type:'active',category:'media-playback',subtype:'television',
 peakConfidence:.92,lastAt:at
});
const music=(at=1000)=>({
 type:'active',category:'music',subtype:'music',
 peakConfidence:.9,lastAt:at
});
const matchedVoice=(similarity=.88)=>({
 matched:true,participant:{id:'p1',name:'Dave'},similarity,
 secondSimilarity:.3,margin:.58,ambiguous:false
});
const bodyAssociation=()=>({
 participantId:'p1',trackId:'t1',bodyConfirmed:true,voiceConfidence:.88
});
const track=(cx=.5)=>({id:'t1',participantId:'p1',status:'matched',cx});

test('V2A blocks likely TV dialogue before participant matching or Conversation',()=>{
 const result=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),voiceMatch:{matched:false,similarity:.2},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[],audioSource:{state:'unavailable'},now:2000
 });
 assert.equal(result.state,'recorded');
 assert.equal(result.allowConversation,false);
 assert.equal(result.allowParticipantAttribution,false);
 assert.equal(result.mediaContext.kind,'television');
 assert.match(roomSpeechOriginMessage(result),/Recorded speech likely/);
 assert.match(roomSpeechOriginMessage(result),/excluded from participant matching and Conversation/);
});

test('V2A verified live participant speech wins even while television is active',()=>{
 const result=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),voiceMatch:matchedVoice(),association:bodyAssociation(),
  roomTracks:[track(.48)],audioSource:{state:'available',direction:'center',confidence:.8},
  now:2000
 });
 assert.equal(result.state,'live');
 assert.equal(result.allowConversation,true);
 assert.equal(result.allowParticipantAttribution,true);
 assert.equal(result.reason,'verified-live-speaker-over-recorded-media');
});

test('V2A strong spatial live evidence allows an unknown live speaker over media without assigning identity',()=>{
 const result=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),voiceMatch:{matched:false,similarity:.35},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[{id:'visitor-1',status:'new',cx:.18}],
  audioSource:{state:'available',direction:'left',confidence:.86},now:2000
 });
 assert.equal(result.state,'live');
 assert.equal(result.allowConversation,true);
 assert.equal(result.allowParticipantAttribution,false);
 assert.equal(result.reason,'spatial-live-speaker-evidence-over-recorded-media');
});

test('V2A verified window-level overlap evidence keeps live multi-speaker speech out of the recorded-media quarantine',()=>{
 const result=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),
  voiceMatch:{matched:false,similarity:.5,ambiguous:true},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[{id:'t1',participantId:'p1',status:'matched',cx:.3},
   {id:'t2',participantId:'p2',status:'matched',cx:.7}],
  audioSource:{state:'unavailable'},
  continuousFusion:{participantIds:['p1','p2'],conflicts:[],state:'multi-speaker'},
  now:2000
 });
 assert.equal(result.state,'live');
 assert.equal(result.allowConversation,true);
 assert.equal(result.allowParticipantAttribution,false);
 assert.equal(result.evidence.continuousLive,true);
 assert.equal(result.reason,'verified-window-level-live-speaker-over-recorded-media');
});

test('V2A visible person plus active media but no source corroboration stays uncertain and is quarantined',()=>{
 const result=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),voiceMatch:{matched:false,similarity:.32},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[{id:'visitor-1',status:'new',cx:.5}],
  audioSource:{state:'unavailable'},now:2000
 });
 assert.equal(result.state,'uncertain');
 assert.equal(result.allowConversation,false);
 assert.equal(result.allowParticipantAttribution,false);
 assert.match(roomSpeechOriginMessage(result),/held out of Conversation/);
});

test('V2A music vocals are treated as recorded-media risk unless live speech is corroborated',()=>{
 const blocked=resolveRoomSpeechOrigin({
  mediaActivity:music(1000),voiceMatch:{matched:false,similarity:.25},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[],audioSource:{state:'unavailable'},now:2000
 });
 assert.equal(blocked.state,'recorded');
 assert.equal(blocked.mediaContext.kind,'music');
 assert.equal(blocked.allowConversation,false);

 const live=resolveRoomSpeechOrigin({
  mediaActivity:music(1000),voiceMatch:matchedVoice(.9),association:bodyAssociation(),
  roomTracks:[track(.5)],audioSource:{state:'available',direction:'center',confidence:.85},
  now:2000
 });
 assert.equal(live.state,'live');
 assert.equal(live.allowParticipantAttribution,true);
});

test('V2A preserves ordinary unknown room speech when no recorded-media context exists',()=>{
 const result=resolveRoomSpeechOrigin({
  voiceMatch:{matched:false,similarity:.2},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[],audioSource:{state:'unavailable'},now:2000
 });
 assert.equal(result.state,'uncertain');
 assert.equal(result.allowConversation,true);
 assert.equal(result.allowParticipantAttribution,false);
});

test('V2A voice profile is sufficient live evidence when no media context exists',()=>{
 const result=resolveRoomSpeechOrigin({
  voiceMatch:matchedVoice(.84),
  association:{participantId:'p1',trackId:null,bodyConfirmed:false,voiceConfidence:.84},
  roomTracks:[],audioSource:{state:'unavailable'},now:2000
 });
 assert.equal(result.state,'live');
 assert.equal(result.allowConversation,true);
 assert.equal(result.allowParticipantAttribution,true);
});

test('V2A stale media context cannot suppress a later live-room turn',()=>{
 assert.equal(currentRecordedMediaContext({activity:tv(1000),now:60000}),null);
 const result=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),voiceMatch:{matched:false,similarity:.1},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[],audioSource:{state:'unavailable'},now:60000
 });
 assert.equal(result.mediaContext,null);
 assert.equal(result.allowConversation,true);
});

test('V2A secondary TV evidence survives a speech-dominant same-window classification',()=>{
 const predictions=[
  {label:'Speech',score:.91},
  {label:'Television',score:.46},
  {label:'Music',score:.19}
 ];
 const cue=recordedMediaCueFromPredictions(predictions,1900);
 assert.equal(cue.category,'media-playback');
 assert.equal(cue.subtype,'television');
 assert.equal(cue.participantId,null);
 assert.equal(cue.exactMediaId,null);
 const normalized=normalizeEnvironmentalV2Predictions(predictions,{at:1900,durationMs:2500});
 assert.equal(normalized.accepted,true);
 assert.equal(normalized.classification.category,'room-voice-activity');
 assert.equal(normalized.classification.recordedMediaCue.subtype,'television');
 const result=resolveRoomSpeechOrigin({
  recentEnvironmental:cue,voiceMatch:{matched:false,similarity:.2},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[],audioSource:{state:'unavailable'},now:2000
 });
 assert.equal(result.state,'recorded');
 assert.equal(result.allowConversation,false);
});

test('V2A environmental work keeps an ephemeral correlation ID without raw-media persistence',()=>{
 const work=createEnvironmentalAudioWork({
  samples:new Float32Array([0,.1,-.1]),sampleRate:16000,durationSeconds:1.5,
  environmentCorrelationId:'speech-env-123'
 },{queuedAt:1000,generation:2,id:'work-1'});
 assert.equal(work.correlationId,'speech-env-123');
 assert.equal(work.generation,2);
 assert.equal(work.samples.length,3);
});

test('V2A recent classification can protect the first media speech segment before lifecycle grouping catches up',()=>{
 const recent={category:'media-playback',subtype:'radio',confidence:.89,at:1900};
 const result=resolveRoomSpeechOrigin({
  recentEnvironmental:recent,voiceMatch:{matched:false,similarity:.2},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[],audioSource:{state:'unavailable'},now:2000
 });
 assert.equal(result.state,'recorded');
 assert.equal(result.mediaContext.kind,'radio');
 assert.equal(result.mediaContext.source,'recent-environmental-classification');
});

test('V2A ROOM feed notices are deduplicated but state changes emit immediately',()=>{
 const tracker=new RoomSpeechOriginTracker({repeatMs:30000});
 const recorded=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),voiceMatch:{matched:false,similarity:.2},
  association:{participantId:null,trackId:null,bodyConfirmed:false},
  roomTracks:[],now:2000
 });
 assert.equal(tracker.observe(recorded,2000).emit,true);
 assert.equal(tracker.observe(recorded,5000).emit,false);
 const live=resolveRoomSpeechOrigin({
  mediaActivity:tv(1000),voiceMatch:matchedVoice(),association:bodyAssociation(),
  roomTracks:[track()],audioSource:{state:'available',direction:'center',confidence:.8},
  now:6000
 });
 assert.equal(tracker.observe(live,6000).emit,true);
});

test('V2A runtime enriches live Conversation after transcription instead of gating it',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const processAt=runtime.indexOf('async function processRoomSegment');
 const transcriptAt=runtime.indexOf('await transcribeLiveConversationSegment(segment)',processAt);
 const dispatchAt=runtime.indexOf('dispatchLiveAgentConversationTurn(liveConversationTurn)',transcriptAt);
 const resolveAt=runtime.indexOf('const speechOrigin=resolveRoomSpeechOrigin',dispatchAt);
 const recoverAt=runtime.indexOf('participantContinuity.recoverByVoice',resolveAt);
 assert.ok(processAt>0&&transcriptAt>processAt);
 assert.ok(dispatchAt>transcriptAt,'AGENT receives the live transcript before ROOM origin enrichment');
 assert.ok(resolveAt>dispatchAt,'speech-origin remains a post-transcription ROOM/attribution sidecar');
 assert.ok(recoverAt>resolveAt,'participant continuity recovery remains downstream of origin analysis');
 assert.match(runtime,/!speechOrigin\.allowConversation&&!\(state\.mode==='agent'&&transcript\.trim\(\)\)/);
 assert.match(runtime,/speechOriginState:speechOrigin\.state/);
 assert.match(runtime,/speechOriginMediaKind:speechOrigin\.mediaContext\?\.kind\|\|null/);
 assert.match(runtime,/speechOriginParticipantAttributionAllowed:speechOrigin\.allowParticipantAttribution/);
 assert.match(runtime,/environmentEvidencePromise:evidenceRequest\.promise/);
 assert.match(runtime,/recordedMediaCueFromPredictions/);
 assert.match(runtime,/continuousFusion,/);
 assert.match(runtime,/clearEnvironmentalSpeechEvidence\(\)/);
});

test('V2A deploy and PWA manifests include the resolver',()=>{
 const workflow=fs.readFileSync('.github/workflows/test.yml','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 const pkg=fs.readFileSync('package.json','utf8');
 assert.match(workflow,/src\/speech-origin-core\.js/);
 assert.match(workflow,/resolveRoomSpeechOrigin/);
 assert.match(sw,/\.\/src\/speech-origin-core\.js/);
 assert.match(sw,/\.\/src\/participant-enrollment-core\.js/);
 assert.match(pkg,/node --check src\/speech-origin-core\.js/);
 assert.match(workflow,/package-smoke\/src\/speech-origin-core\.js/);
});

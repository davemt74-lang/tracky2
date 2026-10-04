import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 DIARIZATION_MAX_WINDOWS,SpeakerDiarizationSession,createDiarizationWindows,
 diarizationTurnFields,finalizeDiarization
} from '../src/speaker-diarization-core.js';

const pcm=seconds=>new Float32Array(Math.round(16000*seconds)).fill(.1);

test('12B diarization windows reuse one accepted PCM segment and stay compute-bounded',()=>{
 const windows=createDiarizationWindows(pcm(18),{segmentId:'seg-1'});
 assert.equal(windows.length,DIARIZATION_MAX_WINDOWS);
 assert.equal(windows[0].startOffsetMs,0);
 assert.ok(windows.at(-1).endOffsetMs>=17000);
 assert.ok(windows.every(window=>window.durationMs>=1000&&window.samples instanceof Float32Array));
 assert.equal(createDiarizationWindows(pcm(.7)).length,0);
});

test('12B one speaker remains one stable session-local cluster',()=>{
 const session=new SpeakerDiarizationSession();
 const a=session.assign({embedding:[1,0,0],windowId:'w1',startOffsetMs:0,endOffsetMs:1600});
 const b=session.assign({embedding:[.99,.02,0],windowId:'w2',startOffsetMs:800,endOffsetMs:2400});
 assert.equal(a.speakerClusterId,'D1');
 assert.equal(b.speakerClusterId,'D1');
 const result=finalizeDiarization([a,b],{segmentId:'s1'});
 assert.equal(result.state,'single-speaker');
 assert.equal(result.speakerCount,1);
 assert.equal(result.safeWholeTurnAttribution,true);
});

test('12B sequential different speakers create bounded distinct clusters',()=>{
 const session=new SpeakerDiarizationSession();
 const a=session.assign({embedding:[1,0,0],windowId:'w1',startOffsetMs:0,endOffsetMs:1500});
 const b=session.assign({embedding:[0,1,0],windowId:'w2',startOffsetMs:1500,endOffsetMs:3000});
 const result=finalizeDiarization([a,b]);
 assert.equal(a.speakerClusterId,'D1');
 assert.equal(b.speakerClusterId,'D2');
 assert.equal(result.state,'multi-speaker');
 assert.equal(result.speakerCount,2);
 assert.equal(result.safeWholeTurnAttribution,false);
});

test('12B plausible mixed window becomes unresolved overlap instead of forced speaker identity',()=>{
 const session=new SpeakerDiarizationSession({overlapThreshold:.65,overlapMargin:.08});
 session.assign({embedding:[1,0],windowId:'seed1'});
 session.assign({embedding:[0,1],windowId:'seed2'});
 const mixed=session.assign({embedding:[.707,.707],windowId:'mixed',startOffsetMs:1000,endOffsetMs:2600});
 assert.equal(mixed.state,'overlap-unresolved');
 assert.deepEqual(mixed.candidateClusterIds,['D1','D2']);
 assert.equal(mixed.speakerClusterId,null);
 const result=finalizeDiarization([mixed]);
 assert.equal(result.state,'overlap-unresolved');
 assert.equal(result.overlapObserved,true);
 assert.equal(result.safeWholeTurnAttribution,false);
});

test('12B low-quality windows and cluster-capacity pressure stay unknown',()=>{
 const session=new SpeakerDiarizationSession({maxClusters:2});
 const low=session.assign({embedding:[1,0,0],quality:.2,windowId:'low'});
 assert.equal(low.state,'unknown');
 assert.equal(low.reason,'low-quality-window');
 session.assign({embedding:[1,0,0],windowId:'a'});
 session.assign({embedding:[0,1,0],windowId:'b'});
 const capped=session.assign({embedding:[0,0,1],windowId:'c'});
 assert.equal(capped.state,'unknown');
 assert.equal(capped.reason,'cluster-capacity-reached');
 assert.equal(session.snapshot().clusterCount,2);
});


test('12B forked segment work commits atomically and cancelled work cannot poison session clusters',()=>{
 const session=new SpeakerDiarizationSession();
 session.assign({embedding:[1,0],windowId:'seed'});
 const before=session.snapshot();
 const working=session.fork();
 working.assign({embedding:[0,1],windowId:'cancelled-window'});
 assert.equal(working.snapshot().clusterCount,2);
 assert.equal(session.snapshot().clusterCount,before.clusterCount);
 const committed=session.fork();
 committed.assign({embedding:[.99,.01],windowId:'valid-window'});
 session.commitFrom(committed);
 assert.equal(session.snapshot().clusterCount,1);
 assert.equal(session.snapshot().windowCount,before.windowCount+1);
});

test('12B cancellation cannot yield a speaker-attributable turn',()=>{
 const result=finalizeDiarization([],{segmentId:'s',cancelled:true,reason:'generation-invalidated'});
 assert.equal(result.state,'cancelled');
 assert.equal(result.safeWholeTurnAttribution,false);
 assert.equal(result.reason,'generation-invalidated');
});

test('12B persistent turn fields contain bounded cluster spans but no embeddings or PCM',()=>{
 const session=new SpeakerDiarizationSession();
 const a=session.assign({embedding:[1,0],windowId:'w1',startOffsetMs:0,endOffsetMs:1600});
 const fields=diarizationTurnFields(finalizeDiarization([a]));
 const json=JSON.stringify(fields);
 assert.equal(fields.diarizationSpeakerCount,1);
 assert.ok(fields.diarizationSpans.length<=12);
 for(const forbidden of ['embedding','samples','pcm','rawAudio'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('12B runtime uses the existing VoiceIdentityEngine and existing room segment without a second microphone',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const audio=fs.readFileSync('src/room-audio-engine.js','utf8');
 const core=fs.readFileSync('src/speaker-diarization-core.js','utf8');
 assert.match(runtime,/createDiarizationWindows\(segment\.samples/);
 assert.match(runtime,/working\.assign\(/);
 assert.match(runtime,/diarizationTurnFields\(/);
 assert.equal((runtime.match(/new RoomAudioCapture\(/g)||[]).length,1);
 assert.equal((audio.match(/getUserMedia\(/g)||[]).length,1);
 assert.doesNotMatch(core,/getUserMedia|AudioContext|MediaRecorder|indexedDB|localStorage|fetch\(|WebSocket/);
});

test('12B multi-speaker or overlap result suppresses legacy whole-turn speaker attribution',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/diarization\.safeWholeTurnAttribution/);
 assert.match(runtime,/diarization-suppressed-whole-turn-attribution/);
 assert.match(runtime,/overlapEvidence:diarization\.overlapObserved/);
});

test('12B multi-conversation policy abstains on sequential multi-speaker turns as well as overlap',()=>{
 const multi=fs.readFileSync('src/multi-conversation-core.js','utf8');
 assert.match(multi,/multi-speaker-unresolved/);
 assert.match(multi,/diarizationSpeakerCount/);
 assert.match(multi,/multiple speakers in one captured turn/);
});

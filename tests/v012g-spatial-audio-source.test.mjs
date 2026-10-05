import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 aggregateAudioSourceEvidence,fuseSpatialAudioSource,normalizeStereoSourceFrame,
 spatialAudioSourceTurnFields,visualSpatialSourceEvidence
} from '../src/spatial-audio-source-core.js';

const stereo=(left,right)=>({channelCount:2,leftRms:left,rightRms:right});
const track=(x=.5,extra={})=>({
 id:'t1',participantId:'p1',status:'matched',cx:x,
 box:{x:x-.05,y:.3,width:.1,height:.25},...extra
});
const calibration={
 mode:'floor-plane',widthM:4,depthM:6,
 points:{nearLeft:{x:.05,y:.92},nearRight:{x:.95,y:.92},
  farRight:{x:.72,y:.22},farLeft:{x:.28,y:.22}},
 listener:{xM:2,depthM:0},updatedAt:1000
};

test('12G mono or unavailable source explicitly abstains from audio direction',()=>{
 const mono=normalizeStereoSourceFrame({channelCount:1,leftRms:.2});
 assert.equal(mono.state,'unavailable');
 assert.equal(mono.direction,'unavailable');
 const aggregate=aggregateAudioSourceEvidence([]);
 assert.equal(aggregate.state,'unavailable');
});

test('12G stable stereo energy produces bounded left/right contextual direction',()=>{
 const left=aggregateAudioSourceEvidence(Array.from({length:12},()=>stereo(.4,.12)));
 assert.equal(left.state,'available');
 assert.equal(left.direction,'left');
 assert.ok(left.confidence>0&&left.confidence<=1);
 const right=aggregateAudioSourceEvidence(Array.from({length:12},()=>stereo(.1,.35)));
 assert.equal(right.direction,'right');
});

test('12G varying stereo evidence becomes uncertain instead of forcing a source',()=>{
 const frames=[];
 for(let i=0;i<12;i++)frames.push(i%2?stereo(.4,.08):stereo(.08,.4));
 const result=aggregateAudioSourceEvidence(frames);
 assert.equal(result.state,'uncertain');
 assert.equal(result.direction,'uncertain');
});

test('12G calibrated visual position exposes approximate metric bearing and distance',()=>{
 const visual=visualSpatialSourceEvidence({calibration,track:track(.3)});
 assert.equal(visual.state,'available');
 assert.equal(visual.metric,true);
 assert.equal(visual.coordinateSpace,'owner-calibrated-floor-plane');
 assert.ok(Number.isFinite(visual.distanceM));
 assert.ok(Number.isFinite(visual.bearingDeg));
});

test('12G uncalibrated visual position remains camera-relative and non-metric',()=>{
 const visual=visualSpatialSourceEvidence({calibration:null,track:track(.2)});
 assert.equal(visual.state,'available');
 assert.equal(visual.direction,'left');
 assert.equal(visual.metric,false);
 assert.equal(visual.distanceM,null);
 assert.equal(visual.coordinateSpace,'camera-relative');
});

test('12G audio/visual directional agreement is context, never identity authority',()=>{
 const audio=aggregateAudioSourceEvidence(Array.from({length:8},()=>stereo(.4,.1)));
 const visual=visualSpatialSourceEvidence({track:track(.2)});
 const fused=fuseSpatialAudioSource({audioEvidence:audio,visualEvidence:visual});
 assert.equal(fused.state,'audio-visual-agreement');
 assert.equal(fused.direction,'left');
 const fields=spatialAudioSourceTurnFields(fused);
 assert.equal(fields.spatialAudioAgreement,true);
 assert.equal('participantId' in fields,false);
});

test('12G conflicting directional cues are explicit and do not silently move the source',()=>{
 const audio=aggregateAudioSourceEvidence(Array.from({length:8},()=>stereo(.1,.4)));
 const visual=visualSpatialSourceEvidence({track:track(.2)});
 const fused=fuseSpatialAudioSource({audioEvidence:audio,visualEvidence:visual});
 assert.equal(fused.state,'audio-visual-conflict');
 assert.equal(fused.direction,'uncertain');
 assert.equal(fused.conflict,'audio-visual-direction-conflict');
});

test('12G mirrored camera presentation does not flip raw physical source evidence',()=>{
 const rawTrack=track(.2);
 const unmirrored=visualSpatialSourceEvidence({track:rawTrack});
 const mirroredPresentationOnly=visualSpatialSourceEvidence({track:rawTrack,cameraMirrored:true});
 assert.deepEqual(mirroredPresentationOnly,unmirrored);
 assert.equal(unmirrored.direction,'left');
});

test('12G visual-only fallback remains usable when stereo source is unavailable',()=>{
 const visual=visualSpatialSourceEvidence({track:track(.8)});
 const fused=fuseSpatialAudioSource({
  audioEvidence:aggregateAudioSourceEvidence([]),visualEvidence:visual
 });
 assert.equal(fused.state,'visual-only');
 assert.equal(fused.direction,'right');
 assert.equal(fused.audioDirection,'unavailable');
});

test('12G shared microphone engine prefers stereo but preserves one mono conversation PCM path',()=>{
 const engine=fs.readFileSync('src/room-audio-engine.js','utf8');
 const worklet=fs.readFileSync('src/room-audio-worklet.js','utf8');
 assert.match(engine,/channelCount:\s*\{\s*ideal:\s*2\s*\}/);
 assert.match(engine,/inputChannelCount/);
 assert.match(engine,/aggregateAudioSourceEvidence\(/);
 assert.match(engine,/audioSource/);
 assert.match(worklet,/leftRms/);
 assert.match(worklet,/rightRms/);
 assert.equal((engine.match(/getUserMedia\(/g)||[]).length,1);
});

test('12G runtime stores only bounded spatial-audio metadata on canonical turns',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/visualSpatialSourceEvidence\(/);
 assert.match(runtime,/fuseSpatialAudioSource\(/);
 assert.match(runtime,/spatialAudioSourceTurnFields\(/);
 assert.match(runtime,/\.\.\.spatialAudioFields/);
 const fields=fs.readFileSync('src/spatial-audio-source-core.js','utf8');
 assert.doesNotMatch(fields,/localStorage|indexedDB|MediaRecorder|getUserMedia|fetch\(|WebSocket/);
});

test('12G pure spatial-audio core has no sensor, storage, network or identity authority',()=>{
 const core=fs.readFileSync('src/spatial-audio-source-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
 assert.doesNotMatch(core,/voice-profile|face-identity|identity-primary/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 OVERLAP_SEPARATION_MAX_SOURCES,analyzeStereoSeparationInput,
 overlapSeparationTurnFields,resolveSeparatedSpeakerMatches,separateStereoOverlap
} from '../src/overlap-source-separation-core.js';

function syntheticStereo({sampleRate=16000,seconds=2,cross=.24}={}){
 const n=Math.floor(sampleRate*seconds),left=new Float32Array(n),right=new Float32Array(n);
 for(let i=0;i<n;i++){
  const t=i/sampleRate,phase=Math.floor(t/.25)%2;
  const a=Math.sin(2*Math.PI*220*t)*.34*(phase===0?1:.3);
  const b=Math.sin(2*Math.PI*410*t)*.32*(phase===1?1:.3);
  left[i]=a+cross*b;right[i]=cross*a+b;
 }
 return {left,right,sampleRate};
}

test('13B clean two-source stereo overlap yields two transient source estimates',()=>{
 const input=syntheticStereo();
 const analysis=analyzeStereoSeparationInput({...input,expectedSpeakers:2});
 assert.equal(analysis.state,'separable');
 assert.ok(analysis.quality>=.56);
 const result=separateStereoOverlap(input,{expectedSpeakers:2});
 assert.equal(result.state,'separated');
 assert.equal(result.sourceCount,2);
 assert.equal(result.sources.length,2);
 assert.equal(result.sources[0].samples.length,input.left.length);
 assert.notDeepEqual(
  Array.from(result.sources[0].samples.slice(0,100)),
  Array.from(result.sources[1].samples.slice(0,100))
 );
});

test('13B identical stereo channels remain weak/unresolved rather than fabricating sources',()=>{
 const n=32000,left=new Float32Array(n);
 for(let i=0;i<n;i++)left[i]=Math.sin(2*Math.PI*220*i/16000)*.3;
 const result=separateStereoOverlap({left,right:Float32Array.from(left),sampleRate:16000});
 assert.notEqual(result.state,'separated');
 assert.equal(result.sourceCount,0);
 assert.match(result.reason,/correlated|bilateral|diversity|quality/);
});

test('13B mono/unavailable separation input explicitly abstains',()=>{
 const result=separateStereoOverlap({left:new Float32Array(16000),right:null,sampleRate:16000});
 assert.equal(result.state,'unavailable');
 assert.equal(result.reason,'stereo-pcm-unavailable');
});

test('13B three-speaker request is refused rather than forced through two-source model',()=>{
 const input=syntheticStereo();
 const result=separateStereoOverlap(input,{expectedSpeakers:3});
 assert.equal(result.state,'refused');
 assert.equal(result.reason,'more-than-two-speakers');
 assert.equal(OVERLAP_SEPARATION_MAX_SOURCES,2);
});

test('13B silence and weak signal remain unavailable',()=>{
 const result=separateStereoOverlap({
  left:new Float32Array(32000),right:new Float32Array(32000),sampleRate:16000
 });
 assert.equal(result.state,'unavailable');
 assert.equal(result.reason,'signal-too-weak');
});

test('13B distinct separated voice matches expose two participant candidates without choosing one turn owner',()=>{
 const separation=separateStereoOverlap(syntheticStereo());
 const resolved=resolveSeparatedSpeakerMatches(separation,[
  {matched:true,participant:{id:'p1'},similarity:.91,margin:.18},
  {matched:true,participant:{id:'p2'},similarity:.89,margin:.16}
 ]);
 assert.equal(resolved.state,'separated-verified');
 assert.deepEqual(resolved.participantIds,['p1','p2']);
 const fields=overlapSeparationTurnFields(separation,resolved);
 assert.deepEqual(fields.overlapSeparationParticipantIds,['p1','p2']);
 assert.equal('participantId' in fields,false);
 assert.equal(fields.overlapSeparationSources.length,2);
 const json=JSON.stringify(fields);
 for(const forbidden of ['samples','left','right','pcm','rawAudio','embedding'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('13B same participant on both estimates is ambiguous and cannot duplicate identity',()=>{
 const separation=separateStereoOverlap(syntheticStereo());
 const resolved=resolveSeparatedSpeakerMatches(separation,[
  {matched:true,participant:{id:'p1'},similarity:.9,margin:.2},
  {matched:true,participant:{id:'p1'},similarity:.87,margin:.14}
 ]);
 assert.equal(resolved.state,'ambiguous-same-participant');
 assert.deepEqual(resolved.participantIds,[]);
 assert.ok(resolved.sources.every(source=>source.participantId===null));
});

test('13B RoomAudioCapture keeps one microphone and carries stereo PCM only transiently',()=>{
 const engine=fs.readFileSync('src/room-audio-engine.js','utf8');
 const worklet=fs.readFileSync('src/room-audio-worklet.js','utf8');
 assert.equal((engine.match(/getUserMedia\(/g)||[]).length,1);
 assert.match(engine,/stereoFrames/);
 assert.match(engine,/separationInput/);
 assert.match(worklet,/leftSamples/);
 assert.match(worklet,/rightSamples/);
});

test('13B runtime separates only after canonical overlap evidence and preserves generation cancellation',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const diarize=runtime.indexOf('const diarization=await diarizeRoomSegment');
 const separate=runtime.indexOf('separateStereoOverlap(');
 assert.ok(diarize>0&&separate>diarize);
 assert.match(runtime,/if\(!voiceSegmentIsCurrent\(segment\)\).*outcome='cancelled'/s);
 assert.match(runtime,/resolveSeparatedSpeakerMatches/);
 assert.match(runtime,/overlapSeparationTurnFields/);
});

test('13B environmental classifier never receives transient stereo separation input',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const start=runtime.indexOf('function onRoomAudioSegment');
 const end=runtime.indexOf('function transcriptParticipantName',start);
 const block=runtime.slice(start,end);
 assert.match(block,/const \{separationInput,\.\.\.environmentSegment\}=segment/);
 assert.match(block,/queueEnvironmentalAudio\(environmentSegment\)/);
});

test('13B canonical transcript persistence/export excludes transient source PCM',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const transcript=fs.readFileSync('src/transcript-lifecycle-core.js','utf8');
 const saveStart=runtime.indexOf('savedTurn = await saveDialogueTurn');
 const saveBlock=runtime.slice(Math.max(0,saveStart-8500),saveStart+1000);
 assert.doesNotMatch(saveBlock,/separationInput\.left|separationInput\.right/);
 assert.doesNotMatch(store,/separationInput/);
 const exportStart=transcript.indexOf('export function transcriptExport');
 assert.doesNotMatch(transcript.slice(exportStart),/separationInput|source\.samples/);
});

test('13B pure separation core opens no sensor, storage, model, transcript or network authority',()=>{
 const core=fs.readFileSync('src/overlap-source-separation-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|transcrib|saveDialogue|embedding\(/);
});

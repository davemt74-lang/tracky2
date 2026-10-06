import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 PERSONALIZED_SOUND_VECTOR_LENGTH,PersonalizedSoundRecognitionTracker,
 acousticFeatureSignature,appendPersonalizedSoundExample,
 createPersonalizedSoundProfile,matchPersonalizedSound,
 personalizedSoundCategoryEligible,personalizedSoundLearningEligibility,
 personalizedSoundMessage,personalizedSoundSimilarity
} from '../src/personalized-sound-core.js';

function tone(freq=500,seconds=1,sampleRate=16000,amplitude=.35){
 const out=new Float32Array(Math.round(seconds*sampleRate));
 for(let i=0;i<out.length;i++)
  out[i]=amplitude*Math.sin(2*Math.PI*freq*i/sampleRate);
 return out;
}

test('V2E acoustic signature is bounded numeric metadata and contains no raw PCM',()=>{
 const signature=acousticFeatureSignature(tone(500),{sampleRate:16000,at:1000});
 assert.ok(signature);
 assert.equal(signature.vector.length,PERSONALIZED_SOUND_VECTOR_LENGTH);
 assert.equal(signature.sampleRateBucket,16000);
 assert.ok(signature.vector.every(value=>value>=0&&value<=1));
 assert.equal('samples' in signature,false);
 assert.equal('audio' in signature,false);
 assert.equal(JSON.stringify(signature).includes('Float32Array'),false);
});

test('V2E personalized profile requires two owner-labeled examples before recognition',()=>{
 const sig=acousticFeatureSignature(tone(500),{at:1000});
 let profile=createPersonalizedSoundProfile({
  id:'coffee',label:'Coffee grinder',signature:sig,at:1000
 });
 assert.equal(profile.ready,false);
 assert.equal(matchPersonalizedSound(sig,[profile]).matched,false);
 profile=appendPersonalizedSoundExample(profile,sig,2000);
 assert.equal(profile.ready,true);
 const match=matchPersonalizedSound(sig,[profile]);
 assert.equal(match.matched,true);
 assert.equal(match.profile.label,'Coffee grinder');
 assert.equal(match.similarity,1);
});

test('V2E same acoustic signature cannot choose between two equally strong owner labels',()=>{
 const sig=acousticFeatureSignature(tone(1000),{at:1000});
 const ready=(id,label)=>appendPersonalizedSoundExample(
  createPersonalizedSoundProfile({id,label,signature:sig,at:1000}),sig,2000
 );
 const match=matchPersonalizedSound(sig,[
  ready('a','Blender'),ready('b','Food processor')
 ]);
 assert.equal(match.matched,false);
 assert.equal(match.reason,'ambiguous-profile');
});

test('V2E similarity is deterministic and decreases for materially different acoustic features',()=>{
 const a=acousticFeatureSignature(tone(500),{at:1000});
 const same=acousticFeatureSignature(tone(500),{at:2000});
 const other=acousticFeatureSignature(tone(3000),{at:2000});
 assert.equal(personalizedSoundSimilarity(a,same),1);
 assert.ok(personalizedSoundSimilarity(a,other)<1);
});

test('V2E learning gate rejects speech-sensitive and stale windows',()=>{
 const sig=acousticFeatureSignature(tone(500),{at:1000});
 assert.equal(personalizedSoundLearningEligibility({
  signature:sig,at:1000,now:2000,speechSensitive:true
 }).reason,'speech-sensitive-window');
 assert.equal(personalizedSoundLearningEligibility({
  signature:sig,at:1000,now:40000
 }).reason,'signature-stale');
 assert.equal(personalizedSoundLearningEligibility({
  signature:sig,at:1000,now:2000
 }).allow,true);
});

test('V2E canonical safety/media categories keep authority over personalized labels',()=>{
 for(const category of ['alarm','impact-crowd','music','media-playback','room-voice-activity','observable-human-acoustic'])
  assert.equal(personalizedSoundCategoryEligible({category}),false,category);
 for(const category of ['household-mechanical','animal','transport','weather-water'])
  assert.equal(personalizedSoundCategoryEligible({category}),true,category);
});

test('V2E recognition notifications are locally deduplicated',()=>{
 const sig=acousticFeatureSignature(tone(500),{at:1000});
 let profile=createPersonalizedSoundProfile({id:'coffee',label:'Coffee grinder',signature:sig,at:1000});
 profile=appendPersonalizedSoundExample(profile,sig,2000);
 const match=matchPersonalizedSound(sig,[profile]);
 const tracker=new PersonalizedSoundRecognitionTracker({cooldownMs:15000});
 let result=tracker.observe(match,3000);
 assert.equal(result.emit,true);
 assert.match(personalizedSoundMessage(result),/Coffee grinder/);
 assert.equal(tracker.observe(match,5000).emit,false);
 assert.equal(tracker.observe(match,19000).emit,true);
});

test('V2E runtime keeps signatures out of ROOM history and can match otherwise-unclassified non-speech windows',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const logAt=runtime.indexOf('function logPersonalizedSoundMatch');
 const evalAt=runtime.indexOf('function evaluatePersonalizedSound');
 const alertAt=runtime.indexOf('function logEnvironmentalAlertResult');
 const logBlock=runtime.slice(logAt,evalAt);
 assert.match(logBlock,/semantic:'personalized-sound-recognized'/);
 assert.match(logBlock,/ownerLabeled:true,localOnly:true,rawAudioStored:false/);
 assert.doesNotMatch(logBlock,/vector|signature|samples/);
 const rejectAt=runtime.indexOf('if(!normalized.accepted)');
 const classificationAt=runtime.indexOf('const classification=calibrateEnvironmentalClassification',rejectAt);
 const rejectBlock=runtime.slice(rejectAt,classificationAt);
 assert.match(rejectBlock,/evaluatePersonalizedSound\(personalizedSignature/);
 assert.match(rejectBlock,/speechSensitive/);
 assert.ok(alertAt>evalAt);
 assert.match(runtime,/importantEnvironmentalEventsEnabled&&!personalized\.matched/);
});

test('V2E Control Center is opt-in and documents two-example local-only learning',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(html,/id="roomPersonalizedSounds"/);
 assert.doesNotMatch(html,/id="roomPersonalizedSounds" checked/);
 assert.match(html,/Two labeled examples are required before automatic recognition/);
 assert.match(html,/never raw room audio, transcripts, camera data or participant identity/);
 assert.match(html,/id="roomTeachLatestSound"/);
 assert.match(html,/id="roomClearPersonalizedSounds"/);
 assert.match(runtime,/savedPersonalized==='yes'/);
 assert.match(runtime,/teachLatestPersonalizedSound/);
});


test('V2E IndexedDB schema stores only bounded personalized profiles in its own local store',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(store,/const DB_VERSION = 16/);
 assert.match(store,/const PERSONALIZED_SOUNDS = 'personalized-sounds'/);
 assert.match(store,/MAX_PERSISTED_PERSONALIZED_SOUNDS=32/);
 assert.match(store,/normalizePersonalizedSoundProfile/);
 assert.match(store,/listPersonalizedSoundProfiles/);
 assert.match(store,/savePersonalizedSoundProfile/);
 assert.match(store,/deletePersonalizedSoundProfile/);
 assert.match(store,/clearPersonalizedSoundProfiles/);
 const start=store.indexOf('/* V0.14.8F owner-labeled local acoustic profiles.');
 const end=store.indexOf('/* V0.13G owner review metadata only.',start);
 const block=store.slice(start,end);
 assert.doesNotMatch(block,/MediaRecorder|getUserMedia|Blob|ArrayBuffer|transcript:/);
});

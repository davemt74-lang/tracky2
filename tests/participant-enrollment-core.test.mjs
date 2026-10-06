import test from 'node:test';
import assert from 'node:assert/strict';
import {
 emptyVoiceDraft,normalizeVoiceDraft,appendVoiceDraftSample,voiceDraftSaveFields,
 MAX_VOICE_PROFILE_SAMPLES
} from '../src/participant-enrollment-core.js';

const sample=(seconds=5)=>({
 durationSeconds:seconds,peakDb:-18,avgDb:-31,noiseFloorDb:-49,signalDb:31,speechFraction:.72
});

test('create-participant voice enrollment builds a draft before any participant ID exists',()=>{
 let draft=emptyVoiceDraft();
 for(let i=0;i<3;i++){
  const result=appendVoiceDraftSample(draft,{
   embedding:[1,0,0],sample:sample(),recognitionEnabled:true,
   updatedAt:'2026-10-06T01:00:0'+i+'Z'
  });
  assert.equal(result.accepted,true);
  draft=result.profile;
 }
 assert.equal(draft.voiceEmbeddings.length,3);
 assert.equal(draft.voiceProfileSamples.length,3);
 assert.equal(draft.voiceProfileReady,true);
 assert.equal(voiceDraftSaveFields(draft).voiceProfileReady,true);
});

test('draft Voice Profile rejects a different speaker without corrupting accepted samples',()=>{
 const first=appendVoiceDraftSample(emptyVoiceDraft(),{embedding:[1,0],sample:sample()}).profile;
 const rejected=appendVoiceDraftSample(first,{embedding:[0,1],sample:sample()});
 assert.equal(rejected.accepted,false);
 assert.equal(rejected.reason,'speaker-mismatch');
 assert.equal(rejected.profile.voiceEmbeddings.length,1);
});

test('draft Voice Profile is bounded and normalized before participant persistence',()=>{
 let draft=emptyVoiceDraft();
 for(let i=0;i<MAX_VOICE_PROFILE_SAMPLES+3;i++)
  draft=appendVoiceDraftSample(draft,{embedding:[1,0],sample:sample()}).profile;
 const safe=normalizeVoiceDraft(draft);
 assert.equal(safe.voiceEmbeddings.length,MAX_VOICE_PROFILE_SAMPLES);
 assert.equal(safe.voiceProfileSamples.length,MAX_VOICE_PROFILE_SAMPLES);
 assert.equal(safe.voiceProfileReady,true);
});

test('empty voice draft contributes no participant save fields',()=>{
 assert.deepEqual(voiceDraftSaveFields(emptyVoiceDraft()),{});
});

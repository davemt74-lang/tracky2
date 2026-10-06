import {voiceProfileReadiness,voiceEnrollmentConsistency} from './voice-core.js';

export const MAX_VOICE_PROFILE_SAMPLES=5;

export function emptyVoiceDraft(){
 return {
  voiceEmbeddings:[],
  voiceProfileSamples:[],
  voiceProfileReady:false,
  voiceRecognitionEnabled:true,
  voiceUpdatedAt:null
 };
}

function cloneEmbedding(value){
 return Array.isArray(value)?value.map(Number).filter(Number.isFinite):[];
}

export function normalizeVoiceDraft(input={}){
 const embeddings=(Array.isArray(input.voiceEmbeddings)?input.voiceEmbeddings:[])
  .map(cloneEmbedding).filter(row=>row.length).slice(-MAX_VOICE_PROFILE_SAMPLES);
 const samples=(Array.isArray(input.voiceProfileSamples)?input.voiceProfileSamples:[])
  .map(sample=>({
   durationSeconds:Math.max(0,Number(sample?.durationSeconds)||0),
   peakDb:Number.isFinite(sample?.peakDb)?Number(sample.peakDb):null,
   avgDb:Number.isFinite(sample?.avgDb)?Number(sample.avgDb):null,
   noiseFloorDb:Number.isFinite(sample?.noiseFloorDb)?Number(sample.noiseFloorDb):null,
   signalDb:Number.isFinite(sample?.signalDb)?Number(sample.signalDb):null,
   speechFraction:Number.isFinite(sample?.speechFraction)?Number(sample.speechFraction):null,
   consistency:Number.isFinite(sample?.consistency)?Number(sample.consistency):null,
   createdAt:typeof sample?.createdAt==='string'?sample.createdAt:null
  })).slice(-MAX_VOICE_PROFILE_SAMPLES);
 const readiness=voiceProfileReadiness({voiceEmbeddings:embeddings,voiceProfileSamples:samples});
 return {
  voiceEmbeddings:embeddings,
  voiceProfileSamples:samples,
  voiceProfileReady:readiness.ready,
  voiceRecognitionEnabled:input.voiceRecognitionEnabled!==false,
  voiceUpdatedAt:typeof input.voiceUpdatedAt==='string'?input.voiceUpdatedAt:null
 };
}

export function appendVoiceDraftSample(input,{embedding,sample,recognitionEnabled=true,updatedAt=new Date().toISOString()}={}){
 const current=normalizeVoiceDraft(input);
 const safeEmbedding=cloneEmbedding(embedding);
 if(!safeEmbedding.length)throw new TypeError('Voice embedding is required.');
 const consistency=voiceEnrollmentConsistency(safeEmbedding,current.voiceEmbeddings);
 if(!consistency.accept)return {accepted:false,reason:'speaker-mismatch',similarity:consistency.similarity,profile:current};
 const profile=normalizeVoiceDraft({
  ...current,
  voiceEmbeddings:[...current.voiceEmbeddings,safeEmbedding].slice(-MAX_VOICE_PROFILE_SAMPLES),
  voiceProfileSamples:[...current.voiceProfileSamples,{...(sample||{}),consistency:consistency.similarity,createdAt:sample?.createdAt||updatedAt}]
   .slice(-MAX_VOICE_PROFILE_SAMPLES),
  voiceRecognitionEnabled:recognitionEnabled,
  voiceUpdatedAt:updatedAt
 });
 return {accepted:true,reason:'saved',similarity:consistency.similarity,profile};
}

export function voiceDraftSaveFields(input={}){
 const draft=normalizeVoiceDraft(input);
 return draft.voiceEmbeddings.length||draft.voiceProfileSamples.length?draft:{};
}

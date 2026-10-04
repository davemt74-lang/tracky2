import {
 TRANSFORMERS_ESM_URL,ENVIRONMENT_AUDIO_MODEL_ID,ENVIRONMENT_AUDIO_MODEL_REVISION
} from './model-config.js';

let transformersPromise=null;
async function transformers(){
 if(!transformersPromise){
  transformersPromise=import(TRANSFORMERS_ESM_URL).then(module=>{
   module.env.allowLocalModels=false;
   module.env.useBrowserCache=true;
   return module;
  });
 }
 return transformersPromise;
}

export class LocalEnvironmentalAudioClassifier{
 constructor(){
  this.classifier=null;this.loading=null;this.ready=false;this.lastError=null;
 }
 async init(){
  if(this.ready)return this;
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   try{
    const T=await transformers();
    this.classifier=await T.pipeline(
     'audio-classification',
     ENVIRONMENT_AUDIO_MODEL_ID,
     {dtype:'q8',revision:ENVIRONMENT_AUDIO_MODEL_REVISION}
    );
    this.ready=true;this.lastError=null;return this;
   }catch(error){
    this.ready=false;this.lastError=error;throw error;
   }finally{this.loading=null;}
  })();
  return this.loading;
 }
 async classify(samples,{topK=8}={}){
  if(!samples?.length)throw new Error('Environmental classifier requires PCM samples.');
  if(!this.ready)await this.init();
  const startedAt=Date.now();
  const rows=await this.classifier(samples,{top_k:Math.max(2,Math.min(12,Math.floor(topK)||8))});
  const completedAt=Date.now();
  return Object.freeze({
   predictions:(Array.isArray(rows)?rows:[]).map(item=>Object.freeze({
    label:String(item?.label||'').slice(0,120),
    score:Number(item?.score)
   })),
   source:'local-audioset-classifier',
   modelId:ENVIRONMENT_AUDIO_MODEL_ID,
   modelRevision:ENVIRONMENT_AUDIO_MODEL_REVISION,
   startedAt,completedAt,
   processingDurationMs:Math.max(0,completedAt-startedAt)
  });
 }
}

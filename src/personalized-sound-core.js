const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=(v,n=64)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const PERSONALIZED_SOUND_SCHEMA=1;
export const PERSONALIZED_SOUND_VECTOR_LENGTH=22;
export const PERSONALIZED_SOUND_MAX_EXAMPLES=5;
export const PERSONALIZED_SOUND_READY_EXAMPLES=2;
export const PERSONALIZED_SOUND_MATCH_THRESHOLD=.93;
export const PERSONALIZED_SOUND_MATCH_MARGIN=.035;
export const PERSONALIZED_SOUND_LEARNING_MAX_AGE_MS=30000;
export const PERSONALIZED_SOUND_EMIT_COOLDOWN_MS=60000;

function boundedSamples(samples,max=8192){
 if(!samples?.length)return null;
 const n=Math.min(max,samples.length);
 const start=Math.max(0,Math.floor((samples.length-n)/2));
 const out=new Float32Array(n);
 for(let i=0;i<n;i++){
  const value=Number(samples[start+i]);
  out[i]=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
 }
 return out;
}
function rms(samples,start=0,end=samples.length){
 if(end<=start)return 0;
 let sum=0;
 for(let i=start;i<end;i++){const v=samples[i];sum+=v*v;}
 return Math.sqrt(sum/(end-start));
}
function goertzel(samples,sampleRate,frequency){
 const n=samples.length;
 if(!n||frequency<=0||frequency>=sampleRate/2)return 0;
 const omega=2*Math.PI*frequency/sampleRate;
 const coeff=2*Math.cos(omega);
 let s0=0,s1=0,s2=0;
 for(let i=0;i<n;i++){
  const window=.5-.5*Math.cos(2*Math.PI*i/Math.max(1,n-1));
  s0=samples[i]*window+coeff*s1-s2;s2=s1;s1=s0;
 }
 const power=Math.max(0,s1*s1+s2*s2-coeff*s1*s2);
 return Math.sqrt(power)/Math.max(1,n);
}
function autocorrelation(samples,lag){
 if(lag<=0||lag>=samples.length)return 0;
 let cross=0,a=0,b=0;
 for(let i=lag;i<samples.length;i++){
  const x=samples[i],y=samples[i-lag];
  cross+=x*y;a+=x*x;b+=y*y;
 }
 if(a<=1e-12||b<=1e-12)return 0;
 return Math.max(-1,Math.min(1,cross/Math.sqrt(a*b)));
}
export function acousticFeatureSignature(samples,{sampleRate=16000,at=Date.now()}={}){
 const signal=boundedSamples(samples);
 if(!signal||signal.length<1024)return null;
 const rate=Math.max(8000,Math.min(96000,Number(sampleRate)||16000));
 const overall=rms(signal);
 if(overall<.002)return null;
 let peak=0,crossings=0;
 for(let i=0;i<signal.length;i++){
  peak=Math.max(peak,Math.abs(signal[i]));
  if(i&&((signal[i]>=0)!==(signal[i-1]>=0)))crossings++;
 }
 const zcr=crossings/Math.max(1,signal.length-1);
 const crest=peak/Math.max(overall,1e-6);
 const vector=[
  clamp(zcr*4),
  clamp((crest-1)/9)
 ];
 const chunks=8;
 for(let part=0;part<chunks;part++){
  const start=Math.floor(signal.length*part/chunks);
  const end=Math.floor(signal.length*(part+1)/chunks);
  vector.push(clamp(rms(signal,start,end)/Math.max(overall*2,1e-6)));
 }
 for(const ms of [1,2,4,8]){
  const lag=Math.max(1,Math.round(rate*ms/1000));
  vector.push(clamp((autocorrelation(signal,lag)+1)/2));
 }
 const frequencies=[125,250,500,1000,2000,3000,4000,6000].filter(f=>f<rate/2*.92);
 const energies=frequencies.map(f=>goertzel(signal,rate,f));
 while(energies.length<8)energies.push(0);
 const total=energies.reduce((a,b)=>a+b,0)||1;
 for(const value of energies.slice(0,8))vector.push(clamp(value/total*3));
 if(vector.length!==PERSONALIZED_SOUND_VECTOR_LENGTH)return null;
 return Object.freeze({
  schema:PERSONALIZED_SOUND_SCHEMA,
  vector:Object.freeze(vector.map(v=>Number(clamp(v).toFixed(5)))),
  at:finite(at)?at:Date.now(),
  sampleRateBucket:rate<12000?8000:rate<24000?16000:rate<60000?48000:96000
 });
}

function normalizeVector(input){
 const values=Array.isArray(input)?input:Array.from(input||[]);
 if(values.length!==PERSONALIZED_SOUND_VECTOR_LENGTH)return null;
 const out=values.map(Number);
 if(out.some(v=>!finite(v)||v<0||v>1))return null;
 return Object.freeze(out.map(v=>Number(v.toFixed(5))));
}
export function normalizePersonalizedSoundExample(input={}){
 const vector=normalizeVector(input.vector);
 if(!vector)throw new TypeError('Invalid personalized sound feature vector.');
 return Object.freeze({
  vector,at:finite(input.at)?input.at:Date.now(),
  sampleRateBucket:[8000,16000,48000,96000].includes(Number(input.sampleRateBucket))
   ?Number(input.sampleRateBucket):16000
 });
}
export function normalizePersonalizedSoundProfile(input={}){
 const label=clean(input.label,48);
 if(label.length<2)throw new TypeError('Personalized sound label must be 2-48 characters.');
 const id=clean(input.id,96);
 if(!id)throw new TypeError('Personalized sound profile ID required.');
 const examples=(Array.isArray(input.examples)?input.examples:[])
  .slice(-PERSONALIZED_SOUND_MAX_EXAMPLES).map(normalizePersonalizedSoundExample);
 if(!examples.length)throw new TypeError('Personalized sound profile needs an example.');
 const createdAt=finite(input.createdAt)?input.createdAt:examples[0].at;
 const updatedAt=finite(input.updatedAt)?input.updatedAt:examples.at(-1).at;
 return Object.freeze({
  schema:PERSONALIZED_SOUND_SCHEMA,id,label,
  examples:Object.freeze(examples),createdAt,updatedAt,
  ready:examples.length>=PERSONALIZED_SOUND_READY_EXAMPLES
 });
}
export function appendPersonalizedSoundExample(profile,signature,at=Date.now()){
 const prior=normalizePersonalizedSoundProfile(profile);
 const example=normalizePersonalizedSoundExample(signature);
 return normalizePersonalizedSoundProfile({
  ...prior,examples:[...prior.examples,example].slice(-PERSONALIZED_SOUND_MAX_EXAMPLES),
  updatedAt:finite(at)?at:Date.now()
 });
}
export function createPersonalizedSoundProfile({
 id,label,signature,at=Date.now()
}={}){
 return normalizePersonalizedSoundProfile({
  id,label,examples:[normalizePersonalizedSoundExample(signature)],
  createdAt:at,updatedAt:at
 });
}

function vectorDistance(a,b){
 let sum=0;
 for(let i=0;i<PERSONALIZED_SOUND_VECTOR_LENGTH;i++){
  const d=a[i]-b[i];sum+=d*d;
 }
 return Math.sqrt(sum/PERSONALIZED_SOUND_VECTOR_LENGTH);
}
export function personalizedSoundSimilarity(a,b){
 const va=normalizeVector(a?.vector||a),vb=normalizeVector(b?.vector||b);
 if(!va||!vb)return 0;
 return Number(clamp(1-vectorDistance(va,vb)).toFixed(5));
}
function profileSimilarity(signature,profile){
 const p=normalizePersonalizedSoundProfile(profile);
 if(!p.ready)return 0;
 const scores=p.examples.map(example=>personalizedSoundSimilarity(signature,example))
  .sort((a,b)=>b-a);
 if(!scores.length)return 0;
 const top=scores.slice(0,Math.min(2,scores.length));
 return Number((top.reduce((a,b)=>a+b,0)/top.length).toFixed(5));
}
export function matchPersonalizedSound(signature,profiles=[],{
 threshold=PERSONALIZED_SOUND_MATCH_THRESHOLD,margin=PERSONALIZED_SOUND_MATCH_MARGIN
}={}){
 if(!signature)return Object.freeze({matched:false,reason:'missing-signature',profile:null,similarity:0,margin:0});
 const rows=[];
 for(const input of Array.isArray(profiles)?profiles:[]){
  let profile;try{profile=normalizePersonalizedSoundProfile(input);}catch{continue;}
  if(!profile.ready)continue;
  rows.push({profile,similarity:profileSimilarity(signature,profile)});
 }
 rows.sort((a,b)=>b.similarity-a.similarity);
 const top=rows[0],second=rows[1];
 if(!top)return Object.freeze({matched:false,reason:'no-ready-profiles',profile:null,similarity:0,margin:0});
 const gap=top.similarity-(second?.similarity||0);
 if(top.similarity<threshold)
  return Object.freeze({matched:false,reason:'below-threshold',profile:null,
   similarity:top.similarity,margin:Number(gap.toFixed(5))});
 if(second&&gap<margin)
  return Object.freeze({matched:false,reason:'ambiguous-profile',profile:null,
   similarity:top.similarity,margin:Number(gap.toFixed(5))});
 return Object.freeze({matched:true,reason:'owner-labeled-profile-match',
  profile:top.profile,similarity:top.similarity,margin:Number(gap.toFixed(5))});
}

export function personalizedSoundLearningEligibility({
 signature=null,at=0,now=Date.now(),speechSensitive=false
}={}){
 if(speechSensitive)return Object.freeze({allow:false,reason:'speech-sensitive-window'});
 if(!signature)return Object.freeze({allow:false,reason:'no-signature'});
 if(!finite(at)||now-at<0||now-at>PERSONALIZED_SOUND_LEARNING_MAX_AGE_MS)
  return Object.freeze({allow:false,reason:'signature-stale'});
 return Object.freeze({allow:true,reason:'recent-non-speech-signature'});
}

export class PersonalizedSoundRecognitionTracker{
 constructor({cooldownMs=PERSONALIZED_SOUND_EMIT_COOLDOWN_MS}={}){
  this.cooldownMs=Math.max(15000,Number(cooldownMs)||PERSONALIZED_SOUND_EMIT_COOLDOWN_MS);
  this.last=null;
 }
 reset(){this.last=null;}
 observe(match,now=Date.now()){
  if(!match?.matched||!match.profile)
   return Object.freeze({emit:false,reason:'no-match',match});
  const same=this.last?.profileId===match.profile.id;
  const emit=!same||!this.last||now-this.last.at>=this.cooldownMs;
  if(emit)this.last={profileId:match.profile.id,at:now};
  return Object.freeze({emit,reason:emit?(same?'repeat-window':'profile-changed'):'deduplicated',match});
 }
}
export function personalizedSoundMessage(result){
 const match=result?.match;if(!match?.matched||!match.profile)return '';
 return 'Personalized sound recognized · '+match.profile.label+' · '+
  Math.round(match.similarity*100)+'% local similarity · owner-labeled profile';
}

export function personalizedSoundCategoryEligible(classification){
 if(!classification)return true;
 return ['household-mechanical','animal','transport','weather-water'].includes(
  String(classification.category||'')
 );
}

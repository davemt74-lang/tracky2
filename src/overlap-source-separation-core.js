export const OVERLAP_SEPARATION_SCHEMA=1;
export const OVERLAP_SEPARATION_MAX_SOURCES=2;
export const OVERLAP_SEPARATION_MIN_SECONDS=.8;
export const OVERLAP_SEPARATION_MAX_SECONDS=18;
export const OVERLAP_SEPARATION_MIN_QUALITY=.56;
export const OVERLAP_SEPARATION_MAX_CORRELATION=.965;
export const OVERLAP_SEPARATION_MIN_SIDE_RATIO=.08;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const short=(value,max=96)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value)))];

function rms(samples,start=0,end=samples?.length||0){
 if(!samples?.length||end<=start)return 0;
 let sum=0,count=0;
 for(let i=start;i<end;i++){const v=Number(samples[i])||0;sum+=v*v;count++;}
 return Math.sqrt(sum/Math.max(1,count));
}
function peak(samples){
 let p=0;
 for(const v of samples||[])p=Math.max(p,Math.abs(Number(v)||0));
 return p;
}
function correlation(a,b){
 const n=Math.min(a?.length||0,b?.length||0);
 if(n<2)return 1;
 let aa=0,bb=0,ab=0;
 for(let i=0;i<n;i++){
  const x=Number(a[i])||0,y=Number(b[i])||0;
  aa+=x*x;bb+=y*y;ab+=x*y;
 }
 if(aa<=1e-12||bb<=1e-12)return 1;
 return Math.max(-1,Math.min(1,ab/Math.sqrt(aa*bb)));
}
function median(values=[]){
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
function dbRatio(a,b){
 if(a<=1e-9&&b<=1e-9)return 0;
 return 20*Math.log10(Math.max(1e-9,a)/Math.max(1e-9,b));
}
function normalizeEstimate(samples){
 const p=peak(samples);
 if(p<=.98)return samples;
 const scale=.98/p;
 const out=new Float32Array(samples.length);
 for(let i=0;i<samples.length;i++)out[i]=samples[i]*scale;
 return out;
}

export function analyzeStereoSeparationInput({
 left=null,right=null,sampleRate=16000,expectedSpeakers=2
}={}){
 const rate=Math.max(1,Math.floor(Number(sampleRate)||16000));
 const n=Math.min(left?.length||0,right?.length||0);
 const seconds=n/rate;
 if(expectedSpeakers>OVERLAP_SEPARATION_MAX_SOURCES)return Object.freeze({
  state:'refused',reason:'more-than-two-speakers',sampleRate:rate,sampleCount:n,
  durationSeconds:seconds,quality:0,correlation:null,sideRatio:null,
  leftDominantFrames:0,rightDominantFrames:0,frameCount:0,leakageEstimate:null
 });
 if(expectedSpeakers<2)return Object.freeze({
  state:'unavailable',reason:'overlap-not-requested',sampleRate:rate,sampleCount:n,
  durationSeconds:seconds,quality:0,correlation:null,sideRatio:null,
  leftDominantFrames:0,rightDominantFrames:0,frameCount:0,leakageEstimate:null
 });
 if(!left?.length||!right?.length||n===0)return Object.freeze({
  state:'unavailable',reason:'stereo-pcm-unavailable',sampleRate:rate,sampleCount:0,
  durationSeconds:0,quality:0,correlation:null,sideRatio:null,
  leftDominantFrames:0,rightDominantFrames:0,frameCount:0,leakageEstimate:null
 });
 if(seconds<OVERLAP_SEPARATION_MIN_SECONDS)return Object.freeze({
  state:'unavailable',reason:'segment-too-short',sampleRate:rate,sampleCount:n,
  durationSeconds:seconds,quality:0,correlation:null,sideRatio:null,
  leftDominantFrames:0,rightDominantFrames:0,frameCount:0,leakageEstimate:null
 });
 if(seconds>OVERLAP_SEPARATION_MAX_SECONDS+.05)return Object.freeze({
  state:'refused',reason:'segment-too-long',sampleRate:rate,sampleCount:n,
  durationSeconds:seconds,quality:0,correlation:null,sideRatio:null,
  leftDominantFrames:0,rightDominantFrames:0,frameCount:0,leakageEstimate:null
 });

 const overallLeft=rms(left,0,n),overallRight=rms(right,0,n);
 if(Math.max(overallLeft,overallRight)<.002)return Object.freeze({
  state:'unavailable',reason:'signal-too-weak',sampleRate:rate,sampleCount:n,
  durationSeconds:seconds,quality:0,correlation:1,sideRatio:0,
  leftDominantFrames:0,rightDominantFrames:0,frameCount:0,leakageEstimate:null
 });

 const frameSize=Math.max(160,Math.round(rate*.02));
 let leftDominantFrames=0,rightDominantFrames=0,frameCount=0;
 const leakageRatios=[];
 let midSq=0,sideSq=0;
 for(let start=0;start<n;start+=frameSize){
  const end=Math.min(n,start+frameSize);
  if(end-start<Math.min(80,frameSize/2))continue;
  frameCount++;
  const l=rms(left,start,end),r=rms(right,start,end);
  const diff=dbRatio(l,r);
  if(diff>=2){
   leftDominantFrames++;
   if(l>.003)leakageRatios.push(clamp(r/l));
  }else if(diff<=-2){
   rightDominantFrames++;
   if(r>.003)leakageRatios.push(clamp(l/r));
  }
  for(let i=start;i<end;i++){
   const lv=Number(left[i])||0,rv=Number(right[i])||0;
   const mid=(lv+rv)*.5,side=(lv-rv)*.5;
   midSq+=mid*mid;sideSq+=side*side;
  }
 }
 const corr=correlation(left,right);
 const sideRatio=Math.sqrt(sideSq/Math.max(1,n))/
  Math.max(1e-9,Math.sqrt(midSq/Math.max(1,n)));
 const leftShare=leftDominantFrames/Math.max(1,frameCount);
 const rightShare=rightDominantFrames/Math.max(1,frameCount);
 const bilateral=Math.min(leftShare,rightShare);
 const diversity=clamp((1-Math.abs(corr))/(1-OVERLAP_SEPARATION_MAX_CORRELATION));
 const sideScore=clamp((sideRatio-OVERLAP_SEPARATION_MIN_SIDE_RATIO)/.42);
 const bilateralScore=clamp(bilateral/.18);
 const quality=clamp(diversity*.38+sideScore*.27+bilateralScore*.35);
 const leakage=median(leakageRatios);
 const reason=
  leftDominantFrames<2||rightDominantFrames<2?'insufficient-bilateral-dominance':
  Math.abs(corr)>OVERLAP_SEPARATION_MAX_CORRELATION?'channels-too-correlated':
  sideRatio<OVERLAP_SEPARATION_MIN_SIDE_RATIO?'insufficient-stereo-diversity':
  quality<OVERLAP_SEPARATION_MIN_QUALITY?'separation-quality-below-threshold':
  null;
 return Object.freeze({
  state:reason?'weak-separation':'separable',
  reason,
  sampleRate:rate,sampleCount:n,durationSeconds:seconds,
  quality:Number(quality.toFixed(3)),
  correlation:Number(corr.toFixed(4)),
  sideRatio:Number(sideRatio.toFixed(4)),
  leftDominantFrames,rightDominantFrames,frameCount,
  leakageEstimate:leakage===null?null:Number(Math.min(.68,Math.max(.05,leakage)).toFixed(3))
 });
}

export function separateStereoOverlap(input={},options={}){
 const expectedSpeakers=Math.max(0,Math.floor(Number(options.expectedSpeakers)||2));
 const analysis=analyzeStereoSeparationInput({...input,expectedSpeakers});
 if(analysis.state!=='separable')return Object.freeze({
  schema:OVERLAP_SEPARATION_SCHEMA,state:analysis.state,reason:analysis.reason,
  sourceCount:0,quality:analysis.quality,metrics:analysis,
  sources:Object.freeze([])
 });
 const left=input.left,right=input.right,n=Math.min(left.length,right.length);
 const alpha=analysis.leakageEstimate??.3;
 const denominator=Math.max(.25,1-alpha*alpha);
 let a=new Float32Array(n),b=new Float32Array(n);
 for(let i=0;i<n;i++){
  const l=Number(left[i])||0,r=Number(right[i])||0;
  a[i]=(l-alpha*r)/denominator;
  b[i]=(r-alpha*l)/denominator;
 }
 a=normalizeEstimate(a);b=normalizeEstimate(b);
 const aRms=rms(a),bRms=rms(b);
 if(aRms<.002||bRms<.002)return Object.freeze({
  schema:OVERLAP_SEPARATION_SCHEMA,state:'weak-separation',
  reason:'separated-source-energy-too-low',sourceCount:0,
  quality:Number((analysis.quality*.5).toFixed(3)),metrics:analysis,
  sources:Object.freeze([])
 });
 return Object.freeze({
  schema:OVERLAP_SEPARATION_SCHEMA,state:'separated',
  reason:'stereo-spatial-decomposition',
  sourceCount:2,quality:analysis.quality,metrics:analysis,
  sources:Object.freeze([
   Object.freeze({id:'source-left',direction:'left',samples:a,rms:Number(aRms.toFixed(5))}),
   Object.freeze({id:'source-right',direction:'right',samples:b,rms:Number(bRms.toFixed(5))})
  ])
 });
}

function normalizeMatch(match={}){
 const participantId=match?.matched?short(match?.participant?.id||match?.participantId):null;
 return Object.freeze({
  matched:Boolean(participantId),
  participantId,
  confidence:clamp(match?.similarity??match?.confidence),
  margin:finite(match?.margin)?Number(match.margin):null,
  ambiguous:match?.ambiguous===true
 });
}

export function resolveSeparatedSpeakerMatches(separation,matches=[]){
 if(!separation||separation.state!=='separated')return Object.freeze({
  state:separation?.state||'unavailable',participantIds:Object.freeze([]),
  sources:Object.freeze([]),reason:separation?.reason||'separation-unavailable'
 });
 const normalized=separation.sources.map((source,index)=>{
  const match=normalizeMatch(matches[index]||{});
  return Object.freeze({
   sourceId:source.id,direction:source.direction,
   state:match.matched&&!match.ambiguous?'voice-verified':
    match.ambiguous?'voice-ambiguous':'unverified',
   participantId:match.matched&&!match.ambiguous?match.participantId:null,
   voiceConfidence:match.confidence,voiceMargin:match.margin
  });
 });
 const ids=uniq(normalized.map(row=>row.participantId));
 if(ids.length===1&&normalized.filter(row=>row.participantId).length===2){
  return Object.freeze({
   state:'ambiguous-same-participant',participantIds:Object.freeze([]),
   sources:Object.freeze(normalized.map(row=>Object.freeze({...row,participantId:null,state:'ambiguous-same-participant'}))),
   reason:'both-separated-sources-matched-same-participant'
  });
 }
 const verified=normalized.filter(row=>row.participantId).length;
 return Object.freeze({
  state:verified===2&&ids.length===2?'separated-verified':
   verified===1?'separated-partial':'separated-unverified',
  participantIds:Object.freeze(ids.slice(0,2)),
  sources:Object.freeze(normalized),
  reason:verified===2&&ids.length===2?'distinct-voice-matches':
   verified===1?'one-separated-source-verified':'no-distinct-separated-speaker-match'
 });
}

export function overlapSeparationTurnFields(separation,resolved=null){
 const result=separation||{state:'unavailable',quality:0,metrics:{},sources:[]};
 const matches=resolved||resolveSeparatedSpeakerMatches(result,[]);
 const metrics=result.metrics||{};
 return Object.freeze({
  overlapSeparationSchema:OVERLAP_SEPARATION_SCHEMA,
  overlapSeparationState:matches.state||result.state||'unavailable',
  overlapSeparationQuality:clamp(result.quality),
  overlapSeparationSourceCount:Math.max(0,Number(result.sourceCount)||0),
  overlapSeparationParticipantIds:Array.from(matches.participantIds||[]).slice(0,2),
  overlapSeparationSources:Array.from(matches.sources||[]).slice(0,2).map(row=>({
   sourceId:short(row.sourceId),direction:short(row.direction,24),
   state:short(row.state,48),participantId:short(row.participantId)||null,
   voiceConfidence:clamp(row.voiceConfidence),
   voiceMargin:finite(row.voiceMargin)?Number(row.voiceMargin):null
  })),
  overlapSeparationReason:short(matches.reason||result.reason,160)||null,
  overlapSeparationCorrelation:finite(metrics.correlation)?Number(metrics.correlation):null,
  overlapSeparationSideRatio:finite(metrics.sideRatio)?Number(metrics.sideRatio):null,
  overlapSeparationProvenance:Object.freeze([
   'shared-room-mic','transient-stereo-spatial-decomposition',
   'canonical-transcript-unchanged'
  ])
 });
}

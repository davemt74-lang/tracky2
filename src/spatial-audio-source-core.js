import {
 calibratedTrackPosition,listenerRelation
} from './spatial-calibration-core.js';

export const SPATIAL_AUDIO_SOURCE_SCHEMA=1;
export const AUDIO_DIRECTION_MIN_DB=1.5;
export const AUDIO_DIRECTION_MAX_FRAMES=96;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const short=(value,max=96)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value)))];

function rmsDb(rms){
 const value=Number(rms);
 if(!finite(value)||value<=0)return -120;
 return 20*Math.log10(Math.max(1e-9,value));
}

export function normalizeStereoSourceFrame(frame={}){
 const channels=Math.max(1,Math.floor(Number(frame.channelCount)||1));
 const left=Number(frame.leftRms),right=Number(frame.rightRms);
 if(channels<2||!finite(left)||!finite(right)||left<0||right<0)
  return Object.freeze({
   state:'unavailable',channelCount:channels,lateralDb:null,
   direction:'unavailable',confidence:0,reason:'stereo-source-unavailable'
  });
 const leftDb=rmsDb(left),rightDb=rmsDb(right);
 const lateralDb=rightDb-leftDb;
 const magnitude=Math.abs(lateralDb);
 const direction=magnitude<AUDIO_DIRECTION_MIN_DB?'center':lateralDb>0?'right':'left';
 const confidence=direction==='center'
  ?clamp(1-magnitude/AUDIO_DIRECTION_MIN_DB)*.65
  :clamp((magnitude-AUDIO_DIRECTION_MIN_DB)/8+.35);
 return Object.freeze({
  state:'available',channelCount:channels,
  leftDb:Number(leftDb.toFixed(2)),rightDb:Number(rightDb.toFixed(2)),
  lateralDb:Number(lateralDb.toFixed(2)),direction,confidence,
  reason:direction==='center'?'balanced-stereo-energy':'stereo-energy-asymmetry'
 });
}

function median(values){
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b);
 const mid=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

export function aggregateAudioSourceEvidence(frames=[]){
 const normalized=Array.from(frames||[]).slice(-AUDIO_DIRECTION_MAX_FRAMES)
  .map(normalizeStereoSourceFrame).filter(row=>row.state==='available');
 if(!normalized.length)return Object.freeze({
  schema:SPATIAL_AUDIO_SOURCE_SCHEMA,state:'unavailable',direction:'unavailable',
  confidence:0,lateralDb:null,frameCount:0,channelCount:1,
  reason:'stereo-source-unavailable',provenance:Object.freeze(['shared-room-mic'])
 });
 const lateral=normalized.map(row=>row.lateralDb).filter(finite);
 const value=median(lateral);
 const spread=median(lateral.map(item=>Math.abs(item-value)))||0;
 const direction=Math.abs(value)<AUDIO_DIRECTION_MIN_DB?'center':value>0?'right':'left';
 const directionalVotes=normalized.filter(row=>row.direction===direction).length;
 const consistency=directionalVotes/normalized.length;
 if(spread>4.5||consistency<.6)return Object.freeze({
  schema:SPATIAL_AUDIO_SOURCE_SCHEMA,state:'uncertain',direction:'uncertain',
  confidence:Number((consistency*.5).toFixed(3)),lateralDb:Number(value.toFixed(2)),
  spreadDb:Number(spread.toFixed(2)),frameCount:normalized.length,channelCount:2,
  reason:'direction-varied-across-segment',
  provenance:Object.freeze(['shared-room-mic','stereo-energy-context'])
 });
 const confidence=clamp(
  normalized.reduce((sum,row)=>sum+row.confidence,0)/normalized.length*
  Math.max(.5,1-spread/10)
 );
 return Object.freeze({
  schema:SPATIAL_AUDIO_SOURCE_SCHEMA,state:'available',direction,
  confidence:Number(confidence.toFixed(3)),lateralDb:Number(value.toFixed(2)),
  spreadDb:Number(spread.toFixed(2)),frameCount:normalized.length,channelCount:2,
  reason:direction==='center'?'balanced-stereo-segment':'stable-stereo-energy-asymmetry',
  provenance:Object.freeze(['shared-room-mic','stereo-energy-context'])
 });
}

function cameraSector(track){
 const cx=finite(track?.cx)?track.cx:
  finite(track?.box?.x)&&finite(track?.box?.width)?track.box.x+track.box.width/2:null;
 if(!finite(cx))return null;
 return cx<.4?'left':cx>.6?'right':'center';
}

function bearingSector(bearingDeg){
 if(!finite(bearingDeg))return null;
 return bearingDeg<-15?'left':bearingDeg>15?'right':'center';
}

export function visualSpatialSourceEvidence({calibration=null,track=null}={}){
 if(!track||['occluded','reacquiring'].includes(String(track.status||'')))
  return Object.freeze({
   state:'unavailable',direction:'unavailable',distanceM:null,bearingDeg:null,
   coordinateSpace:null,metric:false,reason:'visual-source-unavailable'
  });
 const position=calibratedTrackPosition(calibration,track);
 const relation=listenerRelation(calibration,position);
 if(relation){
  return Object.freeze({
   state:'available',direction:bearingSector(relation.bearingDeg),
   distanceM:relation.distanceM,bearingDeg:relation.bearingDeg,
   coordinateSpace:'owner-calibrated-floor-plane',metric:true,
   reason:'calibrated-visual-source',
   provenance:Object.freeze(['owner-defined-floor-plane','listener-anchor'])
  });
 }
 const direction=cameraSector(track);
 if(!direction)return Object.freeze({
  state:'unavailable',direction:'unavailable',distanceM:null,bearingDeg:null,
  coordinateSpace:null,metric:false,reason:'camera-position-unavailable'
 });
 return Object.freeze({
  state:'available',direction,distanceM:null,bearingDeg:null,
  coordinateSpace:'camera-relative',metric:false,
  reason:'camera-relative-visual-source',
  provenance:Object.freeze(['camera-relative-position','non-metric'])
 });
}

export function fuseSpatialAudioSource({
 audioEvidence=null,visualEvidence=null
}={}){
 const audio=audioEvidence||aggregateAudioSourceEvidence([]);
 const visual=visualEvidence||{state:'unavailable',direction:'unavailable'};
 const provenance=uniq([
  ...(audio.provenance||[]),...(visual.provenance||[])
 ]);
 if(audio.state==='unavailable'){
  return Object.freeze({
   schema:SPATIAL_AUDIO_SOURCE_SCHEMA,state:visual.state==='available'
    ?'visual-only':'source-unavailable',
   direction:visual.direction||'unavailable',
   audioDirection:'unavailable',visualDirection:visual.direction||'unavailable',
   confidence:0,agreement:null,metric:visual.metric===true,
   distanceM:visual.distanceM??null,bearingDeg:visual.bearingDeg??null,
   conflict:null,reason:'audio-direction-unavailable',
   provenance:Object.freeze(provenance)
  });
 }
 if(audio.state!=='available'||audio.direction==='uncertain'){
  return Object.freeze({
   schema:SPATIAL_AUDIO_SOURCE_SCHEMA,state:'audio-uncertain',
   direction:visual.direction||'unavailable',
   audioDirection:audio.direction,visualDirection:visual.direction||'unavailable',
   confidence:audio.confidence||0,agreement:null,metric:visual.metric===true,
   distanceM:visual.distanceM??null,bearingDeg:visual.bearingDeg??null,
   conflict:null,reason:audio.reason||'audio-direction-uncertain',
   provenance:Object.freeze(provenance)
  });
 }
 if(visual.state!=='available'){
  return Object.freeze({
   schema:SPATIAL_AUDIO_SOURCE_SCHEMA,state:'audio-only-context',
   direction:audio.direction,audioDirection:audio.direction,visualDirection:'unavailable',
   confidence:audio.confidence,agreement:null,metric:false,
   distanceM:null,bearingDeg:null,conflict:null,
   reason:'visual-source-unavailable',
   provenance:Object.freeze(provenance)
  });
 }
 const agreement=audio.direction===visual.direction;
 return Object.freeze({
  schema:SPATIAL_AUDIO_SOURCE_SCHEMA,
  state:agreement?'audio-visual-agreement':'audio-visual-conflict',
  direction:agreement?visual.direction:'uncertain',
  audioDirection:audio.direction,visualDirection:visual.direction,
  confidence:Number((agreement?audio.confidence:audio.confidence*.5).toFixed(3)),
  agreement,metric:visual.metric===true,
  distanceM:visual.distanceM??null,bearingDeg:visual.bearingDeg??null,
  conflict:agreement?null:'audio-visual-direction-conflict',
  reason:agreement?'directional-context-agrees':'directional-context-conflicts',
  provenance:Object.freeze(provenance)
 });
}

export function spatialAudioSourceTurnFields(fusion){
 const value=fusion||fuseSpatialAudioSource();
 return Object.freeze({
  spatialAudioSourceSchema:SPATIAL_AUDIO_SOURCE_SCHEMA,
  spatialAudioSourceState:value.state,
  spatialAudioDirection:value.direction,
  spatialAudioDirectionConfidence:clamp(value.confidence),
  spatialAudioAudioDirection:value.audioDirection||'unavailable',
  spatialAudioVisualDirection:value.visualDirection||'unavailable',
  spatialAudioAgreement:value.agreement===true?true:value.agreement===false?false:null,
  spatialAudioMetric:value.metric===true,
  spatialAudioDistanceM:finite(value.distanceM)?Number(value.distanceM):null,
  spatialAudioBearingDeg:finite(value.bearingDeg)?Number(value.bearingDeg):null,
  spatialAudioConflict:value.conflict||null,
  spatialAudioReason:value.reason||null,
  spatialAudioProvenance:Object.freeze(uniq(value.provenance).slice(0,12))
 });
}

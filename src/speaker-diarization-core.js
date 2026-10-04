import {clamp,cosineSimilarity} from './participant-core.js';

export const DIARIZATION_SCHEMA=1;
export const DIARIZATION_SAMPLE_RATE=16000;
export const DIARIZATION_WINDOW_MS=1600;
export const DIARIZATION_HOP_MS=800;
export const DIARIZATION_MAX_WINDOWS=6;
export const DIARIZATION_MAX_CLUSTERS=4;
export const DIARIZATION_CLUSTER_THRESHOLD=.78;
export const DIARIZATION_OVERLAP_THRESHOLD=.68;
export const DIARIZATION_OVERLAP_MARGIN=.05;
export const DIARIZATION_MIN_WINDOW_MS=1000;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const bounded=(value,min,max,fallback)=>finite(value)?Math.max(min,Math.min(max,value)):fallback;
const cloneEmbedding=value=>Array.from(value||[],entry=>Number(entry)||0);
const round=value=>Math.round(Number(value)||0);

function selectedIndexes(count,max){
 if(count<=max)return Array.from({length:count},(_,index)=>index);
 const output=[];
 for(let i=0;i<max;i++){
  const index=Math.round(i*(count-1)/(max-1));
  if(!output.includes(index))output.push(index);
 }
 return output;
}

export function createDiarizationWindows(samples,{
 sampleRate=DIARIZATION_SAMPLE_RATE,windowMs=DIARIZATION_WINDOW_MS,
 hopMs=DIARIZATION_HOP_MS,maxWindows=DIARIZATION_MAX_WINDOWS,
 segmentId='segment'
}={}){
 const pcm=samples instanceof Float32Array?samples:Float32Array.from(samples||[]);
 const rate=Math.max(8000,Math.floor(Number(sampleRate)||DIARIZATION_SAMPLE_RATE));
 const minimum=Math.ceil(rate*DIARIZATION_MIN_WINDOW_MS/1000);
 if(pcm.length<minimum)return Object.freeze([]);
 const target=Math.min(pcm.length,Math.max(minimum,Math.round(rate*bounded(
  windowMs,DIARIZATION_MIN_WINDOW_MS,4000,DIARIZATION_WINDOW_MS)/1000)));
 const hop=Math.max(Math.round(rate*.25),Math.round(rate*bounded(
  hopMs,250,3000,DIARIZATION_HOP_MS)/1000));
 const starts=[0];
 for(let start=hop;start+target<pcm.length;start+=hop)starts.push(start);
 const tail=Math.max(0,pcm.length-target);
 if(starts[starts.length-1]!==tail)starts.push(tail);
 const limit=Math.max(1,Math.min(12,Math.floor(Number(maxWindows)||DIARIZATION_MAX_WINDOWS)));
 return Object.freeze(selectedIndexes(starts.length,limit).map((index,windowIndex)=>{
  const startSample=starts[index];
  const endSample=Math.min(pcm.length,startSample+target);
  return Object.freeze({
   id:String(segmentId).slice(0,72)+':dw'+String(windowIndex+1).padStart(2,'0'),
   index:windowIndex,
   startOffsetMs:round(startSample/rate*1000),
   endOffsetMs:round(endSample/rate*1000),
   durationMs:round((endSample-startSample)/rate*1000),
   sampleRate:rate,
   samples:pcm.slice(startSample,endSample)
  });
 }));
}

function updateCentroid(centroid,embedding,count){
 if(!centroid?.length)return cloneEmbedding(embedding);
 const size=Math.min(centroid.length,embedding.length);
 const next=new Array(size);
 const n=Math.max(1,Number(count)||1);
 for(let i=0;i<size;i++)next[i]=(Number(centroid[i])||0)*n/(n+1)+(Number(embedding[i])||0)/(n+1);
 return next;
}

function assignment(input={}){
 return Object.freeze({
  windowId:input.windowId||null,
  startOffsetMs:Math.max(0,round(input.startOffsetMs)),
  endOffsetMs:Math.max(0,round(input.endOffsetMs)),
  state:input.state||'unknown',
  speakerClusterId:input.speakerClusterId||null,
  candidateClusterIds:Object.freeze(Array.from(input.candidateClusterIds||[]).slice(0,2)),
  confidence:clamp(Number(input.confidence||0)),
  similarity:Number.isFinite(input.similarity)?input.similarity:null,
  secondSimilarity:Number.isFinite(input.secondSimilarity)?input.secondSimilarity:null,
  margin:Number.isFinite(input.margin)?input.margin:null,
  reason:input.reason||null
 });
}

export class SpeakerDiarizationSession{
 constructor({
  maxClusters=DIARIZATION_MAX_CLUSTERS,
  clusterThreshold=DIARIZATION_CLUSTER_THRESHOLD,
  overlapThreshold=DIARIZATION_OVERLAP_THRESHOLD,
  overlapMargin=DIARIZATION_OVERLAP_MARGIN
 }={}){
  this.maxClusters=Math.max(1,Math.min(8,Math.floor(Number(maxClusters)||DIARIZATION_MAX_CLUSTERS)));
  this.clusterThreshold=bounded(clusterThreshold,.5,.98,DIARIZATION_CLUSTER_THRESHOLD);
  this.overlapThreshold=bounded(overlapThreshold,.4,this.clusterThreshold,DIARIZATION_OVERLAP_THRESHOLD);
  this.overlapMargin=bounded(overlapMargin,.01,.2,DIARIZATION_OVERLAP_MARGIN);
  this.reset();
 }
 reset(){this.clusters=[];this.nextCluster=1;this.windowCount=0;return this.snapshot();}
 fork(){
  const copy=new SpeakerDiarizationSession({
   maxClusters:this.maxClusters,clusterThreshold:this.clusterThreshold,
   overlapThreshold:this.overlapThreshold,overlapMargin:this.overlapMargin
  });
  copy.clusters=this.clusters.map(cluster=>({
   id:cluster.id,centroid:cloneEmbedding(cluster.centroid),
   count:cluster.count,lastWindowId:cluster.lastWindowId||null
  }));
  copy.nextCluster=this.nextCluster;copy.windowCount=this.windowCount;
  return copy;
 }
 commitFrom(other){
  if(!(other instanceof SpeakerDiarizationSession))
   throw new TypeError('Diarization session commit requires a compatible session.');
  this.clusters=other.clusters.map(cluster=>({
   id:cluster.id,centroid:cloneEmbedding(cluster.centroid),
   count:cluster.count,lastWindowId:cluster.lastWindowId||null
  }));
  this.nextCluster=other.nextCluster;this.windowCount=other.windowCount;
  return this.snapshot();
 }
 snapshot(){
  return Object.freeze({
   clusterCount:this.clusters.length,windowCount:this.windowCount,
   clusters:Object.freeze(this.clusters.map(cluster=>Object.freeze({
    id:cluster.id,count:cluster.count,lastWindowId:cluster.lastWindowId||null
   })))
  });
 }
 assign({embedding,windowId=null,startOffsetMs=0,endOffsetMs=0,quality=1}={}){
  this.windowCount++;
  const vector=cloneEmbedding(embedding);
  const q=clamp(Number(quality||0));
  if(!vector.length||q<.4){
   return assignment({windowId,startOffsetMs,endOffsetMs,state:'unknown',
    confidence:q,reason:vector.length?'low-quality-window':'missing-embedding'});
  }
  const scored=this.clusters.map(cluster=>({
   cluster,similarity:cosineSimilarity(vector,cluster.centroid)
  })).sort((a,b)=>b.similarity-a.similarity);
  const best=scored[0]||null,second=scored[1]||null;
  const margin=best?best.similarity-(second?.similarity||0):1;

  if(best&&second&&best.similarity>=this.overlapThreshold&&
     second.similarity>=this.overlapThreshold&&margin<this.overlapMargin){
   return assignment({
    windowId,startOffsetMs,endOffsetMs,state:'overlap-unresolved',
    candidateClusterIds:[best.cluster.id,second.cluster.id],
    confidence:clamp((best.similarity+second.similarity)/2),
    similarity:best.similarity,secondSimilarity:second.similarity,margin,
    reason:'multiple-speaker-clusters-plausible'
   });
  }

  if(best&&best.similarity>=this.clusterThreshold){
   best.cluster.centroid=updateCentroid(best.cluster.centroid,vector,best.cluster.count);
   best.cluster.count++;best.cluster.lastWindowId=windowId;
   return assignment({
    windowId,startOffsetMs,endOffsetMs,state:'speaker',
    speakerClusterId:best.cluster.id,confidence:clamp(best.similarity*q),
    similarity:best.similarity,secondSimilarity:second?.similarity??null,margin,
    reason:'cluster-match'
   });
  }

  if(this.clusters.length>=this.maxClusters){
   return assignment({
    windowId,startOffsetMs,endOffsetMs,state:'unknown',
    confidence:best?clamp(best.similarity*q):0,
    similarity:best?.similarity??null,secondSimilarity:second?.similarity??null,
    margin:best?margin:null,reason:'cluster-capacity-reached'
   });
  }

  const cluster={
   id:'D'+String(this.nextCluster++),
   centroid:vector,count:1,lastWindowId:windowId
  };
  this.clusters.push(cluster);
  return assignment({
   windowId,startOffsetMs,endOffsetMs,state:'speaker',
   speakerClusterId:cluster.id,confidence:q,
   similarity:best?.similarity??null,secondSimilarity:second?.similarity??null,
   margin:best?margin:null,reason:'new-cluster'
  });
 }
}

function mergeSpans(assignments=[]){
 const spans=[];
 for(const item of assignments){
  const candidateIds=Array.from(item.candidateClusterIds||[]);
  const key=item.state+'|'+(item.speakerClusterId||'')+'|'+candidateIds.join(',');
  const previous=spans[spans.length-1];
  if(previous&&previous.key===key&&item.startOffsetMs<=previous.endOffsetMs+250){
   previous.endOffsetMs=Math.max(previous.endOffsetMs,item.endOffsetMs);
   previous.confidence=Math.min(previous.confidence,item.confidence);
   previous.windowCount++;
   continue;
  }
  spans.push({
   key,state:item.state,speakerClusterId:item.speakerClusterId||null,
   candidateClusterIds:candidateIds,
   startOffsetMs:item.startOffsetMs,endOffsetMs:item.endOffsetMs,
   confidence:item.confidence,windowCount:1
  });
 }
 return spans.map(({key,...span})=>Object.freeze({
  ...span,candidateClusterIds:Object.freeze(span.candidateClusterIds)
 }));
}

export function finalizeDiarization(assignments=[],{
 segmentId=null,cancelled=false,reason=null
}={}){
 const rows=Array.from(assignments||[]).map(row=>assignment(row));
 if(cancelled)return Object.freeze({
  schema:DIARIZATION_SCHEMA,segmentId,state:'cancelled',speakerCount:0,
  overlapObserved:false,unknownWindows:rows.length,windowCount:rows.length,
  safeWholeTurnAttribution:false,reason:reason||'segment-invalidated',
  spans:Object.freeze([])
 });
 const clusters=[...new Set(rows.map(row=>row.speakerClusterId).filter(Boolean))];
 const overlapObserved=rows.some(row=>row.state==='overlap-unresolved');
 const unknownWindows=rows.filter(row=>row.state==='unknown').length;
 let state='unknown';
 if(overlapObserved)state='overlap-unresolved';
 else if(clusters.length>1)state='multi-speaker';
 else if(clusters.length===1)state='single-speaker';
 const safeWholeTurnAttribution=state==='single-speaker'&&unknownWindows===0;
 return Object.freeze({
  schema:DIARIZATION_SCHEMA,segmentId,state,speakerCount:clusters.length,
  overlapObserved,unknownWindows,windowCount:rows.length,
  safeWholeTurnAttribution,reason:reason||null,
  spans:Object.freeze(mergeSpans(rows).slice(0,12))
 });
}

export function diarizationTurnFields(result){
 const value=result||finalizeDiarization();
 return Object.freeze({
  diarizationSchema:DIARIZATION_SCHEMA,
  diarizationState:value.state,
  diarizationSpeakerCount:Math.max(0,Number(value.speakerCount)||0),
  diarizationWindowCount:Math.max(0,Number(value.windowCount)||0),
  diarizationUnknownWindows:Math.max(0,Number(value.unknownWindows)||0),
  diarizationOverlapObserved:value.overlapObserved===true,
  diarizationSafeWholeTurnAttribution:value.safeWholeTurnAttribution===true,
  diarizationReason:value.reason||null,
  diarizationSpans:Array.from(value.spans||[]).slice(0,12).map(span=>({
   state:span.state,speakerClusterId:span.speakerClusterId||null,
   candidateClusterIds:Array.from(span.candidateClusterIds||[]).slice(0,2),
   startOffsetMs:span.startOffsetMs,endOffsetMs:span.endOffsetMs,
   confidence:span.confidence,windowCount:span.windowCount
  }))
 });
}

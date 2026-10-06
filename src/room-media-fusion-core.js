import {normalizeRoomScene} from './room-scene-graph.js';

const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=(v,n=180)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const ROOM_MEDIA_FUSION_SCHEMA=1;
export const ROOM_MEDIA_FUSION_REPEAT_MS=30000;
const MEDIA_ROLES=new Set(['display','speaker','media-device']);
const MEDIA_KINDS=new Set(['television','recorded-media','music']);

export function normalizeMediaVisualObservation(input={},now=Date.now()){
 const text=clean(input.text,220),objectId=clean(input.objectId,96);
 if(!objectId)return null;
 if(text.split(/\s+/).filter(Boolean).length<2)return null;
 return Object.freeze({
  schema:ROOM_MEDIA_FUSION_SCHEMA,
  text,objectId,evidenceId:clean(input.evidenceId,96)||null,
  confidence:clamp(input.confidence??.75),
  at:finite(input.at)?input.at:now,
  provenance:Object.freeze(['local-visual-text-metadata','owner-mapped-object'])
 });
}

function mediaObjects(scene){
 return normalizeRoomScene(scene).objects.filter(object=>MEDIA_ROLES.has(object.role));
}
function objectForVisual(scene,visual){
 if(!visual?.objectId)return null;
 return mediaObjects(scene).find(object=>object.id===visual.objectId)||null;
}
function audioDirection(value,confidence){
 const direction=['left','center','right'].includes(value)?value:'unavailable';
 const score=clamp(confidence);
 if(direction==='unavailable'||score<.55)return Object.freeze({
  state:'unavailable',direction:'unavailable',confidence:score
 });
 return Object.freeze({state:'available',direction,confidence:score});
}
function objectDirection(object){
 return ['left','center','right'].includes(object?.audioDirection)
  ?object.audioDirection:'unavailable';
}
function snapshot({
 state='unavailable',mediaKind=null,object=null,audio=null,visual=null,
 agreement=null,confidence=0,reason='insufficient-evidence'
}={}){
 return Object.freeze({
  schema:ROOM_MEDIA_FUSION_SCHEMA,state,
  mediaKind:MEDIA_KINDS.has(mediaKind)?mediaKind:null,
  objectId:object?.id||null,objectName:object?.name||null,
  objectRole:object?.role||null,objectAudioDirection:objectDirection(object),
  audioDirection:audio?.direction||'unavailable',
  audioConfidence:clamp(audio?.confidence),
  visualEvidenceId:visual?.evidenceId||null,
  visualConfidence:clamp(visual?.confidence),
  agreement:agreement===true?true:agreement===false?false:null,
  confidence:Number(clamp(confidence).toFixed(4)),
  reason,
  participantId:null,
  sourceVerified:Boolean(object),
  provenance:Object.freeze([
   'room-media-fusion-v1',
   ...(object?['owner-defined-room-object']:[]),
   ...(audio?.state==='available'?['shared-room-mic-direction']:[]),
   ...(visual?visual.provenance:[])
  ])
 });
}

export function fuseRoomMediaEvidence({
 scene=null,mediaKind=null,audioDirection:direction='unavailable',
 audioConfidence=0,visualObservation=null
}={}){
 if(!MEDIA_KINDS.has(mediaKind))
  return snapshot({mediaKind,reason:'unsupported-media-kind'});
 const base=normalizeRoomScene(scene||{});
 const audio=audioDirection(direction,audioConfidence);
 const visual=visualObservation?normalizeMediaVisualObservation(visualObservation,visualObservation.at):null;
 const visualObject=objectForVisual(base,visual);

 if(visual&&!visualObject)
  return snapshot({mediaKind,audio,visual,state:'visual-object-unmapped',
   reason:'visual-clue-object-not-mapped'});
 if(visualObject){
  const expected=objectDirection(visualObject);
  if(audio.state==='available'&&expected!=='unavailable'){
   const agrees=audio.direction===expected;
   return snapshot({
    mediaKind,object:visualObject,audio,visual,agreement:agrees,
    state:agrees?'audio-visual-owner-agreement':'audio-visual-owner-conflict',
    confidence:agrees?Math.min(1,(audio.confidence+visual.confidence)/2):
      Math.min(audio.confidence,visual.confidence)*.45,
    reason:agrees?'owner-device-direction-agrees':'owner-device-direction-conflicts'
   });
  }
  return snapshot({
   mediaKind,object:visualObject,audio,visual,
   state:'visual-owner-device',agreement:null,
   confidence:visual.confidence*.85,
   reason:expected==='unavailable'
    ?'owner-device-has-no-audio-direction'
    :'audio-direction-unavailable'
  });
 }

 if(audio.state!=='available')
  return snapshot({mediaKind,audio,state:'source-unavailable',reason:'no-usable-audio-or-visual-device-context'});

 const matches=mediaObjects(base).filter(object=>objectDirection(object)===audio.direction);
 if(matches.length===1)
  return snapshot({
   mediaKind,object:matches[0],audio,state:'audio-owner-device-candidate',
   confidence:audio.confidence*.7,reason:'single-owner-device-matches-audio-direction'
  });
 if(matches.length>1)
  return snapshot({
   mediaKind,audio,state:'audio-owner-device-ambiguous',confidence:audio.confidence*.35,
   reason:'multiple-owner-devices-match-audio-direction'
  });
 return snapshot({
  mediaKind,audio,state:'audio-only-context',confidence:audio.confidence*.5,
  reason:'no-owner-device-matches-audio-direction'
 });
}

export function roomMediaFusionMessage(fusion){
 if(!fusion)return '';
 const name=fusion.objectName||'mapped media device';
 if(fusion.state==='audio-visual-owner-agreement')
  return 'Media context verified · '+name+' · audio and visual metadata agree with owner-defined source mapping';
 if(fusion.state==='audio-visual-owner-conflict')
  return 'Media context conflict · '+name+' · visual metadata and room audio direction disagree';
 if(fusion.state==='visual-owner-device')
  return 'Media visual context · '+name+' · owner-mapped device · audio direction unavailable';
 if(fusion.state==='audio-owner-device-candidate')
  return 'Media source context · '+name+' matches owner-defined audio direction · visual metadata not yet verified';
 if(fusion.state==='audio-owner-device-ambiguous')
  return 'Media source context ambiguous · multiple owner-mapped devices match the audio direction';
 return '';
}

export function mediaVisualLookupAllowed(fusion){
 return Boolean(fusion&&[
  'audio-visual-owner-agreement','visual-owner-device'
 ].includes(fusion.state)&&fusion.objectId);
}

export class RoomMediaFusionTracker{
 constructor({repeatMs=ROOM_MEDIA_FUSION_REPEAT_MS}={}){
  this.repeatMs=Math.max(10000,Number(repeatMs)||ROOM_MEDIA_FUSION_REPEAT_MS);
  this.last=null;
 }
 reset(){this.last=null;}
 observe(fusion,now=Date.now()){
  if(!fusion)return Object.freeze({emit:false,reason:'no-fusion',fusion:null});
  const key=[
   fusion.state,fusion.mediaKind||'',fusion.objectId||'',
   fusion.audioDirection||'',String(fusion.agreement)
  ].join('|');
  const emit=!this.last||this.last.key!==key||now-this.last.at>=this.repeatMs;
  if(emit)this.last={key,at:now};
  return Object.freeze({emit,reason:emit?'changed-or-repeat-window':'deduplicated',fusion});
 }
}

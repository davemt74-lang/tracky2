import {facePreviewRect} from './face-preview.js';
import {
 calibratedTrackPosition,listenerRelation,calibratedReplyVolume
} from './spatial-calibration-core.js';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
// Camera bounding-box area provides a relative proximity hint ONLY; no calibrated
// physical distance, health state or precise 3-D room location is inferred.
export function orbSpatialTarget(tracks=[],view={},preferredId=null,calibration=null){
 const {videoWidth,videoHeight,displayWidth,displayHeight,mirror=true}=view;
 if(!videoWidth||!videoHeight||!displayWidth||!displayHeight)return null;
 const candidates=(tracks||[]).map(t=>{
  const box=t.face?.box||t.box;
  const rect=box?facePreviewRect(box,{videoWidth,videoHeight,displayWidth,displayHeight,mirror,fit:'cover'}):null;
  return rect?{t,rect,area:rect.width*rect.height/(displayWidth*displayHeight)}:null;
 }).filter(Boolean);
 if(!candidates.length)return null;
 const preferred=candidates.find(c=>c.t.participantId&&c.t.participantId===preferredId);
 const matched=candidates.filter(c=>Boolean(c.t.participantId));
 const chosen=preferred||(matched.length?matched:candidates).sort((a,b)=>b.area-a.area)[0];
 const centerX=(chosen.rect.left+chosen.rect.width*.5)/displayWidth;
 const centerY=(chosen.rect.top+chosen.rect.height*.48)/displayHeight;
 const perceived=clamp(Math.sqrt(chosen.area),.08,.8);
 const spatial=calibratedTrackPosition(calibration,chosen.t);
 const relation=listenerRelation(calibration,spatial);
 const calibratedVolume=calibratedReplyVolume(calibration,relation);
 // Follow beside the person rather than obscuring the bounding box.
 return Object.freeze({
  x:clamp(centerX+(centerX<.5?.17:-.17),.18,.82),
  y:clamp(centerY-.16,.21,.76),
  scale:clamp(.73+perceived*.78,.8,1.3),
  volume:calibratedVolume??clamp(.57+perceived*.47,.6,.93),
  proximity:perceived,
  distanceMode:relation?'calibrated-floor':'camera-relative',
  distanceM:relation?.distanceM??null,
  bearingDeg:relation?.bearingDeg??null,
  direction:relation?.direction??null,
  spatialPosition:spatial.status==='calibrated-floor'?spatial:null,
  participantId:chosen.t.participantId||null,
  trackId:chosen.t.id||null
 });
}

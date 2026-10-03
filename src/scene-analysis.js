// UI-facing scene readiness is based on completed work, not a pretend timer.
// Unconfirmed tracks remain in the local tracking engine for continuity, but
// never appear as additional named/unknown participants in normal game UI.
export function sceneStep(step) {
 const steps={
   idle:{label:'Waiting for camera',progress:0,ready:false},
   camera:{label:'Camera connected · loading tracking models',progress:22,ready:false},
   models:{label:'Models loaded · analyzing room geometry',progress:58,ready:false},
   detecting:{label:'Analyzing scene · stabilizing detections',progress:83,ready:false},
   ready:{label:'Scene analyzed · tracking active',progress:100,ready:true},
   error:{label:'Scene analysis unavailable · check camera and models',progress:null,ready:false}
 };
 return Object.freeze(steps[step]||steps.idle);
}
export function scanReadiness({modelReady=false,completeScans=0}={}){
 return modelReady && completeScans>=1?'ready':modelReady?'detecting':'camera';
}
export function cameraFacingPoint({x,y},mirrored=false){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 return Object.freeze({x:Math.min(1,Math.max(0,mirrored?1-x:x)),
   y:Math.min(1,Math.max(0,y))});
}
export function stablePublicTracks(tracks,now,{minAgeMs=550,minObservations=2,graceMs=3200}={}){
 if(!Array.isArray(tracks))return [];
 const candidates=tracks.filter(track=>
   track && typeof track.participantId==='string' && track.participantId.length>0 &&
   ['matched','body-lock','occluded'].includes(track.status) &&
   Number.isFinite(track.firstSeenAt) && now-track.firstSeenAt>=minAgeMs &&
   Number(track.bodyObservations||0)>=minObservations &&
   now-(track.lastBodySeenAt??track.lastSeenAt??0)<=graceMs
 );
 const unique=new Map();
 for(const track of candidates){
   const prior=unique.get(track.participantId);
   if(!prior || Number(track.similarity||0)>Number(prior.similarity||0))
     unique.set(track.participantId,track);
 }
 return Object.freeze([...unique.values()]);
}

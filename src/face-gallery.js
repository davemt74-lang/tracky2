// Guided local face enrollment pairs each saved descriptor with the exact cropped photo
// and intended capture pose. Legacy records retain descriptors without inventing photos/poses.
export const MIN_FACE_SAMPLES=3;
export const MAX_FACE_SAMPLES=9;
export const FACE_CAPTURE_POSES=Object.freeze([
 Object.freeze({id:'front',label:'Straight forward',marker:'●',instruction:'Look straight at the camera and hold still.'}),
 Object.freeze({id:'left',label:'Left',marker:'←',instruction:'Look toward the left marker with a small head turn.'}),
 Object.freeze({id:'right',label:'Right',marker:'→',instruction:'Look toward the right marker with a small head turn.'}),
 Object.freeze({id:'up',label:'Up',marker:'↑',instruction:'Lift your gaze and chin slightly toward the upper marker.'}),
 Object.freeze({id:'down',label:'Down',marker:'↓',instruction:'Lower your gaze and chin slightly toward the lower marker.'}),
 Object.freeze({id:'upper-left',label:'Upper left',marker:'↖',instruction:'Look toward the upper-left marker and hold the angle.'}),
 Object.freeze({id:'upper-right',label:'Upper right',marker:'↗',instruction:'Look toward the upper-right marker and hold the angle.'}),
 Object.freeze({id:'lower-left',label:'Lower left',marker:'↙',instruction:'Look toward the lower-left marker and hold the angle.'}),
 Object.freeze({id:'lower-right',label:'Lower right',marker:'↘',instruction:'Look toward the lower-right marker and hold the angle.'})
]);
const POSE_IDS=new Set(FACE_CAPTURE_POSES.map(p=>p.id));
const isDescriptor=x=>Array.isArray(x) && x.length>0 && x.every(v=>Number.isFinite(Number(v)));
const validPhoto=x=>typeof x==='string' && /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(x);
const poseId=value=>POSE_IDS.has(String(value||''))?String(value):null;
export function faceCapturePose(id){
 const key=poseId(id);return key?FACE_CAPTURE_POSES.find(p=>p.id===key)||null:null;
}
export function nextFaceCapturePose(gallery=[]){
 const used=new Set((Array.isArray(gallery)?gallery:[]).map(sample=>poseId(sample?.poseId)).filter(Boolean));
 return FACE_CAPTURE_POSES.find(pose=>!used.has(pose.id))||null;
}
export function loadFaceGallery(record={}){
  const embeddings=Array.isArray(record.embeddings)?record.embeddings:[];
  const paired=Array.isArray(record.faceSamples) && record.faceSamples.length===embeddings.length;
  return embeddings.map((embedding,i)=>{
    if(!isDescriptor(embedding))throw new TypeError('Invalid saved face descriptor.');
    const old=paired?record.faceSamples[i]:null;
    const savedPose=poseId(old?.poseId);
    return Object.freeze({
      embedding:Object.freeze(Array.from(embedding,Number)),
      // Historic primary/latest photos cannot be reliably mapped to older descriptors.
      photo:old&&validPhoto(old.photo)?old.photo:null,
      quality:Number.isFinite(old?.quality)?Math.min(1,Math.max(0,old.quality)):null,
      capturedAt:typeof old?.capturedAt==='string'?old.capturedAt:null,
      poseId:savedPose,
      poseLabel:savedPose?faceCapturePose(savedPose)?.label||null:null
    });
  }).slice(0,MAX_FACE_SAMPLES);
}
export function captureFaceGallerySample(gallery,{embedding,photo,quality=null,capturedAt=null,poseId:requestedPose=null}={},replaceIndex=null){
  if(!Array.isArray(gallery)||!isDescriptor(embedding)||!validPhoto(photo))
    throw new TypeError('A clean detected face and captured photo are required.');
  if(replaceIndex===null && gallery.length>=MAX_FACE_SAMPLES)throw new RangeError('Nine face samples maximum.');
  if(replaceIndex!==null && (!Number.isInteger(replaceIndex)||replaceIndex<0||replaceIndex>=gallery.length))
    throw new RangeError('Choose a valid gallery position.');
  const existing=replaceIndex===null?null:gallery[replaceIndex];
  const savedPose=poseId(requestedPose)||poseId(existing?.poseId);
  const record=Object.freeze({
    embedding:Object.freeze(Array.from(embedding,Number)),photo,
    quality:Number.isFinite(quality)?Math.min(1,Math.max(0,quality)):null,
    capturedAt:typeof capturedAt==='string'?capturedAt:null,
    poseId:savedPose,
    poseLabel:savedPose?faceCapturePose(savedPose)?.label||null:null
  });
  const next=gallery.slice();
  if(replaceIndex===null)next.push(record);else next[replaceIndex]=record;
  return Object.freeze(next);
}
export function removeFaceGallerySample(gallery,index){
  if(!Array.isArray(gallery)||!Number.isInteger(index)||index<0||index>=gallery.length)
    throw new RangeError('Choose a valid sample to remove.');
  return Object.freeze(gallery.filter((_,i)=>i!==index));
}
export function faceGalleryStatus(gallery,recognitionEnabled=true){
  const samples=Array.isArray(gallery)?gallery:[];
  const count=samples.length;
  const guidedCaptured=new Set(samples.map(sample=>poseId(sample?.poseId)).filter(Boolean)).size;
  return Object.freeze({
    count,required:MIN_FACE_SAMPLES,maximum:MAX_FACE_SAMPLES,
    remaining:Math.max(0,MIN_FACE_SAMPLES-count),
    guidedCaptured,guidedRemaining:Math.max(0,MAX_FACE_SAMPLES-guidedCaptured),
    coverageComplete:guidedCaptured>=MAX_FACE_SAMPLES,
    ready:!recognitionEnabled || count>=MIN_FACE_SAMPLES,
    full:count>=MAX_FACE_SAMPLES,
    photographed:samples.filter(s=>validPhoto(s.photo)).length
  });
}
export function gallerySaveFields(gallery){
  if(!Array.isArray(gallery)||gallery.length>MAX_FACE_SAMPLES)throw new RangeError('Invalid gallery size.');
  return Object.freeze({
    embeddings:gallery.map(sample=>Array.from(sample.embedding)),
    faceSamples:gallery.map(sample=>({
      photo:validPhoto(sample.photo)?sample.photo:null,
      quality:Number.isFinite(sample.quality)?sample.quality:null,
      capturedAt:sample.capturedAt || null,
      poseId:poseId(sample.poseId)
    }))
  });
}

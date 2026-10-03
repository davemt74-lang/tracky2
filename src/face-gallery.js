// Up to five paired local face descriptors/photos; legacy records retain descriptors
// without inventing photos that were never saved in older Tracky2 versions.
export const MIN_FACE_SAMPLES=3;
export const MAX_FACE_SAMPLES=5;
const isDescriptor=x=>Array.isArray(x) && x.length>0 && x.every(v=>Number.isFinite(Number(v)));
const validPhoto=x=>typeof x==='string' && /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(x);
export function loadFaceGallery(record={}){
  const embeddings=Array.isArray(record.embeddings)?record.embeddings:[];
  const paired=Array.isArray(record.faceSamples) && record.faceSamples.length===embeddings.length;
  return embeddings.map((embedding,i)=>{
    if(!isDescriptor(embedding))throw new TypeError('Invalid saved face descriptor.');
    const old=paired?record.faceSamples[i]:null;
    return Object.freeze({
      embedding:Object.freeze(Array.from(embedding,Number)),
      // Historic primary/latest photos cannot be reliably mapped to older descriptors.
      photo:old&&validPhoto(old.photo)?old.photo:null,
      quality:Number.isFinite(old?.quality)?Math.min(1,Math.max(0,old.quality)):null,
      capturedAt:typeof old?.capturedAt==='string'?old.capturedAt:null
    });
  }).slice(0,MAX_FACE_SAMPLES);
}
export function captureFaceGallerySample(gallery,{embedding,photo,quality=null,capturedAt=null}={},replaceIndex=null){
  if(!Array.isArray(gallery)||!isDescriptor(embedding)||!validPhoto(photo))
    throw new TypeError('A clean detected face and captured photo are required.');
  if(replaceIndex===null && gallery.length>=MAX_FACE_SAMPLES)throw new RangeError('Five face samples maximum.');
  if(replaceIndex!==null && (!Number.isInteger(replaceIndex)||replaceIndex<0||replaceIndex>=gallery.length))
    throw new RangeError('Choose a valid gallery position.');
  const record=Object.freeze({
    embedding:Object.freeze(Array.from(embedding,Number)),photo,
    quality:Number.isFinite(quality)?Math.min(1,Math.max(0,quality)):null,
    capturedAt:typeof capturedAt==='string'?capturedAt:null
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
  const count=Array.isArray(gallery)?gallery.length:0;
  return Object.freeze({
    count,required:MIN_FACE_SAMPLES,maximum:MAX_FACE_SAMPLES,
    remaining:Math.max(0,MIN_FACE_SAMPLES-count),
    ready:!recognitionEnabled || count>=MIN_FACE_SAMPLES,
    full:count>=MAX_FACE_SAMPLES,
    photographed:Array.isArray(gallery)?gallery.filter(s=>validPhoto(s.photo)).length:0
  });
}
export function gallerySaveFields(gallery){
  if(!Array.isArray(gallery)||gallery.length>MAX_FACE_SAMPLES)throw new RangeError('Invalid gallery size.');
  return Object.freeze({
    embeddings:gallery.map(sample=>Array.from(sample.embedding)),
    faceSamples:gallery.map(sample=>({
      photo:validPhoto(sample.photo)?sample.photo:null,
      quality:Number.isFinite(sample.quality)?sample.quality:null,
      capturedAt:sample.capturedAt || null
    }))
  });
}

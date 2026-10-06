import test from 'node:test';import assert from 'node:assert/strict';
import { loadFaceGallery,captureFaceGallerySample,removeFaceGallerySample,faceGalleryStatus,
  gallerySaveFields,MIN_FACE_SAMPLES,MAX_FACE_SAMPLES,FACE_CAPTURE_POSES,nextFaceCapturePose } from '../src/face-gallery.js';
const photo=n=>'data:image/jpeg;base64,'+n.repeat(8);
const face=(i,poseId=null)=>({embedding:[i+1,i+2,i+3],photo:photo('A'+String(i)),quality:.8,
 capturedAt:'2026-10-03T00:00:00Z',poseId});
test('all nine guided enrollment samples have individual preview photos and paired descriptors',()=>{
 let gallery=[];
 for(let i=0;i<MAX_FACE_SAMPLES;i++)
  gallery=captureFaceGallerySample(gallery,face(i,FACE_CAPTURE_POSES[i].id));
 assert.equal(MIN_FACE_SAMPLES,3);assert.equal(MAX_FACE_SAMPLES,9);assert.equal(gallery.length,9);
 assert.deepEqual(gallery.map(s=>s.photo),Array.from({length:9},(_,i)=>photo('A'+i)));
 assert.deepEqual(gallery.map(s=>s.poseId),FACE_CAPTURE_POSES.map(p=>p.id));
 assert.equal(faceGalleryStatus(gallery).full,true);
 assert.equal(faceGalleryStatus(gallery).coverageComplete,true);
 assert.equal(faceGalleryStatus(gallery).photographed,9);
 assert.throws(()=>captureFaceGallerySample(gallery,face(10)),RangeError);
 const saved=gallerySaveFields(gallery);
 assert.equal(saved.embeddings.length,9);assert.equal(saved.faceSamples.length,9);
 assert.deepEqual(saved.faceSamples.map(s=>s.poseId),FACE_CAPTURE_POSES.map(p=>p.id));
 const loaded=loadFaceGallery(saved);
 assert.deepEqual(loaded.map(s=>s.photo),gallery.map(s=>s.photo));
 assert.deepEqual(loaded.map(s=>s.poseId),FACE_CAPTURE_POSES.map(p=>p.id));
});
test('guided capture exposes a deterministic center/cardinal/diagonal pose sequence',()=>{
 assert.deepEqual(FACE_CAPTURE_POSES.map(p=>p.id),[
  'front','left','right','up','down','upper-left','upper-right','lower-left','lower-right'
 ]);
 let gallery=[];
 assert.equal(nextFaceCapturePose(gallery).id,'front');
 gallery=captureFaceGallerySample(gallery,face(0,'front'));
 assert.equal(nextFaceCapturePose(gallery).id,'left');
 gallery=captureFaceGallerySample(gallery,face(1,'left'));
 assert.equal(nextFaceCapturePose(gallery).id,'right');
});
test('retake updates photo and recognition descriptor at exactly selected position while preserving pose',()=>{
 let g=[face(0,'front'),face(1,'left'),face(2,'right')];
 const out=captureFaceGallerySample(g,face(4),1);
 assert.deepEqual(out.map(s=>s.embedding[0]),[1,5,3]);
 assert.equal(out[1].photo,photo('A4'));
 assert.equal(out[1].poseId,'left');
 assert.equal(g[1].photo,photo('A1'));
 assert.throws(()=>captureFaceGallerySample(g,face(4),9),RangeError);
});
test('remove accurately updates enrollment count and never leaves unpaired descriptors',()=>{
 let g=[face(0,'front'),face(1,'left'),face(2,'right')];
 assert.equal(faceGalleryStatus(g).ready,true);
 g=removeFaceGallerySample(g,1);
 assert.equal(faceGalleryStatus(g).ready,false);
 assert.equal(faceGalleryStatus(g).remaining,1);
 assert.equal(nextFaceCapturePose(g).id,'left');
 assert.deepEqual(gallerySaveFields(g).embeddings.map(x=>x[0]),[1,3]);
 assert.equal(faceGalleryStatus(g,false).ready,true);
 assert.throws(()=>removeFaceGallerySample(g,-1),RangeError);
});
test('legacy descriptors survive intact but photo and pose slots are honestly labeled missing',()=>{
 const old={embeddings:[[1,2],[3,4],[5,6]],primaryPhoto:photo('X'),latestPhoto:photo('Y')};
 const g=loadFaceGallery(old);
 assert.equal(g.length,3);
 assert.equal(faceGalleryStatus(g).photographed,0);
 assert.equal(faceGalleryStatus(g).guidedCaptured,0);
 assert.deepEqual(g.map(s=>s.embedding),old.embeddings);
 assert.deepEqual(g.map(s=>s.photo),[null,null,null]);
 assert.deepEqual(g.map(s=>s.poseId),[null,null,null]);
});
test('malformed new paired galleries and bogus photo values cannot fabricate linked samples',()=>{
 const old={embeddings:[[1,2],[3,4]],faceSamples:[{photo:photo('B')}]};
 assert.equal(faceGalleryStatus(loadFaceGallery(old)).photographed,0);
 assert.throws(()=>captureFaceGallerySample([],{embedding:[1,2],photo:'https://remote/image'}),TypeError);
 assert.throws(()=>captureFaceGallerySample([],{embedding:[],photo:photo('B')}),TypeError);
});

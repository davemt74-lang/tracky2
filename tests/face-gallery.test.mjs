import test from 'node:test';import assert from 'node:assert/strict';
import { loadFaceGallery,captureFaceGallerySample,removeFaceGallerySample,faceGalleryStatus,
  gallerySaveFields,MIN_FACE_SAMPLES,MAX_FACE_SAMPLES } from '../src/face-gallery.js';
const photo=n=>'data:image/jpeg;base64,'+n.repeat(8);
const face=i=>({embedding:[i+1,i+2,i+3],photo:photo('A'+String(i)),quality:.8,capturedAt:'2026-10-03T00:00:00Z'});
test('all five enrollment samples have individual preview photos and paired descriptors',()=>{
 let gallery=[];for(let i=0;i<MAX_FACE_SAMPLES;i++)gallery=captureFaceGallerySample(gallery,face(i));
 assert.equal(MIN_FACE_SAMPLES,3);assert.equal(gallery.length,5);
 assert.deepEqual(gallery.map(s=>s.photo),Array.from({length:5},(_,i)=>photo('A'+i)));
 assert.equal(faceGalleryStatus(gallery).full,true);
 assert.equal(faceGalleryStatus(gallery).photographed,5);
 assert.throws(()=>captureFaceGallerySample(gallery,face(6)),RangeError);
 const saved=gallerySaveFields(gallery);
 assert.equal(saved.embeddings.length,5);assert.equal(saved.faceSamples.length,5);
 const loaded=loadFaceGallery(saved);
 assert.deepEqual(loaded.map(s=>s.photo),gallery.map(s=>s.photo));
});
test('retake updates photo and recognition descriptor at exactly selected position',()=>{
 let g=[face(0),face(1),face(2)];
 const out=captureFaceGallerySample(g,face(4),1);
 assert.deepEqual(out.map(s=>s.embedding[0]),[1,5,3]);
 assert.equal(out[1].photo,photo('A4'));
 assert.equal(g[1].photo,photo('A1'));
 assert.throws(()=>captureFaceGallerySample(g,face(4),9),RangeError);
});
test('remove accurately updates enrollment count and never leaves unpaired descriptors',()=>{
 let g=[face(0),face(1),face(2)];
 assert.equal(faceGalleryStatus(g).ready,true);
 g=removeFaceGallerySample(g,1);
 assert.equal(faceGalleryStatus(g).ready,false);
 assert.equal(faceGalleryStatus(g).remaining,1);
 assert.deepEqual(gallerySaveFields(g).embeddings.map(x=>x[0]),[1,3]);
 assert.equal(faceGalleryStatus(g,false).ready,true);
 assert.throws(()=>removeFaceGallerySample(g,-1),RangeError);
});
test('legacy descriptors survive intact but photo slots are honestly labeled missing',()=>{
 const old={embeddings:[[1,2],[3,4],[5,6]],primaryPhoto:photo('X'),latestPhoto:photo('Y')};
 const g=loadFaceGallery(old);
 assert.equal(g.length,3);
 assert.equal(faceGalleryStatus(g).photographed,0);
 assert.deepEqual(g.map(s=>s.embedding),old.embeddings);
 assert.deepEqual(g.map(s=>s.photo),[null,null,null]);
});
test('malformed new paired galleries and bogus photo values cannot fabricate linked samples',()=>{
 const old={embeddings:[[1,2],[3,4]],faceSamples:[{photo:photo('B')}]};
 assert.equal(faceGalleryStatus(loadFaceGallery(old)).photographed,0);
 assert.throws(()=>captureFaceGallerySample([],{embedding:[1,2],photo:'https://remote/image'}),TypeError);
 assert.throws(()=>captureFaceGallerySample([],{embedding:[],photo:photo('B')}),TypeError);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {facePreviewRect,smoothPreviewRect} from '../src/face-preview.js';
const config={videoWidth:1280,videoHeight:720,displayWidth:960,displayHeight:600};
test('mirrored object-fit cover positions left, center and right model faces correctly',()=>{
 const left=facePreviewRect({x:.05,y:.3,width:.1,height:.2},config);
 const center=facePreviewRect({x:.45,y:.3,width:.1,height:.2},config);
 const right=facePreviewRect({x:.85,y:.3,width:.1,height:.2},config);
 assert.ok(left.left>right.left,'left source appears right when mirrored');
 assert.ok(right.left>=0,'cropped side clips rather than wrapping');
 assert.ok(center.left>right.left && center.left<left.left);
 assert.ok(left.width>0 && center.height>0);
});
test('nonmirrored cover respects clipping and contains precisely across off-axis edges',()=>{
 const box={x:0,y:.3,width:.15,height:.2};
 const rect=facePreviewRect(box,{...config,mirror:false});
 assert.equal(rect.left,0);
 assert.ok(rect.width<.15*1280*(600/720),'leftmost edge cropped under cover');
 const contained=facePreviewRect(box,{...config,fit:'contain',mirror:false});
 assert.ok(contained.left>0);
 assert.equal(contained.width,.15*960);
});
test('portrait aspect preview accounts for severe horizontal crop and can hide fully cropped faces',()=>{
 const portrait={videoWidth:1280,videoHeight:720,displayWidth:350,displayHeight:600};
 const unseen=facePreviewRect({x:0,y:.3,width:.08,height:.2},{...portrait,mirror:false});
 assert.equal(unseen,null);
 const middle=facePreviewRect({x:.44,y:.3,width:.12,height:.2},portrait);
 assert.ok(middle.left>=0 && middle.left+middle.width<=350);
});
test('pixel boxes move with mirror setting, jitter dampens while true location shifts do not lag',()=>{
 const b={x:.15,y:.1,width:.2,height:.2};
 const a=facePreviewRect(b,{...config,mirror:false});
 const mirror=facePreviewRect(b,config);
 assert.ok(mirror.left>a.left);
 const prev={left:200,top:100,width:70,height:70};
 const jitter=smoothPreviewRect(prev,{left:205,top:102,width:72,height:72});
 assert.equal(jitter.left,203);
 const jump={left:600,top:100,width:70,height:70};
 assert.deepEqual(smoothPreviewRect(prev,jump),jump);
 assert.equal(facePreviewRect(b,{...config,videoWidth:0}),null);
});

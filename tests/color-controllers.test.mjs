import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLLER_COLORS, detectColorControllers } from '../src/color-controllers.js';
function frame() {
  const width=12, height=12, data=new Uint8ClampedArray(width*height*4);
  return { image:{width,height,data}, paint(x0,y0,x1,y1,rgb){
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)data.set([...rgb,255],4*(y*width+x));
  }};
}
test('marker palettes never overlap',()=>assert.ok(CONTROLLER_COLORS.green.hueMax < CONTROLLER_COLORS.blue.hueMin));
test('separate green and blue controllers appear in one image',()=>{
 const f=frame();f.paint(1,1,4,4,[0,255,0]);f.paint(8,7,11,10,[0,0,255]);
 const d=detectColorControllers(f.image,{sampleStep:1});
 assert.ok(d.green && d.blue);assert.ok(d.green.x<d.blue.x);assert.ok(d.green.y<d.blue.y);
});
test('missing blue controller cannot erase detected green',()=>{
 const f=frame();f.paint(2,2,6,6,[0,255,0]);
 const d=detectColorControllers(f.image,{sampleStep:1});assert.ok(d.green);assert.equal(d.blue,null);
});
test('invalid camera input is rejected',()=>{
 assert.throws(()=>detectColorControllers(null),TypeError);
 assert.throws(()=>detectColorControllers(frame().image,{sampleStep:0}),TypeError);
 assert.throws(()=>detectColorControllers(frame().image,{minAreaRatio:-1}),TypeError);
});

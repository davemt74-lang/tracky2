import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLLER_COLORS, detectColorControllers, createColorCalibration, validateColorCalibration } from '../src/color-controllers.js';
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

test('calibration presets adjust sensitivity without overlapping controller hues',()=>{
 const low=createColorCalibration('lowLight'),bright=createColorCalibration('bright');
 assert.ok(low.green.saturationMin<bright.green.saturationMin);
 assert.ok(low.minAreaRatio<bright.minAreaRatio);
 assert.throws(()=>createColorCalibration('other'),RangeError);
 assert.throws(()=>validateColorCalibration({...low,green:{...low.green,hueMax:230}}),RangeError);
 assert.throws(()=>validateColorCalibration({...low,blue:{...low.blue,saturationMin:NaN}}),RangeError);
});
test('calibration rejects a low-saturation blob until tolerance is explicitly changed',()=>{
 const f=frame();f.paint(2,2,7,7,[90,140,90]);
 const normal=createColorCalibration();
 const strict=validateColorCalibration({...normal,green:{...normal.green,saturationMin:80}});
 assert.equal(detectColorControllers(f.image,{sampleStep:1,calibration:strict}).green,null);
 assert.ok(detectColorControllers(f.image,{sampleStep:1,calibration:normal}).green);
});

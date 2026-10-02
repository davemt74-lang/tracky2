import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveDiagnostics } from '../src/live-diagnostics.js';
const markers=(green,blue)=>({
  green: green===null ? null : { x: .5, y: .42, confidence:green, image:'SECRET' },
  blue: blue===null ? null : { x: .5, y: .72, confidence:blue, embedding:[9,9] }
});
test('collects only bounded aggregate telemetry for both colors and runtime readiness',()=>{
 const d=createLiveDiagnostics();
 d.start({ secureContext:true, camera:true, identity:false });
 d.frame(1000,markers(.8,.6));d.frame(1050,markers(.7,null));d.frame(1100,markers(null,.5));
 d.runtime({ microphone:true, voiceModel:true });
 const s=d.stop();
 assert.equal(s.status,'stopped');assert.equal(s.frames,3);
 assert.equal(s.averageFps,20);assert.equal(s.markers.green.observedFrames,2);
 assert.equal(s.markers.green.interruptions,1);assert.equal(s.markers.green.longestStreak,2);
 assert.equal(s.markers.blue.detectionRate,2/3);
 assert.equal(s.markers.blue.meanConfidence,.55);
 assert.equal(s.runtime.microphone,true);
 assert.equal(s.hardwareCertified,false);
 assert.equal(JSON.stringify(s).includes('SECRET'),false);
 assert.equal(JSON.stringify(s).includes('embedding'),false);
 assert.equal(JSON.stringify(s).includes('x'),false);
});
test('rejects duplicated, backwards and invalid timestamps without scoring false observations',()=>{
 const d=createLiveDiagnostics();d.start();d.frame(50,markers(.5,null));
 d.frame(50,markers(.9,.9));d.frame(49,markers(.9,.9));d.frame(NaN,markers(.9,.9));
 assert.equal(d.snapshot().frames,1);assert.equal(d.snapshot().timestampDiscontinuities,3);
 assert.equal(d.snapshot().markers.blue.observedFrames,0);
});
test('a stop freezes measurements; restarting clears all prior details',()=>{
 const d=createLiveDiagnostics();
 d.start();d.frame(1,markers(.4,.5));d.stop();
 assert.equal(d.frame(2,markers(.4,.5)).type,'inactive');
 assert.equal(d.snapshot().frames,1);
 d.start();assert.equal(d.snapshot().frames,0);
 assert.equal(d.snapshot().markers.green.observedFrames,0);
 assert.equal(d.snapshot().runtime.camera,false);
});
test('frame cap automatically stops, invalid runtime fields are ignored',()=>{
 const d=createLiveDiagnostics({maxFrames:60});d.start({ camera: 1, transcriptModel:'secret' });
 for(let i=0;i<60;i++)d.frame(i*20,markers(.5,null));
 assert.equal(d.running,false);assert.equal(d.snapshot().frames,60);
 assert.equal(d.snapshot().runtime.camera,false);
 assert.equal(d.snapshot().runtime.transcriptModel,false);
 assert.throws(()=>createLiveDiagnostics({maxFrames:1}),RangeError);
});

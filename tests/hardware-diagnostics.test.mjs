import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareDiagnostics} from '../src/hardware-diagnostics.js';

test('summary reports aggregate camera FPS/timing and no raw frame content',()=>{
 const d=createHardwareDiagnostics();
 for(let i=0;i<=500;i++)d.record(i*20);
 const report=d.snapshot();
 assert.equal(report.frames,501);
 assert.equal(report.measuredFps,50);
 assert.equal(report.meanFrameGapMs,20);
 assert.equal(report.maxFrameGapMs,20);
 assert.equal(report.cameraReadiness,'camera-performance-observed');
 for(const forbidden of ['imageData','rawFrame','audio','embedding','transcript','green','blue','marker'])
  assert.equal(JSON.stringify(report).includes(forbidden),false);
});

test('short or slow camera runs remain incomplete',()=>{
 const d=createHardwareDiagnostics();
 d.record(0);d.record(100);d.record(200);
 const result=d.snapshot();
 assert.equal(result.frames,3);
 assert.equal(result.measuredFps,10);
 assert.equal(result.cameraReadiness,'hardware-review-incomplete');
});

test('invalid or duplicate timestamps are excluded and reset clears metrics',()=>{
 const d=createHardwareDiagnostics();
 assert.equal(d.record(-1),false);
 assert.equal(d.record(1),true);
 assert.equal(d.record(1),false);
 assert.equal(d.snapshot().frames,1);
 d.reset();assert.equal(d.snapshot().frames,0);
});

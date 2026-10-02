import test from 'node:test';
import assert from 'node:assert/strict';
import { createHardwareDiagnostics } from '../src/hardware-diagnostics.js';
function sample(y){return {x:.4,y,confidence:.8}}
test('summary reports measured FPS, four-zone coverage and no raw frames',()=>{
 const d=createHardwareDiagnostics();
 const zones=[.125,.375,.625,.875];
 for(let i=0;i<=500;i++){
  const y=zones[i%4];
  const readings={green:sample(y),blue:sample(y)};
  const states={green:{accepted:true,sample:sample(y)},
    blue:{accepted:true,sample:sample(y)}};
  d.record(i*20,readings,states);
 }
 const report=d.snapshot();
 assert.equal(report.frames,501);
 assert.equal(report.measuredFps,50);
 assert.equal(report.cameraReadiness,'coverage-and-performance-observed');
 assert.deepEqual(report.colors.green.visitedZones,[0,1,2,3]);
 assert.deepEqual(report.colors.blue.visitedZones,[0,1,2,3]);
 for(const forbidden of ['imageData','rawFrame','audio','embedding','transcript'])
  assert.equal(JSON.stringify(report).includes(forbidden),false);
});
test('missing markers, implausible jumps and partial coverage stay visible in results',()=>{
 const d=createHardwareDiagnostics();
 d.record(10,{green:sample(.25)},{
  green:{accepted:true,sample:sample(.25)},blue:{type:'lost',accepted:false}
 });
 d.record(50,{green:sample(.30),blue:sample(.70)},{
  green:{type:'jump-rejected',accepted:false},blue:{accepted:true,sample:sample(.70)}
 });
 const result=d.snapshot();
 assert.equal(result.colors.green.rejectedJumps,1);
 assert.equal(result.colors.blue.dropouts,1);
 assert.equal(result.cameraReadiness,'hardware-review-incomplete');
 assert.deepEqual(result.colors.green.visitedZones,[1]);
});
test('invalid or duplicate timestamps are excluded and reset clears metrics',()=>{
 const d=createHardwareDiagnostics();
 assert.equal(d.record(-1),false);
 assert.equal(d.record(1),true);
 assert.equal(d.record(1),false);
 assert.equal(d.snapshot().frames,1);
 d.reset();assert.equal(d.snapshot().frames,0);
});

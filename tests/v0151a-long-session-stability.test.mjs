import test from 'node:test';
import assert from 'node:assert/strict';
import {
 V0151LongSessionStabilityMonitor,evaluateV0151LongSessionStability,
 V0151_STABILITY_MAX_SAMPLES,V0151_STABILITY_MIN_DURATION_MS,V0151_STABILITY_SAMPLE_MS
} from '../src/v0151-long-session-stability-core.js';

test('15.1A certifies a bounded four-hour stable runtime',()=>{
 const m=new V0151LongSessionStabilityMonitor({startedAt:0});
 for(let at=V0151_STABILITY_SAMPLE_MS;at<=V0151_STABILITY_MIN_DURATION_MS;at+=V0151_STABILITY_SAMPLE_MS){
  m.observe({at,visible:true,performanceLevel:'normal',frameGapMs:30,scanMs:400,
   audioQueueDepth:0,heapUsedBytes:100_000_000+at/1000,heapLimitBytes:1_000_000_000,storageRatio:.2});
 }
 const result=m.certify(V0151_STABILITY_MIN_DURATION_MS);
 assert.equal(result.status,'certified');
 assert.ok(m.samples.length<=V0151_STABILITY_MAX_SAMPLES);
 assert.ok(result.snapshot.evidenceCoverage>=.99);
});

test('15.1A rejects resource growth, critical runtime and unclean restart',()=>{
 const result=evaluateV0151LongSessionStability({
  durationMs:V0151_STABILITY_MIN_DURATION_MS,sampleCount:1440,visibleSamples:1440,
  criticalSamples:1,degradedRatio:.01,p95FrameGapMs:40,p95ScanMs:500,
  p95AudioQueue:0,maxAudioQueue:0,heapGrowthRatio:.4,maxHeapRatio:.7,
  maxStorageRatio:.2,longGapCount:0,restartCount:1,uncleanRestartCount:1
 });
 assert.ok(result.failed.includes('no-critical-performance'));
 assert.ok(result.failed.includes('heap-growth-budget'));
 assert.ok(result.failed.includes('restart-integrity'));
});

test('15.1A restores bounded aggregate evidence across a clean restart',()=>{
 const first=new V0151LongSessionStabilityMonitor({startedAt:0});
 first.observe({at:10000,visible:true,performanceLevel:'normal'},true);
 const second=new V0151LongSessionStabilityMonitor({startedAt:999999,state:first.exportState()});
 second.noteRestart({clean:true});
 assert.equal(second.startedAt,0);
 assert.equal(second.samples.length,1);
 assert.equal(second.snapshot(20000).restartCount,1);
 assert.equal(second.snapshot(20000).uncleanRestartCount,0);
});

test('15.1A sampling cadence rejects oversampling',()=>{
 const m=new V0151LongSessionStabilityMonitor({startedAt:0});
 assert.equal(m.observe({at:10000,visible:true}),true);
 assert.equal(m.observe({at:11000,visible:true}),false);
 assert.equal(m.observe({at:20000,visible:true}),true);
 assert.equal(m.samples.length,2);
});

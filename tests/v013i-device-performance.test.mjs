import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildHardwareCertificationReport} from '../src/hardware-certification-core.js';
import {
 DEVICE_PERFORMANCE_MAX_SAMPLES,DevicePerformanceGovernor,
 adaptivePerformancePolicy,coarseDevicePerformanceCapabilities,
 performanceCertificationOutcome,performanceRisk,performanceSampleDelta,
 summarizePerformanceTrend
} from '../src/device-performance-core.js';

test('13I coarse capability classes avoid exact hardware fingerprint values',()=>{
 assert.deepEqual(coarseDevicePerformanceCapabilities({
  deviceMemory:8,hardwareConcurrency:12,heapMetrics:true,batteryMetrics:false
 }),{
  deviceMemoryClass:'high',concurrencyClass:'high',
  heapMetrics:'supported',batteryMetrics:'unsupported'
 });
});

test('13I risk policy preserves camera microphone transcription recording and identity authority',()=>{
 const critical=performanceRisk({
  frameCount:100,stallCount:20,maxFrameGapMs:1800,meanScanMs:2600,
  audioQueueDepth:9,heapRatio:.94,storageRatio:.93
 });
 assert.equal(critical.level,'critical');
 const policy=adaptivePerformancePolicy(critical);
 assert.equal(policy.environmentalAudioAllowed,false);
 assert.equal(policy.identityScanMultiplier,2.5);
 assert.equal(policy.cameraAllowed,true);
 assert.equal(policy.microphoneAllowed,true);
 assert.equal(policy.transcriptionAllowed,true);
 assert.equal(policy.recordingAllowed,true);
 assert.equal(policy.identityAuthorityChanged,false);
});

test('13I reduced policy slows optional scans without disabling canonical sensors',()=>{
 const risk=performanceRisk({frameCount:100,stallCount:4,maxFrameGapMs:700});
 assert.equal(risk.level,'reduced');
 const policy=adaptivePerformancePolicy(risk);
 assert.equal(policy.identityScanMultiplier,1.5);
 assert.equal(policy.environmentalAudioAllowed,true);
});

test('13I sample deltas isolate recent frame stalls from cumulative runtime totals',()=>{
 const prior={at:1000,frameCount:100,stallCount:3,maxFrameGapMs:200};
 const current={at:11000,frameCount:200,stallCount:5,maxFrameGapMs:300};
 const delta=performanceSampleDelta(current,prior);
 assert.equal(delta.frameCount,100);
 assert.equal(delta.stallCount,2);
 assert.ok(delta.stallRatio>0&&delta.stallRatio<.1);
});

test('13I governor escalates immediately and recovers only after healthy hysteresis',()=>{
 const g=new DevicePerformanceGovernor({recoverySamples:3});
 g.observe({at:1,frameCount:100,stallCount:15,maxFrameGapMs:1600,audioQueueDepth:9});
 assert.equal(g.snapshot().level,'critical');
 g.observe({at:2,frameCount:100,stallCount:0,maxFrameGapMs:20});
 g.observe({at:3,frameCount:100,stallCount:0,maxFrameGapMs:20});
 assert.equal(g.snapshot().level,'critical');
 g.observe({at:4,frameCount:100,stallCount:0,maxFrameGapMs:20});
 assert.equal(g.snapshot().level,'reduced');
 g.observe({at:5,frameCount:100,stallCount:0,maxFrameGapMs:20});
 g.observe({at:6,frameCount:100,stallCount:0,maxFrameGapMs:20});
 g.observe({at:7,frameCount:100,stallCount:0,maxFrameGapMs:20});
 assert.equal(g.snapshot().level,'normal');
});

test('13I governor sample history is hard bounded',()=>{
 const g=new DevicePerformanceGovernor();
 for(let i=0;i<1000;i++)g.observe({at:i*10000,frameCount:100,stallCount:0});
 assert.equal(g.snapshot().sampleCount,DEVICE_PERFORMANCE_MAX_SAMPLES);
});

test('13I trend captures p95 latency/backlog and optional heap battery storage evidence',()=>{
 const rows=[];
 for(let i=0;i<20;i++)rows.push({
  at:i*10*60*1000,frameCount:100,stallCount:0,
  maxFrameGapMs:i===19?800:30,meanScanMs:200+i,
  audioQueueDepth:i===19?5:0,heapRatio:.4+i*.01,
  batteryLevel:.9-i*.02,charging:false,storageRatio:.2+i*.01
 });
 const trend=summarizePerformanceTrend(rows);
 assert.equal(trend.state,'measured');
 assert.equal(trend.samples,20);
 assert.ok(trend.p95FrameGapMs>=30);
 assert.equal(trend.maxAudioQueue,5);
 assert.ok(trend.maxHeapRatio>.5);
 assert.ok(trend.minBatteryLevel<.9);
});

test('13I certification requires two hours and never upgrades degraded evidence to pass',()=>{
 const short=summarizePerformanceTrend([
  {at:0,frameCount:100},{at:60*60*1000,frameCount:100}
 ]);
 assert.equal(performanceCertificationOutcome(short).outcome,'partial');
 const long=summarizePerformanceTrend([
  {at:0,frameCount:100},{at:3*60*60*1000,frameCount:100}
 ]);
 assert.equal(performanceCertificationOutcome(long).outcome,'pass');
 const critical=summarizePerformanceTrend([
  {at:0,frameCount:100},{at:3*60*60*1000,frameCount:100,maxFrameGapMs:1800,audioQueueDepth:9}
 ]);
 assert.equal(performanceCertificationOutcome(critical).outcome,'partial');
});

test('13I runtime uses governor only for optional workload degradation',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/DevicePerformanceGovernor/);
 assert.match(runtime,/identityScanMultiplier/);
 assert.match(runtime,/environmentalAudioAllowed/);
 assert.match(runtime,/IDENTITY_SCAN_INTERVAL\s*\*/);
 assert.doesNotMatch(runtime,/performance.*stopCamera|performance.*stopRoomAudio/i);
});

test('13I certification export contains only bounded aggregate performance trend fields',()=>{
 const report=buildHardwareCertificationReport({
  releaseVersion:'0.13.8',
  performance:{
   state:'measured',samples:120,durationMs:7200000,
   p95FrameGapMs:40,p95ScanMs:900,medianScanMs:420,maxAudioQueue:2,
   maxHeapRatio:.68,minBatteryLevel:.55,maxStorageRatio:.42,
   worstLevel:'reduced',degradationCount:2,outcome:'pass',
   outcomeReason:'multi-hour-performance-within-bounds',
   rawTrace:[1,2,3],cpuModel:'forbidden'
  }
 });
 assert.equal(report.metrics.performance.samples,120);
 assert.equal(report.metrics.performance.outcome,'pass');
 const json=JSON.stringify(report);
 assert.equal(json.includes('rawTrace'),false);
 assert.equal(json.includes('cpuModel'),false);
});

test('13I diagnostics exposes performance trend and certification export integration',()=>{
 const html=fs.readFileSync('diagnostics.html','utf8');
 const js=fs.readFileSync('diagnostics.js','utf8');
 const cert=fs.readFileSync('src/hardware-certification-core.js','utf8');
 assert.match(html,/id="certPerformanceTrend"/);
 assert.match(js,/DevicePerformanceGovernor/);
 assert.match(js,/navigator\.getBattery/);
 assert.match(js,/(?:globalThis\.)?performance\?*\.memory/);
 assert.match(cert,/performance:/);
});

test('13I pure performance core opens no sensors persistence identity transcript or network path',()=>{
 const core=fs.readFileSync('src/device-performance-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|saveParticipant|saveDialogue|reviseDialogue|deleteDialogue|embedding\(/);
});

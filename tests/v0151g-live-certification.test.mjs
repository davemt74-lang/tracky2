import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveCertificationHarness,LIVE_CERT_SCENARIOS,evaluateLiveScenario} from '../src/live-certification-core.js';

test('15.1G defines the installed-device certification matrix',()=>{
 for(const id of ['long-session-stability','participant-arrival-departure-reentry',
  'conversation-ownership-handoff','media-transition-awareness','proactivity-accept',
  'proactivity-reject','correct-silence','provider-failure-recovery',
  'network-reconnect-no-replay','browser-restart-integrity','resource-growth'])
  assert.ok(LIVE_CERT_SCENARIOS.includes(id));
});

test('15.1G long-session and resource scenarios use live aggregate evidence',()=>{
 const snap={longSessionStatus:'certified',longSessionDurationMs:14400000,heapGrowthRatio:.1,maxHeapRatio:.5};
 assert.equal(evaluateLiveScenario('long-session-stability',{snapshot:snap}).outcome,'pass');
 assert.equal(evaluateLiveScenario('resource-growth',{snapshot:snap}).outcome,'pass');
});

test('15.1G manual device outcome overrides partial automated evidence',()=>{
 const result=evaluateLiveScenario('network-reconnect-no-replay',{
  manual:'pass',snapshot:{reconnectGeneration:1,replayTombstones:2}
 });
 assert.equal(result.outcome,'pass');
});

test('15.1G report stays incomplete until every scenario is resolved',()=>{
 const h=new LiveCertificationHarness({startedAt:1});
 h.observeSnapshot({longSessionStatus:'certified',longSessionDurationMs:14400000,heapGrowthRatio:.1,maxHeapRatio:.5},2);
 assert.equal(h.summary().status,'incomplete');
 for(const id of LIVE_CERT_SCENARIOS)h.setScenario(id,'pass');
 assert.equal(h.summary().status,'certified');
});

test('15.1G report is bounded metadata only',()=>{
 const h=new LiveCertificationHarness();
 h.observeSnapshot({participants:[{id:'p1',embedding:[1]}],providers:[{provider:'x',state:'healthy'}]});
 const json=JSON.stringify(h.report());
 for(const bad of ['embedding','rawAudio','transcript','imageData','audioBase64'])assert.equal(json.includes(bad),false);
});

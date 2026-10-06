import test from 'node:test';
import assert from 'node:assert/strict';
import {
 evaluateFinalInstalledDeviceCertification,buildFinalCertificationReport,canonicalFinalCertificationJson
} from '../src/final-certification-core.js';

const green=()=>({
 hardwareSummary:{status:'pass',failed:[],partial:[],notRun:[]},
 liveSummary:{status:'certified',scenarios:[
  {id:'a',outcome:'pass'},{id:'b',outcome:'pass'}
 ]},
 autonomy:{status:'certified',failed:[]},
 longSession:{status:'certified',failed:[],snapshot:{durationMs:14400000}}
});

test('15.1H certifies only when every required layer is green',()=>{
 const result=evaluateFinalInstalledDeviceCertification(green());
 assert.equal(result.status,'certified');
 assert.equal(result.freezeRelease,true);
 assert.deepEqual(result.blockers,[]);
});

test('15.1H blocks any required not-run or partial live scenario',()=>{
 const base=green();
 let result=evaluateFinalInstalledDeviceCertification({...base,
  liveSummary:{status:'incomplete',scenarios:[{id:'restart',outcome:'not-run'}]}});
 assert.equal(result.status,'blocked');
 assert.ok(result.blockers.includes('live:restart'));
 result=evaluateFinalInstalledDeviceCertification({...base,
  liveSummary:{status:'partial',scenarios:[{id:'provider',outcome:'partial'}]}});
 assert.ok(result.blockers.includes('live:provider'));
});

test('15.1H blocks hardware, autonomy and long-session defects',()=>{
 const result=evaluateFinalInstalledDeviceCertification({
  hardwareSummary:{status:'fail',failed:['camera-recovery'],partial:[],notRun:[]},
  liveSummary:{status:'certified',scenarios:[]},
  autonomy:{status:'failed',failed:['no-duplicate-speech']},
  longSession:{status:'failed',failed:['resource-growth-budget']}
 });
 assert.equal(result.status,'blocked');
 assert.ok(result.blockers.includes('hardware:camera-recovery'));
 assert.ok(result.blockers.includes('autonomy:no-duplicate-speech'));
 assert.ok(result.blockers.includes('long-session:resource-growth-budget'));
});

test('15.1H final report carries all evidence layers and deterministic canonical form',()=>{
 const base=green();
 const report=buildFinalCertificationReport({
  hardwareReport:{summary:base.hardwareSummary,metrics:{runtime:{durationMs:1}}},
  liveCertification:{summary:base.liveSummary},
  autonomy:base.autonomy,longSession:base.longSession
 });
 assert.equal(report.final.status,'certified');
 assert.equal(canonicalFinalCertificationJson(report),canonicalFinalCertificationJson(report));
});

test('15.1H report remains metadata-only by contract',()=>{
 const base=green();
 const report=buildFinalCertificationReport({
  hardwareReport:{summary:base.hardwareSummary},
  liveCertification:{summary:base.liveSummary},
  autonomy:base.autonomy,longSession:base.longSession
 });
 const json=JSON.stringify(report);
 for(const bad of ['rawAudio','audioBase64','embedding','imageData'])assert.equal(json.includes(bad),false);
});

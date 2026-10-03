import test from 'node:test';import assert from 'node:assert/strict';
import {sceneStep,scanReadiness,cameraFacingPoint,stablePublicTracks} from '../src/scene-analysis.js';
test('scene animation milestones track real camera model and first scan completion',()=>{
 assert.equal(sceneStep('camera').progress,22);
 assert.equal(sceneStep('models').progress,58);
 assert.equal(sceneStep('detecting').progress,83);
 assert.equal(scanReadiness({modelReady:true}), 'detecting');
 assert.equal(scanReadiness({modelReady:true,completeScans:1}),'ready');
 assert.equal(sceneStep('ready').ready,true);
 assert.equal(sceneStep('error').ready,false);
});
test('mirrored room radar applies horizontal projection without modifying source tracks',()=>{
 const raw={x:.2,y:.75};
 assert.deepEqual(cameraFacingPoint(raw,false),{x:.2,y:.75});
 assert.deepEqual(cameraFacingPoint(raw,true),{x:.8,y:.75});
 assert.deepEqual(raw,{x:.2,y:.75});
 assert.equal(cameraFacingPoint({x:NaN,y:1}),null);
});
test('false-positive provisional bodies and transient identities remain internal',()=>{
 const now=6000,base={firstSeenAt:1000,lastBodySeenAt:5900,bodyObservations:3,status:'matched',
 participantId:'p1',participantName:'Dave',similarity:.82};
 const list=[
  {...base,id:'real'},
  {...base,id:'ghost',participantId:null,status:'body-detected'},
  {...base,id:'short',participantId:'p2',firstSeenAt:5800},
  {...base,id:'one-frame',participantId:'p3',bodyObservations:1},
  {...base,id:'stale',participantId:'p4',lastBodySeenAt:0},
  {...base,id:'ambiguous',participantId:'p5',status:'new'},
  {...base,id:'duplicate',similarity:.5}
 ];
 const shown=stablePublicTracks(list,now);
 assert.deepEqual(shown.map(x=>x.id),['real']);
 assert.equal(list[1].status,'body-detected');
});
test('occluded identified track remains briefly visible, never labels strangers as participants',()=>{
 const t={participantId:'p1',status:'occluded',firstSeenAt:0,lastBodySeenAt:2900,
   bodyObservations:4,similarity:.7};
 assert.equal(stablePublicTracks([t],3000).length,1);
 assert.equal(stablePublicTracks([t],7000).length,0);
});

test('animation remains during first frame and turns into visible searching state when person not stable',()=>{
 const {sceneAcquisition}=await import('../src/scene-analysis.js');
 assert.equal(sceneAcquisition({modelReady:true,completeScans:1,elapsedMs:300,stable:true}),'detecting');
 assert.equal(sceneAcquisition({modelReady:true,completeScans:3,elapsedMs:1500,stable:false}),'waiting');
 assert.equal(sceneAcquisition({modelReady:true,completeScans:3,elapsedMs:1500,stable:true}),'ready');
 assert.equal(sceneStep('waiting').progress,92);
});

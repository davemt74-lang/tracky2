import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RoomMediaFusionTracker,fuseRoomMediaEvidence,mediaVisualLookupAllowed,
 normalizeMediaVisualObservation,roomMediaFusionMessage
} from '../src/room-media-fusion-core.js';
import {
 ROOM_SCENE_SCHEMA,emptyRoomScene,normalizeRoomScene,upsertRoomObject
} from '../src/room-scene-graph.js';

function sceneWith(...objects){
 return normalizeRoomScene({...emptyRoomScene(),objects});
}

test('V2F room scene schema preserves owner-defined device role and expected audio direction',()=>{
 assert.ok(ROOM_SCENE_SCHEMA>=5);
 let scene=upsertRoomObject(emptyRoomScene(),{
  id:'tv',name:'Living room TV',kind:'device',role:'display',audioDirection:'right'
 });
 assert.equal(scene.objects[0].role,'display');
 assert.equal(scene.objects[0].audioDirection,'right');
 scene=upsertRoomObject(scene,{id:'tv',name:'Living room TV',kind:'device'});
 assert.equal(scene.objects[0].role,'display','edits preserve role unless explicitly changed');
 assert.equal(scene.objects[0].audioDirection,'right');
 const legacy=normalizeRoomScene({objects:[{id:'old',name:'Old device',kind:'device'}]});
 assert.equal(legacy.objects[0].role,'other');
 assert.equal(legacy.objects[0].audioDirection,'unavailable');
});

test('V2F audio-only context names one owner-mapped device without claiming visual verification',()=>{
 const scene=sceneWith({
  id:'tv',name:'TV',kind:'device',role:'display',audioDirection:'right'
 });
 const fusion=fuseRoomMediaEvidence({
  scene,mediaKind:'television',audioDirection:'right',audioConfidence:.9
 });
 assert.equal(fusion.state,'audio-owner-device-candidate');
 assert.equal(fusion.objectId,'tv');
 assert.equal(fusion.sourceVerified,true);
 assert.equal(fusion.agreement,null);
 assert.equal(mediaVisualLookupAllowed(fusion),false);
 assert.match(roomMediaFusionMessage(fusion),/visual metadata not yet verified/);
});

test('V2F visual metadata on the mapped display plus matching audio direction verifies context',()=>{
 const scene=sceneWith({
  id:'tv',name:'TV',kind:'device',role:'display',audioDirection:'right'
 });
 const visual=normalizeMediaVisualObservation({
  text:'Example Stream Example Series',objectId:'tv',evidenceId:'ocr-1',confidence:.9,at:1000
 });
 const fusion=fuseRoomMediaEvidence({
  scene,mediaKind:'television',audioDirection:'right',audioConfidence:.86,
  visualObservation:visual
 });
 assert.equal(fusion.state,'audio-visual-owner-agreement');
 assert.equal(fusion.agreement,true);
 assert.equal(fusion.objectId,'tv');
 assert.equal(mediaVisualLookupAllowed(fusion),true);
});

test('V2F audio/visual owner-map conflict is explicit and blocks title lookup',()=>{
 const scene=sceneWith({
  id:'tv',name:'TV',kind:'device',role:'display',audioDirection:'left'
 });
 const visual=normalizeMediaVisualObservation({
  text:'Example Stream Example Series',objectId:'tv',evidenceId:'ocr-1',confidence:.9,at:1000
 });
 const fusion=fuseRoomMediaEvidence({
  scene,mediaKind:'television',audioDirection:'right',audioConfidence:.9,
  visualObservation:visual
 });
 assert.equal(fusion.state,'audio-visual-owner-conflict');
 assert.equal(fusion.agreement,false);
 assert.equal(mediaVisualLookupAllowed(fusion),false);
 assert.match(roomMediaFusionMessage(fusion),/conflict/i);
});

test('V2F unmapped visual object cannot authorize media search',()=>{
 const scene=sceneWith({
  id:'tv',name:'TV',kind:'device',role:'display',audioDirection:'center'
 });
 const fusion=fuseRoomMediaEvidence({
  scene,mediaKind:'television',audioDirection:'center',audioConfidence:.8,
  visualObservation:{text:'Some Show Title',objectId:'not-mapped',confidence:.9,at:1000}
 });
 assert.equal(fusion.state,'visual-object-unmapped');
 assert.equal(mediaVisualLookupAllowed(fusion),false);
});

test('V2F multiple owner devices on same audio direction remain ambiguous',()=>{
 const scene=sceneWith(
  {id:'tv1',name:'TV 1',kind:'device',role:'display',audioDirection:'center'},
  {id:'tv2',name:'TV 2',kind:'device',role:'display',audioDirection:'center'}
 );
 const fusion=fuseRoomMediaEvidence({
  scene,mediaKind:'television',audioDirection:'center',audioConfidence:.8
 });
 assert.equal(fusion.state,'audio-owner-device-ambiguous');
 assert.equal(fusion.objectId,null);
});

test('V2F fusion tracker deduplicates unchanged source context',()=>{
 const tracker=new RoomMediaFusionTracker({repeatMs:30000});
 const scene=sceneWith({
  id:'tv',name:'TV',kind:'device',role:'display',audioDirection:'right'
 });
 const fusion=fuseRoomMediaEvidence({
  scene,mediaKind:'television',audioDirection:'right',audioConfidence:.8
 });
 assert.equal(tracker.observe(fusion,1000).emit,true);
 assert.equal(tracker.observe(fusion,5000).emit,false);
 assert.equal(tracker.observe(fusion,31001).emit,true);
});

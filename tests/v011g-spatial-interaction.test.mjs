import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 normalizeFloorCalibration,floorHomography,mapCameraPointToFloor,trackFootpoint,
 calibratedTrackPosition,listenerRelation,calibratedPairDistance,calibratedReplyVolume
} from '../src/spatial-calibration-core.js';
import {
 ROOM_SCENE_SCHEMA,emptyRoomScene,normalizeRoomScene,setRoomCalibration,
 clearRoomCalibration,roomSceneGraph
} from '../src/room-scene-graph.js';
import {orbSpatialTarget} from '../src/orb-spatial-core.js';

const calibration=(extra={})=>({
 mode:'floor-plane',widthM:4,depthM:6,
 points:{
  nearLeft:{x:.05,y:.92},nearRight:{x:.95,y:.92},
  farRight:{x:.72,y:.22},farLeft:{x:.28,y:.22}
 },
 listener:{xM:2,depthM:0},updatedAt:1000,...extra
});
const track=(id='t1',extra={})=>({
 id,participantId:'p1',participantName:'Pat',status:'matched',
 box:{x:.4,y:.3,width:.2,height:.25},...extra
});
const close=(a,b,t=.001)=>Math.abs(a-b)<=t;

test('11G floor calibration is explicit, bounded and rejects corrupt or degenerate geometry',()=>{
 const c=normalizeFloorCalibration(calibration());
 assert.equal(c.mode,'floor-plane');
 assert.equal(c.provenance,'owner-defined-floor-plane');
 assert.equal(c.units,'meters');
 assert.equal(c.widthM,4);
 assert.equal(c.depthM,6);
 assert.deepEqual(c.listener,{xM:2,depthM:0});
 assert.equal(normalizeFloorCalibration({...calibration(),widthM:.1}),null);
 assert.equal(normalizeFloorCalibration({...calibration(),points:{
  nearLeft:{x:.1,y:.1},nearRight:{x:.2,y:.2},farRight:{x:.3,y:.3},farLeft:{x:.4,y:.4}
 }}),null);
 assert.equal(normalizeFloorCalibration({...calibration(),listener:{xM:99,depthM:0}}),null);
 assert.ok(floorHomography(c));
});

test('11G owner floor corners map exactly to measured plane corners',()=>{
 const c=normalizeFloorCalibration(calibration());
 const p0=mapCameraPointToFloor(c,c.points.nearLeft);
 const p1=mapCameraPointToFloor(c,c.points.nearRight);
 const p2=mapCameraPointToFloor(c,c.points.farRight);
 const p3=mapCameraPointToFloor(c,c.points.farLeft);
 assert.ok(close(p0.xM,0)&&close(p0.depthM,0));
 assert.ok(close(p1.xM,4)&&close(p1.depthM,0));
 assert.ok(close(p2.xM,4)&&close(p2.depthM,6));
 assert.ok(close(p3.xM,0)&&close(p3.depthM,6));
});

test('11G current track footpoint maps to approximate calibrated floor position, occlusion never does',()=>{
 const c=normalizeFloorCalibration(calibration());
 const t=track();
 const foot=trackFootpoint(t);
 assert.deepEqual(foot,{x:.5,y:.55});
 const pos=calibratedTrackPosition(c,t);
 assert.equal(pos.status,'calibrated-floor');
 assert.equal(pos.coordinateSpace,'owner-calibrated-floor-plane');
 assert.equal(pos.provenance,'owner-defined-floor-plane');
 assert.equal(pos.precision,'approximate-planar-projection');
 assert.ok(pos.xM>1&&pos.xM<3);
 assert.ok(pos.depthM>1&&pos.depthM<5);
 assert.equal(calibratedTrackPosition(c,{...t,status:'occluded'}).status,'not-current');
 assert.equal(calibratedTrackPosition(c,{...t,box:{x:.4,y:.75,width:.2,height:.25}}).status,'footpoint-unavailable');
});

test('11G listener relation and pair distance are approximate planar values with provenance',()=>{
 const c=normalizeFloorCalibration(calibration());
 const a=calibratedTrackPosition(c,track('a',{box:{x:.4,y:.3,width:.2,height:.25}}));
 const b=calibratedTrackPosition(c,track('b',{participantId:'p2',box:{x:.2,y:.3,width:.2,height:.25}}));
 const relation=listenerRelation(c,a);
 assert.ok(relation.distanceM>0);
 assert.equal(relation.provenance,'owner-defined-floor-plane+listener-anchor');
 assert.equal(relation.precision,'approximate-planar-projection');
 assert.ok(['left','right','ahead'].includes(relation.direction));
 const pair=calibratedPairDistance(c,track('a'),track('b',{participantId:'p2',box:{x:.2,y:.3,width:.2,height:.25}}));
 assert.ok(pair.distanceM>0);
 assert.equal(pair.provenance,'owner-defined-floor-plane');
 const volume=calibratedReplyVolume(c,relation);
 assert.ok(volume>=.6&&volume<=.93);
});

test('11G scene schema migrates old camera-only maps and persists calibration metadata only',()=>{
 const old={version:1,id:'local-room',areas:[{
  id:'desk',name:'Desk',kind:'desk',rect:{x:.1,y:.1,width:.4,height:.4}
 }],objects:[]};
 const migrated=normalizeRoomScene(old);
 assert.ok(ROOM_SCENE_SCHEMA>=2);
 assert.equal(migrated.version,ROOM_SCENE_SCHEMA);
 assert.equal(migrated.calibration,null);
 const calibrated=setRoomCalibration(migrated,calibration());
 assert.equal(calibrated.calibration.widthM,4);
 const clean=normalizeRoomScene({...calibrated,participants:[{id:'p'}],liveTrack:{x:1},frame:'raw'});
 assert.equal(clean.participants,undefined);
 assert.equal(clean.liveTrack,undefined);
 assert.equal(clean.frame,undefined);
 assert.equal(clearRoomCalibration(clean).calibration,null);
 assert.equal(emptyRoomScene().calibration,null);
});

test('11G room graph keeps camera-area association and calibrated floor projection as separate evidence',()=>{
 const scene=setRoomCalibration({
  ...emptyRoomScene(),areas:[{id:'desk',name:'Desk',kind:'desk',
   rect:{x:.3,y:.2,width:.4,height:.6},provenance:'owner-defined'}]
 },calibration());
 const graph=roomSceneGraph(scene,[track()]);
 assert.equal(graph.links.length,1);
 assert.equal(graph.links[0].association.status,'camera-relative');
 assert.equal(graph.links[0].association.areaId,'desk');
 assert.equal(graph.links[0].spatial.status,'calibrated-floor');
 assert.equal(graph.links[0].spatial.participantId,'p1');
});

test('11G orb keeps screen-follow geometry but uses calibrated listener distance only when explicit calibration exists',()=>{
 const view={videoWidth:1280,videoHeight:720,displayWidth:960,displayHeight:540,mirror:false};
 const t=track();
 const legacy=orbSpatialTarget([t],view,'p1');
 assert.equal(legacy.distanceMode,'camera-relative');
 assert.equal(legacy.distanceM,null);
 const calibrated=orbSpatialTarget([t],view,'p1',calibration());
 assert.equal(calibrated.distanceMode,'calibrated-floor');
 assert.ok(calibrated.distanceM>0);
 assert.ok(Number.isFinite(calibrated.bearingDeg));
 assert.ok(calibrated.volume>=.6&&calibrated.volume<=.93);
 assert.equal(calibrated.spatialPosition.precision,'approximate-planar-projection');
});

test('11G ROOM calibration UI is explicit, local, mirror-aware and reuses existing scene persistence',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const ui=fs.readFileSync('src/room-scene-ui.js','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 for(const id of ['roomCalibrationWidthM','roomCalibrationDepthM','roomCalibrationCapture',
  'roomCalibrationSave','roomCalibrationClear','roomCalibrationStatus'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/near-left, near-right, far-right, far-left/i);
 assert.match(html,/does not create a 3-D room model/i);
 assert.match(ui,/mirror\(\)\?1-visible\.x:visible\.x/);
 assert.match(ui,/setRoomCalibration/);
 assert.match(ui,/clearRoomCalibration/);
 assert.match(ui,/saveRoomScene\(safe\)/);
 assert.match(store,/optional floor-plane/);
 assert.doesNotMatch(ui,/getUserMedia|MediaRecorder|captureStream/);
});

test('11G AGENT uses calibrated distance only through canonical scene closure and labels uncertainty',()=>{
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(controller,/getScene:\(\)=>sceneUI\?\.getScene\(\)\|\|emptyRoomScene\(\)/);
 assert.match(agent,/getScene=\(\)=>null/);
 assert.match(agent,/orbSpatialTarget\([^;]+calibration\)/s);
 assert.match(agent,/Owner-calibrated floor plane/);
 assert.match(agent,/approximate planar projection/);
 assert.match(html,/id="agentSpatialStatus"/);
 assert.match(html,/explicit floor calibration \+ listener anchor/i);
});

test('11G calibration core contains no sensor, network, identity or raw-media path',()=>{
 const core=fs.readFileSync('src/spatial-calibration-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|participant-store|embedding|transcript|rawAudio|imageData/);
});

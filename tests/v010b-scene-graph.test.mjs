import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROOM_SCENE_SCHEMA,MAX_ROOM_AREAS,MAX_ROOM_OBJECTS,normalizeAreaRect,
 emptyRoomScene,normalizeRoomScene,upsertRoomArea,removeRoomArea,upsertRoomObject,
 removeRoomObject,sceneTrackAssociation,mirroredAreaRect,roomSceneGraph
} from '../src/room-scene-graph.js';
const area=(id,x,y,width,height)=>({id,name:id,kind:'zone',rect:{x,y,width,height}});
test('10B normalized camera areas are finite, bounded, owner-defined and not floor distances',()=>{
 assert.equal(normalizeAreaRect({x:-.1,y:.2,width:.3,height:.2}),null);
 assert.equal(normalizeAreaRect({x:.8,y:.3,width:.3,height:.3}),null);
 assert.equal(normalizeAreaRect({x:.1,y:.1,width:Infinity,height:.3}),null);
 assert.equal(normalizeAreaRect({x:.1,y:.1,width:.01,height:.3}),null);
 let scene=upsertRoomArea(emptyRoomScene(),area('desk',.12,.24,.3,.46));
 assert.equal(scene.version,ROOM_SCENE_SCHEMA);
 assert.equal(scene.areas[0].provenance,'owner-defined');
 assert.equal(scene.areas[0].rect.width,.3);
 scene=upsertRoomArea(scene,area('desk',.2,.3,.3,.4));
 assert.equal(scene.areas.length,1,'editing retains stable area ID');
 assert.equal(scene.areas[0].rect.x,.2);
 assert.deepEqual(mirroredAreaRect(scene.areas[0],true),{x:.5,y:.3,width:.3,height:.4});
});
test('10B sanitized persistent scene has unique owner labels, no media and bounded objects',()=>{
 const raw={areas:[area('a',.1,.1,.4,.4),area('a',.5,.5,.4,.4),
  {...area('b',.3,.4,.2,.2),rawImage:'secret'}],
  objects:[{id:'monitor',name:'Monitor',areaId:'a',kind:'device',embedding:[1,2,3]},
   {id:'unknown-object',name:'Unknown',areaId:'not-an-area',kind:'weird'}],
  rawFrame:'do not persist',participants:[{id:'person'}]};
 const clean=normalizeRoomScene(raw);
 assert.deepEqual(clean.areas.map(a=>a.id),['a','b']);
 assert.equal(clean.areas[1].rawImage,undefined);
 assert.equal(clean.objects[0].embedding,undefined);
 assert.equal(clean.objects[1].areaId,null);
 assert.equal(clean.rawFrame,undefined);
 assert.equal(clean.participants,undefined);
 let room=upsertRoomObject(clean,{id:'lamp',name:'Lamp',kind:'device',areaId:'b'});
 assert.equal(room.objects[2].areaId,'b');
 room=removeRoomArea(room,'b');
 assert.equal(room.objects[2].areaId,null,'area deletion must not silently delete the object');
 assert.equal(removeRoomObject(room,'monitor').objects.length,2);
 assert.throws(()=>upsertRoomObject(room,{id:'bad',name:'Bad',areaId:'not-there'}),/existing/);
});
test('10B does not guess area on overlap, occlusion or cropped footpoints',()=>{
 let scene=emptyRoomScene();
 scene=upsertRoomArea(scene,area('entry',.1,.2,.5,.65));
 scene=upsertRoomArea(scene,area('desk',.3,.2,.55,.65));
 const overlap={id:'one',participantId:'p',status:'matched',
  box:{x:.4,y:.25,width:.2,height:.28}};
 assert.deepEqual(sceneTrackAssociation(scene,overlap).candidates,['entry','desk']);
 assert.equal(sceneTrackAssociation(scene,overlap).areaId,null);
 assert.equal(sceneTrackAssociation(scene,{...overlap,status:'occluded'}).status,'unavailable');
 assert.equal(sceneTrackAssociation(scene,{...overlap,box:{x:.1,y:.55,width:.2,height:.45}}).status,
  'uncertain-footpoint');
 const exclusive={...overlap,box:{x:.1,y:.25,width:.2,height:.28}};
 assert.equal(sceneTrackAssociation(scene,exclusive).areaId,'entry');
 const graph=roomSceneGraph(scene,[exclusive,{...exclusive,id:'visitor',participantId:null}]);
 assert.equal(graph.links.length,2);
 assert.equal(graph.links[0].identity,'enrolled-verified');
 assert.equal(graph.links[1].identity,'unverified');
 assert.equal(graph.scene.areas.length,2);
 assert.equal(emptyRoomScene().areas.length,0);
});
test('10B caps local area and object counts and strips corrupt or duplicate rows',()=>{
 let room=emptyRoomScene();
 for(let i=0;i<MAX_ROOM_AREAS;i++)room=upsertRoomArea(room,area('a'+i,.01,.01,.3,.3));
 assert.throws(()=>upsertRoomArea(room,area('overflow',.2,.2,.3,.3)),/Maximum/);
 for(let i=0;i<MAX_ROOM_OBJECTS;i++)room=upsertRoomObject(room,{id:'o'+i,name:'Object '+i,areaId:'a1'});
 assert.throws(()=>upsertRoomObject(room,{name:'One too many'}),/Maximum/);
 assert.equal(normalizeRoomScene({...room,objects:[...room.objects,room.objects[0]]}).objects.length,MAX_ROOM_OBJECTS);
});
test('10B is integrated into existing IndexedDB, ROOM timeline and release without new camera',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const ui=fs.readFileSync('src/room-scene-ui.js','utf8');
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const markup=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(store,/const DB_VERSION = 4/);
 assert.match(store,/db\.createObjectStore\(ROOM_SCENE,\{keyPath:'id'\}\)/);
 assert.match(store,/normalizeRoomScene\(scene\)/);
 assert.match(ui,/await loadRoomScene\(\)/);
 assert.match(ui,/await writeQueue\.catch/);
 assert.match(ui,/onChange\(message\)/);
 assert.match(controller,/sceneUI\?\.renderTracks\(visible\)/);
 assert.match(controller,/semantic:'owner-map-edit'/);
 assert.match(markup,/id="roomAreaPreview"/);
 assert.match(markup,/id="roomAreaForm"/);
 assert.match(markup,/id="roomObjectForm"/);
 assert.doesNotMatch(ui,/getUserMedia|MediaRecorder|captureStream|rawAudio/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RoomTemporalLedger,MAX_TEMPORAL_TRACKS} from '../src/room-temporal-core.js';
import {emptyRoomScene,upsertRoomArea} from '../src/room-scene-graph.js';
const room=()=>{
 let scene=upsertRoomArea(emptyRoomScene(),{id:'desk',name:'Desk',rect:{x:.1,y:.1,width:.35,height:.65}});
 return upsertRoomArea(scene,{id:'entry',name:'Entrance',kind:'entrance',
  rect:{x:.6,y:.1,width:.35,height:.65}});
};
const track=(x,seq,extra={})=>({
 id:'body-1',participantId:'enrolled-a',participantName:'Enrolled A',status:'matched',
 box:{x:x-.06,y:.30,width:.12,height:.25},bodyObservations:seq,...extra
});
test('10C real camera measurements produce one dwell and stationary observation, never sleep/posture inference',()=>{
 const engine=new RoomTemporalLedger({areaConfirmationSamples:3,areaConfirmationMs:1000,
  areaDwellMs:10000,stationaryMs:12000,gapResetMs:5000});
 const area=room(),events=[];
 for(const [at,seq] of [[0,1],[600,2],[1200,3],[4000,4],[7000,5],[10000,6],[13000,7],[16000,8]]){
  events.push(...engine.update([track(.2,seq)],area,at));
 }
 assert.equal(events.filter(e=>e.semantic==='area-dwell').length,1);
 assert.equal(events.filter(e=>e.semantic==='stationary-period').length,1);
 assert.equal(events.filter(e=>e.semantic==='area-transition').length,0,'initial appearance is not a transition');
 assert.equal(events.every(e=>!/(is sleeping|is seated|fell asleep|metres travelled|meters travelled)/i.test(e.message)),true);
 assert.ok(events.some(e=>/sleep unknown/.test(e.message)),'uncertainty should be explicit');
 const summary=engine.summary(area,16000)[0];
 assert.equal(summary.areaName,'Desk');
 assert.ok(summary.areaDwellMs>=10000);
 assert.ok(summary.stationaryMs>=12000);
});
test('10C area transitions require multiple real frames and preserve only verified participant ID',()=>{
 const engine=new RoomTemporalLedger({areaConfirmationSamples:3,areaConfirmationMs:1000,
  gapResetMs:5000,motionCooldownMs:5000});
 const area=room();
 engine.update([track(.2,1)],area,0);
 engine.update([track(.2,2)],area,600);
 engine.update([track(.2,3)],area,1200);
 const first=engine.update([track(.7,4)],area,2000);
 assert.equal(first.filter(e=>e.semantic==='area-transition').length,0);
 assert.equal(first.filter(e=>e.semantic==='camera-motion').length,1);
 assert.equal(engine.update([track(.7,4)],area,9000).length,0,'UI repaint is not new evidence');
 engine.update([track(.7,5)],area,2600);
 const events=engine.update([track(.7,6)],area,3400);
 assert.equal(events.filter(e=>e.semantic==='area-transition').length,1);
 assert.equal(events[0].participantId,'enrolled-a');
 assert.match(events[0].message,/Entranc[e]/);
 assert.doesNotMatch(events[0].message,/left the room|metres traveled/);
});
test('10C occlusion and long observation gap reset continuity without departure or silence claims',()=>{
 const engine=new RoomTemporalLedger({areaConfirmationSamples:2,areaConfirmationMs:100,
  stationaryMs:1000,areaDwellMs:800,gapResetMs:900});
 const scene=room();
 engine.update([track(.2,1)],scene,0);
 engine.update([track(.2,2)],scene,150);
 assert.deepEqual(engine.update([track(.2,2,{status:'occluded'})],scene,300),[]);
 assert.equal(engine.summary(scene,300)[0].visibility,'uncertain');
 const regained=engine.update([track(.7,3)],scene,500);
 assert.equal(regained.filter(e=>e.semantic==='area-transition').length,0);
 assert.equal(engine.update([],scene,1000).length,0);
 assert.deepEqual(engine.update([],scene,4000),[]);
 assert.equal(engine.summary(scene,4000)[0]?.visibility,'uncertain');
 engine.unavailable();
 assert.deepEqual(engine.summary(scene,4100),[]);
 assert.equal(engine.update([track(.7,4)],scene,4200).length,0);
});
test('10C overlapping camera areas and map edits do not fabricate transitions or area dwell',()=>{
 const scene=upsertRoomArea(room(),{id:'overlap',name:'Overlapping',
  rect:{x:.1,y:.1,width:.35,height:.65}});
 const engine=new RoomTemporalLedger({areaConfirmationSamples:2,areaConfirmationMs:100,
  areaDwellMs:1000,stationaryMs:10000});
 let events=[];
 for(const [at,seq] of [[0,1],[200,2],[500,3],[1200,4],[1600,5]])
  events.push(...engine.update([track(.2,seq)],scene,at));
 assert.equal(events.filter(e=>['area-transition','area-dwell'].includes(e.semantic)).length,0);
 engine.sceneChanged();
 assert.equal(engine.summary(scene,1700)[0].areaName,null);
});
test('10C unknown visitor remains unverified and does not receive enrolled participant attribution',()=>{
 const engine=new RoomTemporalLedger({areaConfirmationSamples:2,areaConfirmationMs:100,
  motionCooldownMs:0});
 const base=track(.2,1,{participantId:null,participantName:'Forged identity',visitorId:'visitor-1'});
 engine.update([base],room(),0);
 const events=engine.update([{...base,box:track(.7,2).box,bodyObservations:2}],room(),200);
 assert.equal(events.length,1);
 assert.equal(events[0].participantId,null);
 assert.match(events[0].message,/Unverified visitor/);
 assert.doesNotMatch(events[0].message,/Forged identity/);
});
test('10C bounded state and lifecycle/UI integration preserve existing canonical captures',()=>{
 const engine=new RoomTemporalLedger();
 const scene=room();
 const many=Array.from({length:MAX_TEMPORAL_TRACKS+5},(_,i)=>track(.2,i+1,
  {id:'body-'+i,participantId:'p'+i}));
 engine.update(many,scene,1000);
 assert.ok(engine.records.size<=MAX_TEMPORAL_TRACKS);
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const markup=fs.readFileSync('vertical-motion.html','utf8');
 const core=fs.readFileSync('src/room-temporal-core.js','utf8');
 assert.match(controller,/roomTemporal\.update\(visible,scene,Date\.now\(\)\)/);
 assert.match(controller,/roomTemporal\.unavailable\(\)/);
 assert.match(controller,/roomTemporal\.sceneChanged\(\)/);
 assert.match(controller,/roomLedger\.append\((?:observation|scoped)\)/);
 assert.match(markup,/id="roomTemporalSummary"/);
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|localStorage|indexedDB/);
});

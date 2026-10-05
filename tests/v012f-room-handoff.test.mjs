import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RoomHandoffTracker,roomHandoffMessage,roomHandoffTurnFields} from '../src/room-handoff-core.js';

test('12F camera loss is uncertain departure and never proves a room exit',()=>{
 const tracker=new RoomHandoffTracker();
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 const lost=tracker.outOfView({participantId:'p1',roomId:'kitchen',at:3000});
 assert.equal(lost.state,'uncertain-departure');
 assert.equal(lost.currentRoomId,null);
 assert.equal(lost.lastKnownRoomId,'kitchen');
 assert.ok(lost.provenance.includes('no-departure-inference'));
});

test('12F same-room re-entry preserves participant identity without inventing a transition',()=>{
 const tracker=new RoomHandoffTracker({reentryWindowMs:10000});
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 tracker.outOfView({participantId:'p1',roomId:'kitchen',at:3000});
 const back=tracker.observe({participantId:'p1',roomId:'kitchen',at:5000});
 assert.equal(back.state,'reentered');
 assert.equal(back.currentRoomId,'kitchen');
 assert.equal(back.transition.type,'same-room-reentry');
 assert.equal(back.transition.fromRoomId,undefined);
});

test('12F cross-room observation without explicit handoff abstains from teleport inference',()=>{
 const tracker=new RoomHandoffTracker({staleMs:20000,simultaneousWindowMs:2000});
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 tracker.outOfView({participantId:'p1',roomId:'kitchen',at:3000});
 const office=tracker.observe({participantId:'p1',roomId:'office',at:5000});
 assert.equal(office.state,'cross-room-unlinked');
 assert.equal(office.currentRoomId,null);
 assert.deepEqual(office.candidateRoomIds,['kitchen','office']);
 assert.ok(office.provenance.includes('no-teleport-inference'));
});

test('12F explicit handoff requires target-room observation before confirmation',()=>{
 const tracker=new RoomHandoffTracker({handoffConfirmMs:10000});
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 const pending=tracker.declareHandoff({
  participantId:'p1',fromRoomId:'kitchen',toRoomId:'office',at:3000
 });
 assert.equal(pending.state,'handoff-pending');
 assert.equal(pending.currentRoomId,null);
 const confirmed=tracker.observe({participantId:'p1',roomId:'office',at:6000});
 assert.equal(confirmed.state,'handoff-confirmed');
 assert.equal(confirmed.currentRoomId,'office');
 assert.deepEqual(
  [confirmed.transition.fromRoomId,confirmed.transition.toRoomId],
  ['kitchen','office']
 );
});

test('12F simultaneous current observations are conflict, not identity duplication or movement',()=>{
 const tracker=new RoomHandoffTracker({simultaneousWindowMs:5000});
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 const conflict=tracker.observe({participantId:'p1',roomId:'office',at:2500});
 assert.equal(conflict.state,'simultaneous-room-conflict');
 assert.equal(conflict.currentRoomId,null);
 assert.deepEqual(conflict.candidateRoomIds,['office','kitchen']);
 assert.match(roomHandoffMessage(conflict),/no room transition inferred/);
});

test('12F stale prior room evidence allows a current observation but still does not infer route',()=>{
 const tracker=new RoomHandoffTracker({staleMs:3000,simultaneousWindowMs:1000});
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 const current=tracker.observe({participantId:'p1',roomId:'office',at:7000});
 assert.equal(current.state,'observed-after-stale-gap');
 assert.equal(current.currentRoomId,'office');
 assert.equal(current.transition,null);
 assert.ok(current.provenance.includes('no-route-inference'));
});

test('12F explicit departure is distinct from camera absence',()=>{
 const tracker=new RoomHandoffTracker();
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 const left=tracker.declareDeparture({participantId:'p1',roomId:'kitchen',at:2000});
 assert.equal(left.state,'departed');
 assert.equal(left.transition.type,'explicit-room-departure');
 const elsewhere=tracker.observe({participantId:'p1',roomId:'office',at:5000});
 assert.equal(elsewhere.state,'observed-after-explicit-departure');
 assert.equal(elsewhere.currentRoomId,'office');
 assert.equal(elsewhere.transition,null);
});

test('12F participant deletion removes room handoff state',()=>{
 const tracker=new RoomHandoffTracker();
 tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 tracker.reconcileParticipants([]);
 assert.equal(tracker.snapshot().length,0);
});

test('12F bounded turn fields contain room metadata only',()=>{
 const tracker=new RoomHandoffTracker();
 const state=tracker.observe({participantId:'p1',roomId:'kitchen',at:1000});
 const fields=roomHandoffTurnFields(state);
 assert.equal(fields.currentRoomId,'kitchen');
 const json=JSON.stringify(fields);
 for(const forbidden of ['embedding','samples','pcm','rawAudio','photo','box'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('12F owner-defined room identity persists inside existing room map record',()=>{
 const graph=fs.readFileSync('src/room-scene-graph.js','utf8');
 const ui=fs.readFileSync('src/room-scene-ui.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(graph,/roomIdentityId/);
 assert.match(graph,/export function setRoomIdentity/);
 assert.match(ui,/roomIdentityForm/);
 assert.match(html,/id="roomIdentityForm"/);
});

test('12F canonical ROOM observations carry room id and runtime feeds stable presence into handoff tracker',()=>{
 const events=fs.readFileSync('src/room-event-core.js','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(events,/roomId:/);
 assert.match(store,/roomId:record\.roomId/);
 assert.match(runtime,/RoomHandoffTracker/);
 assert.match(runtime,/roomHandoffTracker\.observe/);
 assert.match(runtime,/roomHandoffTracker\.outOfView/);
 assert.match(runtime,/roomId:currentRoomIdentity\(\)\.id/);
});

test('12F pure handoff layer opens no media, persistence or network path',()=>{
 const core=fs.readFileSync('src/room-handoff-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
});

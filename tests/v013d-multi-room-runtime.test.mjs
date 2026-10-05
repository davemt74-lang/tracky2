import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 MULTI_ROOM_NODE_STALE_MS,MultiRoomEventLedger,MultiRoomNodeRegistry,
 arbitratePrimaryNode,normalizeMultiRoomObservation,participantRoomArbitration,roomNodeHealth
} from '../src/multi-room-runtime-core.js';

const node=(id,roomId,seen=10000,extra={})=>({id,roomId,roomName:roomId,
 serverSeenAt:seen,clientAt:seen-250,connectedAt:1000,...extra});
const event=(id,nodeId,roomId,participantId,at=10000,extra={})=>({
 id,nodeId,roomId,participantId,semantic:'participant-observed',
 clientObservedAt:at-500,serverReceivedAt:at,...extra
});

test('13D two healthy nodes in different rooms remain independently registered',()=>{
 const r=new MultiRoomNodeRegistry();
 r.update(node('node-a','kitchen'));
 r.update(node('node-b','office'));
 assert.equal(r.snapshot(11000).length,2);
 assert.equal(r.primary('kitchen',{now:11000}).primaryNodeId,'node-a');
 assert.equal(r.primary('office',{now:11000}).primaryNodeId,'node-b');
});

test('13D same-room duplicate nodes use deterministic primary arbitration',()=>{
 const rows=[node('node-b','kitchen',10000,{connectedAt:2000}),
  node('node-a','kitchen',10000,{connectedAt:1000})];
 let result=arbitratePrimaryNode(rows,{roomId:'kitchen',now:11000});
 assert.equal(result.primaryNodeId,'node-a');
 result=arbitratePrimaryNode(rows,{roomId:'kitchen',preferredNodeId:'node-b',now:11000});
 assert.equal(result.state,'explicit-primary');
 assert.equal(result.primaryNodeId,'node-b');
});

test('13D stale nodes lose primary authority',()=>{
 const stale=node('node-a','kitchen',1000);
 assert.equal(roomNodeHealth(stale,1000+MULTI_ROOM_NODE_STALE_MS+1).state,'stale');
 assert.equal(arbitratePrimaryNode([stale],{roomId:'kitchen',
  now:1000+MULTI_ROOM_NODE_STALE_MS+1}).primaryNodeId,null);
});

test('13D remote observations are server-time normalized and retain bounded skew metadata',()=>{
 const e=normalizeMultiRoomObservation(event('event-1','node-a','kitchen','p1',50000,{
  clientObservedAt:1
 }),node('node-a','kitchen',50000),50000);
 assert.equal(e.normalizedAt,50000);
 assert.equal(e.clockSkewMs,30000);
 assert.equal(e.source,'multi-room-node');
});

test('13D duplicate observations are idempotent',()=>{
 const ledger=new MultiRoomEventLedger();
 assert.equal(ledger.ingest(event('event-1','node-a','kitchen','p1'),null,10000).added,true);
 assert.equal(ledger.ingest(event('event-1','node-a','kitchen','p1'),null,10000).reason,'duplicate-event');
 assert.equal(ledger.snapshot().length,1);
});

test('13D simultaneous rooms create conflict and never infer a route',()=>{
 const ledger=new MultiRoomEventLedger();
 ledger.ingest(event('e1','a','kitchen','p1',10000),null,10000);
 ledger.ingest(event('e2','b','office','p1',12000),null,12000);
 const result=participantRoomArbitration(ledger.snapshot(),{participantId:'p1',now:12000});
 assert.equal(result.state,'conflict');
 assert.equal(result.roomId,null);
 assert.deepEqual([...result.candidateRoomIds].sort(),['kitchen','office']);
 assert.match(result.reason,/no-teleport/);
});

test('13D explicit handoff target wins only after target room observation exists',()=>{
 const ledger=new MultiRoomEventLedger();
 ledger.ingest(event('e1','a','kitchen','p1',10000),null,10000);
 let result=participantRoomArbitration(ledger.snapshot(),{
  participantId:'p1',now:10000,explicitTargetRoomId:'office'
 });
 assert.equal(result.state,'observed');
 assert.equal(result.roomId,'kitchen');
 ledger.ingest(event('e2','b','office','p1',11000),null,11000);
 result=participantRoomArbitration(ledger.snapshot(),{
  participantId:'p1',now:11000,explicitTargetRoomId:'office'
 });
 assert.equal(result.state,'explicit-target-observed');
 assert.equal(result.roomId,'office');
});

test('13D participant deletion scrubs cross-room observation references',()=>{
 const ledger=new MultiRoomEventLedger();
 ledger.ingest(event('e1','a','kitchen','p1'),null,10000);
 ledger.ingest(event('e2','b','office','p2'),null,10000);
 ledger.reconcileParticipants(['p2']);
 assert.deepEqual(ledger.snapshot().map(row=>row.participantId),['p2']);
});

test('13D runtime transport is same-origin authenticated and bounded',()=>{
 const client=fs.readFileSync('src/multi-room-runtime.js','utf8');
 assert.match(client,/\.\/server\/session\.php/);
 assert.match(client,/\.\/server\/room-node-api\.php/);
 assert.match(client,/credentials:'same-origin'/);
 assert.match(client,/X-CSRF-Token/);
 assert.match(client,/MAX_PENDING=32/);
 assert.doesNotMatch(client,/wss?:\/\//);
});

test('13D server schema provides room node registry and deduplicated observations',()=>{
 const boot=fs.readFileSync('server/bootstrap.php','utf8');
 const api=fs.readFileSync('server/room-node-api.php','utf8');
 assert.match(boot,/TRACKY_SCHEMA_VERSION=3/);
 assert.match(boot,/CREATE TABLE IF NOT EXISTS room_nodes/);
 assert.match(boot,/CREATE TABLE IF NOT EXISTS room_node_observations/);
 assert.match(boot,/rooms\.read/);
 assert.match(boot,/rooms\.write/);
 assert.match(api,/INSERT INTO room_nodes/);
 assert.match(api,/INSERT OR IGNORE INTO room_node_observations/);
 assert.match(api,/server_received_at/);
 assert.match(api,/tracky_check_csrf/);
});

test('13D runtime integrates remote observations with existing no-teleport handoff tracker',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/MultiRoomRuntimeClient/);
 assert.match(runtime,/multiRoomRuntime\.publishObservation/);
 assert.match(runtime,/applyRemoteRoomObservation/);
 assert.match(runtime,/roomHandoffTracker\.observe/);
 assert.match(runtime,/roomHandoffTracker\.declareHandoff/);
});

test('13D pure runtime core has no media, storage, network, transcript or identity mutation side effects',()=>{
 const core=fs.readFileSync('src/multi-room-runtime-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|transcript|embedding\(/);
});

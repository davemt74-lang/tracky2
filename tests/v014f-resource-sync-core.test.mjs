import test from 'node:test';import assert from 'node:assert/strict';
import {
 RESOURCE_SYNC_TYPES,RESOURCE_SYNC_QUOTAS,changeForResourceServer,defaultResourceSyncState,
 journalEntry,planResourceSync,projectSyncPayload,resourceFingerprint,
 resourceSyncStateAfterRecord,syncEligibleResource
} from '../src/resource-sync-core.js';

const memory=(more={})=>({id:'memory01',type:'preference',participantId:null,text:'Prefers tea',
 authority:'owner',provenance:'owner-authored',createdAt:10,updatedAt:20,status:'active',
 revisions:[],persistent:true,...more});
const task=(more={})=>({id:'task0001',schema:2,skillId:'describe_object',targetId:'obj',
 targetSource:'local-owner-defined',status:'succeeded',createdAt:10,updatedAt:20,confirmedAt:12,completedAt:20,
 attempts:1,maxAttempts:2,resultText:'done',resultSources:[],...more});
const scene=(more={})=>({id:'local-room',version:4,roomIdentityId:'room-local',roomName:'Local room',
 areas:[],objects:[],calibration:null,...more});

test('14F allowlists only memory terminal task and scene resources',()=>{
 assert.deepEqual(RESOURCE_SYNC_TYPES,['memory','task','scene']);
 assert.equal(syncEligibleResource('memory',memory()),true);
 assert.equal(syncEligibleResource('task',task()),true);
 assert.equal(syncEligibleResource('task',task({status:'scheduled'})),false);
 assert.equal(syncEligibleResource('task',task({confirmedAt:null})),false);
 assert.equal(syncEligibleResource('scene',scene()),true);
 assert.equal(syncEligibleResource('dialogue',{id:'turn'}),false);
 assert.equal(syncEligibleResource('recording',{id:'rec'}),false);
});

test('14F projected payloads stay bounded to canonical metadata',()=>{
 const m=projectSyncPayload('memory',memory());
 assert.equal(m.authority,'owner');assert.equal(m.persistent,true);
 const t=projectSyncPayload('task',task({resultSources:[{title:'x',url:'https://example.com'}]}));
 assert.equal(t.status,'succeeded');assert.equal(t.resultSources.length,1);
 const s=projectSyncPayload('scene',scene());assert.equal(s.id,'local-room');
 for(const payload of [m,t,s]){
  const json=JSON.stringify(payload);
  for(const forbidden of ['rawAudio','recordingMedia','transcript','embedding','primaryPhoto','voiceSamples','faceSamples','apiKey','ciphertext'])
   assert.equal(json.includes(forbidden),false,forbidden);
 }
});

test('14F generic reconciliation is versioned and never auto-merges conflicts',()=>{
 const state={...defaultResourceSyncState('memory','memory01'),serverVersion:1,
  lastSyncedFingerprint:resourceFingerprint('memory',memory())};
 const server={id:'memory01',version:1,deleted:false,serverUpdatedAt:100,payload:memory()};
 assert.equal(planResourceSync({type:'memory',local:memory(),server,state}).action,'none');
 assert.equal(planResourceSync({type:'memory',local:memory({text:'Prefers coffee'}),server,state}).action,'push-upsert');
 assert.equal(planResourceSync({type:'memory',local:memory(),server:{...server,version:2},state}).action,'pull-server');
 assert.equal(planResourceSync({type:'memory',local:memory({text:'Prefers coffee'}),server:{...server,version:2},state}).action,'conflict');
});

test('14F local deletion becomes tombstone push and remote deletion pulls explicitly',()=>{
 const state={...defaultResourceSyncState('task','task0001'),serverVersion:2,
  lastSyncedFingerprint:resourceFingerprint('task',task())};
 const server={id:'task0001',version:2,deleted:false,payload:task()};
 assert.equal(planResourceSync({type:'task',local:null,server,state}).action,'push-delete');
 assert.equal(planResourceSync({type:'task',local:task(),server:{...server,version:3,deleted:true},state}).action,'pull-delete');
});

test('14F outgoing change carries stable idempotency ID and no arbitrary resource selector',()=>{
 const state=defaultResourceSyncState('memory','memory01');
 const change=changeForResourceServer('push-upsert',{
  type:'memory',local:memory(),server:null,state,changeId:'change0001'
 });
 assert.equal(change.changeId,'change0001');assert.equal(change.resourceType,'memory');
 assert.equal(change.operation,'upsert');assert.equal(change.baseVersion,0);
 assert.ok(change.payload);assert.ok(!('resourceUrl' in change));
 const del=changeForResourceServer('push-delete',{
  type:'memory',local:null,server:{id:'memory01',version:1},state:{...state,serverVersion:1},
  changeId:'change0002'
 });
 assert.equal(del.operation,'delete');assert.ok(!('payload' in del));
});

test('14F journal is ID-only metadata and quotas are explicit',()=>{
 const row=journalEntry({type:'scene',id:'local-room',operation:'pull-upsert',serverVersion:3,now:100});
 assert.equal(row.resourceType,'scene');assert.equal(row.status,'pending');
 assert.ok(!('payload' in row));assert.ok(!('ciphertext' in row));
 assert.equal(RESOURCE_SYNC_QUOTAS.scene,65536);
 assert.ok(RESOURCE_SYNC_QUOTAS.memory>0&&RESOURCE_SYNC_QUOTAS.task>0);
});

test('14F acknowledgement stores exact server version and local fingerprint',()=>{
 const state=defaultResourceSyncState('scene','local-room');
 const server={id:'local-room',version:4,serverUpdatedAt:9000};
 const next=resourceSyncStateAfterRecord('scene',state,server,scene(),10000);
 assert.equal(next.serverVersion,4);assert.equal(next.serverUpdatedAt,9000);
 assert.equal(next.lastSyncedFingerprint,resourceFingerprint('scene',scene()));
});

test('14F scene configuration cannot be tombstoned by metadata sync',()=>{
 assert.throws(()=>changeForResourceServer('push-delete',{
  type:'scene',local:null,server:{id:'local-room',version:1},
  state:{...defaultResourceSyncState('scene','local-room'),serverVersion:1},
  changeId:'change-scene-delete'
 }),/cannot be deleted/);
});

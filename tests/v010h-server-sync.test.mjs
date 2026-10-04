import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 changeForServer,defaultParticipantSyncState,localParticipantChanged,
 participantHasBiometrics,planParticipantSync,syncStateAfterServerRecord
} from '../src/server-sync-core.js';

const local=(extra={})=>({
 id:'participant01',name:'Pat',updatedAt:'2026-10-04T05:00:00.000Z',
 embeddings:[],voiceEmbeddings:[],...extra
});
const state=(extra={})=>({
 ...defaultParticipantSyncState('participant01'),enabled:true,serverVersion:1,
 lastSyncedLocalUpdatedAt:Date.parse('2026-10-04T05:00:00.000Z'),...extra
});
const server=(extra={})=>({
 id:'participant01',name:'Pat',profile:local(),version:1,
 serverUpdatedAt:1000,deleted:false,...extra
});

test('10H sync stays disabled until explicitly enabled',()=>{
 const p=planParticipantSync({local:local(),server:server(),
  state:defaultParticipantSyncState('participant01')});
 assert.equal(p.action,'disabled');
});

test('10H initial browser-only and server-only participants reconcile in one explicit direction',()=>{
 assert.equal(planParticipantSync({local:local(),server:null,
  state:{...defaultParticipantSyncState('participant01'),enabled:true}}).action,'push-upsert');
 assert.equal(planParticipantSync({local:null,server:server(),
  state:{...defaultParticipantSyncState('participant01'),enabled:true}}).action,'pull-server');
});

test('10H initial records existing on both sides never auto-merge',()=>{
 const p=planParticipantSync({local:local(),server:server({version:3}),
  state:{...defaultParticipantSyncState('participant01'),enabled:true}});
 assert.equal(p.action,'conflict');
 assert.equal(p.reason,'initial-record-exists-both-sides');
});

test('10H local edit, remote edit and two-sided edit resolve deterministically',()=>{
 const base=state();
 assert.equal(localParticipantChanged(local(),base),false);
 assert.equal(planParticipantSync({local:local({updatedAt:'2026-10-04T05:01:00.000Z'}),server:server(),state:base}).action,'push-upsert');
 assert.equal(planParticipantSync({local:local(),server:server({version:2}),state:base}).action,'pull-server');
 const both=planParticipantSync({local:local({updatedAt:'2026-10-04T05:01:00.000Z'}),
  server:server({version:2}),state:base});
 assert.equal(both.action,'conflict');
 assert.equal(both.reason,'both-sides-changed');
});

test('10H deletes use tombstones and conflict when other side changed',()=>{
 const pending=state({localDeletedAt:5000});
 assert.equal(planParticipantSync({local:null,server:server(),state:pending}).action,'push-delete');
 assert.equal(planParticipantSync({local:null,server:server({version:2}),state:pending}).action,'conflict');
 assert.equal(planParticipantSync({local:local(),server:server({version:2,deleted:true,deletedAt:6000}),state:state()}).action,'pull-delete');
});

test('10H biometric consent is independently detectable and server changes never contain arbitrary resources',()=>{
 assert.equal(participantHasBiometrics(local()),false);
 assert.equal(participantHasBiometrics(local({embeddings:[[.1,.2]]})),true);
 const upsert=changeForServer('push-upsert',{
  local:local({embeddings:[[.1,.2]]}),server:null,
  state:{...defaultParticipantSyncState('participant01'),enabled:true,consentConfirmedAt:1000}
 });
 assert.equal(upsert.operation,'upsert');
 assert.equal(upsert.consent,true);
 assert.equal(upsert.baseVersion,0);
 assert.ok(!('dialogueTurns' in upsert));
 assert.ok(!('roomEvents' in upsert));
 const del=changeForServer('push-delete',{local:null,server:server(),state:state({localDeletedAt:5000})});
 assert.deepEqual(Object.keys(del).sort(),['baseVersion','clientUpdatedAt','id','operation']);
});

test('10H server acknowledgement advances version and records exact local revision',()=>{
 const l=local({updatedAt:'2026-10-04T05:02:00.000Z'});
 const next=syncStateAfterServerRecord(state(),server({version:4,serverUpdatedAt:9000}),l,10000);
 assert.equal(next.serverVersion,4);
 assert.equal(next.lastSyncedLocalUpdatedAt,Date.parse(l.updatedAt));
 assert.equal(next.localDeletedAt,null);
 assert.equal(next.serverUpdatedAt,9000);
});

test('10H browser sync controller is manual, explicit-conflict and participant-only',()=>{
 const js=fs.readFileSync('server/sync.js','utf8');
 assert.match(js,/load\?\.addEventListener\('click'/);
 assert.match(js,/Keep browser copy/);
 assert.match(js,/Keep server copy/);
 assert.match(js,/Confirm this participant permits|confirm this participant permits/i);
 assert.match(js,/\.\/sync-api\.php/);
 assert.doesNotMatch(js,/setInterval|Background Sync|serviceWorker\.sync/i);
 assert.doesNotMatch(js,/listDialogueTurns|listRoomObservations|listAgentMemories|listAgentTasks/);
});

test('10H server contract encrypts profile payloads and uses optimistic versions/tombstones',()=>{
 const api=fs.readFileSync('server/sync-api.php','utf8');
 const boot=fs.readFileSync('server/bootstrap.php','utf8');
 assert.match(api,/tracky_require\(\$db,'sync\.manage'\)/);
 assert.match(api,/baseVersion/);
 assert.match(api,/status'=>'conflict'/);
 assert.match(api,/resolution.*browser/);
 assert.match(api,/deleted_at/);
 assert.match(api,/tracky_encrypt\(json_encode\(\$profile/);
 assert.match(boot,/TRACKY_SCHEMA_VERSION=2/);
 assert.match(boot,/profile_ciphertext/);
 assert.match(boot,/tracky_migrate_participant_profiles/);
 assert.match(boot,/tracky_schema_version\(\$db\)<TRACKY_SCHEMA_VERSION/);
});

test('10H local IndexedDB v7 stores only sync metadata and participant deletion records pending tombstone',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const version=Number(store.match(/const DB_VERSION = (\d+)/)?.[1]);
 assert.ok(version>=7);
 assert.match(store,/const PARTICIPANT_SYNC = 'participant-sync-state'/);
 assert.match(store,/localDeletedAt:Date\.now\(\)/);
 const syncStart=store.indexOf('export function normalizeParticipantSyncState');
 const meetingStart=store.indexOf('/* V0.11E meeting metadata only.',syncStart);
 const syncSection=store.slice(syncStart,meetingStart>syncStart?meetingStart:undefined);
 assert.doesNotMatch(syncSection,/profile|embedding|photo|transcript|memory/i);
});

test('10H backup tooling is CLI-only, verifies checksums/SQLite and creates pre-restore recovery point',()=>{
 const backup=fs.readFileSync('server/backup.php','utf8');
 assert.match(backup,/PHP_SAPI!=='cli'/);
 assert.match(backup,/PRAGMA integrity_check/);
 assert.match(backup,/sha256/);
 assert.match(backup,/secret\.key/);
 assert.match(backup,/tracky2-pre-restore-/);
 assert.match(backup,/restore <directory> --yes/);
});

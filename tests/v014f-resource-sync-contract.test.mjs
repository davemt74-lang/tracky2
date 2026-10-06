import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14F server API is authenticated CSRF protected encrypted and allowlisted',()=>{
 const api=read('server/resource-sync-api.php');
 assert.match(api,/tracky_require\(\$db,'sync\.manage'\)/);
 assert.match(api,/tracky_check_csrf\(\)/);
 assert.match(api,/TRACKY_SYNC_V2_TYPES=\['memory','task','scene'\]/);
 assert.match(api,/tracky_encrypt\(\$json\)/);
 assert.match(api,/tracky_decrypt\(\$row\['payload_ciphertext'\]\)/);
 assert.match(api,/Scene configuration cannot be deleted through metadata sync/);
 assert.match(api,/Resource sync quota exceeded/);
 assert.match(api,/Resource sync record-count quota exceeded/);
 assert.match(api,/tracky_sync_v2_count_limit/);
 assert.match(api,/sync_change_receipts/);
 assert.match(api,/sync_resource_changes/);
 for(const forbidden of ['dialogue','recording','workflow','room-event'])
  assert.doesNotMatch(api,new RegExp("TRACKY_SYNC_V2_TYPES[^\n]*['\"]"+forbidden+"['\"]"));
});

test('14F server schema v6 creates device scopes encrypted records journal and receipts',()=>{
 const boot=read('server/bootstrap.php');
 const serverVersion=Number(boot.match(/TRACKY_SCHEMA_VERSION=([0-9]+)/)?.[1]||0);
 assert.ok(serverVersion>=6,'14F resource-sync schema must survive later additive upgrades');
 for(const table of ['sync_devices','sync_device_scopes','sync_resources','sync_resource_changes','sync_change_receipts'])
  assert.match(boot,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
 assert.match(boot,/resource_type TEXT NOT NULL CHECK\(resource_type IN \('memory','task','scene'\)\)/);
 assert.match(boot,/payload_ciphertext TEXT/);
 assert.doesNotMatch(boot,/sync_resources[\s\S]{0,900}(?:transcript|recording_media|raw_audio)/i);
});

test('14F browser storage is metadata-only and journal never persists synchronized payload',()=>{
 const store=read('src/participant-store.js');
 const dbVersion=Number(store.match(/const DB_VERSION = (\d+)/)?.[1]||0);
 assert.ok(dbVersion>=14,'14F metadata-sync stores must survive additive browser DB upgrades');
 for(const name of ['resource-sync-config','resource-sync-state','resource-sync-journal'])
  assert.match(store,new RegExp(name));
 assert.match(store,/MAX_PERSISTED_RESOURCE_SYNC_JOURNAL = 200/);
 const start=store.indexOf('export function normalizeResourceSyncJournal');
 const end=store.indexOf('/* V0.11E meeting metadata only.',start);
 const block=store.slice(start,end);
 assert.match(block,/localFingerprint/);
 for(const forbidden of ['payload','text:','resultText','areas','objects','transcript','rawAudio','embedding','primaryPhoto'])
  assert.equal(block.includes(forbidden),false,forbidden);
});

test('14F controller is manual explicit scoped and resumable without background synchronization',()=>{
 const js=read('server/resource-sync.js'),admin=read('server/admin.php');
 assert.match(js,/resourceSyncDeviceForm/);
 assert.match(js,/resourceSyncRefresh/);
 assert.match(js,/resourceSyncResume/);
 assert.match(js,/resourceSyncRevoke/);
 assert.match(js,/saveResourceSyncJournal/);
 assert.match(js,/localFingerprint/);
 assert.match(js,/clearPendingForKey/);
 assert.match(js,/deleteResourceSyncJournal/);
 assert.match(js,/if\(snapshot\)serverCache\.clear\(\)/);
 assert.match(admin,/Encrypted metadata sync v2/);
 assert.match(admin,/value=\"memory\"/);
 assert.match(admin,/value=\"task\"/);
 assert.match(admin,/value=\"scene\"/);
 assert.match(admin,/sync-device-toggle/);
 assert.doesNotMatch(js,/setInterval|serviceWorker\.sync|Background Sync|periodicSync/i);
});

test('14F metadata lane cannot select transcript room recording workflow or biometric resources',()=>{
 const core=read('src/resource-sync-core.js'),controller=read('server/resource-sync.js'),admin=read('server/admin.php');
 assert.match(core,/RESOURCE_SYNC_TYPES=Object\.freeze\(\['memory','task','scene'\]\)/);
 for(const forbidden of ['listDialogueTurns','listRoomObservations','listRecordings','listAgentWorkflows',
   'primaryPhoto','voiceSamples','faceSamples']){
  assert.equal(controller.includes(forbidden),false,forbidden);
 }
 assert.match(admin,/Transcripts, ROOM events, recordings\/media, workflows and biometrics are excluded/);
});

test('14F lost acknowledgement is safely replayable by stable change ID',()=>{
 const api=read('server/resource-sync-api.php'),core=read('src/resource-sync-core.js');
 assert.match(core,/Stable sync change ID required/);
 assert.match(api,/tracky_sync_v2_receipt/);
 assert.match(api,/replayed'=>true/);
 assert.match(api,/Sync change ID was already used for another resource/);
});

test('14F legacy biometric participant sync remains separate and consent-bound',()=>{
 const legacy=read('server/sync.js'),api=read('server/sync-api.php'),admin=read('server/admin.php');
 assert.match(legacy,/participantHasBiometrics/);
 assert.match(legacy,/Confirm this participant permits|confirm this participant permits/i);
 assert.match(api,/Explicit participant consent required for biometric synchronization/);
 assert.match(admin,/Advanced participant reconciliation/);
 assert.match(admin,/legacy manual reconciliation tool remains available for explicit participant\/biometric recovery and conflict work/i);
 assert.match(admin,/Do not synchronize biometric records without participant consent/i);
});

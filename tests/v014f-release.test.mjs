import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14F encrypted sync release evidence remains present under later additive V0.14 releases',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),status=read('docs/DEVELOPMENT-STATUS.md');
 const parts=value=>String(value).split('.').map(v=>Number(v)||0);
 const compare=(a,b)=>{const aa=parts(a),bb=parts(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;};
 assert.ok(compare(pkg.version,'0.14.5')>=0);
 for(const needle of ['src/resource-sync-core.js','server/resource-sync.js','server/resource-sync-api.php'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(sw,/resource-sync-core\.js/);
 assert.match(status,/Direct \*\*v0\.14\.5\*\* release published/);
 assert.match(status,/14F final score: 10\/10/);
});

test('14F schemas advance additively for server and browser reconciliation metadata',()=>{
 const bootstrap=read('server/bootstrap.php'),store=read('src/participant-store.js');
 assert.match(bootstrap,/TRACKY_SCHEMA_VERSION=6/);
 const dbVersion=Number(store.match(/const DB_VERSION = (\d+)/)?.[1]||0);
 assert.ok(dbVersion>=14);
 for(const table of ['sync_devices','sync_device_scopes','sync_resources','sync_resource_changes','sync_change_receipts'])
  assert.match(bootstrap,new RegExp(table));
 for(const storeName of ['resource-sync-config','resource-sync-state','resource-sync-journal'])
  assert.match(store,new RegExp(storeName));
});

test('14F package retains legacy participant consent and prior V0.14 authority boundaries',()=>{
 const workflow=read('.github/workflows/test.yml'),sw=read('sw.js');
 for(const file of ['server-sync-core.js','agent-memory-learning-core.js','semantic-recall-core.js',
  'agent-workflow-core.js','governed-skill-core.js','provider-router-core.js','v013-release-core.js'])
  assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
 for(const file of ['agent-memory-learning-core.js','semantic-recall-core.js','agent-workflow-core.js',
  'governed-skill-core.js','provider-router-core.js','v013-release-core.js','resource-sync-core.js'])
  assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
 const legacy=read('server/sync.js');
 assert.match(legacy,/participantHasBiometrics/);
 assert.match(legacy,/consent/i);
});

test('14F sync-v2 package contains no automatic background trigger',()=>{
 const client=read('server/resource-sync.js'),core=read('src/resource-sync-core.js');
 assert.doesNotMatch(client,/setInterval|periodicSync|serviceWorker\.sync|Background Sync/i);
 assert.doesNotMatch(core,/fetch\(|indexedDB|localStorage|WebSocket|MediaRecorder|getUserMedia/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14F release package is v0.14.5 with encrypted metadata sync runtime and direct assets',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),diagnostics=read('diagnostics.js');
 assert.equal(pkg.version,'0.14.5');
 assert.match(sw,/tracky2-static-v0\.14\.5/);
 assert.match(diagnostics,/version:'0\.14\.5'/);
 assert.match(audit,/packageJson\.version !== '0\.14\.5'/);
 for(const needle of [
  'src/resource-sync-core.js','server/resource-sync.js','server/resource-sync-api.php',
  'tracky2-v0.14.5-deploy.zip'
 ])assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(workflow,/gh release create v0\.14\.5/);
 assert.match(workflow,/Encrypted Server Sync V2/);
});

test('14F schemas advance additively for server and browser reconciliation metadata',()=>{
 const bootstrap=read('server/bootstrap.php'),store=read('src/participant-store.js');
 assert.match(bootstrap,/TRACKY_SCHEMA_VERSION=6/);
 assert.match(store,/const DB_VERSION = 14/);
 for(const table of ['sync_devices','sync_device_scopes','sync_resources','sync_resource_changes','sync_change_receipts'])
  assert.match(bootstrap,new RegExp(table));
 for(const storeName of ['resource-sync-config','resource-sync-state','resource-sync-journal'])
  assert.match(store,new RegExp(storeName));
});

test('14F package retains legacy participant consent and prior V0.14 authority boundaries',()=>{
 const workflow=read('.github/workflows/test.yml'),sw=read('sw.js');
 for(const file of ['server-sync-core.js','agent-memory-learning-core.js','semantic-recall-core.js',
  'agent-workflow-core.js','governed-skill-core.js','provider-router-core.js','v013-release-core.js']){
  assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
  assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
 }
 const legacy=read('server/sync.js');
 assert.match(legacy,/participantHasBiometrics/);
 assert.match(legacy,/consent/i);
});

test('14F sync-v2 package contains no automatic background trigger',()=>{
 const client=read('server/resource-sync.js'),core=read('src/resource-sync-core.js');
 assert.doesNotMatch(client,/setInterval|periodicSync|serviceWorker\.sync|Background Sync/i);
 assert.doesNotMatch(core,/fetch\(|indexedDB|localStorage|WebSocket|MediaRecorder|getUserMedia/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v0.14.6 package contains account participant and Control Center runtime',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),diagnostics=read('diagnostics.js');
 assert.equal(pkg.version,'0.14.6');
 assert.match(sw,/tracky2-static-v0\.14\.6/);
 assert.match(diagnostics,/version:'0\.14\.6'/);
 assert.match(audit,/packageJson\.version !== '0\.14\.6'/);
 for(const file of ['account-participants.js','control-center.js','src/account-participant-core.js',
  'server/account-participants-api.php','tracky2-v0.14.6-deploy.zip'])
  assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
 assert.match(workflow,/Account-Backed Participants & Control Center/);
 assert.match(workflow,/gh release create v0\.14\.6/);
});

test('v0.14.6 browser schema 15 preserves earlier sync stores additively',()=>{
 const store=read('src/participant-store.js');
 assert.match(store,/const DB_VERSION = 15/);
 for(const name of ['participant-sync-state','account-participant-sync-state',
  'resource-sync-config','resource-sync-state','resource-sync-journal'])
  assert.match(store,new RegExp(name));
});

test('v0.14.6 PWA shell includes account sync and Control Center but not authenticated APIs',()=>{
 const sw=read('sw.js');
 for(const file of ['account-participants.js','control-center.js','src/account-participant-core.js'])
  assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
 assert.doesNotMatch(sw,/server\/account-participants-api\.php/);
 assert.doesNotMatch(sw,/server\/session\.php/);
});

test('v0.14.6 closes 14F before resuming 14G',()=>{
 const status=read('docs/DEVELOPMENT-STATUS.md');
 assert.match(status,/14F final score: 10\/10/);
 assert.match(status,/Verified deploy ZIP SHA-256: `2c2ac7684d85a8cb122385fd05a529b36027892c6e742388801df0cde5238d7b`/);
 assert.match(status,/begin \*\*14G — Multi-Room Federation V3\*\*/i);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v0.14.6 account participant release evidence remains present under later additive V0.14 releases',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),status=read('docs/DEVELOPMENT-STATUS.md');
 const parts=value=>String(value).split('.').map(v=>Number(v)||0);
 const compare=(a,b)=>{const aa=parts(a),bb=parts(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;};
 assert.ok(compare(pkg.version,'0.14.6')>=0);
 for(const file of ['account-participants.js','control-center.js','src/account-participant-core.js',
  'server/account-participants-api.php'])assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
 assert.match(sw,/account-participants\.js/);assert.match(sw,/control-center\.js/);
 assert.match(status,/V0\.14\.6 final score: 10\/10/);
 assert.match(status,/8778fb9acce46b12141565309ee63565e043d1182f9d99e94c367ae84ed24158/);
});

test('v0.14.6 browser schema 15 preserves earlier sync stores additively',()=>{
 const store=read('src/participant-store.js');
 const schemaVersion=Number(store.match(/const DB_VERSION = (\\d+)/)?.[1]||0);
 assert.ok(schemaVersion>=15,'v0.14.6 sync stores must survive later additive browser schemas');
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

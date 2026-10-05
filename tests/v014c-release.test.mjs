import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14C workflow release artifacts remain present under later additive V0.14 releases',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),status=read('docs/DEVELOPMENT-STATUS.md');
 const parts=value=>String(value).split('.').map(v=>Number(v)||0);
 const compare=(a,b)=>{const aa=parts(a),bb=parts(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;};
 assert.ok(compare(pkg.version,'0.14.2')>=0);
 for(const needle of ['src/agent-workflow-core.js','src/agent-workflow-ui.js'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(sw,/agent-workflow-core\.js/);assert.match(sw,/agent-workflow-ui\.js/);
 assert.match(audit,/agent-workflow-core\.js/);assert.match(audit,/agent-workflow-ui\.js/);
 assert.match(status,/Direct \*\*v0\.14\.2\*\* release published/);
 assert.match(status,/14C final score: 10\/10/);
});

test('14C workflow persistence migration and package shell are aligned',()=>{
 const store=read('src/participant-store.js'),sw=read('sw.js');
 const version=Number(store.match(/const DB_VERSION = (\\d+)/)?.[1]||0);\n assert.ok(version>=13);
 assert.match(store,/agent-workflows/);
 assert.match(store,/MAX_PERSISTED_AGENT_WORKFLOWS = 80/);
 assert.match(sw,/agent-workflow-core\.js/);assert.match(sw,/agent-workflow-ui\.js/);
});

test('14C retains governed skill and provider authority boundaries',()=>{
 const workflow=read('.github/workflows/test.yml'),sw=read('sw.js');
 for(const file of ['governed-skill-core.js','governed-skill-client.js','provider-router-core.js',
  'agent-provider.js','v013-release-core.js']){
  assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
  assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
 }
 const core=read('src/agent-workflow-core.js');
 assert.match(core,/foreground-owner-action-required/);
 assert.match(core,/authorization-snapshot-stale/);
 assert.match(core,/participant-deleted-or-unavailable/);
 assert.match(core,/MAX_WORKFLOW_STEPS=6/);
});

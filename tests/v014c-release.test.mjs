import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14C release package is v0.14.2 with workflow runtime and direct assets',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),diagnostics=read('diagnostics.js');
 assert.equal(pkg.version,'0.14.2');
 assert.match(sw,/tracky2-static-v0\.14\.2/);
 assert.match(diagnostics,/version:'0\.14\.2'/);
 assert.match(audit,/packageJson\.version !== '0\.14\.2'/);
 for(const needle of ['src/agent-workflow-core.js','src/agent-workflow-ui.js','tracky2-v0.14.2-deploy.zip'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(workflow,/gh release create v0\.14\.2/);
 assert.match(workflow,/Agent Tasks & Workflow Execution V2/);
});

test('14C workflow persistence migration and package shell are aligned',()=>{
 const store=read('src/participant-store.js'),sw=read('sw.js');
 assert.match(store,/const DB_VERSION = 13/);
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

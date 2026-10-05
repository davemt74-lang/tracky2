import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14D release package is v0.14.3 with memory-learning runtime and direct assets',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),diagnostics=read('diagnostics.js');
 assert.equal(pkg.version,'0.14.3');
 assert.match(sw,/tracky2-static-v0\.14\.3/);
 assert.match(diagnostics,/version:'0\.14\.3'/);
 assert.match(audit,/packageJson\.version !== '0\.14\.3'/);
 for(const needle of ['src/agent-memory-learning-core.js','src/agent-memory-core.js',
  'src/agent-memory-ui.js','tracky2-v0.14.3-deploy.zip'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(workflow,/gh release create v0\.14\.3/);
 assert.match(workflow,/Owner-Approved Memory Learning V2/);
});

test('14D release keeps proposal queue non-durable and owner approval explicit',()=>{
 const proposal=read('src/agent-memory-learning-core.js'),ui=read('src/agent-memory-ui.js');
 const store=read('src/participant-store.js');
 assert.doesNotMatch(proposal,/indexedDB|localStorage|sessionStorage/);
 assert.match(ui,/Approve & save/);
 assert.match(ui,/validateMemoryProposalSources/);
 assert.match(store,/owner-approved-proposal/);
 assert.match(store,/Only owner-authorized memory can be persisted/);
});

test('14D retains prior V0.14 governed workflow/provider boundaries',()=>{
 const workflow=read('.github/workflows/test.yml'),sw=read('sw.js');
 for(const file of ['agent-workflow-core.js','governed-skill-core.js','provider-router-core.js',
  'agent-provider.js','v013-release-core.js']){
  assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
  assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
 }
});

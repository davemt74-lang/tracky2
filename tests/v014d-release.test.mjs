import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14D memory-learning release artifacts remain present under later additive V0.14 releases',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),status=read('docs/DEVELOPMENT-STATUS.md');
 const parts=value=>String(value).split('.').map(v=>Number(v)||0);
 const compare=(a,b)=>{const aa=parts(a),bb=parts(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;};
 assert.ok(compare(pkg.version,'0.14.3')>=0);
 for(const needle of ['src/agent-memory-learning-core.js','src/agent-memory-core.js','src/agent-memory-ui.js'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(sw,/agent-memory-learning-core\.js/);assert.match(audit,/agent-memory-learning-core\.js/);
 assert.match(status,/Direct \*\*v0\.14\.3\*\* release published/);
 assert.match(status,/14D final score: 10\/10/);
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

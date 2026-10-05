import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14E release package is v0.14.4 with semantic recall runtime and direct assets',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),diagnostics=read('diagnostics.js');
 assert.equal(pkg.version,'0.14.4');
 assert.match(sw,/tracky2-static-v0\.14\.4/);
 assert.match(diagnostics,/version:'0\.14\.4'/);
 assert.match(audit,/packageJson\.version !== '0\.14\.4'/);
 for(const needle of ['src/session-recall-core.js','src/semantic-recall-core.js',
  'src/session-recall-ui.js','tracky2-v0.14.4-deploy.zip'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(workflow,/gh release create v0\.14\.4/);
 assert.match(workflow,/Recall & Search Intelligence V2/);
});

test('14E semantic index is local ephemeral bounded and source-linked',()=>{
 const semantic=read('src/semantic-recall-core.js');
 assert.match(semantic,/MAX_SEMANTIC_INDEX_ITEMS=320/);
 assert.match(semantic,/persistent:false/);
 assert.match(semantic,/sourceId:row\.sourceId/);
 assert.match(semantic,/recallRowAllowed/);
 assert.doesNotMatch(semantic,/indexedDB|localStorage|sessionStorage|fetch\(|WebSocket|recording-media|rawAudio/);
});

test('14E package retains owner-approved memory and governed workflow boundaries',()=>{
 const workflow=read('.github/workflows/test.yml'),sw=read('sw.js');
 for(const file of ['agent-memory-learning-core.js','agent-workflow-core.js','governed-skill-core.js',
  'provider-router-core.js','v013-release-core.js']){
  assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
  assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
 }
});

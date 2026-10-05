import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14E semantic recall release artifacts remain present under later additive V0.14 releases',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),status=read('docs/DEVELOPMENT-STATUS.md');
 const parts=value=>String(value).split('.').map(v=>Number(v)||0);
 const compare=(a,b)=>{const aa=parts(a),bb=parts(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;};
 assert.ok(compare(pkg.version,'0.14.4')>=0);
 for(const needle of ['src/session-recall-core.js','src/semantic-recall-core.js','src/session-recall-ui.js'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(sw,/semantic-recall-core\.js/);assert.match(audit,/semantic-recall-core\.js/);
 assert.match(status,/Direct \*\*v0\.14\.4\*\* release published/);
 assert.match(status,/14E final score: 10\/10/);
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

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14B release package is v0.14.1 and contains governed runtime/server files',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),diagnostics=read('diagnostics.js');
 assert.equal(pkg.version,'0.14.1');
 assert.match(sw,/tracky2-static-v0\.14\.1/);
 assert.match(diagnostics,/version:'0\.14\.1'/);
 assert.match(audit,/packageJson\.version !== '0\.14\.1'/);
 for(const needle of [
  'tracky2-v0.14.1-deploy.zip','src/governed-skill-core.js','src/governed-skill-client.js',
  'server/skill-api.php'
 ])assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(workflow,/gh release create v0\.14\.1/);
 assert.match(workflow,/Governed Skills & Tool Execution/);
});

test('14B release retains 14A provider runtime and closed V0.13 authority files',()=>{
 const workflow=read('.github/workflows/test.yml'),sw=read('sw.js');
 for(const file of ['provider-router-core.js','agent-provider.js','v013-release-core.js',
  'conversation-listening-core.js','speaker-participant-core.js']){
  assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
  assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
 }
});

test('14B schema and scene metadata versions are additive',()=>{
 const bootstrap=read('server/bootstrap.php'),scene=read('src/room-scene-graph.js');
 assert.match(bootstrap,/TRACKY_SCHEMA_VERSION=5/);
 assert.match(scene,/ROOM_SCENE_SCHEMA=4/);
 assert.match(bootstrap,/skills\.execute/);
 assert.match(scene,/skills:normalizeEnabledSkills/);
});

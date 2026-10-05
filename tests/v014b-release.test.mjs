import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14B governed runtime remains packaged under later additive V0.14 releases',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),status=read('docs/DEVELOPMENT-STATUS.md');
 const numeric=value=>String(value).split('.').map(v=>Number(v)||0);
 const compare=(a,b)=>{const aa=numeric(a),bb=numeric(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;};
 assert.ok(compare(pkg.version,'0.14.1')>=0);
 assert.match(sw,/governed-skill-core\.js/);assert.match(sw,/governed-skill-client\.js/);
 assert.match(audit,/governed-skill-core\.js/);assert.match(audit,/governed-skill-client\.js/);
 for(const needle of ['src/governed-skill-core.js','src/governed-skill-client.js','server/skill-api.php'])
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 assert.match(status,/Direct \*\*v0\.14\.1\*\* release published/);
 assert.match(status,/14B final score: 10\/10/);
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
 const serverSchema=Number(bootstrap.match(/TRACKY_SCHEMA_VERSION=(\d+)/)?.[1]||0);
 const sceneSchema=Number(scene.match(/ROOM_SCENE_SCHEMA=(\d+)/)?.[1]||0);
 assert.ok(serverSchema>=5);assert.ok(sceneSchema>=4);
 assert.match(bootstrap,/skills\.execute/);
 assert.match(scene,/skills:normalizeEnabledSkills/);
});

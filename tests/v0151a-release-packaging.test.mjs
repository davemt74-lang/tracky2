import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1A package, PWA cache and deploy artifact versions stay aligned',()=>{
 const pkg=JSON.parse(read('package.json'));
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 assert.equal(pkg.version,'0.17.4');
 assert.match(sw,/tracky2-static-v0\.17\.4/);
 assert.match(workflow,/tracky2-v0\.17\.4-deploy\.zip/);
 assert.match(workflow,/gh release create v0\.17\.4/);
 assert.match(workflow,/gh release edit v0\.17\.4/);
 assert.match(workflow,/V0\.17\.4 fixes the deployment artifact itself/);
 assert.doesNotMatch(workflow,/V0\.14\.8 closes the ROOM audio intelligence sequence/);
 assert.doesNotMatch(workflow,/tracky2-v0\.14\.8-deploy\.zip/);
});

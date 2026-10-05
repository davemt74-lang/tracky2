import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v0.14.7 release package is aligned to ROOM Conversation UI cleanup',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js'),audit=read('scripts/audit.mjs'),diagnostics=read('diagnostics.js');
 assert.equal(pkg.version,'0.14.7');
 assert.match(sw,/tracky2-static-v0\.14\.7/);
 assert.match(diagnostics,/version:'0\.14\.7'/);
 assert.match(audit,/packageJson\.version !== '0\.14\.7'/);
 assert.match(workflow,/tracky2-v0\.14\.7-deploy\.zip/);
 assert.match(workflow,/ROOM Feed, Control Center & Shared Conversation/);
 assert.match(workflow,/gh release create v0\.14\.7/);
});

test('v0.14.7 release status preserves closed v0.14.6 and points next to 14G',()=>{
 const status=read('docs/DEVELOPMENT-STATUS.md');
 assert.match(status,/V0\.14\.6 final score: 10\/10/);
 assert.match(status,/V0\.14\.7 — ROOM Feed, Control Center & Shared Conversation/);
 assert.match(status,/Begin \*\*14G — Multi-Room Federation V3\*\*/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {localModuleSpecifiers,missingLocalImports} from '../scripts/verify-deploy-imports.mjs';

test('deploy import audit finds static and dynamic relative modules only',()=>{
 const specs=localModuleSpecifiers(`
  import './a.js';
  import {x} from "../b.js";
  export {y} from './c.js';
  const z=import('./d.js');
  import('https://example.com/x.js');
 `);
 assert.deepEqual(specs.sort(),['../b.js','./a.js','./c.js','./d.js']);
});

test('deploy import audit fails a package with an omitted browser dependency',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tracky2-package-'));
 try{
  fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'participants.js'),"import './src/present.js';\nimport './src/missing.js';\n");
  fs.writeFileSync(path.join(root,'src','present.js'),'export const ok=true;\n');
  const missing=missingLocalImports(root);
  assert.equal(missing.length,1);
  assert.equal(missing[0].file,'participants.js');
  assert.equal(missing[0].spec,'./src/missing.js');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('deploy import audit passes when every local dependency is packaged',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tracky2-package-'));
 try{
  fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'participants.js'),"import './src/core.js';\n");
  fs.writeFileSync(path.join(root,'src','core.js'),"import './voice.js';\n");
  fs.writeFileSync(path.join(root,'src','voice.js'),'export const ok=true;\n');
  assert.deepEqual(missingLocalImports(root),[]);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/test.yml','utf8');

test('V0.17.4 deploy ZIP is flat for upload-and-extract document-root installs',()=>{
 assert.match(workflow,/cd dist\/tracky2-v0\.17\.4\s+zip -r \.\.\/\.\.\/tracky2-v0\.17\.4-deploy\.zip \./s);
 assert.match(workflow,/grep -Fx 'index\.html'/);
 assert.match(workflow,/grep -Fx 'vertical-motion\.html'/);
 assert.match(workflow,/grep -Fx 'server\/install\.php'/);
 assert.match(workflow,/grep -Fx 'src\/camera-preference\.js'/);
 assert.match(workflow,/Deploy ZIP must be flat; version wrapper directory found/);
 assert.doesNotMatch(workflow,/zip -r \.\.\/tracky2-v0\.17\.4-deploy\.zip tracky2-v0\.17\.4/);
});

test('V0.17.4 package smoke extracts and validates from ZIP root',()=>{
 assert.match(workflow,/unzip -q tracky2-v0\.17\.4-deploy\.zip -d dist\/package-smoke/);
 assert.match(workflow,/verify-deploy-imports\.mjs dist\/package-smoke(?!\/tracky2-v0\.17\.4)/);
 assert.match(workflow,/import\('\.\/dist\/package-smoke\/src\/camera-preference\.js'\)/);
});

test('V0.17.4 release identifies the deployment-format repair',()=>{
 assert.match(workflow,/Tracky2 v0\.17\.4 — Flat Deploy Repair/);
 assert.match(workflow,/V0\.17\.4 fixes the deployment artifact itself/);
});

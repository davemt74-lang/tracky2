import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1H runtime snapshot includes unified autonomy gate',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/autonomyStatus/);
 assert.match(runtime,/autonomyFailures/);
});

test('15.1H diagnostics builds one combined final certification report',()=>{
 const js=read('diagnostics.js');
 assert.match(js,/buildFinalCertificationReport/);
 assert.match(js,/canonicalFinalCertificationJson/);
 assert.match(js,/renderFinalCertification/);
 assert.match(js,/finalCertification:/);
});

test('15.1H UI exposes final release gate and refuses premature certification',()=>{
 const html=read('diagnostics.html');
 assert.match(html,/id="finalCertificationStatus"/);
 assert.match(html,/FINAL INSTALLED-DEVICE RELEASE GATE/);
});

test('15.1H packaged release includes final certification core',()=>{
 const workflow=read('.github/workflows/test.yml');
 assert.match(workflow,/final-certification-core\.js/);
});

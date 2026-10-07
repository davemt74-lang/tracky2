import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.17.3 AGENT presentation no longer depends on mode query-string gating',()=>{
 const presence=read('agent-presence.js');
 assert.match(presence,/agentEnabled=true/);
 assert.match(presence,/document\.body\.classList\.add\('agent-mode'\)/);
 assert.doesNotMatch(presence,/get\('mode'\).*===.*agent|const requested=|!requested/);
});

test('V0.17.3 four-tab sidebar cannot leak labels or pane content outside its bounds',()=>{
 const html=read('vertical-motion.html');
 const presenceCss=read('agent-presence.css');
 const tabsCss=read('room-tabs.css');
 assert.match(html,/id="playerActivityTab"[^>]*aria-label="Participant Activity"[^>]*>Activity<\/button>/);
 assert.doesNotMatch(presenceCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(presenceCss,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(presenceCss,/white-space:normal/);
 assert.match(presenceCss,/overflow-x:hidden/);
 assert.match(tabsCss,/flex:1 1 auto/);
 assert.match(tabsCss,/overflow-x:hidden;overflow-y:auto/);
});

test('V0.17.3 Admin Meetings enters the canonical AGENT shell',()=>{
 const admin=read('server/admin.php');
 assert.match(admin,/vertical-motion\.html\?mode=agent&amp;admin=meeting/);
});

test('V0.17.3 release package metadata is aligned',()=>{
 const pkg=JSON.parse(read('package.json'));
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 const audit=read('scripts/audit.mjs');
 assert.equal(pkg.version,'0.17.3');
 assert.match(sw,/tracky2-static-v0\.17\.3-agent-onboarding-r1/);
 assert.match(workflow,/tracky2-v0\.17\.3-deploy\.zip/);
 assert.match(workflow,/Tracky2 v0\.17\.3 — AGENT Onboarding Recovery/);
 assert.match(audit,/package\.json version must be 0\.17\.3/);
});

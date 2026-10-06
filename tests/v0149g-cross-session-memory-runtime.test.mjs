import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9G memory UI consumes situational awareness through existing proposal review surface',()=>{
 const ui=read('src/agent-memory-ui.js');
 assert.match(ui,/getSituationalAwareness/);
 assert.match(ui,/situationalPatternEvidence/);
 assert.match(ui,/Adaptive situational pattern/);
 assert.match(ui,/Approve & save/);
 assert.match(ui,/startsWith\('adaptive-'\).*expiry\.value='90'/s);
});

test('14.9G runtime passes bounded awareness into memory proposal UI',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/getSituationalAwareness:\(\)=>exportSituationalAwareness\(roomSituationalAwareness\)/);
 assert.match(runtime,/memoryUI\?\.refreshProposals\?\.\(\)/);
});

test('14.9G feedback persistence retains action/media metadata for cross-session learning',()=>{
 const core=read('src/room-situational-awareness-core.js');
 const runtime=read('vertical-motion.js');
 assert.match(core,/mediaKind:clean\(input\.mediaKind/);
 assert.match(core,/action:clean\(input\.action/);
 assert.match(runtime,/mediaKind:pendingSituationalEngagement\.mediaKind/);
 assert.match(runtime,/action:pendingSituationalEngagement\.action/);
});

test('14.9G durable memory core accepts situational provenance only through owner-approved proposal path',()=>{
 const memory=read('src/agent-memory-core.js');
 const learning=read('src/agent-memory-learning-core.js');
 assert.match(memory,/situational-pattern/);
 assert.match(learning,/provenance:'owner-approved-proposal'/);
 assert.match(learning,/sensitiveMemoryReason/);
 assert.doesNotMatch(learning,/ledger\.add\(.*adaptive/s);
});

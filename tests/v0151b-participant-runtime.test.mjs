import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15.1B runtime owns one participant transition tracker',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/ParticipantPresenceTransitionTracker/);
 assert.match(runtime,/participantPresenceTransitions\.observe\(visible/);
 assert.match(runtime,/participantPresenceTransitions\.reconcile\(ids\)/);
 assert.match(runtime,/participantPresenceTransitions\.unavailable\(\)/);
});

test('15.1B presence transitions are emitted through canonical ROOM observations',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/arrival:'participant-arrival'/);
 assert.match(runtime,/departure:'participant-departure'/);
 assert.match(runtime,/reentry:'participant-reentry'/);
 assert.match(runtime,/'confidence-change':'participant-identity-confidence'/);
 assert.match(runtime,/semantic,message,/);
});

test('15.1B participant transition metadata does not suppress a current enrolled voice association',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/participantTargetEligibility\(/);
 assert.match(runtime,/participant-mistarget/);
 assert.match(runtime,/targeting\.allowed/);
});

test('15.1B core remains metadata-only and local',()=>{
 const core=read('src/participant-transition-core.js');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket|indexedDB|localStorage/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('participant deletion atomically removes directly attributed ROOM records',()=>{
 const code=fs.readFileSync('src/participant-store.js','utf8');
 const del=code.slice(code.indexOf('export async function deleteParticipant('),code.indexOf('export async function prunePendingCaptures('));
 assert.match(del,/db.transaction\(\[PARTICIPANTS, DIALOGUE, ROOM_OBSERVATIONS, AGENT_MEMORIES, PARTICIPANT_SYNC\], 'readwrite'\)/);
 assert.match(del,/observations = tx.objectStore\(ROOM_OBSERVATIONS\)/);
 assert.match(del,/event.participantId === id\) observations.delete\(event.id\)/);
 assert.match(del,/memory.participantId === id\) memories.delete\(memory.id\)/);
 assert.ok(del.indexOf('observations.delete(')<del.indexOf('await done'));
});
test('recognized names are not duplicated in non-attributed room event logs',()=>{
 const code=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(code,/state.mode==='agent'&&type!=='recognized'/);
});
test('live speech-cadence animation preserves oriented rings and reduced-motion preference',()=>{
 const code=fs.readFileSync('agent-presence.js','utf8');
 assert.match(code,/prefers-reduced-motion: reduce/);
 assert.match(code,/scale:1\+strength\*\.2/);
 assert.doesNotMatch(code,/\{transform:'scale\('/);
});

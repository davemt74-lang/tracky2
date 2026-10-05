import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14D proposal queue remains non-durable until explicit owner approval',()=>{
 const core=read('src/agent-memory-learning-core.js');
 const ui=read('src/agent-memory-ui.js');
 assert.doesNotMatch(core,/indexedDB|localStorage|sessionStorage|saveAgentMemory|saveApprovedMemoryProposal/);
 assert.match(ui,/MemoryProposalLedger/);
 assert.match(ui,/Approve & save/);
 assert.match(ui,/validateMemoryProposalSources/);
 assert.match(ui,/saveApprovedMemoryProposal/);
 assert.match(ui,/proposalLedger\.dismiss/);
 assert.match(ui,/proposalLedger\.remove/);
});

test('14D persistence accepts only owner-authored or owner-approved proposal records',()=>{
 const store=read('src/participant-store.js');
 assert.match(store,/\['owner-authored','owner-approved-proposal'\]/);
 assert.match(store,/Only owner-authorized memory can be persisted/);
 assert.match(store,/sourceRefs/);
 assert.match(store,/approvedAt/);
 assert.match(store,/proposalMethod/);
 assert.match(store,/export async function saveApprovedMemoryProposal/);
 assert.match(store,/db\.transaction\(\[AGENT_MEMORIES\],'readwrite'\)/);
});

test('14D contradiction replacement is one local transaction',()=>{
 const store=read('src/participant-store.js');
 const start=store.indexOf('export async function saveApprovedMemoryProposal');
 const end=store.indexOf('export function deleteAgentMemory',start);
 const block=store.slice(start,end);
 assert.match(block,/revokeMemoryRecord/);
 assert.match(block,/requestToPromise\(store\.put\(persistableAgentMemory\(next\)\)\)/);
 assert.match(block,/requestToPromise\(store\.put\(safe\)\)/);
 assert.match(block,/await done/);
});

test('14D participant deletion also removes proposal-derived provenance references',()=>{
 const store=read('src/participant-store.js');
 const start=store.indexOf('export async function deleteParticipant(');
 const end=store.indexOf('export async function prunePendingCaptures',start);
 const block=store.slice(start,end);
 assert.match(block,/memory\.participantId === id/);
 assert.match(block,/memory\.sourceRefs/);
 assert.match(block,/ref\?\.participantId===id/);
});

test('14D UI exposes source-backed edit-before-save proposal review',()=>{
 const html=read('vertical-motion.html'),ui=read('src/agent-memory-ui.js');
 assert.match(html,/id="agentMemoryScanProposals"/);
 assert.match(html,/id="agentMemoryProposalList"/);
 assert.match(html,/SESSION ONLY · source-backed · owner approval required/);
 assert.match(html,/nothing is saved until you review and approve it/i);
 assert.match(ui,/textarea/);
 assert.match(ui,/Edit proposed memory before approval/);
 assert.match(ui,/POSSIBLE CONTRADICTION/);
 assert.match(ui,/POSSIBLE DUPLICATE/);
 assert.match(ui,/This proposal duplicates active owner memory/);
 assert.match(ui,/Approve it and revoke those conflicting memories/);
});

test('14D runtime uses canonical dialogue ROOM and meeting metadata as evidence only',()=>{
 const runtime=read('vertical-motion.js'),meetingUi=read('src/meeting-ui.js');
 assert.match(runtime,/getDialogueTurns:\(\)=>state\.voice\.turns/);
 assert.match(runtime,/getRoomEvents:\(\)=>roomLedger\.entries\(\)/);
 assert.match(runtime,/getMeetings:\(\)=>meetingUI\?\.meetings\?\.\(\)\|\|\[\]/);
 assert.match(runtime,/memoryUI\?\.refreshProposals\?\.\(\)/);
 assert.match(meetingUi,/meetings:\(\)=>\[\.\.\.records\]/);
 assert.doesNotMatch(read('src/agent-memory-learning-core.js'),/getUserMedia|MediaRecorder|fetch\(|WebSocket|AudioContext/);
});

test('14D durable schema 2 provenance never copies source excerpts into persistence',()=>{
 const core=read('src/agent-memory-core.js'),store=read('src/participant-store.js');
 assert.match(core,/AGENT_MEMORY_SCHEMA=2/);
 assert.match(core,/owner-approved-proposal/);
 const start=store.indexOf('function persistableAgentMemory');
 const end=store.indexOf('export function deleteAgentMemory',start);
 const block=store.slice(start,end);
 assert.doesNotMatch(block,/excerpt/);
 assert.doesNotMatch(block,/transcript|rawAudio|embedding|primaryPhoto|ciphertext|apiKey|prompt/);
});

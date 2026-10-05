import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 AgentMemoryLedger,activeMemories,memoryContextLines,memoryExpired,normalizeMemoryRecord,
 reviseMemoryRecord,revokeMemoryRecord,sessionContextReferences
} from '../src/agent-memory-core.js';
import {buildAgentMessages} from '../src/agent-provider.js';
import {localAgentReply} from '../src/agent-conversation.js';

test('10G owner memories are explicit, bounded historical records with optional expiry',()=>{
 const now=100000;
 const memory=normalizeMemoryRecord({id:'m1',type:'preference',participantId:'p1',
  text:'Prefers short morning greetings',persistent:true,expiresAt:now+86400000},now);
 assert.equal(memory.authority,'owner');
 assert.equal(memory.provenance,'owner-authored');
 assert.equal(memory.status,'active');
 assert.equal(memoryExpired(memory,now),false);
 assert.equal(memoryExpired(memory,now+86400001),true);
 assert.ok(Object.isFrozen(memory));
 assert.throws(()=>normalizeMemoryRecord({text:'   '}),/required/);
});

test('10G retrieval scopes participant memory, includes room-general memory and excludes revoked/expired rows',()=>{
 const now=100000;
 const rows=[
  normalizeMemoryRecord({id:'global',type:'note',text:'Keep replies brief'},now),
  normalizeMemoryRecord({id:'p1',type:'preference',participantId:'p1',text:'Likes jazz'},now),
  normalizeMemoryRecord({id:'p2',type:'relationship',participantId:'p2',text:'Owner says Sam is a coworker'},now),
  normalizeMemoryRecord({id:'expired',participantId:'p1',text:'Old',expiresAt:now+10},now)
 ];
 const revoked=revokeMemoryRecord(rows[1],'wrong',now+5);
 const active=activeMemories([rows[0],revoked,rows[2],rows[3]],{participantId:'p1',now:now+20});
 assert.deepEqual(active.map(x=>x.id),['global']);
 const p2=memoryContextLines(rows,{participantId:'p2',now});
 assert.equal(p2.length,2);
 assert.match(p2[0]+p2[1],/Historical owner memory/);
 assert.match(p2.join(' '),/coworker/);
});

test('10G revisions preserve prior owner wording and revocation removes memory from active retrieval',()=>{
 const base=normalizeMemoryRecord({id:'m',participantId:'p',type:'preference',text:'Coffee at 8'},1000);
 const revised=reviseMemoryRecord(base,'Coffee after 9',2000);
 assert.equal(revised.text,'Coffee after 9');
 assert.equal(revised.revisions.length,1);
 assert.equal(revised.revisions[0].text,'Coffee at 8');
 assert.equal(revised.updatedAt,2000);
 const revoked=revokeMemoryRecord(revised,'No longer accurate',3000);
 assert.equal(revoked.status,'revoked');
 assert.equal(revoked.revokeReason,'No longer accurate');
 assert.equal(activeMemories([revoked],{participantId:'p',now:4000}).length,0);
 assert.throws(()=>reviseMemoryRecord(revoked,'change',5000),/Revoked/);
});

test('10G ledger restores only durable rows, supports session memory and purges participant state',()=>{
 const persistent=normalizeMemoryRecord({id:'saved',participantId:'p',text:'Saved',persistent:true},1000);
 const ledger=new AgentMemoryLedger({max:3});
 ledger.restore([persistent,persistent]);
 assert.equal(ledger.entries().length,1);
 const session=ledger.add({id:'session',participantId:'p',type:'note',text:'Session only',persistent:false},2000);
 assert.equal(session.persistent,false);
 assert.equal(ledger.contextFor('p',2500).length,2);
 const other=ledger.add({id:'other',participantId:'q',text:'Other'},3000);
 assert.equal(other.participantId,'q');
 assert.equal(ledger.purgeParticipant('p'),2);
 assert.deepEqual(ledger.entries().map(x=>x.id),['other']);
});

test('10G current-session references come from canonical stores and remain temporally labelled',()=>{
 const refs=sessionContextReferences({
  participantId:'p',
  dialogueTurns:[
   {id:'d1',participantId:'p',transcript:'Current transcript',createdAt:'2026-10-04T05:00:00Z'},
   {id:'d2',participantId:'q',transcript:'Other person',createdAt:'2026-10-04T05:00:01Z'}
  ],
  roomEvents:[
   {id:'r1',participantId:'p',message:'P observed at desk',at:100},
   {id:'r2',participantId:null,message:'Room microphone online',at:200}
  ]
 });
 assert.deepEqual(refs.map(x=>x.sourceId),['d1','r2','r1']);
 assert.ok(refs.every(x=>x.temporal==='current-session'));
 assert.match(refs[0].label,/Current session/);
});

test('10G local model receives authorized historical memory as historical, not current sensor truth',()=>{
 const messages=buildAgentMessages([], 'What do you remember?', 'Pat',
  ['Historical owner memory [preference]: Prefers quiet mornings']);
 assert.equal(messages.length,2);
 assert.match(messages[0].content,/historical owner memory/i);
 assert.match(messages[0].content,/never as a current sensor fact/i);
 assert.match(messages[0].content,/Prefers quiet mornings/);
 const noMemory=buildAgentMessages([], 'Hi', '',[]);
 assert.match(noMemory[0].content,/No durable participant memory was provided/);
});

test('10G basic local reply exposes memory only for verified named participant context',()=>{
 const memories=['Historical owner memory [preference]: Prefers tea'];
 const known=localAgentReply('What do you remember about me?',{name:'Pat',memories});
 assert.match(known,/Prefers tea/);
 assert.match(known,/historical context/);
 const unknown=localAgentReply('What do you remember about me?',{name:'',memories});
 assert.match(unknown,/cannot use participant memory until the speaker is verified/i);
});

test('10G persistence is additive v6 owner-only memory metadata and participant deletion propagates atomically',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const version=Number(store.match(/const DB_VERSION = (\d+)/)?.[1]);
 assert.ok(version>=6);
 assert.match(store,/const AGENT_MEMORIES = 'agent-memories'/);
 assert.match(store,/createObjectStore\(AGENT_MEMORIES,\{keyPath:'id'\}\)/);
 assert.match(store,/Only owner-authored memory can be persisted/);
 const del=store.slice(store.indexOf('export async function deleteParticipant('),
  store.indexOf('export async function prunePendingCaptures('));
 assert.match(del,/AGENT_MEMORIES/);
 assert.match(del,/memory.participantId === id\) memories.delete\(memory.id\)/);
 const saveStart=store.indexOf('export async function saveAgentMemory');
 const syncStart=store.indexOf('/* V0.10H explicit manual participant sync state.',saveStart);
 const save=store.slice(saveStart,syncStart>saveStart?syncStart:undefined);
 assert.doesNotMatch(save,/transcript|rawAudio|embedding|primaryPhoto|ciphertext/);
});

test('10G UI requires explicit save choice and supports revision, revocation, deletion and canonical session context',()=>{
 const ui=fs.readFileSync('src/agent-memory-ui.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.match(html,/id="agentMemoryPersist"/);
 assert.match(html,/Not copied into durable memory automatically/);
 assert.match(ui,/ledger\.revise\(/);
 assert.match(ui,/ledger\.revoke\(/);
 assert.match(ui,/deleteAgentMemory/);
 assert.match(ui,/sessionContextReferences/);
 assert.match(controller,/getMemories:participantId=>memoryUI\?\.contextFor\(participantId\)\|\|\[\]/);
 assert.match(agent,/verifiedMemoryScope/);
 assert.match(agent,/reasoningContext\.mayUseParticipantMemory/);
 assert.match(agent,/buildAgentMultimodalContext/);
 assert.doesNotMatch(ui,/getUserMedia|MediaRecorder|fetch\(/);
});

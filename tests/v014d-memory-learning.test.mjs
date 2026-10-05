import test from 'node:test';import assert from 'node:assert/strict';
import {
 MemoryProposalLedger,approvedMemoryFromProposal,canonicalMemoryEvidence,
 dialogueEligibleForParticipantMemory,reviewMemoryProposal,sensitiveMemoryReason,
 validateMemoryProposalSources
} from '../src/agent-memory-learning-core.js';
import {normalizeMemoryRecord} from '../src/agent-memory-core.js';

const eligibleTurn=(more={})=>({
 id:'t1',participantId:'p1',transcript:'I prefer black coffee.',
 createdAt:'2026-10-05T17:00:00Z',associationState:'verified-voice+body',
 multiPersonTurnOwnership:'single-speaker',multiPersonAttributionState:'single-speaker',
 multiPersonUnresolvedCount:0,multiPersonPartialAttribution:false,
 multiPersonAttributionCorrections:[],...more
});

test('14D participant proposals require canonical single-speaker verified or owner-corrected evidence',()=>{
 assert.equal(dialogueEligibleForParticipantMemory(eligibleTurn()),true);
 assert.equal(dialogueEligibleForParticipantMemory(eligibleTurn({participantId:null})),false);
 assert.equal(dialogueEligibleForParticipantMemory(eligibleTurn({multiPersonTurnOwnership:'overlap'})),false);
 assert.equal(dialogueEligibleForParticipantMemory(eligibleTurn({multiPersonPartialAttribution:true})),false);
 assert.equal(dialogueEligibleForParticipantMemory(eligibleTurn({associationState:'verified-voice-visual-conflict'})),false);
 assert.equal(dialogueEligibleForParticipantMemory(eligibleTurn({
  associationState:'verified-voice-visual-conflict',
  multiPersonAttributionCorrections:[{participantId:'p1',source:'local-owner'}]
 })),true);
});

test('14D deterministic proposal generation uses explicit canonical statements only',()=>{
 const rows=canonicalMemoryEvidence({dialogueTurns:[
  eligibleTurn(),
  eligibleTurn({id:'t2',transcript:'The weather looks nice.'}),
  eligibleTurn({id:'t3',transcript:'Please remember that my desk lamp uses warm bulbs.'})
 ]});
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.type).sort(),['note','preference']);
 assert.ok(rows.every(x=>x.participantId==='p1'&&x.sourceRefs.length===1));
 assert.match(rows.find(x=>x.type==='preference').text,/black coffee/i);
});

test('14D sensitive health emotion protected-trait and financial text is never auto-proposed',()=>{
 for(const value of [
  'I prefer medication for anxiety.','I feel sad today.','My religion is Buddhist.',
  'My political party is Democrat.','My bank account is 1234.'
 ])assert.ok(sensitiveMemoryReason(value));
 const rows=canonicalMemoryEvidence({dialogueTurns:[
  eligibleTurn({id:'h1',transcript:'Please remember that I have diabetes.'}),
  eligibleTurn({id:'h2',transcript:'I prefer therapy on Fridays.'})
 ]});
 assert.equal(rows.length,0);
});

test('14D meeting and owner ROOM evidence can propose only explicit bounded owner material',()=>{
 const rows=canonicalMemoryEvidence({
  roomEvents:[
   {id:'r1',kind:'decision',source:'owner-room',message:'Preference: dim desk lighting',at:20},
   {id:'r2',kind:'observation',source:'camera',message:'Preference: couch',at:21}
  ],
  meetings:[{id:'m1',startedAt:10,notes:[
   {id:'n1',text:'Remember: project codename is Atlas',at:30},
   {id:'n2',text:'Ordinary meeting note',at:31}
  ],decisions:[{id:'d1',sourceTurnId:'missing',note:'Ship the pilot',at:40}]}]
 });
 assert.equal(rows.length,3);
 assert.ok(rows.some(x=>x.sourceRefs[0].kind==='room-event'));
 assert.ok(rows.some(x=>x.sourceRefs[0].kind==='meeting-note'));
 assert.ok(rows.some(x=>x.sourceRefs[0].kind==='meeting-decision'));
});

test('14D source fingerprint invalidates corrected or deleted canonical evidence before approval',()=>{
 const turn=eligibleTurn();
 const proposal=canonicalMemoryEvidence({dialogueTurns:[turn]})[0];
 assert.equal(validateMemoryProposalSources(proposal,{dialogueTurns:[turn]}).valid,true);
 assert.equal(validateMemoryProposalSources(proposal,{dialogueTurns:[{...turn,transcript:'I prefer tea.'}]}).reason,'proposal-source-changed');
 assert.equal(validateMemoryProposalSources(proposal,{dialogueTurns:[]}).reason,'proposal-source-deleted');
 assert.equal(validateMemoryProposalSources(proposal,{dialogueTurns:[{...turn,multiPersonTurnOwnership:'overlap'}]}).reason,'proposal-source-changed');
});

test('14D duplicate and contradiction review is participant-scoped and deterministic',()=>{
 const proposal=canonicalMemoryEvidence({dialogueTurns:[eligibleTurn()]})[0];
 const same=normalizeMemoryRecord({id:'same',participantId:'p1',type:'preference',text:'Prefers black coffee'},1);
 const opposite=normalizeMemoryRecord({id:'opposite',participantId:'p1',type:'preference',text:'Does not prefer black coffee'},1);
 const other=normalizeMemoryRecord({id:'other',participantId:'p2',type:'preference',text:'Prefers black coffee'},1);
 let review=reviewMemoryProposal(proposal,[same,other]);
 assert.equal(review.state,'duplicate');assert.deepEqual(review.duplicateIds,['same']);
 review=reviewMemoryProposal(proposal,[opposite]);
 assert.equal(review.state,'contradiction');assert.deepEqual(review.contradictionIds,['opposite']);
});

test('14D approval creates owner-approved durable memory with bounded source provenance',()=>{
 const proposal=canonicalMemoryEvidence({dialogueTurns:[eligibleTurn()]})[0];
 const memory=approvedMemoryFromProposal(proposal,{text:'Prefers black coffee before noon',expiresAt:9999999999999,now:100});
 assert.equal(memory.authority,'owner');
 assert.equal(memory.provenance,'owner-approved-proposal');
 assert.equal(memory.sourceRefs.length,1);
 assert.equal(memory.sourceRefs[0].sourceId,'t1');
 assert.equal(memory.approvedAt,100);
 assert.equal(memory.persistent,true);
 assert.throws(()=>approvedMemoryFromProposal(proposal,{text:'Has diabetes'}),/blocked sensitive/);
});

test('14D proposal ledger is session-only and dismissal prevents immediate re-proposal',()=>{
 const ledger=new MemoryProposalLedger();
 const evidence={dialogueTurns:[eligibleTurn()]};
 assert.equal(ledger.scan(evidence).length,1);
 const id=ledger.entries()[0].id;ledger.dismiss(id);
 assert.equal(ledger.scan(evidence).length,0);
 ledger.clear();assert.equal(ledger.scan(evidence).length,1);
});

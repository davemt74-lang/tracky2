import test from 'node:test';
import assert from 'node:assert/strict';
import {
 canonicalMemoryEvidence,situationalPatternEvidence,validateMemoryProposalSources,
 approvedMemoryFromProposal,reviewMemoryProposal
} from '../src/agent-memory-learning-core.js';

const now=Date.now();
function awareness({positive=3,negative=0,action='research'}={}){
 const events=[
  {id:'e1',participantId:'p1',topicKey:'music:artist::song',type:'media-context',mediaKind:'music',message:'Artist — Song',confidence:.95,at:now-4000},
  {id:'e2',participantId:'p1',topicKey:'music:artist::song',type:'media-context',mediaKind:'music',message:'Artist — Song',confidence:.96,at:now-3000}
 ];
 const feedback=[];
 for(let i=0;i<positive;i++)feedback.push({
  at:now-2500+i,participantId:'p1',topicKey:'music:artist::song',
  eventType:'media-context',mediaKind:'music',action,
  outcome:i%2?'expanded':'positive',weight:1
 });
 for(let i=0;i<negative;i++)feedback.push({
  at:now-1000+i,participantId:'p1',topicKey:'music:artist::song',
  eventType:'media-context',mediaKind:'music',action,
  outcome:'dismissed',weight:1
 });
 return {events,feedback};
}

test('14.9G repeated positive situational evidence creates owner-review preference proposal',()=>{
 const situationalPatterns=situationalPatternEvidence(awareness());
 const rows=canonicalMemoryEvidence({situationalPatterns});
 const adaptive=rows.find(row=>row.method==='adaptive-situational-pattern');
 assert.ok(adaptive);
 assert.equal(adaptive.type,'preference');
 assert.equal(adaptive.participantId,'p1');
 assert.ok(adaptive.sourceRefs.length>=3);
 assert.ok(adaptive.sourceRefs.every(ref=>ref.kind==='situational-pattern'));
});

test('14.9G one-off or negative patterns do not create durable proposals',()=>{
 let rows=canonicalMemoryEvidence({situationalPatterns:situationalPatternEvidence(awareness({positive:1}))});
 assert.equal(rows.some(row=>String(row.method).startsWith('adaptive-')),false);
 rows=canonicalMemoryEvidence({situationalPatterns:situationalPatternEvidence(awareness({positive:4,negative:2}))});
 assert.equal(rows.some(row=>row.method==='adaptive-situational-pattern'),false);
});

test('14.9G interaction style can become a separate owner-review proposal',()=>{
 const situationalPatterns=situationalPatternEvidence(awareness({positive:5,action:'research'}));
 const rows=canonicalMemoryEvidence({situationalPatterns});
 const style=rows.find(row=>row.method==='adaptive-interaction-style');
 assert.ok(style);
 assert.match(style.text,/research-style proactive follow-up/);
});

test('14.9G proposal sources must still exist and match before approval',()=>{
 const situationalPatterns=situationalPatternEvidence(awareness());
 const proposal=canonicalMemoryEvidence({situationalPatterns})
  .find(row=>row.method==='adaptive-situational-pattern');
 assert.equal(validateMemoryProposalSources(proposal,{situationalPatterns}).valid,true);
 assert.equal(validateMemoryProposalSources(proposal,{situationalPatterns:[]}).valid,false);
});

test('14.9G owner approval produces normal durable memory with situational provenance',()=>{
 const situationalPatterns=situationalPatternEvidence(awareness());
 const proposal=canonicalMemoryEvidence({situationalPatterns})
  .find(row=>row.method==='adaptive-situational-pattern');
 const memory=approvedMemoryFromProposal(proposal,{expiresAt:now+90*86400000,persistent:true,now});
 assert.equal(memory.provenance,'owner-approved-proposal');
 assert.equal(memory.persistent,true);
 assert.equal(memory.sourceRefs[0].kind,'situational-pattern');
 assert.ok(memory.expiresAt>now);
});

test('14.9G contradiction review remains active for adaptive proposals',()=>{
 const situationalPatterns=situationalPatternEvidence(awareness());
 const proposal=canonicalMemoryEvidence({situationalPatterns})
  .find(row=>row.method==='adaptive-situational-pattern');
 const existing=[{
  id:'m1',type:'preference',participantId:'p1',
  text:proposal.text.replace('Recurring interest','Avoids recurring interest'),
  authority:'owner',provenance:'owner-authored',sourceRefs:[],
  createdAt:now-10000,updatedAt:now-10000,status:'active',revisions:[],persistent:true
 }];
 const review=reviewMemoryProposal({...proposal,text:proposal.text.replace('Recurring interest','Likes')},existing);
 assert.ok(['clear','related','contradiction'].includes(review.state));
});

test('14.9G stale evidence ages out of promotion eligibility',()=>{
 const old=awareness();
 old.events=old.events.map(row=>({...row,at:now-70*86400000}));
 old.feedback=old.feedback.map(row=>({...row,at:now-70*86400000}));
 const rows=canonicalMemoryEvidence({situationalPatterns:situationalPatternEvidence(old)});
 assert.equal(rows.some(row=>String(row.method).startsWith('adaptive-')),false);
});

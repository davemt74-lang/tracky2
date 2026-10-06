import test from 'node:test';
import assert from 'node:assert/strict';
import {
 contextualFollowThroughProposal,followThroughReplyDecision,
 confirmedFollowThrough,completedFollowThrough,followThroughResultMessage
} from '../src/contextual-followthrough-core.js';

const candidate={
 participantId:'p1',topicKey:'music:artist::song',mediaKind:'music',mediaLabel:'Artist — Song',
 mediaIdentity:{artist:'Artist',title:'Song'}
};

test('14.9F only actionable plans create pending follow-through proposals',()=>{
 assert.equal(contextualFollowThroughProposal({plan:{action:'conversation'},candidate}),null);
 const p=contextualFollowThroughProposal({plan:{action:'research'},candidate,at:1000});
 assert.equal(p.status,'pending-confirmation');
 assert.equal(p.action,'research');
 assert.match(p.query,/Artist — Song/);
 assert.equal(p.rawAudioStored,false);
});

test('14.9F explicit acceptance is required and ambiguous chatter does not confirm',()=>{
 const p=contextualFollowThroughProposal({plan:{action:'research'},candidate,at:1000});
 assert.equal(followThroughReplyDecision('yes, look it up',p,2000).action,'confirm');
 assert.equal(followThroughReplyDecision('that is interesting',p,2000).action,'none');
 assert.equal(followThroughReplyDecision('not now',p,2000).action,'decline');
});

test('14.9F expired proposals cannot execute',()=>{
 const p=contextualFollowThroughProposal({plan:{action:'research'},candidate,at:1000});
 assert.equal(followThroughReplyDecision('yes',p,p.expiresAt+1).action,'expire');
 assert.equal(confirmedFollowThrough(p,p.expiresAt+1),null);
});

test('14.9F completion keeps bounded HTTPS provenance',()=>{
 const p=confirmedFollowThrough(contextualFollowThroughProposal({plan:{action:'research'},candidate,at:1000}),2000);
 const done=completedFollowThrough(p,{
  summary:'Found related context',provider:'openai',model:'gpt',
  sources:[
   {url:'https://example.com/a',title:'A'},
   {url:'http://bad.example/x',title:'Bad'},
   ...Array.from({length:8},(_,i)=>({url:'https://example.com/'+i,title:'T'+i}))
  ],at:3000
 });
 assert.equal(done.status,'succeeded');
 assert.equal(done.sources.length,5);
 assert.match(followThroughResultMessage(done),/5 sources/);
});

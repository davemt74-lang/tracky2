import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RoomContextualCognitionTracker,contextualMediaObservation,
 contextualMediaEngagementCandidate,contextualMediaPrompt
} from '../src/room-contextual-cognition-core.js';

const now=200000;
const base=()=>({
 participant:{id:'p1'},
 temporal:{visibility:'observed',stationaryMs:70000},
 continuity:{active:{
  status:'active',continuityId:'c1',kind:'music',startedAt:100000,
  identityKey:'music:artist::song',
  identity:{kind:'music',artist:'Artist',title:'Song',confidence:.96}
 }},
 audio:{},lastDialogueAt:100000
});

test('14.9C idle visible participant plus stable identified media creates a cognition candidate',()=>{
 const obs=contextualMediaObservation({...base(),now});
 const c=contextualMediaEngagementCandidate(obs,[],now);
 assert.equal(c.eligible,true);
 assert.equal(c.participantId,'p1');
 assert.equal(c.mediaKind,'music');
 assert.equal(c.mediaIdentity.title,'Song');
 assert.doesNotMatch(c.task,/Artist|Song/);
});

test('14.9C active conversation suppresses media engagement',()=>{
 const obs=contextualMediaObservation({...base(),lastDialogueAt:190000,now});
 const c=contextualMediaEngagementCandidate(obs,[],now);
 assert.equal(c.eligible,false);
 assert.ok(c.reasons.includes('participant-not-idle'));
});

test('14.9C uncertain or provisional media suppresses proactive engagement',()=>{
 const input=base();
 input.continuity.active.provisionalInterstitial=true;
 const obs=contextualMediaObservation({...input,now});
 assert.equal(contextualMediaEngagementCandidate(obs,[],now).eligible,false);
});

test('14.9C low-confidence identity suppresses proactive engagement',()=>{
 const input=base();
 input.continuity.active.identity.confidence=.55;
 const obs=contextualMediaObservation({...input,now});
 const c=contextualMediaEngagementCandidate(obs,[],now);
 assert.ok(c.reasons.includes('media-not-confidently-identified'));
});

test('14.9C same media topic has a semantic repeat cooldown',()=>{
 const obs=contextualMediaObservation({...base(),now});
 const first=contextualMediaEngagementCandidate(obs,[],now);
 const next=contextualMediaEngagementCandidate(obs,[{topicKey:first.topicKey,executed:true,at:now-60000}],now);
 assert.equal(next.eligible,false);
 assert.ok(next.reasons.includes('recent-topic-engagement'));
});

test('14.9C prompt is generic cognition context, not hardcoded media dialogue',()=>{
 const obs=contextualMediaObservation({...base(),now});
 const c=contextualMediaEngagementCandidate(obs,[],now);
 const prompt=contextualMediaPrompt(c);
 assert.match(prompt,/verified current media context/);
 assert.match(prompt,/"title":"Song"/);
 assert.doesNotMatch(prompt,/Are you listening to Song/);
});

test('14.9C tracker records only metadata about executed engagement',()=>{
 const t=new RoomContextualCognitionTracker();
 const {candidate}=t.observe({...base()},now);
 const row=t.record(candidate,{executed:true,at:now});
 assert.equal(row.executed,true);
 assert.equal(row.topicKey,candidate.topicKey);
 assert.equal('rawAudio' in row,false);
});

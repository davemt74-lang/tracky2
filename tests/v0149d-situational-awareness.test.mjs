import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RoomSituationalAwarenessTracker,adaptiveInterestProfile,
 situationalInterestingness,normalizeSituationalEvent
} from '../src/room-situational-awareness-core.js';

test('14.9D positive response history raises adaptive interest over time',()=>{
 const t=new RoomSituationalAwarenessTracker();
 const at=100000;
 const event=t.observe({
  participantId:'p1',type:'media-context',topicKey:'music:jam-band',
  confidence:.9,novelty:.72,salience:.65
 },at);
 const before=t.evaluate(event,{now:at+1000}).score;
 for(let i=0;i<5;i++)t.noteFeedback({
  participantId:'p1',topicKey:'music:jam-band',eventType:'media-context',
  outcome:i<2?'positive':'expanded'
 },at+2000+i*1000);
 const after=t.evaluate(event,{now:at+10000}).score;
 assert.ok(after>before);
});

test('14.9D repeated ignored or dismissed engagement lowers future interest',()=>{
 const t=new RoomSituationalAwarenessTracker();
 const at=200000;
 const event=t.observe({
  participantId:'p1',type:'media-context',topicKey:'tv:fantasy',
  confidence:.9,novelty:.7,salience:.65
 },at);
 for(let i=0;i<6;i++)t.noteFeedback({
  participantId:'p1',topicKey:'tv:fantasy',eventType:'media-context',
  outcome:i<4?'ignored':'dismissed'
 },at+i*1000);
 const decision=t.evaluate(event,{now:at+10000});
 assert.ok(decision.profile.negative>0);
 assert.ok(decision.score<.58);
});

test('14.9D recurrence and interruption fatigue reduce mention-worthiness',()=>{
 const now=500000;
 const event=normalizeSituationalEvent({
  participantId:'p1',type:'media-context',topicKey:'music:x',
  confidence:.95,novelty:.7,salience:.7
 },now);
 const events=Array.from({length:8},(_,i)=>normalizeSituationalEvent({
  participantId:'p1',type:'media-context',topicKey:'music:x',
  confidence:.9,novelty:.6,salience:.6
 },now-10000-i*1000));
 const quiet=situationalInterestingness(event,{events,feedback:[],recentInterruptions:0,now});
 const tired=situationalInterestingness(event,{events,feedback:[],recentInterruptions:6,now});
 assert.ok(tired.score<quiet.score);
});

test('14.9D feedback can generalize by event type when exact topic is new',()=>{
 const now=900000;
 const feedback=[
  {participantId:'p1',topicKey:'music:a',eventType:'media-context',outcome:'expanded',at:now-1000,weight:1},
  {participantId:'p1',topicKey:'music:b',eventType:'media-context',outcome:'positive',at:now-2000,weight:1}
 ];
 const profile=adaptiveInterestProfile([],feedback,{
  participantId:'p1',topicKey:'music:new',eventType:'media-context',now
 });
 assert.ok(profile.score>.5);
});

test('14.9D tracker remains bounded and metadata-only',()=>{
 const t=new RoomSituationalAwarenessTracker({eventLimit:40,feedbackLimit:20});
 for(let i=0;i<80;i++)t.observe({
  participantId:'p1',type:'room-event',topicKey:'x:'+i,message:'event '+i
 },i);
 for(let i=0;i<40;i++)t.noteFeedback({
  participantId:'p1',topicKey:'x',eventType:'room-event',outcome:'neutral'
 },i);
 const s=t.snapshot();
 assert.equal(s.eventCount,40);
 assert.equal(s.feedbackCount,20);
 assert.equal('rawAudio' in s,false);
});

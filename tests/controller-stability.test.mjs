import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerStability } from '../src/controller-stability.js';
import { createMultiplayerMatch } from '../src/multiplayer-match.js';

const d=(x,y,confidence=.8)=>({x,y,confidence});
const roster=[{id:'a',name:'A'},{id:'b',name:'B'}];
const picks=[{color:'green',participantId:'a'},{color:'blue',participantId:'b'}];

test('requires consecutive valid frames before allowing any scoring',()=>{
 const t=createControllerStability();
 assert.equal(t.observe(d(.5,.45),1).type,'acquiring');
 assert.equal(t.observe(d(.51,.44),2).accepted,false);
 const accepted=t.observe(d(.5,.43),3);
 assert.equal(accepted.accepted,true);
 assert.equal(t.snapshot().status,'tracking');
 assert.equal(accepted.sample.timestamp,3);
});
test('a one-frame dropout immediately rejects input and reacquires safely',()=>{
 const t=createControllerStability();
 [1,2,3].forEach(i=>t.observe(d(.5,.45),i));
 const loss=t.observe(null,4);
 assert.equal(loss.type,'lost');
 assert.equal(loss.accepted,false);
 assert.equal(t.observe(d(.5,.43),5).accepted,false);
 assert.equal(t.observe(d(.5,.42),6).accepted,false);
 assert.equal(t.observe(d(.5,.41),7).accepted,true);
});
test('implausible marker jump drops the track and cannot score',()=>{
 const t=createControllerStability({maxJump:.3});
 [1,2,3].forEach(i=>t.observe(d(.5,.45),i));
 const bad=t.observe(d(.99,.05),4);
 assert.equal(bad.type,'jump-rejected');
 assert.equal(bad.lost,true);
 assert.equal(t.snapshot().locked,false);
 assert.equal(t.observe(d(.51,.45),5).accepted,false);
});
test('low-confidence color noise cannot become a marker',()=>{
 const t=createControllerStability({minConfidence:.2});
 assert.equal(t.observe(d(.4,.4,.01),1).accepted,false);
 assert.equal(t.snapshot().consecutive,0);
 assert.equal(t.observe(d(.4,.4,.8),2).accepted,false);
});
test('stale frames, reset and invalid configuration fail closed',()=>{
 const t=createControllerStability();
 t.observe(d(.5,.45),2);
 assert.equal(t.observe(d(.5,.45),2).type,'stale-frame');
 assert.equal(t.observe(d(.5,.45),-1).type,'invalid-timestamp');
 assert.equal(t.snapshot().consecutive,1);
 t.reset();
 assert.equal(t.snapshot().consecutive,0);
 assert.equal(t.observe(d(.5,.45),1).type,'acquiring');
 assert.throws(()=>createControllerStability({stableFrames:0}),RangeError);
 assert.throws(()=>createControllerStability({maxJump:2}),RangeError);
});
test('turn-based game accepts only gated frames, including after a lost marker',()=>{
 const tracker=createControllerStability();
 const match=createMultiplayerMatch();
 match.configure(picks,roster);
 match.begin(2,()=>0);
 const green=match.getSession('green').game;
 green.activeZone=1;green.roundTarget=1;green.repsRemaining=1;green.detector.minExcursion=.03;
 let accepted=0;
 const apply=(y,t,confidence=.8)=>{
   const result=tracker.observe(d(.5,y,confidence),t);
   if (!result.accepted) { match.signalLost('green'); return result; }
   accepted++;
   return match.sample('green',{x:result.sample.x,y:result.sample.y,timestamp:t},()=>0);
 };
 apply(.435,1);apply(.435,2);apply(.435,3); // acquisition, then anchor
 apply(.395,4); // up only
 assert.equal(apply(.85,5).type,'jump-rejected');
 assert.equal(match.snapshot().players[0].score,0);
 apply(.435,6);apply(.435,7);apply(.435,8); // fresh acquisition
 apply(.395,9);apply(.355,10);
 assert.equal(apply(.395,11).type,'point');
 assert.equal(match.snapshot().activeColor,'blue');
 assert.ok(accepted>=6);
});

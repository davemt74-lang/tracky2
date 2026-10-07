import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerStability } from '../src/controller-stability.js';

const d=(x,y,confidence=.8)=>({x,y,confidence});

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


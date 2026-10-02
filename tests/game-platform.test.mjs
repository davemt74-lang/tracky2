import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamePlatform } from '../src/game-platform.js';
import { createRandomFollowPattern,randomFollowPatternGame,validatePatternSetup } from '../src/games/random-follow-pattern.js';
const one=[{participantId:'a',name:'Alex',color:'green'}];
const two=[...one,{participantId:'b',name:'Blake',color:'blue'}];
const make=(extra={})=>createRandomFollowPattern({players:two,intervalSeconds:30,rounds:5,random:()=>0,...extra});
const f=(y,t)=>({x:.5,y,timestamp:t});
test('registry accepts new game definitions without camera/identity and rejects duplicates',()=>{
 const registry=createGamePlatform();
 assert.deepEqual(registry.register(randomFollowPatternGame),{
  id:'random-follow-pattern',title:'Random Follow Pattern',
  description:randomFollowPatternGame.description
 });
 assert.equal(registry.list()[0].id,'random-follow-pattern');
 assert.equal(registry.createSession('random-follow-pattern',{players:one,intervalSeconds:60,rounds:10}).snapshot().totalRounds,10);
 assert.throws(()=>registry.register(randomFollowPatternGame),/already/);
 assert.throws(()=>registry.createSession('unknown'),RangeError);
 assert.throws(()=>registry.register({id:'bad!',title:'X',createSession(){}}),TypeError);
});
test('validates one or two unique enrolled players and fixed time/round options',()=>{
 for(const seconds of [30,60,90,120])for(const rounds of [5,10,15,20]){
   const setup=validatePatternSetup({players:one,intervalSeconds:seconds,rounds});
   assert.equal(setup.players.length,1);
 }
 assert.throws(()=>make({intervalSeconds:20}),RangeError);
 assert.throws(()=>make({rounds:6}),RangeError);
 assert.throws(()=>make({players:[...one,...one]}),TypeError);
 assert.throws(()=>make({players:[...two,{participantId:'c',name:'C',color:'green'}]}),RangeError);
 assert.throws(()=>make({players:[{participantId:'a',name:'a',color:'blue'}]}),TypeError);
});
test('each interval is one timed round and alternates players even if targets remain unfinished',()=>{
 const g=make({rounds:5});assert.equal(g.start(1000).type,'game-start');
 assert.equal(g.snapshot(1000).activeColor,'green');
 assert.equal(g.snapshot(2000).round,1);
 assert.equal(g.snapshot(2000).remainingMs,29000);
 assert.equal(g.sample('blue',f(.125,2000)).type,'not-your-turn');
 assert.equal(g.tick(30999).type,'tracking');
 assert.equal(g.tick(31000).type,'round-advanced');
 assert.equal(g.snapshot(31000).activeColor,'blue');
 assert.equal(g.snapshot(31000).round,2);
 assert.equal(g.snapshot(31000).remainingMs,30000);
 assert.equal(g.sample('green',f(.125,31001)).type,'not-your-turn');
 assert.equal(g.snapshot().players[0].roundsPlayed,1);
 assert.equal(g.snapshot().players[1].roundsPlayed,1);
});
test('four-zone follow sequence counts reps and chooses another zone inside same timed round',()=>{
 const g=make({players:one});g.start(0);
 const before=g.snapshot();assert.equal(before.activeZone,0);assert.equal(before.repsRemaining,3);
 assert.equal(g.sample('green',f(.375,1)).type,'outside-zone');
 // Three complete cycles entirely within zone 1, with no timer transition.
 let t=2,last;
 for(let rep=0;rep<3;rep++){
   for(const y of [.21,.16,.09,.16])last=g.sample('green',f(y,t++));
 }
 assert.equal(last.type,'target-complete');
 const after=g.snapshot();
 assert.equal(after.round,1);
 assert.equal(after.players[0].score,1);
 assert.equal(after.players[0].repsCompleted,3);
 assert.equal(after.activeZone,1);
 assert.equal(after.repsRemaining,3);
 assert.equal(g.sample('green',f(.125,t++)).type,'outside-zone');
});
test('late input consumes elapsed round before scoring, skip even multiple missing rounds',()=>{
 const g=make({rounds:5});g.start(0);
 const atBoundary=g.sample('green',f(.125,30000));
 assert.equal(atBoundary.type,'not-your-turn');
 assert.equal(g.snapshot(30000).activeColor,'blue');
 assert.equal(g.tick(150000).type,'game-complete');
 const snap=g.snapshot();
 assert.equal(snap.status,'completed');
 assert.equal(snap.roundsCompleted,5);
 assert.deepEqual(snap.roundHistory.map(r=>r.color),['green','blue','green','blue','green']);
 assert.equal(g.sample('blue',f(.125,150001)).type,'inactive');
 assert.equal(snap.players[0].score,0);
});
test('invalid and stale frames and tracking loss reset partial repetition',()=>{
 const g=make({players:one});g.start(0);
 assert.equal(g.sample('green',f(.22,1)).type,'tracking');
 assert.equal(g.sample('green',f(.15,2)).type,'tracking');
 assert.equal(g.signalLost('green').type,'signal-lost');
 assert.equal(g.sample('green',f(.22,3)).type,'tracking');
 assert.equal(g.sample('green',f(.22,3)).type,'stale-input');
 assert.equal(g.sample('green',f(2,4)).type,'invalid-input');
 assert.equal(g.snapshot().players[0].score,0);
 assert.equal(g.stop(4000).type,'stopped');
 assert.equal(g.snapshot().status,'stopped');
 assert.equal(g.start(9000).type,'game-start');
 assert.equal(g.snapshot().players[0].score,0);
});
test('only supported random source and monotonic timestamps advance game safely',()=>{
 assert.throws(()=>make({random:()=>1}).start(0),RangeError);
 const g=make();assert.equal(g.start(-1).type,'invalid-timestamp');
 g.start(100);
 assert.equal(g.tick(99).type,'stale-timestamp');
 assert.equal(g.tick(NaN).type,'invalid-timestamp');
 assert.equal(g.sample('green',f(.125,99)).type,'stale-timestamp');
 assert.equal(g.snapshot(100).remainingMs,30000);
});

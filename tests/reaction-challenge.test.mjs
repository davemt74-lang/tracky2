import test from 'node:test';import assert from 'node:assert/strict';
import { createGamePlatform } from '../src/game-platform.js';
import {reactionChallengeGame,createReactionChallenge} from '../src/games/reaction-challenge.js';
const one=[{participantId:'a',name:'Alex',color:'green'}],two=[...one,{participantId:'b',name:'Blake',color:'blue'}];
const frame=(y,t)=>({x:.5,y,timestamp:t});
const create=(opts={})=>createReactionChallenge({players:two,intervalSeconds:30,rounds:5,random:()=>0,...opts});
test('Reaction Challenge registers independently in the shared game platform',()=>{
 const p=createGamePlatform();p.register(reactionChallengeGame);
 assert.equal(p.createSession('reaction-challenge',{players:one}).snapshot().zoneCount,4);
});
test('requires visible departure and fresh entry before a hit, then chooses a new target',()=>{
 const g=create({players:one});g.start(0);
 assert.equal(g.snapshot().activeZone,0);
 assert.equal(g.sample('green',frame(.125,100)).type,'needs-exit');
 assert.equal(g.sample('green',frame(.375,200)).type,'armed');
 const hit=g.sample('green',frame(.125,620));
 assert.equal(hit.type,'hit');assert.equal(hit.reactionMs,620);
 assert.equal(g.snapshot().activeZone,1);assert.equal(g.snapshot().players[0].score,1);
 assert.equal(g.snapshot().players[0].bestReactionMs,620);
 assert.equal(g.sample('green',frame(.375,650)).type,'needs-exit');
 g.sample('green',frame(.125,800));
 const next=g.sample('green',frame(.375,1300));
 assert.equal(next.type,'hit');assert.equal(next.reactionMs,680);
 assert.equal(g.snapshot().players[0].averageReactionMs,650);
 assert.equal(g.snapshot().roundTargets,2);
});
test('a dropout disarms an in-progress target, preventing an accidental score',()=>{
 const g=create({players:one});g.start(0);
 g.sample('green',frame(.375,100));
 assert.equal(g.signalLost('green').type,'signal-lost');
 assert.equal(g.sample('green',frame(.125,200)).type,'needs-exit');
 assert.equal(g.snapshot().players[0].score,0);
});
test('each interval advances the scheduled player even when a target remains unfinished',()=>{
 const g=create();g.start(1000);
 assert.equal(g.sample('blue',frame(.375,2000)).type,'not-your-turn');
 assert.equal(g.tick(31000).type,'round-advanced');
 assert.equal(g.snapshot().activeColor,'blue');
 assert.equal(g.sample('green',frame(.125,31100)).type,'not-your-turn');
 assert.equal(g.tick(151000).type,'game-complete');
 assert.deepEqual(g.snapshot().roundHistory.map(x=>x.participantId),['a','b','a','b','a']);
});
test('six-player round robin uses shared green marker but scores each scheduled participant separately',()=>{
 const players=Array.from({length:6},(_,i)=>({participantId:'p'+i,name:'P'+i,color:'green'}));
 const g=create({players,rounds:10});g.start(0);
 g.sample('green',frame(.375,100));g.sample('green',frame(.125,500));
 assert.equal(g.snapshot().players[0].score,1);
 g.tick(30000);g.sample('green',frame(.125,30100));
 assert.equal(g.snapshot().activePlayerIndex,1);
 g.tick(300000);assert.deepEqual(g.snapshot().roundHistory.map(x=>x.participantId),[
 'p0','p1','p2','p3','p4','p5','p0','p1','p2','p3'
 ]);
 assert.equal(g.snapshot().players[1].score,0);
});
test('stale input, invalid inputs, catch-up timer and restart fail closed',()=>{
 const g=create();g.start(20);
 assert.equal(g.tick(19).type,'stale-timestamp');
 assert.equal(g.sample('green',frame(.125,19)).type,'stale-timestamp');
 assert.equal(g.sample('green',frame(.375,30)).type,'armed');
 assert.equal(g.sample('green',frame(.125,30)).type,'stale-input');
 assert.equal(g.sample('green',frame(2,40)).type,'invalid-input');
 assert.equal(g.stop(1000).type,'stopped');
 assert.equal(g.sample('green',frame(.125,1100)).type,'inactive');
 assert.equal(g.start(2000).type,'game-start');assert.equal(g.snapshot().players[0].score,0);
 assert.throws(()=>create({random:()=>1}).start(0),RangeError);
});

test('distinct incorrect-zone entries count as misses, not repeated camera frames',()=>{
 const g=create({players:one});g.start(0);
 assert.equal(g.sample('green',frame(.375,100)).type,'armed');
 assert.equal(g.sample('green',frame(.375,110)).type,'armed');
 assert.equal(g.snapshot().players[0].misses,0);
 assert.equal(g.sample('green',frame(.625,200)).type,'armed');
 assert.equal(g.snapshot().players[0].misses,1);
 assert.equal(g.sample('green',frame(.125,550)).type,'hit');
 assert.equal(g.snapshot().players[0].accuracyPct,50);
 g.tick(30000);
 assert.equal(g.snapshot().roundHistory[0].misses,1);
});
test('reaction entry must rearm for each new target and stale camera frames never score',()=>{
 const g=create({players:one});g.start(0);
 assert.equal(g.sample('green',frame(.375,100)).type,'armed');
 assert.equal(g.sample('green',frame(.125,150)).type,'hit');
 assert.equal(g.sample('green',frame(.375,150)).type,'stale-input');
 assert.equal(g.snapshot().players[0].score,1);
 assert.equal(g.snapshot().players[0].accuracyPct,100);
});

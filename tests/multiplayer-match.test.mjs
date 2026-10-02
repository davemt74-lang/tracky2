import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerMatch } from '../src/multiplayer-match.js';
const roster=[{id:'a',name:'A'}, {id:'b',name:'B'}];
const picks=[{color:'green',participantId:'a'},{color:'blue',participantId:'b'}];
const frame=(y,t)=>({x:0.5,y,timestamp:t});
test('manual assignment requires two distinct enrolled participants and markers',()=>{
 const m=createMultiplayerMatch();assert.equal(m.begin().type,'players-required');
 assert.throws(()=>m.configure([picks[0],picks[0]],roster),/distinct/);
 assert.throws(()=>m.configure([{color:'green',participantId:'unknown'},picks[1]],roster),/distinct/);
 assert.deepEqual(m.configure(picks,roster).players.map(p=>p.color),['green','blue']);
 assert.equal(JSON.stringify(m.snapshot()).includes('embedding'),false);
});
test('both controller scores and frame clocks are independent',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);assert.equal(m.begin(1,()=>0).type,'match-start');
 assert.equal(m.begin(1).type,'already-active');assert.throws(()=>m.configure(picks,roster),/Stop/);
 for(const c of ['green','blue']){
  const g=m.getSession(c).game;g.activeZone=1;g.roundTarget=1;g.repsRemaining=1;g.detector.minExcursion=0.03;
 }
 for(const [i,y] of [0.58,0.54,0.50,0.54].entries())m.sample('green',frame(y,i+1),()=>0);
 assert.equal(m.snapshot().players[0].score,1);assert.equal(m.snapshot().players[1].score,0);
 assert.equal(m.snapshot().active,true);
 assert.equal(m.sample('blue',frame(.58,1)).type,'tracking');
 for(const [i,y] of [.54,.50,.54].entries())m.sample('blue',frame(y,i+2),()=>0);
 assert.equal(m.snapshot().players[1].score,1);assert.equal(m.snapshot().complete,true);
});
test('a controller drop resets only its own partial rep',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);m.begin(2,()=>0);
 for(const c of ['green','blue']){const g=m.getSession(c).game;g.activeZone=1;g.detector.minExcursion=.03}
 m.sample('green',frame(.58,1));m.sample('green',frame(.50,2));
 m.sample('blue',frame(.58,1));m.sample('blue',frame(.50,2));
 assert.equal(m.signalLost('green').type,'signal-lost');
 assert.equal(m.sample('blue',frame(.54,3)).type,'rep');
 assert.equal(m.sample('green',frame(.54,3)).type,'tracking');
 assert.equal(m.stop().type,'match-stopped');
});
test('unknown color cannot score and malformed config cannot erase prior roster',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);
 assert.throws(()=>m.configure([picks[0],picks[0]],roster));
 assert.equal(m.snapshot().players.length,2);m.begin();
 assert.equal(m.sample('pink',frame(.5,1)).type,'unassigned-controller');
 assert.ok(['tracking','outside-zone'].includes(m.sample('green',frame(.5,1)).type));
 assert.equal(m.snapshot().players[0].score,0);
 assert.equal(m.snapshot().players[1].score,0);
});

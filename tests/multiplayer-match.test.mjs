import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerMatch } from '../src/multiplayer-match.js';
const roster=[{id:'a',name:'A',embedding:[1,2]}, {id:'b',name:'B'}];
const picks=[{color:'green',participantId:'a'},{color:'blue',participantId:'b'}];
const frame=(y,t)=>({x:0.5,y,timestamp:t});
const oneRep=(match,color,start=1,zone=1)=> {
 const g=match.getSession(color).game;
 g.activeZone=zone;g.roundTarget=1;g.repsRemaining=1;g.detector.minExcursion=0.03;
 const base=(zone+0.5)/4; // each target is 1/4 of the board
 const ys=[base+.06,base+.02,base-.02,base+.02];
 return ys.map((y,i)=>match.sample(color,frame(y,start+i),()=>0));
};

test('two enrolled players share exactly four sections without storing biometrics',()=>{
 const m=createMultiplayerMatch();
 assert.equal(m.begin().type,'players-required');
 assert.throws(()=>m.configure([picks[0],picks[0]],roster),/distinct/);
 assert.throws(()=>m.configure([{color:'green',participantId:'other'},picks[1]],roster),/distinct/);
 const before=m.configure(picks,roster);
 assert.deepEqual(before.players.map(p=>p.color),['green','blue']);
 assert.equal(before.zoneCount,4);
 assert.equal(JSON.stringify(before).includes('embedding'),false);
});

test('green starts; each point alternates the same four-zone board highlight',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);
 assert.equal(m.begin(2,()=>0).activeColor,'green');
 assert.equal(m.begin(2).type,'already-active');
 assert.equal(m.sample('blue',frame(.38,1)).type,'not-your-turn');
 assert.throws(()=>m.configure(picks,roster),/Stop/);
 assert.equal(oneRep(m,'green').at(-1).type,'point');
 assert.equal(m.snapshot().activeColor,'blue');
 assert.equal(m.snapshot().turnNumber,2);
 assert.equal(m.snapshot().players[0].score,1);
 assert.equal(m.snapshot().players[1].score,0);
 assert.equal(m.sample('green',frame(.38,90)).type,'not-your-turn');
 assert.equal(oneRep(m,'blue').at(-1).type,'point');
 assert.equal(m.snapshot().activeColor,'green');
 assert.equal(m.snapshot().turnNumber,3);
 assert.equal(m.snapshot().players[0].score,1);
 assert.equal(m.snapshot().players[1].score,1);
});

test('four-zone scoring rejects samples from an adjacent section',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);m.begin(2,()=>0);
 const g=m.getSession('green').game;
 g.activeZone=3;g.roundTarget=1;g.repsRemaining=1;g.detector.minExcursion=.03;
 assert.equal(m.sample('green',frame(.60,1)).type,'outside-zone');
 assert.equal(g.repsRemaining,1);
 assert.equal(oneRep(m,'green',2,3).at(-1).type,'point');
});

test('tracking loss and turn switches discard incomplete repetitions',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);m.begin(2,()=>0);
 const g=m.getSession('green').game;g.activeZone=1;g.roundTarget=1;g.repsRemaining=1;g.detector.minExcursion=.03;
 m.sample('green',frame(.44,1));m.sample('green',frame(.34,2)); // upward leg only
 assert.equal(m.signalLost('green').type,'signal-lost');
 assert.equal(m.signalLost('blue').type,'not-your-turn');
 assert.notEqual(m.sample('green',frame(.44,3)).type,'rep');
 assert.equal(oneRep(m,'green',4).at(-1).type,'point');
 oneRep(m,'blue',4);
 const next=m.getSession('green').game;next.activeZone=1;next.roundTarget=1;next.repsRemaining=1;
 assert.notEqual(m.sample('green',frame(.44,100)).type,'rep');
});

test('completed players are skipped until both finish, with independent scores',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);m.begin(1,()=>0);
 assert.equal(oneRep(m,'green').at(-1).type,'game-over');
 assert.equal(m.snapshot().activeColor,'blue');
 assert.equal(m.sample('green',frame(.4,30)).type,'not-your-turn');
 const last=oneRep(m,'blue');
 assert.equal(last.at(-1).type,'game-over');
 const state=m.snapshot();
 assert.equal(state.complete,true);
 assert.equal(state.active,false);
 assert.equal(state.activeColor,null);
 assert.equal(state.players[0].score,1);
 assert.equal(state.players[1].score,1);
 assert.equal(m.stop().type,'inactive');
});

test('unassigned colors, stale frames and malformed configurations cannot change scores',()=>{
 const m=createMultiplayerMatch();m.configure(picks,roster);
 assert.throws(()=>m.configure([picks[0],picks[0]],roster));
 m.begin();
 assert.equal(m.sample('pink',frame(.38,1)).type,'unassigned-controller');
 assert.equal(m.sample('blue',frame(.38,1)).type,'not-your-turn');
 assert.ok(['tracking','outside-zone'].includes(m.sample('green',frame(.38,1)).type));
 assert.equal(m.sample('green',frame(.40,1)).type,'stale-input');
 assert.equal(m.snapshot().players[0].score,0);
 assert.equal(m.snapshot().players[1].score,0);
 assert.equal(m.stop().type,'match-stopped');
});

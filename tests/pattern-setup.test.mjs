import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePatternPlayers } from '../src/games/pattern-setup.js';
const roster=[{id:'a',name:'Alex',faceEmbedding:[1,2,3]},{id:'b',name:'Blake'}];
test('one selected enrolled player uses green marker only',()=>{
 const x=resolvePatternPlayers(roster,{count:1,greenId:'a'});
 assert.deepEqual(x,[{participantId:'a',name:'Alex',color:'green'}]);
 assert.equal(JSON.stringify(x).includes('faceEmbedding'),false);
});
test('two selected enrolled participants use distinct controller colors',()=>{
 const x=resolvePatternPlayers(roster,{count:2,greenId:'b',blueId:'a'});
 assert.deepEqual(x.map(p=>p.color),['green','blue']);
 assert.deepEqual(x.map(p=>p.participantId),['b','a']);
});
test('invalid player count, unregistered or duplicate ids fail closed',()=>{
 assert.throws(()=>resolvePatternPlayers(roster,{count:3,greenId:'a'}),RangeError);
 assert.throws(()=>resolvePatternPlayers(roster,{count:2,greenId:'a',blueId:'a'}),/different/);
 assert.throws(()=>resolvePatternPlayers(roster,{count:1,greenId:'other'}),/no longer enrolled/);
 assert.throws(()=>resolvePatternPlayers(roster,{count:2,greenId:'a'}),/different/);
});

test('six-player setup binds the existing enrolled roster to one shared green marker',()=>{
 const six=Array.from({length:6},(_,i)=>({id:'i'+i,name:'Person '+i,embedding:[i]}));
 const players=resolvePatternPlayers(six,{
   count:6,greenId:'i0',blueId:'i1',
   extraIds:['i2','i3','i4','i5'],intervalSeconds:90,rounds:10
 });
 assert.equal(players.length,6);
 assert.deepEqual(players.map(p=>p.color),Array(6).fill('green'));
 assert.equal(JSON.stringify(players).includes('embedding'),false);
 assert.throws(()=>resolvePatternPlayers(six,{
   count:6,greenId:'i0',blueId:'i1',
   extraIds:['i2','i3','i4','i5'],intervalSeconds:30,rounds:5
 }),/at least/);
});

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
 assert.throws(()=>resolvePatternPlayers(roster,{count:2,greenId:'a',blueId:'a'}),/distinct/);
 assert.throws(()=>resolvePatternPlayers(roster,{count:1,greenId:'other'}),/Enroll/);
 assert.throws(()=>resolvePatternPlayers(roster,{count:2,greenId:'a'}),/distinct/);
});

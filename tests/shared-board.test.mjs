import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoardView } from '../src/shared-board.js';
import { GAME_SETTINGS } from '../src/game-platform.js';
test('platform shares supported player, interval, round and board options',()=>{
 assert.deepEqual(GAME_SETTINGS.playerCounts,[1,2,3,4,5,6]);
 assert.deepEqual(GAME_SETTINGS.intervals,[30,60,90,120]);
 assert.deepEqual(GAME_SETTINGS.rounds,[5,10,15,20]);
 assert.equal(GAME_SETTINGS.boardZones,4);
});
test('shared board emits four zones with color and active rep target for either game',()=>{
 for (const color of ['green','blue']){
   const v=sharedBoardView({active:true,activeColor:color,activeZone:3,repsRemaining:5});
   assert.equal(v.color,color);
   assert.equal(v.zones.length,4);
   assert.deepEqual(v.zones.map(z=>z.label),['1','2','3','5']);
   assert.deepEqual(v.zones.filter(z=>z.target).map(z=>z.index),[3]);
 }
 const off=sharedBoardView({active:false,activeColor:'blue',activeZone:3,repsRemaining:99});
 assert.equal(off.color,'idle');
 assert.equal(off.zones.filter(z=>z.target).length,0);
 assert.throws(()=>sharedBoardView({zoneCount:3}),RangeError);
});

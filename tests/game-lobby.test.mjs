import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LOBBY_TICKET_KEY,validateLobbySelection,makeLobbyTicket,consumeLobbyTicket,roundRosterPreview
} from '../src/game-lobby.js';
const roster=Array.from({length:6},(_,i)=>({id:'p'+(i+1),name:'Player '+(i+1),faceDescriptor:[1,2]}));
const choice=(n,rounds=10)=>({
  gameId:'random-follow-pattern',playerIds:roster.slice(0,n).map(p=>p.id),
  intervalSeconds:60,rounds
});
test('supports up to six unique enrolled players with honest controller allocation',()=>{
 for (const n of [1,2,3,4,5,6]){
   const x=validateLobbySelection(roster,choice(n));
   assert.equal(x.players.length,n);
   assert.equal(x.controllerMode,n===2?'individual-colors':'shared-green');
   assert.deepEqual(x.players.map(p=>p.color),n===2?['green','blue']:Array(n).fill('green'));
   assert.equal(x.totalSeconds,600);
   assert.equal(JSON.stringify(x).includes('faceDescriptor'),false);
 }
});
test('requires each selected participant to receive at least one interval',()=>{
 assert.throws(()=>validateLobbySelection(roster,choice(6,5)),/at least/);
 const t=validateLobbySelection(roster,choice(6,10));
 const preview=roundRosterPreview(t);
 assert.equal(preview.length,10);
 assert.deepEqual(preview.map(x=>x.playerNumber),[1,2,3,4,5,6,1,2,3,4]);
 assert.equal(preview[5].color,'green');
});
test('rejects duplicates, missing enrollment and invalid game or duration',()=>{
 const duplicated=choice(3);duplicated.playerIds[2]='p1';
 assert.throws(()=>validateLobbySelection(roster,duplicated),/different/);
 const missing=choice(2);missing.playerIds[1]='deleted';
 assert.throws(()=>validateLobbySelection(roster,missing),/no longer enrolled/);
 assert.throws(()=>validateLobbySelection(roster,{...choice(2),gameId:'unknown'}),RangeError);
 assert.throws(()=>validateLobbySelection(roster,{...choice(2),intervalSeconds:25}),RangeError);
 assert.throws(()=>validateLobbySelection(roster,{...choice(2),rounds:9}),RangeError);
});
test('one-time tab ticket contains only selected IDs/settings and revalidates after enrollment changes',()=>{
 const verified=validateLobbySelection(roster,choice(4));
 const ticket=makeLobbyTicket(verified);
 assert.equal(ticket.includes('faceDescriptor'),false);
 assert.equal(ticket.includes('Player 1'),false);
 const map=new Map([[LOBBY_TICKET_KEY,ticket]]);
 const storage={
  getItem:k=>map.get(k)||null,
  removeItem:k=>map.delete(k)
 };
 const r=consumeLobbyTicket(storage,roster);
 assert.equal(r.status,'ready');
 assert.equal(r.setup.players.length,4);
 assert.equal(map.size,0);
 assert.equal(consumeLobbyTicket(storage,roster).status,'empty');
 map.set(LOBBY_TICKET_KEY,ticket);
 assert.equal(consumeLobbyTicket(storage,roster.slice(1)).status,'invalid');
 assert.equal(map.size,0);
});
test('malformed oversized and inaccessible handoff tickets fail closed',()=>{
 const map=new Map([[LOBBY_TICKET_KEY,'bad-json']]);
 const s={getItem:k=>map.get(k),removeItem:k=>map.delete(k)};
 assert.equal(consumeLobbyTicket(s,roster).status,'invalid');
 map.set(LOBBY_TICKET_KEY,'x'.repeat(2049));
 assert.equal(consumeLobbyTicket(s,roster).status,'invalid');
 assert.equal(consumeLobbyTicket({getItem(){throw Error('denied')},removeItem(){}},roster).status,'unavailable');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_HISTORY_KEY, MAX_SAVED_MATCHES, readMatchHistory, saveMatchHistory,
 clearMatchHistory, deleteParticipantMatchHistory, playerProgress } from '../src/match-history.js';
function store(){const m=new Map();return {
 getItem:key=>m.get(key)??null,setItem:(key,value)=>m.set(key,value),
 removeItem:key=>m.delete(key)
};}
const match=(i,extra={})=>({
 id:'m'+i,startMs:i*10000,endMs:i*10000+200,completed:true,
 players:[{participantId:'a',color:'green',score:3,completedRounds:3},
 {participantId:'b',color:'blue',score:2,completedRounds:2}],...extra
});
test('explicitly saved results keep whitelisted statistics, never media or names',()=>{
 const s=store();assert.equal(readMatchHistory(s).length,0);
 const result=saveMatchHistory(s,{...match(1),photo:'sensitive',voiceEmbeddings:[1,2],
 players:[{...match(1).players[0],embedding:[1,2],name:'Sensitive name'},match(1).players[1]]});
 assert.equal(result.saved,true);
 const raw=s.getItem(MATCH_HISTORY_KEY);
 for(const str of ['sensitive','voiceEmbeddings','embedding','name'])assert.equal(raw.includes(str),false);
 assert.equal(readMatchHistory(s)[0].players[0].score,3);
 assert.equal(saveMatchHistory(s,match(1)).duplicate,true);
});
test('100 match cap and deterministic progress metrics',()=>{
 const s=store();for(let i=1;i<=MAX_SAVED_MATCHES+10;i++)saveMatchHistory(s,match(i));
 const list=readMatchHistory(s);
 assert.equal(list.length,MAX_SAVED_MATCHES);
 assert.equal(list[0].id,'m110');
 const progress=playerProgress(list,'a');
 assert.equal(progress.matches,100);assert.equal(progress.bestScore,3);
 assert.equal(progress.totalRounds,300);
 assert.equal(playerProgress(list,'none').matches,0);
});
test('participant deletion purges only that person from local history',()=>{
 const s=store();saveMatchHistory(s,match(1));
 assert.equal(deleteParticipantMatchHistory(s,'a'),true);
 assert.equal(readMatchHistory(s)[0].players.length,1);
 assert.equal(readMatchHistory(s)[0].players[0].participantId,'b');
 assert.equal(deleteParticipantMatchHistory(s,'b'),true);
 assert.equal(readMatchHistory(s).length,0);
});
test('clear history, malformed data and storage denial fail safely',()=>{
 const s=store();s.setItem(MATCH_HISTORY_KEY,'not json');
 assert.deepEqual(readMatchHistory(s),[]);
 assert.equal(saveMatchHistory(s,{...match(1),players:[]} ).saved,false);
 assert.equal(saveMatchHistory(null,match(2)).saved,false);
 const blocked={getItem(){throw Error('denied')},setItem(){throw Error('denied')},removeItem(){throw Error('denied')}};
 assert.deepEqual(readMatchHistory(blocked),[]);
 assert.equal(saveMatchHistory(blocked,match(3)).saved,false);
 assert.equal(clearMatchHistory(blocked),false);
 assert.equal(saveMatchHistory(s,match(4)).saved,true);
 assert.equal(clearMatchHistory(s),true);
 assert.equal(readMatchHistory(s).length,0);
});

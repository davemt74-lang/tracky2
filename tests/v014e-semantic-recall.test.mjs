import test from 'node:test';import assert from 'node:assert/strict';
import {
 MAX_SEMANTIC_INDEX_ITEMS,SemanticRecallIndex,searchRecallV2,summarizeRecallResults,
 explainRecallResultV2
} from '../src/semantic-recall-core.js';

const row=(id,text,more={})=>Object.freeze({
 id:'conversation:'+id,sourceType:'conversation',sourceId:id,subtype:'dialogue-turn',
 at:1000,title:'Pat',text,participantId:'p1',participantIds:Object.freeze(['p1']),
 temporal:'historical',provenance:Object.freeze(['canonical-dialogue']),
 references:Object.freeze([]),status:'final',decisionLike:false,...more
});

test('14E local semantic recall retrieves bounded paraphrases that strict lexical search misses',()=>{
 const rows=[
  row('a','I bought a new coffee grinder yesterday.'),
  row('b','The camera is online.',{participantId:null,participantIds:Object.freeze([])})
 ];
 const index=new SemanticRecallIndex();index.rebuild(rows,2000);
 const result=searchRecallV2(rows,'purchase coffee equipment',{semanticIndex:index,limit:10});
 assert.equal(result.mode,'local-semantic');
 assert.equal(result.results[0].sourceId,'a');
 assert.equal(result.results[0].retrieval.mode,'local-semantic');
 assert.ok(result.results[0].retrieval.semanticScore>0);
});

test('14E semantic index is bounded ephemeral canonical references only',()=>{
 const rows=Array.from({length:MAX_SEMANTIC_INDEX_ITEMS+30},(_,i)=>row(String(i),'Project note '+i,{at:i}));
 const index=new SemanticRecallIndex();const snap=index.rebuild(rows,1234);
 assert.equal(snap.itemCount,MAX_SEMANTIC_INDEX_ITEMS);
 assert.equal(snap.persistent,false);
 assert.equal(index.rows[0].row,rows[0]);
 assert.equal(Object.prototype.hasOwnProperty.call(index.rows[0],'media'),false);
 index.clear();assert.equal(index.snapshot().itemCount,0);
});

test('14E source participant temporal and absolute time filters apply before semantic ranking',()=>{
 const rows=[
  row('old','Bought coffee beans',{at:1000}),
  row('new','Purchased espresso beans',{at:9000,participantId:'p2',participantIds:Object.freeze(['p2']),temporal:'current-session'}),
  row('room','Coffee arrived',{at:8000,sourceType:'room',id:'room:r',sourceId:'r',participantId:null,participantIds:Object.freeze([])})
 ];
 const index=new SemanticRecallIndex();index.rebuild(rows);
 let out=index.search('buy coffee',{participantId:'p1',limit:10});
 assert.deepEqual(out.map(x=>x.sourceId),['old']);
 out=index.search('coffee',{sourceType:'room',limit:10});
 assert.deepEqual(out.map(x=>x.sourceId),['r']);
 out=index.search('coffee',{fromAt:5000,toAt:8500,limit:10});
 assert.deepEqual(out.map(x=>x.sourceId),['r']);
 out=index.search('coffee',{includeHistorical:false,limit:10});
 assert.deepEqual(out.map(x=>x.sourceId),['new']);
});

test('14E lexical fallback remains deterministic when semantic index is unavailable',()=>{
 const rows=[row('a','launch decision alpha beta')];
 const result=searchRecallV2(rows,'alpha beta',{semanticIndex:null,semantic:true});
 assert.equal(result.mode,'lexical-fallback');
 assert.equal(result.results.length,1);
 assert.equal(result.results[0].retrieval.mode,'lexical-fallback');
});

test('14E summaries remain bounded and preserve stale-reference visibility',()=>{
 const rows=[
  {...row('a','one'),references:Object.freeze([{type:'dialogue-turn',id:'gone',state:'stale'}])},
  row('b','two',{sourceType:'room',id:'room:b'})
 ];
 const summary=summarizeRecallResults(rows);
 assert.equal(summary.resultCount,2);assert.equal(summary.staleReferenceCount,1);
 assert.equal(summary.top.length,2);assert.match(summary.summary,/stale reference/);
});

test('14E explanation includes retrieval reason plus canonical provenance',()=>{
 const index=new SemanticRecallIndex();const rows=[row('a','I prefer concise replies')];index.rebuild(rows);
 const result=index.search('short responses',{limit:1})[0];
 const explain=explainRecallResultV2(result);
 assert.match(explain.summary,/canonical dialogue turn/);
 assert.match(explain.summary,/retrieval: local semantic match/);
 assert.match(explain.summary,/provenance:/);
});

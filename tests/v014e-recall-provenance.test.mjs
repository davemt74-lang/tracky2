import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildRecallProjection,explainRecallResult,searchRecall} from '../src/session-recall-core.js';
import {canonicalMemoryEvidence,approvedMemoryFromProposal} from '../src/agent-memory-learning-core.js';

const turn=(text='I prefer black coffee.',extra={})=>({
 id:'t1',participantId:'p1',participantName:'Pat',transcript:text,
 createdAt:'2026-10-05T17:00:00Z',sessionId:'s1',
 associationState:'verified-voice+body',
 multiPersonTurnOwnership:'single-speaker',multiPersonAttributionState:'single-speaker',
 multiPersonUnresolvedCount:0,multiPersonPartialAttribution:false,
 multiPersonAttributionCorrections:[],...extra
});

test('14E owner-approved memory links back to available canonical source',()=>{
 const original=turn();
 const proposal=canonicalMemoryEvidence({dialogueTurns:[original]})[0];
 const memory=approvedMemoryFromProposal(proposal,{now:2000});
 const rows=buildRecallProjection({dialogueTurns:[original],memories:[memory],participants:[{id:'p1',name:'Pat'}],now:3000});
 const result=rows.find(row=>row.id==='memory:'+memory.id);
 assert.ok(result);assert.equal(result.references.length,1);
 assert.deepEqual(result.references[0],{type:'dialogue-turn',id:'t1',state:'available'});
 assert.match(result.provenance.join(' '),/owner-approved-evidence-memory/);
});

test('14E corrected approved-memory evidence is visibly changed not silently rewritten',()=>{
 const original=turn();
 const proposal=canonicalMemoryEvidence({dialogueTurns:[original]})[0];
 const memory=approvedMemoryFromProposal(proposal,{now:2000});
 const corrected=turn('I prefer green tea.',{transcriptState:'corrected',transcriptEditedAt:'2026-10-05T17:05:00Z'});
 const rows=buildRecallProjection({dialogueTurns:[corrected],memories:[memory],participants:[{id:'p1',name:'Pat'}],now:3000});
 const result=rows.find(row=>row.id==='memory:'+memory.id);
 assert.equal(result.references[0].state,'changed');
 assert.match(result.status,/source reference changed/);
 assert.match(explainRecallResult(result).summary,/changed since approval/i);
});

test('14E deleted approved-memory evidence remains visibly stale',()=>{
 const original=turn();
 const proposal=canonicalMemoryEvidence({dialogueTurns:[original]})[0];
 const memory=approvedMemoryFromProposal(proposal,{now:2000});
 const rows=buildRecallProjection({dialogueTurns:[],memories:[memory],participants:[{id:'p1',name:'Pat'}],now:3000});
 const result=rows.find(row=>row.id==='memory:'+memory.id);
 assert.equal(result.references[0].state,'stale');
 assert.match(explainRecallResult(result).summary,/unavailable/i);
});

test('14E absolute time bounds extend existing source/participant/temporal filters',()=>{
 const rows=buildRecallProjection({dialogueTurns:[
  turn('alpha',{id:'old',createdAt:'2026-10-01T12:00:00Z'}),
  turn('alpha',{id:'new',createdAt:'2026-10-05T17:00:00Z'})
 ],participants:[{id:'p1',name:'Pat'}],now:Date.parse('2026-10-05T18:00:00Z')});
 const out=searchRecall(rows,'alpha',{fromAt:Date.parse('2026-10-05T00:00:00Z'),limit:10});
 assert.deepEqual(out.map(row=>row.sourceId),['new']);
});

test('14E semantic module contains no persistence network or raw media indexing path',()=>{
 const code=fs.readFileSync('src/semantic-recall-core.js','utf8');
 assert.doesNotMatch(code,/indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket|getUserMedia|MediaRecorder|recording-media|Blob|ArrayBuffer/);
 assert.match(code,/MAX_SEMANTIC_INDEX_ITEMS=320/);
 assert.match(code,/persistent:false/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14E recall UI exposes enhanced local ranking lexical fallback and bounded time windows',()=>{
 const html=read('vertical-motion.html'),ui=read('src/session-recall-ui.js');
 assert.match(html,/id="agentRecallMode"/);
 assert.match(html,/value="semantic"/);assert.match(html,/value="lexical"/);
 for(const value of ['24h','7d','30d'])assert.match(html,new RegExp('value="'+value+'"'));
 assert.match(html,/id="agentRecallSummary"/);
 assert.match(ui,/new SemanticRecallIndex\(\)/);
 assert.match(ui,/semanticIndex\.rebuild\(lastRows/);
 assert.match(ui,/searchRecallV2/);
 assert.match(ui,/summarizeRecallResults/);
 assert.match(ui,/explainRecallResultV2/);
});

test('14E each search rebuilds index from fresh canonical projection and never stores it',()=>{
 const ui=read('src/session-recall-ui.js');
 const run=ui.slice(ui.indexOf('async function run('),ui.indexOf('async function init('));
 assert.match(run,/lastRows=await projection\(\)/);
 assert.ok(run.indexOf('lastRows=await projection()')<run.indexOf('semanticIndex.rebuild(lastRows'));
 assert.match(run,/index not saved/);
 assert.doesNotMatch(ui,/saveSemantic|persistSemantic|localStorage|sessionStorage|indexedDB/);
});

test('14E result explanation and summary remain explicit about retrieval and stale references',()=>{
 const ui=read('src/session-recall-ui.js'),semantic=read('src/semantic-recall-core.js');
 assert.match(ui,/Why this result/);
 assert.match(ui,/explainRecallResultV2/);
 assert.match(semantic,/retrieval: /);
 assert.match(semantic,/staleReferenceCount/);
 assert.match(semantic,/local semantic match/);
 assert.match(semantic,/deterministic lexical fallback/);
});

test('14E raw recording media remains outside recall projection and semantic index',()=>{
 const recall=read('src/session-recall-core.js'),semantic=read('src/semantic-recall-core.js');
 assert.match(recall,/media-not-indexed/);
 assert.doesNotMatch(semantic,/getRecordingMedia|listRecordingChunks|recording-media|blob|rawAudio|pcm/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('14.9F provider API exposes research only behind explicit confirmation',()=>{
 const php=fs.readFileSync('server/provider-api.php','utf8');
 assert.match(php,/if\(\$action==='research'\)/);
 assert.match(php,/Explicit owner confirmation is required for web research/);
 assert.match(php,/\(\$data\['confirmed'\]\?\?false\)!==true/);
 assert.match(php,/provider\.research/);
});

test('14.9F OpenAI and Anthropic research use provider-native web search tools',()=>{
 const php=fs.readFileSync('server/provider-api.php','utf8');
 assert.match(php,/'tools'=>\[\['type'=>'web_search'\]\]/);
 assert.match(php,/web_search_20250305/);
 assert.match(php,/'max_uses'=>3/);
});

test('14.9F research source collection is bounded to HTTPS provenance',()=>{
 const php=fs.readFileSync('server/provider-api.php','utf8');
 assert.match(php,/count\(\$sources\)>=5/);
 assert.ok(php.includes("preg_match('#^https://#i',$url)"));
});

test('14.9F browser research client sends explicit confirmed action and bounded messages',()=>{
 const client=fs.readFileSync('src/agent-provider.js','utf8');
 assert.match(client,/export async function querySelfHostedResearch/);
 assert.match(client,/action:'research',confirmed:true/);
 assert.match(client,/boundedProviderMessages\(messages\)/);
 assert.match(client,/sources=.*slice\(0,5\)/s);
});

test('14.9F proactive composition does not itself invoke web research',()=>{
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const start=agent.indexOf('async function composeProactive');
 const end=agent.indexOf('return {init,greet',start);
 const block=agent.slice(start,end);
 assert.doesNotMatch(block,/querySelfHostedResearch/);
});

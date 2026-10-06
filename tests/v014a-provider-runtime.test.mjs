import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14A server provider runtime uses fixed upstreams and server-side secrets',()=>{
 const api=read('server/provider-api.php'),providers=read('server/providers.php');
 assert.match(api,/https:\/\/api\.openai\.com\/v1\/responses/);
 assert.match(api,/https:\/\/api\.anthropic\.com\/v1\/messages/);
 assert.match(api,/https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\//);
 assert.match(api,/tracky_provider_secret\(\$db,\$provider\)/);
 assert.doesNotMatch(api,/\$data\[['"](?:url|endpoint|apiKey|secret)['"]\]/);
 assert.match(providers,/TRACKY_PROVIDER_DAILY_REQUESTS/);
 assert.match(providers,/TRACKY_PROVIDER_SESSION_UNITS/);
 assert.match(providers,/TRACKY_PROVIDER_CIRCUIT_FAILURES/);
});

test('14A schema and UI expose provider use without exposing credentials',()=>{
 const bootstrap=read('server/bootstrap.php'),html=read('vertical-motion.html'),mode=read('agent-mode.js');
 const schemaVersion=Number(bootstrap.match(/TRACKY_SCHEMA_VERSION=(\d+)/)?.[1]||0);
 assert.ok(schemaVersion>=4,'14A provider schema must remain present in later additive schemas');
 assert.match(bootstrap,/provider_usage_daily/);
 assert.match(bootstrap,/providers\.use/);
 assert.match(html,/id="agentModelProvider"/);
 assert.match(html,/value="openai"/);assert.match(html,/value="anthropic"/);
 assert.match(html,/id="agentSpeechProvider"/);assert.match(html,/value="elevenlabs"/);
 assert.match(mode,/providerFallbackPlan/);assert.match(mode,/activeRemoteProvider/);
 assert.match(mode,/tracky2-agent-provider/);assert.match(mode,/querySelfHostedProvider/);
 assert.match(mode,/querySelfHostedSpeech/);
});

test('14A provider release artifacts remain included under later V0.14 additive releases',()=>{
 const workflow=read('.github/workflows/test.yml'),audit=read('scripts/audit.mjs'),sw=read('sw.js');
 for(const needle of ['src/provider-router-core.js','server/provider-api.php']){
  assert.match(workflow,new RegExp(needle.replaceAll('.','\\.')));
 }
 assert.match(workflow,/tracky2-v0\.14\.\d+-deploy\.zip/);
 assert.match(audit,/provider-router-core\.js/);assert.match(audit,/provider-api\.php/);
 assert.match(sw,/provider-router-core\.js/);assert.match(sw,/tracky2-static-v0\.14\.\d+/);
});


test('14A Auto provider UI prefers configured remote API keys while preserving explicit provider choices',()=>{
 const html=read('vertical-motion.html'),mode=read('agent-mode.js'),providers=read('server/providers.php');
 assert.match(html,/value="auto" selected>Auto · configured API key/);
 assert.match(html,/Auto uses the configured OpenAI key first, otherwise Anthropic/);
 assert.match(mode,/activeRemoteProvider\(selected,providerRuntime\.providers\)/);
 assert.match(mode,/localStorage\.setItem\('tracky2-agent-provider'/);
 assert.match(providers,/function tracky_chat_provider_plan/);
 assert.match(providers,/foreach\(\['openai','anthropic'\] as \$provider\)/);
});

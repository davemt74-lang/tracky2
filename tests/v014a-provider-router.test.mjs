import test from 'node:test';import assert from 'node:assert/strict';
import {
 boundedProviderMessages,normalizeProviderChoice,providerModelAllowed,providerModelFor,
 providerFallbackPlan,providerRequestUnits,normalizeProviderStatusPayload,providerBudgetLabel
} from '../src/provider-router-core.js';

test('14A provider router accepts only bounded text roles and drops hidden payloads',()=>{
 const rows=boundedProviderMessages([
  {role:'system',content:'  rules  ',embedding:[1,2]},
  {role:'user',content:'hello',image:'private'},
  {role:'tool',content:'must be dropped'},
  {role:'assistant',content:'ok'}
 ]);
 assert.deepEqual(rows,[{role:'system',content:'rules'},{role:'user',content:'hello'},{role:'assistant',content:'ok'}]);
 assert.equal(JSON.stringify(rows).includes('embedding'),false);
 assert.equal(JSON.stringify(rows).includes('private'),false);
 assert.ok(providerRequestUnits(rows,180)>=180);
});

test('14A model routing is allowlisted with deterministic defaults and fallback',()=>{
 assert.equal(normalizeProviderChoice('OPENAI'),'openai');
 assert.equal(normalizeProviderChoice('unknown'),'ollama');
 assert.equal(providerModelAllowed('openai','gpt-6-luna'),true);
 assert.equal(providerModelAllowed('openai','arbitrary-model'),false);
 assert.equal(providerModelFor('openai','arbitrary-model'),'gpt-6-luna');
 const plan=providerFallbackPlan('anthropic',[
  {provider:'openai',configured:true},{provider:'anthropic',configured:true}
 ]);
 assert.deepEqual(plan,['anthropic','openai']);
});

test('14A status normalization never needs a credential and reports bounded budgets',()=>{
 const status=normalizeProviderStatusPayload({authenticated:true,csrf:'token',providers:[{
  provider:'openai',configured:true,models:['gpt-6-luna'],defaultModel:'gpt-6-luna',
  budget:{daily:{requestsRemaining:9,unitsRemaining:1000},session:{requestsRemaining:3,unitsRemaining:300}}
 }]});
 assert.equal(status.providers[0].configured,true);
 assert.equal('secret' in status.providers[0],false);
 assert.match(providerBudgetLabel(status.providers[0].budget),/daily 9 requests/);
});

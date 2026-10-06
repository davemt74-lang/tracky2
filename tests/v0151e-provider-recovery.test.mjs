import test from 'node:test';
import assert from 'node:assert/strict';
import {ProviderRecoveryCoordinator} from '../src/provider-recovery-core.js';

test('15.1E failure enters bounded provider backoff and later allows recovery probe',()=>{
 const c=new ProviderRecoveryCoordinator();
 assert.equal(c.begin({requestKey:'r1',provider:'openai',now:1000}).allow,true);
 const failed=c.failure({requestKey:'r1',provider:'openai',reason:'timeout',now:2000});
 assert.equal(failed.state,'degraded');
 assert.equal(c.begin({requestKey:'r2',provider:'openai',now:3000}).reason,'provider-backoff');
 assert.equal(c.begin({requestKey:'r2',provider:'openai',now:failed.retryAfter}).allow,true);
});

test('15.1E successful recovery resets health and marks recovered',()=>{
 const c=new ProviderRecoveryCoordinator();
 c.begin({requestKey:'x',provider:'anthropic',now:1});
 c.failure({requestKey:'x',provider:'anthropic',now:2});
 c.begin({requestKey:'y',provider:'anthropic',now:20000});
 const result=c.success({requestKey:'y',provider:'anthropic',now:21000});
 assert.equal(result.recovered,true);
 assert.equal(result.state.state,'healthy');
});

test('15.1E logical completion prevents late duplicate work/speech across fallback providers',()=>{
 const c=new ProviderRecoveryCoordinator();
 assert.equal(c.begin({requestKey:'turn:42',provider:'openai',now:1000}).allow,true);
 c.failure({requestKey:'turn:42',provider:'openai',now:1100});
 assert.equal(c.begin({requestKey:'turn:42',provider:'anthropic',now:1200}).allow,true);
 c.success({requestKey:'turn:42',provider:'anthropic',now:1300});
 assert.equal(c.begin({requestKey:'turn:42',provider:'openai',now:1400}).reason,'logical-request-already-completed');
});

test('15.1E concurrent duplicate request key is rejected',()=>{
 const c=new ProviderRecoveryCoordinator();
 assert.equal(c.begin({requestKey:'same',provider:'media-web',now:1}).allow,true);
 assert.equal(c.begin({requestKey:'same',provider:'media-web',now:2}).reason,'logical-request-in-flight');
});

test('15.1E completion tombstones expire',()=>{
 const c=new ProviderRecoveryCoordinator({completeTtlMs:60000});
 c.begin({requestKey:'same',provider:'x',now:1});c.success({requestKey:'same',provider:'x',now:2});
 assert.equal(c.begin({requestKey:'same',provider:'x',now:61003}).allow,true);
});

test('15.1E state is bounded metadata only',()=>{
 const c=new ProviderRecoveryCoordinator({maxHistory:24});
 for(let i=0;i<60;i++){c.begin({requestKey:'r'+i,provider:'p',now:i*20000});c.failure({requestKey:'r'+i,provider:'p',reason:'e'+i,now:i*20000+1});}
 const s=c.snapshot(9999999);
 assert.ok(s.recent.length<=20);
 const json=JSON.stringify(s);
 for(const bad of ['rawAudio','transcript','embedding','audioBase64','samples'])assert.equal(json.includes(bad),false);
});

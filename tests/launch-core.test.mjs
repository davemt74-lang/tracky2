import test from 'node:test';import assert from 'node:assert/strict';
import { startupReport,shouldAutoEnter } from '../src/launch-core.js';
test('startup never requests camera or microphone to show lobby readiness',()=>{
 const ok=startupReport();assert.equal(ok.ready,true);assert.match(ok.message,/ready/);
 assert.equal(JSON.stringify(ok).includes('permission'),false);
});
test('unsafe context or unavailable storage displays actionable warning without blocking navigation',()=>{
 const a=startupReport({secureContext:false,storageAvailable:false});
 assert.equal(a.ready,false);assert.equal(a.problems.length,2);
 assert.match(a.message,/localhost or HTTPS/);
});
test('launch redirect is one-time and respects reduced motion and splash choice',()=>{
 assert.equal(shouldAutoEnter(),true);
 for(const options of [{seenThisTab:true},{optedOut:true},{reducedMotion:true}])
   assert.equal(shouldAutoEnter(options),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {participantStorageRecoveryReason} from '../src/participant-store.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('participant storage recovery recognizes browser IndexedDB internal failures',()=>{
 assert.equal(participantStorageRecoveryReason({name:'InternalError',message:'Internal error.'}),true);
 assert.equal(participantStorageRecoveryReason({name:'UnknownError',message:'backing store failure'}),true);
 assert.equal(participantStorageRecoveryReason({name:'QuotaExceededError',message:'quota exceeded'}),false);
});

test('participant save has recovery IndexedDB plus non-IndexedDB emergency storage',()=>{
 const store=read('src/participant-store.js');
 assert.match(store,/tracky-participant-profiles-recovery-v1/);
 assert.match(store,/saveRecoveryParticipant/);
 assert.match(store,/listRecoveryParticipants\(\)/);
 assert.match(store,/getRecoveryParticipant\(id\)/);
 assert.match(store,/deleteRecoveryParticipant/);
});

test('service worker cannot pin participant code to an old cache after deploy',()=>{
 const sw=read('sw.js');
 assert.match(sw,/tracky2-static-v0\.16\.0-agent-only-r1/);
 const fetchBlock=sw.slice(sw.indexOf("self.addEventListener('fetch'"));
 assert.match(fetchBlock,/Network-first for application code/);
 assert.match(fetchBlock,/fetch\(request\)\.then\(response=>/);
 assert.match(fetchBlock,/cache\.put\(request,response\.clone\(\)\)/);
});

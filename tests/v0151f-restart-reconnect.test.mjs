import test from 'node:test';
import assert from 'node:assert/strict';
import {RestartReconnectCoordinator,reconcileTransientState} from '../src/restart-reconnect-core.js';

test('15.1F stale transient proactive state is cleared after restart',()=>{
 const now=500000;
 const r=reconcileTransientState({
  pendingArrivalDecision:{at:now-60000,expiresAt:now+1000},
  pendingSituationalEngagement:{at:now-400000},
  pendingContextualFollowThrough:{at:now-400000,expiresAt:now+1000}
 },now);
 assert.equal(r.pendingArrivalDecision,null);
 assert.equal(r.pendingSituationalEngagement,null);
 assert.equal(r.pendingContextualFollowThrough,null);
 assert.deepEqual(r.cleared.sort(),['arrival','context-followthrough','situational-engagement']);
});

test('15.1F fresh confirmation-bound transient state may survive controlled reload reconciliation',()=>{
 const now=100000;
 const r=reconcileTransientState({
  pendingArrivalDecision:{at:now-1000,expiresAt:now+5000},
  pendingSituationalEngagement:{at:now-2000},
  pendingContextualFollowThrough:{at:now-3000,expiresAt:now+60000}
 },now);
 assert.ok(r.pendingArrivalDecision);
 assert.ok(r.pendingSituationalEngagement);
 assert.ok(r.pendingContextualFollowThrough);
});

test('15.1F completed logical action cannot replay after reconnect',()=>{
 const c=new RestartReconnectCoordinator({epochId:'e1'});
 c.markCompleted('proactive:abc',1000);
 c.setNetwork(false,1100);c.setNetwork(true,1200);
 assert.equal(c.replayAllowed('proactive:abc',1300).allow,false);
 assert.equal(c.snapshot(1300).reconnectGeneration,1);
});

test('15.1F replay tombstones expire',()=>{
 const c=new RestartReconnectCoordinator({epochId:'e1',replayTtlMs:60000});
 c.markCompleted('x',1);
 assert.equal(c.replayAllowed('x',60002).allow,true);
});

test('15.1F restart event records clean/unclean prior epoch only',()=>{
 const c=new RestartReconnectCoordinator({epochId:'new'});
 const e=c.restart({clean:false,priorEpochId:'old',now:100});
 assert.equal(e.clean,false);assert.equal(e.priorEpochId,'old');assert.equal(e.epochId,'new');
});

test('15.1F coordinator is metadata-only and bounded',()=>{
 const c=new RestartReconnectCoordinator({epochId:'e',maxHistory:24});
 for(let i=0;i<80;i++){c.setNetwork(false,i*2);c.setNetwork(true,i*2+1);}
 const json=JSON.stringify(c.snapshot(1000));
 assert.ok(c.snapshot(1000).recent.length<=20);
 for(const bad of ['rawAudio','transcript','embedding','samples','imageData'])assert.equal(json.includes(bad),false);
});


test('15.1F replay tombstones restore across browser reload',()=>{
 const first=new RestartReconnectCoordinator({epochId:'e1'});
 first.markCompleted('follow:42',1000);
 const second=new RestartReconnectCoordinator({epochId:'e2',state:first.exportState(1200)});
 assert.equal(second.replayAllowed('follow:42',1300).allow,false);
});

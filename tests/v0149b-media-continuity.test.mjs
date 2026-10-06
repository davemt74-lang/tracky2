import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RoomMediaContinuityTracker,mediaContinuityCompatibility,roomMediaContinuityMessage
} from '../src/room-media-continuity-core.js';

function bg(transition,kind,at,extra={}){
 return {transition,reason:extra.reason||('environmental-'+transition),state:{
  kind,sessionId:extra.sessionId||kind+'-'+at,identityKey:extra.identityKey||'',
  identity:extra.identity||null,confidence:.9
 }};
}

test('14.9B short stop/resume preserves one logical continuity id',()=>{
 const t=new RoomMediaContinuityTracker({resumeGraceMs:90000});
 const started=t.observeBackground(bg('started','music',1000,{sessionId:'a'}),1000);
 const id=started.continuity.continuityId;
 t.observeBackground(bg('stopped','music',20000,{sessionId:'a'}),20000);
 const resumed=t.observeBackground(bg('started','music',50000,{sessionId:'b'}),50000);
 assert.equal(resumed.transition,'resumed');
 assert.equal(resumed.continuity.continuityId,id);
 assert.equal(resumed.continuity.lowLevelSessionId,'b');
 assert.equal(resumed.continuity.resumes,1);
 assert.match(roomMediaContinuityMessage(resumed),/same background session/);
});

test('14.9B grace expiry makes later media a new logical session',()=>{
 const t=new RoomMediaContinuityTracker({resumeGraceMs:30000});
 const a=t.observeBackground(bg('started','television',1000),1000).continuity.continuityId;
 t.observeBackground(bg('stopped','television',5000),5000);
 const ended=t.expire(40000);
 assert.equal(ended.transition,'ended');
 const b=t.observeBackground(bg('started','television',41000),41000).continuity.continuityId;
 assert.notEqual(a,b);
});

test('14.9B foreground conversation preserves active background continuity',()=>{
 const t=new RoomMediaContinuityTracker();
 const id=t.observeBackground(bg('started','radio',1000),1000).continuity.continuityId;
 const interrupted=t.observeForeground({mode:'foreground-conversation-over-background'},5000);
 assert.equal(interrupted.transition,'interrupted');
 assert.equal(interrupted.continuity.continuityId,id);
 assert.equal(interrupted.continuity.status,'active');
 assert.equal(interrupted.continuity.rawAudioStored,false);
});

test('14.9B track changes stay inside the same music continuity session',()=>{
 const t=new RoomMediaContinuityTracker();
 const first=t.observeBackground(bg('started','music',1000,{
  identityKey:'music:a::one',identity:{artist:'A',title:'One'}
 }),1000);
 const changed=t.observeBackground(bg('identity-changed','music',30000,{
  identityKey:'music:a::two',identity:{artist:'A',title:'Two'},sessionId:'m1'
 }),30000);
 assert.equal(changed.transition,'content-changed');
 assert.equal(changed.continuity.continuityId,first.continuity.continuityId);
 assert.equal(changed.continuity.contentChanges,1);
});

test('14.9B episode changes in same series remain continuous',()=>{
 const compatibility=mediaContinuityCompatibility(
  {kind:'television',identityKey:'episode:show::one::1::1',identity:{series:'Show',title:'One'}},
  {kind:'television',identityKey:'episode:show::two::1::2',identity:{series:'Show',title:'Two'}}
 );
 assert.equal(compatibility.compatible,true);
 assert.equal(compatibility.reason,'same-series-content-change');
});

test('14.9B incompatible source change starts a new continuity id',()=>{
 const t=new RoomMediaContinuityTracker();
 const first=t.observeBackground(bg('started','music',1000),1000);
 const changed=t.observeBackground(bg('source-changed','television',3000),3000);
 assert.equal(changed.transition,'source-changed');
 assert.notEqual(changed.continuity.continuityId,first.continuity.continuityId);
 assert.equal(changed.previous.status,'ended');
});

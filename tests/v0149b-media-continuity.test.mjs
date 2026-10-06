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


test('14.9B short unrelated TV identity is treated as provisional interstitial and original program can resume',()=>{
 const t=new RoomMediaContinuityTracker({interstitialGraceMs:45000});
 const original=t.observeBackground(bg('started','television',1000,{
  identityKey:'episode:show::episode-1',identity:{series:'Show',title:'Episode 1'}
 }),1000);
 const id=original.continuity.continuityId;
 const ad=t.observeBackground(bg('identity-changed','television',10000,{
  identityKey:'television:brand::ad',identity:{series:'Brand',title:'Ad'}
 }),10000);
 assert.equal(ad.transition,'interstitial-started');
 assert.equal(ad.continuity.provisionalInterstitial,true);
 const resumed=t.observeBackground(bg('identity-changed','television',30000,{
  identityKey:'episode:show::episode-1',identity:{series:'Show',title:'Episode 1'}
 }),30000);
 assert.equal(resumed.transition,'interstitial-ended');
 assert.equal(resumed.continuity.continuityId,id);
 assert.equal(resumed.continuity.provisionalInterstitial,false);
});

test('14.9B persistent interstitial is promoted to new content after grace',()=>{
 const t=new RoomMediaContinuityTracker({interstitialGraceMs:15000});
 t.observeBackground(bg('started','television',1000,{
  identityKey:'episode:show::episode-1',identity:{series:'Show',title:'Episode 1'}
 }),1000);
 t.observeBackground(bg('identity-changed','television',5000,{
  identityKey:'television:new::content',identity:{series:'Different',title:'Program'}
 }),5000);
 const promoted=t.expire(21000);
 assert.equal(promoted.transition,'interstitial-promoted');
 assert.equal(promoted.continuity.provisionalInterstitial,false);
 assert.match(roomMediaContinuityMessage(promoted),/treating it as new content/);
});

test('14.9B repeated foreground speech over one background source is one interruption period',()=>{
 const t=new RoomMediaContinuityTracker();
 t.observeBackground(bg('started','music',1000),1000);
 const first=t.observeForeground({mode:'foreground-conversation-over-background'},2000);
 const second=t.observeForeground({mode:'foreground-conversation-over-background'},3000);
 assert.equal(first.emit,true);
 assert.equal(second.emit,false);
 assert.equal(second.continuity.interruptions,1);
});


test('14.9B original program can recover after a provisional interstitial itself stops',()=>{
 const t=new RoomMediaContinuityTracker({interstitialGraceMs:45000});
 const original=t.observeBackground(bg('started','television',1000,{
  identityKey:'episode:show::episode-1',identity:{series:'Show',title:'Episode 1'}
 }),1000);
 const id=original.continuity.continuityId;
 t.observeBackground(bg('identity-changed','television',10000,{
  identityKey:'television:brand::ad',identity:{series:'Brand',title:'Ad'}
 }),10000);
 t.observeBackground(bg('stopped','television',18000,{
  identityKey:'television:brand::ad',identity:{series:'Brand',title:'Ad'}
 }),18000);
 const resumed=t.observeBackground(bg('started','television',30000,{
  identityKey:'episode:show::episode-1',identity:{series:'Show',title:'Episode 1'}
 }),30000);
 assert.equal(resumed.transition,'interstitial-ended');
 assert.equal(resumed.continuity.continuityId,id);
});

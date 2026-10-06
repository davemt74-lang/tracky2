import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RoomAudioIntelligenceCoordinator,roomAudioIdentityKey,
 roomAudioIntelligenceMessage,roomAudioKindFromEnvironmental
} from '../src/room-audio-orchestration-core.js';

test('V0.14.8I maps environmental states into canonical ROOM audio kinds',()=>{
 assert.equal(roomAudioKindFromEnvironmental({category:'music',subtype:'instrumental-music'}),'music');
 assert.equal(roomAudioKindFromEnvironmental({category:'media-playback',subtype:'television'}),'television');
 assert.equal(roomAudioKindFromEnvironmental({category:'media-playback',subtype:'radio'}),'radio');
 assert.equal(roomAudioKindFromEnvironmental({category:'room-voice-activity',subtype:'speech-like-activity'}),'live-or-unknown-speech');
 assert.equal(roomAudioKindFromEnvironmental({category:'animal',subtype:'dog'}),null);
});

test('V0.14.8I preserves one continuous media session until source changes',()=>{
 const c=new RoomAudioIntelligenceCoordinator({staleMs:45000,repeatMs:60000});
 const a=c.observeEnvironmental({type:'start',category:'music',subtype:'music',at:1000,peakConfidence:.91,observationCount:1},1000);
 assert.equal(a.transition,'started');
 const session=a.state.sessionId;
 const b=c.observeEnvironmental({type:'continue',category:'music',subtype:'music',at:12000,peakConfidence:.94,observationCount:2},12000);
 assert.equal(b.transition,'continued');
 assert.equal(b.state.sessionId,session);
 const changed=c.observeEnvironmental({type:'start',category:'media-playback',subtype:'television',at:20000,peakConfidence:.9},20000);
 assert.equal(changed.transition,'source-changed');
 assert.equal(changed.previousState.sessionId,session);
 assert.equal(changed.previousState.status,'stopped');
 assert.equal(changed.state.kind,'television');
 assert.notEqual(changed.state.sessionId,session);
 assert.match(roomAudioIntelligenceMessage(changed),/Background audio changed/);
});

test('V0.14.8I confirmed identity attaches only to a compatible active session',()=>{
 const c=new RoomAudioIntelligenceCoordinator();
 c.observeEnvironmental({type:'start',category:'music',subtype:'music',at:1000,peakConfidence:.92},1000);
 const mismatch=c.observeIdentity({kind:'movie',title:'Example Movie',confidence:.9},2000);
 assert.equal(mismatch.transition,'identity-kind-mismatch');
 const identified=c.observeIdentity({
  kind:'music',artist:'Example Artist',title:'Example Track',album:'Album',
  confidence:.97,provider:'acrcloud',at:3000
 },3000);
 assert.equal(identified.transition,'identity-confirmed');
 assert.equal(identified.state.identity.title,'Example Track');
 assert.equal(identified.state.provider,'acrcloud');
 assert.match(roomAudioIntelligenceMessage(identified),/Example Artist — Example Track/);
});

test('V0.14.8I track changes retain session continuity but emit identity change',()=>{
 const c=new RoomAudioIntelligenceCoordinator();
 c.observeEnvironmental({type:'start',category:'music',subtype:'music',at:1000,peakConfidence:.92},1000);
 const session=c.snapshot().sessionId;
 c.observeIdentity({kind:'music',artist:'One',title:'A',confidence:.95,at:2000},2000);
 const changed=c.observeIdentity({kind:'music',artist:'Two',title:'B',confidence:.96,at:3000},3000);
 assert.equal(changed.transition,'identity-changed');
 assert.equal(changed.state.sessionId,session);
 assert.equal(changed.state.identity.title,'B');
});

test('V0.14.8I stop and stale timeout close sessions without participant attribution',()=>{
 const c=new RoomAudioIntelligenceCoordinator({staleMs:10000});
 c.observeEnvironmental({type:'start',category:'media-playback',subtype:'radio',at:1000,peakConfidence:.88},1000);
 const ended=c.expire(12000);
 assert.equal(ended.transition,'stopped');
 assert.equal(ended.state.status,'stopped');
 assert.equal(ended.state.participantId,null);
 assert.equal(c.snapshot().status,'idle');
 c.observeEnvironmental({type:'start',category:'music',subtype:'music',at:20000,peakConfidence:.9},20000);
 const stop=c.observeEnvironmental({type:'stop',category:'music',subtype:'music',at:24000},24000);
 assert.equal(stop.transition,'stopped');
 assert.equal(c.snapshot().status,'idle');
});

test('V0.14.8I identity keys are deterministic and bounded by media semantics',()=>{
 assert.equal(
  roomAudioIdentityKey({kind:'music',artist:'Artist',title:'Song'}),
  roomAudioIdentityKey({kind:'music',artist:'ARTIST',title:'SONG'})
 );
 assert.match(roomAudioIdentityKey({kind:'episode',series:'Series',title:'Episode',season:2,episode:4}),/^episode:/);
});

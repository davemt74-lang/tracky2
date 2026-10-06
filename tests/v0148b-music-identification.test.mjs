import test from 'node:test';
import assert from 'node:assert/strict';
import {
 MUSIC_ID_MIN_WINDOW_MS,MusicIdentificationTracker,MusicLyricLookupGuard,MusicRecognitionQueue,
 identifyMusicFingerprint,musicIdentificationMessage,musicLyricSearchSeed,
 musicWindowEligibility,normalizeLyricWorkingText,normalizeMusicCandidate
} from '../src/music-identification-core.js';

test('V2B music windows require stable bounded music and obey cooldown',()=>{
 assert.equal(musicWindowEligibility({category:'speech',durationMs:5000}).accept,false);
 assert.equal(musicWindowEligibility({category:'music',durationMs:MUSIC_ID_MIN_WINDOW_MS-1}).reason,'window-too-short');
 assert.equal(musicWindowEligibility({category:'music',durationMs:5000,at:20000,lastAttemptAt:15000}).reason,'recognition-cooldown');
 assert.equal(musicWindowEligibility({category:'music',durationMs:5000,at:30000,lastAttemptAt:15000}).accept,true);
});

test('V2B lyric working text stays bounded and temporary-search-ready',()=>{
 const lyric=normalizeLyricWorkingText('[Music] hello darkness my old friend I have come to talk with you again and again and again');
 assert.equal(lyric.usable,true);
 assert.ok(lyric.wordCount<=24);
 assert.ok(lyric.text.length<=220);
 assert.ok(lyric.query.length<=160);
 assert.doesNotMatch(lyric.text,/\[Music\]/i);
 const short=normalizeLyricWorkingText('la la');
 assert.equal(short.usable,false);
});

test('V2B repeated strong fingerprint evidence confirms a track',()=>{
 const tracker=new MusicIdentificationTracker();
 const a=normalizeMusicCandidate({
  title:'Song A',artist:'Artist A',confidence:.94,provider:'demo'
 },'fingerprint',1000);
 let result=tracker.observeCandidate(a,1000);
 assert.equal(result.transition,'candidate');
 result=tracker.observeCandidate({...a,at:14000},14000);
 assert.equal(result.transition,'confirmed');
 assert.equal(result.track.status,'confirmed');
 assert.match(musicIdentificationMessage(result),/Music identified/);
});

test('V2B different evidence sources can corroborate before confirmation',()=>{
 const tracker=new MusicIdentificationTracker();
 const fp=normalizeMusicCandidate({
  title:'Song A',artist:'Artist A',confidence:.78,provider:'finger'
 },'fingerprint',1000);
 const lyric=normalizeMusicCandidate({
  title:'Song A',artist:'Artist A',confidence:.76,provider:'lyrics'
 },'lyrics',13000);
 assert.equal(tracker.observeCandidate(fp,1000).transition,'candidate');
 const confirmed=tracker.observeCandidate(lyric,13000);
 assert.equal(confirmed.transition,'confirmed');
 assert.equal(confirmed.track.artist,'Artist A');
});

test('V2B track change requires the new candidate to confirm',()=>{
 const tracker=new MusicIdentificationTracker();
 const a=normalizeMusicCandidate({title:'A',artist:'One',confidence:.95,provider:'fp'},'fingerprint',1000);
 tracker.observeCandidate(a,1000);tracker.observeCandidate(a,13000);
 const b=normalizeMusicCandidate({title:'B',artist:'Two',confidence:.95,provider:'fp'},'fingerprint',30000);
 assert.equal(tracker.observeCandidate(b,30000).transition,'candidate');
 const changed=tracker.observeCandidate(b,43000);
 assert.equal(changed.transition,'track-changed');
 assert.match(musicIdentificationMessage(changed),/Track changed/);
});

test('V2B queue retains at most one memory-only recognition job and never persists samples',()=>{
 const queue=new MusicRecognitionQueue({maxQueue:1,cooldownMs:3000});
 const first=queue.enqueue({category:'music',durationMs:5000,samples:new Float32Array([.1,.2])},10000);
 assert.equal(first.accepted,true);
 const job=queue.beginNext();
 assert.equal(job.samples.length,2);
 assert.equal(queue.snapshot().processing,true);
 queue.complete(job);
 assert.equal(queue.snapshot().processing,false);
 queue.setEnabled(false);
 assert.equal(queue.snapshot().queueDepth,0);
});

test('V2B invalid title or artist cannot become an exact track identity',()=>{
 assert.equal(normalizeMusicCandidate({title:'Only title',confidence:.99},'fingerprint',1),null);
 assert.equal(normalizeMusicCandidate({artist:'Only artist',confidence:.99},'fingerprint',1),null);
});


test('V2B fingerprint adapter is provider-independent and returns normalized candidates',async()=>{
 const provider={identify:async({samples,sampleRate,durationMs})=>{
  assert.equal(samples.length,3);assert.equal(sampleRate,16000);assert.equal(durationMs,5000);
  return {title:'Track',artist:'Artist',album:'Album',confidence:.93,
   provider:'mock-fingerprint',externalId:'track-1'};
 }};
 const result=await identifyMusicFingerprint(provider,{
  samples:new Float32Array([.1,.2,.3]),sampleRate:16000,durationMs:5000,at:1000
 });
 assert.equal(result.available,true);
 assert.equal(result.reason,'candidate');
 assert.equal(result.candidate.title,'Track');
 assert.equal(result.candidate.source,'fingerprint');
 const unavailable=await identifyMusicFingerprint(null,{samples:new Float32Array([.1])});
 assert.equal(unavailable.reason,'provider-not-configured');
});

test('V2B lyric search seed exposes only bounded working text for the later resolver',()=>{
 const query=musicLyricSearchSeed('hello darkness my old friend I have come to talk with you again');
 assert.ok(query.length>10&&query.length<=160);
 assert.equal(musicLyricSearchSeed('la la'), '');
});


test('V2B pending candidates are never described as identified when music stops',()=>{
 const tracker=new MusicIdentificationTracker();
 const candidate=normalizeMusicCandidate({
  title:'Maybe Song',artist:'Maybe Artist',confidence:.7,provider:'mock'
 },'fingerprint',1000);
 tracker.observeCandidate(candidate,1000);
 const stopped=tracker.clearConfirmed(5000);
 assert.equal(stopped.track.status,'candidate');
 assert.equal(musicIdentificationMessage(stopped),'');
});


test('V2B3 distinct lyric clues can corroborate the same strong web candidate',()=>{
 const tracker=new MusicIdentificationTracker();
 const first=normalizeMusicCandidate({
  title:'Same Song',artist:'Same Artist',confidence:.84,provider:'openai-web-search',
  evidenceId:'segment-a',sourceUrls:['https://example.com/a']
 },'lyrics',1000);
 const second=normalizeMusicCandidate({
  title:'Same Song',artist:'Same Artist',confidence:.86,provider:'openai-web-search',
  evidenceId:'segment-b',sourceUrls:['https://example.com/b']
 },'lyrics',25000);
 assert.equal(tracker.observeCandidate(first,1000).transition,'candidate');
 const result=tracker.observeCandidate(second,25000);
 assert.equal(result.transition,'confirmed');
 assert.equal(result.track.status,'confirmed');
 assert.deepEqual(result.track.sourceUrls,['https://example.com/b']);
});

test('V2B3 repeating the same lyric evidence cannot self-confirm a track',()=>{
 const tracker=new MusicIdentificationTracker();
 const candidate=normalizeMusicCandidate({
  title:'Same Song',artist:'Same Artist',confidence:.9,provider:'openai-web-search',
  evidenceId:'same-window'
 },'lyrics',1000);
 assert.equal(tracker.observeCandidate(candidate,1000).transition,'candidate');
 const repeat=tracker.observeCandidate(candidate,25000);
 assert.equal(repeat.transition,'candidate-repeat');
 assert.equal(repeat.track.status,'candidate');
});

test('V2B3 lyric lookup guard rate-limits and deduplicates outbound clues',()=>{
 const guard=new MusicLyricLookupGuard({cooldownMs:5000,dedupeMs:60000});
 assert.equal(guard.claim('hello darkness my old friend',10000).allow,true);
 assert.equal(guard.claim('different lyric words from song',12000).reason,'lookup-cooldown');
 assert.equal(guard.claim('hello darkness my old friend',16000).reason,'duplicate-lyric-clue');
 assert.equal(guard.claim('different lyric words from song',17000).allow,true);
 guard.reset();
 assert.equal(guard.claim('hello darkness my old friend',18000).allow,true);
});

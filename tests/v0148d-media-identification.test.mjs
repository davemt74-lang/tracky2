import test from 'node:test';
import assert from 'node:assert/strict';
import {
 MediaIdentificationTracker,MediaLookupGuard,MediaRecognitionQueue,
 mediaIdentificationMessage,mediaWindowEligibility,normalizeMediaCandidate,
 normalizeMediaDialogueClue,normalizeMediaVisualClue
} from '../src/media-identification-core.js';

test('V2C recorded-media windows stay bounded while later V2F additively supports radio',()=>{
 assert.equal(mediaWindowEligibility({mediaKind:'television',durationMs:5000}).accept,true);
 assert.equal(mediaWindowEligibility({mediaKind:'recorded-media',durationMs:5000}).accept,true);
 assert.equal(mediaWindowEligibility({mediaKind:'radio',durationMs:5000}).accept,true);
 assert.equal(mediaWindowEligibility({mediaKind:'video-game',durationMs:5000}).accept,false);
 assert.equal(mediaWindowEligibility({mediaKind:'television',durationMs:1000}).reason,'window-too-short');
});

test('V2C dialogue and visual clues stay bounded',()=>{
 const dialogue=normalizeMediaDialogueClue('I have a bad feeling about this and we need to leave right now before they find us');
 assert.equal(dialogue.usable,true);
 assert.ok(dialogue.wordCount<=28);
 assert.ok(dialogue.query.length<=190);
 const visual=normalizeMediaVisualClue('Netflix Stranger Things Chapter Four');
 assert.equal(visual.usable,true);
 assert.ok(visual.text.length<=220);
});

test('V2C two distinct recorded-dialogue windows can confirm the same strong candidate',()=>{
 const tracker=new MediaIdentificationTracker();
 const a=normalizeMediaCandidate({
  kind:'movie',title:'Example Movie',confidence:.84,provider:'web',evidenceId:'seg-a',
  sourceUrls:['https://example.com/a']
 },'dialogue',1000);
 const b=normalizeMediaCandidate({
  kind:'movie',title:'Example Movie',confidence:.86,provider:'web',evidenceId:'seg-b',
  sourceUrls:['https://example.com/b']
 },'dialogue',25000);
 assert.equal(tracker.observeCandidate(a,1000).transition,'candidate');
 const result=tracker.observeCandidate(b,25000);
 assert.equal(result.transition,'confirmed');
 assert.equal(result.media.status,'confirmed');
 assert.deepEqual(result.media.sourceUrls,['https://example.com/b']);
 assert.match(mediaIdentificationMessage(result),/Media identified/);
});

test('V2C repeating the same dialogue evidence cannot self-confirm',()=>{
 const tracker=new MediaIdentificationTracker();
 const c=normalizeMediaCandidate({
  kind:'movie',title:'Example Movie',confidence:.95,provider:'web',evidenceId:'same'
 },'dialogue',1000);
 assert.equal(tracker.observeCandidate(c,1000).transition,'candidate');
 assert.equal(tracker.observeCandidate(c,25000).transition,'candidate-repeat');
 assert.equal(tracker.snapshot().status,'candidate');
});

test('V2C independent dialogue and visual evidence corroborate the same media',()=>{
 const tracker=new MediaIdentificationTracker();
 const dialogue=normalizeMediaCandidate({
  kind:'episode',title:'Episode Title',series:'Example Series',season:2,episode:3,
  confidence:.78,provider:'web',evidenceId:'dialogue-1'
 },'dialogue',1000);
 const visual=normalizeMediaCandidate({
  kind:'episode',title:'Episode Title',series:'Example Series',season:2,episode:3,
  confidence:.8,provider:'web',evidenceId:'visual-1'
 },'visual',12000);
 tracker.observeCandidate(dialogue,1000);
 const result=tracker.observeCandidate(visual,12000);
 assert.equal(result.transition,'confirmed');
 assert.equal(result.media.series,'Example Series');
 assert.equal(result.media.season,2);
 assert.equal(result.media.episode,3);
});

test('V2C lookup guard deduplicates outbound dialogue and visual clues',()=>{
 const guard=new MediaLookupGuard({cooldownMs:5000,dedupeMs:60000});
 assert.equal(guard.claim('dialogue one two three four five',10000).allow,true);
 assert.equal(guard.claim('visual Example Movie title',12000).reason,'lookup-cooldown');
 assert.equal(guard.claim('dialogue one two three four five',16000).reason,'duplicate-clue');
 assert.equal(guard.claim('visual Example Movie title',17000).allow,true);
});

test('V2C recognition queue holds only memory-only work',()=>{
 const queue=new MediaRecognitionQueue({maxQueue:1,cooldownMs:3000});
 const accepted=queue.enqueue({
  mediaKind:'television',durationMs:5000,samples:new Float32Array([.1,.2])
 },10000);
 assert.equal(accepted.accepted,true);
 const job=queue.beginNext();
 assert.equal(job.samples.length,2);
 queue.complete(job);
 assert.equal(queue.snapshot().processing,false);
});

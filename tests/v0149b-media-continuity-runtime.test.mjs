import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9B runtime wires continuity tracker across background, identity, foreground and expiry',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/RoomMediaContinuityTracker/);
 assert.match(runtime,/const roomMediaContinuity=new RoomMediaContinuityTracker\(\)/);
 assert.match(runtime,/roomMediaContinuity\.observeBackground\(unified/);
 assert.match(runtime,/roomMediaContinuity\.observeBackground\(result,at\)/);
 assert.match(runtime,/roomMediaContinuity\.observeForeground\(behaviorPolicy/);
 assert.match(runtime,/roomMediaContinuity\.expire\(summary\.at\)/);
});

test('14.9B continuity evidence is metadata-only',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function logRoomMediaContinuity');
 const end=runtime.indexOf('function renderRoomAudioIntelligence',start);
 const block=runtime.slice(start,end);
 assert.match(block,/semantic:'room-media-continuity'/);
 assert.match(block,/participantId:null/);
 assert.match(block,/rawAudioStored:false/);
 assert.doesNotMatch(block,/samples|Float32Array|pcm|audioData/i);
});

test('14.9B control center exposes continuity status without adding a separate ROOM feed panel',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="roomMediaContinuityStatus"/);
 const count=(html.match(/id="roomMediaContinuityStatus"/g)||[]).length;
 assert.equal(count,1);
});

test('14.9B continuity core is packaged into PWA and deploy artifact',()=>{
 const pkg=read('package.json');
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 assert.match(pkg,/node --check src\/room-media-continuity-core\.js/);
 assert.match(sw,/room-media-continuity-core\.js/);
 assert.match(workflow,/room-media-continuity-core\.js/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.14.8I runtime uses one canonical ROOM audio coordinator',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/RoomAudioIntelligenceCoordinator/);
 assert.match(runtime,/const roomAudioIntelligence=new RoomAudioIntelligenceCoordinator\(\)/);
 assert.match(runtime,/roomAudioIntelligence\.observeEnvironmental\(transition/);
 assert.match(runtime,/roomAudioIntelligence\.observeIdentity\(identity/);
 assert.match(runtime,/roomAudioIntelligence\.expire\(summary\.at\)/);
 assert.match(runtime,/roomAudioIntelligence\.reset\('environmental-audio-disabled'\)/);
});

test('V0.14.8I confirmed music and recorded media identities attach to active sessions',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/result\?\.track\?\.status==='confirmed'/);
 assert.match(runtime,/\['confirmed','track-changed'\]\.includes\(result\.transition\)/);
 assert.match(runtime,/result\?\.media\?\.status==='confirmed'/);
 assert.match(runtime,/\['confirmed','content-changed'\]\.includes\(result\.transition\)/);
});

test('V0.14.8I unified feed stores metadata only and no raw PCM',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('function logRoomAudioIntelligence');
 const end=runtime.indexOf('function observeRoomAudioIdentity',start);
 const block=runtime.slice(start,end);
 assert.match(block,/semantic:'room-audio-intelligence'/);
 assert.match(block,/participantId:null/);
 assert.doesNotMatch(block,/samples|Float32Array|audioData|pcm/i);
});

test('V0.14.8I Control Center exposes unified status while detailed recognizers remain diagnostic',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="roomAudioIntelligenceStatus"/);
 assert.match(html,/Unified ROOM audio/);
 assert.match(html,/id="roomMusicIdStatus"/);
 assert.match(html,/id="roomMediaIdStatus"/);
});

test('V0.14.8I PWA and deploy workflow include the orchestration core',()=>{
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 const pkg=read('package.json');
 assert.match(sw,/room-audio-orchestration-core\.js/);
 assert.match(workflow,/room-audio-orchestration-core\.js/);
 assert.match(pkg,/node --check src\/room-audio-orchestration-core\.js/);
});

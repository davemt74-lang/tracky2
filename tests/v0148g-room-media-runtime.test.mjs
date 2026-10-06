import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');

test('V2F runtime logs audio-only owner-device context from environmental lifecycles',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/observeAudioMediaDeviceContext\(transition\)/);
 assert.match(runtime,/fuseRoomMediaEvidence\(\{/);
 assert.match(runtime,/scene:effectiveRoomScene\(\)/);
 assert.match(runtime,/semantic:'room-media-fusion'/);
 assert.match(runtime,/participantId:null/);
});

test('V2F visual media clues require mapped owner device metadata before web lookup',()=>{
 const runtime=read('vertical-motion.js');
 const start=runtime.indexOf('async function processMediaVisualClue');
 const end=runtime.indexOf('function resetMediaIdentification',start);
 const block=runtime.slice(start,end);
 assert.match(block,/normalizeMediaVisualObservation/);
 assert.match(block,/objectId:detail\.objectId/);
 assert.match(block,/mediaVisualLookupAllowed\(fusion\)/);
 assert.match(block,/audio-visual-owner-conflict/);
 assert.match(block,/searchMediaByClues\(\{/);
 assert.ok(block.indexOf('mediaVisualLookupAllowed(fusion)')<block.indexOf('searchMediaByClues({'));
 assert.doesNotMatch(block,/imageData|canvas\.toDataURL|video\.srcObject|rawFrame/);
});

test('V2F mapped object UI exposes role and explicit audio direction without inferring camera-left as mic-left',()=>{
 const html=read('vertical-motion.html');
 const ui=read('src/room-scene-ui.js');
 assert.match(html,/id="roomObjectRole"/);
 assert.match(html,/value="display">Display \/ TV \/ monitor/);
 assert.match(html,/id="roomObjectAudioDirection"/);
 assert.match(html,/Tracky2 does not infer that a camera-left device is also microphone-left/);
 assert.match(ui,/objectRole:\$\('roomObjectRole'\)/);
 assert.match(ui,/objectAudioDirection:\$\('roomObjectAudioDirection'\)/);
 assert.match(ui,/role:els\.objectRole\?\.value/);
 assert.match(ui,/audioDirection:els\.objectAudioDirection\?\.value/);
});

test('V2F room media fusion stores bounded metadata only',()=>{
 const core=read('src/room-media-fusion-core.js');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket|indexedDB|localStorage/);
 assert.doesNotMatch(core,/face|voice-profile|participant-store|biometric/i);
 assert.match(core,/participantId:null/);
});


test('V2F deploy and PWA include the fusion module and schema-5 room map',()=>{
 const workflow=read('.github/workflows/test.yml');
 const sw=read('sw.js');
 const pkg=read('package.json');
 assert.match(workflow,/src\/room-media-fusion-core\.js/);
 assert.match(workflow,/ROOM_SCENE_SCHEMA<5/);
 assert.match(sw,/\.\/src\/room-media-fusion-core\.js/);
 assert.match(pkg,/node --check src\/room-media-fusion-core\.js/);
});

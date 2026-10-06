import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');

test('V2C runtime runs after V2A and only on recorded television or recorded-media speech',()=>{
 const runtime=read('vertical-motion.js');
 const originAt=runtime.indexOf('const speechOrigin=resolveRoomSpeechOrigin');
 const queueAt=runtime.indexOf('queueMediaRecognitionWindow(segment',{fromIndex:originAt});
 assert.ok(originAt>0);
 assert.ok(runtime.indexOf('queueMediaRecognitionWindow(segment',{fromIndex:originAt})>-1);
 assert.match(runtime,/if\(!\['television','recorded-media'\]\.includes\(mediaKind\)\)return false/);
 assert.match(runtime,/if\(speechOrigin\?\.state!=='recorded'\)return false/);
 assert.match(runtime,/queueMediaRecognitionWindow\(segment,\{speechOrigin\}\)/);
});

test('V2C working dialogue never becomes participant Conversation or ROOM history',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/state\.voice\.transcriber\.transcribeDetailed\(job\.samples\)/);
 assert.doesNotMatch(runtime,/saveDialogueTurn\([^)]*mediaWorkingDialogueQuery/s);
 assert.doesNotMatch(runtime,/logRoomMessage\([^)]*mediaWorkingDialogueQuery/s);
 assert.doesNotMatch(runtime,/evidence:\{mediaIdentification:\{[^}]*dialogue/s);
});

test('V2C visual hook accepts text metadata only and never uploads a camera frame',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/tracky:media-visual-clue/);
 assert.match(runtime,/processMediaVisualClue/);
 assert.match(runtime,/visualClue:clue\.text/);
 assert.doesNotMatch(runtime,/searchMediaByClues\(\{[^}]*image/s);
 assert.doesNotMatch(runtime,/searchMediaByClues\(\{[^}]*frame/s);
 assert.doesNotMatch(runtime,/searchMediaByClues\(\{[^}]*canvas/s);
});

test('V2C UI keeps remote web lookup opt-in while local recorded-media analysis defaults on',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="roomIdentifyMedia" checked/);
 assert.match(html,/id="roomIdentifyMediaWeb"/);
 assert.doesNotMatch(html,/id="roomIdentifyMediaWeb" checked/);
 assert.match(html,/raw room audio and camera frames are never uploaded/);
 assert.match(html,/Working dialogue text is never added to participant Conversation or ROOM history/);
});

test('V2C media stop and microphone stop invalidate candidate state',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/transition\.category==='media-playback'&&transition\.type==='stop'/);
 assert.match(runtime,/mediaIdentificationTracker\.clearConfirmed/);
 assert.match(runtime,/resetMediaIdentification\('Room microphone stopped'\)/);
 assert.match(runtime,/resetMediaIdentification\('Environmental audio disabled'\)/);
});

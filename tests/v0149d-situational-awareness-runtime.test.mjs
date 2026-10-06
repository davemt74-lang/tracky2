import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('14.9D runtime gates media engagement through adaptive situational interestingness',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/RoomSituationalAwarenessTracker/);
 assert.match(runtime,/roomSituationalAwareness\.evaluate\(situationalEvent/);
 assert.match(runtime,/if\(!situationalDecision\.interesting\)return candidate/);
 assert.match(runtime,/situationalPromptContext/);
});

test('14.9D user response feedback and ignored timeout both feed adaptive learning',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/situationalFeedbackFromReply\(turn\.transcript/);
 assert.match(runtime,/outcome:'ignored'/);
 assert.match(runtime,/pendingSituationalEngagement/);
 assert.match(runtime,/noteSituationalDialogueFeedback\(savedTurn/);
});

test('14.9D persistence follows ROOM history opt-in and clear path',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/if\(!saveRoomHistory\)return false/);
 assert.match(runtime,/tracky2-room-situational-awareness-v1/);
 assert.match(runtime,/loadSituationalAwareness\(\)/);
 assert.match(runtime,/clearSituationalAwareness\(\)/);
});

test('14.9D selected ROOM events feed bounded awareness but raw conversation text does not',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/music-identification/);
 assert.match(runtime,/media-identification/);
 assert.match(runtime,/environmental-alert/);
 assert.match(runtime,/participant-observed/);
 const start=runtime.indexOf('function situationalEventFromRoomEvent');
 const end=runtime.indexOf('function situationalMediaEvent',start);
 const block=runtime.slice(start,end);
 assert.doesNotMatch(block,/transcript|samples|pcm|audioData/i);
});

test('14.9D UI exposes learning counts and last interest score',()=>{
 const html=read('vertical-motion.html');
 const runtime=read('vertical-motion.js');
 assert.match(html,/id="roomSituationalAwarenessStatus"/);
 assert.match(runtime,/feedback signals/);
 assert.match(runtime,/last interest/);
});

test('14.9D persisted prompt context stays bounded and hides internal scoring mechanics from speech',()=>{
 const core=read('src/room-situational-awareness-core.js');
 const runtime=read('vertical-motion.js');
 assert.match(core,/relatedContext/);
 assert.match(core,/limit=6/);
 assert.match(runtime,/Do not reveal scoring, history mechanics, or internal observations/);
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|WebSocket/);
});

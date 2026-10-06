import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('V2B ROOM runtime queues music only after speech-origin resolution and keeps lyrics outside Conversation',()=>{
 const runtime=read('vertical-motion.js');
 const originAt=runtime.indexOf('const speechOrigin=resolveRoomSpeechOrigin');
 const queueAt=runtime.indexOf('queueMusicRecognitionWindow(segment',originAt);
 const transcriptAt=runtime.indexOf('ensureTranscriptionEngine()',originAt);
 assert.ok(originAt>0);
 assert.ok(queueAt>originAt,'music sidecar must be decided after V2A speech origin');
 assert.ok(transcriptAt>queueAt,'normal Conversation transcription remains later in the live-speech path');
 assert.match(runtime,/const lyricEligible=Boolean\(primaryMusic&&speechOrigin\?\.state!=='live'\)/);
 assert.match(runtime,/state\.voice\.transcriber\.transcribeDetailed\(job\.samples\)/);
 assert.doesNotMatch(runtime,/saveDialogueTurn\([^)]*musicWorkingLyricQuery/s);
 assert.doesNotMatch(runtime,/logRoomMessage\([^)]*musicWorkingLyricQuery/s);
});

test('V2B stale music jobs are invalidated on reset and owner disable',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/let musicRecognitionGeneration=0/);
 assert.match(runtime,/const current=\(\)=>generation===musicRecognitionGeneration&&musicIdentificationEnabled/);
 assert.match(runtime,/if\(!current\(\)\)\{outcome='cancelled';return;\}/);
 assert.match(runtime,/function resetMusicIdentification/);
 assert.match(runtime,/musicRecognitionGeneration\+\+/);
 assert.match(runtime,/musicRecognitionQueue\.clear\(\)/);
});

test('V2B owner UI states the memory-only lyric boundary and provider status',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="roomIdentifyMusic" checked/);
 assert.match(html,/id="roomMusicIdStatus"/);
 assert.match(html,/id="roomMusicIdResult"/);
 assert.match(html,/Working lyric text stays memory-only/);
 assert.match(html,/Exact lyric\/web candidate lookup is the next V2B stage/);
});

test('V2B music stop closes exact identity state without persisting lyrics',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/transition\.category==='music'&&transition\.type==='stop'/);
 assert.match(runtime,/musicIdentificationTracker\.clearConfirmed\(transition\.at\)/);
 assert.match(runtime,/musicWorkingLyricQuery=''/);
 assert.match(runtime,/semantic:'music-identification'/);
 assert.doesNotMatch(runtime,/musicIdentification:\{[^}]*lyric/s);
});

test('V2B setting defaults on, persists owner preference and never grants new sensor access',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/tracky2-room-music-id/);
 assert.match(runtime,/musicIdToggle\.checked=savedMusicId!=='no'/);
 assert.match(runtime,/musicRecognitionQueue\.setEnabled\(musicIdentificationEnabled\)/);
 assert.doesNotMatch(runtime,/musicIdToggle[\s\S]{0,1000}getUserMedia/);
});

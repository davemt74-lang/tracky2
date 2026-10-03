import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RoomAmbientAudit,roomAudioAuditMessage,ROOM_AUDIO_AUDIT_INTERVAL_MS} from '../src/room-audio-audit.js';

test('ROOM captures timestamped shared acoustic measurements, not participant meters',()=>{
 const audit=new RoomAmbientAudit();
 assert.equal(audit.update({db:-62,noiseFloorDb:-70,speaking:false},1000),null);
 assert.equal(audit.update({db:-27,noiseFloorDb:-64,speaking:true},9000),null);
 const summary=audit.update({db:-57,noiseFloorDb:-65,speaking:false},1000+ROOM_AUDIO_AUDIT_INTERVAL_MS);
 assert.equal(summary.frames,3);
 assert.equal(summary.speechFrames,1);
 assert.equal(summary.quietFrames,2);
 assert.equal(summary.from,1000);
 assert.equal(summary.at,16000);
 assert.equal(summary.durationMs,15000);
 assert.equal(summary.peakDb,-27);
 assert.equal(summary.noiseFloorDb,-66.3);
 assert.match(roomAudioAuditMessage(summary),/Shared room audio/);
 assert.match(roomAudioAuditMessage(summary),/33% of sampled frames/);
 assert.equal(audit.flush(),null);
});
test('suppressed, invalid and paused samples never imply silence or fabricate background audio',()=>{
 const audit=new RoomAmbientAudit({intervalMs:3000});
 assert.equal(audit.update({db:-15,noiseFloorDb:-40,speaking:true,suppressed:true},0),null);
 assert.equal(audit.update({db:NaN,noiseFloorDb:-55,speaking:false},2000),null);
 assert.equal(audit.flush(3000),null);
 audit.update({db:-55,noiseFloorDb:-62,speaking:false},4000);
 const summary=audit.update({db:-48,noiseFloorDb:-62,speaking:false},7100);
 assert.equal(summary.frames,2);
 assert.equal(summary.speechFrames,0);
 assert.equal(summary.quietFrames,2);
 assert.equal(summary.at,7100);
 assert.equal(audit.update({db:-51,noiseFloorDb:-61,speaking:false},8000),null);
 audit.reset();assert.equal(audit.flush(10000),null);
});
test('AGENT room audit stores only bounded metadata via existing opt-in ROOM ledger',()=>{
 const source=fs.readFileSync('vertical-motion.js','utf8');
 const module=fs.readFileSync('src/room-audio-audit.js','utf8');
 assert.match(source,/roomAmbientAudit\.update\(\{\.\.\.level,/);
 assert.match(source,/logRoomMessage\('audio',roomAudioAuditMessage\(summary\),'shared-room-mic'/);
 assert.match(source,/if\(saveRoomHistory\)void saveRoomObservation/);
 assert.match(source,/state.voice.currentSpeakerId=null/);
 assert.match(source,/level.suppressed\|\|state.voice.audio\?\.suppressed/);
 assert.doesNotMatch(module,/getUserMedia|MediaRecorder|transcribe|\.samples\b|\.pcm\b/);
});

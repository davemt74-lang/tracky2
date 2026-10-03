import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const h=fs.readFileSync('vertical-motion.html','utf8'),game=fs.readFileSync('games.html','utf8'),css=fs.readFileSync('agent-room.css','utf8');
test('AGENT is selectable in lobby and runtime without adding another camera engine',()=>{
 assert.match(game,/value="agent"/);assert.match(h,/value="agent"/);
 assert.equal((h.match(/id="cameraVideo"/g)||[]).length,1);
 for(const id of ['agentRoomStatusToggle','agentRoomStatus','agentConversationPanel',
  'participantVoiceDialog','agentVoiceSelect','agentKeepHistory','agentCameraOverlay'])
  assert.ok(h.includes('id="'+id+'"'),id);
});
test('agent canvas hides zones and stats but exposes video and independently collapsible room status',()=>{
 assert.match(css,/agent-mode #multiplayerStage/);
 assert.match(css,/agent-mode #cameraVideo/);
 assert.match(css,/agentRoomStatus\[hidden\]/);
 assert.match(h,/src\/agent-conversation/);
});
test('voice modal reuses canonical voice profile controls',()=>{
 const voice=fs.readFileSync('voice-capture.html','utf8');
 for(const id of ['recordVoiceSample','stopVoiceSample','voiceEnrollmentStatus','voiceWaveBars'])
  assert.ok(voice.includes('id="'+id+'"'));
 assert.match(voice,/import\('\.\/participant-voice\.js'\)/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {agentGame} from '../src/games/agent.js';
import {createGamePlatform} from '../src/game-platform.js';
test('AGENT registers as an independent game and reuses existing host media runtime',()=>{
 const games=createGamePlatform();games.register(agentGame);
 const session=games.createSession('agent');
 assert.equal(session.requiresBoard,false);
 assert.equal(session.camera,'host-shared');
 assert.equal(session.roomAudio,'on-when-authorized');
});
test('AGENT layout includes a live camera overlay, independent accordions, Voice modal and history',()=>{
 const h=fs.readFileSync('vertical-motion.html','utf8');
 for(const id of ['agentCameraBoxes','agentCameraControls','agentRoomMapAccordion',
 'agentLiveStatusAccordion','agentVoiceModal','agentVoiceSelect','agentConversationThread']){
  assert.equal(h.split('id="'+id+'"').length,2,id);
 }
 assert.ok(h.includes('href="./agent-mode.css"'));
 const game=fs.readFileSync('games.html','utf8');
 assert.ok(game.includes('value="agent"'));
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 assert.ok(controller.includes("state.mode==='agent'"));
 assert.ok(controller.includes('agentRuntime?.greet'));
 assert.ok(controller.includes('agentRuntime?.onDialogue'));
});
test('browser sound suppression and voice modal use existing speaker and participant record modules',()=>{
 const code=fs.readFileSync('agent-mode.js','utf8');
 assert.ok(code.includes("import('./participant-voice.js')"));
 assert.ok(code.includes("window.dispatchEvent(new CustomEvent('tracky:participant-loaded'"));
 assert.ok(code.includes('suppressMic(true)'));
 assert.ok(code.includes('await stopAudio()'));
});

test('AGENT microphone cannot re-enable itself during a current spoken response',()=>{
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.ok(controller.includes('agentSpeechActive'));
 assert.ok(controller.includes('agentSpeechActive) state.voice.audio.setSuppressed(true)'));
 assert.ok(agent.includes('lastFocusedElement'));
 assert.ok(agent.includes("event.key!=='Tab'"));
 assert.ok(agent.includes('ui.box.replaceChildren()'));
});

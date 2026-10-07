import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {agentGame} from '../src/games/agent.js';

test('AGENT is the canonical Tracky2 content runtime',()=>{
 const session=agentGame.createSession();
 assert.equal(session.requiresBoard,false);
 assert.equal(session.camera,'host-shared');
 assert.equal(session.roomAudio,'on-when-authorized');

 const index=fs.readFileSync('index.html','utf8');
 const launch=fs.readFileSync('launch.js','utf8');
 const redirect=fs.readFileSync('games.html','utf8');
 assert.match(index,/href=".\/vertical-motion\.html\?mode=agent"/);
 assert.match(launch,/window\.location\.assign\('\.\/vertical-motion\.html\?mode=agent'\)/);
 assert.match(redirect,/location\.replace\('\.\/vertical-motion\.html\?mode=agent'\)/);
});

test('AGENT layout includes camera, room, voice and conversation systems without gameplay UI',()=>{
 const h=fs.readFileSync('vertical-motion.html','utf8');
 for(const id of ['agentCameraBoxes','agentCameraControls','agentRoomMapAccordion',
  'agentLiveStatusAccordion','agentVoiceModal','agentVoiceSelect','agentConversationThread']){
   assert.equal(h.split('id="'+id+'"').length,2,id);
 }
 assert.ok(h.includes('href="./agent-mode.css"'));
 for(const retired of ['startGame','endGame','pointGoal','sharedBoard','laneCursor','gameScore','gameReps'])
   assert.equal(h.includes('id="'+retired+'"'),false,retired+' must be removed');

 const controller=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(controller,/mode: 'agent'/);
 assert.doesNotMatch(controller,/createGameSession|createMultiplayerMatch|randomFollowPatternGame|reactionChallengeGame/);
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

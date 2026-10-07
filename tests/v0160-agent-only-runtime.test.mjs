import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const exists=p=>fs.existsSync(new URL('../'+p,import.meta.url));

test('V0.16.0 splash opens AGENT directly',()=>{
 const index=read('index.html');
 const launch=read('launch.js');
 assert.match(index,/id="launchAgent"/);
 assert.match(index,/href=".\/vertical-motion\.html\?mode=agent"/);
 assert.doesNotMatch(index,/Enter game lobby|launchGames/);
 assert.match(launch,/window\.location\.assign\('\.\/vertical-motion\.html\?mode=agent'\)/);
 assert.doesNotMatch(launch,/games\.html/);
});

test('V0.16.0 legacy Games URL is compatibility redirect only',()=>{
 const games=read('games.html');
 assert.match(games,/location\.replace\('\.\/vertical-motion\.html\?mode=agent'\)/);
 assert.doesNotMatch(games,/lobbyGame|lobbyStart|patternLobbySettings|reaction-challenge|random-follow-pattern/);
 assert.equal(exists('games.js'),false);
});

test('V0.16.0 AGENT page contains no gameplay board, score or setup controls',()=>{
 const html=read('vertical-motion.html');
 for(const id of [
  'gameMode','startGame','endGame','pointGoal','sharedBoard','boardCursor',
  'movementLane','laneCursor','gameScore','gameReps','multiplayerSettings',
  'patternSetup','matchHistoryPanel','motionTrace'
 ]) assert.equal(html.includes('id="'+id+'"'),false,id+' must remain retired');
 assert.match(html,/<strong id="activeGameTitle">AGENT<\/strong>/);
 assert.match(html,/id="agentCameraControls"/);
 assert.match(html,/id="agentConversationThread"/);
 assert.match(html,/id="roomObservationsPanel"/);
});

test('V0.16.0 runtime is fixed to AGENT and imports no retired gameplay engine',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/mode: 'agent'/);
 assert.match(runtime,/state\.mode='agent'/);
 for(const retired of [
  'createGameSession','createMultiplayerMatch','createGamePlatform',
  'randomFollowPatternGame','reactionChallengeGame','consumeLobbyTicket',
  'state.gameplay','state.multiplayer','state.pattern','ui.gameMode',
  'ui.startGame','ui.endGame','ui.pointGoal'
 ]) assert.equal(runtime.includes(retired),false,retired+' must remain retired');
 assert.match(runtime,/agentRuntime\?\.onDialogue/);
 assert.match(runtime,/RoomAudioCapture/);
});

test('V0.16.0 removes retired gameplay source modules while retaining AGENT descriptor',()=>{
 for(const path of [
  'src/movement-core.js','src/gameplay-core.js','src/game-platform.js','src/shared-board.js',
  'src/game-lobby.js','src/game-session.js','src/game-input.js','src/game-presenter.js',
  'src/multiplayer-match.js','src/match-history.js','src/games/random-follow-pattern.js',
  'src/games/pattern-setup.js','src/games/reaction-challenge.js'
 ]) assert.equal(exists(path),false,path+' must remain removed');
 assert.equal(exists('src/games/agent.js'),true);
 for(const path of ['src/color-controllers.js','src/controller-stability.js','src/player-presence.js'])
  assert.equal(exists(path),false,path+' must remain removed');
});

test('V0.16.0 PWA and package publish only the AGENT runtime',()=>{
 const pkg=JSON.parse(read('package.json'));
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 assert.equal(pkg.version,'0.16.0');
 assert.match(sw,/tracky2-static-v0\.16\.0-agent-only-r1/);
 assert.match(sw,/caches\.match\('\.\/vertical-motion\.html'\)/);
 for(const retired of [
  'games.js','game-stage.css','src/game-lobby.js','src/game-session.js',
  'src/multiplayer-match.js','src/games/random-follow-pattern.js',
  'src/games/reaction-challenge.js'
 ]) {
  assert.equal(sw.includes(retired),false,'service worker: '+retired);
  assert.equal(workflow.includes(retired),false,'deploy workflow: '+retired);
 }
 assert.match(workflow,/tracky2-v0\.16\.0-deploy\.zip/);
 assert.match(workflow,/src\/games\/agent\.js/);
});

test('V0.16.0 keeps Meeting as an AGENT sub-mode',()=>{
 const runtime=read('vertical-motion.js');
 const html=read('vertical-motion.html');
 assert.match(runtime,/searchParams\.get\('mode'\)==='meeting'/);
 assert.match(html,/id="roomMeetingTab"/);
 assert.match(html,/id="roomMeetingPanel"/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const exists=p=>fs.existsSync(new URL('../'+p,import.meta.url));

test('AGENT-only splash and compatibility URL still open the canonical runtime',()=>{
 const index=read('index.html');
 const launch=read('launch.js');
 const games=read('games.html');
 assert.match(index,/id="launchAgent"/);
 assert.match(index,/vertical-motion\.html\?mode=agent/);
 assert.match(launch,/vertical-motion\.html\?mode=agent/);
 assert.match(games,/vertical-motion\.html\?mode=agent/);
 assert.equal(exists('games.js'),false);
});

test('legacy gameplay remains fully retired',()=>{
 const html=read('vertical-motion.html');
 const runtime=read('vertical-motion.js');
 for(const id of [
  'gameMode','startGame','endGame','pointGoal','sharedBoard','boardCursor',
  'movementLane','laneCursor','gameScore','gameReps','multiplayerSettings',
  'patternSetup','matchHistoryPanel','motionTrace'
 ]) assert.equal(html.includes('id="'+id+'"'),false,id+' must remain retired');
 for(const retired of [
  'createGameSession','createMultiplayerMatch','createGamePlatform',
  'randomFollowPatternGame','reactionChallengeGame','consumeLobbyTicket',
  'state.gameplay','state.multiplayer','state.pattern','ui.gameMode',
  'ui.startGame','ui.endGame','ui.pointGoal'
 ]) assert.equal(runtime.includes(retired),false,retired+' must remain retired');
});

test('retired gameplay source modules remain absent while AGENT descriptor remains',()=>{
 for(const path of [
  'src/movement-core.js','src/gameplay-core.js','src/game-platform.js','src/shared-board.js',
  'src/game-lobby.js','src/game-session.js','src/game-input.js','src/game-presenter.js',
  'src/multiplayer-match.js','src/match-history.js','src/games/random-follow-pattern.js',
  'src/games/pattern-setup.js','src/games/reaction-challenge.js',
  'src/color-controllers.js','src/controller-stability.js','src/player-presence.js'
 ]) assert.equal(exists(path),false,path+' must remain removed');
 assert.equal(exists('src/games/agent.js'),true);
});

test('V0.17.4 packages the refined AGENT runtime',()=>{
 const pkg=JSON.parse(read('package.json'));
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 assert.equal(pkg.version,'0.17.4');
 assert.match(sw,/tracky2-static-v0\.17\.4-flat-deploy-r1/);
 assert.match(workflow,/tracky2-v0\.17\.4-deploy\.zip/);
 assert.match(workflow,/src\/games\/agent\.js/);
});

test('Meeting remains functional but is no longer an AGENT mode or primary tab',()=>{
 const runtime=read('vertical-motion.js');
 const html=read('vertical-motion.html');
 const admin=read('server/admin.php');
 assert.doesNotMatch(runtime,/requestedMode==='meeting'|classList\.toggle\('meeting-mode'/);
 assert.doesNotMatch(html,/id="roomMeetingTab"|id="roomMeetingPanel"/);
 assert.match(html,/id="controlCenterMeetingTab"/);
 assert.match(html,/id="controlCenterMeetingPanel"/);
 assert.match(admin,/vertical-motion\.html\?mode=agent&amp;admin=meeting/);
 assert.match(runtime,/createMeetingUi\(/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('vertical-motion.html','utf8');
const code=fs.readFileSync('vertical-motion.js','utf8');

test('single left overlay holds AGENT conversation and participant activity without gameplay HUD',()=>{
 for(const id of ['roomLeftPanel','roomDialogueTab','playerActivityTab','roomDialoguePanel',
  'playerActivityPanel','playerActivityTimeline','roomEvents','dialogueTurns'])
  assert.equal(html.split('id="'+id+'"').length,2,id);
 for(const retired of ['gamePlayerHud','classicPatternScorecards','patternRosterScoreboard',
  'gameScore','gameReps','startGame','endGame'])
  assert.equal(html.includes('id="'+retired+'"'),false,retired+' must remain retired');
 assert.match(html,/role="tablist"/);
 const left=html.slice(html.indexOf('id="roomLeftPanel"'),html.indexOf('</aside>',html.indexOf('id="roomLeftPanel"')));
 assert.ok(left.includes('id="roomDialoguePanel"')&&left.includes('id="playerActivityPanel"'));
 const tabController=fs.readFileSync('room-tabs-controller.js','utf8');
 assert.ok(tabController.includes("button.addEventListener('click'"));
 assert.ok(html.includes('src="./room-tabs-controller.js"'));
});

test('participant timeline records confirmed presence without gameplay evidence',()=>{
 assert.ok(code.includes('visibleRoomParticipants(now)'));
 assert.ok(code.includes('recordObservedPresence(now)'));
 assert.doesNotMatch(code,/logPlayerActivity\([^\n]+,'(?:zone|rep|target|hit|point|round|complete)'/);
 const activity=fs.readFileSync('src/player-activity.js','utf8');
 assert.match(activity,/present.*arrived.*departed.*matched/s);
 assert.doesNotMatch(activity,/assigned-player/);
});

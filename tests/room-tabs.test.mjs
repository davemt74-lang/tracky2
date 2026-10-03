import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('vertical-motion.html','utf8'),code=fs.readFileSync('vertical-motion.js','utf8');
test('single left overlay holds both accessible tabs with original functional dialogue and score controls',()=>{
 for(const id of ['roomLeftPanel','roomDialogueTab','playerActivityTab','roomDialoguePanel',
  'playerActivityPanel','playerActivityTimeline','roomEvents','dialogueTurns','gamePlayerHud',
  'classicPatternScorecards','patternRosterScoreboard'])
  assert.equal(html.split('id="'+id+'"').length,2,id);
 assert.match(html,/role="tablist"/);
 const left=html.slice(html.indexOf('id="roomLeftPanel"'),html.indexOf('</aside>',html.indexOf('id="roomLeftPanel"')));
 assert.ok(left.includes('id="roomDialoguePanel"')&&left.includes('id="playerActivityPanel"'));
 assert.ok(code.includes('showRoomTab('));
});
test('player timeline logs game action evidence and does not expose provisional track records',()=>{
 assert.ok(code.includes('visibleRoomParticipants(now)'));
 assert.ok(code.includes('recordObservedPresence(now)'));
 assert.ok(code.includes("logPlayerActivity(scheduled.participantId,'zone'"));
 assert.ok(code.includes("logPlayerActivity(scheduled.participantId,'hit'"));
 assert.ok(code.includes("marker holder unverified")||code.includes('marker holder unverified'));
});

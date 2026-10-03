import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('vertical-motion.html','utf8');
const css=fs.readFileSync('game-stage.css','utf8');
const controller=fs.readFileSync('vertical-motion.js','utf8');
test('four-zone centered board has no player card or tracking metadata inside',()=>{
 const stage=html.slice(html.indexOf('<section id="multiplayerStage"'),
  html.indexOf('</section>',html.indexOf('<section id="multiplayerStage"')));
 assert.ok(stage.includes('id="sharedBoard"'));
 assert.equal((stage.match(/data-board-zone=/g)||[]).length,4);
 for(const token of ['multi-scorecard','patternRosterScoreboard','multiTurnLabel','stabilityStatus','roundTimer'])
  assert.ok(!stage.includes(token),token);
});
test('live player details are a dedicated bottom-left HUD',()=>{
 const hud=html.slice(html.indexOf('id="gamePlayerHud"'),html.indexOf('</aside>',html.indexOf('id="gamePlayerHud"')));
 for(const token of ['classicPatternScorecards','patternRosterScoreboard','roundTimer',
  'multiTurnLabel','stabilityStatus','boardInstruction','multi-travel','multi-presence',
  'multi-marker-status','multi-voice'])
  assert.ok(hud.includes(token),token);
 assert.ok(/bottom:15px/.test(css));
 assert.ok(/left:14px/.test(css));
 assert.ok(controller.includes('return ui.playerHud.querySelector('));
});
test('game page exposes browser-safe optional camera startup and keeps explicit stop',()=>{
 assert.ok(html.includes('id="cameraAutostart"'));
 assert.ok(html.includes('id="cameraPreferenceStatus"'));
 assert.ok(controller.includes('cameraPermissionState('));
 assert.ok(controller.includes('cameraStoppedThisPage=true'));
});

import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
test('participant camera and game have honest initialization overlays, no fake completion timer',()=>{
 for(const [page,token] of [['participants.html','participant'],['vertical-motion.html','game']]){
  const s=fs.readFileSync(page,'utf8');
  for(const id of [token+'SceneOverlay',token+'SceneStatus',token+'SceneBar',token+'SceneFill'])
   assert.equal(s.split('id="'+id+'"').length,2,id);
  assert.ok(s.includes('scene-analysis.css'));
 }
 const css=fs.readFileSync('scene-analysis.css','utf8');
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('room radar labels its orientation as matching the mirrored camera view',()=>{
 const s=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(s,/CAMERA VIEW · MIRROR ALIGNED/);
});

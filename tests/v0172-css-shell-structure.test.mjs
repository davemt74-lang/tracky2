import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('styles.css','utf8');

function braceDepthBefore(source, marker){
 const prefix=source.slice(0,source.indexOf(marker));
 let depth=0;
 for(const char of prefix){
  if(char==='{')depth+=1;
  else if(char==='}')depth-=1;
  assert.ok(depth>=0,'CSS closed more blocks than it opened before '+marker);
 }
 return depth;
}

test('desktop room identity HUD CSS is not trapped inside a mobile media query',()=>{
 assert.equal(braceDepthBefore(css,'/* V0.4 — futuristic room identity system */'),0);
 assert.match(css,/\.room-identity-hud\{position:absolute;right:18px;top:18px;/);
});

test('680px and 600px responsive rules are separate balanced media blocks',()=>{
 assert.match(css,/@media\(max-width:680px\)\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*@media\(max-width:600px\)/s);
});

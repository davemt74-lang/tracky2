import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('orb can launch directly and camera/orb controls do not depend on recognition startup', async()=>{
 const code=fs.readFileSync('agent-presence.js','utf8');
 assert.match(code,/agentEnabled=true/);
 assert.doesNotMatch(code,/get\('mode'\).*===.*agent|const requested=/);
 assert.match(code,/render\(\);\s*$/);
 const ids=['agentViewChooser','agentCameraView','agentOrbView','agentOrbStage','agentVoiceOrb','agentOrbCaption'];
 const el=new Map(ids.map(id=>[id,{id,hidden:true,dataset:{},attributes:{},events:{},
 setAttribute(name,value){this.attributes[name]=value},
 addEventListener(name,fn){this.events[name]=fn}
 }]));
 const classes=new Map(),events={},documentEvents={};
 globalThis.window={location:{search:'?mode=agent&view=orb'},addEventListener:(name,fn)=>events[name]=fn};
 globalThis.document={getElementById:id=>el.get(id),addEventListener:(name,fn)=>documentEvents[name]=fn,body:{classList:{toggle:(name,on)=>classes.set(name,on),add:(name)=>classes.set(name,true)}}};
 try{
  await import('../agent-presence.js?immediate-orb=1');
  assert.equal(el.get('agentViewChooser').hidden,false,'view switch visible before agent-ready');
  assert.equal(el.get('agentOrbStage').hidden,false,'orb directly opened before agent-ready');
  assert.equal(classes.get('agent-mode'),true);
  assert.equal(classes.get('agent-orb-view'),true);
  el.get('agentCameraView').events.click();
  assert.equal(el.get('agentOrbStage').hidden,true);
  el.get('agentOrbView').events.click();
  assert.equal(el.get('agentOrbStage').hidden,false);
  // Triple-Z toggle works in either direction and never intercepts typed text.
  const z=target=>({key:'z',repeat:false,target:target||{tagName:'BODY'}});
  documentEvents.keydown(z({tagName:'INPUT'}));
  documentEvents.keydown(z());documentEvents.keydown(z());documentEvents.keydown(z());
  assert.equal(el.get('agentOrbStage').hidden,true,'ZZZ toggles orb to camera');
  documentEvents.keydown(z());documentEvents.keydown(z());documentEvents.keydown(z());
  assert.equal(el.get('agentOrbStage').hidden,false,'ZZZ toggles back to orb');
  events['tracky:agent-speech-state']({detail:{speaking:true}});
  assert.equal(el.get('agentVoiceOrb').dataset.speech,'speaking');
 }finally{delete globalThis.window;delete globalThis.document;}
});
test('retired Games URL redirects to AGENT while direct Orb URL remains supported',()=>{
 const html=fs.readFileSync('games.html','utf8');
 assert.match(html,/vertical-motion\.html\?mode=agent/);
 assert.equal(fs.existsSync('games.js'),false);
 const presence=fs.readFileSync('agent-presence.js','utf8');
 assert.match(presence,/const initialView=new URLSearchParams\(window\.location\.search\)\.get\('view'\)/);
});

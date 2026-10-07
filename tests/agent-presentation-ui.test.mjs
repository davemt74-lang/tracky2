import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';

test('fullscreen AGENT keeps exactly four primary sidebar tabs; transcripts never move to settings',()=>{
 const h=fs.readFileSync('vertical-motion.html','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const css=fs.readFileSync('agent-presence.css','utf8');
 for(const id of ['roomDialoguePanel','playerActivityPanel','roomAgentPanel','roomAgentTab',
  'roomTab','roomObservationsPanel','agentConversationThread','agentViewChooser','agentOrbStage','agentVoiceOrb']){
  assert.equal(h.split('id="'+id+'"').length,2,id);
 }
 assert.equal(h.includes('id="roomMeetingTab"'),false);
 assert.equal(h.includes('id="controlCenterMeetingTab"'),true);
 const d=h.indexOf('id="roomDialoguePanel"'),p=h.indexOf('id="playerActivityPanel"');
 const a=h.indexOf('id="roomAgentPanel"');
 const thread=h.indexOf('id="agentConversationThread"');
 const settings=h.indexOf('id="agentLeftControls"');
 assert.ok(d<thread&&thread<p&&p<a&&a<settings);
 assert.ok(!agent.includes("transcriptMount.append(ui.thread)"));
 assert.ok(css.includes('.game-topbar'));
 assert.ok(css.includes('.live-strip{display:none!important}'));
 assert.ok(css.includes('agent-orb-view #cameraVideo'));
});

test('orb glows only from real text-to-speech start/end, without touching media APIs',()=>{
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const stage=fs.readFileSync('agent-presence.js','utf8');
 assert.match(agent,/utterance.addEventListener\('start',\(\)=>notifySpeech\(true\)/);
 assert.match(agent,/notifySpeech\(false\)/);
 assert.match(stage,/tracky:agent-speech-state/);
 assert.doesNotMatch(stage,/getUserMedia|stopCamera\(/);
});

test('clicking third tab opens AGENT without moving conversation or requiring camera',async()=>{
 const ids=['roomDialogueTab','playerActivityTab','roomAgentTab','roomTab','roomDialoguePanel',
   'playerActivityPanel','roomAgentPanel','roomObservationsPanel'];
 const entries=new Map(ids.map(id=>[id,{id,hidden:false,
  style:{},tabIndex:0,attributes:{},handlers:{},setAttribute(k,v){this.attributes[k]=v;},
  addEventListener(k,fn){this.handlers[k]=fn;},focus(){this.focused=true;}}]));
 globalThis.document={getElementById:id=>entries.get(id)};
 globalThis.window={location:{search:''},dispatchEvent:()=>{}};
 globalThis.CustomEvent=class CustomEvent{constructor(type){this.type=type;}};
 try{
  await import('../room-tabs-controller.js?agent-tab-test=1');
  assert.equal(entries.get('roomDialoguePanel').hidden,false);
  assert.equal(entries.get('roomAgentPanel').hidden,true);
  entries.get('roomAgentTab').handlers.click();
  assert.equal(entries.get('roomAgentPanel').hidden,false);
  assert.equal(entries.get('roomDialoguePanel').hidden,true);
 }finally{
  delete globalThis.CustomEvent;delete globalThis.window;delete globalThis.document;
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState} from '../src/participant-audio-meter.js';

test('AGENT room microphone meter is silent when offline or TTS suppresses capture',()=>{
 assert.deepEqual(roomMeterState(),{mode:'off',level:0,text:'MIC OFF',recentMatch:false});
 const suppressed=roomMeterState({active:true,suppressed:true,db:-8,vad:true});
 assert.equal(suppressed.level,0);
 assert.equal(suppressed.mode,'suppressed');
 assert.match(suppressed.text,/PAUSED/);
});
test('meter follows real room dB and VAD, without identifying speech from camera proximity',()=>{
 const quiet=roomMeterState({active:true,db:-61,vad:false});
 const speaking=roomMeterState({active:true,db:-20,vad:true});
 assert.equal(quiet.mode,'quiet');
 assert.equal(speaking.mode,'speech');
 assert.ok(speaking.level>quiet.level);
 assert.match(speaking.text,/UNVERIFIED/);
 assert.equal(speaking.recentMatch,false);
});
test('a previous voice match is not proof of the current live speaker',()=>{
 const track={participantId:'one',lastVoiceAt:1000,voiceMatchConfidence:.86};
 assert.equal(roomMeterState({active:true,db:-18,vad:true,track,now:2000}).text,
   'ROOM SPEECH · SPEAKER UNVERIFIED');
 assert.equal(roomMeterState({active:true,db:-40,vad:false,track,now:2000}).recentMatch,true);
 assert.equal(roomMeterState({active:true,db:-40,vad:false,track,now:6000}).recentMatch,false);
});
test('AGENT replaces face-progress strip with accessible live-input bar only in AGENT',()=>{
 const source=fs.readFileSync('vertical-motion.js','utf8');
 const css=fs.readFileSync('agent-presence.css','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(source,/roomMeterState\(\{\.\.\.shared,track:/);
 assert.match(source,/updateParticipantAudioMeters\(\)/);
 assert.match(source,/heading\.textContent = 'ROOM MIC · SHARED INPUT'/);
 assert.match(source,/meter\.setAttribute\('role', 'meter'\)/);
 assert.match(source,/} else \{\s*meter\.className = 'participant-scan-meter'/);
 assert.match(css,/participant-audio-meter\[data-mode="speech"\]/);
 assert.match(css,/backdrop-filter:blur\(15px\)/);
 assert.match(html,/id="roomAgentTab"/);
 assert.match(html,/id="agentLeftControls"(?! hidden)/);
});
test('AGENT tab is exposed immediately by URL; Conversation remains default',async()=>{
 const ids=['roomDialogueTab','playerActivityTab','roomAgentTab','roomDialoguePanel',
   'playerActivityPanel','roomAgentPanel','agentLeftControls'];
 const entries=new Map(ids.map(id=>[id,{id,
   hidden:['roomAgentTab','roomAgentPanel'].includes(id),style:{},tabIndex:0,attributes:{},handlers:{},
   setAttribute(k,v){this.attributes[k]=v;},
   addEventListener(k,fn){this.handlers[k]=fn;},focus(){this.focused=true;}}]));
 globalThis.document={getElementById:id=>entries.get(id)};
 globalThis.window={location:{search:'?mode=agent'},addEventListener(){}};
 try{
  await import('../room-tabs-controller.js?agent-early-init-meter-test');
  assert.equal(entries.get('roomAgentTab').hidden,false);
  assert.equal(entries.get('agentLeftControls').hidden,false);
  assert.equal(entries.get('roomDialoguePanel').hidden,false);
  entries.get('roomAgentTab').handlers.click();
  assert.equal(entries.get('roomAgentPanel').hidden,false);
  assert.equal(entries.get('roomDialoguePanel').hidden,true);
 }finally{delete globalThis.document;delete globalThis.window;}
});

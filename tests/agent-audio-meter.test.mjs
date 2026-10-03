import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roomMeterState,VERIFIED_SEGMENT_DISPLAY_MS} from '../src/participant-audio-meter.js';

test('individual participant meters never react to raw room noise or unverified VAD',()=>{
 const offline=roomMeterState();
 assert.deepEqual(offline,{mode:'off',level:0,text:'MIC OFF',recentMatch:false});
 const track={participantId:'person-a',voiceMatchConfidence:.98,voiceLevelDb:-16,
  lastVoiceAt:1000,verifiedVoiceSegment:false};
 const noise=roomMeterState({active:true,track,voiceProfileReady:true,
  db:-4,vad:true,now:1500});
 assert.equal(noise.level,0);
 assert.equal(noise.mode,'waiting');
 assert.equal(noise.recentMatch,false);
 assert.equal(roomMeterState({active:true,track,voiceProfileReady:false,db:-4,vad:true,now:1500}).level,0);
});
test('only an enrolled, gated, correctly attributed voice segment activates its own card',()=>{
 const verified={participantId:'alice',lastVoiceAt:3000,verifiedVoiceSegment:true,
  voiceMatchConfidence:.88,voiceLevelDb:-24};
 const a=roomMeterState({active:true,track:verified,voiceProfileReady:true,now:3300,db:-1,vad:true});
 assert.equal(a.mode,'verified');
 assert.ok(a.level>0);
 assert.match(a.text,/LAST SEGMENT/);
 const other={participantId:'bob',lastVoiceAt:0,voiceLevelDb:-8,verifiedVoiceSegment:false};
 assert.equal(roomMeterState({active:true,track:other,voiceProfileReady:true,now:3300,db:0,vad:true}).level,0);
 const aged=roomMeterState({active:true,track:verified,voiceProfileReady:true,now:3000+VERIFIED_SEGMENT_DISPLAY_MS});
 assert.equal(aged.level,0);
 assert.equal(aged.recentMatch,false);
});
test('suppression, profile removal and replay rejection fail closed',()=>{
 const track={participantId:'p',lastVoiceAt:1000,verifiedVoiceSegment:true,
  voiceMatchConfidence:.86,voiceLevelDb:-15};
 assert.equal(roomMeterState({active:true,suppressed:true,track,voiceProfileReady:true,now:1400}).level,0);
 assert.equal(roomMeterState({active:true,track,voiceProfileReady:false,now:1400}).level,0);
 assert.equal(roomMeterState({active:true,track,voiceProfileReady:true,now:500}).level,0);
 assert.equal(roomMeterState({active:false,track,voiceProfileReady:true,now:1400}).level,0);
});
test('AGENT sidebar consumes only verified segment; ambient monitoring is in ROOM',()=>{
 const source=fs.readFileSync('vertical-motion.js','utf8');
 const css=fs.readFileSync('agent-presence.css','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.match(source,/roomMeterState\(\{\.\.\.shared,track,voiceProfileReady:enrolled\}\)/);
 assert.match(source,/liveTrack\.verifiedVoiceSegment=true/);
 assert.ok(source.indexOf('liveTrack.verifiedVoiceSegment=true')>
   source.indexOf("if (!gate.accept)"));
 assert.doesNotMatch(source,/heading\.textContent = 'ROOM MIC · SHARED INPUT'/);
 assert.match(agent,/\$\('roomAudioDiagnosticsMount'\)\.append\(live\)/);
 assert.match(html,/id="roomAmbientAudioMeter"/);
 assert.match(css,/participant-audio-meter\[data-mode="verified"\]/);
 assert.match(html,/id="roomAgentTab"/);
 assert.match(html,/id="agentLeftControls"(?! hidden)/);
});

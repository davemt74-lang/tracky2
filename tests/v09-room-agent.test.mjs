import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {conversationTimeline} from '../src/conversation-timeline.js';
import {RoomPresenceLedger,roomObservation,appendRoomObservation} from '../src/room-event-core.js';
import {orbSpatialTarget} from '../src/orb-spatial-core.js';
import {nextTripleShortcut} from '../src/agent-shortcuts.js';
import {nextAgentTab} from '../src/agent-presentation.js';
test('one chronological thread deduplicates verified transcripts and preserves unknown speaker boundaries',()=>{
 const turns=[{id:'a',transcript:'hello',participantId:'p',participantName:'Dave',attribution:'voice+body',createdAt:'2026-10-03T10:00:00Z'},
 {id:'b',transcript:'someone speaking',participantId:null,participantName:'Dave',createdAt:'2026-10-03T10:00:02Z'}];
 const entries=[{role:'participant',text:'hello',participantId:'p',at:Date.parse(turns[0].createdAt)},
 {role:'agent',text:'Good morning',at:Date.parse('2026-10-03T10:00:01Z')}];
 const rows=conversationTimeline(turns,entries,[{id:'p',name:'Dave',primaryPhoto:'data:image/png;base64,AA=='}]);
 assert.deepEqual(rows.map(r=>r.text),['hello','Good morning','someone speaking']);
 assert.equal(rows[0].verified,true);assert.equal(rows[0].name,'Dave');
 assert.equal(rows[2].name,'Unknown speaker');assert.equal(rows[2].photo,null);
});
test('ROOM observations maintain timestamps, bounded memory and never infer sleep',()=>{
 const o=roomObservation({category:'presence',message:'Observed',at:1000});
 assert.equal(o.at,1000);assert.equal(appendRoomObservation([],o).length,1);
 assert.equal(roomObservation({category:'medical',message:'diagnosis'}),null);
 const room=new RoomPresenceLedger({graceMs:10000});
 assert.equal(room.update([{participantId:'p',participantName:'Dave',id:'a'}],1000).length,1);
 assert.equal(room.update([],5000).length,0);
 const ended=room.update([],12000);
 assert.equal(ended.length,1);assert.match(ended[0].message,/no longer visible/);
 assert.equal(ended[0].evidence.durationMs,0);
 room.update([{participantId:'p',participantName:'Dave',id:'a'}],13000);
 room.unavailable();assert.equal(room.update([],25000).length,0,'offline camera must not create departures');
});
test('orb tracks a stable primary participant, uses bounding box only as relative range',()=>{
 const view={videoWidth:1280,videoHeight:720,displayWidth:1280,displayHeight:720,mirror:false};
 const far={id:'a',participantId:'a',box:{x:.1,y:.3,width:.1,height:.18}};
 const near={id:'b',participantId:'b',box:{x:.65,y:.2,width:.25,height:.5}};
 const best=orbSpatialTarget([far,near],view);
 assert.equal(best.participantId,'b');assert.ok(best.volume>.6);
 assert.equal(orbSpatialTarget([far,near],view,'a').participantId,'a');
 assert.ok(orbSpatialTarget([far],view).volume<best.volume);
 assert.equal(orbSpatialTarget([],view),null);
});
test('XXX hides both panels and ZZZ remains independent, ignoring interrupted shortcuts',()=>{
 let state;for(const [key,now] of [['x',10],['x',110],['x',200]]){
  const step=nextTripleShortcut(state,key,now);state=step.state;
  if(now===200)assert.equal(step.trigger,'x');
 }
 assert.equal(nextTripleShortcut(state,'z',800).trigger,null);
 assert.equal(nextTripleShortcut({key:'x',count:2,lastAt:100},'z',150).trigger,null);
});
test('four AGENT tabs cycle correctly',()=>{
 assert.equal(nextAgentTab('agent','ArrowRight'),'room');
 assert.equal(nextAgentTab('room','ArrowRight'),'dialogue');
 assert.equal(nextAgentTab('dialogue','ArrowRight'),'activity');
 assert.equal(nextAgentTab('dialogue','End'),'room');
});
test('render contracts expose unified chat, ROOM, immersive toggle and cadence hooks',()=>{
 const h=fs.readFileSync('vertical-motion.html','utf8');
 const presence=fs.readFileSync('agent-presence.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 for(const id of ['roomObservationsPanel','roomObservationsTimeline','roomTab','agentOrbFollower','agentFollowParticipant','agentDistanceAudio'])
  assert.ok(h.includes('id="'+id+'"'),id);
 assert.match(presence,/tracky:agent-speech-cadence/);
 assert.match(agent,/boundary/);
 assert.match(presence,/room-sidebars-hidden/);
});

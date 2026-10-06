import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {conversationTimeline} from '../src/conversation-timeline.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const section=(text,start,end)=>{
 const a=text.indexOf(start);assert.ok(a>=0,'missing '+start);
 const b=text.indexOf(end,a+start.length);assert.ok(b>a,'missing '+end);
 return text.slice(a,b);
};

test('v0.14.7 ROOM tab is one aggregate feed with no mapping or participant-detail panels',()=>{
 const html=read('vertical-motion.html');
 const room=section(html,'<section id="roomObservationsPanel"','</section>\n    </aside>');
 assert.match(room,/Unified ROOM activity feed/);
 assert.match(room,/One live room-level feed/);
 assert.match(room,/ROOM Settings/);
 assert.doesNotMatch(room,/roomSceneEditor|roomTemporalSummary|roomAmbientAudioMeter|roomRoutineInsights|WHAT THE AGENT SEES|WHAT THE AGENT HEARS/);
 const player=section(html,'<section id="playerActivityPanel"','<section id="roomAgentPanel"');
 assert.match(player,/id="roomTemporalSummary"/);
});

test('v0.14.7 ROOM settings and mapping live in Control Center ROOM',()=>{
 const html=read('vertical-motion.html');
 const control=section(html,'<section id="controlCenterRoomPanel"','</section>\n  </section>\n</div>');
 for(const id of ['roomIdentityForm','roomHandoffPanel','roomAdvancedMappingEnabled','roomSceneEditor',
  'roomSaveObservations','roomAnalyzeAcousticPatterns','roomClassifyEnvironmentalAudio',
  'roomAmbientAudioMeter','roomRoutineInsights'])
  assert.match(control,new RegExp('id="'+id+'"'));
 assert.match(control,/Enable Advanced Room Mapping/);
 assert.match(control,/Basic ROOM is enabled by default/);
});

test('v0.14.7 room feed filters out participant-scoped evidence and adds aggregate occupancy',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/filter\(e=>!e\?\.participantId&&roomEventMatchesFilter/);
 assert.match(runtime,/function noteAggregateRoomOccupancy/);
 assert.match(runtime,/semantic:'room-occupancy'/);
 assert.match(runtime,/aggregate-camera-presence/);
});

test('v0.14.7 Basic ROOM defaults on while explicit prior off is respected',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/ambientAnalysis\.checked=savedAmbient!==\'no\'/);
 assert.match(runtime,/environmentalAudioToggle\.checked=savedEnvironmental!==\'no\'/);
 assert.match(runtime,/saveRoomHistory=savedRoomHistory!==\'no\'/);
 assert.match(runtime,/tracky2-room-acoustic-patterns/);
 assert.match(runtime,/tracky2-room-environmental-audio/);
});

test('v0.14.7 Advanced Mapping is real runtime opt-in with existing-map migration',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/advancedRoomMappingEnabled=stored===\'yes\'\|\|\(stored===null&&existingMap\)/);
 assert.match(runtime,/function effectiveRoomScene/);
 assert.match(runtime,/if\(advancedRoomMappingEnabled\)return scene/);
 assert.match(runtime,/roomIdentityId:scene\.roomIdentityId/);
 assert.match(runtime,/tracky2-advanced-room-mapping/);
 assert.ok(runtime.includes('getScene:()=>effectiveRoomScene()'));
 assert.ok(runtime.includes('const scene=effectiveRoomScene()'));
});

test('v0.14.7 shared Conversation timeline contains multiple participants and AGENT in chronological order',()=>{
 const turns=[
  {id:'t1',transcript:'Hi from A',participantId:'a',participantName:'A',attribution:'voice',at:100},
  {id:'t2',transcript:'Hi from B',participantId:'b',participantName:'B',attribution:'voice',at:300}
 ];
 const history=[{role:'agent',text:'Hello everyone',at:200}];
 const participants=[{id:'a',name:'Alice'},{id:'b',name:'Bob'}];
 const rows=conversationTimeline(turns,history,participants);
 assert.deepEqual(rows.map(r=>[r.name,r.text]),[
  ['Alice','Hi from A'],['AGENT','Hello everyone'],['Bob','Hi from B']
 ]);
});

test('v0.14.7 Conversation restores persisted legacy history without duplicating canonical transcript turns',()=>{
 const turns=[{id:'t1',transcript:'Canonical hello',participantId:'a',participantName:'A',
  attribution:'voice',at:1000}];
 const history=[
  {role:'participant',text:'Canonical hello',participantId:'a',at:1002},
  {role:'participant',text:'Older local question',participantId:'a',at:500},
  {role:'agent',text:'Older saved answer',participantId:'a',at:700}
 ];
 const rows=conversationTimeline(turns,history,[{id:'a',name:'Alice'}]);
 assert.deepEqual(rows.map(r=>r.text),['Older local question','Older saved answer','Canonical hello']);
 assert.equal(rows[0].source,'legacy-agent-history');
 assert.equal(rows[0].verified,false);
 assert.equal(rows.filter(r=>r.text==='Canonical hello').length,1);
});

test('v0.14.7 Conversation controller loads saved history at startup instead of hiding it behind the save toggle',()=>{
 const agent=read('agent-mode.js');
 assert.match(agent,/entries=loadAgentHistory\(localStorage\)/);
 assert.match(agent,/ui\.save\.checked=entries\.length>0/);
 assert.doesNotMatch(agent,/filter\(item=>item\.role!==['"]participant['"]\)/);
 assert.match(agent,/Legacy local conversation · speaker attribution not revalidated/);
});

test('v0.14.7 Conversation auto-scrolls on render and when tab becomes visible',()=>{
 const agent=read('agent-mode.js'),tabs=read('room-tabs-controller.js'),html=read('vertical-motion.html');
 assert.doesNotMatch(html,/SHARED CONVERSATION|All participants \+ AGENT|SEARCH TRANSCRIPTS|Export session|Export all|No transcript session loaded/);
 assert.match(html,/Chronological conversation for all participants and agents/);
 assert.match(agent,/function scrollConversationToLatest/);
 assert.match(agent,/ui\.thread\.scrollTop=ui\.thread\.scrollHeight/);
 assert.match(agent,/panel\.scrollTop=panel\.scrollHeight/);
 assert.match(agent,/tracky:conversation-visible/);
 assert.match(tabs,/tracky:conversation-visible/);
});

test('v0.14.7 Control Center has Account and ROOM tabs and can open before participant store loads',()=>{
 const html=read('vertical-motion.html'),controller=read('control-center.js');
 assert.match(html,/id="controlCenterAccountTab"/);
 assert.match(html,/id="controlCenterRoomTab"/);
 assert.match(controller,/function participantStore\(\)/);
 assert.match(controller,/import\('\.\/src\/participant-store\.js'\)/);
 assert.match(controller,/ui\.roomOpen\?\.addEventListener\('click',\(\)=>setOpen\(true,'room'\)\)/);
 assert.match(controller,/selectPane\('room'\)/);
});

test('v0.14.7 AGENT header exposes only Camera and Orb controls',()=>{
 const html=read('vertical-motion.html');
 const chooser=section(html,'<nav id="agentViewChooser"','</nav>');
 assert.match(chooser,/>Camera<\/button>/);
 assert.match(chooser,/>Orb<\/button>/);
 assert.doesNotMatch(chooser,/Control Center|ZZZ|XXX|CCC|agent-shortcut-hint|agent-exit/);
});

test('v0.14.7 right participant sidebar removes section titles and AGENT diagnostic rows below voice meter',()=>{
 const html=read('vertical-motion.html'),runtime=read('vertical-motion.js');
 assert.doesNotMatch(html,/ROOM IDENTITY · FULL BODY|Persistent participant tracking/);
 assert.doesNotMatch(html,/ROOM PARTICIPANTS|Known participants and stable visitors/);
 assert.match(runtime,/AGENT participant cards stop at the verified Voice Profile\/input meter/);
 assert.match(runtime,/if \(state\.mode !== 'agent'\) \{/);
});

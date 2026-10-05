import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 buildRecallProjection,searchRecall,explainRecallResult,RECALL_SOURCE_TYPES
} from '../src/session-recall-core.js';
import {normalizeMeetingRecord} from '../src/meeting-core.js';
import {normalizeMemoryRecord,revokeMemoryRecord} from '../src/agent-memory-core.js';

const participants=[
 {id:'p1',name:'Pat'},{id:'p2',name:'Sam'},{id:'p3',name:'Lee'}
];
const turn=(id,text,extra={})=>({
 id,sessionId:'dialogue-current',createdAt:'2026-10-04T18:00:00.000Z',
 participantId:'p1',participantName:'Pat',attribution:'voice-only',
 transcript:text,transcriptState:'final',transcriptSource:'local-whisper',...extra
});
const room=(id,message,extra={})=>({
 id,at:1000,category:'system',kind:'observation',message,
 source:'runtime',sessionId:'room-current',...extra
});

test('11I projection uses corrected canonical transcript text and current provenance',()=>{
 const corrected=turn('t1','Corrected wording',{
  transcriptState:'corrected',transcriptEditedAt:'2026-10-04T18:02:00.000Z'
 });
 const rows=buildRecallProjection({
  dialogueTurns:[corrected],participants,currentSessionIds:['dialogue-current']
 });
 const row=rows.find(x=>x.id==='conversation:t1');
 assert.equal(row.text,'Corrected wording');
 assert.equal(row.status,'corrected');
 assert.ok(row.provenance.includes('corrected'));
 assert.equal(row.temporal,'current-session');
 assert.equal(searchRecall(rows,'corrected').length,1);
 assert.equal(searchRecall(rows,'obsolete original').length,0);
});

test('11I ROOM projection applies replacement/retraction before recall results exist',()=>{
 const original=room('r1','Old room wording',{participantId:'p1'});
 const replace=room('r2','Owner corrected room event',{
  at:1100,kind:'correction',participantId:'p1',
  correction:{targetId:'r1',operation:'replace',replacement:{message:'Correct room wording',confidence:.9}}
 });
 const removed=room('r3','Should disappear',{at:1200,participantId:'p1'});
 const retract=room('r4','Retract prior',{
  at:1300,kind:'correction',participantId:'p1',
  correction:{targetId:'r3',operation:'retract'}
 });
 const rows=buildRecallProjection({
  roomEvents:[original,replace,removed,retract],participants,
  currentSessionIds:['room-current']
 });
 const effective=rows.filter(x=>x.sourceType==='room');
 assert.equal(effective.length,1);
 assert.equal(effective[0].text,'Correct room wording');
 assert.equal(effective[0].status,'corrected');
 assert.ok(effective[0].provenance.includes('owner-corrected'));
 assert.equal(searchRecall(rows,'Should disappear').length,0);
});

test('11I revoked and expired memory never appears while session-only active memory can',()=>{
 const active=normalizeMemoryRecord({id:'m1',participantId:'p1',type:'preference',
  text:'Prefers concise replies',persistent:false},1000);
 const revoked=revokeMemoryRecord(normalizeMemoryRecord({id:'m2',participantId:'p1',
  text:'Old preference',persistent:true},1000),'wrong',1500);
 const expired=normalizeMemoryRecord({id:'m3',participantId:'p1',text:'Temporary note',
  persistent:true,createdAt:1000,expiresAt:2000},1000);
 const rows=buildRecallProjection({memories:[active,revoked,expired],participants,now:3000});
 assert.deepEqual(rows.filter(x=>x.sourceType==='memory').map(x=>x.sourceId),['m1']);
 assert.equal(rows.find(x=>x.sourceId==='m1').temporal,'current-session');
});

test('11I participant scope is strict and does not leak unrelated participant-specific records',()=>{
 const meeting=normalizeMeetingRecord({
  id:'meet1',title:'Project sync',status:'ended',startedAt:1000,endedAt:2000,
  rosterParticipantIds:['p1','p2'],
  notes:[{id:'n1',text:'Shared project note',at:1500}]
 });
 const rows=buildRecallProjection({
  dialogueTurns:[turn('p1turn','Pat private topic'),turn('p3turn','Lee private topic',{participantId:'p3',participantName:'Lee'})],
  meetings:[meeting],
  memories:[
   normalizeMemoryRecord({id:'mp1',participantId:'p1',text:'Pat memory'},1000),
   normalizeMemoryRecord({id:'mp3',participantId:'p3',text:'Lee memory'},1000)
  ],
  participants,now:2000
 });
 const p1=searchRecall(rows,'',{participantId:'p1',limit:100});
 assert.ok(p1.some(x=>x.sourceId==='p1turn'));
 assert.ok(p1.some(x=>x.sourceId==='meet1'));
 assert.ok(p1.some(x=>x.sourceId==='mp1'));
 assert.ok(!p1.some(x=>x.sourceId==='p3turn'));
 assert.ok(!p1.some(x=>x.sourceId==='mp3'));
});

test('11I meeting decisions resolve current source text and expose deletion as stale reference',()=>{
 const corrected=turn('decision-turn','Use the corrected launch date',{
  transcriptState:'corrected',transcriptEditedAt:'2026-10-04T18:05:00Z',
  meetingId:'meet1'
 });
 const meeting=normalizeMeetingRecord({
  id:'meet1',title:'Launch meeting',status:'ended',startedAt:1000,endedAt:3000,
  rosterParticipantIds:['p1'],
  decisions:[{id:'d1',sourceTurnId:'decision-turn',note:'Launch timing',at:2000}]
 });
 let rows=buildRecallProjection({dialogueTurns:[corrected],meetings:[meeting],participants});
 let decision=rows.find(x=>x.id==='meeting:meet1:decision:d1');
 assert.match(decision.text,/corrected launch date/i);
 assert.equal(decision.references[0].state,'available');
 assert.ok(decision.provenance.includes('source-turn-corrected'));
 assert.equal(searchRecall(rows,'launch date',{sourceType:'decision'}).length,1);

 rows=buildRecallProjection({dialogueTurns:[],meetings:[meeting],participants});
 decision=rows.find(x=>x.id==='meeting:meet1:decision:d1');
 assert.doesNotMatch(decision.text,/corrected launch date/i);
 assert.equal(decision.status,'source-unavailable');
 assert.equal(decision.references[0].state,'stale');
 assert.match(explainRecallResult(decision).summary,/referenced source is unavailable/i);
});

test('11I task references report stale ROOM linkage instead of reconstructing deleted events',()=>{
 const tasks=[{id:'task1',skillId:'describe_object',targetId:'lamp',status:'succeeded',
  createdAt:1000,updatedAt:2000,resultText:'Lamp described',relatedEventId:'missing-room'}];
 const rows=buildRecallProjection({tasks,roomEvents:[],participants});
 const task=rows.find(x=>x.sourceId==='task1');
 assert.equal(task.references[0].state,'stale');
 assert.match(task.status,/event-reference-stale/);
 assert.match(explainRecallResult(task).summary,/unavailable/);
});

test('11I decision filter spans canonical ROOM decisions and meeting decisions only',()=>{
 const meeting=normalizeMeetingRecord({
  id:'meet1',title:'Decision meeting',status:'ended',startedAt:1000,endedAt:2000,
  rosterParticipantIds:['p1'],
  decisions:[{id:'d1',sourceTurnId:'t1',note:'Choose option A',at:1700}]
 });
 const rows=buildRecallProjection({
  dialogueTurns:[turn('t1','Option A approved',{meetingId:'meet1'})],
  roomEvents:[
   room('decision-room','Agent abstained',{category:'decision',kind:'decision'}),
   room('presence-room','Pat observed',{category:'presence'})
  ],
  meetings:[meeting],participants
 });
 const decisions=searchRecall(rows,'',{sourceType:'decision',limit:100});
 assert.ok(decisions.some(x=>x.id==='meeting:meet1:decision:d1'));
 assert.ok(decisions.some(x=>x.id==='room:decision-room'));
 assert.ok(!decisions.some(x=>x.id==='room:presence-room'));
});

test('11I AGENT history contributes only existing agent/system replies and current-session boundary is timestamp based',()=>{
 const rows=buildRecallProjection({
  agentHistory:[
   {id:'a1',role:'agent',text:'Current reply',at:5000,participantId:'p1'},
   {id:'s1',role:'system',text:'Earlier system note',at:1000},
   {id:'dup',role:'participant',text:'Duplicated participant speech',at:6000,participantId:'p1'}
  ],
  participants,currentSessionStartedAt:4000
 });
 assert.ok(rows.some(x=>x.sourceId==='a1'&&x.temporal==='current-session'));
 assert.ok(rows.some(x=>x.sourceId==='s1'&&x.temporal==='historical'));
 assert.ok(!rows.some(x=>x.sourceId==='dup'));
});

test('11I recall UI reads canonical stores live and creates no persistent search index',()=>{
 const ui=fs.readFileSync('src/session-recall-ui.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(ui,/listDialogueTurns\(\)/);
 assert.match(ui,/listRoomObservations\(\)/);
 assert.match(ui,/listAgentTasks\(\)/);
 assert.match(ui,/listAgentMemories\(\)/);
 assert.match(ui,/listMeetings\(\)/);
 assert.match(ui,/buildRecallProjection/);
 assert.doesNotMatch(ui,/indexedDB|localStorage\.setItem|saveDialogueTurn|saveRoomObservation|saveAgentTask|saveAgentMemory|saveMeeting/);
 assert.match(html,/id="agentRecallSettings"/);
 assert.match(html,/value="decision">Decisions/);
 assert.match(runtime,/createSessionRecallUi\(\{/);
 assert.match(runtime,/getCurrentRoomEvents:\(\)=>roomLedger\.entries\(\)/);
 assert.match(runtime,/getSessionMemories:\(\)=>memoryUI\?\.getMemories\?\.\(\)\|\|\[\]/);
 assert.match(runtime,/getAgentHistory:\(\)=>agentRuntime\?\.getHistory\?\.\(\)\|\|\[\]/);
});

test('11I supported source filters and explainability stay bounded and explicit',()=>{
 assert.deepEqual(RECALL_SOURCE_TYPES,
  ['conversation','room','meeting','recording','decision','task','memory']);
 const rows=buildRecallProjection({dialogueTurns:[turn('t1','Alpha beta gamma')],participants});
 const results=searchRecall(rows,'alpha beta',{limit:999});
 assert.equal(results.length,1);
 assert.deepEqual(results[0].matchTerms,['alpha','beta']);
 const explanation=explainRecallResult(results[0]);
 assert.match(explanation.summary,/canonical dialogue turn/);
 assert.match(explanation.summary,/provenance:/);
});

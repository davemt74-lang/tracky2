import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 buildSessionIdentityTimeline,createSessionIdentity,endSessionIdentity,
 normalizeSessionIdentity,sessionIdentityExport,sessionIdentitySummary
} from '../src/session-identity-core.js';

const session=createSessionIdentity({id:'session-1'},1000);

test('12E canonical session lifecycle is metadata only and stable across normalization/reload',()=>{
 const saved=normalizeSessionIdentity({...session,updatedAt:1500});
 assert.equal(saved.id,'session-1');
 assert.equal(saved.status,'active');
 const ended=endSessionIdentity(saved,'pagehide',3000);
 assert.equal(ended.status,'ended');
 assert.equal(ended.endedAt,3000);
 const json=JSON.stringify(ended);
 for(const forbidden of ['transcript','message','rawAudio','pcm','embedding','photo'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('12E timeline unifies dialogue, ROOM, meeting and recording references under one session id',()=>{
 const timeline=buildSessionIdentityTimeline({
  session,
  dialogueTurns:[{id:'t1',sessionId:'session-1',createdAt:new Date(1200).toISOString(),
   transcript:'hello',participantId:'p1',associationState:'verified-voice-only',
   meetingId:'m1'}],
  roomEvents:[{id:'r1',sessionId:'session-1',at:1300,category:'presence',
   message:'Pat arrived',participantId:'p1',source:'camera'}],
  meetings:[{id:'m1',sessionId:'session-1',startedAt:1100,status:'active',
   title:'Review',rosterParticipantIds:['p1']}],
  recordings:[{id:'rec1',sessionId:'session-1',startedAt:1150,durationMs:5000,
   participantIds:['p1']}],
  participants:[{id:'p1',name:'Pat'}]
 });
 assert.deepEqual([...new Set(timeline.map(row=>row.sourceType))].sort(),
  ['conversation','meeting','recording','room','session']);
 assert.ok(timeline.every(row=>row.sessionId==='session-1'));
 const recording=timeline.find(row=>row.sourceType==='recording');
 assert.equal(recording.text,'Recording metadata reference · 5s');
});

test('12E corrected transcript and speaker identity are projected from current canonical source, never copied session payload',()=>{
 const base={id:'t1',sessionId:'session-1',createdAt:new Date(1200).toISOString(),
  transcript:'original',participantId:null,associationState:'unknown-speaker'};
 const first=buildSessionIdentityTimeline({session,dialogueTurns:[base]});
 const corrected=buildSessionIdentityTimeline({session,dialogueTurns:[{
  ...base,transcript:'owner corrected',transcriptState:'corrected',
  multiPersonParticipantIds:['p2'],speakerAttributionEditedBy:'local-owner'
 }],participants:[{id:'p2',name:'Sam'}]});
 assert.equal(first.find(row=>row.sourceType==='conversation').text,'original');
 const row=corrected.find(item=>item.sourceType==='conversation');
 assert.equal(row.text,'owner corrected');
 assert.deepEqual(row.participantIds,['p2']);
 assert.ok(row.provenance.includes('owner-speaker-correction'));
});

test('12E deleted participant disappears from current canonical sources without resurrection',()=>{
 const before=buildSessionIdentityTimeline({
  session,
  dialogueTurns:[{id:'t1',sessionId:'session-1',createdAt:new Date(1200).toISOString(),
   transcript:'hello',participantId:'p1'}],
  participants:[{id:'p1',name:'Pat'}]
 });
 assert.equal(before.some(row=>row.participantIds.includes('p1')),true);
 const after=buildSessionIdentityTimeline({session,dialogueTurns:[],participants:[]});
 assert.equal(after.some(row=>row.participantIds.includes('p1')),false);
});

test('12E missing meeting linkage is shown as stale rather than reconstructed',()=>{
 const timeline=buildSessionIdentityTimeline({
  session,
  dialogueTurns:[{id:'t1',sessionId:'session-1',createdAt:new Date(1200).toISOString(),
   transcript:'hello',meetingId:'deleted-meeting'}],
  meetings:[]
 });
 const ref=timeline.find(row=>row.sourceType==='conversation').references[0];
 assert.deepEqual(ref,{type:'meeting',id:'deleted-meeting',state:'stale'});
 assert.equal(sessionIdentitySummary(timeline).staleReferenceCount,1);
});

test('12E session export is bounded canonical projection and excludes media payload',()=>{
 const timeline=buildSessionIdentityTimeline({
  session,
  dialogueTurns:[{id:'t1',sessionId:'session-1',createdAt:new Date(1200).toISOString(),
   transcript:'hello'}],
  recordings:[{id:'rec1',sessionId:'session-1',startedAt:1300,durationMs:2000,
   rawAudio:'must-not-export',blob:'must-not-export'}]
 });
 const exported=sessionIdentityExport(timeline,session);
 assert.equal(exported.session.id,'session-1');
 const json=JSON.stringify(exported);
 for(const forbidden of ['rawAudio','must-not-export','blob','embedding','primaryPhoto'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('12E runtime uses one canonical session id for ROOM and dialogue and links meetings to it',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/const canonicalSessionId=/);
 assert.match(runtime,/const roomSessionId=canonicalSessionId/);
 assert.match(runtime,/sessionId: canonicalSessionId/);
 assert.match(runtime,/sessionId:\(\)=>canonicalSessionId/);
 const ids=runtime.match(/currentSessionIds:\(\)=>\[canonicalSessionId\]/);
 assert.ok(ids);
});

test('12E participant store persists session lifecycle metadata without source content duplication',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(store,/const SESSION_IDENTITIES = 'session-identities'/);
 assert.match(store,/export function saveSessionIdentity/);
 assert.match(store,/export function listSessionIdentities/);
 assert.match(store,/DB_VERSION = 9/);
 const section=store.slice(store.indexOf('export function saveSessionIdentity'));
 assert.doesNotMatch(section,/transcript|rawAudio|samples|embedding|primaryPhoto|message/);
});

test('12E meeting metadata receives canonical session id',()=>{
 const meeting=fs.readFileSync('src/meeting-core.js','utf8');
 const ui=fs.readFileSync('src/meeting-ui.js','utf8');
 assert.match(meeting,/sessionId:/);
 assert.match(ui,/sessionId=\(\)=>null/);
 assert.match(ui,/sessionId:sessionId\(\)/);
});

test('12E pure session identity core opens no sensors, storage or network path',()=>{
 const core=fs.readFileSync('src/session-identity-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
});

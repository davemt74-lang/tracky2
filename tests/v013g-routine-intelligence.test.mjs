import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectRoomState,roomObservation} from '../src/room-event-core.js';
import {
 deriveRoutineCandidates,normalizeRoutineFeedback,routineDeviation,routineFeedbackIdsToPrune,
 scrubRoutineFeedbackParticipant,routineLabel,ROUTINE_MIN_OCCURRENCES
} from '../src/routine-intelligence-core.js';

const day=24*60*60*1000;
const event=(at,extra={})=>({id:'e'+at,participantId:'p1',semantic:'participant-observed',
 at,sessionId:'s'+at,roomId:'kitchen',...extra});
const deriveFresh=(events,feedback=[])=>{
 const latest=Math.max(...events.map(row=>Number(row?.at)||0));
 return deriveRoutineCandidates(events,feedback,latest+day);
};

test('13G sparse routine data abstains until three distinct recurring observations',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 assert.equal(deriveFresh([event(base),event(base+day)]).length,0);
 const rows=deriveFresh([event(base),event(base+day),event(base+2*day)]);
 assert.equal(ROUTINE_MIN_OCCURRENCES,3);
 assert.equal(rows.length,1);
 assert.equal(rows[0].occurrences,3);
});

test('13G repeated observations on one day are not a recurring routine',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const rows=deriveFresh([
  event(base),event(base+3*60*60*1000),event(base+6*60*60*1000)
 ]);
 assert.equal(rows.length,0);
});

test('13G morning and evening recurrence become separate time clusters',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const rows=deriveFresh([
  event(base),event(base+day),event(base+2*day),
  event(base+10*60*60*1000),event(base+day+10*60*60*1000),event(base+2*day+10*60*60*1000)
 ]);
 assert.equal(rows.length,2);
 assert.ok(Math.abs(rows[0].centerMinute-rows[1].centerMinute)>300);
});

test('13G midnight-spanning recurrence keeps a midnight clock center',()=>{
 const base=Date.UTC(2026,0,1,23,50);
 const rows=deriveFresh([
  event(base),event(base+day+20*60000),event(base+2*day+10*60000)
 ]);
 assert.equal(rows.length,1);
 assert.ok(rows[0].centerMinute<60||rows[0].centerMinute>1380);
});

test('13G recurring arrival window produces bounded observable routine candidate',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const rows=deriveFresh([
  event(base),event(base+day+5*60000),event(base+2*day-8*60000),event(base+3*day+3*60000)
 ]);
 const r=rows[0];
 assert.equal(r.participantId,'p1');
 assert.equal(r.semantic,'participant-observed');
 assert.ok(r.confidence>0&&r.confidence<=1);
 assert.ok(r.windowMinutes>=30);
 assert.equal(r.memoryAuthority,'none');
 assert.equal(r.healthInference,'none');
});

test('13G changed timing is deviation only, never sensitive inference',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const r=deriveFresh([event(base),event(base+day),event(base+2*day)])[0];
 const changed=routineDeviation(r,event(base+3*day+4*60*60*1000),base+3*day+4*60*60*1000);
 assert.equal(changed.state,'outside-baseline-window');
 assert.equal(changed.healthInference,'none');
 assert.equal(changed.emotionInference,'none');
});

test('13G owner confirm/reject/revoke changes review state without creating memory',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const seed=deriveFresh([event(base),event(base+day),event(base+2*day)])[0];
 for(const outcome of ['confirmed','rejected','revoked']){
  const feedback=normalizeRoutineFeedback({routineId:seed.id,outcome,at:base+3*day});
  const next=deriveFresh([event(base),event(base+day),event(base+2*day)],[feedback]);
  assert.equal(next[0].status,outcome);
  assert.equal(feedback.authority,'owner');
  assert.equal(feedback.memoryAuthority,'none');
 }
});

test('13G participant deletion scrubs routine feedback',()=>{
 const rows=[
  normalizeRoutineFeedback({routineId:'routine:p1|participant-observed|kitchen',outcome:'confirmed'}),
  normalizeRoutineFeedback({routineId:'routine:p2|participant-observed|office',outcome:'confirmed'})
 ];
 const keep=scrubRoutineFeedbackParticipant(rows,'p1');
 assert.equal(keep.length,1);
 assert.match(keep[0].routineId,/p2/);
});

test('13G feedback pruning remains bounded',()=>{
 const rows=Array.from({length:200},(_,i)=>({id:'f'+i,at:i}));
 assert.equal(routineFeedbackIdsToPrune(rows,160).length,40);
});

test('13G owner-retracted canonical ROOM evidence no longer contributes to routine learning',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const originals=[0,1,2].map(i=>roomObservation({
  id:'r'+i,at:base+i*day,category:'presence',semantic:'participant-observed',
  message:'Pat observed',participantId:'p1',roomId:'kitchen',sessionId:'s'+i
 },base+i*day));
 const correction=roomObservation({
  id:'fix',at:base+2*day+1000,category:'system',kind:'correction',
  semantic:'owner-correction',message:'Correction',participantId:'p1',
  correction:{targetId:'r1',operation:'retract'}
 },base+2*day+1000);
 const effective=projectRoomState([...originals,correction]).events;
 assert.equal(effective.filter(row=>row.semantic==='participant-observed').length,2);
 assert.equal(deriveFresh(effective).length,0);
});

test('13G unsafe or participant-less ROOM events cannot become routines',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const events=[
  {participantId:null,semantic:'participant-observed',at:base},
  {participantId:'p1',semantic:'environmental-audio-classification-v2',at:base},
  {participantId:'p1',semantic:'participant-observed',at:base},
  {participantId:'p1',semantic:'participant-observed',at:base+day},
  {participantId:'p1',semantic:'participant-observed',at:base+2*day}
 ];
 const rows=deriveFresh(events);
 assert.equal(rows.length,1);
});

test('13G routines expire when evidence is stale',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const now=base+50*day;
 assert.equal(deriveRoutineCandidates([event(base),event(base+day),event(base+2*day)],[],now).length,0);
});

test('13G routine labels describe observation timing without diagnosis',()=>{
 const base=Date.UTC(2026,0,1,8,0);
 const r=deriveFresh([event(base),event(base+day),event(base+2*day)])[0];
 const label=routineLabel(r);
 assert.match(label,/participant observed/);
 assert.doesNotMatch(label,/sleep|health|depress|anxiety|relig|race|politic/i);
});

test('13G persistence stores owner review metadata separately from Agent Memory',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(store,/ROUTINE_FEEDBACK/);
 assert.match(store,/saveRoutineFeedback/);
 assert.match(store,/listRoutineFeedback/);
 assert.match(store,/scrubRoutineFeedbackParticipant/);
 assert.match(store,/const DB_VERSION = 12/);
 assert.match(store,/ROUTINE_FEEDBACK/);
 const start=store.indexOf('export function listRoutineFeedback');
 const end=store.indexOf('// Only owner-entered area rectangles',start);
 const section=store.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.doesNotMatch(section,/saveAgentMemory|AGENT_MEMORIES/);
});

test('13G runtime derives routines from canonical ROOM history and exposes owner review UI',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(runtime,/deriveRoutineCandidates/);
 assert.match(runtime,/routineDeviation/);
 assert.match(runtime,/recordRoutineOwnerFeedback/);
 assert.match(html,/id="roomRoutineInsights"/);
 assert.match(html,/id="roomRoutineRefresh"/);
});

test('13G pure routine core has no sensors, storage, network, model or durable-memory authority',()=>{
 const core=fs.readFileSync('src/routine-intelligence-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket|saveAgentMemory|embedding/);
});

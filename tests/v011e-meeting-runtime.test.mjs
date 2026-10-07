import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 addMeetingActionItem,addMeetingDecision,addMeetingNote,createMeetingRecord,
 endMeetingRecord,meetingAgentReplyPolicy,meetingSummary,meetingTurnFields,meetingTurns,
 normalizeMeetingRecord,scrubMeetingParticipant,setMeetingActionStatus,
 setMeetingAgentPolicy,updateMeetingRoster
} from '../src/meeting-core.js';

const people=[{id:'p1',name:'Pat'},{id:'p2',name:'Sam'}];
const turn=(id,text,more={})=>({
 id,meetingId:'meeting-1',participantId:'p1',participantName:'Pat',
 attribution:'voice+body',transcript:text,createdAt:'2026-10-04T15:00:00Z',
 addressedAgent:false,...more
});

test('11E meeting record is bounded metadata and has explicit lifecycle/policy',()=>{
 const meeting=normalizeMeetingRecord({
  id:'meeting-1',title:'Team check-in',status:'active',startedAt:1000,
  agentPolicy:'listen-only',rosterParticipantIds:['p1','p1','p2']
 });
 assert.equal(meeting.schemaVersion,1);
 assert.equal(meeting.status,'active');
 assert.equal(meeting.agentPolicy,'listen-only');
 assert.deepEqual(meeting.rosterParticipantIds,['p1','p2']);
 assert.equal(meeting.endedAt,null);
 assert.ok(Object.isFrozen(meeting));
 assert.deepEqual(meetingTurnFields(meeting),{meetingId:'meeting-1',meetingSchemaVersion:1});
 const ended=endMeetingRecord(meeting,5000);
 assert.equal(ended.status,'ended');
 assert.equal(ended.endedAt,5000);
 assert.deepEqual(meetingTurnFields(ended),{meetingId:null,meetingSchemaVersion:null});
});

test('11E roster tracks verified joins/leaves and unknown counts without inventing identities',()=>{
 let meeting=normalizeMeetingRecord({id:'meeting-1',startedAt:1000,status:'active'});
 let step=updateMeetingRoster(meeting,{participantIds:['p1'],unverifiedCount:1},2000);
 meeting=step.meeting;
 assert.deepEqual(step.events.map(x=>[x.type,x.participantId]),[['joined','p1']]);
 assert.deepEqual(meeting.activeParticipantIds,['p1']);
 assert.deepEqual(meeting.rosterParticipantIds,['p1']);
 assert.equal(meeting.currentUnverifiedCount,1);
 assert.equal(meeting.peakUnverifiedCount,1);

 step=updateMeetingRoster(meeting,{participantIds:['p2'],unverifiedCount:2},3000);
 meeting=step.meeting;
 assert.deepEqual(step.events.map(x=>x.type).sort(),['joined','left']);
 assert.deepEqual(meeting.activeParticipantIds,['p2']);
 assert.deepEqual([...meeting.rosterParticipantIds].sort(),['p1','p2']);
 assert.equal(meeting.peakUnverifiedCount,2);
 assert.ok(meeting.rosterEvents.every(x=>x.participantId));
});

test('11E meeting transcript view references canonical turns so correction/deletion propagate automatically',()=>{
 const meeting=normalizeMeetingRecord({id:'meeting-1',status:'ended',startedAt:1000,endedAt:5000});
 const original=[turn('t1','original wording'),turn('t2','second turn')];
 assert.deepEqual(meetingTurns(meeting.id,original).map(x=>x.transcript),['original wording','second turn']);

 const corrected=[{...original[0],transcript:'owner corrected wording',transcriptState:'corrected'},original[1]];
 assert.deepEqual(meetingTurns(meeting.id,corrected).map(x=>x.transcript),
  ['owner corrected wording','second turn']);

 const deleted=[corrected[1]];
 assert.deepEqual(meetingTurns(meeting.id,deleted).map(x=>x.id),['t2']);
 assert.equal(JSON.stringify(meeting).includes('original wording'),false,
  'meeting metadata must not copy canonical transcript text');
});

test('11E owner notes, decisions and action items keep explicit provenance',()=>{
 let meeting=normalizeMeetingRecord({id:'meeting-1',status:'active',startedAt:1000,
  rosterParticipantIds:['p1','p2']});
 meeting=addMeetingNote(meeting,'Budget risk noted',1100);
 meeting=addMeetingDecision(meeting,'t1',{note:'Approve pilot'},1200);
 meeting=addMeetingActionItem(meeting,{
  text:'Pat sends proposal',sourceTurnId:'t2',assigneeParticipantId:'p1'
 },1300);
 assert.equal(meeting.notes[0].provenance,'owner-note');
 assert.equal(meeting.decisions[0].provenance,'owner-marked-canonical-turn');
 assert.equal(meeting.decisions[0].sourceTurnId,'t1');
 assert.equal(meeting.actionItems[0].provenance,'owner-action-item');
 assert.equal(meeting.actionItems[0].sourceTurnId,'t2');
 assert.equal(meeting.actionItems[0].assigneeParticipantId,'p1');
 meeting=setMeetingActionStatus(meeting,meeting.actionItems[0].id,'done',1400);
 assert.equal(meeting.actionItems[0].status,'done');
 assert.equal(meeting.actionItems[0].completedAt,1400);
});

test('11E deterministic post-meeting summary derives counts from current canonical turns',()=>{
 const meeting=endMeetingRecord(normalizeMeetingRecord({
  id:'meeting-1',title:'Review',status:'active',startedAt:1000,
  rosterParticipantIds:['p1','p2'],
  notes:[{text:'Owner note',at:1200}],
  decisions:[{sourceTurnId:'t1',note:'Ship it',at:1300}],
  actionItems:[{text:'Follow up',sourceTurnId:'t2',assigneeParticipantId:'p2',status:'open',createdAt:1400}]
 }),5000);
 const turns=[
  turn('t1','Decision text'),
  turn('t2','Action text',{participantId:'p2',participantName:'Sam'}),
  turn('t3','Unknown',{participantId:null,attribution:'unknown'})
 ];
 const summary=meetingSummary(meeting,turns,people);
 assert.equal(summary.title,'Review');
 assert.equal(summary.durationMs,4000);
 assert.equal(summary.transcriptCount,3);
 assert.equal(summary.unknownTurnCount,1);
 assert.equal(summary.decisionCount,1);
 assert.equal(summary.actionItemCount,1);
 assert.equal(summary.openActionItemCount,1);
 assert.deepEqual(summary.rosterNames,['Pat','Sam']);
});

test('11E AGENT policy is meeting-specific and suppresses late replies after meeting ends',()=>{
 let meeting=normalizeMeetingRecord({id:'meeting-1',status:'active',startedAt:1000,agentPolicy:'listen-only'});
 let t=turn('t1','Agent, summarize that',{addressedAgent:true});
 assert.deepEqual(meetingAgentReplyPolicy(meeting,t),{allow:false,reason:'meeting listen-only'});

 meeting=setMeetingAgentPolicy(meeting,'when-addressed',1200);
 assert.deepEqual(meetingAgentReplyPolicy(meeting,t),
  {allow:true,reason:'meeting AGENT explicitly addressed'});
 assert.equal(meetingAgentReplyPolicy(meeting,{...t,addressedAgent:false}).allow,false);
 assert.equal(meetingAgentReplyPolicy(meeting,{...t,meetingId:'different'}).allow,false);

 const ended=endMeetingRecord(meeting,2000);
 assert.equal(meetingAgentReplyPolicy(ended,t).allow,false);
 assert.match(meetingAgentReplyPolicy(ended,t).reason,/no longer active/);
 assert.deepEqual(meetingAgentReplyPolicy(null,{...t,meetingId:null}),
  {allow:true,reason:'no-active-meeting'});
});

test('11E participant deletion scrubs roster/events/assignee without deleting meeting',()=>{
 const meeting=normalizeMeetingRecord({
  id:'meeting-1',status:'ended',startedAt:1000,endedAt:2000,
  rosterParticipantIds:['p1','p2'],activeParticipantIds:[],
  rosterEvents:[
   {type:'joined',participantId:'p1',at:1100},
   {type:'joined',participantId:'p2',at:1200}
  ],
  actionItems:[{text:'Pat task',assigneeParticipantId:'p1',status:'open',createdAt:1300}]
 });
 const scrubbed=scrubMeetingParticipant(meeting,'p1',3000);
 assert.deepEqual(scrubbed.rosterParticipantIds,['p2']);
 assert.equal(scrubbed.rosterEvents.some(x=>x.participantId==='p1'),false);
 assert.equal(scrubbed.actionItems[0].assigneeParticipantId,null);
 assert.equal(scrubbed.actionItems[0].assigneeDeleted,true);
 assert.equal(scrubbed.id,'meeting-1');
});

test('11E IndexedDB v8 persists meeting metadata, enforces one active record and scrubs deletion atomically',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const version=Number(store.match(/const DB_VERSION = (\d+)/)?.[1]);
 assert.ok(version>=8);
 assert.match(store,/const MEETINGS = 'meetings'/);
 assert.match(store,/createObjectStore\(MEETINGS,\{keyPath:'id'\}\)/);
 assert.match(store,/Another meeting is already active in this browser profile/);
 assert.match(store,/scrubMeetingParticipant\(normalizeMeetingRecord\(meeting\),id,Date\.now\(\)\)/);
 const section=store.slice(store.indexOf('/* V0.11E meeting metadata only'));
 assert.doesNotMatch(section,/rawAudio|samples|embedding|primaryPhoto|latestPhoto|faceSamples|voiceSamples/);
});

test('11E UI reloads active meeting, derives source text from canonical turns and never copies transcript into metadata',()=>{
 const ui=fs.readFileSync('src/meeting-ui.js','utf8');
 assert.match(ui,/\[records,allTurns\]=await Promise\.all\(\[listMeetings\(\),listDialogueTurns\(\)\]\)/);
 assert.match(ui,/active=records\.find\(row=>row\.status==='active'\)\|\|null/);
 assert.match(ui,/meetingTurns\(record\.id,allTurns\)/);
 assert.match(ui,/Canonical source turn unavailable/);
 assert.match(ui,/Meeting metadata deleted\. Canonical transcripts remain\./);
 assert.match(ui,/Post-meeting summary is derived from canonical turns/);
 assert.doesNotMatch(ui,/transcriptText|copiedTranscript|rawAudio|MediaRecorder|getUserMedia/);
});

test('11E runtime stamps meeting ID before queueing, refreshes after corrections, and reuses existing media/transcription path',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/const meetingFields=meetingUI\?\.turnFields\?\.\(\)/);
 const enqueueStart=runtime.indexOf('listeningController.enqueue({');
 const enqueueEnd=runtime.indexOf('},{',enqueueStart);
 const enqueueBlock=runtime.slice(enqueueStart,enqueueEnd);
 assert.ok(enqueueStart>0&&enqueueEnd>enqueueStart);
 assert.match(enqueueBlock,/\.\.\.segment/);
 assert.match(enqueueBlock,/\.\.\.meetingFields/);
 assert.match(runtime,/meetingId:segment\.meetingId\|\|null/);
 assert.match(runtime,/meetingUI\?\.refreshTurns\(\)/);
 assert.match(runtime,/createMeetingUi\(/);
 assert.doesNotMatch(runtime,/requestedMode==='meeting'/);
 assert.equal((runtime.match(/new RoomAudioCapture\(/g)||[]).length,1,
  'meeting runtime must reuse the one canonical RoomAudioCapture');
 const meetingCore=fs.readFileSync('src/meeting-core.js','utf8');
 assert.doesNotMatch(meetingCore,/getUserMedia|MediaRecorder|AudioContext|transcribe\(|embedding\(|fetch\(/);
});

test('11E meeting controls are administrative while the live runtime remains shared with AGENT',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const tabs=fs.readFileSync('room-tabs-controller.js','utf8');
 const presentation=fs.readFileSync('src/agent-presentation.js','utf8');
 const admin=fs.readFileSync('server/admin.php','utf8');
 assert.doesNotMatch(html,/id="roomMeetingTab"|id="roomMeetingPanel"/);
 assert.match(html,/id="controlCenterMeetingTab"/);
 assert.match(html,/id="controlCenterMeetingPanel"/);
 assert.match(admin,/vertical-motion\.html\?mode=agent&amp;admin=meeting/);
 assert.doesNotMatch(tabs,/requestedMeeting|mode.*meeting/);
 assert.match(presentation,/\['dialogue','activity','agent','room'\]/);
});
test('11E AGENT cancels stale reply on meeting boundary and meeting policy gates participation before group policy',()=>{
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const meeting=agent.indexOf('const meetingPolicy=meetingAgentReplyPolicy(getMeeting(),turn)');
 const group=agent.indexOf('const groupPolicy=multiParticipantReplyPolicy(turn)',meeting);
 assert.ok(meeting>0&&group>meeting);
 assert.match(agent,/meetingPolicy\.allow/);
 assert.match(agent,/onMeetingChange\(meeting\)/);
 assert.match(agent,/responseGeneration\+=1;responsePending=false;modelController\?\.abort\(\);stopSpeech\(\)/);
 assert.match(agent,/if\(getMeeting\(\)\?\.status==='active'\)return false/);
});

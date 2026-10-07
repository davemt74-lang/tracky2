import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describeAcousticPattern} from '../src/room-acoustic-patterns.js';
import {reviseTranscriptRecord,MAX_TRANSCRIPT_LENGTH,MAX_TRANSCRIPT_REVISIONS} from '../src/transcript-correction.js';
import {conversationTimeline} from '../src/conversation-timeline.js';
import {bestVoiceMatch,createSpeakerTurn} from '../src/voice-core.js';
const summary=(more={})=>({at:10000,durationMs:15000,frames:100,meanDb:-43,
 peakDb:-20,noiseFloorDb:-63,speechFrames:0,...more});
test('10D optional ambient patterns only describe measured amplitude/VAD, never identify sources',()=>{
 const peaks=describeAcousticPattern(summary());
 assert.equal(peaks.pattern,'intermittent-peaks');
 assert.match(peaks.description,/source unknown/);
 const ongoing=describeAcousticPattern(summary({speechFrames:72}));
 assert.equal(ongoing.pattern,'voice-activity-heavy');
 assert.match(ongoing.description,/speaker unverified/);
 assert.equal(describeAcousticPattern(summary({meanDb:-59,peakDb:-54,noiseFloorDb:-63})).pattern,'low-variation');
 assert.equal(describeAcousticPattern(summary({frames:3,durationMs:15000})),null);
 assert.equal(describeAcousticPattern(summary({meanDb:NaN})),null);
 const code=fs.readFileSync('src/room-acoustic-patterns.js','utf8');
 assert.doesNotMatch(code,/MediaRecorder|getUserMedia|analy[sz]eMedia/);
 assert.equal([peaks.description,ongoing.description].every(t=>!/music|television|cough|illness/i.test(t)),true);
});
test('10D owner corrections preserve verified speaker identity, original text and bounded provenance',()=>{
 const base={id:'turn-1',transcript:'Original spoken sentence',participantId:'known',
  participantName:'Known',attribution:'voice+body',voiceConfidence:.92,trackId:'track-1'};
 const a=reviseTranscriptRecord(base,'  Corrected sentence  ',1000);
 assert.equal(a.transcript,'Corrected sentence');
 assert.equal(a.originalTranscript,'Original spoken sentence');
 assert.equal(a.transcriptRevisions.length,1);
 assert.equal(a.transcriptRevisions[0].previous,'Original spoken sentence');
 assert.equal(a.participantId,'known');
 assert.equal(a.attribution,'voice+body');
 assert.equal(a.voiceConfidence,.92);
 assert.equal(base.transcript,'Original spoken sentence');
 let updated=a;
 for(let i=0;i<MAX_TRANSCRIPT_REVISIONS+2;i++)
  updated=reviseTranscriptRecord(updated,'Updated wording '+i,2000+i);
 assert.equal(updated.originalTranscript,'Original spoken sentence');
 assert.equal(updated.transcriptRevisions.length,MAX_TRANSCRIPT_REVISIONS);
 assert.throws(()=>reviseTranscriptRecord(base,' '.repeat(3)),/1–800/);
 assert.throws(()=>reviseTranscriptRecord(base,'x'.repeat(MAX_TRANSCRIPT_LENGTH+1)),/1–800/);
 assert.throws(()=>reviseTranscriptRecord(base,base.transcript),/unchanged/);
});
test('10D corrected canonical transcript never displays stale secondary AGENT transcript copies',()=>{
 const turns=[{id:'turn-1',transcript:'Owner corrected',originalTranscript:'Old text',
  transcriptEditedAt:'2026-10-03T20:00:00Z',participantId:'p',attribution:'voice-only',
  createdAt:'2026-10-03T19:59:00Z'}];
 const history=[{role:'participant',text:'Old text',participantId:'p',at:Date.parse(turns[0].createdAt)},
  {role:'agent',text:'I heard the original sentence',at:Date.parse(turns[0].createdAt)+900}];
 const timeline=conversationTimeline(turns,history,[{id:'p',name:'Owner'}]);
 assert.equal(timeline.length,2);
 assert.equal(timeline[0].text,'Owner corrected');
 assert.equal(timeline[0].edited,true);
 assert.equal(timeline[0].verified,true);
 assert.equal(timeline.some(e=>e.text==='Old text'),false);
 assert.equal(conversationTimeline([],history,[]).some(e=>e.role==='participant'),false,
  'cleared canonical transcripts must not reappear from AGENT reply history');
});
test('10D unverified speaker remains unverified even next to enrolled participant',()=>{
 const profiles=[{id:'person-a',voiceRecognitionEnabled:true,
  voiceEmbeddings:[[1,0],[1,0],[1,0]],
  voiceProfileSamples:[{durationSeconds:5},{durationSeconds:5},{durationSeconds:6}]},
 {id:'person-b',voiceRecognitionEnabled:true,
  voiceEmbeddings:[[.999,.045],[.999,.045],[.999,.045]],
  voiceProfileSamples:[{durationSeconds:5},{durationSeconds:5},{durationSeconds:6}]}];
 const match=bestVoiceMatch([1,.02],profiles,.8,.05);
 assert.equal(match.matched,false);
 assert.equal(match.ambiguous,true);
 const turn=createSpeakerTurn({participantId:match.matched?match.participant.id:null,
  attribution:'unknown',transcript:'Who is speaking?'});
 assert.equal(turn.participantId,null);
 assert.equal(turn.attribution,'unknown');
});
test('10D single-capture integration: owner edit, suppression gap and bounded acoustic-pattern policy',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(runtime,/roomAmbientAudit\.flush\(Date\.now\(\)\)/);
 assert.match(runtime,/if\(captureSuppressed\)\{/);
 assert.match(runtime,/describeAcousticPattern\(summary\)/);
 assert.match(runtime,/analyzeAmbientPatterns=ambientAnalysis\.checked/);
 assert.match(runtime,/ambientAnalysis\.checked=savedAmbient!=='no'/);
 assert.match(runtime,/tracky2-room-acoustic-patterns/);
 assert.match(runtime,/Owner disabled local room energy-pattern notes/);
 assert.match(runtime,/revised=await reviseDialogueTurn\(id,text\)/);
 assert.match(store,/reviseTranscriptRecord\(current,text,at\)/);
 assert.match(agent,/editTranscript=async\(\)=>\{\}/);
 assert.doesNotMatch(agent,/append\('participant',turn\.transcript/);
 assert.match(html,/id="roomAnalyzeAcousticPatterns"/);
});

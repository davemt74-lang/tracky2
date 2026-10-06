import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 EnvironmentalAudioQueue,EnvironmentalClassificationTracker,
 environmentalCategoryForLabel,environmentalClassificationMessage,
 environmentalLabelBlocked,normalizeEnvironmentalPredictions
} from '../src/environmental-audio-core.js';
import {
 ENVIRONMENT_AUDIO_MODEL_ID,ENVIRONMENT_AUDIO_MODEL_REVISION
} from '../src/model-config.js';

const segment=()=>({
 samples:new Float32Array(16000).fill(.02),sampleRate:16000,
 durationSeconds:1.0,captureDurationMs:1000
});

test('11F environmental categories come from approved model labels, never amplitude/VAD heuristics',()=>{
 assert.equal(environmentalCategoryForLabel('Music'),'music');
 assert.equal(environmentalCategoryForLabel('Television'),'media-playback');
 assert.equal(environmentalCategoryForLabel('Siren'),'alarm');
 assert.equal(environmentalCategoryForLabel('Dog'),'animal');
 assert.equal(environmentalCategoryForLabel('Rain'),'weather-water');
 assert.equal(environmentalCategoryForLabel('Car'),'transport');
 assert.equal(environmentalCategoryForLabel('Vacuum cleaner'),'household-mechanical');
 assert.equal(environmentalCategoryForLabel('Applause'),'impact-crowd');
 assert.equal(environmentalCategoryForLabel('Unmapped mystery source'),null);
 const patterns=fs.readFileSync('src/room-acoustic-patterns.js','utf8');
 assert.doesNotMatch(patterns,/audio-classification|ENVIRONMENT_AUDIO_MODEL|pipeline\(/);
});

test('11F speech/health/human-sensitive labels are filtered and cannot fall through to weaker source guesses',()=>{
 for(const label of ['Speech','Conversation','Cough','Sneeze','Snoring','Breathing','Child speech','Female speech'])
  assert.equal(environmentalLabelBlocked(label),true,label);
 const result=normalizeEnvironmentalPredictions([
  {label:'Speech',score:.91},{label:'Music',score:.71}
 ]);
 assert.equal(result.accepted,false);
 assert.equal(result.reason,'speech-or-sensitive-filtered');
 assert.equal(result.classification,null);
});

test('11F low-confidence and ambiguous environmental results abstain',()=>{
 let result=normalizeEnvironmentalPredictions([
  {label:'Music',score:.51},{label:'Rain',score:.2}
 ]);
 assert.equal(result.accepted,false);
 assert.equal(result.reason,'low-confidence');

 result=normalizeEnvironmentalPredictions([
  {label:'Music',score:.72},{label:'Siren',score:.69}
 ]);
 assert.equal(result.accepted,false);
 assert.equal(result.reason,'ambiguous-category');
});

test('11F accepted classification is metadata-only, source-unattributed and reproducible',()=>{
 const result=normalizeEnvironmentalPredictions([
  {label:'Music',score:.88},{label:'Siren',score:.04}
 ],{at:1234,durationMs:4200});
 assert.equal(result.accepted,true);
 const c=result.classification;
 assert.equal(c.category,'music');
 assert.equal(c.modelLabel,'Music');
 assert.equal(c.confidence,.88);
 assert.equal(c.at,1234);
 assert.equal(c.durationMs,4200);
 assert.equal(c.source,'local-audioset-classifier');
 assert.equal(c.modelId,ENVIRONMENT_AUDIO_MODEL_ID);
 assert.equal(c.modelRevision,ENVIRONMENT_AUDIO_MODEL_REVISION);
 assert.equal(c.participantId,null);
 assert.equal(c.speakerAttribution,'none');
 assert.equal(c.exactMediaId,null);
 assert.match(environmentalClassificationMessage(c),/source not attributed to a participant/);
});

test('11F classifier queue is disabled by default, bounded and invalidated on consent removal',()=>{
 const q=new EnvironmentalAudioQueue({maxQueue:2,maxAgeMs:1000});
 assert.equal(q.snapshot().enabled,false);
 assert.equal(q.enqueue(segment(),100).accepted,false);

 q.enable(100);
 q.enqueue(segment(),200);
 q.enqueue(segment(),300);
 const third=q.enqueue(segment(),400);
 assert.equal(third.accepted,true);
 assert.equal(third.dropped.length,1);
 assert.equal(third.dropped[0].reason,'queue-overflow-oldest');
 assert.equal(q.snapshot().queueDepth,2);

 const next=q.beginNext(1401);
 assert.equal(next.work,null);
 assert.equal(next.dropped.length,2);
 assert.ok(next.dropped.every(x=>x.reason==='classification-deadline-exceeded'));

 q.enqueue(segment(),1500);
 const work=q.beginNext(1501).work;
 assert.equal(q.current(work,1502),true);
 q.disable();
 assert.equal(q.current(work,1503),false);
 assert.equal(q.snapshot().enabled,false);
});

test('11F repeated classifications are deduplicated without mutating the result',()=>{
 const tracker=new EnvironmentalClassificationTracker({cooldownMs:10000});
 const classification=normalizeEnvironmentalPredictions([
  {label:'Music',score:.9}
 ],{at:1000,durationMs:1000}).classification;
 assert.equal(tracker.observe(classification,1000).emit,true);
 assert.equal(tracker.observe(classification,5000).emit,false);
 assert.equal(tracker.observe(classification,11001).emit,true);
 const alarm=normalizeEnvironmentalPredictions([{label:'Siren',score:.92}],{at:12000}).classification;
 assert.equal(tracker.observe(alarm,12000).emit,true);
});

test('11F engine uses pinned local AudioSet classifier and never opens or uploads microphone media',()=>{
 const engine=fs.readFileSync('src/environmental-audio-engine.js','utf8');
 const config=fs.readFileSync('src/model-config.js','utf8');
 assert.match(engine,/pipeline\(\s*'audio-classification'/s);
 assert.match(engine,/ENVIRONMENT_AUDIO_MODEL_ID/);
 assert.match(engine,/ENVIRONMENT_AUDIO_MODEL_REVISION/);
 assert.match(engine,/dtype:'q8'/);
 assert.match(config,/Xenova\/ast-finetuned-audioset-10-10-0\.4593/);
 assert.match(config,/c38c0051164d7433ccb1341e5c60d38f30608ac9/);
 assert.doesNotMatch(engine,/getUserMedia|MediaRecorder|createMediaStreamSource|fetch\(/);
});

test('11F runtime reuses one room segment and bounds media evidence before the canonical conversation decision',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.equal((runtime.match(/new RoomAudioCapture\(/g)||[]).length,1);
 const start=runtime.indexOf('function onRoomAudioSegment(segment)');
 const end=runtime.indexOf('function transcriptParticipantName',start);
 const block=runtime.slice(start,end);
 assert.match(block,/const \{separationInput,\.\.\.environmentSegment\}=segment/);
 assert.match(block,/queueEnvironmentalAudio\(\{\s*\.\.\.environmentSegment,environmentCorrelationId:evidenceRequest\.id/s);
 assert.match(block,/environmentEvidencePromise:evidenceRequest\.promise/);
 assert.match(block,/listeningController\.enqueue/);
 assert.doesNotMatch(block,/await queueEnvironmentalAudio/);
 assert.match(runtime,/environmentalSpeechEvidenceWaiters/);
 assert.match(runtime,/\},900\)/);
 assert.match(runtime,/!\['ready','loading'\]\.includes\(environmentalAudioState\)\|\|document\.hidden/);
 assert.match(runtime,/environmentalAudioQueue\.disable\(\)/);
});

test('11F Basic ROOM classification is local, owner-controllable and carries no participant identity',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(html,/id="roomClassifyEnvironmentalAudio"/);
 assert.match(html,/Enabled by default as part of Basic ROOM/);
 assert.match(html,/Raw room audio is never saved or uploaded by Tracky2/);
 assert.match(html,/classifications are never assigned to a participant/i);
 assert.match(html,/local environmental classifier does not itself name songs, movies or TV programs/i);
 assert.match(html,/id="roomIdentifyMedia"/);
 assert.match(html,/id="roomIdentifyMediaWeb"/);
 assert.match(runtime,/environmentalAudioToggle\.checked=savedEnvironmental!=='no'/);
 assert.match(runtime,/tracky2-room-environmental-audio/);
 assert.match(runtime,/Owner disabled environmental audio classification/);
 const envStart=runtime.indexOf("environmentalV2Message(classification)");
 const envLog=runtime.slice(envStart,
  runtime.indexOf("}catch(error)",envStart));
 assert.ok(envStart>0);
 assert.match(envLog,/semantic:'environmental-audio-classification-v2'/);
 assert.doesNotMatch(envLog,/participantId/);
});

test('11F approved classification metadata may use ROOM opt-in persistence but raw PCM never enters ROOM events',()=>{
 const core=fs.readFileSync('src/environmental-audio-core.js','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/logRoomMessage\('audio',environmentalV2Message\(classification\)/);
 assert.match(runtime,/durationMs:classification\.durationMs/);
 assert.match(runtime,/environmental:\{/);
 assert.doesNotMatch(runtime,/saveRoomObservation\([^\n]*(samples|pcm|audio)/i);
 const messageBlock=core.slice(core.indexOf('export function environmentalClassificationMessage'),
  core.indexOf('export function createEnvironmentalAudioWork'));
 assert.doesNotMatch(messageBlock,/samples|Float32Array|pcm/i);
});

test('11F local environmental classifier never performs exact media ID; later providers stay separate and opt-in',()=>{
 const core=fs.readFileSync('src/environmental-audio-core.js','utf8');
 const providers=fs.readFileSync('server/providers.php','utf8');
 const runtime=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(core,/exactMediaId:null/);
 assert.doesNotMatch(core,/shazam|song title|movie title|acrcloud/i);
 assert.match(providers,/acrcloud/);
 assert.match(runtime,/id="roomIdentifyMusicFingerprint"/);
 assert.doesNotMatch(runtime,/id="roomIdentifyMusicFingerprint" checked/);
});

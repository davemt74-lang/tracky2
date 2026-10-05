import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 applyAttributionCorrection,attributionFromTurn,buildTurnAttribution,
 multiPersonAttributionTurnFields,scrubAttributionParticipant
} from '../src/multi-person-attribution-core.js';

const link=(clusterId,participantId,startOffsetMs,endOffsetMs,more={})=>({
 clusterId,participantId,state:participantId?'verified':'unknown',confidence:.9,
 startOffsetMs,endOffsetMs,provenance:['voice-cluster-continuity'],conflicts:[],...more
});

test('12D sequential diarized speakers become one canonical turn with ownership change intervals',()=>{
 const attribution=buildTurnAttribution({
  diarizationSpans:[
   {state:'speaker',speakerClusterId:'D1',startOffsetMs:0,endOffsetMs:1400,confidence:.9},
   {state:'speaker',speakerClusterId:'D2',startOffsetMs:1400,endOffsetMs:3000,confidence:.88}
  ],
  continuousFusionWindowLinks:[
   link('D1','p1',0,1400),link('D2','p2',1400,3000)
  ],
  turnDurationMs:3000
 });
 assert.equal(attribution.state,'multi-speaker');
 assert.equal(attribution.turnOwnership,'multi-speaker');
 assert.deepEqual(attribution.participantIds,['p1','p2']);
 assert.equal(attribution.ownershipChangeCount,1);
 assert.equal(attribution.intervals.length,2);
});

test('12D overlap remains unresolved but preserves bounded participant candidates',()=>{
 const attribution=buildTurnAttribution({
  diarizationSpans:[{
   state:'overlap-unresolved',candidateClusterIds:['D1','D2'],
   startOffsetMs:800,endOffsetMs:1800,confidence:.72
  }],
  continuousFusionWindowLinks:[
   link('D1','p1',600,1600),link('D2','p2',900,1900)
  ]
 });
 assert.equal(attribution.turnOwnership,'overlap');
 assert.equal(attribution.interruptionCount,1);
 assert.equal(attribution.intervals[0].state,'overlap');
 assert.deepEqual(attribution.intervals[0].candidateParticipantIds,['p1','p2']);
 assert.equal(attribution.intervals[0].participantId,null);
});

test('12D partial attribution keeps known interval identity without inventing unknown ownership',()=>{
 const attribution=buildTurnAttribution({
  diarizationSpans:[
   {state:'speaker',speakerClusterId:'D1',startOffsetMs:0,endOffsetMs:1200,confidence:.9},
   {state:'speaker',speakerClusterId:'D2',startOffsetMs:1200,endOffsetMs:2400,confidence:.7}
  ],
  continuousFusionWindowLinks:[link('D1','p1',0,1200),link('D2',null,1200,2400)]
 });
 assert.equal(attribution.state,'single-speaker-partial');
 assert.equal(attribution.partialAttribution,true);
 assert.equal(attribution.intervals[0].participantId,'p1');
 assert.equal(attribution.intervals[1].participantId,null);
});

test('12D owner speaker correction changes interval authority without pretending biometric verification',()=>{
 const attribution=buildTurnAttribution({
  diarizationSpans:[{state:'speaker',speakerClusterId:'D1',startOffsetMs:0,endOffsetMs:1200}],
  continuousFusionWindowLinks:[link('D1',null,0,1200)]
 });
 const corrected=applyAttributionCorrection(attribution,{
  intervalId:'attr-01',participantId:'p2',at:5000,note:'Owner identified speaker'
 });
 assert.equal(corrected.intervals[0].participantId,'p2');
 assert.equal(corrected.intervals[0].state,'owner-corrected');
 assert.equal(corrected.intervals[0].authority,'local-owner-correction');
 assert.equal(corrected.corrections[0].previousParticipantId,null);
 assert.equal(corrected.corrections[0].source,'local-owner');
});

test('12D owner can clear an incorrect interval assignment and original correction remains bounded',()=>{
 let attribution=buildTurnAttribution({
  diarizationSpans:[{state:'speaker',speakerClusterId:'D1',startOffsetMs:0,endOffsetMs:1200}],
  continuousFusionWindowLinks:[link('D1','p1',0,1200)]
 });
 attribution=applyAttributionCorrection(attribution,{intervalId:'attr-01',participantId:'p2',at:2000});
 attribution=applyAttributionCorrection(attribution,{intervalId:'attr-01',participantId:null,at:3000});
 assert.equal(attribution.intervals[0].participantId,null);
 assert.equal(attribution.intervals[0].state,'owner-cleared');
 assert.equal(attribution.corrections.length,2);
});

test('12D participant deletion removes interval, candidate and correction references',()=>{
 let attribution=buildTurnAttribution({
  diarizationSpans:[{state:'speaker',speakerClusterId:'D1',startOffsetMs:0,endOffsetMs:1200}],
  continuousFusionWindowLinks:[link('D1','p1',0,1200)]
 });
 attribution=applyAttributionCorrection(attribution,{intervalId:'attr-01',participantId:'p2',at:2000});
 const scrubbed=scrubAttributionParticipant(attribution,'p2');
 const json=JSON.stringify(scrubbed);
 assert.equal(json.includes('"p2"'),false);
 assert.equal(scrubbed.intervals[0].participantId,null);
});

test('12D canonical turn fields preserve single-turn provenance and bounded corrections',()=>{
 let attribution=buildTurnAttribution({
  diarizationSpans:[
   {state:'speaker',speakerClusterId:'D1',startOffsetMs:0,endOffsetMs:1000},
   {state:'overlap-unresolved',candidateClusterIds:['D1','D2'],startOffsetMs:1000,endOffsetMs:1600}
  ],
  continuousFusionWindowLinks:[link('D1','p1',0,1500),link('D2','p2',1000,1600)]
 });
 attribution=applyAttributionCorrection(attribution,{intervalId:'attr-02',participantId:'p2',at:2000});
 const fields=multiPersonAttributionTurnFields(attribution);
 assert.equal(fields.multiPersonAttributionSchema,1);
 assert.ok(fields.multiPersonAttributionIntervals.length<=16);
 assert.ok(fields.multiPersonAttributionCorrections.length<=10);
 assert.equal(attributionFromTurn(fields).intervals.length,2);
 const json=JSON.stringify(fields);
 for(const forbidden of ['embedding','samples','pcm','rawAudio','primaryPhoto'])
  assert.equal(json.includes(forbidden),false,forbidden);
});

test('12D runtime derives interval attribution from 12B/12C canonical evidence before persistence',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(runtime,/buildTurnAttribution\(\{/);
 assert.match(runtime,/multiPersonAttributionTurnFields\(/);
 assert.match(runtime,/\.\.\.multiPersonFields/);
 const build=runtime.indexOf('buildTurnAttribution({');
 const save=runtime.indexOf('savedTurn = await saveDialogueTurn');
 assert.ok(build>0&&save>build);
});

test('12D owner correction is transactional in the canonical dialogue store',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 assert.match(store,/export function reviseDialogueAttribution\(/);
 assert.match(store,/applyAttributionCorrection\(/);
 assert.match(store,/store\.put\(corrected\)/);
});

test('12D transcript export carries bounded attribution intervals and no media payload',()=>{
 const core=fs.readFileSync('src/transcript-lifecycle-core.js','utf8');
 assert.match(core,/multiPersonAttributionIntervals/);
 assert.match(core,/multiPersonAttributionCorrections/);
 const exportBlock=core.slice(core.indexOf('export function transcriptExport'));
 assert.doesNotMatch(exportBlock,/rawAudio|samples|pcm|primaryPhoto|latestPhoto/);
});

test('12D participant deletion scrubs multi-person interval attribution references',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const start=store.indexOf('export async function deleteParticipant(');
 const end=store.indexOf('export async function prunePendingCaptures',start);
 const block=store.slice(start,end);
 assert.match(block,/scrubAttributionParticipant/);
 assert.match(block,/multiPersonAttributionIntervals/);
});

test('12D AGENT exposes separate transcript wording and speaker attribution correction controls',()=>{
 const agent=fs.readFileSync('agent-mode.js','utf8');
 assert.match(agent,/Correct speaker attribution/);
 assert.match(agent,/editAttribution\(/);
 assert.match(agent,/Owner corrected speaker attribution/);
});

test('12D pure attribution core opens no sensor, persistence, media or network path',()=>{
 const core=fs.readFileSync('src/multi-person-attribution-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|indexedDB|localStorage|fetch\(|WebSocket/);
});

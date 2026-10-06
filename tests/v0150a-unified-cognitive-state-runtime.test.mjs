import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15A runtime builds one canonical cognitive state from existing subsystems',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/UnifiedCognitiveStateStore/);
 assert.match(runtime,/function updateUnifiedCognitiveState/);
 assert.match(runtime,/roomMediaContinuity\.snapshot\(\)/);
 assert.match(runtime,/taskUI\?\.getTasks/);
 assert.match(runtime,/workflowUI\?\.getWorkflows/);
 assert.match(runtime,/memoryUI\?\.getMemories/);
 assert.match(runtime,/meetingUI\?\.activeMeeting/);
 assert.match(runtime,/devicePerformanceGovernor\.snapshot\(\)/);
});

test('15A canonical state refreshes on room events and proactive cognition ticks',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/updateUnifiedCognitiveState\(accepted\.event\.at\|\|Date\.now\(\)\)/);
 assert.match(runtime,/updateUnifiedCognitiveState\(now\);/);
 assert.match(runtime,/settlePendingSituationalFeedback\(now\);/);
});

test('15A canonical state excludes raw audio/frame capture objects',()=>{
 const core=read('src/unified-cognitive-state-core.js');
 assert.doesNotMatch(core,/Float32Array|MediaStream|AudioBuffer|ImageData|getUserMedia|canvas/i);
 assert.match(core,/rawAudioStored:false,rawFramesStored:false/);
});

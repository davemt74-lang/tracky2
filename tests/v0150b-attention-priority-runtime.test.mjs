import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15B runtime attention consumes canonical state instead of raw subsystems',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/AttentionPriorityEngine/);
 const start=runtime.indexOf('function updatePrimaryAttention');
 const end=runtime.indexOf('function proactiveContext',start);
 const block=runtime.slice(start,end);
 assert.match(block,/cognitiveStateSnapshot\(now\)/);
 assert.match(block,/attentionPriorityEngine\.evaluate/);
 assert.doesNotMatch(block,/publicRoomTracks|roomMediaContinuity|taskUI|memoryUI/i);
});

test('15B current primary attention is observable in Control Center',()=>{
 const html=read('vertical-motion.html'),runtime=read('vertical-motion.js');
 assert.match(html,/id="agentAttentionStatus"/);
 assert.match(runtime,/Attention · none · monitoring/);
});

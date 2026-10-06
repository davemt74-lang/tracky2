import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('15H runtime certifies the unified A-G cognitive stack',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/V015AutonomyCertificationMonitor/);
 assert.match(runtime,/unifiedCognitiveState\.snapshot\(\)/);
 assert.match(runtime,/attentionPriorityEngine\.snapshot\(\)\.lastDecision/);
 assert.match(runtime,/goalIntentTracker\.snapshot\(\)/);
 assert.match(runtime,/cognitiveOrchestrator\.snapshot\(\)\.lastPlan/);
 assert.match(runtime,/cognitiveOutcomeLedger\.snapshot\(\)/);
 assert.match(runtime,/roomSituationalAwareness\.snapshot\(\)/);
});

test('15H live certification receives room, provider, fatigue, performance and resource evidence',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('participant-cycle'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('media-transition'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('conversation-over-media'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('provider-failure'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('provider-recovery'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('interruption'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('performance'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('resource-sample'/);
});

test('15H proactive acceptance rejection and appropriate silence feed certification coverage',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('proactive-accepted'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('proactive-rejected'/);
 assert.match(runtime,/v015AutonomyCertificationMonitor\.note\('silence-window'/);
});

test('15H restart evidence distinguishes clean lifecycle exit',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/tracky2-v015-cert-session-id/);
 assert.match(runtime,/tracky2-v015-clean-exit/);
 assert.match(runtime,/priorCleanExit==='1'/);
 assert.match(runtime,/window\.sessionStorage\.setItem\('tracky2-v015-clean-exit','1'\)/);
});

test('15H certification UI is visible in runtime health',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/id="v015AutonomyCertificationStatus"/);
 assert.match(html,/V0\.15 UNIFIED AUTONOMY|Collecting unified cognition evidence/);
});

test('15H certification core stores aggregate metrics only',()=>{
 const core=read('src/v015-autonomy-certification-core.js');
 assert.doesNotMatch(core,/Float32Array|MediaStream|AudioBuffer|ImageData|getUserMedia|transcript\s*:/i);
 assert.doesNotMatch(core,/fetch\(|WebSocket|XMLHttpRequest/);
});

test('15H architecture cores remain decision-only and governed research still requires confirmation',()=>{
 const orchestrator=read('src/cognitive-orchestrator-core.js');
 const attention=read('src/attention-priority-core.js');
 const provider=read('server/provider-api.php');
 assert.doesNotMatch(orchestrator,/fetch\(|window\.|document\.|localStorage|sessionStorage/i);
 assert.doesNotMatch(attention,/fetch\(|window\.|document\.|localStorage|sessionStorage/i);
 assert.match(provider,/Explicit owner confirmation is required for web research/);
});

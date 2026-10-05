import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14C workflow persistence is additive bounded metadata only',()=>{
 const store=read('src/participant-store.js');
 assert.match(store,/const DB_VERSION = 13/);
 assert.match(store,/const AGENT_WORKFLOWS = 'agent-workflows'/);
 assert.match(store,/MAX_PERSISTED_AGENT_WORKFLOWS = 80/);
 assert.match(store,/createObjectStore\(AGENT_WORKFLOWS,\{keyPath:'id'\}\)/);
 assert.match(store,/export async function saveAgentWorkflow/);
 const block=store.slice(store.indexOf('export async function saveAgentWorkflow'),
  store.indexOf('export function deleteAgentWorkflow'));
 assert.match(block,/policySnapshot/);assert.match(block,/idempotencyKey/);
 assert.match(block,/executionProvenance/);
 assert.doesNotMatch(block,/rawAudio|embedding|primaryPhoto|ciphertext|apiKey|secret|prompt|imageBase64|audioBase64|Blob|ArrayBuffer/);
});

test('14C UI exposes only bounded workflow presets and visible step progress',()=>{
 const ui=read('src/agent-workflow-ui.js'),html=read('vertical-motion.html');
 assert.match(html,/id="agentWorkflowPreset"/);
 assert.match(html,/value="local-inspect"/);
 assert.match(html,/value="server-research"/);
 assert.match(html,/id="agentWorkflowParticipant"/);
 assert.match(html,/id="agentWorkflowList"/);
 assert.match(ui,/workflowProgress/);
 assert.match(ui,/progress/);
 assert.match(ui,/Confirm workflow/);
 assert.match(ui,/Run next step · owner action/);
 assert.match(ui,/workflowDependencyState/);
 assert.match(ui,/invalidateWorkflow/);
 assert.match(ui,/retryInterruptedStep/);
 assert.doesNotMatch(html,/workflow.*(?:command|url|endpoint|shell)/i);
});

test('14C background execution remains read-only and side effects require fresh owner action',()=>{
 const ui=read('src/agent-workflow-ui.js'),core=read('src/agent-workflow-core.js');
 assert.match(ui,/runAutomatic/);
 assert.match(ui,/prepareWorkflowStep\(workflow,step\.id,\{ownerAction:false/);
 assert.match(core,/skill\.foregroundOwnerAction&&ownerAction!==true/);
 assert.match(core,/foreground-owner-action-required/);
 assert.match(core,/status:'awaiting-owner'/);
 assert.doesNotMatch(ui,/setInterval\(/);
});

test('14C participant and object dependencies are revalidated immediately before execution',()=>{
 const ui=read('src/agent-workflow-ui.js'),core=read('src/agent-workflow-core.js');
 assert.match(ui,/currentDependencies/);
 assert.match(ui,/participantIds:participantIds\(\)/);
 assert.match(ui,/refreshServerInventory/);
 assert.match(core,/target-deleted-or-unavailable/);
 assert.match(core,/participant-deleted-or-unavailable/);
 assert.match(core,/skill-authorization-revoked/);
 assert.match(core,/authorization-snapshot-stale/);
});

test('14C runtime wires workflow execution and preserves 14B local capture executor',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/createAgentWorkflowUi/);
 assert.match(runtime,/workflowUI=createAgentWorkflowUi/);
 assert.match(runtime,/workflowUI\?\.refresh/);
 assert.match(runtime,/workflowUI\?\.destroy/);
 const taskStart=runtime.indexOf('taskUI=createAgentTaskUi');
 const workflowStart=runtime.indexOf('workflowUI=createAgentWorkflowUi');
 assert.ok(taskStart>0&&workflowStart>taskStart);
 assert.match(runtime.slice(taskStart,workflowStart),/captureImage:captureGovernedSceneImage/);
 assert.match(runtime.slice(workflowStart,workflowStart+900),/captureImage:captureGovernedSceneImage/);
});

test('14C workflow core has no arbitrary execution or network implementation',()=>{
 const core=read('src/agent-workflow-core.js');
 assert.doesNotMatch(core,/\b(?:eval|Function|exec|spawn|shell|child_process)\s*\(/i);
 assert.doesNotMatch(core,/fetch\(|XMLHttpRequest|WebSocket|getUserMedia|MediaRecorder|indexedDB|localStorage/);
});

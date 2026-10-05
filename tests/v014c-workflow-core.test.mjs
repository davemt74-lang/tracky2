import test from 'node:test';import assert from 'node:assert/strict';
import {
 AGENT_WORKFLOW_CONTRACT,MAX_WORKFLOW_STEPS,createAgentWorkflow,workflowPreset,
 workflowPolicySnapshot,workflowDependencyState,readyWorkflowSteps,workflowProgress,
 confirmWorkflow,prepareWorkflowStep,completeWorkflowStep,requestWorkflowCancel,
 failWorkflowStep,restoreAgentWorkflow,retryInterruptedStep,classifyWorkflowError
} from '../src/agent-workflow-core.js';

const localTarget={id:'obj-local',name:'Monitor',kind:'device',targetSource:'local-owner-defined',
 approved:true,enabledSkills:['describe_object','capture_image'],area:{id:'desk',name:'Desk',rect:{x:.1,y:.1,width:.2,height:.2}}};
const serverTarget={id:'object_123',name:'Coffee maker',kind:'detected-object',targetSource:'server-approved',
 approved:true,enabledSkills:['describe_object','product_search']};

test('14C workflow policy snapshot is bounded and cannot gain later skill authority',()=>{
 const policy=workflowPolicySnapshot({target:serverTarget,participantId:'participant-1',createdAt:100});
 assert.equal(policy.contract,AGENT_WORKFLOW_CONTRACT);
 assert.deepEqual(policy.allowedSkills,['describe_object','product_search']);
 assert.throws(()=>createAgentWorkflow({target:serverTarget,steps:[
  {skillId:'capture_image'}
 ]}),/not included in the policy snapshot/);
});

test('14C presets create explicit dependency graphs with bounded step count',()=>{
 const local=workflowPreset('local-inspect',localTarget,{now:10});
 assert.equal(local.steps.length,2);assert.deepEqual(local.steps[1].dependsOn,['describe']);
 const server=workflowPreset('server-research',serverTarget,{now:10});
 assert.deepEqual(server.steps.map(s=>s.skillId),['describe_object','product_search']);
 assert.throws(()=>createAgentWorkflow({target:serverTarget,steps:Array.from({length:MAX_WORKFLOW_STEPS+1},()=>({skillId:'describe_object'}))}),/1-6 steps/);
 assert.throws(()=>createAgentWorkflow({target:serverTarget,steps:[
  {id:'a',skillId:'describe_object',dependsOn:['missing']}
 ]}),/earlier step/);
});

test('14C workflow executes dependency-ready read-only steps then pauses for foreground authority',()=>{
 let flow=confirmWorkflow(workflowPreset('server-research',serverTarget,{now:0}),1);
 assert.deepEqual(readyWorkflowSteps(flow).map(s=>s.id),['describe']);
 let prepared=prepareWorkflowStep(flow,'describe',{ownerAction:false,now:2});
 assert.equal(prepared.step.status,'running');flow=prepared.workflow;
 flow=completeWorkflowStep(flow,'describe',{summary:'metadata only'},3);
 assert.equal(workflowProgress(flow).done,1);
 prepared=prepareWorkflowStep(flow,'research',{ownerAction:false,now:4});
 assert.equal(prepared.reason,'foreground-owner-action-required');
 assert.equal(prepared.workflow.status,'awaiting-owner');
 prepared=prepareWorkflowStep({...prepared.workflow,status:'running'},'research',{ownerAction:true,now:5});
 assert.equal(prepared.step.status,'running');
});

test('14C current authorization and participant existence invalidate stale workflows',()=>{
 const flow=workflowPreset('server-research',serverTarget,{participantId:'p1',now:0});
 assert.equal(workflowDependencyState(flow,{target:serverTarget,participantIds:['p1']}).valid,true);
 assert.equal(workflowDependencyState(flow,{target:{...serverTarget,enabledSkills:['describe_object']},participantIds:['p1']}).reason,'skill-authorization-revoked');
 assert.equal(workflowDependencyState(flow,{target:null,participantIds:['p1']}).reason,'target-deleted-or-unavailable');
 assert.equal(workflowDependencyState(flow,{target:serverTarget,participantIds:[]}).reason,'participant-deleted-or-unavailable');
});

test('14C cancellation is authoritative between steps and never starts a pending next step',()=>{
 let flow=confirmWorkflow(workflowPreset('local-inspect',localTarget,{now:0}),1);
 let p=prepareWorkflowStep(flow,'describe',{now:2});flow=p.workflow;
 flow=requestWorkflowCancel(flow,3);
 assert.equal(flow.cancelRequested,true);
 flow=completeWorkflowStep(flow,'describe',{summary:'done'},4);
 assert.equal(flow.status,'cancelled');
 assert.equal(flow.steps.find(s=>s.id==='capture').status,'cancelled');
});

test('14C restart recovery never silently repeats an interrupted side-effect step',()=>{
 let flow=confirmWorkflow(workflowPreset('local-inspect',localTarget,{now:0}),1);
 let p=prepareWorkflowStep(flow,'describe',{now:2});flow=completeWorkflowStep(p.workflow,'describe',{summary:'done'},3);
 p=prepareWorkflowStep(flow,'capture',{ownerAction:true,now:4});flow=p.workflow;
 const restored=restoreAgentWorkflow(flow);
 assert.equal(restored.status,'paused');
 assert.equal(restored.recoveryRequired,true);
 assert.equal(restored.steps.find(s=>s.id==='capture').status,'needs-review');
 const retry=retryInterruptedStep(restored,'capture',6);
 assert.equal(retry.status,'running');
 assert.equal(retry.steps.find(s=>s.id==='capture').status,'pending');
});

test('14C per-step idempotency keys are stable and succeeded steps are not ready again',()=>{
 let flow=workflowPreset('server-research',serverTarget,{now:0});
 const key=flow.steps[0].idempotencyKey;
 const restored=restoreAgentWorkflow(flow);
 assert.equal(restored.steps[0].idempotencyKey,key);
 flow=confirmWorkflow(flow,1);const p=prepareWorkflowStep(flow,'describe',{now:2});
 flow=completeWorkflowStep(p.workflow,'describe',{summary:'done'},3);
 assert.equal(readyWorkflowSteps(flow).some(s=>s.id==='describe'),false);
});

test('14C retry classification separates transient owner-action authorization and terminal errors',()=>{
 assert.deepEqual(classifyWorkflowError({status:503,message:'down'}).class,'transient');
 assert.deepEqual(classifyWorkflowError({reason:'camera-not-active',message:'camera'}).class,'owner-action');
 assert.equal(classifyWorkflowError({reason:'skill-authorization-revoked',message:'revoked'}).invalidates,true);
 assert.equal(classifyWorkflowError(new Error('bad')).class,'terminal');
 let flow=confirmWorkflow(workflowPreset('server-research',serverTarget,{now:0}),1);
 const p=prepareWorkflowStep(flow,'describe',{now:2});
 flow=failWorkflowStep(p.workflow,'describe',Object.assign(new Error('temporary'),{status:503}),3);
 assert.equal(flow.status,'paused');assert.equal(flow.steps[0].status,'pending');
});

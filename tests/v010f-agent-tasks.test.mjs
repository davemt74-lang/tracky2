import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 AGENT_SKILLS,AgentTaskQueue,availableSkills,describeOwnerDefinedObject,
 executeRegisteredTask,normalizedTaskRecord,restoreTaskRecord
} from '../src/agent-task-core.js';

const scene={
 version:4,id:'local-room',
 areas:[{id:'desk',name:'Desk',kind:'desk',rect:{x:.1,y:.1,width:.4,height:.5},provenance:'owner-defined'}],
 objects:[{id:'monitor',name:'Monitor',kind:'device',areaId:'desk',
  skills:['describe_object','capture_image'],provenance:'owner-defined'}]
};

test('10F task registry IDs and confirmation boundary remain intact under later governed executors',()=>{
 assert.deepEqual(Object.keys(AGENT_SKILLS).sort(),['capture_image','describe_object','product_search']);
 assert.deepEqual(availableSkills().map(s=>s.id).sort(),['capture_image','describe_object','product_search']);
 assert.equal(AGENT_SKILLS.describe_object.confirmation,'required');
 assert.equal(AGENT_SKILLS.capture_image.sideEffect,'media-capture');
 assert.equal(AGENT_SKILLS.product_search.sideEffect,'external-network');
 const api=fs.readFileSync('server/api.php','utf8');
 for(const id of Object.keys(AGENT_SKILLS))assert.match(api,new RegExp("'"+id+"'"));
});

test('10F task creation remains pending confirmation and rejects incomplete or unknown skills',()=>{
 const now=100000;
 for(const skillId of ['describe_object','capture_image','product_search']){
  const task=normalizedTaskRecord({skillId,targetId:'monitor',runAt:now+60000},now);
  assert.equal(task.status,'pending-confirmation');
  assert.equal(task.attempts,0);
  assert.ok(Object.isFrozen(task));
 }
 assert.throws(()=>normalizedTaskRecord({skillId:'describe_object'},now),/Choose/);
 assert.throws(()=>normalizedTaskRecord({skillId:'arbitrary_shell',targetId:'monitor'},now),/Unknown skill/);
});

test('10F queue prevents equivalent active duplicates, requires confirmation and supports cancellation',()=>{
 const q=new AgentTaskQueue();
 const a=q.create({skillId:'describe_object',targetId:'monitor',runAt:120000},100000);
 assert.equal(a.created,true);
 const dup=q.create({skillId:'describe_object',targetId:'monitor',runAt:130000},100100);
 assert.equal(dup.created,false);
 assert.equal(dup.reason,'duplicate-active-task');
 assert.equal(q.due(999999).length,0,'unconfirmed task is never executable');
 const confirmed=q.confirm(a.task.id,110000);
 assert.equal(confirmed.status,'scheduled');
 assert.equal(q.due(119999).length,0);
 assert.equal(q.due(120000).length,1);
 const cancelled=q.cancel(a.task.id,115000);
 assert.equal(cancelled.status,'cancelled');
 assert.equal(q.due(999999).length,0);
 assert.equal(q.confirm(a.task.id,120000),null);
});

test('10F task execution state retains bounded retry and immutable terminal outcome',()=>{
 const q=new AgentTaskQueue({retryDelayMs:5000});
 const made=q.create({skillId:'describe_object',targetId:'monitor',runAt:0,maxAttempts:2},0).task;
 q.confirm(made.id,0);
 let running=q.start(made.id,0);
 assert.equal(running.status,'running');
 let retry=q.fail(made.id,new Error('temporary'),{retryable:true,now:1000});
 assert.equal(retry.status,'scheduled');
 assert.equal(retry.runAt,6000);
 assert.equal(retry.attempts,1);
 assert.equal(q.start(made.id,5999),null);
 running=q.start(made.id,6000);
 assert.equal(running.attempts,2);
 const failed=q.fail(made.id,new Error('again'),{retryable:true,now:7000});
 assert.equal(failed.status,'failed');
 assert.equal(failed.completedAt,7000);
 assert.equal(q.cancel(made.id,8000),null);
 assert.equal(q.succeed(made.id,'impossible',9000),null);
});

test('10F describe-object executor remains metadata-only with no visual identity claim',async()=>{
 const q=new AgentTaskQueue();
 const task=q.create({skillId:'describe_object',targetId:'monitor',runAt:0},0).task;
 q.confirm(task.id,0);
 const running=q.start(task.id,0);
 const result=await executeRegisteredTask(running,{scene});
 assert.match(result.summary,/Monitor/);
 assert.match(result.summary,/owner-defined device/);
 assert.match(result.summary,/Desk camera area/);
 assert.match(result.summary,/not visual recognition/);
 assert.equal(result.provenance.sideEffect,'read-only');
 const done=q.succeed(task.id,result,10,'action-event-1');
 assert.equal(done.status,'succeeded');
 assert.equal(done.relatedEventId,'action-event-1');
 assert.match(done.resultText,/owner-entered scene metadata/);
 assert.throws(()=>describeOwnerDefinedObject(scene,'missing'),/no longer exists/);
});

test('10F restore converts interrupted running state back to scheduled and migrates legacy target source',()=>{
 const valid=normalizedTaskRecord({id:'t1',skillId:'describe_object',targetId:'monitor',runAt:50,createdAt:10},10);
 const interrupted={...valid,status:'running',attempts:1,startedAt:40};
 const restored=restoreTaskRecord(interrupted);
 assert.equal(restored.status,'scheduled');
 assert.equal(restored.startedAt,null);
 const legacy=restoreTaskRecord({...valid,schema:1,targetSource:undefined});
 assert.equal(legacy.targetSource,'local-owner-defined');
 const governed=restoreTaskRecord({...valid,skillId:'capture_image'});
 assert.equal(governed.skillId,'capture_image');
 const q=new AgentTaskQueue();q.restore([interrupted,interrupted]);
 assert.equal(q.entries().length,1);assert.equal(q.entries()[0].status,'scheduled');
});

test('10F persistence remains bounded task metadata with no raw media credential or biometric payload',()=>{
 const store=fs.readFileSync('src/participant-store.js','utf8');
 const dbVersion=Number(store.match(/const DB_VERSION = (\d+)/)?.[1]);
 assert.ok(dbVersion>=5,'agent tasks require IndexedDB schema v5 or later');
 assert.match(store,/const AGENT_TASKS = 'agent-tasks'/);
 assert.match(store,/createObjectStore\(AGENT_TASKS,\{keyPath:'id'\}\)/);
 assert.match(store,/MAX_PERSISTED_AGENT_TASKS = 200/);
 assert.match(store,/resultText:String\(record\.resultText/);
 assert.match(store,/executionProvenance/);
 assert.doesNotMatch(store.slice(store.indexOf('export async function saveAgentTask')),
  /rawAudio|embedding|primaryPhoto|ciphertext|audioBase64|imageBase64/);
});

test('10F UI still requires explicit confirmation/cancellation and exposes no arbitrary command runtime',()=>{
 const ui=fs.readFileSync('src/agent-task-ui.js','utf8');
 const controller=fs.readFileSync('vertical-motion.js','utf8');
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const core=fs.readFileSync('src/agent-task-core.js','utf8');
 assert.match(ui,/queue\.confirm\(/);
 assert.match(ui,/queue\.cancel\(/);
 assert.match(ui,/semantic:'agent-task-action'/);
 assert.match(ui,/semantic:'agent-task-outcome'/);
 assert.match(ui,/timer=setInterval/);
 assert.match(ui,/sideEffect==='read-only'/);
 assert.match(controller,/createAgentTaskUi/);
 assert.match(controller,/taskUI\?\.refresh/);
 assert.match(html,/id="agentTaskForm"/);
 assert.match(html,/id="agentTaskList"/);
 assert.match(html,/Every executable task requires owner confirmation/);
 assert.doesNotMatch(core,/\b(?:eval|Function|exec|spawn|shell|child_process)\s*\(/i);
 assert.doesNotMatch(ui,/getUserMedia|MediaRecorder|new Function|eval\(/);
});

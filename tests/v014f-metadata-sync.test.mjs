import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {
 METADATA_SYNC_SCOPES,MAX_METADATA_SYNC_JOURNAL,defaultMetadataSyncState,journalForPlan,
 metadataChangeForServer,metadataLocalResource,metadataPayloadFingerprint,metadataStateAfterServerRecord,
 normalizeMetadataJournalEntry,planMetadataSync,sanitizeMetadataPayload
} from '../src/metadata-sync-core.js';

const memory=(more={})=>({schema:2,id:'m1',type:'preference',participantId:null,text:'Prefers dark mode',
 authority:'owner',provenance:'owner-authored',sourceRefs:[],createdAt:1,updatedAt:2,expiresAt:null,
 status:'active',revokedAt:null,revokeReason:'',revisions:[],persistent:true,...more});
const task=(more={})=>({schema:2,id:'task1',skillId:'describe_object',targetId:'monitor',
 targetSource:'local-owner-defined',idempotencyKey:'x',status:'succeeded',runAt:1,createdAt:1,
 updatedAt:2,attempts:1,maxAttempts:2,resultText:'done',resultSources:[],...more});
const server=(local,more={})=>({scope:local.scope,id:local.id,payload:local.payload,version:1,
 serverUpdatedAt:100,deleted:false,...more});

test('14F allowlists only memory task and scene metadata scopes',()=>{
 assert.deepEqual(METADATA_SYNC_SCOPES,['memory','task','scene']);
 assert.throws(()=>metadataLocalResource('dialogue',{id:'x'}),/Invalid metadata sync payload|Unsupported/);
 assert.throws(()=>metadataLocalResource('recording',{id:'x'}),/Invalid metadata sync payload|Unsupported/);
});

test('14F memory sync sanitizes owner-authorized bounded metadata only',()=>{
 const local=metadataLocalResource('memory',memory({secret:'no',rawAudio:'no'}));
 assert.equal(local.payload.text,'Prefers dark mode');
 assert.equal(local.payload.authority,'owner');
 assert.equal('secret' in local.payload,false);assert.equal('rawAudio' in local.payload,false);
 assert.throws(()=>metadataLocalResource('memory',{...memory(),authority:'agent'}),/owner-authorized/);
});

test('14F task sync sanitizes governed task metadata and excludes arbitrary payloads',()=>{
 const local=metadataLocalResource('task',task({prompt:'secret',command:'rm -rf'}));
 assert.equal(local.payload.skillId,'describe_object');
 assert.equal('prompt' in local.payload,false);assert.equal('command' in local.payload,false);
 assert.throws(()=>metadataLocalResource('task',{...task(),skillId:'shell'}),/Unsupported task skill/);
});

test('14F scene sync keeps owner configuration only with bounded areas objects and skills',()=>{
 const local=metadataLocalResource('scene',{id:'local-room',version:4,roomIdentityId:'room-a',roomName:'Office',
  areas:[{id:'desk',name:'Desk',kind:'desk',rect:{x:.1,y:.1,width:.3,height:.3}}],
  objects:[{id:'monitor',name:'Monitor',kind:'device',areaId:'desk',skills:['describe_object','shell']}],
  liveTracks:[{participantId:'p1'}],cameraFrame:'data'});
 assert.equal(local.id,'local-room');assert.equal(local.payload.objects[0].skills[0],'describe_object');
 assert.equal('liveTracks' in local.payload,false);assert.equal('cameraFrame' in local.payload,false);
});

test('14F reconciliation is opt-in versioned conflict-safe and tombstone aware',()=>{
 const local=metadataLocalResource('memory',memory());
 let state=defaultMetadataSyncState('memory','m1');
 assert.equal(planMetadataSync({local,server:null,state}).action,'disabled');
 state={...state,enabled:true};
 assert.equal(planMetadataSync({local,server:null,state}).action,'push-upsert');
 const remote=server(local);
 assert.equal(planMetadataSync({local,server:remote,state}).action,'conflict');
 state=metadataStateAfterServerRecord(state,remote,local,200);
 assert.equal(planMetadataSync({local,server:remote,state}).action,'none');
 const edited=metadataLocalResource('memory',memory({updatedAt:3,text:'Prefers light mode'}));
 assert.equal(planMetadataSync({local:edited,server:remote,state}).action,'push-upsert');
 assert.equal(planMetadataSync({local:null,server:remote,state}).action,'push-delete');
 assert.equal(planMetadataSync({local,server:{...remote,version:2},state}).action,'pull-server');
 assert.equal(planMetadataSync({local:edited,server:{...remote,version:2},state}).action,'conflict');
});

test('14F server changes require an authorized device and contain one allowlisted resource only',()=>{
 const local=metadataLocalResource('task',task());
 const state={...defaultMetadataSyncState('task','task1'),enabled:true};
 assert.throws(()=>metadataChangeForServer('push-upsert',{local,state}),/device/);
 const change=metadataChangeForServer('push-upsert',{local,state,deviceId:'device-12345678'});
 assert.equal(change.scope,'task');assert.equal(change.operation,'upsert');
 assert.ok(change.payload);assert.equal('dialogueTurns' in change,false);assert.equal('recordingMedia' in change,false);
});

test('14F journal stores resumable reconciliation metadata without resource payload',()=>{
 const local=metadataLocalResource('memory',memory());
 const state={...defaultMetadataSyncState('memory','m1'),enabled:true};
 const plan=planMetadataSync({local,server:null,state});
 const entry=journalForPlan(plan,{scope:'memory',id:'m1',state,now:50});
 assert.equal(entry.operation,'upsert');assert.equal(entry.baseVersion,0);
 assert.equal('payload' in entry,false);assert.equal('text' in entry,false);
 assert.ok(MAX_METADATA_SYNC_JOURNAL<=200);
 const restored=normalizeMetadataJournalEntry(entry);assert.equal(restored.key,'memory:m1');
});

test('14F fingerprints are deterministic and change only with sanitized content',()=>{
 const a=sanitizeMetadataPayload('memory',memory()),b=sanitizeMetadataPayload('memory',{...memory(),secret:'x'});
 assert.equal(metadataPayloadFingerprint(a),metadataPayloadFingerprint(b));
 assert.notEqual(metadataPayloadFingerprint(a),metadataPayloadFingerprint(sanitizeMetadataPayload('memory',memory({text:'Other'}))));
});

test('14F core has no transport persistence transcript recording or biometric authority',()=>{
 const code=fs.readFileSync('src/metadata-sync-core.js','utf8');
 assert.doesNotMatch(code,/fetch\(|indexedDB|localStorage|sessionStorage|getUserMedia|MediaRecorder/);
 assert.doesNotMatch(code,/dialogueTurns|recordingMedia|rawAudio|faceEmbedding|voiceEmbedding/);
});

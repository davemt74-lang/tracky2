import test from 'node:test';import assert from 'node:assert/strict';
import {
 accountSyncDecision,mergeServerParticipant,normalizeAccountParticipantState,
 participantHasLocalBiometrics,participantServerProfile,stateAfterServerRecord
} from '../src/account-participant-core.js';

test('account participant projection excludes biometrics until explicit consent',()=>{
 const p={nickname:'Dave',notes:'test',primaryPhoto:'data:image/png;base64,x',
  embeddings:[[1,2]],voiceEmbeddings:[[3,4]],agentProactiveEnabled:true};
 let out=participantServerProfile(p,false);
 assert.equal(out.nickname,'Dave');assert.equal(out.notes,'test');
 assert.equal('primaryPhoto' in out,false);assert.equal('embeddings' in out,false);
 out=participantServerProfile(p,true);
 assert.equal(out.primaryPhoto,p.primaryPhoto);assert.deepEqual(out.embeddings,[[1,2]]);
 assert.equal(participantHasLocalBiometrics(p),true);
});

test('server ordinary profile merges without erasing local biometrics when consent is off',()=>{
 const local={id:'p1',name:'Old',primaryPhoto:'photo',embeddings:[[1]],voiceEmbeddings:[[2]]};
 const server={id:'p1',name:'New',profile:{nickname:'N',notes:'updated'},version:3,biometricConsent:false};
 const merged=mergeServerParticipant(local,server);
 assert.equal(merged.name,'New');assert.equal(merged.nickname,'N');
 assert.equal(merged.primaryPhoto,'photo');assert.deepEqual(merged.embeddings,[[1]]);
 assert.equal(merged.accountBiometricSyncEnabled,false);
});

test('server biometric profile replaces local biometric fields only with explicit consent',()=>{
 const local={id:'p1',name:'Old',primaryPhoto:'old',embeddings:[[1]]};
 const server={id:'p1',name:'New',profile:{primaryPhoto:'new',embeddings:[[9]]},version:3,biometricConsent:true};
 const merged=mergeServerParticipant(local,server);
 assert.equal(merged.primaryPhoto,'new');assert.deepEqual(merged.embeddings,[[9]]);
 assert.equal(merged.accountBiometricSyncEnabled,true);
});

test('pending local edit never overwrites unseen server version automatically',()=>{
 const state=normalizeAccountParticipantState({participantId:'p1',serverVersion:2,pending:true});
 assert.equal(accountSyncDecision({local:{id:'p1'},server:{id:'p1',version:3},state}).action,'conflict');
 assert.equal(accountSyncDecision({local:{id:'p1'},server:{id:'p1',version:2},state}).action,'push-local');
});

test('server is authoritative when local cache has no pending edit',()=>{
 const state=normalizeAccountParticipantState({participantId:'p1',serverVersion:2,pending:false});
 assert.equal(accountSyncDecision({local:{id:'p1'},server:{id:'p1',version:3},state}).action,'pull-server');
 const next=stateAfterServerRecord(state,{id:'p1',version:3,serverUpdatedAt:55},{updatedAt:'x'},100);
 assert.equal(next.serverVersion,3);assert.equal(next.pending,false);assert.equal(next.lastSyncedLocalUpdatedAt,'x');
});

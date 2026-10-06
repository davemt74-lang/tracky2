import test from 'node:test';
import assert from 'node:assert/strict';
import {
  participantStorageRecoveryReason,
  persistParticipantRecord,
  emergencyParticipantRecord
} from '../src/participant-store.js';

test('participant persistence survives primary and recovery IndexedDB InternalError',async()=>{
  const record={
    id:'p-test',name:'Test Participant',updatedAt:'2026-10-06T22:10:00.000Z',
    embeddings:[[.1,.2,.3],[.2,.3,.4],[.3,.4,.5]],
    faceSamples:[
      {photo:'data:image/jpeg;base64,AAAA',poseId:'front',quality:.9},
      {photo:'data:image/jpeg;base64,BBBB',poseId:'left',quality:.9},
      {photo:'data:image/jpeg;base64,CCCC',poseId:'right',quality:.9}
    ],
    primaryPhoto:'data:image/jpeg;base64,AAAA',
    latestPhoto:'data:image/jpeg;base64,CCCC'
  };
  const primaryError=Object.assign(new Error('Internal error.'),{name:'InternalError'});
  const recoveryError=Object.assign(new Error('Internal error.'),{name:'InternalError'});
  const result=await persistParticipantRecord(record,{
    primarySave:async()=>{throw primaryError;},
    recoverySave:async()=>{throw recoveryError;},
    emergencySave:async value=>emergencyParticipantRecord(value)
  });
  assert.equal(result.tier,'emergency-local-storage');
  assert.equal(result.record.id,'p-test');
  assert.equal(result.record.name,'Test Participant');
  assert.equal(result.record.embeddings.length,3);
  assert.equal(result.record.primaryPhoto,null);
  assert.equal(result.record.latestPhoto,null);
  assert.equal(result.record.faceSamples.every(sample=>sample.photo===null),true);
});

test('non-recoverable persistence errors still surface instead of being hidden',async()=>{
  const quota=Object.assign(new Error('Quota exceeded'),{name:'QuotaExceededError'});
  await assert.rejects(
    persistParticipantRecord({id:'p1'},{
      primarySave:async()=>{throw quota;},
      recoverySave:async()=>{throw new Error('should not run');},
      emergencySave:async()=>{throw new Error('should not run');}
    }),
    error=>error===quota
  );
});

test('participant InternalError classifier includes browser backing-store failures',()=>{
  assert.equal(participantStorageRecoveryReason({name:'InternalError',message:'Internal error.'}),true);
  assert.equal(participantStorageRecoveryReason({name:'UnknownError',message:'backing store failed'}),true);
});

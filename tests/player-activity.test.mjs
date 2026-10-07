import test from 'node:test';
import assert from 'node:assert/strict';
import {activityEvent,addActivity,MAX_ACTIVITY_ITEMS,presentParticipants} from '../src/player-activity.js';

test('transient detection never creates public participant activity',()=>{
 assert.equal(activityEvent({participantId:null,name:'Unknown',kind:'present',at:100}),null);
 assert.equal(presentParticipants([{status:'body-detected'},{participantId:'d',status:'matched'}]).length,1);
});

test('bounded participant activity timeline rejects adjacent duplicate presence events',()=>{
 const evt=activityEvent({participantId:'d',name:'Dave',kind:'present',detail:'Camera match',at:1200});
 const dup=activityEvent({participantId:'d',name:'Dave',kind:'present',detail:'Camera match',at:1250});
 let history=addActivity([],evt);history=addActivity(history,dup);
 assert.equal(history.length,1);
 for(let i=0;i<60;i++)history=addActivity(history,activityEvent({
  participantId:'d',name:'Dave',kind:i%2?'arrived':'departed',detail:'Presence '+i,at:2000+i*1300
 }));
 assert.equal(history.length,MAX_ACTIVITY_ITEMS);
});

test('retired gameplay actions are rejected from participant activity',()=>{
 for(const kind of ['zone','rep','target','hit','point','round','complete'])
  assert.equal(activityEvent({participantId:'d',name:'Dave',kind,detail:'retired',at:500}),null);
 const present=activityEvent({participantId:'d',name:'Dave',kind:'present',at:700,source:'confirmed-tracking'});
 assert.equal(present.source,'confirmed-tracking');
 assert.equal(activityEvent({participantId:'d',name:'Dave',kind:'noise',at:100}),null);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {activityEvent,addActivity,MAX_ACTIVITY_ITEMS,presentParticipants} from '../src/player-activity.js';
test('transient detection never creates public participant activity',()=>{
 assert.equal(activityEvent({participantId:null,name:'Unknown',kind:'present',at:100}),null);
 assert.equal(presentParticipants([{status:'body-detected'},{participantId:'d',status:'matched'}]).length,1);
});
test('bounded meaningful activity timeline rejects adjacent duplicate frame events',()=>{
 const evt=activityEvent({participantId:'d',name:'Dave',kind:'zone',detail:'Zone 2',at:1200});
 const dup=activityEvent({participantId:'d',name:'Dave',kind:'zone',detail:'Zone 2',at:1250});
 let history=addActivity([],evt);history=addActivity(history,dup);
 assert.equal(history.length,1);
 for(let i=0;i<60;i++)history=addActivity(history,activityEvent({
 participantId:'d',name:'Dave',kind:'rep',detail:'Rep '+i,at:2000+i*1300}));
 assert.equal(history.length,MAX_ACTIVITY_ITEMS);
 assert.equal(history[0].detail,'Rep 24');
});
test('game assignment is clearly distinguished from biometrically confirmed room presence',()=>{
 const a=activityEvent({participantId:'d',name:'Dave',kind:'hit',detail:'340 ms',at:500});
 const b=activityEvent({participantId:'d',name:'Dave',kind:'present',at:700,source:'confirmed-tracking'});
 assert.equal(a.source,'assigned-player');assert.equal(b.source,'confirmed-tracking');
 assert.equal(activityEvent({participantId:'d',name:'Dave',kind:'noise',at:100}),null);
});

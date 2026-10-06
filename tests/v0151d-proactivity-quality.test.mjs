import test from 'node:test';
import assert from 'node:assert/strict';
import {ProactivityQualityTracker,adaptiveProactivityPolicy} from '../src/proactivity-quality-core.js';

test('15.1D dismissal lowers interruption budget and blocks same-topic repeat',()=>{
 const t=new ProactivityQualityTracker();
 t.note({participantId:'p1',topicKey:'tv:x',semanticKey:'m:x',outcome:'dismissed'},1000);
 const p=t.policy({participantId:'p1',topicKey:'tv:x',semanticKey:'m:x',now:2000,baseMaxInterruptionsPerHour:3});
 assert.equal(p.maxInterruptionsPerHour,2);
 assert.equal(p.repeatBlocked,true);
});

test('15.1D repeated nonresponse teaches silence',()=>{
 const t=new ProactivityQualityTracker();
 t.note({participantId:'p1',topicKey:'music:x',outcome:'ignored'},1000);
 t.note({participantId:'p1',topicKey:'music:x',outcome:'ignored'},2000);
 const d=t.shouldSpeak({participantId:'p1',topicKey:'music:x',interestingness:.95,now:3000});
 assert.equal(d.allow,false);
 assert.equal(d.reason,'repeated-nonresponse');
});

test('15.1D positive engagement can cautiously raise budget',()=>{
 const h=Array.from({length:4},(_,i)=>({participantId:'p1',topicKey:'x',outcome:'positive',at:1000+i}));
 const p=adaptiveProactivityPolicy({participantId:'p1',topicKey:'x',history:h,now:2000,baseMaxInterruptionsPerHour:3});
 assert.equal(p.maxInterruptionsPerHour,4);
});

test('15.1D correct silence raises future threshold',()=>{
 const t=new ProactivityQualityTracker();
 for(let i=0;i<3;i++)t.note({participantId:'p1',outcome:'silence-correct'},1000+i);
 const d=t.shouldSpeak({participantId:'p1',interestingness:.58,now:3000});
 assert.equal(d.allow,false);
 assert.equal(d.reason,'adaptive-silence-threshold');
});

test('15.1D wrong silence can relax suppression',()=>{
 const t=new ProactivityQualityTracker();
 for(let i=0;i<3;i++)t.note({participantId:'p1',outcome:'silence-wrong'},1000+i);
 const d=t.shouldSpeak({participantId:'p1',interestingness:.62,now:3000});
 assert.equal(d.allow,true);
});

test('15.1D history is bounded metadata only',()=>{
 const t=new ProactivityQualityTracker({maxEntries:24});
 for(let i=0;i<60;i++)t.note({participantId:'p1',topicKey:'x:'+i,outcome:'neutral'},i);
 assert.equal(t.snapshot().count,24);
 const json=JSON.stringify(t.snapshot());
 for(const bad of ['rawAudio','embedding','transcript','photo','samples'])assert.equal(json.includes(bad),false);
});

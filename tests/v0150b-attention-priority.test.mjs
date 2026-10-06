import test from 'node:test';
import assert from 'node:assert/strict';
import {attentionCandidatesFromState,selectPrimaryAttention,AttentionPriorityEngine} from '../src/attention-priority-core.js';

const base=()=>({
 visibleParticipantIds:['p1'],speakerParticipantIds:[],conversation:{userSpeaking:false,lastDialogueAt:0},
 media:{status:'active',kind:'television',continuityId:'c1',lastAt:100000,identity:{title:'Show',confidence:.95}},
 events:[],tasks:[],conflicts:[],agent:{busy:false},meeting:null,followThrough:null
});

test('15B direct user speech outranks background media',()=>{
 const s=base();s.speakerParticipantIds=['p1'];s.conversation.userSpeaking=true;s.conversation.lastDialogueAt=100000;
 const d=selectPrimaryAttention(s,{now:100500});
 assert.equal(d.primary.type,'direct-user');
});

test('15B important event can preempt ordinary contextual media',()=>{
 const s=base();s.events=[{id:'e1',at:100000,semantic:'environmental-alert',category:'alert',salience:.95,confidence:.9,freshness:'fresh'}];
 const d=selectPrimaryAttention(s,{now:100500});
 assert.equal(d.primary.type,'important-event');
});

test('15B active work outranks passive observation',()=>{
 const s=base();s.media={status:'idle'};s.tasks=[{id:'t1',kind:'research',status:'running',requiresOwnerAction:false}];
 s.events=[{id:'e1',at:100000,semantic:'participant-observed',salience:.4,confidence:.9,freshness:'fresh'}];
 const d=selectPrimaryAttention(s,{now:100500});
 assert.equal(d.primary.type,'active-work');
});

test('15B meeting suppresses contextual opportunity but not important event',()=>{
 const s=base();s.meeting={status:'active'};
 let d=selectPrimaryAttention(s,{now:100500});
 assert.equal(d.primary,null);
 s.events=[{id:'e1',at:100000,semantic:'environmental-alert',category:'alert',salience:.95,confidence:.95,freshness:'fresh'}];
 d=selectPrimaryAttention(s,{now:100500});
 assert.equal(d.primary.type,'important-event');
});

test('15B repeated same source decays attention score',()=>{
 const s=base();s.media={status:'idle'};
 const candidates=attentionCandidatesFromState({...s,events:[{id:'e1',at:100000,semantic:'routine-deviation',salience:.6,confidence:.8,freshness:'fresh'}]},100500);
 const first=selectPrimaryAttention(s,{candidates,history:[],now:100500});
 const history=Array.from({length:3},(_,i)=>({sourceId:'e1',at:100000+i}));
 const later=selectPrimaryAttention(s,{candidates,history,now:100500});
 assert.ok((later.candidates[0]?.score||0)<(first.candidates[0]?.score||0));
});

test('15B nothing worthy is a valid primary state',()=>{
 const s=base();s.media={status:'idle'};
 const d=selectPrimaryAttention(s,{now:100500});
 assert.equal(d.primary,null);
 assert.equal(d.reason,'no-attention-worthy-target');
});

test('15B engine history stays bounded',()=>{
 const engine=new AttentionPriorityEngine({maxHistory:12});
 const state=base();state.speakerParticipantIds=['p1'];state.conversation.userSpeaking=true;state.conversation.lastDialogueAt=1000;
 for(let i=0;i<30;i++){const d=engine.evaluate(state,{now:1000+i});engine.record(d,{acted:true,at:1000+i});}
 assert.equal(engine.snapshot().recent.length,12);
});

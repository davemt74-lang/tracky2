import test from 'node:test';
import assert from 'node:assert/strict';
import {proactiveConversationDisposition,ConversationProactivityEngine} from '../src/conversation-proactivity-core.js';

const state=()=>({
 participants:[{id:'p1',visible:true,stationaryMs:70000}],
 conversation:{userSpeaking:false,processing:false,lastDialogueAt:100000},
 agent:{speaking:false},meeting:null
});
const candidate={participantId:'p1',topicKey:'tv:show',mediaKind:'television'};

test('15E available participant can receive contextual mention now',()=>{
 const d=proactiveConversationDisposition({state:state(),candidate,now:140000});
 assert.equal(d.disposition,'mention-now');
});

test('15E active conversation and active goals defer proactivity',()=>{
 let s=state();s.conversation.userSpeaking=true;
 assert.equal(proactiveConversationDisposition({state:s,candidate,now:140000}).disposition,'defer');
 s=state();
 assert.equal(proactiveConversationDisposition({state:s,candidate,goal:{state:'active'},now:140000}).disposition,'defer');
});

test('15E recent dismissal or repeated ignore suppresses same topic',()=>{
 const history=[{participantId:'p1',topicKey:'tv:show',outcome:'dismissed',at:130000}];
 assert.equal(proactiveConversationDisposition({state:state(),candidate,history,now:140000}).disposition,'ignore');
 const ignored=[
  {participantId:'p1',topicKey:'tv:show',outcome:'ignored',at:120000},
  {participantId:'p1',topicKey:'tv:show',outcome:'ignored',at:130000}
 ];
 assert.equal(proactiveConversationDisposition({state:state(),candidate,history:ignored,now:140000}).disposition,'ignore');
});

test('15E active same-topic thread continues naturally',()=>{
 const thread={participantId:'p1',topicKey:'tv:show',status:'open',lastAt:139000};
 const d=proactiveConversationDisposition({state:state(),candidate,thread,now:140000});
 assert.equal(d.disposition,'continue-thread');
});

test('15E different recent topic defers rather than abruptly changing subject',()=>{
 const thread={participantId:'p1',topicKey:'music:other',status:'open',lastAt:139000};
 const d=proactiveConversationDisposition({state:state(),candidate,thread,now:140000});
 assert.equal(d.disposition,'defer');
});

test('15E engine bounds deferred opportunities and closes thread after topic change',()=>{
 const e=new ConversationProactivityEngine({maxDeferred:5});
 let s=state();s.participants[0].visible=false;
 for(let i=0;i<10;i++)e.evaluate({state:s,candidate:{...candidate,topicKey:'x:'+i},now:1000+i});
 assert.ok(e.deferred.length<=5);
 s=state();e.evaluate({state:s,candidate,now:140000});
 e.noteOutcome({participantId:'p1',topicKey:'tv:show',outcome:'topic-changed',at:141000});
 assert.equal(e.snapshot(141000).thread.status,'closed');
});

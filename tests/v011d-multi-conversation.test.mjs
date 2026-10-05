import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 resolveConversationAddress,conversationScopeId,multiConversationTurnFields,
 multiParticipantReplyPolicy,groupConversationContext,agentHistoryForScope,
 conversationContextLabel
} from '../src/multi-conversation-core.js';
import {appendAgentHistory,loadAgentHistory,saveAgentHistory} from '../src/agent-conversation.js';
import {buildAgentMessages} from '../src/agent-provider.js';

const people=[
 {id:'p1',name:'Pat',nickname:'P'},
 {id:'p2',name:'Sam'},
 {id:'p3',name:'Lee'}
];
const baseTurn=(more={})=>({
 id:'t-current',sessionId:'s1',participantId:'p1',participantName:'Pat',
 attribution:'voice+body',associationState:'verified-voice+face-body',
 transcript:'hello',nearbyParticipantIds:['p2'],...more
});

test('11D explicit addressee detection requires a vocative/tag, not a casual name mention',()=>{
 let a=resolveConversationAddress('Sam, can you check this?',people);
 assert.equal(a.kind,'participant');
 assert.equal(a.addressedParticipantId,'p2');
 assert.equal(a.addressedAgent,false);

 a=resolveConversationAddress('I spoke with Sam about this',people);
 assert.equal(a.kind,'unspecified');
 assert.equal(a.addressedParticipantId,null);

 a=resolveConversationAddress('Agent, can you help us?',people);
 assert.equal(a.kind,'agent');
 assert.equal(a.addressedAgent,true);

 a=resolveConversationAddress('What do you think, Tracky?',people);
 assert.equal(a.addressedAgent,true);
 a=resolveConversationAddress('What do you think, Sam',people);
 assert.equal(a.addressedParticipantId,null,'trailing names require explicit punctuation');
 a=resolveConversationAddress('What do you think, Sam?',people);
 assert.equal(a.addressedParticipantId,'p2');

 a=resolveConversationAddress('@Sam @Lee please compare notes',people);
 assert.equal(a.kind,'participants');
 assert.deepEqual([...a.addressedParticipantIds].sort(),['p2','p3']);
});

test('11D conversation scope is stable across member ordering and distinguishes visitors',()=>{
 const a=conversationScopeId({speakerParticipantId:'p1',participantIds:['p2','p1'],groupSize:2});
 const b=conversationScopeId({speakerParticipantId:'p1',participantIds:['p1','p2'],groupSize:2});
 assert.equal(a,b);
 assert.equal(a,'scope:p:p1|p:p2');
 assert.notEqual(a,conversationScopeId({speakerParticipantId:'p1',participantIds:['p2'],visitorIds:['v1'],groupSize:3}));
});

test('11D two-person turn separates speaker ownership from addressed participant',()=>{
 const fields=multiConversationTurnFields(baseTurn({transcript:'Sam, what do you think?'}),{
  visibleParticipants:[people[0],people[1]],groupSize:2
 });
 assert.equal(fields.turnOwnership,'verified-speaker');
 assert.equal(fields.conversationGroupSize,2);
 assert.deepEqual([...fields.conversationParticipantIds].sort(),['p1','p2']);
 assert.equal(fields.addressedParticipantId,'p2');
 assert.equal(fields.addressedAgent,false);
 assert.equal(fields.attentionTarget,'participant');
 assert.equal(fields.overlapState,'not-observed');
 assert.equal(conversationContextLabel(fields),'PARTICIPANT ADDRESSED');
});

test('11D AGENT responds in a group only when explicitly addressed',()=>{
 const side=multiConversationTurnFields(baseTurn({transcript:'Sam, can you check this?'}),{
  visibleParticipants:[people[0],people[1]],groupSize:2
 });
 assert.deepEqual(multiParticipantReplyPolicy(side),{
  allow:false,reason:'abstain: turn explicitly addressed to participant'
 });

 const general=multiConversationTurnFields(baseTurn({transcript:'That looks good to me.'}),{
  visibleParticipants:[people[0],people[1]],groupSize:2
 });
 assert.equal(multiParticipantReplyPolicy(general).allow,false);
 assert.match(multiParticipantReplyPolicy(general).reason,/multi-party/);

 const agent=multiConversationTurnFields(baseTurn({transcript:'Agent, summarize that.'}),{
  visibleParticipants:[people[0],people[1]],groupSize:2
 });
 assert.equal(agent.addressedAgent,true);
 assert.deepEqual(multiParticipantReplyPolicy(agent),{
  allow:true,reason:'engage: AGENT explicitly addressed'
 });
});

test('11D ambiguous multi-person voice is unresolved ownership, not invented overlap',()=>{
 const turn={
  id:'amb',sessionId:'s1',participantId:null,attribution:'unknown',
  associationState:'ambiguous-voice',transcript:'Agent, can you hear me?',
  nearbyParticipantIds:[]
 };
 const fields=multiConversationTurnFields(turn,{
  visibleParticipants:[people[0],people[1]],groupSize:2
 });
 assert.equal(fields.turnOwnership,'ambiguous-speaker');
 assert.equal(fields.overlapState,'not-observed');
 assert.equal(fields.attentionTarget,'unresolved-speaker');
 assert.equal(fields.conversationParticipantIds.length,2);
 const policy=multiParticipantReplyPolicy(fields);
 assert.equal(policy.allow,false,
  'explicit AGENT address cannot override ambiguous ownership in a multi-person room');
 assert.match(policy.reason,/ambiguous speaker/);
 assert.equal(conversationContextLabel(fields),'AMBIGUOUS SPEAKER · GROUP');
});

test('11D explicit external overlap evidence always forces abstention',()=>{
 const fields=multiConversationTurnFields(baseTurn({
  transcript:'Agent, answer me',overlapEvidence:true
 }),{visibleParticipants:[people[0],people[1]],groupSize:2});
 assert.equal(fields.overlapState,'overlap-observed');
 assert.equal(fields.attentionTarget,'unresolved-overlap');
 assert.equal(multiParticipantReplyPolicy(fields).allow,false);
});

test('11D three-person group context includes only current group members and labels verified speakers',()=>{
 const current={
  ...baseTurn({id:'now',transcript:'Agent, what did we decide?',nearbyParticipantIds:['p2']}),
  conversationParticipantIds:['p1','p2'],conversationVisitorIds:[],
  conversationScopeId:'scope:p:p1|p:p2',conversationGroupSize:2
 };
 const turns=[
  {id:'a',sessionId:'s1',participantId:'p1',participantName:'Pat',attribution:'voice-only',
   transcript:'First Pat turn',createdAt:'2026-10-04T10:00:00Z',conversationScopeId:'scope:p:p1|p:p2'},
  {id:'b',sessionId:'s1',participantId:'p2',participantName:'Sam',attribution:'voice-only',
   transcript:'Sam reply',createdAt:'2026-10-04T10:00:02Z',conversationScopeId:'scope:p:p1|p:p2'},
  {id:'solo',sessionId:'s1',participantId:'p1',participantName:'Pat',attribution:'voice-only',
   transcript:'Private solo Pat turn',createdAt:'2026-10-04T10:00:02.500Z',conversationScopeId:'scope:p:p1'},
  {id:'c',sessionId:'s1',participantId:'p3',participantName:'Lee',attribution:'voice-only',
   transcript:'Outside group',createdAt:'2026-10-04T10:00:03Z',conversationScopeId:'scope:p:p1|p:p3'},
  {id:'u',sessionId:'s1',participantId:null,attribution:'unknown',
   transcript:'Unknown in same group',createdAt:'2026-10-04T10:00:04Z',conversationScopeId:'scope:p:p1|p:p2'},
  {id:'old',sessionId:'s0',participantId:'p1',attribution:'voice-only',
   transcript:'Other session',createdAt:'2026-10-04T09:00:00Z',conversationScopeId:'scope:p:p1|p:p2'}
 ];
 const ctx=groupConversationContext(current,turns,people);
 assert.deepEqual(ctx.map(x=>x.text),['First Pat turn','Sam reply','Unknown in same group']);
 assert.deepEqual(ctx.map(x=>x.speakerName),['P','Sam','Unknown speaker']);
 assert.equal(ctx.some(x=>x.text==='Private solo Pat turn'),false,
  'solo participant context must not leak into a multi-person scope');
 assert.equal(ctx.some(x=>x.text==='Outside group'),false);
 assert.equal(ctx.some(x=>x.text==='Other session'),false);
});

test('11D unverified speaker without known conversation scope receives no prior participant context',()=>{
 const current={
  id:'u2',sessionId:'s1',participantId:null,attribution:'unknown',
  transcript:'hello',conversationParticipantIds:[],conversationVisitorIds:[],
  conversationScopeId:'scope:unknown-solo',conversationGroupSize:1
 };
 const prior=[{id:'u1',sessionId:'s1',participantId:null,attribution:'unknown',
  transcript:'another unknown person',conversationScopeId:'scope:unknown-solo'}];
 assert.deepEqual(groupConversationContext(current,prior,people),[]);
});

test('11D AGENT history is scoped by canonical conversation membership',()=>{
 let history=[];
 history=appendAgentHistory(history,{role:'agent',text:'solo Pat',participantId:'p1',
  scopeId:'scope:p:p1',at:1});
 history=appendAgentHistory(history,{role:'agent',text:'Pat and Sam',participantId:'p1',
  scopeId:'scope:p:p1|p:p2',at:2});
 history=appendAgentHistory(history,{role:'agent',text:'Lee',participantId:'p3',
  scopeId:'scope:p:p3',at:3});
 const scoped=agentHistoryForScope(history,{
  participantId:'p1',conversationGroupSize:2,conversationScopeId:'scope:p:p1|p:p2'
 });
 assert.deepEqual(scoped.map(x=>x.text),['Pat and Sam']);
 const solo=agentHistoryForScope(history,{
  participantId:'p1',conversationGroupSize:1,conversationScopeId:'scope:p:p1'
 });
 assert.deepEqual(solo.map(x=>x.text),['solo Pat']);
});

test('11D anonymous group scopes never reuse saved AGENT history across unknown people',()=>{
 const history=[
  {role:'agent',text:'reply to an earlier unknown pair',scopeId:'scope:unknown-group-2',at:1},
  {role:'agent',text:'known Pat group',participantId:'p1',scopeId:'scope:p:p1|p:p2',at:2}
 ];
 const unknown=agentHistoryForScope(history,{
  participantId:null,conversationGroupSize:2,conversationScopeId:'scope:unknown-group-2'
 });
 assert.deepEqual(unknown,[]);
});

test('11D saved AGENT history retains bounded scope metadata',()=>{
 const data=new Map(),storage={
  getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)
 };
 const items=appendAgentHistory([],{role:'agent',text:'hello',participantId:'p1',
  scopeId:'scope:p:p1|p:p2',at:100});
 assert.equal(saveAgentHistory(storage,items,true),true);
 const loaded=loadAgentHistory(storage);
 assert.equal(loaded[0].scopeId,'scope:p:p1|p:p2');
 assert.equal(loaded[0].participantId,'p1');
});

test('11D local model context labels group speakers and binds memory to current verified speaker only',()=>{
 const messages=buildAgentMessages([
  {role:'participant',text:'I prefer tea',speakerName:'Sam'},
  {role:'agent',text:'Noted'}
 ],'Agent, what should I do?','Pat',
 ['Historical owner memory [preference]: Pat prefers coffee'],
 {conversationGroupSize:2,attentionTarget:'agent',addressedAgent:true});
 assert.match(messages[0].content,/belongs ONLY to the current verified speaker/);
 assert.match(messages[0].content,/2 persons in scope/);
 assert.match(messages[0].content,/AGENT explicitly addressed: yes/);
 assert.equal(messages[1].content,'[Sam] I prefer tea');
 assert.equal(messages.at(-1).content,'Agent, what should I do?');
});

test('11D runtime applies group attention before pending-reply supersession and loads memory only for speaker',()=>{
 const agent=fs.readFileSync('agent-mode.js','utf8');
 const group=agent.indexOf('const groupPolicy=multiParticipantReplyPolicy(turn)');
 const replace=agent.indexOf("policy.action==='replace-pending-reply'",group);
 assert.ok(group>0&&replace>group,'group attention must be evaluated before replacing pending reply');
 assert.match(agent,/Pending AGENT reply cancelled · attention moved to room conversation/);
 assert.match(agent,/getMemories\(preliminaryReasoning\.speakerParticipantId\)/);
 assert.doesNotMatch(agent,/getMemories\(turn\.addressedParticipantId\)/);
 assert.match(agent,/groupConversationContext\(turn,getDialogueTurns\(\),people\)/);
 assert.match(agent,/agentHistoryForScope\(entries,turn\)/);
 assert.match(agent,/say\(reply,turn\.participantId\|\|null,turn\.conversationScopeId\|\|null\)/);
});

test('11D runtime persists conversation fields before canonical save and exposes ROOM attention state',()=>{
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 const fields=runtime.indexOf('const conversationFields=multiConversationTurnFields(turn');
 const save=runtime.indexOf('savedTurn = await saveDialogueTurn',fields);
 assert.ok(fields>0&&save>fields);
 assert.match(runtime,/turn=\{\.\.\.turn,\.\.\.conversationFields,/);
 assert.match(runtime,/currentConversationAttention=turn\.attentionTarget/);
 assert.match(runtime,/currentConversationGroupSize=turn\.conversationGroupSize/);
 assert.match(runtime,/conversationContextLabel\(turn\)/);
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(html,/id="roomConversationAttention"/);
 assert.match(html,/id="roomConversationGroupSize"/);
});

test('11D core never treats proximity as speaker identity or opens a media/network path',()=>{
 const core=fs.readFileSync('src/multi-conversation-core.js','utf8');
 assert.doesNotMatch(core,/getUserMedia|MediaRecorder|AudioContext|fetch\(|embedding\(|transcribe\(|transcribeDetailed|bestVoiceMatch/);
 assert.match(core,/never opens sensors/i);
 assert.match(core,/infers addressees from camera proximity alone/i);
 assert.match(core,/scope\.startsWith\('scope:unknown-'\)/);
 assert.doesNotMatch(core,/possible-overlap-unresolved/);
});

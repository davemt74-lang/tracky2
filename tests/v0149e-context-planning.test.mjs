import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomContextPlanner,contextualActionPlan,contextualPlanPrompt} from '../src/room-context-planning-core.js';

const candidate=(kind='music')=>({
 eligible:true,participantId:'p1',topicKey:kind+':x',mediaKind:kind,
 mediaIdentity:{kind,title:'Title',artist:kind==='music'?'Artist':null,series:kind==='television'?'Series':null}
});
const decision=(score=.8,positive=2,negative=0,recurrence=.1)=>({
 interesting:true,score,profile:{positive,negative,recurrence}
});

test('14.9E music context can prefer conversation or recommendation over generic speech',()=>{
 const p=contextualActionPlan(candidate('music'),decision());
 assert.notEqual(p.action,'silence');
 assert.ok(['conversation','recommendation','research','explanation','follow-up'].includes(p.action));
});

test('14.9E high negative feedback and recurrence can produce silence',()=>{
 const p=contextualActionPlan(candidate('television'),decision(.6,0,6,1));
 assert.equal(p.action,'silence');
});

test('14.9E recent same action is diversified',()=>{
 const c=candidate('music');
 const first=contextualActionPlan(c,decision(),{recentPlans:[]});
 const second=contextualActionPlan(c,decision(),{recentPlans:[{topicKey:c.topicKey,action:first.action,at:1000}],now:2000});
 assert.notEqual(second.ranked[0].action,first.action);
});

test('14.9E dialogue topic shift increases likelihood of silence',()=>{
 const c=candidate('music');
 const a=contextualActionPlan(c,decision(.62,0,1,.5),{recentDialogueTopicShift:false});
 const b=contextualActionPlan(c,decision(.62,0,1,.5),{recentDialogueTopicShift:true});
 const silenceA=a.ranked.find(x=>x.action==='silence').score;
 const silenceB=b.ranked.find(x=>x.action==='silence').score;
 assert.ok(silenceB>silenceA);
});

test('14.9E planner records bounded action history',()=>{
 const p=new RoomContextPlanner({maxHistory:12});
 const c=candidate('music'),d=decision();
 for(let i=0;i<30;i++){
  const plan=p.plan(c,d,{});
  p.record(plan,{executed:i%2===0,at:i});
 }
 assert.equal(p.snapshot().recent.length,12);
});

test('14.9E prompt carries action guidance but no hardcoded media example',()=>{
 const c=candidate('music'),p=contextualActionPlan(c,decision());
 const prompt=contextualPlanPrompt(p,c,{adaptive:{interestScore:.8}});
 assert.match(prompt,/Higher-order proactive plan:/);
 assert.match(prompt,/"title":"Title"/);
 assert.doesNotMatch(prompt,/The Outpost|Eyes of the World|Grateful Dead|Greatful Dead/i);
 assert.doesNotMatch(prompt,/confidence score|surveillance system/i);
});


test('14.9E action outcomes adapt future planning style',()=>{
 const p=new RoomContextPlanner();
 const c=candidate('music'),d=decision(.78,1,0,.1);
 const initial=p.plan(c,d,{now:1000});
 const target=initial.action==='recommendation'?'research':'recommendation';
 for(let i=0;i<6;i++)p.noteFeedback({action:target,mediaKind:'music',topicKey:c.topicKey},{outcome:'expanded',at:2000+i});
 for(let i=0;i<6;i++)p.noteFeedback({action:initial.action,mediaKind:'music',topicKey:c.topicKey},{outcome:'dismissed',at:3000+i});
 const later=p.plan(c,d,{now:5000});
 assert.notEqual(later.action,initial.action);
 assert.equal(later.ranked[0].action,target);
});

test('14.9E action feedback remains bounded',()=>{
 const p=new RoomContextPlanner({maxFeedback:12});
 for(let i=0;i<30;i++)p.noteFeedback({action:'conversation',mediaKind:'music',topicKey:'x'},{outcome:'positive',at:i});
 assert.equal(p.snapshot().recentFeedback.length,12);
});

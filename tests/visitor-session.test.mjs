import test from 'node:test';import assert from 'node:assert/strict';
import {createVisitorSession,reconcileVisitors,eligibleVisitor,visibleVisitors,
 visitorForTrack,visitorDisplayName,upgradeVisitorTimeline,associateVisitorTurn,
 promoteVisitorTurn} from '../src/visitor-session.js';
const body=(id,patch={})=>({id,firstSeenAt:0,lastBodySeenAt:2000,
 bodyObservations:4,bodyScore:.91,quality:.65,face:{box:{x:0,y:0,width:1,height:1}},...patch});
test('background ghosts and one-frame detections never create numbered visitors',()=>{
 const session=createVisitorSession('test');
 for(const track of [body('T1',{bodyObservations:1}),body('T2',{firstSeenAt:1850}),
   body('T3',{bodyScore:.2,quality:.1,face:null}),body('T4',{lastBodySeenAt:-2000})])
   assert.equal(reconcileVisitors(session,[track],2000).length,0);
 assert.equal(session.next,1);
});
test('stable unknown becomes Visitor 1, repeated scans never invent Visitors 2..N',()=>{
 const session=createVisitorSession('test'),track=body('T005');
 assert.equal(eligibleVisitor(track,2000),true);
 const first=reconcileVisitors(session,[track],2000);
 assert.equal(first.length,1);assert.equal(first[0].visitor.label,'Visitor 1');
 assert.equal(reconcileVisitors(session,[{...track,lastBodySeenAt:2100}],2200).length,0);
 assert.equal(visibleVisitors(session,[track],2200).length,1);
 assert.equal(session.next,2);
});
test('event history follows same persistent visitor on reliable enrollment match',()=>{
 const session=createVisitorSession('test'),track=body('T011');
 const visitor=reconcileVisitors(session,[track],2000)[0].visitor;
 let turn=associateVisitorTurn({id:'turn1',participantId:null,transcript:'Hello'},visitor);
 assert.equal(turn.visitorId,visitor.id);assert.equal(turn.participantId,null);
 const match={id:'d',name:'Dave'};
 const promotion=reconcileVisitors(session,[{...track,participantId:'d',participantName:'Dave'}],2300);
 assert.equal(promotion[0].type,'promoted');
 assert.equal(visibleVisitors(session,[track],2400).length,0);
 assert.equal(visitorDisplayName(session,visitor.id),'Dave (formerly Visitor 1)');
 turn=promoteVisitorTurn(turn,visitor,match);
 assert.equal(turn.participantId,null); // never invent positive voice identification
 assert.equal(turn.visitorMatchId,'d');
 assert.equal(turn.speakerAssociation,'nearby-identified-person-unverified');
 const activity=upgradeVisitorTimeline([{participantId:visitor.id,name:visitor.label,
  kind:'present',at:1000,detail:''}],visitor.id,match);
 assert.equal(activity[0].participantId,'d');
 assert.equal(activity[0].source,'visitor-observation');
});
test('multiple different stable tracks have unique visitor labels without overwriting existing records',()=>{
 const session=createVisitorSession('test');
 const a=reconcileVisitors(session,[body('T1'),body('T2')],2000);
 assert.deepEqual(a.map(e=>e.visitor.label),['Visitor 1','Visitor 2']);
 assert.equal(visitorForTrack(session,'T1').id,'visitor-test-1');
 assert.equal(visitorForTrack(session,'T2').id,'visitor-test-2');
});

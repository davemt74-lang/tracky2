import test from 'node:test';
import assert from 'node:assert/strict';
import { playerPresenceEvidence } from '../src/player-presence.js';
const now=10000;
const t=(id,changes={})=>({
  participantId:id,status:'matched',box:{x:.2,y:.2,width:.3,height:.7},
  lastSeenAt:9800,lastBodySeenAt:9800,lastFaceSeenAt:9900,...changes
});
test('face/body/occlusion states require current evidence',()=>{
 assert.equal(playerPresenceEvidence('a',[t('a')],null,now).presence,'face-observed');
 assert.equal(playerPresenceEvidence('a',[t('a',{lastFaceSeenAt:100})],null,now).presence,'body-tracked');
 assert.equal(playerPresenceEvidence('a',[t('a',{status:'occluded',lastBodySeenAt:8000,lastFaceSeenAt:8000})],null,now).presence,'temporarily-occluded');
 assert.equal(playerPresenceEvidence('a',[],null,now).presence,'not-visible');
 assert.equal(playerPresenceEvidence('a',[t('a',{lastBodySeenAt:100,lastFaceSeenAt:100,lastSeenAt:100})],null,now).presence,'not-visible');
});
test('marker proximity is advisory and does not replace participant assignment',()=>{
 const own=t('a'),marker={x:.3,y:.45};
 const result=playerPresenceEvidence('a',[own],marker,now,true);
 assert.equal(result.marker,'near-assigned-body');
 assert.equal(result.voiceReady,true);
 assert.equal(playerPresenceEvidence('a',[own,t('b',{box:{x:.2,y:.2,width:.3,height:.7}})],marker,now).marker,'ambiguous-proximity');
 assert.equal(playerPresenceEvidence('a',[own],{x:.95,y:.95},now).marker,'unverified');
});
test('missing, stale and malformed marker evidence never claims a holder',()=>{
 assert.equal(playerPresenceEvidence('a',[t('a',{status:'occluded'})],{x:.3,y:.4},now).marker,'unverified');
 assert.equal(playerPresenceEvidence('a',[t('a')],{x:NaN,y:4},now).marker,'unverified');
 assert.deepEqual(playerPresenceEvidence('',[t('a')],null,now,true),{
   presence:'not-assigned',marker:'unverified',voiceReady:false
 });
});
test('all returned status objects omit biometric and image data',()=>{
 const res=playerPresenceEvidence('a',[{...t('a'),embedding:[.1,.2],photo:'private'}],{x:.5,y:.3},now,false);
 assert.equal(JSON.stringify(res).includes('private'),false);
 assert.equal(Object.isFrozen(res),true);
});

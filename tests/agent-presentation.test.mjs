import test from 'node:test';import assert from 'node:assert/strict';
import {AGENT_VIEWS,normalizeAgentView,nextAgentTab,orbPresentation} from '../src/agent-presentation.js';
test('camera and orb are presentation variants, never separate camera engines',()=>{
 assert.deepEqual(AGENT_VIEWS,['camera','orb']);
 assert.equal(normalizeAgentView('invalid'),'camera');
 assert.deepEqual(orbPresentation({view:'orb',speaking:true}),{orb:true,videoVisible:false,orbSpeaking:true});
 assert.equal(orbPresentation({view:'camera',speaking:true}).orbSpeaking,false);
});
test('all three sidebar tabs support direct click and keyboard cycling',()=>{
 assert.equal(nextAgentTab('dialogue','agent'),'agent');
 assert.equal(nextAgentTab('agent','ArrowRight'),'dialogue');
 assert.equal(nextAgentTab('dialogue','ArrowLeft'),'agent');
 assert.equal(nextAgentTab('activity','Home'),'dialogue');
 assert.equal(nextAgentTab('dialogue','End'),'agent');
});

import test from 'node:test';import assert from 'node:assert/strict';
import {
 GOVERNED_SKILLS,GOVERNED_SKILL_CONTRACT,normalizeEnabledSkills,localSkillTarget,
 normalizeServerSkillTarget,skillExecutionPolicy,nonReadOnlyScheduleAllowed,
 executionProvenance,boundedWebSources
} from '../src/governed-skill-core.js';

const scene={areas:[{id:'area-1',name:'Desk',rect:{x:.1,y:.2,width:.3,height:.4}}],
 objects:[{id:'obj-1',name:'Monitor',kind:'device',areaId:'area-1',
 skills:['describe_object','capture_image']}]};

test('14B local owner-defined objects carry explicit per-object grants',()=>{
 const target=localSkillTarget(scene,'obj-1');
 assert.equal(target.approved,true);assert.deepEqual(target.enabledSkills,['describe_object','capture_image']);
 assert.equal(skillExecutionPolicy({skillId:'describe_object',target}).allow,true);
 assert.equal(skillExecutionPolicy({skillId:'product_search',target,explicitOwnerAction:true}).reason,'target-source-not-allowed');
});
test('14B media capture requires foreground owner action visible page camera and mapped area',()=>{
 const target=localSkillTarget(scene,'obj-1');
 assert.equal(skillExecutionPolicy({skillId:'capture_image',target,cameraActive:true}).reason,'foreground-owner-action-required');
 assert.equal(skillExecutionPolicy({skillId:'capture_image',target,explicitOwnerAction:true,cameraActive:false}).reason,'camera-not-active');
 assert.equal(skillExecutionPolicy({skillId:'capture_image',target,explicitOwnerAction:true,cameraActive:true,documentVisible:false}).reason,'page-not-visible');
 assert.equal(skillExecutionPolicy({skillId:'capture_image',target,explicitOwnerAction:true,cameraActive:true,documentVisible:true}).allow,true);
 assert.equal(nonReadOnlyScheduleAllowed('capture_image',Date.now()+60000,Date.now()),false);
});
test('14B server targets require approval and skill grant',()=>{
 const denied=normalizeServerSkillTarget({id:'server-1',label:'Coffee maker',status:'proposed',skills:['product_search']});
 assert.equal(skillExecutionPolicy({skillId:'product_search',target:denied,explicitOwnerAction:true}).reason,'object-approval-required');
 const target=normalizeServerSkillTarget({id:'server-1',label:'Coffee maker',status:'approved',skills:['product_search']});
 assert.equal(skillExecutionPolicy({skillId:'product_search',target,explicitOwnerAction:true}).allow,true);
});
test('14B execution provenance is bounded and excludes arbitrary payloads',()=>{
 const target=localSkillTarget(scene,'obj-1');
 const p=executionProvenance({skillId:'capture_image',target,mediaBytes:1234,mediaWidth:800,mediaHeight:600});
 assert.equal(p.contract,GOVERNED_SKILL_CONTRACT);assert.equal(p.sideEffect,'media-capture');
 assert.equal('image' in p,false);assert.equal('prompt' in p,false);
});
test('14B external sources keep at most five unique HTTPS references',()=>{
 const sources=boundedWebSources([
  {url:'https://example.com/a',title:'A'},{url:'http://bad.test',title:'bad'},
  {url:'https://example.com/a',title:'duplicate'},
  ...Array.from({length:9},(_,i)=>({url:'https://example.com/'+i,title:'T'+i}))
 ]);
 assert.equal(sources.length,5);assert.equal(sources.every(x=>x.url.startsWith('https://')),true);
});
test('14B all governed skills remain narrow capability classes',()=>{
 assert.deepEqual(Object.keys(GOVERNED_SKILLS),['describe_object','capture_image','product_search']);
 assert.deepEqual(new Set(Object.values(GOVERNED_SKILLS).map(s=>s.sideEffect)),
  new Set(['read-only','media-capture','external-network']));
 assert.deepEqual(normalizeEnabledSkills(['describe_object','shell','capture_image']),
  ['describe_object','capture_image']);
});

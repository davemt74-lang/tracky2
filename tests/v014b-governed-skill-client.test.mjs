import test from 'node:test';import assert from 'node:assert/strict';
import {loadServerSkillTargets,executeServerProductSearch} from '../src/governed-skill-client.js';

test('14B server target inventory combines approved objects with enabled skills',async()=>{
 const fetcher=async url=>{
  if(String(url).includes('resource=objects'))return {ok:true,status:200,json:async()=>({records:[
   {id:'object_123',scene_id:'scene_123',label:'Coffee maker',status:'approved',bbox_json:'[0.1,0.2,0.3,0.4]'},
   {id:'object_999',scene_id:'scene_123',label:'Unapproved',status:'proposed',bbox_json:null}
  ]})};
  return {ok:true,status:200,json:async()=>({records:[
   {object_id:'object_123',skill:'product_search',enabled:1},
   {object_id:'object_123',skill:'describe_object',enabled:1}
  ]})};
 };
 const result=await loadServerSkillTargets({fetcher});
 assert.equal(result.available,true);assert.equal(result.targets.length,1);
 assert.deepEqual(result.targets[0].enabledSkills,['product_search','describe_object']);
});

test('14B product search browser request sends only approved object id and fixed skill',async()=>{
 const calls=[];
 const fetcher=async(url,opts={})=>{
  calls.push({url,opts});
  if(String(url).endsWith('/session.php'))return {ok:true,status:200,json:async()=>({
   authenticated:true,csrf:'csrf-123',permissions:['skills.execute']
  })};
  return {ok:true,status:200,json:async()=>({
   summary:'Current options',sources:[{title:'A',url:'https://shop.example/a'}],
   provider:'openai',model:'gpt-6-luna',budget:{daily:{requestsRemaining:9}}
  })};
 };
 const result=await executeServerProductSearch({objectId:'object_123',fetcher});
 const body=JSON.parse(calls[1].opts.body);
 assert.deepEqual(body,{skill:'product_search',objectId:'object_123'});
 assert.equal('query' in body,false);assert.equal('url' in body,false);
 assert.equal(calls[1].opts.headers['X-CSRF-Token'],'csrf-123');
 assert.equal(result.sources[0].url,'https://shop.example/a');
});

test('14B inventory degrades cleanly when self-hosted scene permission is unavailable',async()=>{
 const result=await loadServerSkillTargets({fetcher:async()=>({ok:false,status:403,json:async()=>({error:'Permission denied.'})})});
 assert.equal(result.available,false);assert.deepEqual(result.targets,[]);
});

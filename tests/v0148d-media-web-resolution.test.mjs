import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchMediaByClues} from '../src/media-identification-client.js';

function jsonResponse(body,status=200){
 return new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json'}
 });
}

test('V2C media client requires owner opt-in before any network request',async()=>{
 let calls=0;
 await assert.rejects(searchMediaByClues({
  dialogueQuery:'we need to get out of here before they find us',
  ownerEnabled:false,fetcher:async()=>{calls++;return jsonResponse({});}
 }),/not enabled/);
 assert.equal(calls,0);
});

test('V2C client sends bounded text clues and provider preference without raw audio or image data',async()=>{
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});
  if(String(url).includes('session.php'))
   return jsonResponse({csrf:'csrf-token',permissions:['providers.use']});
  return jsonResponse({
   found:true,kind:'episode',title:'Example Episode',series:'Example Series',
   season:2,episode:3,year:2024,service:'Example Stream',confidence:.88,
   provider:'anthropic-web-search',model:'claude-sonnet-4-6',evidenceId:'seg-1',
   sources:[{url:'https://example.com/show',title:'Show page'}]
  });
 };
 const result=await searchMediaByClues({
  dialogueQuery:'we need to get out of here before they find us',
  visualClue:'Example Stream Example Series',
  mediaKind:'television',evidenceId:'seg-1',ownerEnabled:true,
  preferredProvider:'anthropic',fetcher
 });
 assert.equal(result.found,true);
 assert.equal(result.candidate.kind,'episode');
 assert.equal(result.candidate.series,'Example Series');
 assert.equal(result.candidate.source,'visual');
 assert.deepEqual(result.candidate.sourceUrls,['https://example.com/show']);
 const body=JSON.parse(calls[1].options.body);
 assert.deepEqual(Object.keys(body).sort(),[
  'action','dialogueQuery','evidenceId','mediaKind','ownerEnabled',
  'preferredProvider','visualClue'
 ].sort());
 assert.equal(body.preferredProvider,'anthropic');
 for(const forbidden of ['samples','audio','image','frame','canvas','photo'])
  assert.equal(forbidden in body,false);
});

test('V2C media client requires provider permission',async()=>{
 await assert.rejects(searchMediaByClues({
  dialogueQuery:'we need to get out of here before they find us',
  ownerEnabled:true,fetcher:async()=>jsonResponse({csrf:'x',permissions:[]})
 }),/Provider use permission required/);
});

test('V2C server uses shared configured OpenAI/Anthropic routing and bounded web search',()=>{
 const php=fs.readFileSync('server/media-id-api.php','utf8');
 assert.match(php,/tracky_require\(\$db,'providers\.use'\)/);
 assert.match(php,/tracky_check_csrf\(\)/);
 assert.match(php,/tracky_chat_provider_plan\(\$db,\$preferred\)/);
 assert.match(php,/https:\/\/api\.openai\.com\/v1\/responses/);
 assert.match(php,/https:\/\/api\.anthropic\.com\/v1\/messages/);
 assert.match(php,/'type'=>'web_search'/);
 assert.match(php,/'type'=>'web_search_20250305'/);
 assert.match(php,/stop_reason.*pause_turn/s);
 assert.match(php,/Do not reproduce dialogue, subtitles, scripts, or copyrighted passages/);
 assert.match(php,/provider\.media-id-search/);
 assert.doesNotMatch(php,/tracky_provider_audit\([^;]*\$dialogue/s);
 assert.doesNotMatch(php,/tracky_provider_audit\([^;]*\$visual/s);
});

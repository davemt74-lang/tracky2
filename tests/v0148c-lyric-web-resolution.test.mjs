import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchMusicByLyricClue} from '../src/music-identification-client.js';

function jsonResponse(body,status=200){
 return new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json'}
 });
}

test('V2B3 lyric client requires owner opt-in before any network request',async()=>{
 let calls=0;
 await assert.rejects(
  searchMusicByLyricClue({
   query:'hello darkness my old friend',ownerEnabled:false,
   fetcher:async()=>{calls++;return jsonResponse({});}
  }),
  /not enabled/
 );
 assert.equal(calls,0);
});

test('V2B3 lyric client sends only bounded clue metadata to governed server endpoint',async()=>{
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});
  if(String(url).includes('session.php'))
   return jsonResponse({csrf:'csrf-token',permissions:['providers.use']});
  return jsonResponse({
   found:true,title:'The Sound of Silence',artist:'Simon & Garfunkel',
   album:'Sounds of Silence',confidence:.91,provider:'openai-web-search',
   model:'gpt-6-luna',evidenceId:'segment-1',
   sources:[{url:'https://example.com/song',title:'Song page'}]
  });
 };
 const result=await searchMusicByLyricClue({
  query:'hello darkness my old friend',
  evidenceId:'segment-1',ownerEnabled:true,fetcher
 });
 assert.equal(result.found,true);
 assert.equal(result.candidate.source,'lyrics');
 assert.equal(result.candidate.evidenceId,'segment-1');
 assert.deepEqual(result.candidate.sourceUrls,['https://example.com/song']);
 assert.equal(calls.length,2);
 const body=JSON.parse(calls[1].options.body);
 assert.deepEqual(Object.keys(body).sort(),
  ['action','evidenceId','ownerEnabled','query'].sort());
 assert.equal(body.action,'lyric_search');
 assert.equal(body.ownerEnabled,true);
 assert.equal('samples' in body,false);
 assert.equal('audio' in body,false);
});

test('V2B3 lyric client requires provider permission from authenticated session',async()=>{
 const fetcher=async()=>jsonResponse({csrf:'x',permissions:[]});
 await assert.rejects(searchMusicByLyricClue({
  query:'hello darkness my old friend',ownerEnabled:true,fetcher
 }),/Provider use permission required/);
});

test('V2B3 server endpoint uses governed OpenAI web search + structured output and never audits lyric text',()=>{
 const php=fs.readFileSync('server/music-id-api.php','utf8');
 assert.match(php,/tracky_require\(\$db,'providers\.use'\)/);
 assert.match(php,/tracky_check_csrf\(\)/);
 assert.match(php,/ownerEnabled/);
 assert.match(php,/'type'=>'web_search'/);
 assert.match(php,/'type'=>'json_schema'/);
 assert.match(php,/Do not reproduce lyrics/);
 assert.match(php,/provider\.music-lyric-search/);
 assert.doesNotMatch(php,/tracky_provider_audit\([^;]*\$query/s);
 assert.match(php,/Lyric clue must be 12-160 characters/);
});

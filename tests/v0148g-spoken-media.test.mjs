import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 MediaIdentificationTracker,mediaWindowEligibility,normalizeMediaCandidate,
 mediaIdentificationMessage
} from '../src/media-identification-core.js';
import {searchMediaByClues} from '../src/media-identification-client.js';

const read=path=>fs.readFileSync(path,'utf8');

function jsonResponse(body,status=200){
 return new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json'}
 });
}

test('V2F radio is an eligible recorded-media recognition route while video game remains excluded',()=>{
 assert.equal(mediaWindowEligibility({mediaKind:'radio',durationMs:5000}).accept,true);
 assert.equal(mediaWindowEligibility({mediaKind:'television',durationMs:5000}).accept,true);
 assert.equal(mediaWindowEligibility({mediaKind:'recorded-media',durationMs:5000}).accept,true);
 assert.equal(mediaWindowEligibility({mediaKind:'video-game',durationMs:5000}).reason,'unsupported-media-kind');
});

test('V2F normalizes podcast and radio program candidate types',()=>{
 const podcast=normalizeMediaCandidate({
  kind:'podcast-episode',title:'Episode 42',series:'Example Podcast',
  service:'Example Network',confidence:.86,provider:'web',evidenceId:'a'
 },'dialogue',1000);
 const radio=normalizeMediaCandidate({
  kind:'radio-show',title:'Morning Edition',series:'Example Radio',
  service:'KXYZ',confidence:.84,provider:'web',evidenceId:'b'
 },'dialogue',2000);
 const station=normalizeMediaCandidate({
  kind:'radio-station',title:'KXYZ 101.1',confidence:.9,provider:'web',evidenceId:'c'
 },'dialogue',3000);
 assert.equal(podcast.kind,'podcast-episode');
 assert.equal(radio.kind,'radio-show');
 assert.equal(station.kind,'radio-station');
});

test('V2F distinct spoken-media clues can corroborate the same podcast episode',()=>{
 const tracker=new MediaIdentificationTracker();
 const first=normalizeMediaCandidate({
  kind:'podcast-episode',title:'Episode 42',series:'Example Podcast',
  confidence:.83,provider:'openai-web-search',evidenceId:'window-a'
 },'dialogue',1000);
 const second=normalizeMediaCandidate({
  kind:'podcast-episode',title:'Episode 42',series:'Example Podcast',
  confidence:.85,provider:'anthropic-web-search',evidenceId:'window-b'
 },'dialogue',25000);
 assert.equal(tracker.observeCandidate(first,1000).transition,'candidate');
 const result=tracker.observeCandidate(second,25000);
 assert.equal(result.transition,'confirmed');
 assert.equal(result.media.kind,'podcast-episode');
 assert.match(mediaIdentificationMessage(result),/Media identified/);
});

test('V2F client preserves radio media kind and never sends raw room audio',async()=>{
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});
  if(String(url).includes('session.php'))
   return jsonResponse({csrf:'token',permissions:['providers.use']});
  return jsonResponse({
   found:true,kind:'radio-show',title:'Example Show',series:'Example Radio',
   season:0,episode:0,year:2026,service:'KXYZ',confidence:.87,
   provider:'openai-web-search',model:'gpt-6-luna',evidenceId:'radio-1',
   sources:[{url:'https://example.com/show',title:'Example Show'}]
  });
 };
 const result=await searchMediaByClues({
  dialogueQuery:'welcome back today we are talking about the morning headlines',
  mediaKind:'radio',evidenceId:'radio-1',ownerEnabled:true,fetcher
 });
 assert.equal(result.found,true);
 assert.equal(result.candidate.kind,'radio-show');
 const body=JSON.parse(calls[1].options.body);
 assert.equal(body.mediaKind,'radio');
 for(const forbidden of ['samples','audio','pcm','recording'])
  assert.equal(forbidden in body,false);
});

test('V2F server schema and prompt support podcast/radio without reproducing transcripts',()=>{
 const php=read('server/media-id-api.php');
 assert.match(php,/podcast-episode/);
 assert.match(php,/radio-show/);
 assert.match(php,/radio-station/);
 assert.match(php,/\['television','recorded-media','radio'\]/);
 assert.match(php,/Do not infer who is watching or listening/);
 assert.match(php,/do not reproduce dialogue, scripts, podcast transcripts, or broadcast transcripts/i);
 assert.match(php,/tracky_chat_provider_plan/);
});

test('V2F runtime only queues radio after V2A marks the segment recorded',()=>{
 const runtime=read('vertical-motion.js');
 assert.match(runtime,/\['television','recorded-media','radio'\]\.includes\(mediaKind\)/);
 assert.match(runtime,/if\(speechOrigin\?\.state!=='recorded'\)return false/);
 assert.match(runtime,/Recorded radio \/ podcast speech window queued for local transcription/);
 assert.doesNotMatch(runtime,/saveDialogueTurn\([^)]*mediaWorkingDialogueQuery/s);
 assert.doesNotMatch(runtime,/logRoomMessage\([^)]*mediaWorkingDialogueQuery/s);
});

test('V2F ROOM UI explains recorded spoken media privacy boundary',()=>{
 const html=read('vertical-motion.html');
 assert.match(html,/TV \/ movie \/ streaming \/ radio \/ podcast/);
 assert.match(html,/recorded spoken programming such as radio\/podcasts/);
 assert.match(html,/Working TV\/radio\/podcast speech text is never added to participant Conversation or ROOM history/);
});

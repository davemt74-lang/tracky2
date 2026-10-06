import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 createAcrCloudMusicProvider,encodePcm16Wav,recognizeMusicWithAcrCloud
} from '../src/music-fingerprint-client.js';
import {
 identifyMusicFingerprint,MusicIdentificationTracker
} from '../src/music-identification-core.js';

function response(body,status=200){
 return new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json'}
 });
}

test('V2H PCM encoder creates bounded mono 16-bit RIFF/WAVE in memory',()=>{
 const wav=encodePcm16Wav(new Float32Array([0,.5,-.5,1,-1]),16000);
 assert.ok(wav instanceof Uint8Array);
 assert.equal(wav.length,44+10);
 const view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);
 const ascii=(start,n)=>String.fromCharCode(...wav.slice(start,start+n));
 assert.equal(ascii(0,4),'RIFF');
 assert.equal(ascii(8,4),'WAVE');
 assert.equal(ascii(12,4),'fmt ');
 assert.equal(ascii(36,4),'data');
 assert.equal(view.getUint16(20,true),1);
 assert.equal(view.getUint16(22,true),1);
 assert.equal(view.getUint32(24,true),16000);
 assert.equal(view.getUint16(34,true),16);
 assert.equal(view.getUint32(40,true),10);
});

test('V2H high-rate input is downsampled to bounded 16 kHz mono PCM',()=>{
 const input=new Float32Array(48000).fill(.1);
 const wav=encodePcm16Wav(input,48000);
 const view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);
 assert.equal(view.getUint32(24,true),16000);
 assert.equal(view.getUint32(40,true),16000*2);
 assert.equal(wav.byteLength,44+16000*2);
});

test('V2H exact recognition requires owner opt-in before any network request',async()=>{
 let calls=0;
 await assert.rejects(recognizeMusicWithAcrCloud({
  samples:new Float32Array([.1,.2,.3]),ownerEnabled:false,
  fetcher:async()=>{calls++;return response({});}
 }),/not enabled/);
 assert.equal(calls,0);
});

test('V2H ACRCloud client sends bounded WAV through same-origin governed endpoint',async()=>{
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url:String(url),options});
  if(String(url).includes('session.php'))
   return response({csrf:'csrf-token',permissions:['providers.use']});
  return response({
   found:true,provider:'acrcloud',dataType:'audio',evidenceId:'music-window-1',
   candidate:{
    title:'Example Track',artist:'Example Artist',album:'Example Album',
    confidence:.94,provider:'acrcloud',externalId:'acr-1',
    evidenceId:'music-window-1'
   }
  });
 };
 const candidate=await recognizeMusicWithAcrCloud({
  samples:new Float32Array(16000).fill(.1),sampleRate:16000,durationMs:1000,
  evidenceId:'music-window-1',ownerEnabled:true,fetcher
 });
 assert.equal(candidate.provider,'acrcloud');
 assert.equal(candidate.title,'Example Track');
 assert.equal(candidate.evidenceId,'music-window-1');
 assert.equal(calls.length,2);
 assert.match(calls[1].url,/server\/music-fingerprint-api\.php\?/);
 assert.match(calls[1].url,/provider=acrcloud/);
 assert.match(calls[1].url,/ownerEnabled=1/);
 assert.match(calls[1].url,/dataType=audio/);
 assert.equal(calls[1].options.headers['Content-Type'],'audio/wav');
 const body=calls[1].options.body;
 assert.ok(body instanceof Uint8Array);
 assert.equal(String.fromCharCode(...body.slice(0,4)),'RIFF');
 assert.ok(body.byteLength<=768000);
});

test('V2H transport is ready for a future compatible ACRCloud fingerprint extractor',async()=>{
 const fingerprint=new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]);
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url:String(url),options});
  if(String(url).includes('session.php'))
   return response({csrf:'csrf',permissions:['providers.use']});
  return response({found:false,provider:'acrcloud',dataType:'fingerprint'});
 };
 const result=await recognizeMusicWithAcrCloud({
  fingerprint,durationMs:8000,evidenceId:'fp-1',ownerEnabled:true,fetcher
 });
 assert.equal(result,null);
 assert.match(calls[1].url,/dataType=fingerprint/);
 assert.equal(calls[1].options.headers['Content-Type'],'application/octet-stream');
 assert.deepEqual(Array.from(calls[1].options.body),Array.from(fingerprint));
});

test('V2H provider adapter forwards evidence id through the existing fingerprint core',async()=>{
 let seen=null;
 const provider=createAcrCloudMusicProvider({
  ownerEnabled:()=>true,
  fetcher:async(url,options={})=>{
   if(String(url).includes('session.php'))
    return response({csrf:'x',permissions:['providers.use']});
   seen={url:String(url),options};
   return response({
    found:true,candidate:{
     title:'Song',artist:'Artist',confidence:.96,provider:'acrcloud',
     externalId:'acr-id',evidenceId:'window-77'
    }
   });
  }
 });
 const result=await identifyMusicFingerprint(provider,{
  samples:new Float32Array(4000).fill(.02),sampleRate:16000,durationMs:4000,
  evidenceId:'window-77',at:1000
 });
 assert.equal(result.available,true);
 assert.equal(result.candidate.source,'fingerprint');
 assert.equal(result.candidate.evidenceId,'window-77');
 assert.match(seen.url,/evidenceId=window-77/);
});

test('V2H two strong ACRCloud observations confirm through the existing evidence tracker',()=>{
 const tracker=new MusicIdentificationTracker();
 const first={
  title:'Track',artist:'Artist',confidence:.95,provider:'acrcloud',
  source:'fingerprint',evidenceId:'a',sourceUrls:[],at:1000
 };
 const second={...first,evidenceId:'b',at:15000};
 assert.equal(tracker.observeCandidate(first,1000).transition,'candidate');
 const confirmed=tracker.observeCandidate(second,15000);
 assert.equal(confirmed.transition,'confirmed');
 assert.equal(confirmed.track.provider,'acrcloud');
});

test('V2H server signs fixed-host ACRCloud requests without persisting samples',()=>{
 const php=fs.readFileSync('server/music-fingerprint-api.php','utf8');
 const providers=fs.readFileSync('server/providers.php','utf8');
 const admin=fs.readFileSync('server/admin.php','utf8');
 assert.match(php,/php:\/\/input/);
 assert.doesNotMatch(php,/\$_FILES/);
 assert.doesNotMatch(php,/file_put_contents/);
 assert.match(php,/TRACKY_ACRCLOUD_MAX_SAMPLE_BYTES=768000/);
 assert.match(php,/hash_hmac\('sha1'/);
 assert.match(php,/TRACKY_ACRCLOUD_HTTP_URI='\/v1\/identify'/);
 assert.match(php,/\$code===1001/);
 assert.match(php,/tracky_provider_circuit_open\('acrcloud'\)/);
 assert.match(php,/tracky_provider_consume_budget\([^;]*'acrcloud'/s);
 assert.match(providers,/TRACKY_PROVIDERS=\['openai','anthropic','elevenlabs','acrcloud'\]/);
 assert.match(providers,/\.acrcloud\\\.com/);
 assert.match(providers,/tracky_store_acrcloud_provider/);
 assert.match(admin,/ACRCloud Music Recognition/);
 assert.match(admin,/name="host"/);
 assert.match(admin,/name="access_key"/);
 assert.match(admin,/name="access_secret"/);
});

test('V2H ROOM UI keeps exact remote recognition opt-in and preserves local fallback',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 const runtime=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(html,/id="roomIdentifyMusicFingerprint"/);
 assert.doesNotMatch(html,/id="roomIdentifyMusicFingerprint" checked/);
 assert.match(html,/short bounded in-memory WAV/);
 assert.match(html,/does not persist that sample/);
 assert.match(runtime,/tracky2-room-music-acrcloud/);
 assert.match(runtime,/createAcrCloudMusicProvider/);
 assert.match(runtime,/ACRCloud recognition failed safely · continuing with local lyric fallback/);
 assert.match(runtime,/musicFingerprintAbortController\?\.abort\(\)/);
 assert.match(runtime,/const remoteExactEligible=Boolean\(speechOrigin\?\.state==='recorded'\)/);
 assert.match(runtime,/musicFingerprintLookupEnabled&&job\.remoteExactEligible/);
 assert.match(runtime,/ACRCloud audio skipped · live-room speech may be present/);
 assert.doesNotMatch(runtime,/logRoomMessage\([^)]*job\.samples/s);
 assert.doesNotMatch(runtime,/saveDialogueTurn\([^)]*job\.samples/s);
});

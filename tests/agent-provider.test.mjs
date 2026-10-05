import test from 'node:test';import assert from 'node:assert/strict';
import {validateLocalAgentEndpoint,buildAgentMessages,queryLocalOllama,fetchSelfHostedProviderStatus,querySelfHostedProvider,querySelfHostedSpeech} from '../src/agent-provider.js';
test('local model endpoint cannot silently transmit room text to remote or credentialed URL',()=>{
 assert.equal(validateLocalAgentEndpoint('http://127.0.0.1:11434'),'http://127.0.0.1:11434');
 for(const url of ['https://example.com','http://192.168.1.2:11434',
 'https://user:secret@localhost:11434','http://localhost:11434/other','javascript:alert(1)'])
  assert.throws(()=>validateLocalAgentEndpoint(url));
});
test('only bounded conversation text is sent, not biometric data',async()=>{
 const history=[{role:'participant',text:'I am here',embedding:[1,2]},
 {role:'agent',text:'Hello',image:'private'}];
 const messages=buildAgentMessages(history,'What did we say?','Dave');
 assert.equal(messages.length,4);
 assert.equal(JSON.stringify(messages).includes('embedding'),false);
 assert.equal(JSON.stringify(messages).includes('private'),false);
 let sent;
 const result=await queryLocalOllama({model:'llama3.2',messages,fetcher:async(url,opts)=>{
  sent={url,body:JSON.parse(opts.body)};return {ok:true,json:async()=>({message:{content:'We said hello.'}})};
 }});
 assert.equal(result,'We said hello.');
 assert.equal(sent.url,'http://127.0.0.1:11434/api/chat');
 assert.equal(sent.body.stream,false);
});

test('14A self-hosted chat never exposes a stored key to the browser contract',async()=>{
 const calls=[];
 const fetcher=async(url,opts={})=>{
  calls.push({url,opts});
  if((opts.method||'GET')==='GET')return {ok:true,status:200,json:async()=>({
   authenticated:true,csrf:'csrf-token',providers:[
    {provider:'openai',configured:true,models:['gpt-6-luna'],defaultModel:'gpt-6-luna',transportAvailable:true,
     budget:{daily:{requestsRemaining:10,unitsRemaining:1000},session:{requestsRemaining:5,unitsRemaining:500}}}
   ]
  })};
  return {ok:true,status:200,json:async()=>({reply:'Server mediated reply',model:'gpt-6-luna',budget:{}})};
 };
 const status=await fetchSelfHostedProviderStatus({fetcher});
 assert.equal(JSON.stringify(status).includes('apiKey'),false);
 const result=await querySelfHostedProvider({provider:'openai',model:'arbitrary-model',
  messages:[{role:'system',content:'rules',secret:'nope'},{role:'user',content:'hello',embedding:[1]}],status,fetcher});
 assert.equal(result.reply,'Server mediated reply');
 const body=JSON.parse(calls.at(-1).opts.body);
 assert.equal(body.model,'gpt-6-luna');
 assert.deepEqual(body.messages,[{role:'system',content:'rules'},{role:'user',content:'hello'}]);
 assert.equal(calls.at(-1).opts.headers['X-CSRF-Token'],'csrf-token');
});
test('14A ElevenLabs client sends bounded text and voice id only',async()=>{
 const status={csrf:'csrf',providers:[{provider:'elevenlabs',configured:true,transportAvailable:true}]};
 let sent;
 const result=await querySelfHostedSpeech({text:'hello world',voiceId:'voice_123456',
  status,fetcher:async(url,opts)=>{sent=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({
   audioBase64:'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',mimeType:'audio/mpeg',model:'eleven_flash_v2_5'
  })};}});
 assert.equal(sent.provider,'elevenlabs');assert.equal(sent.text,'hello world');
 assert.equal(result.mimeType,'audio/mpeg');
});

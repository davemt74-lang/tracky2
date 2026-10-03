import test from 'node:test';import assert from 'node:assert/strict';
import {validateLocalAgentEndpoint,buildAgentMessages,queryLocalOllama} from '../src/agent-provider.js';
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

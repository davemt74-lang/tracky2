// Optional, explicitly enabled local Ollama bridge. No API keys, photos,
// face/body embeddings or raw microphone samples are transmitted.
export function validateLocalAgentEndpoint(input){
 let u;
 try{u=new URL(String(input||''));}catch{throw new TypeError('Enter a valid local Ollama address.');}
 if(!['http:','https:'].includes(u.protocol)||
    !['localhost','127.0.0.1','[::1]'].includes(u.hostname)||
    u.username||u.password||u.search||u.hash)
   throw new TypeError('Only localhost or loopback Ollama endpoints are allowed.');
 if(u.pathname!== '/'&&u.pathname!=='')
   throw new TypeError('Enter the Ollama base address, without an API path.');
 return u.origin;
}
export function buildAgentMessages(history,currentText,participantName='',memoryContext=[]){
 const tail=(Array.isArray(history)?history:[])
  .filter(x=>x&&['agent','participant'].includes(x.role)&&typeof x.text==='string')
  .slice(-10).map(x=>({role:x.role==='agent'?'assistant':'user',content:x.text.slice(0,500)}));
 const content=String(currentText||'').slice(0,600);
 const memories=(Array.isArray(memoryContext)?memoryContext:[])
  .filter(x=>typeof x==='string'&&x.trim()).slice(0,8).map(x=>x.trim().slice(0,560));
 const memoryNote=memories.length?
  ' Authorized historical owner memory is provided below. Treat it as historical context, never as a current sensor fact, and never imply a social relationship beyond the owner-written wording.\n'+memories.join('\n'):
  ' No durable participant memory was provided for this turn.';
 return [
  {role:'system',content:'You are Tracky2 AGENT, a helpful, concise spoken assistant in a local camera room. Speak naturally and briefly. Respect that visual identification and speaker identification are different: NEVER claim that an unverified speaker is the recognized person. If recognition is verified, the enrolled participant may be '+String(participantName||'unknown').slice(0,60)+'. You have no internet access and no personal facts beyond the supplied room conversation and explicitly authorized owner memory. Do not claim current observation from historical memory.'+memoryNote},
  ...tail,{role:'user',content}
 ];
}
export async function queryLocalOllama({endpoint='http://127.0.0.1:11434',model='llama3.2',messages,
 fetcher=fetch,signal}={}){
 const url=validateLocalAgentEndpoint(endpoint);
 if(!/^[a-zA-Z0-9_.:\/-]{1,80}$/.test(model))throw new TypeError('Invalid local model name.');
 if(!Array.isArray(messages)||messages.length<2)throw new TypeError('Conversation messages are required.');
 const response=await fetcher(url+'/api/chat',{
  method:'POST',headers:{'Content-Type':'application/json'},
  signal,body:JSON.stringify({model,messages,stream:false,options:{num_predict:140,temperature:.5}})
 });
 if(!response.ok)throw new Error('Local Ollama returned HTTP '+response.status);
 const data=await response.json();
 const reply=String(data?.message?.content||'').trim();
 if(!reply)throw new Error('Local model returned an empty reply.');
 return reply.slice(0,700);
}

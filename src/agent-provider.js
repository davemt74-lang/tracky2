import {agentMultimodalPromptLines} from './agent-multimodal-context.js';
import {
 REMOTE_CHAT_PROVIDERS,boundedProviderMessages,normalizeProviderStatusPayload,
 providerModelFor
} from './provider-router-core.js';

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
export function buildAgentMessages(
 history,currentText,participantName='',memoryContext=[],conversationContext={},reasoningContext={}
){
 const tail=(Array.isArray(history)?history:[])
  .filter(x=>x&&['agent','participant'].includes(x.role)&&typeof x.text==='string')
  .slice(-10).map(x=>{
   const text=x.text.slice(0,500);
   const speaker=x.role==='participant'&&typeof x.speakerName==='string'&&x.speakerName.trim()
    ? '['+x.speakerName.trim().slice(0,60)+'] ' : '';
   return {role:x.role==='agent'?'assistant':'user',content:speaker+text};
  });
 const content=String(currentText||'').slice(0,600);
 const memories=(Array.isArray(memoryContext)?memoryContext:[])
  .filter(x=>typeof x==='string'&&x.trim()).slice(0,8).map(x=>x.trim().slice(0,560));
 const memoryNote=memories.length?
  ' Authorized historical owner memory below belongs ONLY to the current verified speaker. Never apply it to another participant in the room. Treat it as historical context, never as a current sensor fact.\n'+memories.join('\n'):
  ' No durable participant memory was provided for this turn.';
 const groupSize=Math.max(1,Number(conversationContext.conversationGroupSize)||1);
 const attention=String(conversationContext.attentionTarget||'unknown').slice(0,48);
 const addressedAgent=conversationContext.addressedAgent===true;
 const groupNote=' Conversation context: '+groupSize+' person'+(groupSize===1?'':'s')+
  ' in scope; attention target '+attention+'; AGENT explicitly addressed: '+(addressedAgent?'yes':'no')+
  '. Speaker labels in prior turns are canonical attribution labels; unknown speakers must stay unknown.';
 const reasoningLines=agentMultimodalPromptLines(reasoningContext);
 const reasoningNote=reasoningLines.length?
  ' Canonical multimodal reasoning context:\n- '+reasoningLines.join('\n- '):
  ' Canonical multimodal reasoning context unavailable; preserve unknown speaker state and do not infer identity.';
 return [
  {role:'system',content:'You are Tracky2 AGENT, a helpful, concise spoken assistant in a local camera room. Speak naturally and briefly. Respect that visual identification and speaker identification are different: NEVER claim that an unverified speaker is the recognized person. If recognition is verified, the current speaker may be '+String(participantName||'unknown').slice(0,60)+'. You have no internet access and no personal facts beyond the supplied room conversation and explicitly authorized owner memory. Do not claim current observation from historical memory. Never override canonical identity, speaker attribution, participant records, or owner corrections.'+groupNote+reasoningNote+memoryNote},
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


const PROVIDER_API='./server/provider-api.php';
async function providerJson(response){
 let data={};try{data=await response.json();}catch{}
 if(!response.ok)throw new Error(String(data?.error||('Provider runtime returned HTTP '+response.status)).slice(0,240));
 return data;
}
export async function fetchSelfHostedProviderStatus({fetcher=fetch,signal}={}){
 const response=await fetcher(PROVIDER_API,{method:'GET',credentials:'same-origin',
  headers:{Accept:'application/json'},signal});
 return normalizeProviderStatusPayload(await providerJson(response));
}
export async function querySelfHostedProvider({provider,model,messages,status=null,fetcher=fetch,signal}={}){
 const selected=String(provider||'').toLowerCase();
 if(!REMOTE_CHAT_PROVIDERS.includes(selected))throw new TypeError('Unsupported self-hosted chat provider.');
 const runtime=status||await fetchSelfHostedProviderStatus({fetcher,signal});
 if(!runtime?.csrf)throw new Error('Authenticated provider session required.');
 const row=runtime.providers.find(item=>item.provider===selected);
 if(!row?.configured)throw new Error(selected+' provider is not configured.');
 if(row.transportAvailable===false)throw new Error('Server provider transport is unavailable.');
 const chosen=providerModelFor(selected,model);
 const safeMessages=boundedProviderMessages(messages);
 if(safeMessages.length<2)throw new TypeError('Conversation messages are required.');
 const response=await fetcher(PROVIDER_API,{
  method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-Token':runtime.csrf},
  signal,body:JSON.stringify({action:'chat',provider:selected,model:chosen,messages:safeMessages})
 });
 const data=await providerJson(response);
 const reply=String(data?.reply||'').trim();
 if(!reply)throw new Error('Provider returned an empty reply.');
 return Object.freeze({
  reply:reply.slice(0,700),provider:selected,model:String(data?.model||chosen),
  budget:data?.budget&&typeof data.budget==='object'?Object.freeze({...data.budget}):null
 });
}
export async function querySelfHostedSpeech({
 text,voiceId,model='eleven_flash_v2_5',status=null,fetcher=fetch,signal
}={}){
 const value=String(text||'').replace(/\s+/g,' ').trim().slice(0,700);
 if(!value)throw new TypeError('Speech text is required.');
 if(!/^[A-Za-z0-9_-]{8,64}$/.test(String(voiceId||'')))throw new TypeError('Enter a valid ElevenLabs voice ID.');
 const runtime=status||await fetchSelfHostedProviderStatus({fetcher,signal});
 if(!runtime?.csrf)throw new Error('Authenticated provider session required.');
 const row=runtime.providers.find(item=>item.provider==='elevenlabs');
 if(!row?.configured)throw new Error('ElevenLabs provider is not configured.');
 if(row.transportAvailable===false)throw new Error('Server provider transport is unavailable.');
 const chosen=providerModelFor('elevenlabs',model);
 const response=await fetcher(PROVIDER_API,{
  method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-Token':runtime.csrf},
  signal,body:JSON.stringify({action:'speech',provider:'elevenlabs',model:chosen,voiceId:String(voiceId),text:value})
 });
 const data=await providerJson(response);
 const audioBase64=String(data?.audioBase64||'');
 if(!/^[A-Za-z0-9+/=]+$/.test(audioBase64)||audioBase64.length<32)
  throw new Error('Speech provider returned invalid audio.');
 return Object.freeze({
  audioBase64,mimeType:String(data?.mimeType||'audio/mpeg'),
  provider:'elevenlabs',model:String(data?.model||chosen),
  budget:data?.budget&&typeof data.budget==='object'?Object.freeze({...data.budget}):null
 });
}

export async function querySelfHostedResearch({provider,model,messages,status=null,fetcher=fetch,signal}={}){
 const selected=String(provider||'').toLowerCase();
 if(!REMOTE_CHAT_PROVIDERS.includes(selected))throw new TypeError('Unsupported self-hosted research provider.');
 const runtime=status||await fetchSelfHostedProviderStatus({fetcher,signal});
 if(!runtime?.csrf)throw new Error('Authenticated provider session required.');
 const row=runtime.providers.find(item=>item.provider===selected);
 if(!row?.configured)throw new Error(selected+' provider is not configured.');
 if(row.transportAvailable===false)throw new Error('Server provider transport is unavailable.');
 const chosen=providerModelFor(selected,model);
 const safeMessages=boundedProviderMessages(messages);
 const response=await fetcher(PROVIDER_API,{
  method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-Token':runtime.csrf},
  signal,body:JSON.stringify({
   action:'research',confirmed:true,provider:selected,model:chosen,messages:safeMessages
  })
 });
 const data=await providerJson(response);
 const reply=String(data?.reply||'').trim();
 if(!reply)throw new Error('Research provider returned an empty reply.');
 const sources=(Array.isArray(data?.sources)?data.sources:[]).slice(0,5)
  .map(row=>Object.freeze({
   url:/^https:\/\//i.test(String(row?.url||''))?String(row.url).slice(0,700):'',
   title:String(row?.title||'').replace(/\s+/g,' ').trim().slice(0,160)
  })).filter(row=>row.url);
 return Object.freeze({
  reply:reply.slice(0,1200),sources:Object.freeze(sources),provider:selected,
  model:String(data?.model||chosen),budget:data?.budget||null,confirmed:data?.confirmed===true
 });
}

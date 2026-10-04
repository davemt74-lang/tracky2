// Transparent local-first Agent conversation starter. No LLM or network service is
// implied. Never infer identity from an unmatched speaker or body near a microphone.
export const AGENT_HISTORY_KEY='tracky2-agent-history-v1';
export const MAX_AGENT_HISTORY=120;
export function safeName(value){return String(value||'').trim().slice(0,64);}
export function greetingForParticipant(person){
 const name=safeName(person?.nickname||person?.name);
 return name?`Welcome back, ${name}. It's good to see you. How can I help you today?`:
  'Welcome. How can I help you today?';
}
export function localAgentReply(transcript,{name='',previousTopics=[],memories=[]}={}){
 const text=String(transcript||'').trim();
 if(!text)return '';
 const greeting=safeName(name);
 const address=greeting?greeting+', ':'';
 if(/\b(hello|hi|hey|good morning|good evening)\b/i.test(text))
   return 'Hello'+(greeting?', '+greeting:'')+'. What would you like to talk about?';
 if(/\b(what did (we|i) (discuss|say|talk about)|previous conversation|last time)\b/i.test(text)){
   const topic=previousTopics.filter(v=>typeof v==='string'&&v.trim()).slice(-3);
   return topic.length?
     'Our recent conversation mentioned: '+topic.join('; ')+'. What should we continue?':
     'I do not have an earlier conversation in this room session to summarize.';
 }
 if(/\b(what do you remember|remember about me|my preferences|what do you know about me)\b/i.test(text)){
   const approved=memories.filter(v=>typeof v==='string'&&v.trim()).slice(0,4);
   if(!greeting)return 'I cannot use participant memory until the speaker is verified.';
   return approved.length?
    'The owner-approved historical memory I have is: '+approved.map(v=>v.replace(/^Historical owner memory \[[^\]]+\]:\s*/,'')).join('; ')+
      '. I treat that as historical context, not a current observation.':
    'I do not have active owner-approved durable memory for this participant.';
 }
 if(/\b(who (am i|is here)|recognize me|my name)\b/i.test(text))
   return greeting?'Your enrolled profile is '+greeting+'. Speaker identity still needs a verified voice match.':
     'I can see the room, but I cannot confirm your identity from this voice alone.';
 if(/\b(help|what can you do)\b/i.test(text))
   return 'I can greet enrolled participants, keep a local conversation history, and describe confirmed room activity. General AI responses require a configured language model.';
 if(/\b(thank you|thanks)\b/i.test(text))return 'You are welcome'+(greeting?', '+greeting:'')+'.';
 if(/\b(stop talking|be quiet|silence)\b/i.test(text))return 'Understood. I will stay quiet until addressed again.';
 return address+'I heard you. The local conversation mode supports greetings and room context. Connect a language model for open-ended discussion.';
}
export function appendAgentHistory(items,entry,max=MAX_AGENT_HISTORY){
 if(!Array.isArray(items)||!entry||!['agent','participant','system'].includes(entry.role)||!String(entry.text||'').trim())return Array.isArray(items)?items.slice():[];
 return [...items,{role:entry.role,text:String(entry.text).slice(0,500),at:Number.isFinite(entry.at)?entry.at:Date.now(),
  participantId:entry.participantId||null,
  scopeId:typeof entry.scopeId==='string'?entry.scopeId.slice(0,240):null}].slice(-max);
}
export function loadAgentHistory(storage){
 try{
  const v=JSON.parse(storage?.getItem(AGENT_HISTORY_KEY)||'[]');
  return Array.isArray(v)?v
   .filter(e=>e&&['agent','participant','system'].includes(e.role)&&typeof e.text==='string')
   .slice(-MAX_AGENT_HISTORY)
   .map(e=>({role:e.role,text:String(e.text).slice(0,500),
    at:Number.isFinite(e.at)?e.at:0,participantId:e.participantId||null,
    scopeId:typeof e.scopeId==='string'?e.scopeId.slice(0,240):null})):[];
 }catch{return [];}
}
export function saveAgentHistory(storage,items,enabled){
 if(!enabled)return false;
 try{storage?.setItem(AGENT_HISTORY_KEY,JSON.stringify(items.slice(-MAX_AGENT_HISTORY)));return true;}catch{return false;}
}
export function shouldGreet(id,previous,now,cooldownMs=120000){
 if(!id)return false;
 const t=previous.get(id);
 return t===undefined||now-t>=cooldownMs;
}

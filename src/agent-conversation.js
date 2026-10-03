// Offline first-pass conversational agent. It never invents private knowledge,
// speakers or remote LLM capabilities. Turn memory is bounded and local only.
export const AGENT_HISTORY_KEY='tracky2-agent-history-v1';
export const AGENT_VOICE_KEY='tracky2-agent-voice-v1';
export const MAX_AGENT_HISTORY=80;
export function greetingFor(person){
 if(!person?.id || !person?.name?.trim())return null;
 const name=(person.nickname||person.name).trim().slice(0,50);
 return 'Hello, '+name+'. Welcome back. How is your day going?';
}
export function respondToAgentTurn(text,{person=null}={}){
 const phrase=String(text||'').trim().slice(0,800);
 if(!phrase)return null;
 const name=person?.nickname||person?.name||'';
 if(/\b(hello|hey|hi|good morning|good evening)\b/i.test(phrase))
  return 'Hello'+(name?', '+name:'')+'. What would you like to talk about?';
 if(/\b(how are you|how is it going)\b/i.test(phrase))
  return "I'm here and listening. How has your day been?";
 if(/\b(thank you|thanks)\b/i.test(phrase))return "You're welcome.";
 if(/\b(goodbye|bye|see you)\b/i.test(phrase))return "Take care. I'll be here next time.";
 if(/\b(your name|who are you)\b/i.test(phrase))
  return "I'm your Tracky room agent. I can greet participants and discuss simple things locally.";
 if(/\b(what can you do|help me|capabilities)\b/i.test(phrase))
  return "I can recognize enrolled participants when tracking confirms them, listen with permission, keep a local conversation timeline and answer simple prompts. I don't have a general knowledge model connected.";
 if(/\b(great|good|wonderful|happy|awesome)\b/i.test(phrase))
  return "I'm glad to hear that. What made it a good day?";
 if(/\b(bad|difficult|tough|tired|stressed)\b/i.test(phrase))
  return "That sounds challenging. Would you like to talk about it?";
 if(/\b(time|date|weather|news|search|internet)\b/i.test(phrase))
  return "I don't have live information connected in this version. We can still chat here.";
 return "I'm listening. Tell me more, or ask what I can do.";
}
export function appendAgentHistory(rows,entry,max=MAX_AGENT_HISTORY){
 if(!entry || !['agent','user','system'].includes(entry.role)||
  typeof entry.text!=='string'||!entry.text.trim()||!Number.isFinite(entry.at))return rows.slice();
 return [...rows, {role:entry.role,text:entry.text.slice(0,1000),at:entry.at,
   participantId:entry.participantId||null,
   attribution:entry.attribution||'unverified'}].slice(-max);
}
export function readAgentHistory(store){
 try{
  const json=JSON.parse(store?.getItem(AGENT_HISTORY_KEY)||'[]');
  if(!Array.isArray(json))return [];
  return json.filter(t=>t && ['agent','user','system'].includes(t.role) &&
    typeof t.text==='string'&&Number.isFinite(t.at)).slice(-MAX_AGENT_HISTORY);
 }catch{return [];}
}
export function selectAgentVoice(voices,savedURI=''){
 if(!Array.isArray(voices)||!voices.length)return null;
 return voices.find(v=>v.voiceURI===savedURI)||voices.find(v=>v.default)||voices[0];
}
export function agentTranscriptEligible({mode=false,text='',voiceParticipantId=null}={}){
 return mode && typeof text==='string' && !!text.trim() && text.trim().length>2 &&
  !!voiceParticipantId; // never engage a nearby non-speaker on unverified audio
}

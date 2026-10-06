export const REMOTE_CHAT_PROVIDERS=Object.freeze(['openai','anthropic']);
export const AUTO_PROVIDER='auto';
export const REMOTE_SPEECH_PROVIDERS=Object.freeze(['elevenlabs']);
export const PROVIDER_MODEL_ALLOWLIST=Object.freeze({
 openai:Object.freeze(['gpt-6-luna','gpt-6-sol','gpt-5.6-sol']),
 anthropic:Object.freeze(['claude-sonnet-4-5','claude-haiku-4-5','claude-opus-4-1']),
 elevenlabs:Object.freeze(['eleven_flash_v2_5','eleven_multilingual_v2'])
});
export const PROVIDER_DEFAULT_MODELS=Object.freeze({
 openai:'gpt-6-luna',anthropic:'claude-sonnet-4-5',elevenlabs:'eleven_flash_v2_5'
});
export const PROVIDER_MESSAGE_LIMIT=12;
export const PROVIDER_MESSAGE_CHARS=2400;
export const PROVIDER_TOTAL_CHARS=12000;
export const PROVIDER_REPLY_CHARS=700;

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
export function normalizeProviderChoice(value){
 const provider=clean(value).toLowerCase();
 if(provider===AUTO_PROVIDER||provider==='ollama'||REMOTE_CHAT_PROVIDERS.includes(provider)||REMOTE_SPEECH_PROVIDERS.includes(provider))
  return provider;
 return 'ollama';
}
export function providerModelAllowed(provider,model){
 const list=PROVIDER_MODEL_ALLOWLIST[clean(provider).toLowerCase()]||[];
 return list.includes(clean(model));
}
export function providerDefaultModel(provider){
 return PROVIDER_DEFAULT_MODELS[clean(provider).toLowerCase()]||'';
}
export function providerModelFor(provider,requested=''){
 const p=clean(provider).toLowerCase(),model=clean(requested);
 return providerModelAllowed(p,model)?model:providerDefaultModel(p);
}
export function boundedProviderMessages(messages=[]){
 const source=(Array.isArray(messages)?messages:[])
  .filter(row=>row&&['system','user','assistant'].includes(row.role)&&typeof row.content==='string')
  .slice(-PROVIDER_MESSAGE_LIMIT);
 const rows=[];let total=0;
 for(const row of source){
  if(total>=PROVIDER_TOTAL_CHARS)break;
  const content=clean(row.content).slice(0,Math.min(PROVIDER_MESSAGE_CHARS,PROVIDER_TOTAL_CHARS-total));
  if(!content)continue;
  rows.push(Object.freeze({role:row.role,content}));
  total+=content.length;
 }
 return Object.freeze(rows);
}
export function providerRequestUnits(messages=[],maxOutputTokens=180){
 const chars=boundedProviderMessages(messages).reduce((sum,row)=>sum+row.content.length,0);
 return Math.max(1,Math.ceil(chars/4)+Math.max(1,Math.min(400,Number(maxOutputTokens)||180)));
}
export function activeRemoteProvider(selected,statuses=[]){
 const preferred=clean(selected).toLowerCase();
 const configured=(Array.isArray(statuses)?statuses:[])
  .filter(row=>row?.configured===true&&row?.transportAvailable!==false&&
   REMOTE_CHAT_PROVIDERS.includes(row.provider));
 if(REMOTE_CHAT_PROVIDERS.includes(preferred)&&configured.some(row=>row.provider===preferred))
  return preferred;
 for(const provider of REMOTE_CHAT_PROVIDERS)
  if(configured.some(row=>row.provider===provider))return provider;
 return null;
}
export function providerFallbackPlan(selected,statuses=[]){
 const first=clean(selected).toLowerCase();
 const configured=new Set((Array.isArray(statuses)?statuses:[])
  .filter(row=>row?.configured===true&&REMOTE_CHAT_PROVIDERS.includes(row.provider))
  .map(row=>row.provider));
 const plan=[];
 if(REMOTE_CHAT_PROVIDERS.includes(first)&&configured.has(first))plan.push(first);
 for(const provider of REMOTE_CHAT_PROVIDERS)
  if(configured.has(provider)&&!plan.includes(provider))plan.push(provider);
 return Object.freeze(plan);
}
export function normalizeProviderStatusPayload(payload={}){
 const providers=(Array.isArray(payload.providers)?payload.providers:[]).map(row=>Object.freeze({
  provider:clean(row?.provider).toLowerCase(),
  configured:row?.configured===true,
  updatedAt:row?.updatedAt||null,
  models:Object.freeze((Array.isArray(row?.models)?row.models:[]).map(clean).filter(Boolean)),
  defaultModel:clean(row?.defaultModel),
  transportAvailable:row?.transportAvailable!==false,
  budget:row?.budget&&typeof row.budget==='object'?Object.freeze({...row.budget}):null
 })).filter(row=>REMOTE_CHAT_PROVIDERS.includes(row.provider)||REMOTE_SPEECH_PROVIDERS.includes(row.provider));
 return Object.freeze({
  authenticated:payload.authenticated===true,
  csrf:typeof payload.csrf==='string'?payload.csrf:'',
  providers:Object.freeze(providers)
 });
}
export function providerBudgetLabel(budget){
 if(!budget)return 'budget unavailable';
 const d=budget.daily||{},s=budget.session||{};
 return 'daily '+Math.max(0,Number(d.requestsRemaining)||0)+' requests / '+
  Math.max(0,Number(d.unitsRemaining)||0)+' units · session '+
  Math.max(0,Number(s.requestsRemaining)||0)+' requests / '+
  Math.max(0,Number(s.unitsRemaining)||0)+' units';
}

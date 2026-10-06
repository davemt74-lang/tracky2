import {normalizeMediaCandidate} from './media-identification-core.js';
const SESSION='./server/session.php';
const MEDIA_ID_API='./server/media-id-api.php';

async function json(response,message){
 let data={};try{data=await response.json();}catch{}
 if(!response.ok)throw Object.assign(
  new Error(String(data?.error||message||('HTTP '+response.status)).slice(0,240)),
  {status:response.status}
 );
 return data;
}
function boundedSources(input=[]){
 const rows=[];const seen=new Set();
 for(const item of Array.isArray(input)?input:[]){
  if(rows.length>=5)break;
  const url=String(item?.url||'').trim().slice(0,700);
  const title=String(item?.title||'').replace(/\s+/g,' ').trim().slice(0,160);
  if(!/^https:\/\//i.test(url)||seen.has(url))continue;
  seen.add(url);rows.push(Object.freeze({url,title:title||url.slice(0,120)}));
 }
 return Object.freeze(rows);
}
export async function searchMediaByClues({
 dialogueQuery='',visualClue='',mediaKind='television',evidenceId='',
 ownerEnabled=false,preferredProvider='auto',fetcher=fetch,signal
}={}){
 const dialogue=String(dialogueQuery||'').replace(/\s+/g,' ').trim().slice(0,190);
 const visual=String(visualClue||'').replace(/\s+/g,' ').trim().slice(0,220);
 if(!dialogue&&!visual)throw new TypeError('A usable media clue is required.');
 if(ownerEnabled!==true)throw new Error('Remote media lookup is not enabled.');

 const session=await json(await fetcher(SESSION,{
  credentials:'same-origin',headers:{Accept:'application/json'},signal
 }),'Authenticated server session required.');
 if(!session?.csrf||!Array.isArray(session.permissions)||
    !session.permissions.includes('providers.use'))
  throw new Error('Provider use permission required.');

 const response=await fetcher(MEDIA_ID_API,{
  method:'POST',credentials:'same-origin',signal,
  headers:{
   'Content-Type':'application/json','Accept':'application/json',
   'X-CSRF-Token':session.csrf
  },
  body:JSON.stringify({
   action:'media_search',dialogueQuery:dialogue,visualClue:visual,
   mediaKind:['television','recorded-media'].includes(mediaKind)?mediaKind:'recorded-media',
   evidenceId:String(evidenceId||'').slice(0,96),ownerEnabled:true,
   preferredProvider:['openai','anthropic'].includes(String(preferredProvider||'').toLowerCase())
    ?String(preferredProvider).toLowerCase():'auto'
  })
 });
 const data=await json(response,'Media lookup failed.');
 const found=data?.found===true;
 const sources=boundedSources(data?.sources);
 return Object.freeze({
  found,
  candidate:found?normalizeMediaCandidate({
   kind:String(data?.kind||'unknown'),
   title:String(data?.title||'').replace(/\s+/g,' ').trim().slice(0,140),
   series:String(data?.series||'').replace(/\s+/g,' ').trim().slice(0,140)||null,
   season:data?.season,episode:data?.episode,year:data?.year,
   service:String(data?.service||'').replace(/\s+/g,' ').trim().slice(0,80)||null,
   confidence:Math.max(0,Math.min(1,Number(data?.confidence)||0)),
   provider:String(data?.provider||'web-search').slice(0,64),
   evidenceId:String(data?.evidenceId||evidenceId||'').slice(0,96),
   sourceUrls:sources.map(row=>row.url)
  },dialogue?'dialogue':'visual',Date.now()):null,
  sources,provider:String(data?.provider||'web-search').slice(0,64),
  model:String(data?.model||'').slice(0,80),
  budget:data?.budget&&typeof data.budget==='object'?Object.freeze({...data.budget}):null
 });
}

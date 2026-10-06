import {normalizeMusicCandidate} from './music-identification-core.js';
const SESSION='./server/session.php';
const MUSIC_ID_API='./server/music-id-api.php';

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
export async function searchMusicByLyricClue({
 query,evidenceId='',ownerEnabled=false,fetcher=fetch,signal
}={}){
 const clue=String(query||'').replace(/\s+/g,' ').trim().slice(0,160);
 if(clue.length<12)throw new TypeError('A usable lyric clue is required.');
 if(ownerEnabled!==true)throw new Error('Remote lyric lookup is not enabled.');

 const session=await json(await fetcher(SESSION,{
  credentials:'same-origin',headers:{Accept:'application/json'},signal
 }),'Authenticated server session required.');
 if(!session?.csrf||!Array.isArray(session.permissions)||
    !session.permissions.includes('providers.use'))
  throw new Error('Provider use permission required.');

 const response=await fetcher(MUSIC_ID_API,{
  method:'POST',credentials:'same-origin',signal,
  headers:{
   'Content-Type':'application/json','Accept':'application/json',
   'X-CSRF-Token':session.csrf
  },
  body:JSON.stringify({
   action:'lyric_search',query:clue,
   evidenceId:String(evidenceId||'').slice(0,96),ownerEnabled:true
  })
 });
 const data=await json(response,'Music lyric lookup failed.');
 const found=data?.found===true;
 return Object.freeze({
  found,
  candidate:found?normalizeMusicCandidate({
   title:String(data?.title||'').replace(/\s+/g,' ').trim().slice(0,120),
   artist:String(data?.artist||'').replace(/\s+/g,' ').trim().slice(0,120),
   album:String(data?.album||'').replace(/\s+/g,' ').trim().slice(0,120)||null,
   confidence:Math.max(0,Math.min(1,Number(data?.confidence)||0)),
   provider:String(data?.provider||'openai-web-search').slice(0,64),
   externalId:null,evidenceId:String(data?.evidenceId||evidenceId||'').slice(0,96),
   sourceUrls:boundedSources(data?.sources).map(row=>row.url)
  },'lyrics',Date.now()):null,
  sources:boundedSources(data?.sources),
  provider:String(data?.provider||'openai-web-search').slice(0,64),
  model:String(data?.model||'').slice(0,80),
  budget:data?.budget&&typeof data.budget==='object'?Object.freeze({...data.budget}):null
 });
}

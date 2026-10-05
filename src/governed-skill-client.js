import {boundedWebSources,normalizeServerSkillTarget} from './governed-skill-core.js';

const API='./server/api.php',SESSION='./server/session.php',SKILL_API='./server/skill-api.php';
async function json(response,message){
 let data={};try{data=await response.json();}catch{}
 if(!response.ok)throw Object.assign(new Error(String(data?.error||message||('HTTP '+response.status)).slice(0,240)),{status:response.status});
 return data;
}
export async function loadServerSkillTargets({fetcher=fetch,signal}={}){
 try{
  const [objectsResponse,skillsResponse]=await Promise.all([
   fetcher(API+'?resource=objects',{credentials:'same-origin',headers:{Accept:'application/json'},signal}),
   fetcher(API+'?resource=skills',{credentials:'same-origin',headers:{Accept:'application/json'},signal})
  ]);
  const objects=await json(objectsResponse,'Server object inventory unavailable.');
  const skills=await json(skillsResponse,'Server skill inventory unavailable.');
  const grants=new Map();
  for(const row of Array.isArray(skills.records)?skills.records:[]){
   if(Number(row?.enabled)!==1&&row?.enabled!==true)continue;
   const id=String(row?.object_id||'');
   if(!grants.has(id))grants.set(id,[]);
   grants.get(id).push(String(row?.skill||''));
  }
  const targets=[];
  for(const row of Array.isArray(objects.records)?objects.records:[]){
   let bbox=null;try{bbox=Array.isArray(row?.bbox)?row.bbox:JSON.parse(row?.bbox_json||'null');}catch{}
   const target=normalizeServerSkillTarget({
    id:row?.id,label:row?.label,status:row?.status,sceneId:row?.scene_id,bbox,
    enabledSkills:grants.get(String(row?.id||''))||[]
   });
   if(target?.approved)targets.push(target);
  }
  return Object.freeze({available:true,targets:Object.freeze(targets)});
 }catch(error){
  if([401,403,404,503].includes(Number(error?.status)))
   return Object.freeze({available:false,targets:Object.freeze([]),reason:error.message});
  throw error;
 }
}
export async function executeServerProductSearch({objectId,fetcher=fetch,signal}={}){
 const id=String(objectId||'').trim();
 if(!/^[A-Za-z0-9_-]{8,80}$/.test(id))throw new TypeError('Invalid approved object ID.');
 const session=await json(await fetcher(SESSION,{
  credentials:'same-origin',headers:{Accept:'application/json'},signal
 }),'Authenticated server session required.');
 if(!session?.csrf||!Array.isArray(session.permissions)||!session.permissions.includes('skills.execute'))
  throw new Error('Skill execution permission required.');
 const response=await fetcher(SKILL_API,{
  method:'POST',credentials:'same-origin',signal,
  headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-Token':session.csrf},
  body:JSON.stringify({skill:'product_search',objectId:id})
 });
 const data=await json(response,'Product search failed.');
 return Object.freeze({
  summary:String(data?.summary||'').replace(/\s+/g,' ').trim().slice(0,900),
  sources:boundedWebSources(data?.sources),
  provider:String(data?.provider||'openai').slice(0,32),
  model:String(data?.model||'').slice(0,80),
  budget:data?.budget&&typeof data.budget==='object'?Object.freeze({...data.budget}):null
 });
}

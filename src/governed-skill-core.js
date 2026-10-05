export const GOVERNED_SKILL_CONTRACT='14B.1';
export const SKILL_TARGET_SOURCES=Object.freeze(['local-owner-defined','server-approved']);
export const SKILL_SIDE_EFFECTS=Object.freeze(['read-only','media-capture','external-network']);
export const GOVERNED_SKILLS=Object.freeze({
 describe_object:Object.freeze({
  id:'describe_object',label:'Describe approved object',version:GOVERNED_SKILL_CONTRACT,
  target:'scene-object',targetSources:Object.freeze(['local-owner-defined','server-approved']),
  confirmation:'required',sideEffect:'read-only',executor:'describe-object'
 }),
 capture_image:Object.freeze({
  id:'capture_image',label:'Capture current camera area',version:GOVERNED_SKILL_CONTRACT,
  target:'scene-object',targetSources:Object.freeze(['local-owner-defined']),
  confirmation:'required',sideEffect:'media-capture',executor:'foreground-camera-capture',
  foregroundOwnerAction:true
 }),
 product_search:Object.freeze({
  id:'product_search',label:'Search current products',version:GOVERNED_SKILL_CONTRACT,
  target:'scene-object',targetSources:Object.freeze(['server-approved']),
  confirmation:'required',sideEffect:'external-network',executor:'server-product-search',
  foregroundOwnerAction:true
 })
});
const clean=(value,max=120)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const allowedSkillIds=()=>Object.keys(GOVERNED_SKILLS);
export function normalizeEnabledSkills(input=[],fallbackDescribe=false){
 const values=Array.isArray(input)?input:[];
 const safe=[...new Set(values.map(v=>clean(v,48)).filter(v=>allowedSkillIds().includes(v)))];
 if(!safe.length&&fallbackDescribe)safe.push('describe_object');
 return Object.freeze(safe);
}
export function skillDefinition(id){return GOVERNED_SKILLS[clean(id,48)]||null;}
export function skillAllowsSource(skillId,targetSource){
 const skill=skillDefinition(skillId);
 return Boolean(skill&&skill.targetSources.includes(clean(targetSource,48)));
}
export function localSkillTarget(scene,targetId){
 const object=(scene?.objects||[]).find(row=>row?.id===targetId);
 if(!object)return null;
 const area=(scene?.areas||[]).find(row=>row?.id===object.areaId)||null;
 return Object.freeze({
  id:clean(object.id,96),name:clean(object.name),kind:clean(object.kind,48)||'other',
  targetSource:'local-owner-defined',approved:true,
  enabledSkills:normalizeEnabledSkills(object.skills,true),
  area:area?Object.freeze({
   id:clean(area.id,96),name:clean(area.name),rect:area.rect?Object.freeze({...area.rect}):null
  }):null,
  provenance:Object.freeze(['owner-defined-room-scene'])
 });
}
export function normalizeServerSkillTarget(input={}){
 const id=clean(input.id,96),name=clean(input.name||input.label);
 if(!id||!name)return null;
 return Object.freeze({
  id,name,kind:clean(input.kind,48)||'detected-object',
  targetSource:'server-approved',approved:input.approved===true||input.status==='approved',
  enabledSkills:normalizeEnabledSkills(input.enabledSkills||input.skills),
  sceneId:clean(input.sceneId||input.scene_id,96)||null,
  bbox:Array.isArray(input.bbox)&&input.bbox.length===4
   ?Object.freeze(input.bbox.map(v=>Math.max(0,Math.min(1,Number(v)||0)))):null,
  provenance:Object.freeze(['self-hosted-approved-scene-object'])
 });
}
export function skillExecutionPolicy({
 skillId,target,explicitOwnerAction=false,cameraActive=false,documentVisible=true
}={}){
 const skill=skillDefinition(skillId);
 if(!skill)return Object.freeze({allow:false,reason:'unknown-skill',skill:null});
 if(!target||target.id==='')return Object.freeze({allow:false,reason:'target-unavailable',skill});
 if(!skillAllowsSource(skill.id,target.targetSource))
  return Object.freeze({allow:false,reason:'target-source-not-allowed',skill});
 if(target.approved!==true)
  return Object.freeze({allow:false,reason:'object-approval-required',skill});
 if(!normalizeEnabledSkills(target.enabledSkills).includes(skill.id))
  return Object.freeze({allow:false,reason:'skill-not-enabled-for-object',skill});
 if(skill.foregroundOwnerAction&&explicitOwnerAction!==true)
  return Object.freeze({allow:false,reason:'foreground-owner-action-required',skill});
 if(skill.sideEffect==='media-capture'){
  if(documentVisible!==true)return Object.freeze({allow:false,reason:'page-not-visible',skill});
  if(cameraActive!==true)return Object.freeze({allow:false,reason:'camera-not-active',skill});
  if(!target.area?.rect)return Object.freeze({allow:false,reason:'camera-area-required',skill});
 }
 return Object.freeze({allow:true,reason:null,skill});
}
export function nonReadOnlyScheduleAllowed(skillId,runAt,now=Date.now()){
 const skill=skillDefinition(skillId);
 if(!skill)return false;
 if(skill.sideEffect==='read-only')return true;
 return Math.abs((Number(runAt)||0)-Number(now))<=5000;
}
export function executionProvenance({
 skillId,target,outcome='succeeded',executedAt=Date.now(),provider=null,model=null,
 resultCount=null,mediaBytes=null,mediaWidth=null,mediaHeight=null
}={}){
 const skill=skillDefinition(skillId);
 if(!skill||!target)return null;
 const safe={
  contract:GOVERNED_SKILL_CONTRACT,skillId:skill.id,skillVersion:skill.version,
  sideEffect:skill.sideEffect,targetId:clean(target.id,96),
  targetSource:clean(target.targetSource,48),outcome:clean(outcome,24),
  executedAt:Number.isFinite(executedAt)?executedAt:Date.now(),
  authorization:'owner-confirmed-skill-grant'
 };
 if(provider)safe.provider=clean(provider,32);
 if(model)safe.model=clean(model,80);
 if(Number.isFinite(resultCount))safe.resultCount=Math.max(0,Math.min(10,Math.floor(resultCount)));
 if(Number.isFinite(mediaBytes))safe.mediaBytes=Math.max(0,Math.min(25_000_000,Math.floor(mediaBytes)));
 if(Number.isFinite(mediaWidth))safe.mediaWidth=Math.max(0,Math.min(10000,Math.floor(mediaWidth)));
 if(Number.isFinite(mediaHeight))safe.mediaHeight=Math.max(0,Math.min(10000,Math.floor(mediaHeight)));
 return Object.freeze(safe);
}
export function boundedWebSources(input=[]){
 const rows=[];const seen=new Set();
 for(const item of Array.isArray(input)?input:[]){
  if(rows.length>=5)break;
  const url=clean(item?.url,700),title=clean(item?.title,160);
  if(!/^https:\/\//i.test(url)||seen.has(url))continue;
  seen.add(url);rows.push(Object.freeze({url,title:title||url.slice(0,120)}));
 }
 return Object.freeze(rows);
}

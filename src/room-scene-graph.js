// V0.10B: owner-defined CAMERA-RELATIVE scene; never a calibrated floor plan.
// No images, biometrics, participants or sensor frames are stored in scene records.
export const ROOM_SCENE_SCHEMA=1;
export const MAX_ROOM_AREAS=16;
export const MAX_ROOM_OBJECTS=32;
export const AREA_KINDS=Object.freeze(['zone','entrance','desk','seat','other']);
export const OBJECT_KINDS=Object.freeze(['furniture','device','other']);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const label=(v,max=64)=>String(v??'').trim().slice(0,max);
const id=()=>globalThis.crypto?.randomUUID?.()||
 'area-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const clamp=v=>Math.min(1,Math.max(0,v));
export function normalizeAreaRect(input){
 if(!input||typeof input!=='object')return null;
 const {x,y,width,height}=input;
 if(![x,y,width,height].every(finite)||x<0||y<0||width<.025||height<.025||
   x+width>1.000001||y+height>1.000001)return null;
 return Object.freeze({x:clamp(x),y:clamp(y),width:clamp(width),height:clamp(height)});
}
export function emptyRoomScene(){
 return Object.freeze({version:ROOM_SCENE_SCHEMA,id:'local-room',areas:[],objects:[]});
}
export function normalizeRoomScene(input={}){
 const areas=[],objects=[],ids=new Set(),objectIds=new Set();
 for(const row of (Array.isArray(input.areas)?input.areas:[]).slice(0,MAX_ROOM_AREAS)){
  const rect=normalizeAreaRect(row.rect),name=label(row.name);
  const areaId=label(row.id,96);
  if(!rect||!name||!areaId||ids.has(areaId))continue;
  ids.add(areaId);
  areas.push(Object.freeze({id:areaId,name,kind:AREA_KINDS.includes(row.kind)?row.kind:'zone',
    rect,provenance:'owner-defined'}));
 }
 for(const row of (Array.isArray(input.objects)?input.objects:[]).slice(0,MAX_ROOM_OBJECTS)){
  const objectId=label(row.id,96),name=label(row.name);
  if(!objectId||!name||objectIds.has(objectId))continue;
  objectIds.add(objectId);
  objects.push(Object.freeze({id:objectId,name,kind:OBJECT_KINDS.includes(row.kind)?row.kind:'other',
   areaId:ids.has(row.areaId)?row.areaId:null,provenance:'owner-defined'}));
 }
 return Object.freeze({version:ROOM_SCENE_SCHEMA,id:'local-room',areas,objects});
}
export function upsertRoomArea(scene,input){
 const base=normalizeRoomScene(scene);
 const rect=normalizeAreaRect(input?.rect),name=label(input?.name);
 if(!rect||!name)throw Error('Enter an area name and a valid normalized camera rectangle.');
 const areaId=label(input?.id,96)||id(),at=base.areas.findIndex(a=>a.id===areaId);
 if(at<0&&base.areas.length>=MAX_ROOM_AREAS)throw Error('Maximum '+MAX_ROOM_AREAS+' room areas.');
 const entry={id:areaId,name,kind:AREA_KINDS.includes(input?.kind)?input.kind:'zone',
  rect,provenance:'owner-defined'};
 const areas=[...base.areas];
 if(at<0)areas.push(entry);else areas[at]=entry;
 return normalizeRoomScene({...base,areas});
}
export function removeRoomArea(scene,areaId){
 const base=normalizeRoomScene(scene);
 return normalizeRoomScene({...base,areas:base.areas.filter(a=>a.id!==areaId),
  objects:base.objects.map(o=>o.areaId===areaId?{...o,areaId:null}:o)});
}
export function upsertRoomObject(scene,input){
 const base=normalizeRoomScene(scene),name=label(input?.name),objectId=label(input?.id,96)||id();
 if(!name)throw Error('Enter an object name.');
 if(input?.areaId&&!base.areas.some(a=>a.id===input.areaId))
  throw Error('Choose an existing camera-relative area.');
 const at=base.objects.findIndex(o=>o.id===objectId);
 if(at<0&&base.objects.length>=MAX_ROOM_OBJECTS)throw Error('Maximum '+MAX_ROOM_OBJECTS+' objects.');
 const obj={id:objectId,name,kind:OBJECT_KINDS.includes(input?.kind)?input.kind:'other',
  areaId:input?.areaId||null,provenance:'owner-defined'};
 const objects=[...base.objects];if(at<0)objects.push(obj);else objects[at]=obj;
 return normalizeRoomScene({...base,objects});
}
export function removeRoomObject(scene,objectId){
 const base=normalizeRoomScene(scene);
 return normalizeRoomScene({...base,objects:base.objects.filter(o=>o.id!==objectId)});
}
export function sceneTrackAssociation(scene,track){
 const base=normalizeRoomScene(scene);
 // No proximity-as-identity. Caller supplies only existing stable public tracks.
 if(!track||track.status==='occluded'||track.status==='reacquiring'||
  !track.box||!normalizeAreaRect(track.box))
  return Object.freeze({participantId:null,areaId:null,candidates:[],status:'unavailable'});
 const {x,y,width,height}=track.box;
 const point={x:x+width/2,y:y+height};
 if(point.y>=.985)return Object.freeze({participantId:track.participantId||null,
  areaId:null,candidates:[],status:'uncertain-footpoint'});
 const matches=base.areas.filter(a=>point.x>=a.rect.x&&point.x<=a.rect.x+a.rect.width&&
  point.y>=a.rect.y&&point.y<=a.rect.y+a.rect.height).map(a=>a.id);
 return Object.freeze({participantId:track.participantId||null,
  areaId:matches.length===1?matches[0]:null,candidates:matches,
  status:matches.length>1?'ambiguous':matches.length?'camera-relative':'unmapped'});
}
export function mirroredAreaRect(area,mirrored=false){
 const rect=normalizeAreaRect(area?.rect);if(!rect)return null;
 return mirrored?{...rect,x:clamp(1-rect.x-rect.width)}:rect;
}
export function roomSceneGraph(scene,publicTracks=[]){
 const base=normalizeRoomScene(scene);
 return Object.freeze({scene:base,links:(Array.isArray(publicTracks)?publicTracks:[]).slice(0,8)
  .map(t=>Object.freeze({trackId:String(t.id||''),identity:t.participantId?'enrolled-verified':'unverified',
   association:sceneTrackAssociation(base,t)}))});
}

import {emptyRoomScene,normalizeRoomScene,upsertRoomArea,removeRoomArea,
 upsertRoomObject,removeRoomObject,mirroredAreaRect,roomSceneGraph} from './room-scene-graph.js';
import {loadRoomScene,saveRoomScene,clearRoomScene} from './participant-store.js';

// UI adapter only: reuses the existing stable public camera tracks and local DB.
export function createRoomSceneUi({getTracks=()=>[],mirror=()=>false,onChange=()=>{}}={}){
 const $=id=>document.getElementById(id);
 const els={
  editor:$('roomSceneEditor'),preview:$('roomAreaPreview'),layers:$('roomAreaPreviewLayers'),
  occupants:$('roomAreaOccupants'),
  areaForm:$('roomAreaForm'),areaId:$('roomAreaId'),areaName:$('roomAreaName'),
  areaKind:$('roomAreaKind'),x:$('roomAreaX'),y:$('roomAreaY'),w:$('roomAreaW'),
  h:$('roomAreaH'),cancel:$('roomCancelAreaEdit'),areas:$('roomAreaList'),
  objectForm:$('roomObjectForm'),objectName:$('roomObjectName'),objectKind:$('roomObjectKind'),
  objectArea:$('roomObjectArea'),objects:$('roomObjectList'),clear:$('roomClearScene'),
  status:$('roomSceneMessage')
 };
 let scene=emptyRoomScene(),ready=false,writeQueue=Promise.resolve(),epoch=0,drag=null;
 const inform=message=>{if(els.status)els.status.textContent=message;};
 const asNumber=input=>Number(input.value);
 function resetAreaForm(){els.areaForm.reset();els.areaId.value='';
  els.x.value='.15';els.y.value='.20';els.w.value='.35';els.h.value='.50';}
 function areaOptions(){
  const previous=els.objectArea.value;
  els.objectArea.replaceChildren(new Option('Unassigned',''));
  for(const area of scene.areas)els.objectArea.add(new Option(area.name,area.id));
  els.objectArea.value=scene.areas.some(a=>a.id===previous)?previous:'';
 }
 function renderItems(){
  els.areas.replaceChildren();els.objects.replaceChildren();areaOptions();
  for(const area of scene.areas){
   const row=document.createElement('div');row.className='room-scene-item';
   const name=document.createElement('strong');name.textContent=area.name+' · '+area.kind;
   const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';
   edit.addEventListener('click',()=>{
    els.areaId.value=area.id;els.areaName.value=area.name;els.areaKind.value=area.kind;
    for(const [field,key] of [[els.x,'x'],[els.y,'y'],[els.w,'width'],[els.h,'height']])
     field.value=String(area.rect[key]);
    els.areaName.focus();
   });
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';
   remove.setAttribute('aria-label','Remove room area '+area.name);
   remove.addEventListener('click',()=>{
    if(!window.confirm('Remove area '+area.name+'? Linked objects become unassigned.'))return;
    persist(removeRoomArea(scene,area.id),'Removed owner-defined area '+area.name);
   });
   row.append(name,edit,remove);els.areas.append(row);
  }
  for(const object of scene.objects){
   const row=document.createElement('div');row.className='room-scene-item';
   const linked=scene.areas.find(a=>a.id===object.areaId);
   const name=document.createElement('strong');
   name.textContent=object.name+' · '+object.kind+' · '+(linked?.name||'Unassigned');
   const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';
   edit.addEventListener('click',()=>{
    els.objectName.value=object.name;els.objectKind.value=object.kind;
    els.objectArea.value=object.areaId||'';els.objectForm.dataset.editId=object.id;
    els.objectName.focus();
   });
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';
   remove.setAttribute('aria-label','Remove owner-defined object '+object.name);
   remove.addEventListener('click',()=>{
    if(!window.confirm('Remove object '+object.name+'?'))return;
    persist(removeRoomObject(scene,object.id),'Removed owner-defined object '+object.name);
   });
   row.append(name,edit,remove);els.objects.append(row);
  }
 }
 function renderTracks(tracks=getTracks()){
  if(!els.layers||!ready)return;
  els.layers.replaceChildren();
  const graph=roomSceneGraph(scene,tracks);
  if(els.occupants){
   const summary=graph.links.map((entry,index)=>{
    const track=tracks[index]||{},a=entry.association;
    const identity=track.participantId?
      (track.participantName||'Enrolled participant'):'Unverified visitor';
    const zone=graph.scene.areas.find(item=>item.id===a.areaId);
    const position=zone?zone.name+' (camera-relative)':
      a.status==='ambiguous'?'overlapping areas · ambiguous':
      a.status==='uncertain-footpoint'?'position uncertain':
      a.status==='unavailable'?'tracking unavailable':'unmapped';
    return identity+' · '+position;
   }).join(' | ')||'No stable participant associations yet.';
   if(els.occupants.textContent!==summary)els.occupants.textContent=summary;
  }
  for(const area of graph.scene.areas){
   const rect=mirroredAreaRect(area,mirror());
   const block=document.createElement('div');block.className='room-scene-area';
   for(const [name,value] of Object.entries({left:rect.x,top:rect.y,width:rect.width,height:rect.height}))
    block.style[name]=(value*100)+'%';
   block.textContent=area.name;block.title=area.name+' · manually defined camera area';
   els.layers.append(block);
  }
  if(!Array.isArray(tracks))return;
  for(const track of tracks.slice(0,8)){
   const association=graph.links.find(item=>item.trackId===String(track.id||''))?.association;
   if(!association||association.status==='unavailable'||!track.box)continue;
   const x=track.box.x+track.box.width/2,y=track.box.y+track.box.height;
   const marker=document.createElement('div');
   marker.className='room-scene-track'+(!track.participantId?' unverified':'');
   marker.style.left=(Math.max(0,Math.min(1,mirror()?1-x:x))*100)+'%';
   marker.style.top=(Math.max(0,Math.min(1,y))*100)+'%';
   const area=scene.areas.find(a=>a.id===association.areaId);
   marker.title=(track.participantId?(track.participantName||'Enrolled participant'):
    'Unverified visitor')+' · '+(area?area.name:association.status==='ambiguous'?
     'Overlapping areas — location ambiguous':'Area unverified');
   els.layers.append(marker);
  }
 }
 function persist(next,message){
  if(!ready)return;
  const safe=normalizeRoomScene(next);scene=safe;renderItems();renderTracks();
  const latest=++epoch;
  inform('Saving local scene map…');
  writeQueue=writeQueue.catch(()=>{}).then(()=>saveRoomScene(safe)).then(()=>{
   if(latest===epoch){inform('Saved on this device · owner-defined camera map');
    onChange(message);}
  }).catch(error=>{
   if(latest===epoch)inform('Save failed; edits are only in memory: '+error.message);
  });
 }
 function pointerPoint(event){
  const box=els.preview.getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),
   y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};
 }
 function drawDraft(end){
  els.preview.querySelector('.room-scene-draft')?.remove();
  if(!drag)return;
  const x=Math.min(drag.x,end.x),y=Math.min(drag.y,end.y);
  const width=Math.abs(drag.x-end.x),height=Math.abs(drag.y-end.y);
  const draft=document.createElement('div');draft.className='room-scene-draft';
  draft.style.left=(x*100)+'%';draft.style.top=(y*100)+'%';
  draft.style.width=(width*100)+'%';draft.style.height=(height*100)+'%';
  els.preview.append(draft);
 }
 async function init(){
  if(!els.editor)return false;
  try{scene=await loadRoomScene();ready=true;renderItems();renderTracks();
   inform('Local camera-relative map ready. Draw a rectangle or edit the fields.');
  }catch(error){inform('Room map storage unavailable: '+error.message);return false;}
  els.areaForm.addEventListener('submit',event=>{
   event.preventDefault();if(!ready)return;
   try{
    const next=upsertRoomArea(scene,{id:els.areaId.value,name:els.areaName.value,
     kind:els.areaKind.value,
     rect:{x:asNumber(els.x),y:asNumber(els.y),width:asNumber(els.w),height:asNumber(els.h)}});
    const edited=Boolean(els.areaId.value),name=els.areaName.value.trim();
    persist(next,(edited?'Edited':'Added')+' owner-defined camera area '+name);
    resetAreaForm();
   }catch(error){inform(error.message);}
  });
  els.cancel.addEventListener('click',resetAreaForm);
  els.objectForm.addEventListener('submit',event=>{
   event.preventDefault();if(!ready)return;
   try{
    const name=els.objectName.value.trim(),editId=els.objectForm.dataset.editId||'';
    const next=upsertRoomObject(scene,{id:editId,name,kind:els.objectKind.value,
     areaId:els.objectArea.value});
    persist(next,(editId?'Edited':'Added')+' owner-defined room object '+name);
    els.objectForm.reset();delete els.objectForm.dataset.editId;
   }catch(error){inform(error.message);}
  });
  els.clear.addEventListener('click',async()=>{
   if(!window.confirm('Delete every owner-defined room area and object on this device?'))return;
   ++epoch;ready=false;els.layers.replaceChildren();els.areas.replaceChildren();els.objects.replaceChildren();
   inform('Clearing local room map…');
   try{
    await writeQueue.catch(()=>{});await clearRoomScene();
    scene=emptyRoomScene();ready=true;renderItems();renderTracks();
    inform('Owner-defined room map cleared');onChange('Cleared owner-defined room map');
   }catch(error){ready=true;inform('Clear failed: '+error.message);}
  });
  els.preview.addEventListener('pointerdown',event=>{
   if(event.button!==0||!ready)return;event.preventDefault();
   drag=pointerPoint(event);els.preview.setPointerCapture?.(event.pointerId);
   drawDraft(drag);
  });
  els.preview.addEventListener('pointermove',event=>{
   if(drag)drawDraft(pointerPoint(event));
  });
  els.preview.addEventListener('pointerup',event=>{
   if(!drag)return;
   const p=pointerPoint(event),a=drag;drag=null;
   els.preview.querySelector('.room-scene-draft')?.remove();
   // Drawing is in the VISIBLE mirrored preview; records remain camera-raw.
   let x=Math.min(a.x,p.x),y=Math.min(a.y,p.y);
   let width=Math.abs(a.x-p.x),height=Math.abs(a.y-p.y);
   if(width<.025||height<.025){inform('Draw an area at least 2.5% wide and tall.');return;}
   if(mirror())x=1-x-width;
   const values=[x,y,width,height].map(v=>Math.round(v*1000)/1000);
   [els.x,els.y,els.w,els.h].forEach((field,i)=>field.value=String(values[i]));
   inform('Rectangle selected. Name it and choose Save area to persist locally.');
  });
  els.preview.addEventListener('pointercancel',()=>{
   drag=null;els.preview.querySelector('.room-scene-draft')?.remove();
  });
  return true;
 }
 return {init,renderTracks,getScene:()=>scene};
}

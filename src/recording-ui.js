import {
 createRecordingRecord,failRecordingRecord,finishRecordingRecord,
 RECORDING_CHUNK_INTERVAL_MS,RECORDING_MAX_DURATION_MS,
 recordingTurnIdsForInterval
} from './recording-core.js';
import {
 deleteRecording,getRecording,getRecordingMedia,listDialogueTurns,listRecordings,
 pruneExpiredRecordings,pruneRecordingStoragePressure,recoverInterruptedRecordings,
 saveRecording,saveRecordingChunk
} from './participant-store.js';

const when=at=>Number(at)>0?new Date(Number(at)).toLocaleString():'time unavailable';
const duration=value=>{
 const ms=Math.max(0,Number(value)||0),seconds=Math.round(ms/1000);
 return seconds<60?seconds+'s':Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s';
};
const sizeLabel=value=>{
 const bytes=Math.max(0,Number(value)||0);
 if(bytes<1024)return bytes+' B';
 if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
 return (bytes/(1024*1024)).toFixed(1)+' MB';
};

function preferredMimeType(){
 const candidates=[
  'audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'
 ];
 if(typeof MediaRecorder==='undefined')return null;
 if(typeof MediaRecorder.isTypeSupported!=='function')return '';
 return candidates.find(type=>MediaRecorder.isTypeSupported(type))||'';
}

export function createRecordingUi({
 getStream=()=>null,getSessionId=()=>null,getStorageHealth=()=>null,
 getStorageEstimate=async()=>null,onChanged=()=>{},onAudit=()=>{}
}={}){
 const $=id=>document.getElementById(id);
 const controls={
  consent:$('recordingConsent'),retention:$('recordingRetention'),
  start:$('recordingStart'),stop:$('recordingStop'),refresh:$('recordingRefresh'),
  status:$('recordingStatus'),list:$('recordingList'),player:$('recordingPlayer')
 };
 let recorder=null,active=null,sequence=0,writeChain=Promise.resolve();
 let stopReason='owner-stop',failureReason=null,maxTimer=0,playbackUrl=null;
 let finalizeResolve=null,finalizePromise=Promise.resolve(null);

 function status(message){if(controls.status)controls.status.textContent=message;}
 function currentStream(){
  const stream=getStream();
  const live=stream?.getAudioTracks?.().some(track=>track.readyState==='live');
  return live?stream:null;
 }
 function updateControls(){
  const running=Boolean(recorder&&recorder.state!=='inactive'&&active);
  if(controls.start)controls.start.disabled=running||!controls.consent?.checked;
  if(controls.stop)controls.stop.disabled=!running;
  if(controls.retention)controls.retention.disabled=running;
 }
 async function cleanRetention(){
  await pruneExpiredRecordings().catch(()=>0);
  try{
   const estimate=await getStorageEstimate();
   if(estimate)await pruneRecordingStoragePressure(estimate);
  }catch{}
 }
 async function render(){
  if(!controls.list)return [];
  const rows=await listRecordings();
  controls.list.replaceChildren();
  if(!rows.length){
   controls.list.textContent='No saved recordings on this device.';
   updateControls();return rows;
  }
  for(const row of rows){
   const card=document.createElement('article');
   card.className='agent-recall-result recording-row';
   const head=document.createElement('div');head.className='agent-recall-result-head';
   const title=document.createElement('strong');
   title.textContent=(row.status==='recording'?'LIVE · ':'Recording · ')+when(row.startedAt);
   const badge=document.createElement('span');
   badge.textContent=row.status+' · '+row.mediaState;
   head.append(title,badge);
   const meta=document.createElement('small');
   meta.textContent=[
    row.durationMs!==null?duration(row.durationMs):'in progress',
    sizeLabel(row.bytes),
    row.transcriptTurnIds.length+' transcript ref'+(row.transcriptTurnIds.length===1?'':'s'),
    'expires '+new Date(row.expiresAt).toLocaleString()
   ].join(' · ');
   const actions=document.createElement('div');actions.className='agent-recall-tools';
   const play=document.createElement('button');play.type='button';play.textContent='Play';
   play.disabled=row.status!=='available';
   play.addEventListener('click',()=>void playRecording(row.id));
   const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';
   remove.disabled=row.status==='recording';
   remove.addEventListener('click',()=>void deleteOne(row.id));
   actions.append(play,remove);card.append(head,meta,actions);
   if(row.failureReason){
    const problem=document.createElement('small');
    problem.textContent='Media state · '+row.failureReason;card.append(problem);
   }
   controls.list.append(card);
  }
  updateControls();return rows;
 }
 async function playRecording(id){
  status('Validating saved recording media…');
  try{
   const media=await getRecordingMedia(id);
   if(media.state!=='available'||!media.blob){
    status('Recording media '+media.state+' · '+(media.reason||'unavailable')+'.');
    return false;
   }
   if(playbackUrl)URL.revokeObjectURL(playbackUrl);
   playbackUrl=URL.createObjectURL(media.blob);
   controls.player.src=playbackUrl;controls.player.hidden=false;
   await controls.player.play().catch(()=>{});
   status('Playing saved recording · canonical transcript remains separate.');
   return true;
  }catch(error){
   status('Playback unavailable: '+String(error?.message||error));return false;
  }
 }
 async function deleteOne(id){
  if(!window.confirm('Delete this saved recording and its local media from this device?'))return false;
  try{
   if(playbackUrl){URL.revokeObjectURL(playbackUrl);playbackUrl=null;}
   if(controls.player){controls.player.pause();controls.player.removeAttribute('src');controls.player.hidden=true;}
   await deleteRecording(id);await render();onChanged();
   onAudit('Saved recording deleted from this device.',{recordingId:id});
   status('Recording deleted from local storage.');return true;
  }catch(error){
   status('Recording deletion failed: '+String(error?.message||error));return false;
  }
 }
 async function finalize(){
  clearTimeout(maxTimer);maxTimer=0;
  try{
   await writeChain;
   let current=active?await getRecording(active.id):null;
   if(!current)return null;
   const endedAt=Date.now();
   let final;
   if(failureReason){
    final=failRecordingRecord(current,failureReason,endedAt);
   }else{
    const turns=await listDialogueTurns(current.sessionId);
    const ids=recordingTurnIdsForInterval(
     turns,current.sessionId,current.startedAt,endedAt
    );
    final=finishRecordingRecord(current,{
     chunkCount:current.chunkCount,bytes:current.bytes,
     mimeType:recorder?.mimeType||current.mimeType,
     transcriptTurnIds:ids,stoppedReason
    },endedAt);
   }
   final=await saveRecording(final);
   onAudit(
    final.status==='available'
     ?'Saved room recording stopped · '+duration(final.durationMs)+' · '+final.transcriptTurnIds.length+' transcript references.'
     :'Saved room recording ended · '+final.status+' · '+(final.failureReason||'media unavailable')+'.',
    final
   );
   active=null;recorder=null;sequence=0;failureReason=null;stopReason='owner-stop';
   await cleanRetention();await render();onChanged();
   status(final.status==='available'
    ?'Recording saved locally · '+duration(final.durationMs)+' · '+sizeLabel(final.bytes)+'.'
    :'Recording ended as '+final.status+' · '+(final.failureReason||'media unavailable')+'.');
   finalizeResolve?.(final);finalizeResolve=null;
   return final;
  }catch(error){
   status('Recording finalization failed: '+String(error?.message||error));
   finalizeResolve?.(null);finalizeResolve=null;return null;
  }
 }
 async function start(){
  if(active)return active;
  if(!controls.consent?.checked){
   status('Enable the explicit recording/consent checkbox before starting.');return null;
  }
  if(typeof MediaRecorder==='undefined'){
   status('MediaRecorder is not supported in this browser.');return null;
  }
  const health=getStorageHealth()||{};
  if(health.optionalPersistence===false||health.status==='critical'){
   status('Recording blocked while browser storage pressure is critical.');return null;
  }
  await cleanRetention();
  const stream=currentStream();
  if(!stream){
   status('Start ROOM audio first. Recording reuses that existing microphone stream.');return null;
  }
  const sessionId=String(getSessionId()||'');
  if(!sessionId){status('Canonical session identity is unavailable.');return null;}
  const retentionDays=Number(controls.retention?.value)||7;
  const mimeType=preferredMimeType();
  try{
   active=await saveRecording(createRecordingRecord({
    sessionId,retentionDays,mimeType:mimeType||null
   },Date.now()));
   sequence=0;failureReason=null;stopReason='owner-stop';writeChain=Promise.resolve();
   recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
   finalizePromise=new Promise(resolve=>{finalizeResolve=resolve;});
   recorder.addEventListener('dataavailable',event=>{
    if(!active||!event.data||event.data.size<=0)return;
    const id=active.id,seq=sequence++;
    writeChain=writeChain.then(async()=>{
     const updated=await saveRecordingChunk(id,seq,event.data);
     if(active?.id===id)active=updated;
    }).catch(error=>{
     failureReason='media-chunk-write-failed: '+String(error?.message||error);
     try{if(recorder?.state!=='inactive')recorder.stop();}catch{}
    });
   });
   recorder.addEventListener('error',event=>{
    failureReason='media-recorder-error: '+String(event.error?.message||event.error?.name||'unknown');
    try{if(recorder?.state!=='inactive')recorder.stop();}catch{}
   });
   recorder.addEventListener('stop',()=>{void finalize();},{once:true});
   recorder.start(RECORDING_CHUNK_INTERVAL_MS);
   maxTimer=window.setTimeout(()=>{
    if(recorder?.state!=='inactive'){
     stopReason='max-duration';recorder.stop();
    }
   },RECORDING_MAX_DURATION_MS);
   updateControls();await render();onChanged();
   onAudit('Owner started saved room recording · explicit local recording active.',active);
   status('RECORDING · saved incrementally on this device · retention '+retentionDays+' day'+
    (retentionDays===1?'':'s')+'.');
   return active;
  }catch(error){
   if(active){
    const failed=failRecordingRecord(active,String(error?.message||error),Date.now());
    await saveRecording(failed).catch(()=>{});
   }
   active=null;recorder=null;updateControls();
   status('Recording could not start: '+String(error?.message||error));return null;
  }
 }
 async function stop(reason='owner-stop'){
  if(!active||!recorder)return null;
  stopReason=String(reason||'owner-stop').slice(0,96);
  if(recorder.state!=='inactive'){
   try{recorder.requestData();}catch{}
   recorder.stop();
  }
  return finalizePromise;
 }
 async function init(){
  if(!controls.start)return false;
  await recoverInterruptedRecordings().catch(()=>0);
  await cleanRetention();
  controls.consent.checked=false;
  controls.consent.addEventListener('change',updateControls);
  controls.start.addEventListener('click',()=>void start());
  controls.stop.addEventListener('click',()=>void stop('owner-stop'));
  controls.refresh?.addEventListener('click',()=>void cleanRetention().then(render));
  await render();updateControls();
  status('Saved recording is off. Start ROOM audio, confirm consent, then choose Start recording.');
  return true;
 }
 function destroy(){
  clearTimeout(maxTimer);maxTimer=0;
  if(recorder?.state!=='inactive'){
   stopReason='page-exit';try{recorder.stop();}catch{}
  }
  if(playbackUrl)URL.revokeObjectURL(playbackUrl);
  playbackUrl=null;
 }
 return {
  init,start,stop,destroy,refresh:render,
  stopIfActive:reason=>active?stop(reason):Promise.resolve(null),
  isRecording:()=>Boolean(active),
  activeRecording:()=>active
 };
}

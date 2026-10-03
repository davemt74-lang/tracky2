import {facePreviewRect} from './src/face-preview.js';
import {queryLocalOllama,buildAgentMessages,validateLocalAgentEndpoint} from './src/agent-provider.js';
import {greetingForParticipant,localAgentReply,appendAgentHistory,shouldGreet,loadAgentHistory,saveAgentHistory} from './src/agent-conversation.js';
// Controller receives the existing game camera, recognition and room-audio hooks.
// It never instantiates duplicate identity, camera, transcription or voice models.
export function createAgentRoom({participants,stopAudio,startAudio,startCamera,stopCamera,suppressMic}){
 const $=id=>document.getElementById(id),ui={
  box:$('agentCameraBoxes'),badge:$('agentCameraBadge'),scene:$('agentSceneLabel'),
  camStart:$('agentCameraStart'),camStop:$('agentCameraStop'),camStatus:$('agentCameraControlStatus'),camControls:$('agentCameraControls'),
  thread:$('agentConversationThread'),speaker:$('agentSpeakingIndicator'),
  voice:$('agentVoiceSelect'),speak:$('agentSpeakEnabled'),save:$('agentSaveHistory'),
  useModel:$('agentUseModel'),modelEndpoint:$('agentLocalEndpoint'),modelName:$('agentLocalModel'),
  modelStatus:$('agentModelStatus'),
  clear:$('agentClearHistory'),resume:$('agentResumeAudio'),accordion:$('agentRoomAccordion'),
  heading:$('agentParticipantHeading'),modal:$('agentVoiceModal'),
  close:$('agentCloseVoiceModal'),backdrop:$('agentVoiceBackdrop'),title:$('agentVoiceModalTitle')
 };
 let entries=[],voiceModuleLoaded=false,open=false,lastTurnAt=0,responsePending=false;
 let modelController=null;
 let lastFocusedElement=null;
 const greeted=new Map(),speech=globalThis.speechSynthesis||null;
 const voices=()=>typeof speech?.getVoices==='function'?speech.getVoices():[];
 function showThread(){
  ui.thread.replaceChildren();
  for(const entry of entries.slice(-45)){
   const row=document.createElement('article');row.className='agent-thread-entry '+entry.role;
   const title=document.createElement('strong');title.textContent=entry.role==='agent'?'AGENT':entry.role==='participant'?'Participant':'System';
   const body=document.createElement('p');body.textContent=entry.text;
   const time=document.createElement('time');time.dateTime=new Date(entry.at).toISOString();
   time.textContent=new Date(entry.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
   row.append(title,body,time);ui.thread.append(row);
  }
  ui.thread.scrollTop=ui.thread.scrollHeight;
 }
 function append(role,text,participantId=null){
  entries=appendAgentHistory(entries,{role,text,participantId,at:Date.now()});
  if(ui.save.checked)saveAgentHistory(localStorage,entries,true);
  showThread();
 }
 function refillVoices(){
  const prior=ui.voice.value;
  ui.voice.replaceChildren();
  const standard=document.createElement('option');standard.value='';standard.textContent='System default';
  ui.voice.append(standard);
  for(const voice of voices()){
   const option=document.createElement('option');option.value=voice.voiceURI;
   option.textContent=voice.name+' · '+voice.lang;ui.voice.append(option);
  }
  ui.voice.value=prior&&[...ui.voice.options].some(o=>o.value===prior)?prior:'';
 }
 function notifySpeech(speaking){
  window.dispatchEvent(new CustomEvent('tracky:agent-speech-state',{detail:{speaking}}));
 }
 function stopSpeech(){
  if(speech?.speaking)speech.cancel();
  notifySpeech(false);suppressMic(false);ui.speaker.textContent='Agent listening';
 }
 function say(text){
  if(!text)return;
  append('agent',text);
  if(!ui.speak.checked||!speech||typeof SpeechSynthesisUtterance==='undefined')return;
  stopSpeech();suppressMic(true);
  ui.speaker.textContent='Agent speaking';
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.rate=.98;utterance.volume=.85;
  const voice=voices().find(v=>v.voiceURI===ui.voice.value);
  if(voice)utterance.voice=voice;
  let released=false;
  const release=()=>{if(released)return;released=true;notifySpeech(false);suppressMic(false);ui.speaker.textContent='Agent listening';};
  utterance.addEventListener('start',()=>notifySpeech(true),{once:true});
  utterance.addEventListener('end',release,{once:true});
  utterance.addEventListener('error',release,{once:true});
  speech.speak(utterance);
 }
 function greet(track,person){
  if(!person?.id||!track?.participantId)return;
  const now=Date.now();
  if(!shouldGreet(person.id,greeted,now))return;
  greeted.set(person.id,now);
  say(greetingForParticipant(person));
 }
 async function onDialogue(turn){
  if(!turn?.transcript?.trim())return;
  const prior=entries.slice();
  append('participant',turn.transcript,turn.participantId||null);
  const now=Date.now();
  if(now-lastTurnAt<4000||responsePending||open)return;
  lastTurnAt=now;responsePending=true;
  try{
   const known=participants().find(x=>x.id===turn.participantId);
   if(ui.useModel.checked){
    let endpoint;
    try{endpoint=validateLocalAgentEndpoint(ui.modelEndpoint.value);}
    catch(error){ui.modelStatus.textContent=error.message;endpoint=null;}
    if(endpoint){
     modelController=new AbortController();
     const timeout=setTimeout(()=>modelController.abort(),16000);
     ui.modelStatus.textContent='Local model thinking…';
     try{
      const reply=await queryLocalOllama({
       endpoint,model:ui.modelName.value.trim(),
       messages:buildAgentMessages(prior,turn.transcript,known?.name||''),
       signal:modelController.signal
      });
      if(!open){say(reply);ui.modelStatus.textContent='Local model connected · text-only';}
      return;
     }catch(error){
      ui.modelStatus.textContent='Local model unavailable: '+error.message+' · using basic reply';
     }finally{clearTimeout(timeout);modelController=null;}
    }
   }
   const recent=prior.filter(x=>x.role==='participant').slice(-4).map(x=>x.text);
   const reply=localAgentReply(turn.transcript,{name:known?.name||'',previousTopics:recent});
   if(reply&&!open)say(reply);
  }finally{responsePending=false;}
 }
 function renderBoxes(tracks,video,mirror){
  if(!video?.videoWidth||!video?.videoHeight)return;
  const width=ui.box.clientWidth,height=ui.box.clientHeight;
  ui.scene.textContent=tracks.length?tracks.length+' stable person'+(tracks.length===1?'':'s')+' in view':'Searching for participants';
  ui.box.replaceChildren();
  for(const track of tracks){
   const box=track.face?.box||track.box;
   if(!box)continue;
   const rect=facePreviewRect(box,{videoWidth:video.videoWidth,videoHeight:video.videoHeight,
     displayWidth:width,displayHeight:height,mirror,fit:'cover'});
   if(!rect)continue;
   const outline=document.createElement('div');
   outline.className='agent-person-box '+(track.participantId?'known':'visitor');
   for(const [prop,value] of [['left',rect.left],['top',rect.top],['width',rect.width],['height',rect.height]])
     outline.style[prop]=value+'px';
   const label=document.createElement('span');
   label.textContent=track.participantName||track.visitorLabel||'Person';
   outline.append(label);ui.box.append(outline);
  }
 }
 function refreshModalName(id){
  const person=participants().find(x=>x.id===id);
  ui.title.textContent=person?.name?'Voice Profile · '+person.name:'Voice Profile';
 }
 async function openVoice(participantId){
  if(!participantId||open)return;
  const person=participants().find(x=>x.id===participantId);
  if(!person)return;
  open=true;
  modelController?.abort();
  stopSpeech();
  await stopAudio();
  lastFocusedElement=document.activeElement;
  ui.modal.hidden=false;ui.modal.setAttribute('aria-hidden','false');
  refreshModalName(participantId);
  document.body.dataset.participantId=participantId;
  try{
   if(!voiceModuleLoaded){await import('./participant-voice.js');voiceModuleLoaded=true;}
   window.dispatchEvent(new CustomEvent('tracky:participant-loaded',{detail:{participantId}}));
   ui.close.focus();
  }catch(error){
   console.error(error);
   $('agentVoiceModalNotice').textContent='Voice module could not load. Close and retry.';
  }
 }
 async function closeVoice(){
  if(!open)return;
  const stop=$('stopVoiceSample');
  if(stop&&!stop.disabled)stop.click();
  ui.modal.hidden=true;ui.modal.setAttribute('aria-hidden','true');
  open=false;
  if(lastFocusedElement?.isConnected)lastFocusedElement.focus();
  await startAudio();
 }
 function init(){
  ui.box.hidden=false;ui.badge.hidden=false;ui.camControls.hidden=false;ui.accordion.hidden=false;
  ui.heading.hidden=false;ui.thread.hidden=false;
  // Dialogue and agent conversation remain in the dedicated Conversation tab.
  const map=$('roomRadar'),live=document.querySelector('.room-voice-fusion');
  if(map)$('agentRoomMapMount').append(map);
  if(live)$('agentLiveStatusMount').append(live);
  ui.save.checked=false;
  ui.useModel.checked=false;
  ui.useModel.addEventListener('change',()=>{
    if(ui.useModel.checked){
      try{validateLocalAgentEndpoint(ui.modelEndpoint.value);
       ui.modelStatus.textContent='Enabled · messages will be sent only to the local model.';
      }catch(error){ui.useModel.checked=false;ui.modelStatus.textContent=error.message;}
    }else ui.modelStatus.textContent='Off. Local scripted conversation is active.';
  });
  refillVoices();
  if(speech?.addEventListener)speech.addEventListener('voiceschanged',refillVoices);
  ui.clear.addEventListener('click',()=>{
    if(!window.confirm('Clear local AGENT conversation history?'))return;
    entries=[];try{localStorage.removeItem('tracky2-agent-history-v1');}catch{}
    showThread();
  });
  ui.save.addEventListener('change',()=>{
    if(ui.save.checked){entries=entries.length?entries:loadAgentHistory(localStorage);saveAgentHistory(localStorage,entries,true);}
    showThread();
  });
  ui.resume.addEventListener('click',async()=>{await startAudio();});
  ui.camStart.addEventListener('click',()=>void startCamera());
  ui.camStop.addEventListener('click',()=>stopCamera());
  ui.close.addEventListener('click',()=>{void closeVoice();});
  ui.backdrop.addEventListener('click',()=>{void closeVoice();});
  document.addEventListener('keydown',event=>{
    if(!open)return;
    if(event.key==='Escape'){event.preventDefault();void closeVoice();return;}
    if(event.key!=='Tab')return;
    const focusable=[...ui.modal.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(node=>!node.disabled&&!node.hidden&&node.getClientRects().length>0);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  window.addEventListener('tracky:participant-voice-updated',()=>refreshModalName(document.body.dataset.participantId));
  showThread();
  window.dispatchEvent(new CustomEvent('tracky:agent-tab-ready'));
  window.dispatchEvent(new CustomEvent('tracky:agent-ready',{detail:{enabled:true}}));
 }
 return {init,greet,onDialogue,renderBoxes,openVoice,setCameraActive(active){
  if(!active){ui.box.replaceChildren();ui.scene.textContent='Camera offline';}
  ui.camStart.disabled=active;ui.camStop.disabled=!active;
  ui.camStatus.textContent=active?'Camera live':'Camera offline · start when ready';
 },setAudioActive(active){
  ui.resume.hidden=active;
  if(!open)ui.speaker.textContent=active?'Agent listening':'Microphone unavailable · enable audio';
 },destroy(){modelController?.abort();stopSpeech();window.dispatchEvent(new CustomEvent('tracky:agent-ready',{detail:{enabled:false}}));}};
}

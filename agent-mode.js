import {facePreviewRect} from './src/face-preview.js';
import {conversationTimeline} from './src/conversation-timeline.js';
import {orbSpatialTarget} from './src/orb-spatial-core.js';
import {queryLocalOllama,buildAgentMessages,validateLocalAgentEndpoint} from './src/agent-provider.js';
import {greetingForParticipant,localAgentReply,appendAgentHistory,shouldGreet,loadAgentHistory,saveAgentHistory} from './src/agent-conversation.js';
import {replyEligibility} from './src/conversation-listening-core.js';
import {speakerAssociationLabel} from './src/speaker-participant-core.js';
import {
 multiParticipantReplyPolicy,groupConversationContext,agentHistoryForScope,
 conversationContextLabel
} from './src/multi-conversation-core.js';
import {meetingAgentReplyPolicy} from './src/meeting-core.js';
// Controller receives the existing game camera, recognition and room-audio hooks.
// It never instantiates duplicate identity, camera, transcription or voice models.
export function createAgentRoom({participants,getDialogueTurns=()=>[],getMemories=()=>[],getMeeting=()=>null,getScene=()=>null,editTranscript=async()=>{},editAttribution=async()=>{},stopAudio,startAudio,startCamera,stopCamera,suppressMic}){
 const $=id=>document.getElementById(id),ui={
  box:$('agentCameraBoxes'),badge:$('agentCameraBadge'),scene:$('agentSceneLabel'),
  camStart:$('agentCameraStart'),camStop:$('agentCameraStop'),camStatus:$('agentCameraControlStatus'),camControls:$('agentCameraControls'),
  thread:$('agentConversationThread'),speaker:$('agentSpeakingIndicator'),
  voice:$('agentVoiceSelect'),speak:$('agentSpeakEnabled'),save:$('agentSaveHistory'),
  follow:$('agentFollowParticipant'),distanceAudio:$('agentDistanceAudio'),
  spatialStatus:$('agentSpatialStatus'),
  useModel:$('agentUseModel'),modelEndpoint:$('agentLocalEndpoint'),modelName:$('agentLocalModel'),
  modelStatus:$('agentModelStatus'),
  clear:$('agentClearHistory'),resume:$('agentResumeAudio'),accordion:$('agentRoomAccordion'),
  heading:$('agentParticipantHeading'),modal:$('agentVoiceModal'),
  close:$('agentCloseVoiceModal'),backdrop:$('agentVoiceBackdrop'),title:$('agentVoiceModalTitle')
 };
 let entries=[],voiceModuleLoaded=false,open=false,lastTurnAt=0,responsePending=false;
 let responseGeneration=0;
 let modelController=null,lastProximityVolume=.85,lastSpeakerId=null;
 let lastFocusedElement=null;
 const greeted=new Map(),speech=globalThis.speechSynthesis||null;
 const voices=()=>typeof speech?.getVoices==='function'?speech.getVoices():[];
 function showThread(){
  ui.thread.replaceChildren();
  const items=conversationTimeline(getDialogueTurns(),entries,participants()).slice(-75);
  if(!items.length){
   const empty=document.createElement('p');empty.className='dialogue-empty';
   empty.textContent='Start room audio to begin your conversation with AGENT.';
   ui.thread.append(empty);return;
  }
  for(const entry of items){
   const row=document.createElement('article');row.className='agent-chat-message '+entry.role;
   const avatar=document.createElement('span');avatar.className='agent-chat-avatar';
   if(entry.photo&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(entry.photo)){
    const photo=document.createElement('img');photo.src=entry.photo;photo.alt='';avatar.append(photo);
   }else avatar.textContent=entry.role==='agent'?'◎':entry.name?.slice(0,1)?.toUpperCase()||'?';
   const bubble=document.createElement('div');bubble.className='agent-chat-bubble';
   const meta=document.createElement('div');meta.className='agent-chat-meta';
   const name=document.createElement('strong');name.textContent=entry.name;
   const time=document.createElement('time');
   if(Number.isFinite(entry.at)&&entry.at>0){
    time.dateTime=new Date(entry.at).toISOString();
    time.textContent=new Date(entry.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
   }
   meta.append(name,time);
   const body=document.createElement('p');body.textContent=entry.text;
   bubble.append(meta,body);
   if(entry.source==='transcript'){
    const controls=document.createElement('div');controls.className='agent-transcript-controls';
    if(entry.edited){
     const badge=document.createElement('small');badge.textContent='Transcript corrected by owner · original retained locally';
     badge.className='agent-transcript-edited';controls.append(badge);
    }
    const edit=document.createElement('button');edit.type='button';edit.textContent='Edit transcript';
    edit.setAttribute('aria-label','Correct transcript without changing speaker attribution');
    edit.addEventListener('click',()=>{
     edit.hidden=true;
     const form=document.createElement('form');form.className='agent-transcript-edit-form';
     const field=document.createElement('textarea');field.value=entry.text;field.maxLength=800;
     field.required=true;field.rows=3;field.setAttribute('aria-label','Correct transcript wording');
     const save=document.createElement('button');save.type='submit';save.textContent='Save correction';
     const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
     const message=document.createElement('span');message.setAttribute('role','status');
     cancel.addEventListener('click',()=>{form.remove();edit.hidden=false;});
     form.addEventListener('submit',async event=>{
      event.preventDefault();save.disabled=true;
      try{
       const revised=await editTranscript(entry.id,field.value);
       if(revised)showThread();else{message.textContent='Correction was not saved';save.disabled=false;}
      }catch(error){message.textContent=error?.message||'Correction failed';save.disabled=false;}
     });
     form.append(field,save,cancel,message);controls.append(form);field.focus();
    });
    controls.append(edit);
    if((entry.multiPersonAttributionIntervals||[]).length){
     const correct=document.createElement('button');
     correct.type='button';correct.textContent='Correct speaker attribution';
     correct.setAttribute('aria-label','Correct speaker attribution for a time interval');
     correct.addEventListener('click',()=>{
      correct.hidden=true;
      const form=document.createElement('form');form.className='agent-transcript-edit-form';
      const intervalSelect=document.createElement('select');
      intervalSelect.setAttribute('aria-label','Speaker attribution interval');
      for(const interval of entry.multiPersonAttributionIntervals||[]){
       const option=document.createElement('option');option.value=interval.id;
       const start=(Number(interval.startOffsetMs||0)/1000).toFixed(1);
       const end=(Number(interval.endOffsetMs||0)/1000).toFixed(1);
       option.textContent=start+'–'+end+'s · '+String(interval.state||'unknown')+
        (interval.speakerClusterId?' · '+interval.speakerClusterId:'');
       intervalSelect.append(option);
      }
      const participantSelect=document.createElement('select');
      participantSelect.setAttribute('aria-label','Corrected speaker');
      const clear=document.createElement('option');clear.value='';clear.textContent='Unknown / clear attribution';
      participantSelect.append(clear);
      for(const person of participants()){
       const option=document.createElement('option');option.value=person.id;
       option.textContent=person.nickname||person.name||'Participant';
       participantSelect.append(option);
      }
      const syncParticipant=()=>{
       const interval=(entry.multiPersonAttributionIntervals||[])
        .find(item=>item.id===intervalSelect.value);
       participantSelect.value=interval?.participantId||'';
      };
      intervalSelect.addEventListener('change',syncParticipant);syncParticipant();
      const save=document.createElement('button');save.type='submit';save.textContent='Save speaker correction';
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
      const message=document.createElement('span');message.setAttribute('role','status');
      cancel.addEventListener('click',()=>{form.remove();correct.hidden=false;});
      form.addEventListener('submit',async event=>{
       event.preventDefault();save.disabled=true;
       try{
        const revised=await editAttribution(entry.id,{
         intervalId:intervalSelect.value,
         participantId:participantSelect.value||null,
         note:'Owner UI correction'
        });
        if(revised){
         message.textContent='Owner corrected speaker attribution';
         showThread();
        }else{
         message.textContent='Speaker correction was not saved';save.disabled=false;
        }
       }catch(error){
        message.textContent=error?.message||'Speaker correction failed';save.disabled=false;
       }
      });
      form.append(intervalSelect,participantSelect,save,cancel,message);
      controls.append(form);intervalSelect.focus();
     });
     controls.append(correct);
    }
    bubble.append(controls);
   }
   if(entry.role==='participant'){
    const note=document.createElement('small');
    note.className=entry.verified?'agent-chat-verified':'agent-chat-unverified';
    note.textContent=entry.verified
      ? 'Speaker link · '+speakerAssociationLabel(entry.associationState)
      : 'Speaker unverified · '+speakerAssociationLabel(entry.associationState);
    const transcriptMeta=document.createElement('small');
    transcriptMeta.className='agent-transcript-provenance';
    const bits=[String(entry.transcriptState||'final').toUpperCase(),
      entry.transcriptSource||'local-whisper'];
    if(entry.transcriptModelRevision)bits.push('rev '+String(entry.transcriptModelRevision).slice(0,8));
    if(Number.isFinite(entry.transcriptProcessingDurationMs))
      bits.push(Math.round(entry.transcriptProcessingDurationMs)+'ms');
    transcriptMeta.textContent='Transcript · '+bits.join(' · ');
    const conversationMeta=document.createElement('small');
    conversationMeta.className='agent-conversation-provenance';
    conversationMeta.textContent='Conversation · '+conversationContextLabel(entry);
    const fusionMeta=document.createElement('small');
    fusionMeta.className='agent-conversation-provenance';
    const fusionBits=[
     entry.multimodalState||'not-recorded',
     Number.isFinite(entry.multimodalConfidence)
      ? Math.round(entry.multimodalConfidence*100)+'% '+(entry.multimodalConfidenceBand||'')
      : '',
     ...(entry.multimodalConflicts||[]).map(value=>'conflict:'+value),
     ...(entry.multimodalAbstentionReason?['abstain:'+entry.multimodalAbstentionReason]:[])
    ].filter(Boolean);
    fusionMeta.textContent='Fusion · '+fusionBits.join(' · ');
    const diarizationMeta=document.createElement('small');
    diarizationMeta.className='agent-conversation-provenance';
    const diarizationBits=[
     entry.diarizationState||'not-recorded',
     (entry.diarizationSpeakerCount||0)+' speaker cluster'+
      ((entry.diarizationSpeakerCount||0)===1?'':'s'),
     entry.diarizationOverlapObserved?'overlap unresolved':'',
     entry.diarizationAttributionSuppressed?'whole-turn identity suppressed':''
    ].filter(Boolean);
    diarizationMeta.textContent='Diarization · '+diarizationBits.join(' · ');
    const continuousMeta=document.createElement('small');
    continuousMeta.className='agent-conversation-provenance';
    const continuousBits=[
     entry.continuousFusionState||'not-recorded',
     (entry.continuousFusionParticipantIds||[]).length
      ?(entry.continuousFusionParticipantIds||[]).length+' participant link'+
       ((entry.continuousFusionParticipantIds||[]).length===1?'':'s')
      :'no participant link',
     entry.continuousFusionUnresolvedWindows
      ?entry.continuousFusionUnresolvedWindows+' unresolved window'+
       (entry.continuousFusionUnresolvedWindows===1?'':'s'):'',
     ...(entry.continuousFusionConflicts||[]).map(value=>'conflict:'+value)
    ].filter(Boolean);
    continuousMeta.textContent='Continuous fusion · '+continuousBits.join(' · ');
    const attributionMeta=document.createElement('small');
    attributionMeta.className='agent-conversation-provenance';
    const attributionBits=[
     entry.multiPersonAttributionState||'not-recorded',
     (entry.multiPersonAttributionIntervals||[]).length+
      ' interval'+((entry.multiPersonAttributionIntervals||[]).length===1?'':'s'),
     entry.multiPersonOwnershipChangeCount
      ?entry.multiPersonOwnershipChangeCount+' ownership change'+
       (entry.multiPersonOwnershipChangeCount===1?'':'s'):'',
     entry.multiPersonInterruptionCount
      ?entry.multiPersonInterruptionCount+' interruption'+
       (entry.multiPersonInterruptionCount===1?'':'s'):'',
     entry.multiPersonPartialAttribution?'partial attribution':'',
     (entry.multiPersonAttributionCorrections||[]).length?'owner corrected':''
    ].filter(Boolean);
    attributionMeta.textContent='Turn attribution · '+attributionBits.join(' · ');
    const spatialAudioMeta=document.createElement('small');
    spatialAudioMeta.className='agent-conversation-provenance';
    const spatialAudioBits=[
     entry.spatialAudioSourceState||'source-unavailable',
     entry.spatialAudioDirection||'unavailable',
     Number.isFinite(entry.spatialAudioDirectionConfidence)
      ?Math.round(entry.spatialAudioDirectionConfidence*100)+'%':'',
     entry.spatialAudioMetric?'metric floor context':'non-metric context',
     entry.spatialAudioConflict?'conflict:'+entry.spatialAudioConflict:''
    ].filter(Boolean);
    spatialAudioMeta.textContent='Spatial audio · '+spatialAudioBits.join(' · ');
    bubble.append(note,transcriptMeta,conversationMeta,fusionMeta,diarizationMeta,
     continuousMeta,attributionMeta,spatialAudioMeta);
   }
   row.append(avatar,bubble);ui.thread.append(row);
  }
  ui.thread.scrollTop=ui.thread.scrollHeight;
 }
 function append(role,text,participantId=null,scopeId=null){
  entries=appendAgentHistory(entries,{role,text,participantId,scopeId,at:Date.now()});
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
 function say(text,participantId=null,scopeId=null){
  if(!text)return false;
  append('agent',text,participantId,scopeId);
  if(!ui.speak.checked||!speech||typeof SpeechSynthesisUtterance==='undefined')return true;
  stopSpeech();suppressMic(true);
  ui.speaker.textContent='Agent speaking';
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.rate=.98;utterance.volume=ui.distanceAudio?.checked?lastProximityVolume:.85;
  const voice=voices().find(v=>v.voiceURI===ui.voice.value);
  if(voice)utterance.voice=voice;
  let released=false;
  const release=()=>{if(released)return;released=true;notifySpeech(false);suppressMic(false);ui.speaker.textContent='Agent listening';};
  utterance.addEventListener('start',()=>notifySpeech(true),{once:true});
  // Word boundaries pulse the orb in real speech cadence. CSS handles unsupported voices.
  utterance.addEventListener('boundary',event=>{
   const word=(text.slice(Math.max(0,event.charIndex||0)).match(/^\S+/)||[''])[0];
   window.dispatchEvent(new CustomEvent('tracky:agent-speech-cadence',{
    detail:{strength:Math.min(1,Math.max(.24,word.length/11)),
      durationMs:Math.max(200,Math.min(490,word.length*48))}}));
  });
  utterance.addEventListener('end',release,{once:true});
  utterance.addEventListener('error',release,{once:true});
  speech.speak(utterance);
  return true;
 }
 function greet(track,person){
  if(getMeeting()?.status==='active')return false;
  if(!person?.id||!track?.participantId||
    track.participantId!==person.id||
    person.recognitionEnabled===false||
    person.agentGreetingEnabled===false)return false;
  const now=Date.now();
  if(!shouldGreet(person.id,greeted,now))return false;
  greeted.set(person.id,now);
  say(greetingForParticipant(person),person.id,'scope:p:'+person.id);
  return true;
 }
 async function onDialogue(turn){
  if(!turn?.transcript?.trim())return;
  // Canonical participant context is scoped to the current conversation membership.
  // AGENT history is separately scoped; no participant transcript is duplicated there.
  const prior=[
   ...groupConversationContext(turn,getDialogueTurns(),participants()),
   ...agentHistoryForScope(entries,turn)
  ].sort((a,b)=>a.at-b.at).slice(-12);
  lastSpeakerId=turn.participantId||null;
  showThread();
  const now=Date.now();
  const policy=replyEligibility({
   turn,now,lastReplyAt:lastTurnAt,responsePending,modalOpen:open,
   agentSpeaking:Boolean(speech?.speaking)
  });
  if(policy.action==='cancel-agent-speech'){
   responseGeneration+=1;
   responsePending=false;
   modelController?.abort();
   stopSpeech();
   ui.modelStatus.textContent='Agent speech/reply cancelled by verified stop request.';
   return;
  }
  const meetingPolicy=meetingAgentReplyPolicy(getMeeting(),turn);
  if(!meetingPolicy.allow){
   if(responsePending){
    responseGeneration+=1;responsePending=false;modelController?.abort();
   }
   ui.modelStatus.textContent=meetingPolicy.reason;
   return;
  }
  const groupPolicy=multiParticipantReplyPolicy(turn);
  if(!groupPolicy.allow){
   if(responsePending){
    responseGeneration+=1;
    responsePending=false;
    modelController?.abort();
    ui.modelStatus.textContent='Pending AGENT reply cancelled · attention moved to room conversation.';
   }else{
    ui.modelStatus.textContent=groupPolicy.reason;
   }
   return;
  }
  if(policy.action==='replace-pending-reply'){
   responseGeneration+=1;
   responsePending=false;
   modelController?.abort();
   ui.modelStatus.textContent='Newer eligible turn replaced the pending reply.';
  }
  if(!policy.allow)return;
  lastTurnAt=now;responsePending=true;
  const responseToken=++responseGeneration;
  try{
   const known=participants().find(x=>x.id===turn.participantId);
   const verifiedMemoryScope=Boolean(known&&turn.participantId&&turn.attribution!=='unknown');
   const memoryContext=verifiedMemoryScope?getMemories(turn.participantId):[];
   if(ui.useModel.checked){
    let endpoint;
    try{endpoint=validateLocalAgentEndpoint(ui.modelEndpoint.value);}
    catch(error){ui.modelStatus.textContent=error.message;endpoint=null;}
    if(endpoint){
     const controller=new AbortController();
     modelController=controller;
     const timeout=setTimeout(()=>controller.abort(),16000);
     ui.modelStatus.textContent='Local model thinking…';
     try{
      const reply=await queryLocalOllama({
       endpoint,model:ui.modelName.value.trim(),
       messages:buildAgentMessages(prior,turn.transcript,
        verifiedMemoryScope?(known?.name||''):'',memoryContext,turn),
       signal:controller.signal
      });
      if(responseToken!==responseGeneration||open)return;
      if(!replyEligibility({turn,now:Date.now(),minGapMs:0,lastReplyAt:0}).allow)return;
      if(!meetingAgentReplyPolicy(getMeeting(),turn).allow)return;
      say(reply,turn.participantId||null,turn.conversationScopeId||null);
      ui.modelStatus.textContent='Local model connected · scoped conversation';
      return;
     }catch(error){
      if(responseToken!==responseGeneration)return;
      ui.modelStatus.textContent='Local model unavailable: '+error.message+' · using basic reply';
     }finally{
      clearTimeout(timeout);
      if(modelController===controller)modelController=null;
     }
    }
   }
   if(responseToken!==responseGeneration||open)return;
   if(!replyEligibility({turn,now:Date.now(),minGapMs:0,lastReplyAt:0}).allow)return;
   if(!meetingAgentReplyPolicy(getMeeting(),turn).allow)return;
   const recent=prior.filter(x=>x.role==='participant').slice(-4).map(x=>x.text);
   const reply=localAgentReply(turn.transcript,{name:verifiedMemoryScope?(known?.name||''):'',previousTopics:recent,memories:memoryContext});
   if(reply)say(reply,turn.participantId||null,turn.conversationScopeId||null);
  }finally{
   if(responseToken===responseGeneration)responsePending=false;
  }
 }
 function renderBoxes(tracks,video,mirror){
  if(!video?.videoWidth||!video?.videoHeight)return;
  const playfield=$('playfield');
  const width=playfield.clientWidth,height=playfield.clientHeight;
  const calibration=getScene()?.calibration||null;
  const target=orbSpatialTarget(tracks,{videoWidth:video.videoWidth,videoHeight:video.videoHeight,
   displayWidth:width,displayHeight:height,mirror},ui.follow?.value||lastSpeakerId,calibration);
  if(target)lastProximityVolume=target.volume;
  else lastProximityVolume=.85;
  if(ui.spatialStatus){
   ui.spatialStatus.textContent=target?.distanceMode==='calibrated-floor'
    ? 'Owner-calibrated floor plane · ~'+target.distanceM.toFixed(2)+'m from listener · '+
      target.direction+' '+Math.abs(target.bearingDeg).toFixed(0)+'° · approximate planar projection.'
    : 'Camera-relative apparent proximity. Add an explicit floor calibration + listener anchor in ROOM for approximate planar distance.';
  }
  window.dispatchEvent(new CustomEvent('tracky:agent-room-tracks',{detail:{target}}));
  refreshFollowOptions(tracks);
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
 function refreshFollowOptions(tracks){
  if(!ui.follow)return;
  const current=ui.follow.value,listed=new Map();
  for(const t of tracks)if(t.participantId)listed.set(t.participantId,t.participantName||'Participant');
  const prior=[...ui.follow.options].slice(1).map(o=>o.value+':'+o.textContent).join('|');
  const next=[...listed].map(([id,name])=>id+':'+name).join('|');
  if(prior===next)return;
  ui.follow.replaceChildren();
  const auto=document.createElement('option');auto.value='';auto.textContent='Auto · active/nearest visible participant';
  ui.follow.append(auto);
  for(const [id,name] of listed){const option=document.createElement('option');option.value=id;option.textContent=name;ui.follow.append(option);}
  ui.follow.value=listed.has(current)?current:'';
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
  responseGeneration+=1;
  responsePending=false;
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
  $('dialogueTurns').hidden=true;$('roomEvents').hidden=true;
  $('agentLeftControls').hidden=false;
  // Dialogue and agent conversation remain in the dedicated Conversation tab.
  const map=$('roomRadar'),live=document.querySelector('.room-voice-fusion');
  if(map)$('agentRoomMapMount').append(map);
  // The shared ambient microphone belongs to ROOM, never to participant cards.
  if(live)$('roomAudioDiagnosticsMount').append(live);
  const sharedStatus=$('agentLiveStatusAccordion');
  if(sharedStatus)sharedStatus.hidden=true;
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
    if(ui.save.checked){
     entries=(entries.length?entries:loadAgentHistory(localStorage))
      .filter(item=>item.role!=='participant');
     // Migration purges old duplicated participant speech stored in AGENT history.
     saveAgentHistory(localStorage,entries,true);
    }
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
 return {init,greet,onDialogue,renderBoxes,openVoice,refreshConversation:showThread,
  getHistory:()=>entries.map(entry=>({...entry})),
  isBusy:()=>Boolean(open||responsePending||speech?.speaking),
  proactiveSpeak(text,{participantId=null,scopeId=null}={}){
   if(!text||open||responsePending||speech?.speaking||getMeeting()?.status==='active')return false;
   return say(text,participantId,scopeId)===true;
  },
  onMeetingChange(meeting){
   responseGeneration+=1;responsePending=false;modelController?.abort();stopSpeech();
   ui.modelStatus.textContent=meeting?.status==='active'
    ? (meeting.agentPolicy==='listen-only'
      ? 'Meeting active · AGENT listen-only'
      : 'Meeting active · AGENT replies only when explicitly addressed')
    : 'Meeting boundary changed · stale meeting replies cancelled';
  },
  setCameraActive(active){
  if(!active){ui.box.replaceChildren();ui.scene.textContent='Camera offline';lastProximityVolume=.85;
   if(ui.spatialStatus)ui.spatialStatus.textContent='Camera offline · spatial distance unavailable.';
   window.dispatchEvent(new CustomEvent('tracky:agent-room-tracks',{detail:{target:null}}));}
  ui.camStart.disabled=active;ui.camStop.disabled=!active;
  ui.camStatus.textContent=active?'Camera live':'Camera offline · start when ready';
 },setAudioActive(active){
  ui.resume.hidden=active;
  if(!open)ui.speaker.textContent=active?'Agent listening':'Microphone unavailable · enable audio';
 },destroy(){responseGeneration+=1;responsePending=false;modelController?.abort();stopSpeech();window.dispatchEvent(new CustomEvent('tracky:agent-ready',{detail:{enabled:false}}));}};
}

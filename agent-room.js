// UI-only AGENT controller. No duplicate camera/microphone or recognition engine.
import {greetingFor,respondToAgentTurn,appendAgentHistory,readAgentHistory,
 selectAgentVoice,AGENT_HISTORY_KEY,AGENT_VOICE_KEY} from './src/agent-conversation.js';
import {getParticipant} from './src/participant-store.js';
const $=id=>document.getElementById(id);
const ui={feed:$('agentConversationFeed'),form:$('agentConversationForm'),
 text:$('agentConversationText'),status:$('agentTalkingStatus'),
 voice:$('agentVoiceSelect'),speak:$('agentSpeakEnabled'),
 keep:$('agentKeepHistory'),clear:$('agentClearHistory'),
 panel:$('agentConversationPanel'),accordion:$('agentRoomStatusToggle'),
 roomStatus:$('agentRoomStatus'),dialog:$('participantVoiceDialog'),
 frame:$('participantVoiceFrame'),dialogName:$('agentVoiceDialogName'),
 close:$('closeAgentVoiceDialog'),canvas:$('agentCameraOverlay'),
 video:$('cameraVideo'),mirror:$('mirrorCamera')
};
let active=false,history=[],voiceURI='',greeted=new Set(),micWasActive=false;
try{
 voiceURI=localStorage.getItem(AGENT_VOICE_KEY)||'';
 ui.keep.checked=localStorage.getItem(AGENT_HISTORY_KEY)!==null;
}catch{}
function render(){
 ui.feed.replaceChildren();
 for(const item of history){
  const node=document.createElement('article');node.className='agent-turn';node.dataset.role=item.role;
  const title=document.createElement('strong');
  title.textContent=item.role==='agent'?'AGENT':item.role==='system'?'SYSTEM':
    item.attribution==='voice-match'?'Verified participant':'Typed message';
  const text=document.createElement('span');text.textContent=item.text;
  const sub=document.createElement('small');sub.textContent=item.role==='user'?
    item.attribution==='voice-match'?'Voice profile matched':'Not voice verified':'';
  node.append(title,text,sub);ui.feed.append(node);
 }
 ui.feed.scrollTop=ui.feed.scrollHeight;
}
function log(role,text,participant=null,attribution='unverified'){
 history=appendAgentHistory(history,{role,text,participantId:participant?.id||null,
  attribution,at:Date.now()});
 render();
 if(ui.keep.checked){
  try{localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(history));}
  catch{ui.status.textContent='History is session-only · storage unavailable';}
 }
}
function speak(text){
 if(!active||!ui.speak.checked)return;
 // Existing host uses its own TTS echo suppression and selected browser voice.
 window.dispatchEvent(new CustomEvent('tracky:agent-speak',{detail:{text,voiceURI}}));
}
function reply(text,participant=null,source='typed'){
 if(!active||!String(text||'').trim())return;
 const cleaned=String(text).trim().slice(0,800);
 log('user',cleaned,participant,source);
 const answer=respondToAgentTurn(cleaned,{person:participant});
 if(answer){log('agent',answer,participant);speak(answer);}
}
function refreshVoices(){
 if(!('speechSynthesis' in window))return;
 const selected=ui.voice.value||voiceURI;
 ui.voice.replaceChildren();ui.voice.append(new Option('Browser default',''));
 const voices=window.speechSynthesis.getVoices();
 for(const voice of voices)ui.voice.append(new Option(voice.name+' · '+voice.lang,voice.voiceURI));
 if(voices.some(v=>v.voiceURI===selected))ui.voice.value=selected;
 voiceURI=ui.voice.value;
}
function drawTracks(tracks){
 if(!active||!ui.video||ui.video.readyState<2)return;
 const canvas=ui.canvas,video=ui.video,rect=video.getBoundingClientRect();
 const width=rect.width,height=rect.height,iw=video.videoWidth,ih=video.videoHeight;
 if(!width||!height||!iw||!ih)return;
 const dpr=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
 const zoom=Math.max(width/iw,height/ih),vw=iw*zoom,vh=ih*zoom;
 const offsetX=(width-vw)/2,offsetY=(height-vh)/2,mirror=ui.mirror.checked;
 for(const track of tracks||[]){
  if(!track?.box)continue;
  const box=track.box;
  const x=offsetX+(mirror?vw-(box.x+box.width)*vw:box.x*vw);
  const y=offsetY+box.y*vh,w=box.width*vw,h=box.height*vh;
  ctx.strokeStyle=track.participantId?'#76facb':'#96d1fc';
  ctx.lineWidth=2.5;ctx.strokeRect(x,y,w,h);
  const label=String(track.participantName||track.visitorLabel||'Visitor').slice(0,54);
  ctx.font='bold 14px system-ui';
  const labelW=ctx.measureText(label).width+16;
  ctx.fillStyle='#02212ce0';ctx.fillRect(x,Math.max(0,y-25),labelW,23);
  ctx.fillStyle='#e7fff3';ctx.fillText(label,x+8,Math.max(15,y-7));
 }
}
ui.form.addEventListener('submit',e=>{
 e.preventDefault();const text=ui.text.value;ui.text.value='';reply(text);
});
ui.accordion.addEventListener('click',()=>{
 ui.roomStatus.hidden=!ui.roomStatus.hidden;
 ui.accordion.setAttribute('aria-expanded',String(!ui.roomStatus.hidden));
});
ui.speak.addEventListener('change',()=>{
 if(!ui.speak.checked&&'speechSynthesis' in window)window.speechSynthesis.cancel();
});
ui.voice.addEventListener('change',()=>{
 voiceURI=ui.voice.value;
 try{localStorage.setItem(AGENT_VOICE_KEY,voiceURI);}catch{}
});
ui.keep.addEventListener('change',()=>{
 if(ui.keep.checked){try{localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(history));}catch{}}
 else{try{localStorage.removeItem(AGENT_HISTORY_KEY);}catch{}}
});
ui.clear.addEventListener('click',()=>{
 history=[];render();ui.keep.checked=false;
 try{localStorage.removeItem(AGENT_HISTORY_KEY);}catch{}
});
window.addEventListener('tracky:agent-mode',event=>{
 const next=Boolean(event.detail?.active);
 if(next&&!active){
  greeted=new Set();
  history=ui.keep.checked?readAgentHistory(localStorage):[];
  render();
 }
 active=next;
 ui.panel.hidden=!active;
 ui.accordion.hidden=!active;
 ui.canvas.hidden=!active;
 ui.status.textContent=active?'Listening when microphone is available':'Standby';
});
window.addEventListener('tracky:agent-recognized',event=>{
 if(!active)return;
 const person=event.detail?.participant;
 if(!person?.id||greeted.has(person.id))return;
 const message=greetingFor(person);
 if(!message)return;
 greeted.add(person.id);
 log('agent',message,person);speak(message);
});
window.addEventListener('tracky:agent-transcript',event=>{
 if(!active)return;
 // The host emits verified voice ID only. No "sole visible person" shortcut.
 const {text,participant}=event.detail||{};
 if(participant?.id && typeof text==='string'&&text.trim().length>2)
  reply(text,participant,'voice-match');
});
window.addEventListener('tracky:agent-tracks',event=>drawTracks(event.detail?.tracks||[]));
window.addEventListener('resize',()=>{if(active)drawTracks([]);});
window.addEventListener('tracky:agent-audio',event=>{
 if(active)ui.status.textContent=event.detail?.active?'Listening':'Microphone requires permission';
});
window.addEventListener('tracky:agent-voice-enroll',async event=>{
 if(!active||ui.dialog.open)return;
 const id=event.detail?.participantId;if(!id)return;
 let person=null;
 try{person=await getParticipant(id);}catch{}
 if(!person||!active)return;
 micWasActive=Boolean(event.detail?.roomAudioActive);
 window.dispatchEvent(new CustomEvent('tracky:agent-pause-audio'));
 ui.dialogName.textContent='Voice profile · '+person.name;
 ui.frame.src='./voice-capture.html?participant='+encodeURIComponent(id);
 ui.dialog.showModal();
});
function closeVoice(){if(ui.dialog.open)ui.dialog.close();}
ui.close.addEventListener('click',closeVoice);
ui.dialog.addEventListener('close',()=>{
 ui.frame.removeAttribute('src');
 if(active)window.dispatchEvent(new CustomEvent('tracky:agent-resume-audio'));
 micWasActive=false;
});
refreshVoices();
if('speechSynthesis' in window)
 window.speechSynthesis.addEventListener('voiceschanged',refreshVoices);

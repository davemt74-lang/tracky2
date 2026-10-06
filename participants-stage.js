// Presentation only: panels never recreate/stall the active camera or voice engines.
const $=id=>document.getElementById(id);
const state={gallery:true,voice:true,settings:false};
const ui={
 gallery:$('participantGalleryOverlay'),voice:$('participantVoiceOverlay'),
 settings:$('participantSettingsSheet'),toggleGallery:$('toggleGallery'),
 toggleVoice:$('toggleVoice'),settingsButton:$('openParticipantSettings'),
 closeSettings:$('closeParticipantSettings'),galleryClose:$('closeGallery'),
 voiceClose:$('closeVoice'),add:$('newParticipant'),
 video:$('participantVideo'),videoDetails:$('participantVideoDetails')
};
function paint(){
 for(const name of ['gallery','voice']){
  ui[name].hidden=!state[name];
  ui['toggle'+name[0].toUpperCase()+name.slice(1)].setAttribute('aria-expanded',String(state[name]));
 }
 ui.settings.hidden=!state.settings;
 ui.settingsButton.setAttribute('aria-expanded',String(state.settings));
}
function panel(name,open=!state[name]){
 state[name]=open;
 if(name==='settings'&&open){
  // Keep the enrollment fields legible while editing.
  state.gallery=false;state.voice=false;
 }
 paint();
}
ui.toggleGallery.addEventListener('click',()=>panel('gallery'));
ui.toggleVoice.addEventListener('click',()=>panel('voice'));
ui.galleryClose.addEventListener('click',()=>panel('gallery',false));
ui.voiceClose.addEventListener('click',()=>panel('voice',false));
ui.settingsButton.addEventListener('click',()=>panel('settings'));
ui.closeSettings.addEventListener('click',()=>panel('settings',false));
ui.add.addEventListener('click',()=>{
 panel('settings',true);
 // Handled after participant JS clears the form; don't select existing data automatically.
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 if(state.settings){panel('settings',false);ui.settingsButton.focus();}
});
ui.video.addEventListener('loadedmetadata',()=>{
 const w=ui.video.videoWidth,h=ui.video.videoHeight;
 ui.videoDetails.textContent=w&&h?w+' × '+h:'Camera ready';
});
ui.video.addEventListener('emptied',()=>{ui.videoDetails.textContent='Ready for capture';});
window.addEventListener('tracky:participant-editing',()=>panel('settings',true));
window.addEventListener('tracky:participant-photo-captured',event=>{
 // Guided capture stays camera-first; the gallery opens only when explicitly requested.
 if(event.detail?.openGallery===true)panel('gallery',true);
});
window.addEventListener('tracky:participant-saved',event=>{
 panel('settings',false);
 if(event.detail?.openVoice){state.gallery=false;panel('voice',true);ui.toggleVoice?.focus?.();}
});
paint();

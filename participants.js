import { voiceProfileReadiness } from './src/voice-core.js';
import {voiceDraftSaveFields} from './src/participant-enrollment-core.js';
import {LAST_PARTICIPANT_KEY,loadCameraPreference,saveCameraPreference,cameraAutostartEligible,cameraPermissionState} from './src/camera-preference.js';
import {
  loadFaceGallery,captureFaceGallerySample,removeFaceGallerySample,faceGalleryStatus,gallerySaveFields,
  FACE_CAPTURE_POSES,MAX_FACE_SAMPLES,nextFaceCapturePose
} from './src/face-gallery.js';
import { facePreviewRect,smoothPreviewRect } from './src/face-preview.js';
import {sceneStep,sceneAcquisition} from './src/scene-analysis.js';
import { IdentityEngine, cropFacePhoto, qualityMessage } from './src/identity-engine.js';
import {
  deleteParticipant,
  deletePendingCapture,
  getParticipant,
  getPendingCapture,
  listParticipants,
  prunePendingCaptures,
  saveParticipant
} from './src/participant-store.js';

const $ = (selector) => document.querySelector(selector);

const ui = {
  modelStatus: $('#modelStatus'),
  sceneOverlay: $('#participantSceneOverlay'),
  sceneStatus: $('#participantSceneStatus'),
  sceneBar: $('#participantSceneBar'),
  sceneFill: $('#participantSceneFill'),
  participantCount: $('#participantCount'),
  cameraStatus: $('#participantCameraStatus'),
  list: $('#participantList'),
  newParticipant: $('#newParticipant'),
  formModeLabel: $('#formModeLabel'),
  formTitle: $('#formTitle'),
  enrollmentStatus: $('#enrollmentStatus'),
  video: $('#participantVideo'),
  cameraStage: $('#identityCameraStage'),
  cameraPlaceholder: $('#cameraPlaceholder'),
  reticle: $('#faceReticle'),
  qualityText: $('#faceQualityText'),
  qualityValue: $('#faceQualityValue'),
  qualityBar: $('#faceQualityBar'),
  captureCoach: $('#faceCaptureCoach'),
  captureStep: $('#faceCaptureStep'),
  captureReady: $('#faceCaptureReady'),
  captureInstruction: $('#faceCaptureInstruction'),
  angleMap: $('#faceAngleMap'),
  capturePhotoLabel: $('#capturePhotoLabel'),
  startCamera: $('#startParticipantCamera'),
  stopCamera: $('#stopParticipantCamera'),
  capturePrimary: $('#capturePrimary'),
  primaryPhoto: $('#primaryPhotoPreview'),
  primaryEmpty: $('#primaryPhotoEmpty'),
  latestPhoto: $('#latestPhotoPreview'),
  latestEmpty: $('#latestPhotoEmpty'),
  useLatestPrimary: $('#useLatestPrimary'),
  name: $('#participantName'),
  nickname: $('#participantNickname'),
  notes: $('#participantNotes'),
  recognitionEnabled: $('#recognitionEnabled'),
  agentProactiveEnabled: $('#agentProactiveEnabled'),
  accountBiometricSyncEnabled: $('#accountBiometricSyncEnabled'),
  sampleCount: $('#sampleCount'),
  enrollmentDots: $('#enrollmentDots'),
  faceGallery: $('#faceSampleGallery'),
  sampleGuide: $('#faceSampleGuide'),
  galleryHint: $('#faceGalleryHint'),
  captureSample: $('#captureSample'),
  message: $('#formMessage'),
  save: $('#saveParticipant'),
  reset: $('#resetParticipantForm'),
  delete: $('#deleteParticipant')
};

const state = {
  participants: [],
  editingId: null,
  stream: null,
  engine: new IdentityEngine(),
  engineReady: false,
  scanning: false,
  scanTimer: 0,
  currentFace: null,
  primaryPhoto: null,
  latestPhoto: null,
  gallery: [],
  retakeIndex: null,
  pendingId: null,
  manuallyStoppedThisPage: false,
  cameraDeviceId: null,
  cameraDevices: [],
  mirrorPreview: true,
  completeScans: 0,
  initStartedAt:0,
  cameraGeneration: 0,
  voiceDraft: {},
  voiceRecording: false,
  saving: false
};

function setMessage(message = '', kind = '') {
  ui.message.textContent = message;
  ui.message.dataset.kind = kind;
}

function setPhoto(img, empty, value) {
  img.hidden = !value;
  empty.hidden = Boolean(value);
  if (value) img.src = value;
  else img.removeAttribute('src');
}

function updateCaptureCoach(){
  const status=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  const next=nextFaceCapturePose(state.gallery);
  const captured=new Set(state.gallery.map(sample=>sample?.poseId).filter(Boolean));
  const ready=Boolean(state.currentFace?.embedding&&state.currentFace.quality>=0.55);
  if(ui.captureCoach)ui.captureCoach.hidden=!state.stream;
  if(ui.captureReady)ui.captureReady.textContent=status.requiredComplete?'Required profile ready':ready?'Face lock ready':'Waiting for face lock';
  for(const marker of ui.angleMap?.querySelectorAll?.('[data-pose]')||[]){
    const pose=marker.dataset.pose;
    marker.classList.toggle('complete',captured.has(pose));
    marker.classList.toggle('active',Boolean(next)&&pose===next.id&&!status.full);
  }
  if(status.requiredComplete){
    if(ui.captureStep)ui.captureStep.textContent=status.required+' / '+status.required+' · Required profile complete';
    if(ui.captureInstruction)ui.captureInstruction.textContent='Required face profile complete. Save the photo profile to continue to Voice. Additional angles are optional and can be added later from Photos.';
    if(ui.capturePhotoLabel)ui.capturePhotoLabel.textContent='Save Photo Profile & Continue to Voice';
    ui.capturePrimary.title='Save photo profile and continue to Voice';
    ui.capturePrimary.setAttribute('aria-label','Save photo profile and continue to Voice');
    ui.capturePrimary.disabled=state.saving||state.voiceRecording;
    return;
  }
  const poseIndex=FACE_CAPTURE_POSES.findIndex(pose=>pose.id===next.id);
  if(ui.captureStep)ui.captureStep.textContent=(poseIndex+1)+' / '+status.required+' required · '+next.label;
  if(ui.captureInstruction)ui.captureInstruction.textContent=next.instruction;
  if(ui.capturePhotoLabel)ui.capturePhotoLabel.textContent=status.count?'Capture '+next.label:'Start Face Capture';
  ui.capturePrimary.title='Capture '+next.label+' face angle';
  ui.capturePrimary.setAttribute('aria-label','Capture '+next.label+' face angle');
  if(state.stream)ui.capturePrimary.disabled=!ready;
}

function updateSaveAction(){
  const status=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  const faceRequired=ui.recognitionEnabled.checked&&!status.requiredComplete;
  ui.save.disabled=state.saving||state.voiceRecording||faceRequired;
  if(state.saving)ui.save.textContent='Saving…';
  else if(faceRequired)ui.save.textContent='Capture 3 photos to continue';
  else if(!state.editingId&&ui.recognitionEnabled.checked)
    ui.save.textContent='Save photo profile & continue to Voice';
  else ui.save.textContent='Save participant';
}

function updateEnrollmentUi() {
  const status=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  const next=nextFaceCapturePose(state.gallery);
  ui.sampleCount.textContent=String(status.count);
  [...ui.enrollmentDots.children].forEach((dot,index)=>{
    dot.classList.toggle('complete',index<status.count);
    dot.setAttribute('aria-label',index<status.count?'Sample '+(index+1)+' saved':'Sample '+(index+1)+' pending');
  });
  ui.enrollmentStatus.textContent=!ui.recognitionEnabled.checked?'Recognition off':
    status.requiredComplete?'Photo profile ready · 3 required complete':status.count?
    'Capture '+status.remaining+' more required photo'+(status.remaining===1?'':'s'):'Not enrolled';
  ui.enrollmentStatus.classList.toggle('ok',status.ready&&ui.recognitionEnabled.checked);
  ui.sampleGuide.textContent=status.requiredComplete?
    'Required photo profile complete. Save now and continue to Voice. The remaining six angles are optional for stronger recognition and can be added later.':
    'Capture '+status.remaining+' more required photo'+(status.remaining===1?'':'s')+
      '. The required sequence is straight forward, left, and right.';
  ui.galleryHint.textContent=status.count+' saved · '+status.required+' required · '+
    Math.max(0,status.maximum-status.count)+' optional slots available · '+status.photographed+' photos';
  ui.captureSample.textContent=state.retakeIndex!==null?
    'Retake '+(state.gallery[state.retakeIndex]?.poseLabel||('sample '+(state.retakeIndex+1))):
    status.full?'Guided profile full · '+MAX_FACE_SAMPLES+'/'+MAX_FACE_SAMPLES:
    'Capture '+(next?.label||('sample '+(status.count+1)));
  ui.captureSample.disabled=!state.currentFace?.embedding ||
    state.currentFace.quality<0.55 || (status.full&&state.retakeIndex===null);
  updateCaptureCoach();
  updateSaveAction();
}

function renderFaceGallery() {
  ui.faceGallery.replaceChildren();
  for(let i=0;i<MAX_FACE_SAMPLES;i++){
    const sample=state.gallery[i];
    const card=document.createElement('article');
    card.className='face-gallery-tile';
    if(state.retakeIndex===i)card.classList.add('retake-selected');
    const frame=document.createElement('div');
    frame.className='face-gallery-photo';
    if(sample?.photo){
      const img=document.createElement('img');
      img.src=sample.photo;img.alt='Face sample '+(i+1)+' preview';
      img.loading='lazy';frame.append(img);
    } else {
      const empty=document.createElement('span');
      empty.textContent=sample?'Photo unavailable':'Empty slot';
      frame.append(empty);
    }
    const title=document.createElement('strong');
    const pose=sample?.poseLabel||FACE_CAPTURE_POSES[i]?.label||('Angle '+(i+1));
    title.textContent=pose+(sample?' · Saved':' · Pending');
    card.append(frame,title);
    if(sample){
      const detail=document.createElement('small');
      detail.textContent=sample.photo?
        (sample.quality===null?'Photo saved':'Face quality '+Math.round(sample.quality*100)+'%'):
        'Legacy sample · retake to add photo';
      card.append(detail);
      const actions=document.createElement('div');
      actions.className='face-gallery-actions';
      const primary=document.createElement('button');
      primary.type='button';primary.textContent='Use as primary';
      primary.disabled=!sample.photo;
      primary.addEventListener('click',()=>{
        if(!sample.photo)return;
        state.primaryPhoto=sample.photo;
        updatePhotos();setMessage('Sample '+(i+1)+' chosen as primary. Save the profile.','ok');
      });
      const retake=document.createElement('button');
      retake.type='button';retake.textContent=state.retakeIndex===i?'Cancel':'Retake';
      retake.addEventListener('click',()=>{
        state.retakeIndex=state.retakeIndex===i?null:i;
        updateEnrollmentUi();renderFaceGallery();
        if(state.retakeIndex!==null)
          setMessage((sample?.poseLabel||('Sample '+(i+1)))+' selected. Match that angle, then click Retake.','ok');
      });
      const remove=document.createElement('button');
      remove.type='button';remove.textContent='Remove';
      remove.setAttribute('aria-label','Remove face sample '+(i+1));
      remove.addEventListener('click',()=>{
        const removed=state.gallery[i];
        state.gallery=removeFaceGallerySample(state.gallery,i);
        state.retakeIndex=null;
        if(removed.photo && state.primaryPhoto===removed.photo)
          state.primaryPhoto=state.gallery.find(x=>x.photo)?.photo||null;
        state.latestPhoto=state.gallery.slice().reverse().find(x=>x.photo)?.photo||state.primaryPhoto;
        updatePhotos();renderFaceGallery();updateEnrollmentUi();
        setMessage('Sample removed. Save the participant to keep changes.','ok');
      });
      actions.append(primary,retake,remove);
      card.append(actions);
    }
    ui.faceGallery.append(card);
  }
}

function updatePhotos() {
  setPhoto(ui.primaryPhoto, ui.primaryEmpty, state.primaryPhoto);
  setPhoto(ui.latestPhoto, ui.latestEmpty, state.latestPhoto);
  ui.useLatestPrimary.disabled = !state.latestPhoto;
}

function clearForm() {
  state.editingId = null;
  state.voiceDraft = {};
  document.body.dataset.participantId = '';
  window.dispatchEvent(new CustomEvent('tracky:participant-cleared'));
  state.primaryPhoto = null;
  state.latestPhoto = null;
  state.gallery = [];
  state.retakeIndex = null;
  state.currentFace = null;

  ui.formModeLabel.textContent = 'PARTICIPANT ONBOARDING';
  ui.formTitle.textContent = 'Create participant';
  ui.name.value = '';
  ui.nickname.value = '';
  ui.notes.value = '';
  ui.recognitionEnabled.checked = true;
  ui.agentProactiveEnabled.checked = true;
  ui.accountBiometricSyncEnabled.checked = false;
  ui.delete.hidden = true;

  updatePhotos();
  updateEnrollmentUi();
  renderFaceGallery();
  setMessage('');
}

function renderParticipantList() {
  ui.participantCount.textContent = String(state.participants.length);
  ui.list.replaceChildren();

  if (!state.participants.length) {
    const empty = document.createElement('div');
    empty.className = 'roster-empty';
    const strong = document.createElement('strong');
    strong.textContent = 'No enrolled participants';
    const span = document.createElement('span');
    span.textContent = 'Create the first participant to enable recognition.';
    empty.append(strong, span);
    ui.list.append(empty);
    return;
  }

  state.participants.forEach((participant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'roster-card';
    button.dataset.id = participant.id;

    const photo = document.createElement('div');
    photo.className = 'roster-photo';
    if (participant.primaryPhoto) {
      const img = document.createElement('img');
      img.src = participant.primaryPhoto;
      img.alt = '';
      photo.append(img);
    } else {
      photo.textContent = (participant.name || '?').slice(0, 1).toUpperCase();
    }

    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = participant.name || 'Unnamed participant';
    const meta = document.createElement('span');
    const sampleText = (participant.embeddings?.length || 0) + ' face samples · 3 minimum';
    const voiceReady = voiceProfileReadiness(participant);
    const voiceText = voiceReady.ready
      ? ' · voice profile ready'
      : voiceReady.embeddingCount
        ? ' · voice ' + voiceReady.embeddingCount + '/3'
        : ' · no voice profile';
    const seen = participant.lastSeenAt ? ' · seen ' + new Date(participant.lastSeenAt).toLocaleDateString() : '';
    meta.textContent = sampleText + voiceText + seen;
    copy.append(title, meta);

    const status = document.createElement('i');
    const faceReady=(participant.embeddings?.length||0)>=3;
    status.className = participant.recognitionEnabled === false ? 'off' : faceReady ? 'on' : 'pending';
    status.title = participant.recognitionEnabled === false
      ? 'Recognition disabled'
      : faceReady ? 'Recognition enabled' : 'Recognition pending · 3 clean face samples required';

    button.append(photo, copy, status);
    button.addEventListener('click', () => loadParticipant(participant.id));
    ui.list.append(button);
  });
}

async function reloadParticipants() {
  try {
    state.participants = await listParticipants();
    renderParticipantList();
  } catch (error) {
    console.error(error);
    setMessage('Local participant storage is unavailable in this browser.', 'error');
  }
}

async function loadParticipant(id) {
  const participant = await getParticipant(id);
  if (!participant) return;

  state.editingId = participant.id;
  state.voiceDraft = {};
  document.body.dataset.participantId = participant.id;
  window.dispatchEvent(new CustomEvent('tracky:participant-loaded', { detail: { participantId: participant.id } }));
  state.primaryPhoto = participant.primaryPhoto || null;
  state.latestPhoto = participant.latestPhoto || null;
  state.gallery=loadFaceGallery(participant);
  state.retakeIndex=null;

  ui.formModeLabel.textContent = 'PARTICIPANT PROFILE';
  ui.formTitle.textContent = participant.name || 'Participant';
  ui.name.value = participant.name || '';
  ui.nickname.value = participant.nickname || '';
  ui.notes.value = participant.notes || '';
  ui.recognitionEnabled.checked = participant.recognitionEnabled !== false;
  ui.agentProactiveEnabled.checked = participant.agentProactiveEnabled !== false;
  ui.accountBiometricSyncEnabled.checked = participant.accountBiometricSyncEnabled === true;
  ui.delete.hidden = false;

  updatePhotos();
  updateEnrollmentUi();
  renderFaceGallery();
  setMessage('Profile loaded. Capture a new primary photo or add enrollment samples at any time.');
  window.dispatchEvent(new CustomEvent('tracky:participant-editing'));
}

function updateParticipantScene(step){
 const progress=sceneStep(step);
 ui.sceneOverlay.hidden=step==='idle'||step==='ready';
 ui.sceneStatus.textContent=progress.label;
 ui.sceneBar.setAttribute('aria-valuenow',String(progress.progress??0));
 ui.sceneBar.setAttribute('aria-valuetext',progress.label);
 ui.sceneFill.style.width=(progress.progress??0)+'%';
 ui.sceneOverlay.dataset.stage=step;
}

async function ensureEngine() {
  if (state.engineReady) return true;
  ui.modelStatus.textContent = 'Loading models…';

  try {
    await state.engine.init();
    state.engineReady = true;
    ui.modelStatus.textContent = 'Identity core online';
    if(state.stream)updateParticipantScene('models');
    return true;
  } catch (error) {
    console.error(error);
    ui.modelStatus.textContent = 'Model unavailable';
    if(state.stream)updateParticipantScene('error');
    setMessage('Face models could not load. Participant profiles still work, but face enrollment is unavailable.', 'error');
    return false;
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage('Camera access is not supported in this browser.', 'error');
    return;
  }

  stopCamera();
  updateParticipantScene('camera');
  state.initStartedAt=performance.now();
  const generation=state.cameraGeneration;

  try {
    const videoConstraints={
      width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:60}
    };
    if(state.cameraDeviceId)videoConstraints.deviceId={exact:state.cameraDeviceId};
    else videoConstraints.facingMode={ideal:'user'};
    state.stream = await navigator.mediaDevices.getUserMedia({
      video:videoConstraints,audio:false
    });
    const active=state.stream.getVideoTracks()[0];
    const settings=active?.getSettings?.()||{};
    state.cameraDeviceId=settings.deviceId||state.cameraDeviceId;
    state.mirrorPreview=settings.facingMode!=='environment';
    ui.cameraStage.dataset.mirror=String(state.mirrorPreview);
    try{
      state.cameraDevices=(await navigator.mediaDevices.enumerateDevices())
        .filter(device=>device.kind==='videoinput'&&device.deviceId);
    }catch{
      state.cameraDevices=[];
    }
    document.getElementById('switchParticipantCamera').disabled=state.cameraDevices.length<2;

    ui.video.srcObject = state.stream;
    await ui.video.play();
    if(generation!==state.cameraGeneration)return;
    ui.cameraPlaceholder.hidden = true;
    ui.startCamera.disabled = true;
    ui.stopCamera.disabled = false;
    ui.cameraStatus.textContent = 'Live';
    updateCaptureCoach();

    await ensureEngine();
    if(state.engineReady)updateParticipantScene('models');
    if (state.engineReady && generation===state.cameraGeneration) {
      state.completeScans=0;
      updateParticipantScene('detecting');
      state.scanning = true;
      scheduleScan(80);
    }
  } catch (error) {
    console.error(error);
    ui.cameraStatus.textContent = 'Denied / unavailable';
    if(generation===state.cameraGeneration)updateParticipantScene('error');
    setMessage(window.isSecureContext ? 'Could not open camera.' : 'Camera access requires localhost or HTTPS.', 'error');
  }
}

function stopCamera() {
  state.cameraGeneration+=1;
  state.completeScans=0;
  updateParticipantScene('idle');
  state.scanning = false;
  clearTimeout(state.scanTimer);
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  ui.video.srcObject = null;
  ui.cameraPlaceholder.hidden = false;
  ui.startCamera.disabled = false;
  ui.stopCamera.disabled = true;
  ui.cameraStatus.textContent = 'Offline';
  document.getElementById('switchParticipantCamera').disabled=state.cameraDevices.length<2;
  ui.reticle.hidden = true;
  lastPreviewRect=null;
  ui.capturePrimary.disabled = true;
  ui.captureSample.disabled = true;
  state.currentFace = null;
  if(ui.captureCoach)ui.captureCoach.hidden=true;
}

function scheduleScan(delay = 500) {
  clearTimeout(state.scanTimer);
  if (!state.scanning) return;
  state.scanTimer = setTimeout(scanFace, delay);
}

let lastPreviewRect=null;
function positionReticle(face) {
  const layout=ui.video.getBoundingClientRect();
  const stage=ui.cameraStage.getBoundingClientRect();
  const projected=facePreviewRect(face.box,{
    videoWidth:ui.video.videoWidth,videoHeight:ui.video.videoHeight,
    displayWidth:layout.width,displayHeight:layout.height,
    mirror:state.mirrorPreview,fit:'cover'
  });
  if(!projected){ui.reticle.hidden=true;lastPreviewRect=null;return;}
  const rect=smoothPreviewRect(lastPreviewRect,projected);
  lastPreviewRect=rect;
  ui.reticle.style.left=(layout.left-stage.left+rect.left)+'px';
  ui.reticle.style.top=(layout.top-stage.top+rect.top)+'px';
  ui.reticle.style.width=rect.width+'px';
  ui.reticle.style.height=rect.height+'px';
  ui.reticle.hidden=false;
}

async function scanFace() {
  if (!state.scanning || !state.engineReady || ui.video.readyState < 2) {
    scheduleScan(500);
    return;
  }

  try {
    const generation=state.cameraGeneration;
    const faces = await state.engine.detect(ui.video);
    if(!state.scanning || generation!==state.cameraGeneration)return;
    state.completeScans+=1;
    const face = faces.sort((a,b)=>b.quality-a.quality)[0]||null;
    state.currentFace=face;
    updateParticipantScene(sceneAcquisition({
      modelReady:state.engineReady,
      completeScans:state.completeScans,
      elapsedMs:performance.now()-state.initStartedAt,
      stable:Boolean(face?.embedding&&face.quality>=.55)
    }));

    if (!face) {
      ui.reticle.hidden = true;
      lastPreviewRect=null;
      ui.qualityValue.textContent = '0%';
      ui.qualityBar.style.width = '0%';
      ui.capturePrimary.disabled = true;
      ui.captureSample.disabled = true;
      updateCaptureCoach();
      scheduleScan(450);
      return;
    }

    positionReticle(face);
    const percent = Math.round(face.quality * 100);
    ui.qualityValue.textContent = percent + '%';
    ui.qualityBar.style.width = percent + '%';
    ui.qualityText.textContent = qualityMessage(face.quality);

    const captureReady = face.quality >= 0.55 && Boolean(face.embedding);
    const status=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
    ui.capturePrimary.disabled = !captureReady || status.full;
    ui.captureSample.disabled = !captureReady || (status.full && state.retakeIndex === null);
    updateCaptureCoach();
  } catch (error) {
    console.error(error);
    ui.modelStatus.textContent = 'Identity scan error';
    if(state.completeScans===0)updateParticipantScene('error');
  } finally {
    scheduleScan(550);
  }
}

function captureCurrentPhoto() {
  if (!state.currentFace) return null;
  return cropFacePhoto(ui.video, state.currentFace.box, { mirror: state.mirrorPreview, size: 360, quality: 0.9 });
}

function requireFreshFaceLock(){
  state.currentFace=null;
  ui.capturePrimary.disabled=true;
  ui.captureSample.disabled=true;
  updateCaptureCoach();
  if(state.scanning)scheduleScan(120);
}

function captureGuidedPhoto(){
  if(!state.currentFace?.embedding || state.currentFace.quality<0.55)return;
  const statusBefore=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  if(statusBefore.full){
    setMessage('The guided 9-angle face profile is already complete. Retake an angle from Photos if needed.','ok');
    updateEnrollmentUi();return;
  }
  const pose=nextFaceCapturePose(state.gallery);
  if(!pose){
    setMessage('The guided face profile is complete.','ok');updateEnrollmentUi();return;
  }
  const photo=captureCurrentPhoto();
  if(!photo){setMessage('Unable to capture this frame. Try again with a clear face.','error');return;}
  state.gallery=captureFaceGallerySample(state.gallery,{
    embedding:state.currentFace.embedding,photo,
    quality:state.currentFace.quality,capturedAt:new Date().toISOString(),poseId:pose.id
  });
  state.latestPhoto=photo;
  if(!state.primaryPhoto)state.primaryPhoto=photo;
  updatePhotos();updateEnrollmentUi();renderFaceGallery();
  const status=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  const next=nextFaceCapturePose(state.gallery);
  setMessage(status.coverageComplete?
    'Guided face capture complete: all 9 angles are saved.':
    pose.label+' saved · '+status.count+'/'+status.maximum+'. Next: '+(next?.label||'complete')+'.','ok');
  requireFreshFaceLock();
  window.dispatchEvent(new CustomEvent('tracky:participant-photo-captured',{
    detail:{guided:true,poseId:pose.id,count:status.count,complete:status.coverageComplete}
  }));
}

function captureFaceSample(){
  if(!state.currentFace?.embedding || state.currentFace.quality<0.55)return;
  const statusBefore=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  if(statusBefore.full && state.retakeIndex===null)return;
  const photo=captureCurrentPhoto();
  if(!photo){setMessage('Unable to capture this sample. Check the camera and try again.','error');return;}
  const replacing=state.retakeIndex;
  const previous=replacing===null?null:state.gallery[replacing];
  const pose=replacing===null?nextFaceCapturePose(state.gallery):null;
  state.gallery=captureFaceGallerySample(state.gallery,{
    embedding:state.currentFace.embedding,photo,
    quality:state.currentFace.quality,capturedAt:new Date().toISOString(),
    poseId:previous?.poseId||pose?.id||null
  },replacing);
  state.retakeIndex=null;
  state.latestPhoto=photo;
  if(previous?.photo && state.primaryPhoto===previous.photo)state.primaryPhoto=photo;
  if(!state.primaryPhoto)state.primaryPhoto=photo;
  updatePhotos();updateEnrollmentUi();renderFaceGallery();
  const status=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  const next=nextFaceCapturePose(state.gallery);
  const savedPose=replacing!==null?(previous?.poseLabel||('Sample '+(replacing+1))):(pose?.label||('Sample '+status.count));
  setMessage(replacing!==null?savedPose+' retaken successfully.':
    status.requiredComplete?'Required photo profile complete. Save photo profile & continue to Voice. Additional angles are optional.':
    savedPose+' saved · '+status.count+'/'+status.required+' required'+
      (status.remaining?' · '+status.remaining+' more required':'')+
      (next?' · next '+next.label:''),'ok');
  requireFreshFaceLock();
  window.dispatchEvent(new CustomEvent('tracky:participant-photo-captured',{
    detail:{guided:true,retake:replacing!==null,count:status.count,complete:status.coverageComplete}
  }));
}

async function saveForm() {
  if(state.saving)return;
  if(state.voiceRecording){
    setMessage('Stop the active Voice Profile recording before saving this participant.','error');
    return;
  }
  const name = ui.name.value.trim();
  if (!name) {
    setMessage('Enter a participant name before saving.', 'error');
    ui.name.focus();
    return;
  }

  const galleryStatus=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
  if(ui.recognitionEnabled.checked&&!galleryStatus.requiredComplete){
    setMessage('Capture the 3 required face photos before continuing to Voice.','error');
    return;
  }

  state.saving=true;
  ui.save.disabled=true;
  ui.save.textContent='Saving…';
  try{
    const existing = state.editingId ? await getParticipant(state.editingId) : null;
    const wasNew=!state.editingId;
    const galleryFields=gallerySaveFields(state.gallery);
    const draftVoice=voiceDraftSaveFields(state.voiceDraft);
    const record = await saveParticipant({
      ...(existing || {}),
      id: state.editingId || undefined,
      name,
      nickname: ui.nickname.value,
      notes: ui.notes.value,
      primaryPhoto: state.primaryPhoto,
      latestPhoto: state.latestPhoto || state.primaryPhoto,
      ...galleryFields,
      ...draftVoice,
      recognitionEnabled: ui.recognitionEnabled.checked,
      agentProactiveEnabled: ui.agentProactiveEnabled.checked,
      accountBiometricSyncEnabled: ui.accountBiometricSyncEnabled.checked
    });

    state.editingId = record.id;
    state.voiceDraft = {};
    document.body.dataset.participantId = record.id;
    try{window.localStorage.setItem(LAST_PARTICIPANT_KEY,record.id);}catch{}
    window.dispatchEvent(new CustomEvent('tracky:participant-saved', { detail: { participantId: record.id,openVoice:wasNew&&galleryStatus.requiredComplete } }));
    ui.formModeLabel.textContent = 'PARTICIPANT PROFILE';
    ui.formTitle.textContent = record.name;
    ui.delete.hidden = false;

    if (state.pendingId) {
      await deletePendingCapture(state.pendingId).catch(() => {});
      state.pendingId = null;
      history.replaceState(null, '', './participants.html');
    }

    await reloadParticipants();
    setMessage(
      galleryStatus.requiredComplete
        ? 'Photo profile saved. Face recognition is ready. Continue with Voice Profile enrollment.'
        : 'Participant saved. Face recognition will become active after 3 clean face samples. You can continue face and voice enrollment now.',
      'ok'
    );
  }catch(error){
    console.error('Participant save failed',error);
    setMessage('Participant could not be saved: '+(error?.message||'local storage error')+'. Your unsaved enrollment remains on this page.','error');
  }finally{
    state.saving=false;
    updateSaveAction();
  }
}

async function removeCurrentParticipant() {
  if (!state.editingId) return;
  const participant = await getParticipant(state.editingId);
  if (!participant) return;

  if (!window.confirm(
    'Delete ' + participant.name + ' and their local face profile, Voice Profile, and attributed dialogue data?'
  )) return;
  await deleteParticipant(participant.id);
  clearForm();
  await reloadParticipants();
  setMessage('Participant deleted. Signed-in account deletion will sync automatically.', 'ok');
}

async function loadPendingFromUrl() {
  const params = new URLSearchParams(location.search);
  const pendingId = params.get('pending');
  if (!pendingId) return;

  const pending = await getPendingCapture(pendingId);
  if (!pending) return;

  clearForm();
  state.pendingId = pendingId;
  state.primaryPhoto = pending.photo || null;
  state.latestPhoto = pending.photo || null;
  if (pending.embedding) {
    state.gallery=[{embedding:Array.from(pending.embedding),photo:pending.photo||null,
      quality:null,capturedAt:null,poseId:'front',poseLabel:'Straight forward'}];
  }

  updatePhotos();
  updateEnrollmentUi();
  renderFaceGallery();
  setMessage('Live room capture imported as the straight-forward sample. Continue the guided face angles.', 'ok');
}

ui.newParticipant.addEventListener('click', clearForm);
ui.startCamera.addEventListener('click',()=>{
  state.manuallyStoppedThisPage=false;
  void startCamera();
});
ui.stopCamera.addEventListener('click',()=>{
  state.manuallyStoppedThisPage=true;
  stopCamera();
});
document.getElementById('switchParticipantCamera').addEventListener('click',async()=>{
  const list=state.cameraDevices;
  const current=list.findIndex(device=>device.deviceId===state.cameraDeviceId);
  if(list.length<2)return;
  state.cameraDeviceId=list[(current+1)%list.length].deviceId;
  await startCamera();
});
ui.capturePrimary.addEventListener('click',()=>{
 const status=faceGalleryStatus(state.gallery,ui.recognitionEnabled.checked);
 if(status.requiredComplete)void saveForm();
 else void captureGuidedPhoto();
});
ui.captureSample.addEventListener('click', captureFaceSample);
ui.recognitionEnabled.addEventListener('change',()=>{updateEnrollmentUi();updateCaptureCoach();updateSaveAction();});
ui.useLatestPrimary.addEventListener('click', () => {
  if (!state.latestPhoto) return;
  state.primaryPhoto = state.latestPhoto;
  updatePhotos();
  setMessage('Latest capture selected as primary photo. Save the profile to keep the change.', 'ok');
});
const enrollmentAutostart=document.getElementById('participantCameraAutostart');
enrollmentAutostart.checked=loadCameraPreference(window.localStorage);
enrollmentAutostart.addEventListener('change',()=>{
 saveCameraPreference(window.localStorage,enrollmentAutostart.checked);
});
ui.save.addEventListener('click', saveForm);
ui.reset.addEventListener('click', clearForm);
ui.delete.addEventListener('click', removeCurrentParticipant);
window.addEventListener('beforeunload', stopCamera);

clearForm();
await prunePendingCaptures().catch(() => {});
await reloadParticipants();
await loadPendingFromUrl();
async function startCameraIfPreviouslyApproved(){
 if(state.stream || state.manuallyStoppedThisPage || !loadCameraPreference(window.localStorage))return;
 const permission=await cameraPermissionState(navigator.permissions);
 if(cameraAutostartEligible({optIn:true,permission,
   supported:!!navigator.mediaDevices?.getUserMedia,sessionStopped:state.manuallyStoppedThisPage})){
   if(!state.manuallyStoppedThisPage && !state.stream)await startCamera();
 }else if(permission==='denied'){
   setMessage('Camera access is blocked in browser settings. Restore permission and click Start camera.','error');
 }
}
void startCameraIfPreviouslyApproved();
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden && !state.stream && !state.manuallyStoppedThisPage){
   void startCameraIfPreviouslyApproved();
 }
});
window.addEventListener('tracky:participant-voice-recording',event=>{
 state.voiceRecording=Boolean(event.detail?.recording);
 updateSaveAction();
 if(state.voiceRecording)setMessage('Voice Profile recording active · stop or finish the sample before saving.','ok');
});

window.addEventListener('tracky:participant-voice-draft',event=>{
 state.voiceDraft=voiceDraftSaveFields(event.detail?.profile||{});
 const count=state.voiceDraft.voiceEmbeddings?.length||0;
 if(count)setMessage('Voice Profile draft captured · '+count+'/3 samples. It will be stored when you save the participant.','ok');
});

window.addEventListener('tracky:participant-voice-updated', async () => {
  await reloadParticipants();
});

window.addEventListener('tracky:account-participant-sync',event=>{
 const detail=event.detail||{};
 void reloadParticipants();
 if(detail.status==='conflict')
  setMessage('This participant changed on another signed-in device. Edit and Save to keep this device copy; otherwise reload the account version from another device first.','error');
 else if(detail.status==='error')
  setMessage('Account participant sync is offline: '+(detail.error||'local changes remain queued.'),'error');
});

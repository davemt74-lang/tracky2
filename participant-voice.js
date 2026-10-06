import { getParticipant, patchParticipant } from './src/participant-store.js';
import {assessVoiceSampleLevels,voiceProfileReadiness} from './src/voice-core.js';
import {
  emptyVoiceDraft,normalizeVoiceDraft,appendVoiceDraftSample
} from './src/participant-enrollment-core.js';
import {
  MicrophoneCapture,
  VoiceIdentityEngine,
  extractVoiceEmbedding
} from './src/voice-engine.js';

const $ = (selector) => document.querySelector(selector);

const ui = {
  status: $('#voiceEnrollmentStatus'),
  orb: $('#voiceOrb'),
  samples: $('#voiceSampleCount'),
  seconds: $('#voiceTotalSeconds'),
  liveDb: $('#voiceLiveDb'),
  model: $('#voiceModelState'),
  bars: $('#voiceWaveBars'),
  progress: $('#voiceCaptureProgress'),
  stage: $('#voiceStageLabel'),
  detail: $('#voiceStageDetail'),
  record: $('#recordVoiceSample'),
  stop: $('#stopVoiceSample'),
  recognition: $('#voiceRecognitionEnabled'),
  script: $('#voiceReadScriptText')
};

const state = {
  participant: null,
  draft: emptyVoiceDraft(),
  engine: new VoiceIdentityEngine(),
  capture: new MicrophoneCapture(),
  recording: false,
  recordingParticipantId: null,
  recordStartedAt: 0,
  meterRaf: 0,
  autoStopTimer: 0,
  levels: [],
  stage: 'idle'
};

const AUTO_STOP_SECONDS = 10;
const MIN_SAMPLE_SECONDS = 3.5;
const VOICE_READ_SCRIPTS=Object.freeze([
 'My voice is calm and clear. I am creating my Tracky voice profile so the system can recognize me when I speak naturally.',
 'Today I am speaking at my normal pace and volume. Tracky is learning the sound of my voice for accurate speaker recognition.',
 'This is another voice sample for my profile. I will keep speaking clearly and naturally so Tracky can tell when I am the person talking.'
]);
const DRAFT_ID='__participant-draft__';

function activeProfile(){return state.participant||state.draft;}
function currentReadScript(){
 const count=activeProfile()?.voiceEmbeddings?.length||0;
 return VOICE_READ_SCRIPTS[Math.min(count,VOICE_READ_SCRIPTS.length-1)];
}

function emitRecording(recording){
 window.dispatchEvent(new CustomEvent('tracky:participant-voice-recording',{detail:{recording:Boolean(recording)}}));
}

function emitDraft(){
 window.dispatchEvent(new CustomEvent('tracky:participant-voice-draft',{
  detail:{profile:normalizeVoiceDraft(state.draft)}
 }));
}

function setStage(stage, detail) {
  state.stage = stage;
  ui.stage.textContent = String(stage || '').toUpperCase().replaceAll('-', ' ');
  ui.detail.textContent = detail || '';
  ui.orb.dataset.stage = stage;
}

function setPipeline(stage) {
  const order = ['capture', 'clean', 'embed', 'redundancy', 'ready'];
  document.querySelectorAll('[data-voice-stage]').forEach((node) => {
    const current = order.indexOf(stage);
    const item = order.indexOf(node.dataset.voiceStage);
    node.classList.toggle('active', current >= 0 && item <= current);
    node.classList.toggle('current', node.dataset.voiceStage === stage);
  });
}

function renderBars(db) {
  const normalized = Math.max(0, Math.min(1, (db + 65) / 50));
  [...ui.bars.children].forEach((bar, index, all) => {
    const center = (all.length - 1) / 2;
    const shape = 1 - Math.abs(index - center) / Math.max(1, center + 1);
    const level = Math.max(0.08, normalized * (0.42 + shape * 0.78));
    bar.style.transform = 'scaleY(' + level.toFixed(3) + ')';
    bar.classList.toggle('hot', db > -28);
  });
}

function render() {
  const participant = state.participant;
  const profile=activeProfile();
  const saved = Boolean(participant?.id);
  const readiness = voiceProfileReadiness(profile || {});
  const sampleCount = profile?.voiceEmbeddings?.length || 0;

  ui.samples.textContent = sampleCount + ' / 3';
  if(ui.script)ui.script.textContent=currentReadScript();
  ui.seconds.textContent = readiness.totalSeconds.toFixed(1) + 's';
  ui.recognition.disabled = state.recording;
  ui.record.disabled = state.recording;
  ui.stop.disabled = !state.recording;
  ui.recognition.checked = profile?.voiceRecognitionEnabled !== false;

  ui.status.textContent = saved
    ? readiness.ready
      ? 'Voice profile ready · redundant speaker samples active'
      : sampleCount
        ? 'Voice profile building · ' + sampleCount + ' / 3 samples'
        : 'Voice profile not enrolled'
    : readiness.ready
      ? 'Draft Voice Profile ready · save participant to keep it'
      : sampleCount
        ? 'Draft Voice Profile building · ' + sampleCount + ' / 3 · saves with participant'
        : 'Voice Profile ready to capture · saves with participant';

  if (readiness.ready) setPipeline('ready');
  else if (sampleCount >= 2) setPipeline('redundancy');
  else if (sampleCount >= 1) setPipeline('embed');
  else setPipeline('capture');

  if (!state.recording && state.stage === 'idle') {
    setStage(
      readiness.ready ? 'voice profile ready' : 'voice profile enrollment',
      readiness.ready
        ? saved
          ? 'Tracky can use this participant voice signature for live speaker tracking.'
          : 'Draft Voice Profile is complete. Save the participant to keep it.'
        : saved
          ? 'Capture three clean speech samples from slightly different phrases.'
          : 'Capture three clean phrases now. The Voice Profile will be saved with the new participant.'
    );
  }
}

async function cancelRecordingForProfileChange() {
  if (!state.recording) return;
  state.recording = false;
  state.recordingParticipantId = null;
  cancelAnimationFrame(state.meterRaf);
  clearTimeout(state.autoStopTimer);
  state.capture.stopStream();
  state.levels = [];
  ui.liveDb.textContent = '— dB';
  ui.progress.style.width = '0%';
  renderBars(-100);
  emitRecording(false);
}

async function loadParticipant(participantId) {
  const nextId=participantId||'';
  if (state.recording && nextId !== String(state.recordingParticipantId||'')) {
    await cancelRecordingForProfileChange();
  }

  if (!participantId) {
    state.participant = null;
    state.draft=emptyVoiceDraft();
    state.stage = 'idle';
    render();
    emitDraft();
    return;
  }

  state.participant = await getParticipant(participantId);
  state.draft=emptyVoiceDraft();
  state.stage = 'idle';
  render();
}

async function ensureEngine() {
  if (state.engine.ready) return true;
  ui.model.textContent = 'Loading WavLM…';
  setStage('loading speaker model', 'Preparing the local voice-profile model.');

  try {
    await state.engine.init();
    ui.model.textContent = 'WavLM online';
    return true;
  } catch (error) {
    console.error(error);
    ui.model.textContent = 'Model unavailable';
    setStage('voice model error', 'Speaker model could not load. Check network access and try again.');
    return false;
  }
}

function meterLoop() {
  if (!state.recording) return;
  const level = state.capture.level();
  state.levels.push(level.db);
  ui.liveDb.textContent = level.db.toFixed(1) + ' dB';
  renderBars(level.db);

  const elapsed = Math.max(0, (performance.now() - state.recordStartedAt) / 1000);
  ui.progress.style.width = Math.min(100, elapsed / AUTO_STOP_SECONDS * 100) + '%';
  setStage('capturing voice profile', elapsed.toFixed(1) + 's · read the script aloud at your normal pace and volume');
  setPipeline('capture');
  state.meterRaf = requestAnimationFrame(meterLoop);
}

async function startRecording() {
  if (state.recording) return;
  try {
    await state.capture.start();
    state.recording = true;
    state.recordingParticipantId = state.participant?.id || DRAFT_ID;
    state.recordStartedAt = performance.now();
    state.levels = [];
    ui.progress.style.width = '0%';
    emitRecording(true);
    render();
    meterLoop();

    clearTimeout(state.autoStopTimer);
    state.autoStopTimer = setTimeout(() => void stopRecording(), AUTO_STOP_SECONDS * 1000);
  } catch (error) {
    console.error(error);
    setStage(
      'microphone error',
      window.isSecureContext ? 'Could not open the microphone. Check browser permission and try again.' : 'Microphone access requires localhost or HTTPS.'
    );
  }
}

async function stopRecording() {
  if (!state.recording) return;

  const recordingParticipantId = state.recordingParticipantId;
  state.recording = false;
  state.recordingParticipantId = null;
  cancelAnimationFrame(state.meterRaf);
  clearTimeout(state.autoStopTimer);
  emitRecording(false);

  setStage('noise gate', 'Checking level and rejecting unusable background-only audio.');
  setPipeline('clean');
  render();

  try {
    const sample = await state.capture.stop();
    ui.liveDb.textContent = '— dB';
    renderBars(-100);

    if (!sample || sample.durationSeconds < MIN_SAMPLE_SECONDS) {
      setStage('sample too short', 'Capture at least ' + MIN_SAMPLE_SECONDS + ' seconds of natural speech.');
      return;
    }

    const quality = assessVoiceSampleLevels(state.levels,{minPeakDb:-52,minSignalDb:7,minSpeechFraction:.12});
    if (!quality.accept) {
      setStage(
        'sample rejected',
        quality.signalDb < 7
          ? 'Your voice was too close to the room noise level. Move a little closer to the microphone and read the script again.'
          : 'The sample did not contain enough clear speech. Read the full on-screen sentence at your normal pace until recording stops.'
      );
      return;
    }

    const engineReady = await ensureEngine();
    if (!engineReady) return;

    setPipeline('embed');
    setStage('extracting voice identity', 'Converting the clean speech sample into a local speaker signature.');
    const embedding = await extractVoiceEmbedding(state.engine, sample.blob);

    const draftCapture=recordingParticipantId===DRAFT_ID;
    const current = draftCapture
      ? state.draft
      : recordingParticipantId
        ? await getParticipant(recordingParticipantId)
        : null;
    if (!current) {
      setStage('profile changed', 'The participant changed before this sample completed, so the sample was discarded.');
      return;
    }

    const updatedAt=new Date().toISOString();
    const result=appendVoiceDraftSample(current,{
      embedding,
      sample:{
        durationSeconds: sample.durationSeconds,
        peakDb: quality.peakDb,
        avgDb: quality.averageDb,
        noiseFloorDb: quality.noiseFloorDb,
        signalDb: quality.signalDb,
        speechFraction: quality.speechFraction,
        createdAt:updatedAt
      },
      recognitionEnabled:ui.recognition.checked,
      updatedAt
    });

    if (!result.accepted) {
      setPipeline('clean');
      setStage(
        'speaker mismatch',
        'This sample does not match the existing Voice Profile closely enough. It was not added.'
      );
      return;
    }

    const readiness=voiceProfileReadiness(result.profile);
    setPipeline(readiness.ready ? 'ready' : 'redundancy');
    setStage(
      readiness.ready ? 'voice profile ready' : 'building redundancy',
      readiness.ready
        ? draftCapture
          ? 'Three or more voice signatures are ready. Save the participant to keep this Voice Profile.'
          : 'Three or more voice signatures are available for live speaker tracking.'
        : draftCapture
          ? 'Sample captured in the draft. Capture additional phrases, then save the participant.'
          : 'Sample saved. Capture additional phrases so Tracky can verify the speaker redundantly.'
    );

    if(draftCapture){
      state.draft=result.profile;
      emitDraft();
    }else{
      state.participant = await patchParticipant(current.id,result.profile);
      window.dispatchEvent(new CustomEvent('tracky:participant-voice-updated', {
        detail: { participantId: current.id }
      }));
    }
    ui.progress.style.width = '100%';
  } catch (error) {
    console.error(error);
    setStage('voice profile error', error.message || 'Could not process voice profile sample.');
  } finally {
    state.levels=[];
    render();
  }
}

async function saveRecognitionPreference() {
  const updatedAt=new Date().toISOString();
  if (!state.participant?.id) {
    state.draft=normalizeVoiceDraft({
      ...state.draft,
      voiceRecognitionEnabled:ui.recognition.checked,
      voiceUpdatedAt:updatedAt
    });
    emitDraft();
    render();
    return;
  }
  state.participant = await patchParticipant(state.participant.id, {
    voiceRecognitionEnabled: ui.recognition.checked,
    voiceUpdatedAt: updatedAt
  });
  render();
  window.dispatchEvent(new CustomEvent('tracky:participant-voice-updated', {
    detail: { participantId: state.participant.id }
  }));
}

ui.record.addEventListener('click', startRecording);
ui.stop.addEventListener('click', stopRecording);
ui.recognition.addEventListener('change', saveRecognitionPreference);

window.addEventListener('tracky:participant-loaded', (event) => loadParticipant(event.detail.participantId));
window.addEventListener('tracky:participant-saved', (event) => loadParticipant(event.detail.participantId));
window.addEventListener('tracky:participant-cleared', async () => {
 await cancelRecordingForProfileChange();
 state.participant=null;state.draft=emptyVoiceDraft();state.stage='idle';render();emitDraft();
});
window.addEventListener('beforeunload', () => {
  state.recording = false;
  state.recordingParticipantId = null;
  state.capture.stopStream();
});

const initialId = document.body.dataset.participantId || '';
if(initialId)await loadParticipant(initialId);
else render();

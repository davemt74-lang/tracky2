import { clamp01, detectColorBlob } from './src/tracker-core.js';
import { createMotionStats, recordMotion, summarizeMotion, zoneForY } from './src/movement-core.js';
import { createGameSession } from './src/game-session.js';
import { createMultiplayerMatch } from './src/multiplayer-match.js';
import { createGamePlatform } from './src/game-platform.js';
import { randomFollowPatternGame } from './src/games/random-follow-pattern.js';
import { resolvePatternPlayers } from './src/games/pattern-setup.js';
import { detectColorControllers, createColorCalibration, validateColorCalibration } from './src/color-controllers.js';
import { createControllerStability } from './src/controller-stability.js';
import { playerPresenceEvidence } from './src/player-presence.js';
import { browserMatchStorage, readMatchHistory, saveMatchHistory, clearMatchHistory, playerProgress } from './src/match-history.js';
import { toColorControllerInput } from './src/game-input.js';
import { gamePresentation } from './src/game-presenter.js';
import {
  advanceScan,
  bestParticipantMatch
} from './src/participant-core.js';
import {
  BODY_OCCLUSION_GRACE_MS,
  associateFacesToBodies,
  assignBodyTracks,
  augmentBodiesWithFaceFallbacks,
  attachFacesToTracks,
  carryOccludedTracks,
  dedupeParticipantAssignments,
  roomPresenceState
} from './src/room-tracking-core.js';
import { IdentityEngine, cropFacePhoto } from './src/identity-engine.js';
import {
  acknowledgeNewTrack,
  bestVoiceMatch,
  buildConversationGroups,
  conversationGroupForTrack,
  createSpeakerTurn,
  transcriptSignalGate,
  voiceProfileReadiness
} from './src/voice-core.js';
import { VoiceIdentityEngine } from './src/voice-engine.js';
import { LocalTranscriptionEngine, RoomAudioCapture } from './src/room-audio-engine.js';
import {
  clearDialogueTurns,
  deleteDialogueTurn,
  listDialogueTurns,
  listParticipants,
  patchParticipant,
  saveDialogueTurn,
  savePendingCapture
} from './src/participant-store.js';

const $ = (s) => document.querySelector(s);

const ui = {
  gameMode: $('#gameMode'),
  multiplayerSettings: $('#multiplayerSettings'),
  patternSetup: $('#patternSetup'),
  playerCount: $('#patternPlayerCount'),
  interval: $('#patternInterval'),
  rounds: $('#patternRounds'),
  bluePlayerWrap: $('#bluePlayerWrap'),
  roundTimer: $('#roundTimer'),
  historySaveOption: $('#historySaveOption'),
  matchHistoryPanel: $('#matchHistoryPanel'),
  matchHistoryStatus: $('#matchHistoryStatus'),
  playerProgress: $('#playerProgress'),
  recentMatches: $('#recentMatches'),
  clearMatchHistory: $('#clearMatchHistory'),
  multiplayerStage: $('#multiplayerStage'),
  multiplayerSetupStatus: $('#multiplayerSetupStatus'),
  turnLabel: $('#multiTurnLabel'),
  board: $('#sharedBoard'),
  boardCursor: $('#boardCursor'),
  boardInstruction: $('#boardInstruction'),
  stabilityStatus: $('#stabilityStatus'),
  greenDetection: $('#greenDetection'),
  blueDetection: $('#blueDetection'),
  calibrationStatus: $('#calibrationStatus'),
  calibrationPreset: $('#calibrationPreset'),
  greenHueMin: $('#greenHueMin'),
  greenHueMax: $('#greenHueMax'),
  greenSatMin: $('#greenSatMin'),
  blueHueMin: $('#blueHueMin'),
  blueHueMax: $('#blueHueMax'),
  blueSatMin: $('#blueSatMin'),
  markerArea: $('#markerArea'),
  saveCalibration: $('#saveCalibration'),
  resetCalibration: $('#resetCalibration'),
  greenPlayer: $('#greenPlayer'),
  bluePlayer: $('#bluePlayer'),
  start: $('#startCamera'),
  stop: $('#stopCamera'),
  reset: $('#resetSession'),
  pause: $('#pauseStats'),
  select: $('#cameraSelect'),
  video: $('#cameraVideo'),
  trackingCanvas: $('#trackingCanvas'),
  cursor: $('#laneCursor'),
  lane: $('#movementLane'),
  instructions: $('#gameInstructions'),
  cameraStatus: $('#cameraStatus'),
  trackingStatus: $('#trackingStatus'),
  identityStatus: $('#identityStatus'),
  voiceStatus: $('#voiceStatus'),
  participantCards: $('#participantCards'),
  participantHudEmpty: $('#participantHudEmpty'),
  roomRadarTracks: $('#roomRadarTracks'),
  roomMicDb: $('#roomMicDb'),
  roomNoiseDb: $('#roomNoiseDb'),
  roomVadState: $('#roomVadState'),
  roomVoiceModel: $('#roomVoiceModel'),
  roomAudioPath: $('#roomAudioPath'),
  roomSpeaker: $('#roomSpeaker'),
  roomVoiceConfidence: $('#roomVoiceConfidence'),
  roomBodyLock: $('#roomBodyLock'),
  roomDialogueGroup: $('#roomDialogueGroup'),
  transcriptModelState: $('#transcriptModelState'),
  roomEvents: $('#roomEvents'),
  dialogueTurns: $('#dialogueTurns'),
  startRoomAudio: $('#startRoomAudio'),
  stopRoomAudio: $('#stopRoomAudio'),
  clearDialogue: $('#clearDialogue'),
  liveTranscription: $('#liveTranscription'),
  voiceAcknowledgements: $('#voiceAcknowledgements'),
  mirror: $('#mirrorCamera'),
  sensitivity: $('#motionSensitivity'),
  pointGoal: $('#pointGoal'),
  startGame: $('#startGame'),
  endGame: $('#endGame'),
  gameScore: $('#gameScore'),
  gameReps: $('#gameReps'),
  liveY: $('#liveY'),
  liveDelta: $('#liveDelta'),
  liveZone: $('#liveZone'),
  liveHz: $('#liveHz'),
  trace: $('#motionTrace'),
  statSamples: $('#statSamples'),
  statRate: $('#statRate'),
  statTravel: $('#statTravel'),
  statRange: $('#statRange'),
  statUp: $('#statUp'),
  statDown: $('#statDown'),
  statMicro: $('#statMicro'),
  statMicroEvents: $('#statMicroEvents'),
  statReversals: $('#statReversals'),
  statMicroReversals: $('#statMicroReversals'),
  statOscillation: $('#statOscillation'),
  statTime: $('#statTime')
};

const platform = createGamePlatform();
platform.register(randomFollowPatternGame);

const ctx = ui.trackingCanvas.getContext('2d', { willReadFrequently: true });
const traceCtx = ui.trace.getContext('2d');

const state = {
  stream: null,
  running: false,
  paused: false,
  raf: 0,
  rawY: null,
  displayX: 0.5,
  displayY: 0.5,
  stats: createMotionStats(),
  gameplay: createGameSession({ pointGoal: 5 }),
  mode: 'pattern',
  pattern: null,
  multiplayer: createMultiplayerMatch({ pointGoal: 5 }),
  multiMotion: { green: createMotionStats(4), blue: createMotionStats(4) },
  calibration: createColorCalibration(),
  markerTracker: createControllerStability(),
  matchStartedMs: 0,
  matchResultId: null,
  matchSaved: false,
  latestMarkerDetections: { green: null, blue: null },
  trace: [],
  lastUiUpdate: 0,
  identity: {
    engine: new IdentityEngine(),
    ready: false,
    loading: false,
    busy: false,
    lastScanAt: 0,
    tracks: [],
    participants: [],
    counter: 0
  },
  voice: {
    engine: new VoiceIdentityEngine(),
    transcriber: new LocalTranscriptionEngine(),
    audio: null,
    active: false,
    speakerReady: false,
    speakerLoading: false,
    transcriptReady: false,
    transcriptLoading: false,
    processing: false,
    micDb: -100,
    noiseFloorDb: -60,
    vad: false,
    turns: [],
    events: [],
    announcedTracks: new Set(),
    announcedParticipants: new Set(),
    groups: [],
    currentSpeakerId: null,
    currentSpeakerName: null,
    currentVoiceConfidence: 0,
    currentBodyLock: false,
    currentGroupId: null,
    sessionId: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'room-' + Date.now().toString(36),
    queue: [],
    lastDecision: 'standby',
    rejectedSegments: 0,
    ttsPending: 0,
    captureMode: 'offline',
    generation: 0
  }
};

const LANE_HEIGHT_IN = 5;
const CURSOR_RADIUS_IN = 0.09;
const MAX_TRACE_SAMPLES = 600;
const MICRO_THRESHOLD = 0.015;
const IDENTITY_SCAN_INTERVAL = 650;
const TRACK_GRACE_MS = BODY_OCCLUSION_GRACE_MS;
const PHOTO_REFRESH_INTERVAL_MS = 5000;

function detectOptions() {
  return {
    hueMin: 70,
    hueMax: 170,
    saturationMin: 35,
    valueMin: 20,
    minAreaRatio: 0.002,
    sampleStep: 2
  };
}

function inches(value) {
  return (value * LANE_HEIGHT_IN).toFixed(3) + ' in';
}

function seconds(ms) {
  return (ms / 1000).toFixed(1) + 's';
}

function signed(value, digits = 4) {
  if (!Number.isFinite(value)) return '—';
  const n = value.toFixed(digits);
  return value > 0 ? '+' + n : n;
}

function pointGoalValue() {
  const parsed = Math.round(Number(ui.pointGoal.value) || 5);
  const goal = Math.max(1, Math.min(50, parsed));
  ui.pointGoal.value = String(goal);
  return goal;
}

function setCursor(x, y, visible) {
  if (!visible) {
    ui.cursor.hidden = true;
    return;
  }

  const yEdge = CURSOR_RADIUS_IN / LANE_HEIGHT_IN;
  const xEdge = CURSOR_RADIUS_IN;
  const constrainedX = xEdge + clamp01(x) * (1 - xEdge * 2);
  const constrainedY = yEdge + clamp01(y) * (1 - yEdge * 2);
  ui.cursor.style.left = (constrainedX * 100) + '%';
  ui.cursor.style.top = (constrainedY * 100) + '%';
  ui.cursor.hidden = false;
}


function refreshPlayerChoices() {
  for (const [color, select] of [['green', ui.greenPlayer], ['blue', ui.bluePlayer]]) {
    const chosen = select.value;
    select.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Select enrolled player…';
    select.append(empty);
    for (const p of state.identity.participants) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name || p.nickname || 'Participant';
      select.append(option);
    }
    if (state.identity.participants.some(p => p.id === chosen)) select.value = chosen;
  }
}

function patternActive() {
  return state.pattern?.snapshot(performance.now()).active === true;
}

function updatePatternSetup() {
  const inPattern = state.mode === 'pattern';
  ui.patternSetup.hidden = !inPattern;
  ui.bluePlayerWrap.hidden = inPattern && Number(ui.playerCount.value) === 1;
  const locked = patternActive();
  for (const el of ui.patternSetup.querySelectorAll('select,input')) el.disabled = locked;
  ui.bluePlayer.disabled = locked || (inPattern && Number(ui.playerCount.value) === 1);
}

function renderMode() {
  const multi = state.mode !== 'solo';
  document.body.classList.toggle('multiplayer-mode', multi);
  document.body.classList.toggle('pattern-mode', state.mode === 'pattern');
  ui.multiplayerSettings.hidden = !multi;
  ui.multiplayerStage.hidden = !multi;
  ui.matchHistoryPanel.hidden = state.mode !== 'multiplayer';
  updatePatternSetup();
  if (state.mode === 'pattern') renderPattern();
  else if (state.mode === 'multiplayer') { renderMultiplayer(); renderMatchHistory(); }
  else renderGame();
}

function playerScoreCard(color) {
  return ui.multiplayerStage.querySelector('[data-player-color="' + color + '"]');
}

function renderPattern(now = performance.now()) {
  if (state.mode !== 'pattern') return;
  const match = state.pattern?.snapshot(now);
  const active = Boolean(match?.active);
  const chosenCount = Number(ui.playerCount.value);
  const activePlayer = match?.players.find(p => p.color === match.activeColor);
  ui.gameMode.disabled = active;
  ui.greenPlayer.disabled = active;
  ui.bluePlayer.disabled = active || chosenCount === 1;
  ui.startGame.disabled = active;
  ui.startGame.textContent = match?.status === 'completed' ? 'Play again' : 'Start pattern';
  ui.endGame.disabled = !active;
  ui.pointGoal.disabled = active;
  ui.board.dataset.activeColor = active ? match.activeColor : 'idle';
  updatePatternSetup();
  for (const color of ['green','blue']) {
    const card = playerScoreCard(color);
    const p = match?.players.find(person => person.color === color);
    card.hidden = color === 'blue' && chosenCount === 1;
    card.classList.toggle('on-turn', Boolean(active && p && p.color === match.activeColor));
    const selectedId = color === 'green' ? ui.greenPlayer.value : ui.bluePlayer.value;
    const selected = state.identity.participants.find(person => person.id === selectedId);
    card.querySelector('.multi-name').textContent = p?.name || selected?.name || (color === 'green'?'Player 1':'Player 2');
    card.querySelector('.multi-score').textContent = (p?.score ?? 0) + ' targets';
    card.querySelector('.multi-reps').textContent = p ?
      p.repsCompleted + ' reps · ' + p.roundsPlayed + ' rounds' : 'Choose a player';
    card.querySelector('.multi-travel').textContent = inches(
      summarizeMotion(state.multiMotion[color], now).totalTravel) + ' tracked';
    const profile = p ? state.identity.participants.find(person => person.id === p.participantId) : selected;
    const evidence = playerPresenceEvidence(profile?.id, state.identity.tracks,
      state.latestMarkerDetections[color], now, profile ? voiceProfileReadiness(profile).ready : false);
    card.querySelector('.multi-presence').textContent = evidence.presence === 'face-observed' ?
      'Face match observed' : evidence.presence === 'body-tracked' ? 'Body tracked' :
      evidence.presence === 'temporarily-occluded' ? 'Temporarily occluded' : 'Identity not verified';
    card.querySelector('.multi-marker-status').textContent =
      evidence.marker === 'near-assigned-body' ? 'Marker near assigned participant (unverified)' :
      evidence.marker === 'ambiguous-proximity' ? 'Marker proximity ambiguous' :
      'Marker holder not verified';
    card.querySelector('.multi-voice').textContent = evidence.voiceReady ? 'Voice Profile enrolled' : 'Voice Profile not enrolled';
  }
  for(const cell of ui.board.querySelectorAll('[data-board-zone]')){
    const i=Number(cell.dataset.boardZone);
    const target=active && match.activeZone===i;
    cell.classList.toggle('target',Boolean(target));
    cell.querySelector('b').textContent=target?String(match.repsRemaining):String(i+1);
  }
  ui.roundTimer.textContent = active ?
    'Round ' + match.round + '/' + match.totalRounds + ' · ' +
    Math.ceil(match.remainingMs/1000) + ' seconds remaining' :
    match?.status==='completed' ? match.totalRounds + ' rounds complete' :
    match?.status==='stopped' ? 'Game ended early' : 'Select players, interval and rounds';
  ui.turnLabel.textContent = activePlayer ?
    activePlayer.name + "'s turn · " + match.activeColor.toUpperCase() :
    match?.status==='completed' ? 'Game complete' : 'Random Follow Pattern';
  ui.boardInstruction.textContent = active ?
    'ZONE ' + (match.activeZone+1) + ' · ' + match.repsRemaining + ' up/down reps' :
    match?.status==='completed' ? 'All timed rounds are complete.' :
    'Random zone and rep targets will continue until each interval expires.';
}

function loopPattern(image,now) {
  const detections=detectColorControllers(image,{calibration:state.calibration});
  state.latestMarkerDetections=detections;
  const before=state.pattern?.snapshot(now);
  const color=before?.activeColor;
  const observation=color && before.active ? state.markerTracker.observe(detections[color],now):null;
  const input=toColorControllerInput(observation?.sample,ui.mirror.checked,now);
  setBoardCursor(input);
  if(color && before.active){
    if(!input)state.pattern.signalLost(color);
    else{
      if(!state.paused)recordMotion(state.multiMotion[color],input.y,now,{
        noiseFloor:Number(ui.sensitivity.value),microThreshold:MICRO_THRESHOLD
      });
      const result=state.pattern.sample(color,input);
      if(result.type==='target-complete')renderPattern(now);
    }
  }
  ui.trackingStatus.textContent='Green '+(detections.green?'visible':'missing')+
    ' · Blue '+(detections.blue?'visible':'missing');
  if(now-state.lastUiUpdate>=100){
    for(const c of ['green','blue']){
      const found=detections[c];
      const el=c==='green'?ui.greenDetection:ui.blueDetection;
      el.textContent=found?c.toUpperCase()+' visible · '+Math.round(found.confidence*100)+'% confidence':
        c.toUpperCase()+' marker not found';
    }
    ui.stabilityStatus.textContent=color?
      color.toUpperCase()+' · '+state.markerTracker.snapshot().status:'Controller ready';
    renderPattern(now);
    state.lastUiUpdate=now;
  }
}

function renderMultiplayer() {
  if (state.mode !== 'multiplayer') return;
  const match = state.multiplayer.snapshot();
  const active = match.players.find(p => p.color === match.activeColor);
  ui.gameMode.disabled = match.active;
  ui.greenPlayer.disabled = match.active;
  ui.bluePlayer.disabled = match.active;
  ui.startGame.disabled = match.active;
  ui.endGame.disabled = !match.active;
  ui.startGame.textContent = match.complete ? 'Play again' : 'Start match';
  ui.pointGoal.disabled = match.active;
  for (const el of ui.multiplayerSettings.querySelectorAll('input,select,button')) el.disabled = match.active;
  ui.board.dataset.activeColor = match.activeColor || 'idle';
  for (const color of ['green', 'blue']) {
    const card = playerScoreCard(color);
    const p = match.players.find(player => player.color === color);
    card.classList.toggle('on-turn', match.active && match.activeColor === color);
    card.querySelector('.multi-name').textContent = p?.name || (color === 'green' ? 'Green player' : 'Blue player');
    card.querySelector('.multi-score').textContent = (p?.score ?? 0) + ' / ' + (p?.pointGoal ?? pointGoalValue());
    card.querySelector('.multi-reps').textContent = p?.over ? 'Finished' :
      (p && match.activeColor === color && match.active ? p.repsRemaining + ' reps left' :
        p ? 'Waiting for turn' : 'Choose a participant');
    card.querySelector('.multi-travel').textContent =
      inches(summarizeMotion(state.multiMotion[color], performance.now()).totalTravel) + ' tracked';
    const savedProfile = p ? state.identity.participants.find(person => person.id === p.participantId) : null;
    const evidence = playerPresenceEvidence(p?.participantId, state.identity.tracks,
      state.latestMarkerDetections[color], performance.now(),
      savedProfile ? voiceProfileReadiness(savedProfile).ready : false);
    card.querySelector('.multi-presence').textContent = ({
      'face-observed': 'Face match observed', 'body-tracked': 'Recognized body tracked',
      'temporarily-occluded': 'Temporarily out of view',
      'not-visible': 'Participant not visible', 'not-assigned': 'No player selected'
    })[evidence.presence];
    card.querySelector('.multi-marker-status').textContent = ({
      'near-assigned-body': 'Marker near assigned body (advisory)',
      'ambiguous-proximity': 'Multiple bodies near marker · unclear',
      'unverified': 'Marker holder not verified'
    })[evidence.marker];
    card.querySelector('.multi-voice').textContent =
      evidence.voiceReady ? 'Voice Profile ready' : 'Voice Profile not enrolled';
  }
  for (const zone of ui.board.querySelectorAll('[data-board-zone]')) {
    const index = Number(zone.dataset.boardZone);
    const targeted = Boolean(match.active && active && active.activeZone === index);
    zone.classList.toggle('target', targeted);
    zone.querySelector('b').textContent = targeted ? String(active.repsRemaining) : String(index + 1);
  }
  ui.turnLabel.textContent = match.active && active ?
    active.name + "'s turn · " + active.color.toUpperCase() + ' · turn ' + match.turnNumber :
    match.complete ? 'Match complete' : 'Assign two players and start the match';
  ui.boardInstruction.textContent = match.active && active ?
    gamePresentation(active).title : match.complete ?
    'Both players completed their targets.' :
    'One four-section board for both players. Green takes the first turn.';
  if (match.complete) ui.multiplayerSetupStatus.textContent = 'Both participants completed the challenge.';
}

function setBoardCursor(input) {
  if (!input) { ui.boardCursor.hidden = true; return; }
  ui.boardCursor.style.left = (10 + input.x * 80) + '%';
  ui.boardCursor.style.top = (2 + input.y * 96) + '%';
  ui.boardCursor.hidden = false;
}

function loopMultiplayer(image, now) {
  const detections = detectColorControllers(image, { calibration: state.calibration });
  state.latestMarkerDetections = detections;
  const before = state.multiplayer.snapshot();
  const color = before.activeColor;
  const observation = color ? state.markerTracker.observe(detections[color], now) : null;
  const input = toColorControllerInput(observation?.sample, ui.mirror.checked, now);
  setBoardCursor(input);
  if (before.active && color) {
    if (!input) state.multiplayer.signalLost(color);
    else {
      if (!state.paused) recordMotion(state.multiMotion[color], input.y, now, {
        noiseFloor: Number(ui.sensitivity.value), microThreshold: MICRO_THRESHOLD
      });
      const result = state.multiplayer.sample(color, input);
      if (result.type === 'point' || result.type === 'game-over') {
        if (result.matchComplete) maybeRecordMatch(true);
        state.markerTracker.reset(); // Every new turn requires a new stable marker lock.
        setBoardCursor(null);
        renderMultiplayer();
      }
    }
  }
  ui.trackingStatus.textContent = 'Green ' + (detections.green ? 'tracked' : 'missing') +
    ' · Blue ' + (detections.blue ? 'tracked' : 'missing');
  if (now - state.lastUiUpdate >= 100) {
    for (const c of ['green','blue']) {
      const el = c === 'green' ? ui.greenDetection : ui.blueDetection;
      const found = detections[c];
      el.textContent = found ?
        c.toUpperCase() + ' visible · ' + Math.round(found.confidence * 100) + '% confidence' :
        c.toUpperCase() + ' marker not found';
    }
    const lock = state.markerTracker.snapshot();
    ui.stabilityStatus.textContent = before.active && color ?
      color.toUpperCase() + ' marker · ' + (lock.locked ? 'stable tracking' :
      lock.status === 'acquiring' ? 'acquiring ' + lock.consecutive + '/' + lock.stableFrames :
      lock.status === 'jump-rejected' ? 'implausible jump rejected · reacquiring' :
      'waiting for stable marker') : 'Camera marker gate is ready for the next match';
    renderMultiplayer();
    state.lastUiUpdate = now;
  }
}

const CALIBRATION_STORAGE_KEY = 'tracky2-color-calibration-v1';
function populateCalibration(profile) {
  ui.greenHueMin.value = String(profile.green.hueMin);
  ui.greenHueMax.value = String(profile.green.hueMax);
  ui.greenSatMin.value = String(profile.green.saturationMin);
  ui.blueHueMin.value = String(profile.blue.hueMin);
  ui.blueHueMax.value = String(profile.blue.hueMax);
  ui.blueSatMin.value = String(profile.blue.saturationMin);
  ui.markerArea.value = String(profile.minAreaRatio);
}
function calibrationFromControls() {
  const base = state.calibration;
  return validateColorCalibration({
    green: { ...base.green,
      hueMin: Number(ui.greenHueMin.value), hueMax: Number(ui.greenHueMax.value),
      saturationMin: Number(ui.greenSatMin.value) },
    blue: { ...base.blue,
      hueMin: Number(ui.blueHueMin.value), hueMax: Number(ui.blueHueMax.value),
      saturationMin: Number(ui.blueSatMin.value) },
    minAreaRatio: Number(ui.markerArea.value)
  });
}
function restoreCalibration() {
  try {
    const saved = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (saved) state.calibration = validateColorCalibration(JSON.parse(saved));
    ui.calibrationStatus.textContent = saved ? 'Saved local camera calibration loaded.' :
      'Default calibration. Check both markers before playing.';
  } catch {
    state.calibration = createColorCalibration();
    ui.calibrationStatus.textContent = 'Stored calibration invalid or inaccessible. Using defaults.';
  }
  populateCalibration(state.calibration);
}

function renderMatchHistory() {
  const rows = readMatchHistory(browserMatchStorage());
  ui.playerProgress.replaceChildren();
  ui.recentMatches.replaceChildren();
  const selected = [ui.greenPlayer.value, ui.bluePlayer.value].filter((id,i,all)=>
    id && all.indexOf(id) === i);
  for (const id of selected) {
    const profile = state.identity.participants.find(p=>p.id===id);
    const summary = playerProgress(rows,id);
    const card = document.createElement('article');
    const name = document.createElement('strong');
    name.textContent = profile?.name || profile?.nickname || 'Enrolled player';
    const stats = document.createElement('span');
    stats.textContent = summary.matches + ' saved matches · ' + summary.completedMatches +
      ' completed · best ' + summary.bestScore + ' points · ' + summary.totalRounds + ' rounds';
    card.append(name,stats);
    ui.playerProgress.append(card);
  }
  for (const match of rows.slice(0,5)) {
    const card = document.createElement('article');
    const date = document.createElement('strong');
    date.textContent = new Date(match.endMs).toLocaleString() +
      (match.completed ? ' · Completed' : ' · Ended early');
    const summary = document.createElement('p');
    summary.textContent = match.players.map(p=>{
      const profile=state.identity.participants.find(x=>x.id===p.participantId);
      const name=profile?.name || profile?.nickname || p.color + ' player';
      return name + ': ' + p.score + ' points, ' + p.completedRounds + ' rounds';
    }).join(' · ');
    card.append(date,summary);
    ui.recentMatches.append(card);
  }
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No saved matches on this device.';
    ui.recentMatches.append(empty);
  }
}
function maybeRecordMatch(completed) {
  if (state.matchSaved || !state.matchResultId || !ui.historySaveOption.checked) return;
  const result = saveMatchHistory(browserMatchStorage(), {
    id: state.matchResultId, startMs: state.matchStartedMs,
    endMs: Math.max(Date.now(), state.matchStartedMs), completed,
    players: state.multiplayer.snapshot().players.map(p=>({
      participantId:p.participantId,color:p.color,score:p.score,completedRounds:p.completedRounds
    }))
  });
  state.matchSaved = result.saved;
  ui.matchHistoryStatus.textContent = result.saved ?
    'Result saved locally. No camera, face or voice data was recorded.' :
    'Could not save results on this device.';
  renderMatchHistory();
}

function setGameInstructions(title, detail) {
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = detail;
  ui.instructions.replaceChildren(strong, span);
}

function renderGame() {
  const game = state.gameplay.game;
  const targetNodes = ui.lane.querySelectorAll('[data-target-zone]');
  const zoneNodes = ui.lane.querySelectorAll('.lane-zone');

  zoneNodes.forEach((node, index) => {
    node.classList.toggle('target', game.active && index === game.activeZone);
  });

  targetNodes.forEach((node) => {
    const zone = Number(node.dataset.targetZone);
    const active = game.active && zone === game.activeZone;
    node.hidden = !active;
    if (active) node.textContent = String(game.repsRemaining);
  });

  ui.gameScore.textContent = game.score + ' / ' + game.pointGoal;
  ui.gameReps.textContent = game.active ? String(game.repsRemaining) : '—';
  ui.pointGoal.disabled = game.active;
  ui.startGame.disabled = game.active;
  ui.endGame.disabled = !game.active;
  ui.startGame.textContent = game.over ? 'Play again' : 'Start game';
  ui.gameMode.disabled = game.active;

  const presentation = gamePresentation(game);
  setGameInstructions(presentation.title, presentation.detail);
}

async function enumerateCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === 'videoinput');
  const current = ui.select.value;

  ui.select.replaceChildren();
  cameras.forEach((camera, index) => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.textContent = camera.label || 'Camera ' + (index + 1);
    ui.select.append(option);
  });

  if (cameras.some((camera) => camera.deviceId === current)) ui.select.value = current;
  ui.select.disabled = cameras.length < 2;
}

async function reloadIdentityParticipants() {
  try {
    state.identity.participants = await listParticipants();
    refreshPlayerChoices();
  } catch (error) {
    console.error(error);
    state.identity.participants = [];
    refreshPlayerChoices();
  }
}

async function initRoomIdentity() {
  if (state.identity.ready || state.identity.loading) return;
  state.identity.loading = true;
  ui.identityStatus.textContent = 'Loading identity…';

  try {
    await reloadIdentityParticipants();
    await state.identity.engine.init();
    state.identity.ready = true;
    ui.identityStatus.textContent = 'Identity online';
  } catch (error) {
    console.error(error);
    ui.identityStatus.textContent = 'Identity unavailable';
  } finally {
    state.identity.loading = false;
  }
}

function nextTrackId() {
  state.identity.counter += 1;
  return 'T' + String(state.identity.counter).padStart(3, '0');
}

function participantById(id) {
  return state.identity.participants.find((participant) => participant.id === id) || null;
}

function statusLabel(track) {
  if (track.status === 'matched') return 'FACE + BODY LOCK';
  if (track.status === 'body-lock') return 'BODY LOCK';
  if (track.status === 'occluded') return 'OCCLUSION MEMORY';
  if (track.status === 'body-detected') return 'PERSON DETECTED';
  if (track.status === 'new') return 'NO ENROLLED MATCH';
  if (track.status === 'reacquiring') return 'REACQUIRING';
  if (track.status === 'align-face') return 'ALIGN FACE';
  if (track.status === 'ready') return 'MATCHING PROFILE';
  return 'SCANNING FACE';
}

function createParticipantCard(track) {
  const card = document.createElement('article');
  card.className = 'participant-scan-card ' + (track.status || 'scanning');

  const top = document.createElement('div');
  top.className = 'participant-card-top';

  const trackLabel = document.createElement('span');
  trackLabel.textContent = track.id;

  const stateLabel = document.createElement('b');
  stateLabel.textContent = statusLabel(track);

  top.append(trackLabel, stateLabel);

  const body = document.createElement('div');
  body.className = 'participant-card-body';

  const current = document.createElement('div');
  current.className = 'participant-current-photo';
  if (track.latestPhoto) {
    const image = document.createElement('img');
    image.src = track.latestPhoto;
    image.alt = '';
    current.append(image);
  } else {
    const scan = document.createElement('span');
    scan.className = 'scan-icon mini';
    current.append(scan);
  }

  const identity = document.createElement('div');
  identity.className = 'participant-card-identity';

  const name = document.createElement('strong');
  name.textContent = track.participantName || 'Unknown participant';

  const detail = document.createElement('span');
  if (track.status === 'matched') {
    detail.textContent = Math.round(track.similarity * 100) + '% face match · full-body track active';
  } else if (track.status === 'body-lock') {
    detail.textContent = 'Face not visible · identity held by body track';
  } else if (track.status === 'occluded') {
    detail.textContent = 'Temporarily occluded · preserving room identity';
  } else if (track.status === 'body-detected') {
    detail.textContent = 'Body detected · waiting for a usable face angle';
  } else if (track.status === 'new') {
    detail.textContent = 'Ready to create participant profile';
  } else if (track.status === 'reacquiring') {
    detail.textContent = 'Person temporarily out of view';
  } else {
    detail.textContent = Math.round(track.quality * 100) + '% face quality';
  }

  const meter = document.createElement('div');
  meter.className = 'participant-scan-meter';
  const fill = document.createElement('i');
  fill.style.width = Math.round(track.scanProgress || 0) + '%';
  meter.append(fill);

  identity.append(name, detail, meter);
  body.append(current, identity);

  const participant = track.participantId ? participantById(track.participantId) : null;
  const voiceReadiness = voiceProfileReadiness(participant || {});
  const recentlySpoke = Boolean(track.lastVoiceAt && performance.now() - track.lastVoiceAt < 2600);
  if (recentlySpoke) card.classList.add('speaking');

  if (participant?.primaryPhoto) {
    const saved = document.createElement('img');
    saved.className = 'participant-primary-badge';
    saved.src = participant.primaryPhoto;
    saved.alt = 'Saved primary profile photo';
    saved.title = 'Saved primary profile photo';
    body.append(saved);
  }

  const voiceData = document.createElement('div');
  voiceData.className = 'participant-voice-readout';

  const voiceRows = [
    ['VOICE PROFILE', participant ? (voiceReadiness.ready ? 'READY' : (voiceReadiness.embeddingCount + '/3')) : '—'],
    ['VOICE MATCH', track.voiceMatchConfidence ? Math.round(track.voiceMatchConfidence * 100) + '%' : '—'],
    ['AUDIO', recentlySpoke ? 'SPEAKER CONFIRMED' : 'QUIET'],
    ['BODY', track.participantId ? (track.status === 'occluded' ? 'MEMORY' : 'LOCK') : '—'],
    ['GROUP', track.conversationGroupId || '—']
  ];

  for (const [label, value] of voiceRows) {
    const row = document.createElement('span');
    const key = document.createElement('i');
    const val = document.createElement('b');
    key.textContent = label;
    val.textContent = value;
    row.append(key, val);
    voiceData.append(row);
  }

  card.append(top, body, voiceData);

  const actions = document.createElement('div');
  actions.className = 'participant-card-actions';

  if (track.participantId) {
    const updatePhoto = document.createElement('button');
    updatePhoto.type = 'button';
    updatePhoto.textContent = 'Use current photo';
    updatePhoto.disabled = !track.latestPhoto;
    updatePhoto.addEventListener('click', () => useTrackPhotoAsPrimary(track));

    const wrong = document.createElement('button');
    wrong.type = 'button';
    wrong.textContent = 'Not this person';
    wrong.addEventListener('click', () => rejectTrackMatch(track));

    const open = document.createElement('a');
    open.href = './participants.html';
    open.textContent = 'Profiles';

    actions.append(updatePhoto, wrong, open);
  } else if (track.status === 'new' && track.embedding) {
    const create = document.createElement('button');
    create.type = 'button';
    create.textContent = 'Create participant';
    create.addEventListener('click', () => createParticipantFromTrack(track));
    actions.append(create);
  }

  if (actions.children.length) card.append(actions);
  return card;
}

function renderRoomRadar(visibleTracks) {
  ui.roomRadarTracks.replaceChildren();

  for (const track of visibleTracks) {
    const dot = document.createElement('div');
    dot.className = 'radar-track ' + (track.participantId ? 'identified' : 'unknown');
    if (track.status === 'occluded') dot.classList.add('occluded');
    if (track.lastVoiceAt && performance.now() - track.lastVoiceAt < 2600) dot.classList.add('speaking');

    dot.style.left = ((track.cx || 0.5) * 100) + '%';
    dot.style.top = ((track.cy || 0.5) * 100) + '%';
    dot.title = (track.participantName || 'Unknown') + ' · ' + track.id;

    const label = document.createElement('span');
    label.textContent = (track.participantName || track.id) + (track.conversationGroupId ? ' · ' + track.conversationGroupId : '');
    dot.append(label);
    ui.roomRadarTracks.append(dot);
  }
}

function renderParticipantCards() {
  ui.participantCards.replaceChildren();
  const visible = state.identity.tracks
    .filter((track) => performance.now() - (track.lastBodySeenAt || track.lastSeenAt) < TRACK_GRACE_MS)
    .slice(0, 8);

  ui.participantHudEmpty.hidden = visible.length > 0;
  renderRoomRadar(visible);

  for (const track of visible) {
    ui.participantCards.append(createParticipantCard(track));
  }
}


function updateConversationGroups() {
  const groups = buildConversationGroups(state.identity.tracks);
  state.voice.groups = groups;

  state.identity.tracks = state.identity.tracks.map((track) => {
    const group = conversationGroupForTrack(groups, track.id);
    return {
      ...track,
      conversationGroupId: group
        ? (group.tracks.length > 1 ? group.id : 'SOLO')
        : null
    };
  });
}

function renderRoomEvents() {
  ui.roomEvents.replaceChildren();

  for (const event of state.voice.events.slice(-5).reverse()) {
    const row = document.createElement('div');
    row.className = 'room-event ' + (event.type || 'info');

    const time = document.createElement('span');
    time.textContent = new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const message = document.createElement('b');
    message.textContent = event.message;

    row.append(time, message);
    ui.roomEvents.append(row);
  }
}

function speakAcknowledgement(message) {
  if (!ui.voiceAcknowledgements.checked || !('speechSynthesis' in window)) return;

  state.voice.ttsPending += 1;
  state.voice.audio?.setSuppressed(true);

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1.02;
  utterance.pitch = 0.92;
  utterance.volume = 0.72;

  let released = false;
  let safetyTimer = 0;
  const releaseMic = () => {
    if (released) return;
    released = true;
    clearTimeout(safetyTimer);
    state.voice.ttsPending = Math.max(0, state.voice.ttsPending - 1);
    if (state.voice.ttsPending !== 0) return;

    setTimeout(() => {
      if (state.voice.ttsPending === 0) {
        state.voice.audio?.setSuppressed(false);
      }
    }, 350);
  };

  safetyTimer = setTimeout(releaseMic, 12000);
  utterance.addEventListener('end', releaseMic, { once: true });
  utterance.addEventListener('error', releaseMic, { once: true });

  try {
    speechSynthesis.speak(utterance);
  } catch (error) {
    console.error(error);
    releaseMic();
  }
}

function pushRoomEvent(message, type = 'info', speak = false) {
  state.voice.events.push({
    message,
    type,
    at: Date.now()
  });
  if (state.voice.events.length > 30) state.voice.events.splice(0, state.voice.events.length - 30);
  renderRoomEvents();
  if (speak) speakAcknowledgement(message);
}

function acknowledgeRoomTracks(now) {
  for (const track of state.identity.tracks) {
    if (track.participantId && !state.voice.announcedParticipants.has(track.participantId)) {
      state.voice.announcedParticipants.add(track.participantId);
      state.voice.announcedTracks.add(track.id);
      const participant = participantById(track.participantId);
      const event = acknowledgeNewTrack(track, participant);
      pushRoomEvent(event.message, 'recognized', true);
      continue;
    }

    if (
      !track.participantId &&
      !state.voice.announcedTracks.has(track.id) &&
      now - (track.firstSeenAt || now) >= 1200
    ) {
      state.voice.announcedTracks.add(track.id);
      const event = acknowledgeNewTrack(track);
      pushRoomEvent(event.message, 'new', true);
    }
  }
}

function renderVoiceHud() {
  ui.roomMicDb.textContent = Number.isFinite(state.voice.micDb)
    ? state.voice.micDb.toFixed(1) + ' dB'
    : '— dB';
  ui.roomNoiseDb.textContent = Number.isFinite(state.voice.noiseFloorDb)
    ? state.voice.noiseFloorDb.toFixed(1) + ' dB'
    : '— dB';
  ui.roomVadState.textContent = state.voice.vad ? 'SPEECH' : 'QUIET';
  ui.roomVadState.dataset.active = state.voice.vad ? 'true' : 'false';
  ui.roomVoiceModel.textContent = state.voice.speakerReady
    ? 'Voice Profile online'
    : state.voice.speakerLoading
      ? 'Loading…'
      : 'Standby';
  ui.roomAudioPath.textContent = state.voice.captureMode === 'audio-worklet'
    ? 'AudioWorklet'
    : state.voice.captureMode === 'script-processor-fallback'
      ? 'Compatibility'
      : 'Offline';
  ui.roomSpeaker.textContent = state.voice.currentSpeakerName || '—';
  ui.roomVoiceConfidence.textContent = state.voice.currentVoiceConfidence
    ? Math.round(state.voice.currentVoiceConfidence * 100) + '%'
    : '—';
  ui.roomBodyLock.textContent = state.voice.currentSpeakerId
    ? (state.voice.currentBodyLock ? 'CONFIRMED' : 'NOT VISIBLE')
    : '—';
  ui.roomDialogueGroup.textContent = state.voice.currentGroupId || '—';

  ui.voiceStatus.textContent = !state.voice.active
    ? 'Voice standby'
    : state.voice.processing
      ? 'Analyzing speaker…'
      : state.voice.vad
        ? 'Speech detected'
        : state.voice.lastDecision === 'ambiguous-speaker'
          ? 'Speaker ambiguous'
          : state.voice.lastDecision === 'noise-rejected'
            ? 'Background rejected'
            : 'Room audio live';

  ui.transcriptModelState.textContent = !ui.liveTranscription.checked
    ? 'Transcription off'
    : state.voice.transcriptReady
      ? 'Local transcription online'
      : state.voice.transcriptLoading
        ? 'Loading transcription…'
        : 'Loads on first accepted turn';
}

function renderDialogueTurns() {
  ui.dialogueTurns.replaceChildren();

  const turns = state.voice.turns.slice(-8).reverse();
  if (!turns.length) {
    const empty = document.createElement('div');
    empty.className = 'dialogue-empty';
    empty.textContent = state.voice.active
      ? 'Listening for a clean speech turn…'
      : 'Enable room audio to begin speaker tracking.';
    ui.dialogueTurns.append(empty);
    return;
  }

  for (const turn of turns) {
    const card = document.createElement('article');
    card.className = 'dialogue-turn ' + (turn.participantId ? 'identified' : 'unknown');

    const top = document.createElement('div');
    top.className = 'dialogue-turn-top';

    const speaker = document.createElement('strong');
    speaker.textContent = turn.participantName || 'Unknown speaker';

    const meta = document.createElement('span');
    const bits = [];
    if (turn.groupId) bits.push(turn.groupId);
    if (turn.voiceConfidence) bits.push('voice ' + Math.round(turn.voiceConfidence * 100) + '%');
    bits.push('signal ' + Math.round(turn.signalConfidence * 100) + '%');
    meta.textContent = bits.join(' · ');

    top.append(speaker, meta);

    const transcript = document.createElement('p');
    transcript.textContent = turn.transcript || '[speaker turn detected — transcription unavailable]';

    const context = document.createElement('small');
    context.textContent = turn.nearbyParticipantNames.length
      ? 'Nearby: ' + turn.nearbyParticipantNames.join(', ')
      : turn.trackId
        ? 'Body track: ' + turn.trackId
        : 'No confirmed body association';

    card.append(top, transcript, context);
    ui.dialogueTurns.append(card);
  }
}

async function ensureSpeakerEngine() {
  if (state.voice.speakerReady) return true;

  const ownsLoadingState = !state.voice.speakerLoading;
  if (ownsLoadingState) {
    state.voice.speakerLoading = true;
    renderVoiceHud();
  }

  try {
    await state.voice.engine.init();
    state.voice.speakerReady = true;
    if (ownsLoadingState) pushRoomEvent('Voice Profile engine online.', 'system');
    return true;
  } catch (error) {
    console.error(error);
    if (ownsLoadingState) pushRoomEvent('Voice Profile engine could not load.', 'error');
    return false;
  } finally {
    if (ownsLoadingState) state.voice.speakerLoading = false;
    renderVoiceHud();
  }
}

async function ensureTranscriptionEngine() {
  if (state.voice.transcriptReady) return true;

  const ownsLoadingState = !state.voice.transcriptLoading;
  if (ownsLoadingState) {
    state.voice.transcriptLoading = true;
    renderVoiceHud();
  }

  try {
    await state.voice.transcriber.init();
    state.voice.transcriptReady = true;
    if (ownsLoadingState) pushRoomEvent('Local transcription engine online.', 'system');
    return true;
  } catch (error) {
    console.error(error);
    if (ownsLoadingState) pushRoomEvent('Local transcription model could not load.', 'error');
    return false;
  } finally {
    if (ownsLoadingState) state.voice.transcriptLoading = false;
    renderVoiceHud();
  }
}

function onRoomAudioLevel(level) {
  state.voice.micDb = level.db;
  state.voice.noiseFloorDb = level.noiseFloorDb;
  state.voice.vad = level.speaking;
  state.voice.captureMode = level.captureMode || state.voice.captureMode;
  renderVoiceHud();
}

function voiceSegmentIsCurrent(segment) {
  return Boolean(
    state.voice.active &&
    segment?.generation === state.voice.generation
  );
}

async function processRoomSegment(segment) {
  if (!voiceSegmentIsCurrent(segment)) return;
  state.voice.processing = true;
  renderVoiceHud();

  try {
    const speakerReady = await ensureSpeakerEngine();
    if (!speakerReady || !voiceSegmentIsCurrent(segment)) return;

    const embedding = await state.voice.engine.embedding(segment.samples);
    if (!voiceSegmentIsCurrent(segment)) return;

    const voiceMatch = bestVoiceMatch(embedding, state.identity.participants);
    const participant = voiceMatch.matched ? voiceMatch.participant : null;
    const roomTracks = segment.roomTracks || [];
    const roomGroups = buildConversationGroups(roomTracks);
    const track = participant
      ? roomTracks.find((candidate) => candidate.participantId === participant.id)
      : null;

    const bodyConfirmed = Boolean(track);
    const effectiveVoiceConfidence = voiceMatch.matched ? voiceMatch.similarity : 0;
    const gate = transcriptSignalGate({
      levelDb: segment.avgDb,
      noiseFloorDb: segment.noiseFloorDb,
      voiceConfidence: effectiveVoiceConfidence,
      bodyConfirmed,
      vadConfirmed: true
    });

    let group = null;
    let nearbyNames = [];
    let nearbyIds = [];

    if (track) {
      group = conversationGroupForTrack(roomGroups, track.id);
      nearbyNames = (group?.tracks || [])
        .filter((candidate) => candidate.id !== track.id)
        .map((candidate) => candidate.participantName || candidate.id)
        .filter(Boolean);
      nearbyIds = (group?.tracks || [])
        .filter((candidate) => candidate.id !== track.id)
        .map((candidate) => candidate.participantId)
        .filter(Boolean);

      const liveTrack = state.identity.tracks.find(
        (candidate) =>
          candidate.id === track.id &&
          candidate.participantId === participant?.id
      );
      if (liveTrack) {
        liveTrack.voiceMatchConfidence = voiceMatch.similarity;
        liveTrack.lastVoiceAt = performance.now();
        liveTrack.voiceLevelDb = segment.avgDb;
      }
    }

    state.voice.currentSpeakerId = participant?.id || null;
    state.voice.currentSpeakerName = participant?.name
      || (voiceMatch.ambiguous ? 'Ambiguous voice' : (voiceMatch.similarity ? 'Unknown voice' : null));
    state.voice.currentVoiceConfidence = voiceMatch.similarity || 0;
    state.voice.currentBodyLock = bodyConfirmed;
    state.voice.currentGroupId = group
      ? (group.tracks.length > 1 ? group.id : 'SOLO')
      : null;

    if (!gate.accept) {
      state.voice.rejectedSegments += 1;
      state.voice.lastDecision = voiceMatch.ambiguous ? 'ambiguous-speaker' : 'noise-rejected';
      renderParticipantCards();
      renderVoiceHud();
      return;
    }

    let transcript = '';
    if (ui.liveTranscription.checked) {
      const transcriptReady = await ensureTranscriptionEngine();
      if (transcriptReady && voiceSegmentIsCurrent(segment)) {
        transcript = await state.voice.transcriber.transcribe(segment.samples);
        if (!voiceSegmentIsCurrent(segment)) return;
      }
    }

    const turn = createSpeakerTurn({
      participantId: participant?.id || null,
      participantName: participant?.name || null,
      trackId: track?.id || null,
      groupId: group ? (group.tracks.length > 1 ? group.id : 'SOLO') : null,
      confidence: gate.confidence,
      voiceConfidence: voiceMatch.similarity,
      signalConfidence: gate.confidence,
      startedAt: segment.startedAt,
      endedAt: segment.endedAt,
      peakDb: segment.peakDb,
      avgDb: segment.avgDb,
      noiseFloorDb: segment.noiseFloorDb,
      nearbyParticipantIds: nearbyIds,
      nearbyParticipantNames: nearbyNames,
      transcript,
      attribution: participant ? (bodyConfirmed ? 'voice+body' : 'voice-only') : 'unknown'
    });

    state.voice.turns.push(turn);
    if (state.voice.turns.length > 50) state.voice.turns.splice(0, state.voice.turns.length - 50);
    state.voice.lastDecision = 'accepted';

    if (!voiceSegmentIsCurrent(segment)) return;

    try {
      const savedTurn = await saveDialogueTurn({
        ...turn,
        sessionId: state.voice.sessionId,
        createdAt: new Date().toISOString()
      });

      if (!voiceSegmentIsCurrent(segment)) {
        await deleteDialogueTurn(savedTurn.id).catch(() => {});
        return;
      }
    } catch (error) {
      console.error('Could not persist dialogue turn', error);
    }

    renderParticipantCards();
    renderDialogueTurns();
    renderVoiceHud();
  } catch (error) {
    console.error(error);
    pushRoomEvent('Speech turn could not be analyzed.', 'error');
  } finally {
    state.voice.processing = false;
    renderVoiceHud();
  }
}

async function drainRoomAudioQueue() {
  if (state.voice.processing) return;
  const next = state.voice.queue.shift();
  if (!next) return;
  await processRoomSegment(next);
  if (state.voice.queue.length) void drainRoomAudioQueue();
}

function roomTrackSnapshot() {
  return state.identity.tracks.map((track) => ({
    id: track.id,
    participantId: track.participantId || null,
    participantName: track.participantName || null,
    cx: track.cx,
    cy: track.cy,
    status: track.status,
    box: track.box ? { ...track.box } : null
  }));
}

function onRoomAudioSegment(segment) {
  state.voice.queue.push({
    ...segment,
    generation: state.voice.generation,
    roomTracks: roomTrackSnapshot()
  });
  if (state.voice.queue.length > 6) state.voice.queue.splice(0, state.voice.queue.length - 6);
  void drainRoomAudioQueue();
}

async function loadSavedDialogue() {
  try {
    const rows = await listDialogueTurns();
    state.voice.turns = rows.slice(-50);
  } catch (error) {
    console.error('Could not load saved dialogue', error);
  }
  renderDialogueTurns();
}

async function clearSavedDialogue() {
  if (!window.confirm('Clear all locally saved dialogue and transcript turns on this device?')) return;

  try {
    state.voice.generation += 1;
    state.voice.queue = [];
    await clearDialogueTurns();
    state.voice.turns = [];
    renderDialogueTurns();
    pushRoomEvent('Saved dialogue history cleared from this device.', 'system');
  } catch (error) {
    console.error(error);
    pushRoomEvent('Saved dialogue history could not be cleared.', 'error');
  }
}

async function startRoomAudio() {
  if (state.voice.active) return;

  state.voice.generation += 1;
  try {
    await reloadIdentityParticipants();
    state.voice.audio = new RoomAudioCapture({
      minSegmentSeconds: 1.05,
      hangoverMs: 650,
      onLevel: onRoomAudioLevel,
      onSegment: async (segment) => onRoomAudioSegment(segment)
    });

    await state.voice.audio.start();
    state.voice.captureMode = state.voice.audio.captureMode;
    if (state.voice.ttsPending > 0) state.voice.audio.setSuppressed(true);
    state.voice.active = true;
    state.voice.lastDecision = 'listening';
    ui.startRoomAudio.disabled = true;
    ui.stopRoomAudio.disabled = false;
    pushRoomEvent('Room audio online · adaptive noise gate active.', 'system');
    renderDialogueTurns();
    renderVoiceHud();
    void ensureSpeakerEngine();
  } catch (error) {
    console.error(error);
    state.voice.active = false;
    pushRoomEvent(
      window.isSecureContext
        ? 'Microphone could not be started.'
        : 'Microphone requires localhost or HTTPS.',
      'error'
    );
    renderVoiceHud();
  }
}

function stopRoomAudio() {
  state.voice.generation += 1;
  void state.voice.audio?.stop();
  state.voice.audio = null;
  state.voice.active = false;
  state.voice.vad = false;
  state.voice.micDb = -100;
  state.voice.currentSpeakerId = null;
  state.voice.currentSpeakerName = null;
  state.voice.currentVoiceConfidence = 0;
  state.voice.currentBodyLock = false;
  state.voice.currentGroupId = null;
  state.voice.captureMode = 'offline';
  state.voice.queue = [];
  ui.startRoomAudio.disabled = false;
  ui.stopRoomAudio.disabled = true;
  renderDialogueTurns();
  renderVoiceHud();
}

async function useTrackPhotoAsPrimary(track) {
  if (!track.participantId || !track.latestPhoto) return;
  try {
    await patchParticipant(track.participantId, {
      primaryPhoto: track.latestPhoto,
      latestPhoto: track.latestPhoto,
      lastSeenAt: new Date().toISOString()
    });
    await reloadIdentityParticipants();
    renderParticipantCards();
  } catch (error) {
    console.error(error);
  }
}

function rejectTrackMatch(track) {
  const live = state.identity.tracks.find((candidate) => candidate.id === track.id);
  if (!live) return;

  live.blockedParticipantIds = Array.from(new Set([
    ...(live.blockedParticipantIds || []),
    live.participantId
  ].filter(Boolean)));
  live.participantId = null;
  live.participantName = null;
  live.similarity = 0;
  live.status = 'new';
  renderParticipantCards();
}

async function createParticipantFromTrack(track) {
  try {
    const pending = await savePendingCapture({
      photo: track.latestPhoto,
      embedding: track.embedding,
      trackId: track.id
    });
    location.href = './participants.html?pending=' + encodeURIComponent(pending.id);
  } catch (error) {
    console.error(error);
  }
}

async function resolveTrackIdentity(track, excludedParticipantIds = new Set()) {
  if (!track.embedding || track.status === 'matched') return track;

  const blocked = new Set([
    ...(track.blockedParticipantIds || []),
    ...excludedParticipantIds
  ]);
  const candidates = state.identity.participants.filter((participant) => !blocked.has(participant.id));
  const match = bestParticipantMatch(track.embedding, candidates);

  if (!match.matched) {
    return {
      ...track,
      status: 'new',
      participantId: null,
      participantName: null,
      similarity: match.similarity
    };
  }

  const currentPhoto = track.latestPhoto || (track.face?.box ? cropFacePhoto(ui.video, track.face.box, {
    mirror: ui.mirror.checked,
    size: 300,
    quality: 0.88
  }) : null);

  const matched = {
    ...track,
    status: 'matched',
    scanProgress: 100,
    participantId: match.participant.id,
    participantName: match.participant.name,
    similarity: match.similarity,
    latestPhoto: currentPhoto
  };

  try {
    await patchParticipant(match.participant.id, {
      latestPhoto: currentPhoto || match.participant.latestPhoto || match.participant.primaryPhoto,
      lastSeenAt: new Date().toISOString()
    });
    await reloadIdentityParticipants();
  } catch (error) {
    console.error(error);
  }

  return matched;
}

async function scanRoom(now) {
  if (!state.running || !state.identity.ready || state.identity.busy || ui.video.readyState < 2) return;
  state.identity.busy = true;
  state.identity.lastScanAt = now;

  try {
    const room = await state.identity.engine.detectRoom(ui.video);
    const faces = room.faces || [];
    const bodies = augmentBodiesWithFaceFallbacks(faces, room.bodies || []);
    const previous = state.identity.tracks;

    let liveTracks = assignBodyTracks(previous, bodies, now, {
      nextId: nextTrackId
    });

    const assignments = associateFacesToBodies(faces, bodies);
    liveTracks = attachFacesToTracks(liveTracks, faces, bodies, assignments, now);

    liveTracks = liveTracks.map((track) => {
      const presence = roomPresenceState(track, now);

      if (!track.face) {
        return {
          ...track,
          status: track.participantId ? presence : 'body-detected',
          scanProgress: track.participantId ? 100 : track.scanProgress
        };
      }

      if (track.participantId) {
        const shouldRefreshPhoto = (
          track.quality >= 0.52 &&
          (
            !track.latestPhoto ||
            now - Number(track.lastPhotoCaptureAt || 0) >= PHOTO_REFRESH_INTERVAL_MS
          )
        );
        const photo = shouldRefreshPhoto
          ? cropFacePhoto(ui.video, track.face.box, {
              mirror: ui.mirror.checked,
              size: 260,
              quality: 0.82
            })
          : null;

        return {
          ...track,
          status: 'matched',
          scanProgress: 100,
          latestPhoto: photo || track.latestPhoto,
          lastPhotoCaptureAt: photo ? now : track.lastPhotoCaptureAt
        };
      }

      const advanced = advanceScan(track, { minQuality: 0.48, increment: 24, decay: 7 });
      if (track.status === 'new' && advanced.scanProgress >= 100) advanced.status = 'new';

      if (
        advanced.quality >= 0.52 &&
        advanced.face?.box &&
        (
          !advanced.latestPhoto ||
          now - Number(advanced.lastPhotoCaptureAt || 0) >= PHOTO_REFRESH_INTERVAL_MS
        )
      ) {
        const photo = cropFacePhoto(ui.video, advanced.face.box, {
          mirror: ui.mirror.checked,
          size: 260,
          quality: 0.82
        });
        if (photo) {
          advanced.latestPhoto = photo;
          advanced.lastPhotoCaptureAt = now;
        }
      }

      return advanced;
    });

    const carried = carryOccludedTracks(previous, liveTracks, now, TRACK_GRACE_MS);

    const resolved = [];
    const claimedParticipantIds = new Set(
      liveTracks
        .filter((track) => track.participantId)
        .map((track) => track.participantId)
    );

    for (const track of liveTracks) {
      if (
        track.scanProgress >= 100 &&
        track.embedding &&
        !track.participantId &&
        track.status !== 'new'
      ) {
        const matchedTrack = await resolveTrackIdentity(track, claimedParticipantIds);
        if (matchedTrack.participantId) claimedParticipantIds.add(matchedTrack.participantId);
        resolved.push(matchedTrack);
      } else {
        resolved.push(track);
      }
    }

    const liveParticipantIds = new Set(
      resolved
        .filter((track) => track.participantId)
        .map((track) => track.participantId)
    );
    const nonConflictingCarried = carried.filter(
      (track) => !track.participantId || !liveParticipantIds.has(track.participantId)
    );

    state.identity.tracks = dedupeParticipantAssignments([
      ...resolved,
      ...nonConflictingCarried
    ]);
    updateConversationGroups();
    acknowledgeRoomTracks(now);

    const identified = state.identity.tracks.filter((track) => track.participantId).length;
    const bodyLocked = state.identity.tracks.filter((track) => track.status === 'body-lock').length;
    ui.identityStatus.textContent = bodies.length
      ? bodies.length + ' person' + (bodies.length === 1 ? '' : 's') +
        ' · ' + identified + ' identified' +
        (bodyLocked ? ' · ' + bodyLocked + ' body lock' : '')
      : faces.length
        ? faces.length + ' face' + (faces.length === 1 ? '' : 's') + ' · acquiring body'
        : state.identity.tracks.some((track) => track.status === 'occluded')
          ? 'Occlusion recovery active'
          : 'Scanning room';

    renderParticipantCards();
  } catch (error) {
    console.error(error);
    ui.identityStatus.textContent = 'Room tracking error';
  } finally {
    state.identity.busy = false;
  }
}

function maybeScanRoom(now) {
  if (!state.identity.ready || state.identity.busy) return;
  if (now - state.identity.lastScanAt < IDENTITY_SCAN_INTERVAL) return;
  void scanRoom(now);
}

function stopCamera() {
  state.latestMarkerDetections = { green: null, blue: null };
  state.gameplay.signalLost();
  state.markerTracker.reset();
  if (state.multiplayer.snapshot().active) {
    maybeRecordMatch(false);
    state.multiplayer.stop();
  }
  if (patternActive()) state.pattern.stop(performance.now());
  if (state.mode === 'multiplayer') {
    setBoardCursor(null);
    renderMultiplayer();
  } else if (state.mode === 'pattern') {
    setBoardCursor(null);
    renderPattern();
  }
  if (state.voice.active) stopRoomAudio();
  state.running = false;
  cancelAnimationFrame(state.raf);
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  ui.video.srcObject = null;
  ui.start.disabled = false;
  ui.stop.disabled = true;
  ui.select.disabled = true;
  ui.cameraStatus.textContent = 'Camera stopped';
  ui.trackingStatus.textContent = 'No signal';
  ui.identityStatus.textContent = state.identity.ready ? 'Identity standby' : 'Identity offline';
  state.identity.tracks = [];
  renderParticipantCards();
  setCursor(0.5, 0.5, false);
}

async function startCamera(deviceId = '') {
  stopCamera();

  if (!navigator.mediaDevices?.getUserMedia) {
    ui.cameraStatus.textContent = 'Camera API unavailable';
    return false;
  }

  try {
    ui.cameraStatus.textContent = 'Requesting camera…';
    const video = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 60, max: 60 }
    };
    if (deviceId) video.deviceId = { exact: deviceId };
    else video.facingMode = { ideal: 'user' };

    state.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    ui.video.srcObject = state.stream;
    await ui.video.play();
    await enumerateCameras();

    state.running = true;
    ui.start.disabled = true;
    ui.stop.disabled = false;
    ui.cameraStatus.textContent = 'Camera live';
    ui.trackingStatus.textContent = 'Searching for green…';
    state.identity.lastScanAt = 0;
    void initRoomIdentity();
    state.raf = requestAnimationFrame(loop);
    return true;
  } catch (error) {
    console.error(error);
    ui.cameraStatus.textContent = window.isSecureContext ? 'Could not start camera' : 'Use localhost or HTTPS';
    return false;
  }
}

function resetSession() {
  if (state.mode === 'pattern') {
    state.multiMotion = { green: createMotionStats(4), blue: createMotionStats(4) };
    renderPattern();
  }
  if (state.mode === 'multiplayer') {
    state.multiMotion = { green: createMotionStats(4), blue: createMotionStats(4) };
    renderMultiplayer();
  }
  state.stats = createMotionStats();
  state.trace = [];
  state.rawY = null;
  state.lastUiUpdate = 0;
  renderStats(performance.now());
  drawTrace();
}

async function beginGameplay() {
  const goal = pointGoalValue();

  if (!state.running) {
    const started = await startCamera(ui.select.value);
    if (!started) return;
  }

  resetSession();
  if(state.mode==='pattern'){
    try {
      const players=resolvePatternPlayers(state.identity.participants,{
        count:Number(ui.playerCount.value),
        greenId:ui.greenPlayer.value,
        blueId:ui.bluePlayer.value
      });
      state.pattern=platform.createSession('random-follow-pattern',{
        players,intervalSeconds:Number(ui.interval.value),
        rounds:Number(ui.rounds.value)
      });
      const result=state.pattern.start(performance.now());
      if(result.type!=='game-start')throw new Error('Could not start timed game.');
      state.markerTracker.reset();
      ui.multiplayerSetupStatus.textContent='Timed pattern live: complete as many random targets as possible each interval.';
      renderPattern();
    }catch(error){
      ui.multiplayerSetupStatus.textContent=error.message;
      renderPattern();
    }
    return;
  }
  if (state.mode === 'multiplayer') {
    try {
      state.multiplayer.configure([
        { color: 'green', participantId: ui.greenPlayer.value },
        { color: 'blue', participantId: ui.bluePlayer.value }
      ], state.identity.participants);
      const result = state.multiplayer.begin(goal);
      if (result.type !== 'match-start') throw new Error('Could not start the match.');
      state.matchStartedMs = Date.now();
      state.matchResultId = window.crypto?.randomUUID?.() || 'match-' + state.matchStartedMs + '-' + Math.random().toString(36).slice(2);
      state.matchSaved = false;
      state.multiMotion = { green: createMotionStats(4), blue: createMotionStats(4) };
      state.markerTracker.reset();
      ui.multiplayerSetupStatus.textContent = 'One shared board: completing a round passes the turn to the next player.';
    } catch (error) {
      ui.multiplayerSetupStatus.textContent = error.message;
      renderMultiplayer();
      return;
    }
    renderMultiplayer();
    return;
  }
  state.gameplay.begin(goal);
  renderGame();
}

function endGameplay() {
  if (state.mode === 'pattern') {
    if (patternActive()) state.pattern.stop(performance.now());
    setBoardCursor(null);
    renderPattern();
    return;
  }
  if (state.mode === 'multiplayer') {
    if (state.multiplayer.snapshot().active) maybeRecordMatch(false);
    state.multiplayer.stop();
    renderMultiplayer();
    return;
  }
  state.gameplay.stop();
  renderGame();
}

function pushTrace(delta, micro) {
  state.trace.push({ delta, micro });
  if (state.trace.length > MAX_TRACE_SAMPLES) {
    state.trace.splice(0, state.trace.length - MAX_TRACE_SAMPLES);
  }
}

function drawTrace() {
  const rect = ui.trace.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (ui.trace.width !== width || ui.trace.height !== height) {
    ui.trace.width = width;
    ui.trace.height = height;
  }

  traceCtx.clearRect(0, 0, width, height);
  traceCtx.strokeStyle = 'rgba(78,232,255,.14)';
  traceCtx.lineWidth = 1 * dpr;
  traceCtx.beginPath();
  traceCtx.moveTo(0, height / 2);
  traceCtx.lineTo(width, height / 2);
  traceCtx.stroke();

  if (state.trace.length < 2) return;

  let max = 0.002;
  for (const point of state.trace) max = Math.max(max, Math.abs(point.delta));
  max = Math.min(max, 0.05);

  traceCtx.strokeStyle = '#5cff9d';
  traceCtx.lineWidth = 1.5 * dpr;
  traceCtx.beginPath();

  state.trace.forEach((point, index) => {
    const x = (index / Math.max(1, MAX_TRACE_SAMPLES - 1)) * width;
    const normalized = Math.max(-1, Math.min(1, point.delta / max));
    const y = height / 2 + normalized * (height * 0.42);
    if (index === 0) traceCtx.moveTo(x, y);
    else traceCtx.lineTo(x, y);
  });
  traceCtx.stroke();
}

function renderZoneStats(summary) {
  summary.zones.forEach((zone) => {
    const root = document.querySelector('[data-zone="' + zone.index + '"]');
    if (!root) return;
    root.querySelector('[data-k="travel"]').textContent = inches(zone.totalTravel);
    root.querySelector('[data-k="micro"]').textContent = inches(zone.microTravel);
    root.querySelector('[data-k="up"]').textContent = inches(zone.upTravel);
    root.querySelector('[data-k="down"]').textContent = inches(zone.downTravel);
    root.querySelector('[data-k="reversals"]').textContent = zone.reversals.toLocaleString();
    root.querySelector('[data-k="microEvents"]').textContent = zone.microEvents.toLocaleString();
    root.querySelector('[data-k="microReversals"]').textContent = zone.microReversals.toLocaleString();
    root.querySelector('[data-k="dwell"]').textContent = seconds(zone.dwellMs);
  });
}

function renderStats(now) {
  const summary = summarizeMotion(state.stats, now);
  ui.statSamples.textContent = summary.samples.toLocaleString();
  ui.statRate.textContent = summary.sampleRate.toFixed(1) + ' Hz';
  ui.statTravel.textContent = inches(summary.totalTravel);
  ui.statRange.textContent = inches(summary.range);
  ui.statUp.textContent = inches(summary.upTravel);
  ui.statDown.textContent = inches(summary.downTravel);
  ui.statMicro.textContent = inches(summary.microTravel);
  ui.statMicroEvents.textContent = summary.microEvents.toLocaleString();
  ui.statReversals.textContent = summary.reversals.toLocaleString();
  ui.statMicroReversals.textContent = summary.microReversals.toLocaleString();
  ui.statOscillation.textContent = summary.oscillationsPerMinute.toFixed(1) + '/min';
  ui.statTime.textContent = seconds(summary.elapsedMs);
  ui.liveHz.textContent = summary.sampleRate.toFixed(1);
  renderZoneStats(summary);
}

function loop(now) {
  if (!state.running) return;
  if (state.mode === 'pattern' && patternActive()) {
    const advance=state.pattern.tick(now);
    if (advance.advanced || advance.type === 'game-complete') {
      state.markerTracker.reset();
      setBoardCursor(null);
      renderPattern(now);
    }
  }
  if (ui.video.readyState < 2) {
    state.raf = requestAnimationFrame(loop);
    return;
  }

  const videoWidth = ui.video.videoWidth || 1280;
  const videoHeight = ui.video.videoHeight || 720;
  const aspect = videoWidth / videoHeight;
  const trackingWidth = 320;
  const trackingHeight = Math.max(180, Math.round(trackingWidth / aspect));
  if (ui.trackingCanvas.width !== trackingWidth) ui.trackingCanvas.width = trackingWidth;
  if (ui.trackingCanvas.height !== trackingHeight) ui.trackingCanvas.height = trackingHeight;

  ctx.drawImage(ui.video, 0, 0, ui.trackingCanvas.width, ui.trackingCanvas.height);
  const image = ctx.getImageData(0, 0, ui.trackingCanvas.width, ui.trackingCanvas.height);
  if (state.mode === 'pattern') {
    loopPattern(image, now);
    maybeScanRoom(now);
    state.raf = requestAnimationFrame(loop);
    return;
  }
  if (state.mode === 'multiplayer') {
    loopMultiplayer(image, now);
    maybeScanRoom(now);
    state.raf = requestAnimationFrame(loop);
    return;
  }
  const detection = detectColorBlob(image, detectOptions());
  const input = toColorControllerInput(detection, ui.mirror.checked, now);

  if (!input) {
    const loss = state.gameplay.signalLost();
    if (loss.type === 'signal-lost') renderGame();
    ui.trackingStatus.textContent = 'Searching for green…';
    ui.liveY.textContent = '—';
    ui.liveDelta.textContent = '—';
    ui.liveZone.textContent = '—';
    setCursor(state.displayX, state.displayY, false);
  } else {
    const rawX = input.x;
    const rawY = input.y;
    state.displayX += (rawX - state.displayX) * 0.28;
    state.displayY += (rawY - state.displayY) * 0.28;
    setCursor(state.displayX, state.displayY, true);
    ui.trackingStatus.textContent = 'Object tracked';

    let motionEvent = { delta: 0, zone: zoneForY(rawY), micro: false };
    if (!state.paused) {
      motionEvent = recordMotion(state.stats, rawY, now, {
        noiseFloor: Number(ui.sensitivity.value),
        microThreshold: MICRO_THRESHOLD
      });
      pushTrace(motionEvent.delta, motionEvent.micro);
    }

    if (state.gameplay.game.active) {
      const gameEvent = state.gameplay.sample(input);
      if (gameEvent.type === 'rep' || gameEvent.type === 'point' || gameEvent.type === 'game-over' || gameEvent.type === 'outside-zone') {
        renderGame();
      }
    }

    state.rawY = rawY;
    ui.liveY.textContent = rawY.toFixed(4);
    ui.liveDelta.textContent = signed(motionEvent.delta);
    ui.liveZone.textContent = String(zoneForY(rawY) + 1);
  }

  maybeScanRoom(now);

  if (now - state.lastUiUpdate >= 100) {
    renderStats(now);
    if (state.gameplay.game.active) renderGame();
    drawTrace();
    state.lastUiUpdate = now;
  }

  state.raf = requestAnimationFrame(loop);
}

ui.gameMode.addEventListener('change', () => {
  if (state.gameplay.game.active || state.multiplayer.snapshot().active || patternActive()) return;
  state.mode = ['solo','multiplayer','pattern'].includes(ui.gameMode.value) ? ui.gameMode.value : 'pattern';
  state.latestMarkerDetections = { green: null, blue: null };
  state.markerTracker.reset();
  renderMode();
});
ui.calibrationPreset.addEventListener('change', () => {
  if (state.multiplayer.snapshot().active || patternActive()) return;
  state.calibration = createColorCalibration(ui.calibrationPreset.value);
  state.markerTracker.reset();
  populateCalibration(state.calibration);
  ui.calibrationStatus.textContent = 'Preset active. Verify live detection and save if satisfied.';
});
ui.saveCalibration.addEventListener('click', () => {
  if (state.multiplayer.snapshot().active || patternActive()) return;
  try {
    const candidate = calibrationFromControls();
    state.calibration = candidate;
    state.markerTracker.reset();
    try {
      window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(candidate));
      ui.calibrationStatus.textContent = 'Color calibration saved on this device.';
    } catch {
      ui.calibrationStatus.textContent = 'Calibration applied; browser storage unavailable.';
    }
  } catch (error) {
    ui.calibrationStatus.textContent = error.message;
  }
});
ui.resetCalibration.addEventListener('click', () => {
  if (state.multiplayer.snapshot().active || patternActive()) return;
  state.calibration = createColorCalibration();
  state.markerTracker.reset();
  ui.calibrationPreset.value = 'normal';
  populateCalibration(state.calibration);
  try { window.localStorage.removeItem(CALIBRATION_STORAGE_KEY); } catch {}
  ui.calibrationStatus.textContent = 'Default calibration restored.';
});
ui.greenPlayer.addEventListener('change', () => {
  if (state.mode === 'multiplayer') { renderMultiplayer(); renderMatchHistory(); }
  else if (state.mode === 'pattern') renderPattern();
});
ui.bluePlayer.addEventListener('change', () => {
  if (state.mode === 'multiplayer') { renderMultiplayer(); renderMatchHistory(); }
  else if (state.mode === 'pattern') renderPattern();
});
ui.playerCount.addEventListener('change', () => {updatePatternSetup();renderPattern();});
ui.interval.addEventListener('change', () => renderPattern());
ui.rounds.addEventListener('change', () => renderPattern());
ui.clearMatchHistory.addEventListener('click', () => {
  const cleared = clearMatchHistory(browserMatchStorage());
  ui.matchHistoryStatus.textContent = cleared ? 'Local match history cleared.' :
    'Browser storage unavailable; could not clear local history.';
  renderMatchHistory();
});
ui.start.addEventListener('click', () => startCamera(ui.select.value));
ui.startRoomAudio.addEventListener('click', startRoomAudio);
ui.stopRoomAudio.addEventListener('click', stopRoomAudio);
ui.clearDialogue.addEventListener('click', clearSavedDialogue);
ui.stop.addEventListener('click', () => {
  if (state.gameplay.game.active) endGameplay();
  stopCamera();
});
ui.reset.addEventListener('click', resetSession);
ui.startGame.addEventListener('click', beginGameplay);
ui.endGame.addEventListener('click', endGameplay);
ui.pointGoal.addEventListener('change', () => {
  if (!state.gameplay.game.active) {
    state.gameplay.game.pointGoal = pointGoalValue();
    if (state.mode === 'multiplayer') renderMultiplayer();
    else if (state.mode === 'pattern') renderPattern();
    else renderGame();
  }
});
ui.select.addEventListener('change', () => state.running && startCamera(ui.select.value));
ui.pause.addEventListener('click', () => {
  state.paused = !state.paused;
  ui.pause.textContent = state.paused ? 'Resume stats' : 'Pause stats';
});
ui.liveTranscription.addEventListener('change', renderVoiceHud);
ui.voiceAcknowledgements.addEventListener('change', () => {
  pushRoomEvent(
    ui.voiceAcknowledgements.checked ? 'Spoken room acknowledgements enabled.' : 'Spoken room acknowledgements disabled.',
    'system'
  );
});
window.addEventListener('resize', drawTrace);
window.addEventListener('beforeunload', () => {
  stopRoomAudio();
  stopCamera();
});

restoreCalibration();
await reloadIdentityParticipants();
await loadSavedDialogue();
updateConversationGroups();
renderParticipantCards();
renderRoomEvents();
renderDialogueTurns();
renderVoiceHud();
renderStats(performance.now());
renderMode();
drawTrace();

import { clamp01, detectColorBlob } from './src/tracker-core.js';
import { createMotionStats, recordMotion, summarizeMotion, zoneForY } from './src/movement-core.js';
import { createGameSession } from './src/game-session.js';
import { createMultiplayerMatch } from './src/multiplayer-match.js';
import { createGamePlatform } from './src/game-platform.js';
import { randomFollowPatternGame } from './src/games/random-follow-pattern.js';
import { reactionChallengeGame } from './src/games/reaction-challenge.js';
import { resolvePatternPlayers } from './src/games/pattern-setup.js';
import { consumeLobbyTicket } from './src/game-lobby.js';
import {sceneStep,sceneAcquisition,cameraFacingPoint,stablePublicTracks} from './src/scene-analysis.js';
import {createAgentRoom} from './agent-mode.js';
import {roomMeterState} from './src/participant-audio-meter.js';
import {RoomAmbientAudit,roomAudioAuditMessage} from './src/room-audio-audit.js';
import {describeAcousticPattern} from './src/room-acoustic-patterns.js';
import {createVisitorSession,reconcileVisitors,visibleVisitors,visitorForTrack,visitorDisplayName,associateVisitorTurn,promoteVisitorTurn,upgradeVisitorTimeline} from './src/visitor-session.js';
import {activityEvent,addActivity} from './src/player-activity.js';
import {selectGamePlayer,cameraAutostartEligible,cameraPermissionState,loadCameraPreference,saveCameraPreference,LAST_PARTICIPANT_KEY} from './src/camera-preference.js';
import { detectColorControllers, createColorCalibration, validateColorCalibration } from './src/color-controllers.js';
import { createControllerStability } from './src/controller-stability.js';
import { playerPresenceEvidence } from './src/player-presence.js';
import { browserMatchStorage, readMatchHistory, saveMatchHistory, clearMatchHistory, playerProgress } from './src/match-history.js';
import { toColorControllerInput } from './src/game-input.js';
import { gamePresentation } from './src/game-presenter.js';
import { sharedBoardView, paintSharedBoard } from './src/shared-board.js';
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
import {RoomPresenceLedger,RoomEventLedger,roomObservation} from './src/room-event-core.js';
import {createRoomSceneUi} from './src/room-scene-ui.js';
import {emptyRoomScene} from './src/room-scene-graph.js';
import {RoomTemporalLedger} from './src/room-temporal-core.js';
import {AgentCognitiveLoop,DEFAULT_COGNITIVE_POLICY} from './src/agent-cognitive-core.js';
import {roomEventMatchesFilter,roomUiOverview,normalizeRoomTimelineFilter} from './src/room-ui-core.js';
import {
 RecoveryBudget,RuntimeBudget,storagePressure,queryMediaPermission,permissionState
} from './src/runtime-resilience-core.js';
import {createAgentTaskUi} from './src/agent-task-ui.js';
import {createAgentMemoryUi} from './src/agent-memory-ui.js';
import {ConversationListeningController} from './src/conversation-listening-core.js';
import {
 SpeakerAssociationTracker,resolveSpeakerAssociation,speakerAssociationLabel,
 speakerAssociationTurnFields
} from './src/speaker-participant-core.js';
import {
  clearDialogueTurns,
  deleteDialogueTurn,
  listDialogueTurns,
  listParticipants,
  patchParticipant,
  saveDialogueTurn,
  reviseDialogueTurn,
  savePendingCapture,
  listRoomObservations,saveRoomObservation,clearRoomObservations
} from './src/participant-store.js';

const $ = (s) => document.querySelector(s);

const ui = {
  gameMode: $('#gameMode'),
  cameraAutostart: $('#cameraAutostart'),
  cameraPreferenceStatus: $('#cameraPreferenceStatus'),
  playerHud: $('#gamePlayerHud'),
  multiplayerSettings: $('#multiplayerSettings'),
  patternSetup: $('#patternSetup'),
  playerCount: $('#patternPlayerCount'),
  interval: $('#patternInterval'),
  rounds: $('#patternRounds'),
  bluePlayerWrap: $('#bluePlayerWrap'),
  patternExtraPlayers: $('#patternExtraPlayers'),
  patternRosterScoreboard: $('#patternRosterScoreboard'),
  classicPatternScorecards: $('#classicPatternScorecards'),
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
  roomDialogueTab: $('#roomDialogueTab'),
  playerActivityTab: $('#playerActivityTab'),
  roomDialoguePanel: $('#roomDialoguePanel'),
  playerActivityPanel: $('#playerActivityPanel'),
  activityTimeline: $('#playerActivityTimeline'),
  roomRadarTracks: $('#roomRadarTracks'),
  sceneOverlay: $('#gameSceneOverlay'),
  sceneStatus: $('#gameSceneStatus'),
  sceneBar: $('#gameSceneBar'),
  sceneFill: $('#gameSceneFill'),
  roomMicDb: $('#roomMicDb'),
  roomNoiseDb: $('#roomNoiseDb'),
  roomVadState: $('#roomVadState'),
  roomVoiceModel: $('#roomVoiceModel'),
  roomAudioPath: $('#roomAudioPath'),
  roomSpeaker: $('#roomSpeaker'),
  roomVoiceConfidence: $('#roomVoiceConfidence'),
  roomBodyLock: $('#roomBodyLock'),
  roomDialogueGroup: $('#roomDialogueGroup'),
  roomSpeakerAssociation: $('#roomSpeakerAssociation'),
  roomSpeakerProvenance: $('#roomSpeakerProvenance'),
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

let extraPlayerIds=[];
let cameraStoppedThisPage=false;
let retainedPlayerId='';
try{retainedPlayerId=window.localStorage.getItem(LAST_PARTICIPANT_KEY)||'';}catch{}
let extraFieldsSignature='';
const platform = createGamePlatform();
platform.register(randomFollowPatternGame);
platform.register(reactionChallengeGame);

const ctx = ui.trackingCanvas.getContext('2d', { willReadFrequently: true });
const traceCtx = ui.trace.getContext('2d');

let agentRuntime=null,sceneUI=null,taskUI=null,memoryUI=null;
const roomPresence=new RoomPresenceLedger();
const roomTemporal=new RoomTemporalLedger();
const roomLedger=new RoomEventLedger();
const cognitiveLoop=new AgentCognitiveLoop();
const listeningController=new ConversationListeningController();
const speakerAssociationTracker=new SpeakerAssociationTracker();
const roomSessionId='room-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
let roomHistory=[],saveRoomHistory=false,roomPrivacyEpoch=0,roomWrites=Promise.resolve();
let roomTimelineFilter='all';
const runtimeBudget=new RuntimeBudget();
const cameraRecovery=new RecoveryBudget();
const microphoneRecovery=new RecoveryBudget();
let cameraRecoveryTimer=0,microphoneRecoveryTimer=0;
let cameraRecoveryPending=false,microphoneRecoveryPending=false;
let roomAudioManuallyStopped=false;
let storageHealth=storagePressure();
let storageHealthTimer=0;
let runtimeHealthLastPaint=0;
const mediaPermissions={camera:'unsupported',microphone:'unsupported'};
const permissionWatchers=[];
function renderCognitiveStatus(){
 const label=document.getElementById('agentCognitiveStatus');
 if(!label||state.mode!=='agent')return;
 const snapshot=cognitiveLoop.snapshot();
 label.textContent=snapshot.lastDecision?
  snapshot.lastDecision.reason+' · '+snapshot.greetedThisHour+' greetings this hour':
  'Waiting for stable room evidence · no engagement decisions yet';
}
function considerCognitiveObservation(event){
 if(state.mode!=='agent'||event.semantic!=='participant-observed')return;
 const person=event.participantId?participantById(event.participantId):null;
 const track=event.participantId?publicRoomTracks().find(x=>
   x.participantId===event.participantId&&['matched','body-lock'].includes(x.status)):null;
 const decision=cognitiveLoop.evaluate(event,{
  participant:person,track,now:Date.now(),
  busy:Boolean(state.voice.vad||state.voice.processing||agentSpeechActive||
    state.voice.ttsPending>0)
 });
 if(!decision)return;
 const decisionEvent=logRoomMessage('decision',decision.reason,'agent-cognitive-loop',{
  kind:'decision',semantic:'agent-engagement-decision',
  participantId:decision.participantId,relatedEventId:event.id
 });
 if(decision.action==='greet'){
  const executed=agentRuntime?.greet(track,person)===true;
  const result=cognitiveLoop.recordOutcome(decision,{executed,at:Date.now()});
  if(result)logRoomMessage('decision',result.reason,'agent-cognitive-loop',{
   kind:'outcome',semantic:'agent-greeting-outcome',
   participantId:result.participantId,relatedEventId:decisionEvent?.id||event.id
  });
 }
 renderCognitiveStatus();
}

function roomSensorState(sensor,status,message){
 if(state.mode!=='agent')return;
 logRoomMessage('system',message,'sensor-lifecycle',
  {kind:'observation',semantic:'sensor-state',sensor,status});
}
const roomAmbientAudit=new RoomAmbientAudit();
let analyzeAmbientPatterns=false;
let lastRoomAudioPaint=-Infinity,lastRejectedRoomSegmentAt=-Infinity;
function renderAmbientAudioMeter(force=false){
 const bar=document.getElementById('roomAmbientAudioMeter');
 const fill=document.getElementById('roomAmbientAudioFill');
 const status=document.getElementById('roomAmbientAudioStatus');
 if(!bar||!fill||!status)return;
 const now=performance.now();
 if(!force&&now-lastRoomAudioPaint<120)return;
 lastRoomAudioPaint=now;
 const active=Boolean(state.voice.active);
 const suppressed=Boolean(state.voice.audio?.suppressed||agentSpeechActive||state.voice.ttsPending>0);
 const db=active&&!suppressed?state.voice.micDb:-100;
 const level=Math.max(0,Math.min(100,Math.round((db+70)*100/62)));
 fill.style.width=level+'%';
 bar.setAttribute('aria-valuenow',String(level));
 bar.dataset.mode=!active?'off':suppressed?'suppressed':state.voice.vad?'activity':'ambient';
 status.textContent=!active?'Room mic offline · no ambient audio captured':
  suppressed?'Room mic paused · agent speaking / enrollment':
  (state.voice.vad?'Room acoustic activity (speaker not yet attributed)':'Ambient room level')+
  ' · '+(Number.isFinite(db)?db.toFixed(1):'—')+' dB · floor '+
  (Number.isFinite(state.voice.noiseFloorDb)?state.voice.noiseFloorDb.toFixed(1):'—')+' dB';
}
let lastListeningDropEventAt=-Infinity;
function listeningLabel(value){
 return String(value||'standby').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());
}
function renderListeningHealth(force=false){
 if(state.mode!=='agent')return;
 const snapshot=listeningController.snapshot();
 const stateEl=document.getElementById('roomListeningState');
 const queueEl=document.getElementById('roomListeningQueue');
 const dropsEl=document.getElementById('roomListeningDrops');
 const reasonEl=document.getElementById('roomListeningReason');
 if(stateEl)stateEl.textContent=listeningLabel(snapshot.state);
 if(queueEl)queueEl.textContent=snapshot.queueDepth+' pending'+
  (snapshot.processingSegmentId?' · 1 processing':'');
 if(dropsEl)dropsEl.textContent=String(snapshot.droppedTotal);
 if(reasonEl)reasonEl.textContent=listeningLabel(snapshot.lastReason);
 if(force)renderRuntimeHealth(true);
}
function reportListeningDrops(dropped=[]){
 if(!dropped.length)return;
 renderListeningHealth();
 const now=Date.now();
 if(state.mode!=='agent'||now-lastListeningDropEventAt<2500)return;
 lastListeningDropEventAt=now;
 const reasons=[...new Set(dropped.map(item=>item.reason))].join(', ');
 logRoomMessage('audio','Listening backlog discarded '+dropped.length+
  ' segment'+(dropped.length===1?'':'s')+' · '+reasons,
  'conversation-listening',{semantic:'listening-backpressure'});
}
function saveRoomAudioSummary(summary){
 if(!summary||state.mode!=='agent')return;
 logRoomMessage('audio',roomAudioAuditMessage(summary),'shared-room-mic',
  {at:summary.at,evidence:{durationMs:summary.durationMs}});
 if(analyzeAmbientPatterns){
  const pattern=describeAcousticPattern(summary);
  if(pattern)logRoomMessage('audio',pattern.description,pattern.source,{
   at:pattern.at,semantic:'acoustic-pattern',confidence:pattern.confidence,
   evidence:{durationMs:pattern.durationMs}
  });
 }
}

function renderRoomTemporalSummary(){
 const mount=document.getElementById('roomTemporalSummary');
 if(state.mode!=='agent'||!mount)return;
 mount.replaceChildren();
 if(!state.running){
  mount.textContent='Camera offline · movement and dwell estimates paused';
  return;
 }
 const scene=sceneUI?.getScene()||emptyRoomScene();
 const records=roomTemporal.summary(scene,Date.now());
 if(!records.length){mount.textContent='Waiting for stable camera measurements';return;}
 for(const record of records){
  const item=document.createElement('article');item.className='room-temporal-entry';
  const name=document.createElement('strong');
  name.textContent=record.name+(record.participantId?' · enrolled':' · unverified');
  const detail=document.createElement('span');
  const parts=[record.visibility==='observed'?'Visible in camera view':'Position uncertain'];
  if(record.visibility==='observed'&&record.areaName)parts.push(
   'Camera area: '+record.areaName);
  if(record.visibility==='observed'&&Number.isFinite(record.areaDwellMs)&&record.areaName)
   parts.push('Uninterrupted area observation: '+Math.floor(record.areaDwellMs/1000)+'s');
  if(record.visibility==='observed'&&Number.isFinite(record.stationaryMs))
   parts.push('Relative stillness: '+Math.floor(record.stationaryMs/1000)+'s');
  parts.push(record.lastActivity);
  detail.textContent=parts.join(' · ');
  item.append(name,detail);mount.append(item);
 }
}
function renderRoomObservations(){
 const timeline=document.getElementById('roomObservationsTimeline');
 const status=document.getElementById('roomCurrentState');
 if(!timeline||!status)return;
 timeline.replaceChildren();
 const visible=state.running?publicRoomTracks():[];
 const projection=roomLedger.project();
 const states=document.getElementById('roomSensorStates');
 if(states)states.textContent='Sensor history: camera '+projection.sensors.camera+
  ' · microphone '+projection.sensors.microphone+
  ' · '+projection.events.length+' effective events';
 status.textContent=!state.running?'Camera unavailable · observations paused':
  visible.length?visible.length+' stable participant'+(visible.length===1?'':'s')+' visible · '+(state.voice.active?'audio on':'audio off'):
  'No stable participants visible · '+(state.voice.active?'audio on':'audio off');
 const overview=roomUiOverview({
  events:projection.events,stableParticipants:visible.length,
  camera:projection.sensors.camera,microphone:projection.sensors.microphone
 });
 const participantsCount=document.getElementById('roomOverviewParticipants');
 const sensorSummary=document.getElementById('roomOverviewSensors');
 const evidenceCount=document.getElementById('roomOverviewEvidence');
 const decisionCount=document.getElementById('roomOverviewDecisions');
 if(participantsCount)participantsCount.textContent=String(overview.participants);
 if(sensorSummary)sensorSummary.textContent=overview.camera+' / '+overview.microphone;
 if(evidenceCount)evidenceCount.textContent=String(overview.evidence);
 if(decisionCount)decisionCount.textContent=String(overview.decisions);
 const filtered=roomHistory.slice(-65).reverse().filter(e=>roomEventMatchesFilter(e,roomTimelineFilter));
 const count=document.getElementById('roomTimelineCount');
 if(count)count.textContent=filtered.length+' event'+(filtered.length===1?'':'s')+' shown';
 for(const e of filtered){
  const item=document.createElement('article');item.className='room-observation';
  item.dataset.category=String(e.category||'');
  item.dataset.kind=String(e.kind||'observation');
  const time=document.createElement('time');time.dateTime=new Date(e.at).toISOString();
  time.textContent=new Date(e.at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const heading=document.createElement('strong');heading.textContent=e.message;
  const meta=document.createElement('small');
  const duration=e.evidence?.durationMs;
  const corrected=projection.corrections[e.id];
  if(corrected?.correction.operation==='retract')item.classList.add('room-retracted');
  meta.textContent=(e.kind||'observation').toUpperCase()+' / '+e.category.toUpperCase()+
    ' · '+e.source+(Number.isFinite(e.confidence)?' · '+Math.round(e.confidence*100)+'% confidence':'')+
    (Number.isFinite(duration)?' · '+Math.round(duration/1000)+'s measured':'')+
    (corrected?' · CORRECTED':'');
  item.append(time,heading,meta);
  if(e.kind!=='correction'&&!corrected){
   const button=document.createElement('button');button.type='button';
   button.className='room-mark-incorrect';button.textContent='Mark incorrect';
   button.setAttribute('aria-label','Retract event: '+e.message);
   button.addEventListener('click',()=>{
    const reason=window.prompt('Correction reason (stored in your ROOM history):');
    if(!reason?.trim())return;
    logRoomMessage('system','Correction: '+reason.trim().slice(0,175),'owner-correction',{
     kind:'correction',participantId:e.participantId,
     correction:{targetId:e.id,operation:'retract'}
    });
   });
   item.append(button);
  }
  timeline.append(item);
 }
 if(!roomHistory.length){
  const empty=document.createElement('p');empty.className='dialogue-empty';
  empty.textContent='Room observations appear as participant and device events occur.';timeline.append(empty);
 }else if(!filtered.length){
  const empty=document.createElement('p');empty.className='dialogue-empty';
  empty.textContent='No ROOM events match this filter.';timeline.append(empty);
 }
}
function addRoomObservation(observation){
 if(state.mode!=='agent'||!observation?.message)return;
 const accepted=roomLedger.append(observation);
 if(!accepted.added)return;
 roomHistory=roomLedger.entries();renderRoomObservations();
 considerCognitiveObservation(accepted.event);
 if(saveRoomHistory&&storageHealth.optionalPersistence){
  const epoch=roomPrivacyEpoch,event=accepted.event;
  roomWrites=roomWrites.catch(()=>{}).then(()=>
   epoch===roomPrivacyEpoch&&storageHealth.optionalPersistence?saveRoomObservation(event):undefined
  ).catch(error=>console.warn('Room observation not saved:',error));
 }
 return accepted.event;
}
function logRoomMessage(category,message,source='runtime',options={}){
 return addRoomObservation(roomObservation({category,message,source,sessionId:roomSessionId,...options}));
}

let agentSpeechActive=false;
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
  activity:{events:[],lastZones:new Map(),seenParticipants:new Set()},
  visitors:createVisitorSession(),
  identity: {
    engine: new IdentityEngine(),
    ready: false,
    loading: false,
    busy: false,
    lastScanAt: 0,
    tracks: [],
    participants: [],
    counter: 0,
    sceneGeneration:0,
    completeScans:0,
    initStartedAt:0
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
    currentAssociationState: 'unknown-speaker',
    currentAssociationProvenance: [],
    currentAssociationTransition: null,
    sessionId: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'room-' + Date.now().toString(36),
    lastDecision: 'standby',
    rejectedSegments: 0,
    ttsPending: 0,
    captureMode: 'offline',
    generation: 0
  }
};

function formatStorageHealth(){
 if(storageHealth.status==='unknown')return 'Unknown · browser did not expose quota';
 const percent=Math.round((storageHealth.ratio||0)*100);
 return storageHealth.status.toUpperCase()+' · '+percent+'% used'+
  (storageHealth.optionalPersistence?'':' · optional ROOM saves paused');
}
function renderRuntimeHealth(force=false){
 if(state.mode!=='agent')return;
 const now=performance.now();
 if(!force&&now-runtimeHealthLastPaint<1000)return;
 runtimeHealthLastPaint=now;
 const runtime=runtimeBudget.snapshot();
 const camera=document.getElementById('roomCameraPermission');
 const microphone=document.getElementById('roomMicrophonePermission');
 const storage=document.getElementById('roomStorageHealth');
 const budget=document.getElementById('roomRuntimeBudget');
 const cameraRetry=document.getElementById('roomCameraRecovery');
 const microphoneRetry=document.getElementById('roomMicrophoneRecovery');
 if(camera)camera.textContent=mediaPermissions.camera;
 if(microphone)microphone.textContent=mediaPermissions.microphone;
 if(storage)storage.textContent=formatStorageHealth();
 if(budget)budget.textContent=runtime.status.toUpperCase()+
  ' · '+runtime.stalls+' stalls · '+runtime.meanScanMs+'ms scan avg · audio queue '+runtime.audioQueueMax;
 const cRetry=cameraRecovery.snapshot(),mRetry=microphoneRecovery.snapshot();
 if(cameraRetry)cameraRetry.textContent=(cameraRecoveryPending?'Pending · ':'Idle · ')+
  cRetry.attempts+'/'+cRetry.maxAttempts+' attempts in window';
 if(microphoneRetry)microphoneRetry.textContent=(microphoneRecoveryPending?'Pending · ':'Idle · ')+
  mRetry.attempts+'/'+mRetry.maxAttempts+' attempts in window';
}
async function refreshStorageHealth({announce=true}={}){
 const prior=storageHealth.status;
 try{
  const estimate=await navigator.storage?.estimate?.();
  storageHealth=storagePressure(estimate||{});
 }catch{storageHealth=storagePressure();}
 renderRuntimeHealth(true);
 if(announce&&state.mode==='agent'&&prior!==storageHealth.status){
  if(storageHealth.status==='critical')
   logRoomMessage('system','Browser storage pressure critical · optional ROOM history saves paused','storage-lifecycle');
  else if(prior==='critical'&&storageHealth.optionalPersistence){
   logRoomMessage('system','Browser storage pressure recovered · optional ROOM history saves may resume','storage-lifecycle');
   if(saveRoomHistory)persistCurrentRoomSnapshot();
  }
 }
 return storageHealth;
}
function persistCurrentRoomSnapshot(){
 if(!saveRoomHistory||!storageHealth.optionalPersistence)return false;
 const epoch=roomPrivacyEpoch,snapshot=roomLedger.entries();
 for(const event of snapshot){
  roomWrites=roomWrites.catch(()=>{}).then(()=>
   epoch===roomPrivacyEpoch&&storageHealth.optionalPersistence?saveRoomObservation(event):undefined
  ).catch(error=>console.warn('Room observation not saved:',error));
 }
 return true;
}
function cancelCameraRecovery(){
 if(cameraRecoveryTimer)clearTimeout(cameraRecoveryTimer);
 cameraRecoveryTimer=0;cameraRecoveryPending=false;renderRuntimeHealth(true);
}
function cancelMicrophoneRecovery(){
 if(microphoneRecoveryTimer)clearTimeout(microphoneRecoveryTimer);
 microphoneRecoveryTimer=0;microphoneRecoveryPending=false;
 listeningController.setRecovering(false,'microphone-recovery-cancelled');
 renderRuntimeHealth(true);renderListeningHealth();
}
async function scheduleCameraRecovery(reason='camera-interrupted'){
 cameraRecoveryPending=true;renderRuntimeHealth(true);
 if(cameraRecoveryTimer)return;
 mediaPermissions.camera=await queryMediaPermission(navigator.permissions,'camera');
 const plan=cameraRecovery.plan({
  permission:mediaPermissions.camera,visible:!document.hidden,
  manualStop:cameraStoppedThisPage
 });
 if(!plan.allowed){
  if(plan.reason==='retry-budget-exhausted')
   logRoomMessage('system','Camera automatic recovery budget exhausted · use Start camera to retry','sensor-recovery');
  renderRuntimeHealth(true);return;
 }
 cameraRecoveryTimer=setTimeout(async()=>{
  cameraRecoveryTimer=0;
  mediaPermissions.camera=await queryMediaPermission(navigator.permissions,'camera');
  if(document.hidden||cameraStoppedThisPage||mediaPermissions.camera!=='granted'){
   renderRuntimeHealth(true);return;
  }
  cameraRecovery.record();
  const ok=await startCamera(ui.select.value);
  if(ok){
   cameraRecoveryPending=false;renderRuntimeHealth(true);
   setTimeout(()=>{if(state.running)cameraRecovery.reset();renderRuntimeHealth(true);},30000);
  }else void scheduleCameraRecovery(reason);
 },plan.delayMs);
 logRoomMessage('system','Camera interrupted · bounded automatic recovery scheduled','sensor-recovery');
 renderRuntimeHealth(true);
}
async function scheduleMicrophoneRecovery(reason='microphone-interrupted'){
 microphoneRecoveryPending=true;
 listeningController.setRecovering(true,reason);
 renderRuntimeHealth(true);renderListeningHealth();
 if(microphoneRecoveryTimer)return;
 mediaPermissions.microphone=await queryMediaPermission(navigator.permissions,'microphone');
 const plan=microphoneRecovery.plan({
  permission:mediaPermissions.microphone,visible:!document.hidden,
  manualStop:roomAudioManuallyStopped||!state.running
 });
 if(!plan.allowed){
  listeningController.setRecovering(false,plan.reason);
  if(plan.reason==='retry-budget-exhausted')
   logRoomMessage('system','Microphone automatic recovery budget exhausted · use Enable room audio to retry','sensor-recovery');
  renderRuntimeHealth(true);renderListeningHealth();return;
 }
 microphoneRecoveryTimer=setTimeout(async()=>{
  microphoneRecoveryTimer=0;
  mediaPermissions.microphone=await queryMediaPermission(navigator.permissions,'microphone');
  if(document.hidden||roomAudioManuallyStopped||!state.running||mediaPermissions.microphone!=='granted'){
   listeningController.setRecovering(false,
    document.hidden?'page-hidden':roomAudioManuallyStopped?'manual-stop':
     !state.running?'camera-offline':'permission-'+mediaPermissions.microphone);
   renderRuntimeHealth(true);renderListeningHealth();return;
  }
  microphoneRecovery.record();
  const ok=await startRoomAudio();
  if(ok){
   microphoneRecoveryPending=false;renderRuntimeHealth(true);
   setTimeout(()=>{if(state.voice.active)microphoneRecovery.reset();renderRuntimeHealth(true);},30000);
  }else void scheduleMicrophoneRecovery(reason);
 },plan.delayMs);
 logRoomMessage('system','Microphone interrupted · bounded automatic recovery scheduled','sensor-recovery');
 renderRuntimeHealth(true);
}
async function watchMediaPermission(name){
 if(!navigator.permissions?.query)return;
 try{
  const status=await navigator.permissions.query({name});
  const update=()=>{
   const before=mediaPermissions[name];
   mediaPermissions[name]=permissionState(status.state);
   renderRuntimeHealth(true);
   if(before!==mediaPermissions[name]&&state.mode==='agent'){
    logRoomMessage('system',name+' permission changed to '+mediaPermissions[name],'permission-lifecycle');
    if(mediaPermissions[name]==='denied'){
     if(name==='camera'&&state.running){
      cameraRecoveryPending=true;stopCamera();
      roomSensorState('camera','degraded','Camera permission revoked · participant absence not inferred');
     }
     if(name==='microphone'&&state.voice.active){
      microphoneRecoveryPending=true;stopRoomAudio();
      roomSensorState('microphone','degraded','Microphone permission revoked · room silence not inferred');
     }
    }
    if(mediaPermissions[name]==='granted'){
     if(name==='camera'&&cameraRecoveryPending)void scheduleCameraRecovery('permission-restored');
     if(name==='microphone'&&microphoneRecoveryPending)void scheduleMicrophoneRecovery('permission-restored');
    }
   }
  };
  mediaPermissions[name]=permissionState(status.state);
  status.addEventListener?.('change',update);
  permissionWatchers.push(()=>status.removeEventListener?.('change',update));
 }catch{mediaPermissions[name]='unsupported';}
 renderRuntimeHealth(true);
}

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
    const wanted=color==='green' ? selectGamePlayer(state.identity.participants,chosen,retainedPlayerId) :
      state.identity.participants.some(p=>p.id===chosen) ? chosen : '';
    select.value=wanted;
  }
  renderExtraPlayerFields();
}
function makeParticipantSelect(position, selectedId) {
  const label=document.createElement('label');
  label.textContent='Player '+position+' · shared green marker';
  const select=document.createElement('select');
  select.dataset.extraPosition=String(position);
  select.setAttribute('aria-label','Enrolled participant for player '+position);
  const placeholder=document.createElement('option');
  placeholder.value='';placeholder.textContent='Select enrolled player…';
  select.append(placeholder);
  for(const person of state.identity.participants){
    const option=document.createElement('option');
    option.value=person.id;
    option.textContent=person.name || person.nickname || 'Participant';
    select.append(option);
  }
  if(state.identity.participants.some(p=>p.id===selectedId))select.value=selectedId;
  label.append(select);
  return label;
}

function renderExtraPlayerFields() {
  const count=Number(ui.playerCount.value);
  const visible=timedMode() && count>2;
  ui.patternExtraPlayers.hidden=!visible;
  if(!visible){extraFieldsSignature='';ui.patternExtraPlayers.replaceChildren();return;}
  const signature=String(count)+'|'+state.identity.participants.map(p=>p.id).join('|');
  if(signature===extraFieldsSignature)return;
  extraFieldsSignature=signature;
  ui.patternExtraPlayers.replaceChildren();
  for(let index=3;index<=count;index++){
    ui.patternExtraPlayers.append(makeParticipantSelect(index,extraPlayerIds[index-3] || ''));
  }
}


function timedMode() { return state.mode === 'pattern' || state.mode === 'reaction'; }
function patternActive() {
  return state.pattern?.snapshot(performance.now()).active === true;
}

function updatePatternSetup() {
  const inPattern = timedMode();
  const count=Number(ui.playerCount.value);
  ui.patternSetup.hidden = !inPattern;
  ui.patternSetup.querySelector('legend').textContent=state.mode==='reaction'?
    'Reaction Challenge · timed settings':'Random Follow Pattern · timed settings';
  ui.bluePlayerWrap.hidden = inPattern && count===1;
  ui.bluePlayerWrap.firstChild.textContent = inPattern && count>2 ?
    'Player 2 · shared green marker' : 'Blue controller player';
  renderExtraPlayerFields();
  const locked = patternActive();
  for (const el of ui.patternSetup.querySelectorAll('select,input')) el.disabled = locked;
  ui.bluePlayer.disabled = locked || (inPattern && count===1);
  for(const select of ui.patternExtraPlayers.querySelectorAll('select'))select.disabled=locked;
}

function renderMode(){
  const agent=state.mode==='agent';
  document.body.classList.toggle('agent-mode',agent);
  if(agent){
    ui.video.hidden=false;
    ui.video.classList.toggle('agent-mirror',ui.mirror.checked);
    ui.playerHud.hidden=true;
    ui.multiplayerStage.hidden=true;
    ui.multiplayerSettings.hidden=true;
    ui.matchHistoryPanel.hidden=true;
    return;
  }
  ui.video.hidden=true;
  const multi = state.mode !== 'solo';
  ui.playerHud.hidden=!multi;
  document.body.classList.toggle('multiplayer-mode', multi);
  document.body.classList.toggle('pattern-mode', timedMode());
  document.body.classList.toggle('reaction-mode', state.mode === 'reaction');
  ui.multiplayerSettings.hidden = !multi;
  ui.multiplayerStage.hidden = !multi;
  ui.matchHistoryPanel.hidden = state.mode !== 'multiplayer';
  updatePatternSetup();
  if (timedMode()) renderPattern();
  else if (state.mode === 'multiplayer') {
    ui.board.dataset.playerSlot='-1';
    ui.board.dataset.controllerMode='individual';
    ui.classicPatternScorecards.hidden=false;
    ui.patternRosterScoreboard.hidden=true;
    renderMultiplayer();renderMatchHistory();
  }
  else renderGame();
}

function playerScoreCard(color) {
  return ui.playerHud.querySelector('[data-player-color="' + color + '"]');
}

function renderPattern(now = performance.now()) {
  if (!timedMode()) return;
  const match = state.pattern?.snapshot(now);
  const active = Boolean(match?.active);
  const chosenCount = Number(ui.playerCount.value);
  const activePlayer = match?.players[match.activePlayerIndex];
  ui.playerHud.hidden=false;
  ui.gameMode.disabled = active;
  ui.greenPlayer.disabled = active;
  ui.bluePlayer.disabled = active || chosenCount === 1;
  ui.startGame.disabled = active;
  ui.startGame.textContent = match?.status === 'completed' ? 'Play again' :
    state.mode==='reaction'?'Start reaction':'Start pattern';
  ui.endGame.disabled = !active;
  ui.pointGoal.disabled = active;
  ui.board.dataset.activeColor = active ? match.activeColor : 'idle';
  ui.board.dataset.playerSlot = active ? String(match.activePlayerIndex) : '-1';
  ui.board.dataset.controllerMode = chosenCount>2 ? 'shared-green' : 'individual';
  updatePatternSetup();
  const groupMode=chosenCount>2;
  ui.classicPatternScorecards.hidden=groupMode;
  ui.patternRosterScoreboard.hidden=!groupMode;
  if(groupMode){
    ui.patternRosterScoreboard.replaceChildren();
    const roster=match?.players || [];
    const ids=[ui.greenPlayer.value,ui.bluePlayer.value,...extraPlayerIds].slice(0,chosenCount);
    for(let i=0;i<chosenCount;i++){
      const p=roster[i];
      const profile=state.identity.participants.find(x=>x.id===ids[i]);
      const card=document.createElement('div');
      card.className='pattern-roster-card';
      if(active && match.activePlayerIndex===i)card.classList.add('active');
      const name=document.createElement('strong');
      name.textContent=p?.name || profile?.name || ('Player '+(i+1));
      const stats=document.createElement('span');
      stats.textContent=state.mode==='reaction'?
        (p?.score ?? 0)+' hits · '+(p?.bestReactionMs === null || p?.bestReactionMs===undefined ? 'No time':p.bestReactionMs+'ms best'):
        (p?.score ?? 0)+' targets · '+(p?.repsCompleted ?? 0)+' reps · '+(p?.roundsPlayed ?? 0)+' rounds';
      card.append(name,stats);
      ui.patternRosterScoreboard.append(card);
    }
  }
  for (const color of ['green','blue']) {
    const card = playerScoreCard(color);
    const p = match?.players[color==='green'?0:1];
    card.hidden = groupMode || (color === 'blue' && chosenCount === 1);
    card.classList.toggle('on-turn', Boolean(active && p && match.activePlayerIndex === (color==='green'?0:1)));
    const selectedId = color === 'green' ? ui.greenPlayer.value : ui.bluePlayer.value;
    const selected = state.identity.participants.find(person => person.id === selectedId);
    card.querySelector('.multi-name').textContent = p?.name || selected?.name || (color === 'green'?'Player 1':'Player 2');
    card.querySelector('.multi-score').textContent = (p?.score ?? 0) +
      (state.mode==='reaction'?' hits':' targets');
    card.querySelector('.multi-reps').textContent = p ?
      (state.mode==='reaction' ?
        (p.bestReactionMs===null?'No hits yet':p.bestReactionMs+'ms best · '+p.averageReactionMs+'ms avg'):
        p.repsCompleted+' reps')+' · '+p.roundsPlayed+' rounds' : 'Choose a player';
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
  paintSharedBoard(ui.board,sharedBoardView({active,activeColor:match?.activeColor,
    activeZone:match?.activeZone,repsRemaining:match?.repsRemaining}));
  ui.roundTimer.textContent = active ?
    'Round ' + match.round + '/' + match.totalRounds + ' · ' +
    Math.ceil(match.remainingMs/1000) + ' seconds remaining' :
    match?.status==='completed' ? match.totalRounds + ' rounds complete' :
    match?.status==='stopped' ? 'Game ended early' : 'Select players, interval and rounds';
  ui.turnLabel.textContent = activePlayer ?
    activePlayer.name + "'s turn · " + (chosenCount>2?'SHARED GREEN':match.activeColor.toUpperCase()) :
    match?.status==='completed' ? 'Game complete' :
    state.mode==='reaction'?'Reaction Challenge':'Random Follow Pattern';
  ui.boardInstruction.textContent = active ?
    state.mode==='reaction' ? 'ZONE '+(match.activeZone+1)+' · '+
      (match.armed?'ENTER THE TARGET NOW':'MOVE OUT OF TARGET, THEN ENTER'):
      'ZONE '+(match.activeZone+1)+' · '+match.repsRemaining+' up/down reps':
    match?.status==='completed' ? 'All timed rounds are complete.' :
    state.mode==='reaction'?'Leave and enter each highlighted zone to score.':
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
      const scheduled=before.players?.[before.activePlayerIndex];
      if(scheduled){
        const zone=zoneForY(input.y,4)+1;
        if(state.activity.lastZones.get(scheduled.participantId)!==zone){
          state.activity.lastZones.set(scheduled.participantId,zone);
          logPlayerActivity(scheduled.participantId,'zone','Zone '+zone);
        }
        if(result.type==='target-complete')logPlayerActivity(scheduled.participantId,'target','Target completed');
        if(result.type==='hit')logPlayerActivity(scheduled.participantId,'hit',result.reactionMs+' ms');
      }
      if(result.type==='target-complete'||result.type==='hit')renderPattern(now);
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
  ui.playerHud.hidden=false;
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
  paintSharedBoard(ui.board,sharedBoardView({active:match.active,activeColor:match.activeColor,
    activeZone:active?.activeZone,repsRemaining:active?.repsRemaining}));
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
      const scheduled=before.players.find(p=>p.color===color);
      if(scheduled){
        const zone=zoneForY(input.y,4)+1;
        if(state.activity.lastZones.get(scheduled.participantId)!==zone){
          state.activity.lastZones.set(scheduled.participantId,zone);
          logPlayerActivity(scheduled.participantId,'zone','Zone '+zone);
        }
        if(result.type==='point'||result.type==='game-over')
          logPlayerActivity(scheduled.participantId,'point','Completed a zone target');
      }
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
    const participantIds=state.identity.participants.map(p=>p.id);
    cognitiveLoop.forgetRemovedParticipants(participantIds);
    memoryUI?.refreshParticipants();
    if(state.voice.currentSpeakerId&&!participantIds.includes(state.voice.currentSpeakerId)){
      state.voice.currentSpeakerId=null;
      state.voice.currentSpeakerName=null;
      state.voice.currentVoiceConfidence=0;
      state.voice.currentBodyLock=false;
      state.voice.currentGroupId=null;
      state.voice.currentAssociationState='unknown-speaker';
      state.voice.currentAssociationProvenance=['participant-record-unavailable'];
      state.voice.currentAssociationTransition=null;
      speakerAssociationTracker.reset();
      renderVoiceHud();
    }
    refreshPlayerChoices();
    if(!state.identity.participants.length){ui.multiplayerSetupStatus.textContent='No enrolled participants on this site in this browser. Open Participants, save a profile and return to Games.';}
  } catch (error) {
    console.error(error);
    state.identity.participants = [];
    state.voice.currentSpeakerId=null;
    state.voice.currentSpeakerName=null;
    state.voice.currentVoiceConfidence=0;
    state.voice.currentBodyLock=false;
    state.voice.currentGroupId=null;
    state.voice.currentAssociationState='unknown-speaker';
    state.voice.currentAssociationProvenance=['participant-store-unavailable'];
    state.voice.currentAssociationTransition=null;
    speakerAssociationTracker.reset();
    refreshPlayerChoices();
    ui.multiplayerSetupStatus.textContent='Could not read participant profiles from local browser storage: '+error.message;
  }
}

function logPlayerActivity(participantId,kind,detail='',source='assigned-player'){
 const person=state.identity.participants.find(x=>x.id===participantId);
 if(!person)return;
 const event=activityEvent({participantId,name:person.name,kind,detail,source,at:Date.now()});
 if(!event)return;
 const next=addActivity(state.activity.events,event);
 if(next.length===state.activity.events.length &&
    next[next.length-1]===state.activity.events[state.activity.events.length-1])return;
 state.activity.events=next;renderPlayerActivity();
}
const activitySymbols={arrived:'◉',departed:'◌',matched:'✓',present:'●',zone:'▣',rep:'↕',target:'◎',hit:'⚡',point:'★',round:'◷',complete:'✓'};
function renderPlayerActivity(){
 ui.activityTimeline.replaceChildren();
 if(!state.activity.events.length){
  const empty=document.createElement('p');empty.className='player-activity-empty';
  empty.textContent='Confirmed presence and assigned game actions appear here.';
  ui.activityTimeline.append(empty);return;
 }
 for(const event of state.activity.events.slice().reverse()){
  const item=document.createElement('article');item.className='player-activity-item activity-'+event.kind;
  const symbol=document.createElement('span');symbol.className='player-activity-glyph';
  symbol.textContent=activitySymbols[event.kind]||'●';symbol.setAttribute('aria-hidden','true');
  const copy=document.createElement('div');copy.className='player-activity-copy';
  const name=document.createElement('strong');name.textContent=event.name;
  const detail=document.createElement('p');
  const labels={arrived:'Stable visitor observed',departed:'Visitor left view',matched:'Matched enrolled participant',present:'Confirmed in view',zone:'Moved marker',rep:'Completed repetition',
   target:'Completed target',hit:'Reaction hit',point:'Point scored',round:'Round transition',complete:'Game complete'};
  detail.textContent=labels[event.kind]+(event.detail?' · '+event.detail:'');
  const qualifier=document.createElement('small');
  qualifier.textContent=event.source==='confirmed-tracking'?'Camera-confirmed enrolled participant':
    event.source==='visitor-observation'?'Temporary visitor observation · identity unverified':
    'Assigned player · marker holder unverified';
  copy.append(name,detail);
  if(event.kind==='zone'){
   const zone=Number(event.detail.match(/Zone ([1-4])/)?.[1]);
   if(zone){
    const path=document.createElement('div');path.className='player-zone-path';
    path.setAttribute('aria-label','Four-section board, marker in zone '+zone);
    for(let z=1;z<=4;z++){
      const section=document.createElement('span');
      if(z===zone)section.classList.add('active');
      section.setAttribute('aria-hidden','true');
      path.append(section);
    }
    copy.append(path);
   }
  }
  copy.append(qualifier);
  const time=document.createElement('time');time.dateTime=new Date(event.at).toISOString();
  time.textContent=new Date(event.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  item.append(symbol,copy,time);ui.activityTimeline.append(item);
 }
}
function recordObservedPresence(now){
 for(const track of visibleRoomParticipants(now)){
  if(state.activity.seenParticipants.has(track.participantId))continue;
  state.activity.seenParticipants.add(track.participantId);
  logPlayerActivity(track.participantId,'present','Identity match stabilized','confirmed-tracking');
 }
}
function updateGameScene(step){
 const progress=sceneStep(step);
 ui.sceneOverlay.hidden=step==='idle'||step==='ready';
 ui.sceneStatus.textContent=progress.label;
 ui.sceneBar.setAttribute('aria-valuenow',String(progress.progress??0));
 ui.sceneBar.setAttribute('aria-valuetext',progress.label);
 ui.sceneFill.style.width=(progress.progress??0)+'%';
 ui.sceneOverlay.dataset.stage=step;
}
function visibleRoomParticipants(now=performance.now()){
 return stablePublicTracks(state.identity.tracks,now,{graceMs:TRACK_GRACE_MS});
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
    if(state.running)updateGameScene('models');
  } catch (error) {
    console.error(error);
    ui.identityStatus.textContent = 'Identity unavailable';
    if(state.running)updateGameScene('error');
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
  trackLabel.textContent = track.visitorLabel || track.id;

  const stateLabel = document.createElement('b');
  stateLabel.textContent = track.visitorLabel?'VISITOR · IDENTITY PENDING':statusLabel(track);

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
  name.textContent = track.participantName || track.visitorLabel || 'Unknown participant';

  const detail = document.createElement('span');
  if (track.visitorLabel) {
    detail.textContent='Stable visitor · checking enrolled profiles';
  } else if (track.status === 'matched') {
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
  const fill = document.createElement('i');
  if (state.mode === 'agent') {
    // All cards show the shared room mic. Live VAD does not establish speaker identity.
    const audio = document.createElement('div');
    audio.className = 'participant-audio-block';
    const heading = document.createElement('span');
    heading.className = 'participant-audio-title';
    heading.textContent = 'VERIFIED VOICE PROFILE';
    meter.className = 'participant-audio-meter';
    meter.dataset.trackId = String(track.id);
    meter.setAttribute('role', 'meter');
    meter.setAttribute('aria-label', 'Recent post-verified speech segment for this participant only');
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', '100');
    meter.setAttribute('aria-valuenow', '0');
    fill.className = 'participant-audio-fill';
    meter.append(fill);
    const caption = document.createElement('span');
    caption.className = 'participant-audio-caption';
    caption.textContent = 'MIC OFF';
    audio.append(heading, meter, caption);
    identity.append(name, detail, audio);
  } else {
    meter.className = 'participant-scan-meter';
    fill.style.width = Math.round(track.scanProgress || 0) + '%';
    meter.append(fill);
    identity.append(name, detail, meter);
  }
  body.append(current, identity);

  const participant = track.participantId ? participantById(track.participantId) : null;
  const voiceReadiness = voiceProfileReadiness(participant || {});
  const recentlySpoke = Boolean(track.verifiedVoiceSegment===true && track.lastVoiceAt &&
    performance.now() - track.lastVoiceAt < 2600 && voiceReadiness.ready);
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
    ['AUDIO', state.mode === 'agent'
      ? (recentlySpoke ? 'VERIFIED SEGMENT' : !state.voice.active?'OFF':
        voiceReadiness.ready?'AWAIT VOICE MATCH':'PROFILE REQUIRED')
      : (recentlySpoke ? 'SPEAKER CONFIRMED' : 'QUIET')],
    ['SPEAKER LINK', recentlySpoke&&track.lastSpeakerAssociationState
      ? speakerAssociationLabel(track.lastSpeakerAssociationState) : '—'],
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

    if(state.mode==='agent'){
     const greetPref=document.createElement('button');greetPref.type='button';
     greetPref.textContent=participant?.agentGreetingEnabled===false?'Allow greetings':'Mute greetings';
     greetPref.setAttribute('aria-label',
      (participant?.agentGreetingEnabled===false?'Enable':'Disable')+
      ' automatic greetings for '+(participant?.name||'participant'));
     greetPref.addEventListener('click',async()=>{
      try{
       const enabled=participant.agentGreetingEnabled===false;
       await patchParticipant(participant.id,{agentGreetingEnabled:enabled});
       await reloadIdentityParticipants();renderParticipantCards();
       logRoomMessage('system','Owner '+(enabled?'enabled':'disabled')+
        ' automatic greeting for an enrolled participant','participant-policy',
        {participantId:participant.id});
      }catch(error){console.error('Could not update greeting preference',error);}
     });
     actions.append(greetPref);
    }
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

function noteVisitorEvent(visitor,kind,detail=''){
 const event=activityEvent({participantId:visitor.id,name:visitor.label,kind,detail,
  at:Date.now(),source:'visitor-observation'});
 if(event){state.activity.events=addActivity(state.activity.events,event);renderPlayerActivity();}
}
function reconcileRoomVisitors(now){
 const changes=reconcileVisitors(state.visitors,state.identity.tracks,now);
 for(const change of changes){
  if(change.type==='arrived'){
   noteVisitorEvent(change.visitor,'arrived','Stable unmatched face and body');
   pushRoomEvent(change.visitor.label+' observed · identity pending','new',false);
   continue;
  }
  const profile=participantById(change.visitor.participantId);
  if(!profile)continue;
  state.activity.events=upgradeVisitorTimeline(state.activity.events,change.visitor.id,profile,change.visitor.label);
  pushRoomEvent(change.visitor.label+' matched enrolled participant '+profile.name,'recognized',false);
  logPlayerActivity(profile.id,'matched',change.visitor.label+' matched by enrolled identity',
   'confirmed-tracking');
  const changed=[];
  state.voice.turns=state.voice.turns.map(turn=>{
   const upgraded=promoteVisitorTurn(turn,change.visitor,profile);
   if(upgraded!==turn)changed.push(upgraded);
   return upgraded;
  });
  // Previously captured transcript text is unchanged. Only the nearby-person
  // association upgrades; recorded speaker identity remains unverified.
  for(const turn of changed){
   void saveDialogueTurn(turn).catch(error=>console.warn('Visitor transcript promotion failed',error));
  }
  renderDialogueTurns();
 }
}
function publicRoomTracks(now=performance.now()){
 const known=visibleRoomParticipants(now);
 const visitor=visibleVisitors(state.visitors,state.identity.tracks,now)
  .map(({visitor,track})=>({...track,visitorLabel:visitor.label,visitorId:visitor.id}));
 return [...known,...visitor].slice(0,8);
}

function renderRoomRadar(visibleTracks) {
  ui.roomRadarTracks.replaceChildren();

  for (const track of visibleTracks) {
    const dot = document.createElement('div');
    dot.className = 'radar-track ' + (track.participantId ? 'identified' : 'unknown');
    if (track.status === 'occluded') dot.classList.add('occluded');
    if (track.lastVoiceAt && performance.now() - track.lastVoiceAt < 2600) dot.classList.add('speaking');

    // The radar is labeled CAMERA VIEW, not a room floor plan. Only its projection
    // is mirrored; body association and recognition stay in raw camera coordinates.
    const point=cameraFacingPoint({x:track.cx??0.5,y:track.cy??0.5},ui.mirror.checked);
    dot.style.left=(point.x*100)+'%';
    dot.style.top=(point.y*100)+'%';
    dot.title = (track.participantName || track.visitorLabel || 'Unknown') + ' · '+track.id;

    const label = document.createElement('span');
    label.textContent = (track.participantName || track.visitorLabel || track.id) + (track.conversationGroupId ? ' · ' + track.conversationGroupId : '');
    dot.append(label);
    ui.roomRadarTracks.append(dot);
  }
}

function renderParticipantCards() {
  ui.participantCards.replaceChildren();
  const visible=publicRoomTracks();
  if(state.mode==='agent'&&state.running){
   for(const event of roomPresence.update(visible,Date.now()))addRoomObservation(event);
   const scene=sceneUI?.getScene()||emptyRoomScene();
   for(const event of roomTemporal.update(visible,scene,Date.now()))addRoomObservation(event);
   renderRoomTemporalSummary();
   renderRoomObservations();
  }

  if(state.mode==='agent'&&!state.running)renderRoomTemporalSummary();
  ui.participantHudEmpty.hidden = visible.length > 0;
  renderRoomRadar(visible);

  for(const track of visible){
    const card=createParticipantCard(track);
    if(state.mode==='agent'&&track.participantId){
      const button=document.createElement('button');
      button.type='button';button.className='agent-participant-voice-button';
      button.textContent='◉ Voice';
      button.setAttribute('aria-label','Capture voice profile for '+(track.participantName||'participant'));
      button.addEventListener('click',()=>void agentRuntime?.openVoice(track.participantId));
      card.append(button);
    }
    ui.participantCards.append(card);
  }
  if(state.mode==='agent'){
    updateParticipantAudioMeters(true);
    agentRuntime?.renderBoxes(visible,ui.video,ui.mirror.checked);
    sceneUI?.renderTracks(visible);
  }
}

// Identity cards only show previously verified profile-matched speech segments.
// Raw room VAD/dB must NEVER animate or label any participant-specific input meter.
let lastAudioMeterPaint = -Infinity;
function updateParticipantAudioMeters(force = false) {
  if(state.mode !== 'agent')return;
  const now = performance.now();
  if(!force && now-lastAudioMeterPaint<70)return;
  lastAudioMeterPaint=now;
  const tracks=new Map(publicRoomTracks(now).map(t=>[String(t.id),t]));
  const shared={
    active:state.voice.active,
    suppressed:Boolean(state.voice.audio?.suppressed || agentSpeechActive || state.voice.ttsPending>0),
    now
  };
  for(const el of ui.participantCards.querySelectorAll('.participant-audio-meter')){
    const track=tracks.get(el.dataset.trackId);
    const enrolled=track?.participantId?voiceProfileReadiness(participantById(track.participantId)||{}).ready:false;
    const result=roomMeterState({...shared,track,voiceProfileReady:enrolled});
    const fill=el.querySelector('.participant-audio-fill');
    if(fill)fill.style.width=result.level+'%';
    el.dataset.mode=result.mode;
    el.setAttribute('aria-valuenow',String(result.level));
    const caption=el.parentElement?.querySelector('.participant-audio-caption');
    if(caption && caption.textContent!==result.text)caption.textContent=result.text;
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
  listeningController.setSuppressed(true,'acknowledgement-tts');
  renderListeningHealth();

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
        const suppressed=Boolean(agentSpeechActive);
        state.voice.audio?.setSuppressed(suppressed);
        listeningController.setSuppressed(suppressed,
          suppressed?'agent-tts':'acknowledgement-ended');
        renderListeningHealth();
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
  if(state.mode==='agent'&&type!=='recognized')logRoomMessage(type==='error'?'system':'audio',message,'room-runtime');
  if (speak) speakAcknowledgement(message);
}

function acknowledgeRoomTracks(now) {
  for (const track of visibleRoomParticipants(now)) {
    if (track.participantId && !state.voice.announcedParticipants.has(track.participantId)) {
      state.voice.announcedParticipants.add(track.participantId);
      state.voice.announcedTracks.add(track.id);
      const participant = participantById(track.participantId);
      const event = acknowledgeNewTrack(track, participant);
      pushRoomEvent(event.message,'recognized',state.mode!=='agent');
      // AGENT greetings are governed by canonical ROOM cognitive decisions,
      // not direct recognition callbacks; prevents bypassing owner quiet hours.
      continue;
    }

    // Provisional strangers and false-positive tests never produce public announcements.

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
    ? (state.voice.currentBodyLock ? 'CONFIRMED' : 'NOT CURRENT')
    : '—';
  if(ui.roomSpeakerAssociation)
    ui.roomSpeakerAssociation.textContent=speakerAssociationLabel(state.voice.currentAssociationState);
  if(ui.roomSpeakerProvenance)
    ui.roomSpeakerProvenance.textContent=state.voice.currentAssociationProvenance.length
      ? state.voice.currentAssociationProvenance.join(' · ') : 'speaker-unverified';
  ui.roomDialogueGroup.textContent = state.voice.currentGroupId || '—';

  const listening=listeningController.snapshot();
  ui.voiceStatus.textContent = ({
    offline:'Voice standby',
    recovering:'Recovering microphone…',
    'agent-speaking':'Agent speaking · room input suppressed',
    suppressed:'Room input suppressed',
    speech:'Speech detected',
    processing:'Analyzing speaker…',
    queued:'Speech queued',
    listening:'Room audio live'
  })[listening.state]||'Voice standby';
  renderListeningHealth();

  ui.transcriptModelState.textContent = !ui.liveTranscription.checked
    ? 'Transcription off'
    : state.voice.transcriptReady
      ? 'Local transcription online'
      : state.voice.transcriptLoading
        ? 'Loading transcription…'
        : 'Loads on first accepted turn';
}

function renderDialogueTurns() {
  if(state.mode==='agent'&&agentRuntime){agentRuntime.refreshConversation();return;}
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
    speaker.textContent=turn.participantName ||
      (turn.visitorMatchName?'Unknown speaker · near '+turn.visitorMatchName:
       turn.visitorLabel?'Unknown speaker · near '+turn.visitorLabel:'Unknown speaker');

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
    context.textContent=turn.speakerAssociation==='nearby-identified-person-unverified'?
      'Enrolled participant visible nearby · speaker identity not verified':
      turn.speakerAssociation==='nearby-visitor-unverified'?
      'Possible nearby '+turn.visitorLabel+' · speaker identity not verified':
      turn.participantId?'Speaker identity linked'+(turn.trackId?' · body track '+turn.trackId:' · body match pending'):
      turn.nearbyParticipantNames?.length?
        'Nearby: '+turn.nearbyParticipantNames.join(', ')+' · speaker not verified':
      'Speaker not matched · no reliable person association yet';

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
  listeningController.setVad(Boolean(level.speaking));
  const captureSuppressed=Boolean(level.suppressed||state.voice.audio?.suppressed||
   agentSpeechActive||state.voice.ttsPending>0);
  listeningController.setSuppressed(captureSuppressed,
   captureSuppressed?(agentSpeechActive?'agent-tts':'capture-suppressed'):'capture-active');
  renderVoiceHud();
  updateParticipantAudioMeters();
  if(state.mode==='agent'&&state.voice.active){
   renderAmbientAudioMeter();
   const suppressed=Boolean(level.suppressed||state.voice.audio?.suppressed||
    agentSpeechActive||state.voice.ttsPending>0);
   if(suppressed){
    // Close partial windows before TTS/permissions gaps; suppressed duration is unknown.
    saveRoomAudioSummary(roomAmbientAudit.flush(Date.now()));
    roomAmbientAudit.reset();
   }else{
    const summary=roomAmbientAudit.update(level,Date.now());
    if(summary)saveRoomAudioSummary(summary);
   }
  }
}

function voiceSegmentIsCurrent(segment) {
  return Boolean(state.voice.active&&
   listeningController.canContinue(segment,Date.now()).valid);
}

async function processRoomSegment(segment) {
  let outcome='completed';
  if (!voiceSegmentIsCurrent(segment)) {
    listeningController.complete(segment,'cancelled');
    renderListeningHealth();
    return;
  }
  state.voice.processing = true;
  renderVoiceHud();

  try {
    const speakerReady = await ensureSpeakerEngine();
    if (!speakerReady){outcome='failed';return;}
    if (!voiceSegmentIsCurrent(segment)){outcome='cancelled';return;}

    const embedding = await state.voice.engine.embedding(segment.samples);
    if (!voiceSegmentIsCurrent(segment)){outcome='cancelled';return;}

    const voiceMatch = bestVoiceMatch(embedding, state.identity.participants);
    const roomTracks = segment.roomTracks || [];
    const association=resolveSpeakerAssociation({voiceMatch,roomTracks});
    const participant=association.participantId
      ? (voiceMatch.participant?.id===association.participantId
        ? voiceMatch.participant : participantById(association.participantId))
      : null;
    const track=association.trackId
      ? roomTracks.find(candidate=>candidate.id===association.trackId)||null
      : null;
    const nearestVisitor=association.nearbyVisitorId
      ? state.visitors.records.get(association.nearbyVisitorId)||null
      : null;
    const nearestEnrolled=association.nearbyParticipantId
      ? participantById(association.nearbyParticipantId)
      : null;
    const roomGroups = buildConversationGroups(roomTracks);

    const gate = transcriptSignalGate({
      levelDb: segment.avgDb,
      noiseFloorDb: segment.noiseFloorDb,
      voiceConfidence: association.participantId?association.voiceConfidence:0,
      bodyConfirmed:association.bodyConfirmed,
      vadConfirmed: true
    });

    let group = null;
    let nearbyNames = [];
    let nearbyIds = [];

    if (track) {
      group = conversationGroupForTrack(roomGroups, track.id);
      nearbyNames = (group?.tracks || [])
        .filter(candidate => candidate.id !== track.id)
        .map(candidate => candidate.participantName || candidate.id)
        .filter(Boolean);
      nearbyIds = (group?.tracks || [])
        .filter(candidate => candidate.id !== track.id)
        .map(candidate => candidate.participantId)
        .filter(Boolean);
    }

    state.voice.currentSpeakerId = association.participantId;
    state.voice.currentSpeakerName = participant?.name
      || (association.state==='ambiguous-voice'?'Ambiguous voice':
        association.voiceConfidence?'Unknown voice':null);
    state.voice.currentVoiceConfidence = association.voiceConfidence;
    state.voice.currentBodyLock = association.bodyConfirmed;
    state.voice.currentAssociationState=association.state;
    state.voice.currentAssociationProvenance=Array.from(association.provenance);
    state.voice.currentGroupId = group
      ? (group.tracks.length > 1 ? group.id : 'SOLO')
      : null;

    if (!gate.accept) {
      // Rejected acoustic signals have no verified speaker identity.
      state.voice.currentSpeakerId=null;
      state.voice.currentSpeakerName='Unverified acoustic segment';
      state.voice.currentVoiceConfidence=0;
      state.voice.currentBodyLock=false;
      state.voice.currentGroupId=null;
      state.voice.currentAssociationState='unknown-speaker';
      state.voice.currentAssociationProvenance=['signal-rejected'];
      state.voice.currentAssociationTransition=null;
      state.voice.rejectedSegments += 1;
      state.voice.lastDecision = voiceMatch.ambiguous ? 'ambiguous-speaker' : 'noise-rejected';
      if(state.mode==='agent'&&Date.now()-lastRejectedRoomSegmentAt>8000){
        lastRejectedRoomSegmentAt=Date.now();
        logRoomMessage('audio',voiceMatch.ambiguous
          ?'Room segment: ambiguous voice profiles · not attributed'
          :'Room segment: rejected by speech/noise gate · not attributed','room-voice');
      }
      renderParticipantCards();
      renderVoiceHud();
      return;
    }

    let transcript = '';
    if (ui.liveTranscription.checked) {
      const transcriptReady = await ensureTranscriptionEngine();
      if (transcriptReady && voiceSegmentIsCurrent(segment)) {
        transcript = await state.voice.transcriber.transcribe(segment.samples);
        if (!voiceSegmentIsCurrent(segment)){outcome='cancelled';return;}
      }
    }

    const associationTransition=speakerAssociationTracker.preview(association,Date.now());
    state.voice.currentAssociationTransition=associationTransition?.type||null;

    // Gate and transcription have completed: only NOW may a verified voice match
    // with CURRENT visual evidence animate a participant-specific meter.
    if(participant&&track&&association.bodyConfirmed&&voiceSegmentIsCurrent(segment)){
      const liveTrack=state.identity.tracks.find(candidate=>
        candidate.id===track.id&&candidate.participantId===participant.id);
      if(liveTrack){
        liveTrack.voiceMatchConfidence=association.voiceConfidence;
        liveTrack.lastVoiceAt=performance.now();
        liveTrack.voiceLevelDb=segment.avgDb;
        liveTrack.verifiedVoiceSegment=true;
        liveTrack.lastSpeakerAssociationState=association.state;
        liveTrack.lastSpeakerAssociationAt=performance.now();
      }
    }
    const associationFields=speakerAssociationTurnFields(association);
    let turn = createSpeakerTurn({
      participantId: association.participantId,
      participantName: participant?.name || null,
      trackId: association.trackId,
      groupId: group ? (group.tracks.length > 1 ? group.id : 'SOLO') : null,
      confidence: gate.confidence,
      voiceConfidence: association.voiceConfidence,
      signalConfidence: gate.confidence,
      startedAt: segment.startedAt,
      endedAt: segment.endedAt,
      peakDb: segment.peakDb,
      avgDb: segment.avgDb,
      noiseFloorDb: segment.noiseFloorDb,
      nearbyParticipantIds:nearestEnrolled?[nearestEnrolled.id]:nearbyIds,
      nearbyParticipantNames:nearestEnrolled?[nearestEnrolled.name]:nearbyNames,
      transcript,
      attribution: association.attribution,
      ...associationFields,
      associationTransition:associationTransition?{
       type:associationTransition.type,fromState:associationTransition.fromState,
       toState:associationTransition.toState,at:associationTransition.at
      }:null
    });
    if(nearestVisitor)turn=associateVisitorTurn(turn,nearestVisitor);
    if(nearestEnrolled && !participant)
      turn={...turn,speakerAssociation:'nearby-identified-person-unverified'};
    turn.at=Date.now();
    if (!voiceSegmentIsCurrent(segment)){outcome='cancelled';return;}

    let savedTurn;
    try {
      savedTurn = await saveDialogueTurn({
        ...turn,
        sessionId: state.voice.sessionId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      outcome='failed';
      state.voice.lastDecision='dialogue-save-failed';
      console.error('Could not persist dialogue turn', error);
      pushRoomEvent('Speech turn was not saved; AGENT reply skipped.', 'error');
      return;
    }

    if (!voiceSegmentIsCurrent(segment)) {
      outcome='cancelled';
      await deleteDialogueTurn(savedTurn.id).catch(() => {});
      return;
    }

    speakerAssociationTracker.commit(association);
    if(state.mode==='agent'&&associationTransition){
      if(associationTransition.type==='speaker-handoff'&&savedTurn.participantId){
        logRoomMessage('audio','Verified speaker handoff · current voice profile: '+
          (savedTurn.participantName||'enrolled participant'),'speaker-association',
          {participantId:savedTurn.participantId,semantic:'speaker-handoff'});
      }else if(associationTransition.type==='speaker-became-unverified'){
        logRoomMessage('audio','Speaker association became unverified · prior identity not carried forward',
          'speaker-association',{semantic:'speaker-unverified'});
      }else if(associationTransition.type==='speaker-verified'&&savedTurn.participantId){
        logRoomMessage('audio','Speaker verified by voice profile','speaker-association',
          {participantId:savedTurn.participantId,semantic:'speaker-verified'});
      }
    }

    state.voice.turns.push(savedTurn);
    if (state.voice.turns.length > 50) state.voice.turns.splice(0, state.voice.turns.length - 50);
    state.voice.lastDecision = 'accepted';
    if(state.mode==='agent'){
      logRoomMessage('audio',savedTurn.participantId?'Voice-profile-matched speech segment':'Shared room speech segment · speaker unverified',
       'room-voice',savedTurn.participantId?{participantId:savedTurn.participantId}:{});
      agentRuntime?.onDialogue(savedTurn);
    }

    renderParticipantCards();
    renderDialogueTurns();
    renderVoiceHud();
  } catch (error) {
    outcome='failed';
    console.error(error);
    pushRoomEvent('Speech turn could not be analyzed.', 'error');
  } finally {
    state.voice.processing = false;
    listeningController.complete(segment,outcome,Date.now());
    renderVoiceHud();
    renderListeningHealth();
  }
}

async function drainRoomAudioQueue() {
  if (state.voice.processing||listeningController.snapshot().processingSegmentId) return;
  const nextResult=listeningController.beginNext(Date.now());
  reportListeningDrops(nextResult.dropped);
  const next=nextResult.segment;
  runtimeBudget.recordAudioQueue(listeningController.snapshot().queueDepth);
  if (!next){renderListeningHealth();return;}
  await processRoomSegment(next);
  if (listeningController.snapshot().queueDepth) void drainRoomAudioQueue();
}

function roomTrackSnapshot() {
  // Audio only sees mature room tracks; synthetic/provisional detections cannot
  // lend credibility to speaker/body association.
  return publicRoomTracks().map((track) => ({
    id: track.id,
    participantId: track.participantId || null,
    participantName: track.participantName || null,
    visitorId:track.visitorId||null,
    visitorLabel:track.visitorLabel||null,
    cx: track.cx,
    cy: track.cy,
    status: track.status,
    identitySource:track.identitySource||null,
    similarity:Number(track.similarity||0),
    lastBodySeenAt:Number(track.lastBodySeenAt||0),
    lastFaceSeenAt:Number(track.lastFaceSeenAt||0),
    box: track.box ? { ...track.box } : null
  }));
}

function onRoomAudioSegment(segment) {
  const queued=listeningController.enqueue(segment,{
    generation:state.voice.generation,
    roomTracks:roomTrackSnapshot(),
    now:Date.now()
  });
  reportListeningDrops(queued.dropped);
  runtimeBudget.recordAudioQueue(listeningController.snapshot().queueDepth);
  renderRuntimeHealth();renderListeningHealth();
  if(!queued.accepted)return;
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
    listeningController.invalidateGeneration(state.voice.generation,'dialogue-cleared');
    await clearDialogueTurns();
    state.voice.turns = [];
    renderDialogueTurns();
    agentRuntime?.refreshConversation();
    pushRoomEvent('Saved dialogue history cleared from this device.', 'system');
  } catch (error) {
    console.error(error);
    pushRoomEvent('Saved dialogue history could not be cleared.', 'error');
  }
}

async function startRoomAudio() {
  if (state.voice.active) return true;

  state.voice.generation += 1;
  try {
    await reloadIdentityParticipants();
    const capture=new RoomAudioCapture({
      minSegmentSeconds: 1.05,
      hangoverMs: 650,
      onLevel: onRoomAudioLevel,
      onSegment: async (segment) => onRoomAudioSegment(segment),
      onUnavailable:()=>{
        if(state.voice.audio!==capture||!state.voice.active)return;
        const recover=!roomAudioManuallyStopped&&state.running;
        stopRoomAudio();
        roomSensorState('microphone','degraded','Microphone interrupted · room silence not inferred');
        if(recover)void scheduleMicrophoneRecovery();
      }
    });
    state.voice.audio=capture;
    await capture.start();
    state.voice.captureMode = state.voice.audio.captureMode;
    if (state.voice.ttsPending > 0 || agentSpeechActive) state.voice.audio.setSuppressed(true);
    state.voice.active = true;
    speakerAssociationTracker.reset();
    state.voice.currentAssociationState='unknown-speaker';
    state.voice.currentAssociationProvenance=['speaker-unverified'];
    state.voice.currentAssociationTransition=null;
    listeningController.start(state.voice.generation,Date.now());
    const initiallySuppressed=Boolean(state.voice.ttsPending>0||agentSpeechActive);
    listeningController.setAgentSpeaking(Boolean(agentSpeechActive));
    listeningController.setSuppressed(initiallySuppressed,
      agentSpeechActive?'agent-tts':state.voice.ttsPending>0?'acknowledgement-tts':'capture-active');
    roomSensorState('microphone','online','Room microphone online');
    roomAmbientAudit.reset();
    updateParticipantAudioMeters(true);
    if(state.mode==='agent')renderAmbientAudioMeter(true);
    agentRuntime?.setAudioActive(true);
    state.voice.lastDecision = 'listening';
    ui.startRoomAudio.disabled = true;
    ui.stopRoomAudio.disabled = false;
    pushRoomEvent('Room audio online · adaptive noise gate active.', 'system');
    renderDialogueTurns();
    renderVoiceHud();
    void ensureSpeakerEngine();
    microphoneRecoveryPending=false;
    renderRuntimeHealth(true);
    return true;
  } catch (error) {
    console.error(error);
    state.voice.active = false;
    listeningController.stop(state.voice.generation,'audio-start-failed');
    roomSensorState('microphone','degraded','Room microphone start failed');
    pushRoomEvent(
      window.isSecureContext
        ? 'Microphone could not be started.'
        : 'Microphone requires localhost or HTTPS.',
      'error'
    );
    renderVoiceHud();
    return false;
  }
}

function stopRoomAudio() {
  if(state.mode==='agent'&&state.voice.active)
   roomSensorState('microphone','offline','Room microphone stopped · silence not inferred');
  if(state.mode==='agent')saveRoomAudioSummary(roomAmbientAudit.flush(Date.now()));
  roomAmbientAudit.reset();
  state.voice.generation += 1;
  listeningController.stop(state.voice.generation,'audio-stopped');
  void state.voice.audio?.stop();
  state.voice.audio = null;
  state.voice.active = false;
  updateParticipantAudioMeters(true);
  agentRuntime?.setAudioActive(false);
  state.voice.vad = false;
  state.voice.micDb = -100;
  state.voice.currentSpeakerId = null;
  state.voice.currentSpeakerName = null;
  state.voice.currentVoiceConfidence = 0;
  state.voice.currentBodyLock = false;
  state.voice.currentGroupId = null;
  state.voice.currentAssociationState='unknown-speaker';
  state.voice.currentAssociationProvenance=['speaker-unverified'];
  state.voice.currentAssociationTransition=null;
  speakerAssociationTracker.reset();
  state.voice.captureMode = 'offline';
  for(const track of state.identity.tracks){
   track.verifiedVoiceSegment=false;track.lastVoiceAt=0;track.voiceLevelDb=-100;
  }
  if(state.mode==='agent')renderAmbientAudioMeter(true);
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
  const scanStarted=performance.now();
  state.identity.busy = true;
  state.identity.lastScanAt = now;

  try {
    if(state.identity.completeScans===0)updateGameScene('detecting');
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
    reconcileRoomVisitors(now);
    updateConversationGroups();
    recordObservedPresence(now);
    acknowledgeRoomTracks(now);

    state.identity.completeScans+=1;
    if(state.running){
      const acquisition=sceneAcquisition({
        completeScans:state.identity.completeScans,
        elapsedMs:performance.now()-state.identity.initStartedAt,
        stable:publicRoomTracks(now).length>0,
        modelReady:state.identity.ready
      });
      updateGameScene(acquisition);
    }
    const identified=visibleRoomParticipants(now).length;
    const visitorCount=visibleVisitors(state.visitors,state.identity.tracks,now).length;
    const bodyLocked = state.identity.tracks.filter((track) => track.status === 'body-lock').length;
    // Raw detections remain internal until repeated observation and enrolled
    // identity have been established. Exclude single-frame ghosts from normal UI.
    ui.identityStatus.textContent=identified?
      identified+' enrolled participant'+(identified===1?'':'s')+' tracked'+
        (visitorCount?' · '+visitorCount+' visitor'+(visitorCount===1?'':'s'):''):
      visitorCount?visitorCount+' stable visitor'+(visitorCount===1?'':'s')+' · identity pending':
      'Analyzing scene · no stable person yet';
    renderParticipantCards();
  } catch (error) {
    console.error(error);
    ui.identityStatus.textContent = 'Room tracking error';
    if(state.identity.completeScans===0)updateGameScene('error');
  } finally {
    state.identity.busy = false;
    runtimeBudget.recordScan(performance.now()-scanStarted);
    renderRuntimeHealth();
  }
}

function maybeScanRoom(now) {
  if (!state.identity.ready || state.identity.busy) return;
  if (now - state.identity.lastScanAt < IDENTITY_SCAN_INTERVAL) return;
  void scanRoom(now);
}

function stopCamera() {
  if(state.mode==='agent'&&state.running){
   roomPresence.unavailable();
   roomTemporal.unavailable();
   roomSensorState('camera','offline','Camera stopped · participant absence not inferred');
  }
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
  } else if (timedMode()) {
    setBoardCursor(null);
    renderPattern();
  }
  if (state.voice.active) stopRoomAudio();
  state.running = false;
  agentRuntime?.setCameraActive(false);
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
  state.visitors=createVisitorSession();
  state.activity.seenParticipants.clear();
  state.identity.sceneGeneration+=1;
  state.identity.completeScans=0;
  updateGameScene('idle');
  renderParticipantCards();
  setCursor(0.5, 0.5, false);
}

async function startCamera(deviceId = '') {
  stopCamera();

  if (!navigator.mediaDevices?.getUserMedia) {
    roomSensorState('camera','degraded','Camera unavailable in this browser');
    ui.cameraStatus.textContent = 'Camera API unavailable';
    return false;
  }

  try {
    updateGameScene('camera');
    ui.cameraStatus.textContent = 'Requesting camera…';
    const video = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 60, max: 60 }
    };
    // Empty means the browser-selected default. Never treat the label "Default camera"
    // or an unrecognized saved value as a hardware deviceId.
    const available = [...ui.select.options].some(option=>option.value && option.value===deviceId);
    if(deviceId && available) video.deviceId={exact:deviceId};
    else video.facingMode={ideal:'user'};

    state.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    ui.video.srcObject = state.stream;
    await ui.video.play();
    await enumerateCameras();

    state.running = true;
    const capturedStream=state.stream;
    for(const track of capturedStream.getVideoTracks()){
      track.addEventListener('ended',()=>{
        if(state.stream!==capturedStream||!state.running)return;
        const recover=!cameraStoppedThisPage;
        stopCamera();
        roomSensorState('camera','degraded','Camera interrupted · participant absence not inferred');
        if(recover)void scheduleCameraRecovery();
      },{once:true});
    }
    if(state.mode==='agent'){
      roomSensorState('camera','online','Camera online · observations resumed');
      agentRuntime?.setCameraActive(true);
      roomAudioManuallyStopped=false;
      void startRoomAudio();
    }
    ui.start.disabled = true;
    ui.stop.disabled = false;
    ui.cameraStatus.textContent = 'Camera live';
    ui.trackingStatus.textContent = 'Searching for green…';
    state.identity.lastScanAt = 0;
    state.identity.completeScans=0;
    state.identity.initStartedAt=performance.now();
    if(state.identity.ready)updateGameScene('models');
    else void initRoomIdentity();
    state.raf = requestAnimationFrame(loop);
    cameraRecoveryPending=false;
    renderRuntimeHealth(true);
    return true;
  } catch (error) {
    console.error(error);
    roomSensorState('camera','degraded','Camera start failed · participant absence not inferred');
    ui.cameraStatus.textContent = window.isSecureContext ? 'Could not start camera' : 'Use localhost or HTTPS';
    updateGameScene('error');
    return false;
  }
}

function resetSession() {
  if (timedMode()) {
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
  let patternPlayers = null;
  if (timedMode()) {
    // Enrollment can have changed since this game page opened in a separate tab.
    // Refresh from the canonical same-origin IndexedDB before validating a match.
    await reloadIdentityParticipants();
    try {
      patternPlayers = resolvePatternPlayers(state.identity.participants, {
        count:Number(ui.playerCount.value),
        greenId:ui.greenPlayer.value,
        blueId:ui.bluePlayer.value,
        extraIds:extraPlayerIds,
        intervalSeconds:Number(ui.interval.value),
        rounds:Number(ui.rounds.value)
      });
    } catch(error) {
      ui.multiplayerSetupStatus.textContent = error.message;
      return;
    }
  }

  if (!state.running) {
    const started = await startCamera(ui.select.value);
    if (!started) return;
  }

  resetSession();
  if(timedMode()){
    try {
      state.pattern=platform.createSession(state.mode==='reaction'?'reaction-challenge':'random-follow-pattern',{
        players:patternPlayers,intervalSeconds:Number(ui.interval.value),
        rounds:Number(ui.rounds.value)
      });
      const result=state.pattern.start(performance.now());
      if(result.type!=='game-start')throw new Error('Could not start timed game.');
      state.markerTracker.reset();
      ui.multiplayerSetupStatus.textContent=state.mode==='reaction'?
        'Reaction live: move outside and enter each target before the timer expires.':
        'Timed pattern live: complete as many random targets as possible each interval.';
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
  if (timedMode()) {
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
  runtimeBudget.recordFrame(now,{hidden:document.hidden});
  renderRuntimeHealth();
  if (timedMode() && patternActive()) {
    const beforeRound=state.pattern.snapshot(now);
    const advance=state.pattern.tick(now);
    if (advance.advanced || advance.type === 'game-complete') {
      if(beforeRound.activeParticipantId)
        logPlayerActivity(beforeRound.activeParticipantId,
          advance.type==='game-complete'?'complete':'round',
          advance.type==='game-complete'?'All rounds finished':'Round '+beforeRound.round+' finished');
      state.activity.lastZones.clear();
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
  if (timedMode()) {
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
      if(ui.greenPlayer.value && ['rep','point','game-over'].includes(gameEvent.type))
        logPlayerActivity(ui.greenPlayer.value,gameEvent.type==='rep'?'rep':
          gameEvent.type==='point'?'point':'complete');
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
  if(ui.gameMode.value==='agent'){
    window.location.assign('./vertical-motion.html?mode=agent');return;
  }
  if (state.gameplay.game.active || state.multiplayer.snapshot().active || patternActive()) return;
  state.mode = ['solo','multiplayer','pattern','reaction'].includes(ui.gameMode.value) ? ui.gameMode.value : 'pattern';
  state.pattern=null;
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
 if(ui.greenPlayer.value){
  retainedPlayerId=ui.greenPlayer.value;
  try{window.localStorage.setItem(LAST_PARTICIPANT_KEY,retainedPlayerId);}catch{}
 }
  if (state.mode === 'multiplayer') { renderMultiplayer(); renderMatchHistory(); }
  else if (timedMode()) renderPattern();
});
ui.bluePlayer.addEventListener('change', () => {
  if (state.mode === 'multiplayer') { renderMultiplayer(); renderMatchHistory(); }
  else if (timedMode()) renderPattern();
});
ui.playerCount.addEventListener('change', () => {updatePatternSetup();renderPattern();});
ui.patternExtraPlayers.addEventListener('change',event=>{
  if(event.target.tagName!=='SELECT'||patternActive())return;
  extraPlayerIds[Number(event.target.dataset.extraPosition)-3]=event.target.value;
  renderPattern();
});
ui.interval.addEventListener('change', () => renderPattern());
ui.rounds.addEventListener('change', () => renderPattern());
ui.clearMatchHistory.addEventListener('click', () => {
  const cleared = clearMatchHistory(browserMatchStorage());
  ui.matchHistoryStatus.textContent = cleared ? 'Local match history cleared.' :
    'Browser storage unavailable; could not clear local history.';
  renderMatchHistory();
});
ui.start.addEventListener('click', () => {
 cameraStoppedThisPage=false;
 cameraRecovery.reset();cancelCameraRecovery();
 void startCamera(ui.select.value);
});
ui.cameraAutostart.addEventListener('change',()=>{
  saveCameraPreference(window.localStorage,ui.cameraAutostart.checked);
  ui.cameraPreferenceStatus.textContent=ui.cameraAutostart.checked ?
    'On: auto-start only if the browser already grants camera permission.':
    'Off: camera starts manually.';
});
ui.startRoomAudio.addEventListener('click',()=>{
 roomAudioManuallyStopped=false;
 microphoneRecovery.reset();cancelMicrophoneRecovery();
 void startRoomAudio();
});
ui.stopRoomAudio.addEventListener('click',()=>{
 roomAudioManuallyStopped=true;cancelMicrophoneRecovery();stopRoomAudio();
});
ui.clearDialogue.addEventListener('click', clearSavedDialogue);
ui.stop.addEventListener('click', () => {
  cameraStoppedThisPage=true;
  roomAudioManuallyStopped=true;
  cancelCameraRecovery();cancelMicrophoneRecovery();
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
    else if (timedMode()) renderPattern();
    else renderGame();
  }
});
ui.select.addEventListener('change', () => state.running && startCamera(ui.select.value));
ui.mirror.addEventListener('change',()=>{
  ui.video.classList.toggle('agent-mirror',ui.mirror.checked);
  renderParticipantCards();
});
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
  if(cameraRecoveryTimer)clearTimeout(cameraRecoveryTimer);
  if(microphoneRecoveryTimer)clearTimeout(microphoneRecoveryTimer);
  if(storageHealthTimer)clearInterval(storageHealthTimer);
  for(const unwatch of permissionWatchers)unwatch();
  taskUI?.destroy();
  stopRoomAudio();
  stopCamera();
});

restoreCalibration();
await reloadIdentityParticipants();
ui.cameraAutostart.checked=loadCameraPreference(window.localStorage);
ui.cameraPreferenceStatus.textContent=ui.cameraAutostart.checked ?
  'Saved preference · checking browser permission…':'Camera starts manually until approved.';
// Handoff is consumed once and every participant ID is rechecked against live local enrollment.
// Camera autostart requires saved opt-in AND a pre-existing browser permission grant.
// No timed game ever starts automatically.
try {
  const requestedMode=new URL(window.location.href).searchParams.get('mode');
  if(['solo','multiplayer','agent'].includes(requestedMode)){
    state.mode=requestedMode;
    ui.gameMode.value=requestedMode;
  } else {
    const handoff=consumeLobbyTicket(window.sessionStorage,state.identity.participants);
    if(handoff.status==='ready'){
      const setup=handoff.setup;
      state.mode=setup.gameId==='reaction-challenge'?'reaction':'pattern';
      ui.gameMode.value=state.mode;
      ui.playerCount.value=String(setup.players.length);
      ui.interval.value=String(setup.intervalSeconds);
      ui.rounds.value=String(setup.rounds);
      ui.greenPlayer.value=setup.players[0].participantId;
      retainedPlayerId=setup.players[0].participantId;
      try{window.localStorage.setItem(LAST_PARTICIPANT_KEY,retainedPlayerId);}catch{}
      if(setup.players.length>1)ui.bluePlayer.value=setup.players[1].participantId;
      extraPlayerIds=setup.players.slice(2).map(p=>p.participantId);
      ui.multiplayerSetupStatus.textContent='Lobby setup loaded. Check player assignments and start when ready.';
    } else if(handoff.status==='invalid'){
      ui.multiplayerSetupStatus.textContent='Lobby setup is invalid or enrollment changed. Please select your players again.';
    }
  }
} catch {
  ui.multiplayerSetupStatus.textContent='Lobby handoff unavailable; use the game setup controls directly.';
}
if(state.identity.participants.length===1 && !ui.greenPlayer.value){
  ui.greenPlayer.value=state.identity.participants[0].id;
}
if(state.identity.participants.length===1 && timedMode() && !extraPlayerIds.length){
  ui.playerCount.value='1';
  ui.bluePlayer.value='';
}
await loadSavedDialogue();
updateConversationGroups();
renderParticipantCards();
renderRoomEvents();
renderDialogueTurns();
renderVoiceHud();
renderStats(performance.now());
renderMode();
for(const button of document.querySelectorAll('[data-room-filter]')){
 button.addEventListener('click',()=>{
  roomTimelineFilter=normalizeRoomTimelineFilter(button.dataset.roomFilter);
  for(const candidate of document.querySelectorAll('[data-room-filter]'))
   candidate.setAttribute('aria-pressed',String(candidate===button));
  renderRoomObservations();
 });
}
if(state.mode==='agent'){
  void watchMediaPermission('camera');
  void watchMediaPermission('microphone');
  void refreshStorageHealth({announce:false});
  storageHealthTimer=window.setInterval(()=>{void refreshStorageHealth();},60000);
  renderRuntimeHealth(true);
  agentRuntime=createAgentRoom({
    participants:()=>state.identity.participants,
    getDialogueTurns:()=>state.voice.turns,
    getMemories:participantId=>memoryUI?.contextFor(participantId)||[],
    editTranscript:async(id,text)=>{
     const revised=await reviseDialogueTurn(id,text);
     state.voice.turns=state.voice.turns.map(turn=>turn.id===id?revised:turn);
     logRoomMessage('system','Owner corrected canonical transcript wording · original retained locally',
      'transcript-correction',{participantId:revised.participantId||null});
     agentRuntime?.refreshConversation();
     return revised;
    },
    stopAudio:async()=>{if(state.voice.active)stopRoomAudio();},
    startAudio:async()=>{
      roomAudioManuallyStopped=false;microphoneRecovery.reset();cancelMicrophoneRecovery();
      await reloadIdentityParticipants();await startRoomAudio();
    },
    startCamera:async()=>{
      cameraStoppedThisPage=false;cameraRecovery.reset();cancelCameraRecovery();
      await startCamera(ui.select.value);
    },
    stopCamera:()=>{
      cameraStoppedThisPage=true;roomAudioManuallyStopped=true;
      cancelCameraRecovery();cancelMicrophoneRecovery();stopCamera();
    },
    suppressMic:suppressed=>{
      agentSpeechActive=Boolean(suppressed);
      const captureSuppressed=Boolean(agentSpeechActive||state.voice.ttsPending>0);
      state.voice.audio?.setSuppressed(captureSuppressed);
      listeningController.setAgentSpeaking(agentSpeechActive);
      listeningController.setSuppressed(captureSuppressed,
       agentSpeechActive?'agent-tts':state.voice.ttsPending>0?'acknowledgement-tts':'capture-active');
      renderListeningHealth();
    }
  });
  agentRuntime.init();
  const autoGreet=document.getElementById('agentAutoGreet');
  const quietHours=document.getElementById('agentQuietHours');
  const quietStart=document.getElementById('agentQuietStart');
  const quietEnd=document.getElementById('agentQuietEnd');
  const refreshCognitivePolicy=()=>{
   cognitiveLoop.setPolicy({...DEFAULT_COGNITIVE_POLICY,
    autoGreet:autoGreet.checked,quietEnabled:quietHours.checked,
    quietStart:quietStart.value,quietEnd:quietEnd.value});
   renderCognitiveStatus();
  };
  for(const control of [autoGreet,quietHours,quietStart,quietEnd])
   control.addEventListener('change',refreshCognitivePolicy);
  autoGreet.checked=true;quietHours.checked=false;
  refreshCognitivePolicy();
  sceneUI=createRoomSceneUi({
   getTracks:()=>state.running?publicRoomTracks():[],
   mirror:()=>ui.mirror.checked,
   onChange:message=>{
    roomTemporal.sceneChanged();
    renderRoomTemporalSummary();
    taskUI?.refresh();
    logRoomMessage('activity',message,'owner-scene',{semantic:'owner-map-edit'});
   }
  });
  taskUI=createAgentTaskUi({
   getScene:()=>sceneUI?.getScene()||emptyRoomScene(),
   recordEvent:(category,message,source,options)=>logRoomMessage(category,message,source,options)
  });
  void taskUI.init().catch(error=>console.warn('Task runtime initialization failed:',error));
  memoryUI=createAgentMemoryUi({
   participants:()=>state.identity.participants,
   getDialogueTurns:()=>state.voice.turns,
   getRoomEvents:()=>roomLedger.entries(),
   onAudit:(message,memory)=>logRoomMessage('system',message,'owner-memory',{
    kind:'decision',semantic:'owner-memory-change',participantId:memory?.participantId||null
   }),
   onChanged:()=>agentRuntime?.refreshConversation()
  });
  void memoryUI.init().catch(error=>console.warn('Memory runtime initialization failed:',error));
  void sceneUI.init().then(ok=>{
   if(ok){roomTemporal.sceneChanged();renderRoomTemporalSummary();taskUI?.refresh();}
  }).catch(error=>console.warn('Scene initialization failed:',error));
  ui.mirror.addEventListener('change',()=>sceneUI?.renderTracks());
  renderAmbientAudioMeter(true);
  const ambientAnalysis=document.getElementById('roomAnalyzeAcousticPatterns');
  if(ambientAnalysis){
   ambientAnalysis.checked=false;
   ambientAnalysis.addEventListener('change',()=>{
    analyzeAmbientPatterns=ambientAnalysis.checked;
    if(analyzeAmbientPatterns)logRoomMessage('system',
     'Owner enabled local room energy-pattern notes · no sound identification','audio-consent');
    else logRoomMessage('system','Owner disabled local room energy-pattern notes','audio-consent');
   });
  }
  const roomOptIn=document.getElementById('roomSaveObservations');
  const roomClear=document.getElementById('roomClearObservations');
  try{saveRoomHistory=window.localStorage.getItem('tracky2-save-room-observations')==='yes';}
  catch{saveRoomHistory=false;}
  roomOptIn.checked=saveRoomHistory;
  if(saveRoomHistory){
   const epoch=roomPrivacyEpoch;
   void listRoomObservations().then(rows=>{
    if(epoch!==roomPrivacyEpoch)return;
    roomHistory=roomLedger.restore([...rows,...roomHistory]);
    renderRoomObservations();
   }).catch(console.warn);
  }
  roomOptIn.addEventListener('change',()=>{
   roomPrivacyEpoch++;
   saveRoomHistory=roomOptIn.checked;
   try{window.localStorage.setItem('tracky2-save-room-observations',saveRoomHistory?'yes':'no');}catch{}
   if(saveRoomHistory)persistCurrentRoomSnapshot();
  });
  roomClear.addEventListener('click',async()=>{
   if(!window.confirm('Clear ROOM observations saved on this device?'))return;
   roomPrivacyEpoch++;
   roomLedger.clear();roomHistory=[];renderRoomObservations();
   try{
    await roomWrites.catch(()=>{});
    await clearRoomObservations();
   }catch(error){console.warn('Unable to clear saved room observations',error);}
  });
  const hour=new Date().getHours();
  logRoomMessage('system','Local '+(hour<6?'night':hour<12?'morning':hour<18?'daytime':'evening')+' session started','local-clock');
  document.getElementById('activeGameKicker').textContent='GAME 03 · LIVE ROOM';
  document.getElementById('activeGameTitle').textContent='AGENT';
  document.getElementById('roomDialogueTab').textContent='Conversation';
  ui.voiceAcknowledgements.checked=false;
  ui.liveTranscription.checked=true;
}
drawTrace();
async function maybeStartApprovedCamera(){
 if(state.running||!loadCameraPreference(window.localStorage)||cameraStoppedThisPage)return;
 const permission=await cameraPermissionState(navigator.permissions);
 if(cameraAutostartEligible({optIn:true,permission,
  supported:!!navigator.mediaDevices?.getUserMedia,sessionStopped:cameraStoppedThisPage})){
  ui.cameraPreferenceStatus.textContent='Permission granted · starting camera…';
  const ok=await startCamera(ui.select.value);
  if(!ok)ui.cameraPreferenceStatus.textContent='Auto-start failed; use Start camera to retry.';
 }else{
  ui.cameraPreferenceStatus.textContent=permission==='denied'?'Camera blocked in browser settings.':
    permission==='unsupported'?'Browser cannot confirm permission; click Start camera.':
    'Approve camera through Start camera to enable future auto-start.';
 }
}
void maybeStartApprovedCamera();
window.addEventListener('pageshow',()=>{
 if(!state.gameplay.game.active&&!state.multiplayer.snapshot().active&&!patternActive()){
  void reloadIdentityParticipants().then(()=>renderMode());
 }
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)return;
 void refreshStorageHealth();
 if(cameraRecoveryPending)void scheduleCameraRecovery('foreground-resume');
 if(microphoneRecoveryPending)void scheduleMicrophoneRecovery('foreground-resume');
 if(!state.running&&!cameraStoppedThisPage&&!cameraRecoveryPending)void maybeStartApprovedCamera();
});

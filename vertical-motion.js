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
import {RoomAmbientAudit} from './src/room-audio-audit.js';
import {describeAcousticPattern,RoomAcousticPatternTracker} from './src/room-acoustic-patterns.js';
import {
 EnvironmentalAudioQueue,EnvironmentalClassificationTracker,
 normalizeEnvironmentalPredictions,environmentalClassificationMessage
} from './src/environmental-audio-core.js';
import {
 EnvironmentalActivityTracker,EnvironmentalEventGrouper,calibrateEnvironmentalClassification,
 environmentalActivityMessage,environmentalFeedbackFromRoomEvent,environmentalV2Message,
 normalizeEnvironmentalV2Predictions,recordedMediaCueFromPredictions
} from './src/environmental-intelligence-core.js';
import {
 RoomSpeechOriginTracker,resolveRoomSpeechOrigin,roomSpeechOriginMessage
} from './src/speech-origin-core.js';
import {
 MusicIdentificationTracker,MusicLyricLookupGuard,MusicRecognitionQueue,
 identifyMusicFingerprint,musicIdentificationMessage
} from './src/music-identification-core.js';
import {searchMusicByLyricClue} from './src/music-identification-client.js';
import {createAcrCloudMusicProvider} from './src/music-fingerprint-client.js';
import {
 MediaIdentificationTracker,MediaLookupGuard,MediaRecognitionQueue,
 mediaIdentificationMessage
} from './src/media-identification-core.js';
import {searchMediaByClues} from './src/media-identification-client.js';
import {
 RoomMediaFusionTracker,fuseRoomMediaEvidence,mediaVisualLookupAllowed,
 normalizeMediaVisualObservation,roomMediaFusionMessage
} from './src/room-media-fusion-core.js';
import {
 RoomAudioIntelligenceCoordinator,roomAudioIntelligenceMessage
} from './src/room-audio-orchestration-core.js';
import {
 RoomLiveValidationTracker,roomAudioBehaviorPolicy,roomLiveValidationMessage
} from './src/room-audio-live-validation-core.js';
import {
 RoomMediaContinuityTracker,roomMediaContinuityMessage
} from './src/room-media-continuity-core.js';
import {
 RoomContextualCognitionTracker,contextualMediaPrompt
} from './src/room-contextual-cognition-core.js';
import {
 RoomSituationalAwarenessTracker,restoreSituationalAwareness,exportSituationalAwareness,
 situationalFeedbackFromReply,situationalPromptContext
} from './src/room-situational-awareness-core.js';
import {
 RoomContextPlanner,contextualPlanPrompt
} from './src/room-context-planning-core.js';
import {
 contextualFollowThroughProposal,followThroughReplyDecision,confirmedFollowThrough,
 completedFollowThrough,followThroughResultMessage
} from './src/contextual-followthrough-core.js';
import {
 EnvironmentalAlertTracker,EnvironmentalMechanicalTracker,
 environmentalAlertAgentNotice,environmentalAlertMessage,environmentalMechanicalMessage
} from './src/environmental-alert-core.js';
import {
 PersonalizedSoundRecognitionTracker,acousticFeatureSignature,
 appendPersonalizedSoundExample,createPersonalizedSoundProfile,
 matchPersonalizedSound,personalizedSoundCategoryEligible,
 personalizedSoundLearningEligibility,personalizedSoundMessage
} from './src/personalized-sound-core.js';
import {
 deriveRoutineCandidates,normalizeRoutineFeedback,routineDeviation,routineLabel
} from './src/routine-intelligence-core.js';
import {routineProactiveOpportunity} from './src/agent-proactive-intelligence-core.js';
import {LocalEnvironmentalAudioClassifier} from './src/environmental-audio-engine.js';
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
import {ParticipantContinuityTracker} from './src/participant-continuity-core.js';
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
 RoomPresenceLedger,RoomEventLedger,roomObservation,projectRoomState
} from './src/room-event-core.js';
import {
 RoomHandoffTracker,roomHandoffMessage,roomHandoffTurnFields
} from './src/room-handoff-core.js';
import {MultiRoomRuntimeClient,multiRoomNodeId} from './src/multi-room-runtime.js';
import {createRoomSceneUi} from './src/room-scene-ui.js';
import {emptyRoomScene} from './src/room-scene-graph.js';
import {RoomTemporalLedger} from './src/room-temporal-core.js';
import {AgentCognitiveLoop,DEFAULT_COGNITIVE_POLICY} from './src/agent-cognitive-core.js';
import {
 ProactiveAgentGovernor,DEFAULT_PROACTIVE_POLICY,normalizeProactivePolicy,proactiveOpportunity
} from './src/agent-proactive-core.js';
import {roomEventMatchesFilter,roomUiOverview,normalizeRoomTimelineFilter} from './src/room-ui-core.js';
import {
 RecoveryBudget,RuntimeBudget,storagePressure,queryMediaPermission,permissionState
} from './src/runtime-resilience-core.js';
import {
 DevicePerformanceGovernor,performanceSampleDelta
} from './src/device-performance-core.js';
import {
 reconcileParticipantMap,reconcileParticipantSet,reconcileTransientDialogueTurns
} from './src/long-session-core.js';
import {
 LongSessionAutonomyMonitor,certificationLabel
} from './src/long-session-autonomy-core.js';
import {createAgentTaskUi} from './src/agent-task-ui.js';
import {createAgentWorkflowUi} from './src/agent-workflow-ui.js';
import {createAgentMemoryUi} from './src/agent-memory-ui.js';
import {createSessionRecallUi} from './src/session-recall-ui.js';
import {createRecordingUi} from './src/recording-ui.js';
import {createSessionIdentity} from './src/session-identity-core.js';
import {createMeetingUi} from './src/meeting-ui.js';
import {ConversationListeningController} from './src/conversation-listening-core.js';
import {
 SpeakerAssociationTracker,resolveSpeakerAssociation,speakerAssociationLabel,
 speakerAssociationTurnFields
} from './src/speaker-participant-core.js';
import {
 MultimodalFusionTracker,deriveMultimodalEvidence,fuseMultimodalIdentity,
 multimodalFusionTurnFields
} from './src/multimodal-identity-core.js';
import {
 SpeakerDiarizationSession,createDiarizationWindows,diarizationTurnFields,
 finalizeDiarization
} from './src/speaker-diarization-core.js';
import {
 ContinuousSpeakerFusionTracker,continuousFusionTurnFields,recordVisualHistory,
 summarizeContinuousFusion,visualSnapshotForWindow
} from './src/continuous-fusion-core.js';
import {
 fuseSpatialAudioSource,spatialAudioSourceTurnFields,visualSpatialSourceEvidence
} from './src/spatial-audio-source-core.js';
import {
 buildTurnAttribution,multiPersonAttributionTurnFields
} from './src/multi-person-attribution-core.js';
import {
 overlapSeparationTurnFields,resolveSeparatedSpeakerMatches,separateStereoOverlap
} from './src/overlap-source-separation-core.js';
import {
 TranscriptLifecycleController,canonicalTranscriptFields,searchTranscriptTurns,
 transcriptExport,transcriptSessionSummaries
} from './src/transcript-lifecycle-core.js';
import {
 multiConversationTurnFields,conversationContextLabel
} from './src/multi-conversation-core.js';
import {
  clearDialogueTurns,
  deleteDialogueTurn,
  listDialogueTurns,
  listParticipants,
  patchParticipant,
  saveDialogueTurn,
  reviseDialogueTurn,
  reviseDialogueAttribution,
  savePendingCapture,
  listRoomObservations,saveRoomObservation,clearRoomObservations,
  listEnvironmentalFeedback,saveEnvironmentalFeedback,clearEnvironmentalFeedback,
  listPersonalizedSoundProfiles,savePersonalizedSoundProfile,
  deletePersonalizedSoundProfile,clearPersonalizedSoundProfiles,
  listRoutineFeedback,saveRoutineFeedback,clearRoutineFeedback,
  startSessionIdentity,endStoredSessionIdentity
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
  roomAudioSource: $('#roomAudioSource'),
  roomSpeaker: $('#roomSpeaker'),
  roomVoiceConfidence: $('#roomVoiceConfidence'),
  roomBodyLock: $('#roomBodyLock'),
  roomDialogueGroup: $('#roomDialogueGroup'),
  roomSpeakerAssociation: $('#roomSpeakerAssociation'),
  roomOverlapSeparation: $('#roomOverlapSeparation'),
  roomSpeakerProvenance: $('#roomSpeakerProvenance'),
  roomConversationAttention: $('#roomConversationAttention'),
  roomConversationGroupSize: $('#roomConversationGroupSize'),
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

let agentRuntime=null,sceneUI=null,taskUI=null,workflowUI=null,memoryUI=null,meetingUI=null,recallUI=null,recordingUI=null;
let multiRoomRuntime=null;
const roomPresence=new RoomPresenceLedger();
const roomTemporal=new RoomTemporalLedger();
const roomHandoffTracker=new RoomHandoffTracker();
const roomLedger=new RoomEventLedger();
const cognitiveLoop=new AgentCognitiveLoop();
const proactiveGovernor=new ProactiveAgentGovernor();
const listeningController=new ConversationListeningController();
const speakerAssociationTracker=new SpeakerAssociationTracker();
const multimodalFusionTracker=new MultimodalFusionTracker();
const diarizationSession=new SpeakerDiarizationSession();
const continuousSpeakerFusionTracker=new ContinuousSpeakerFusionTracker();
const participantContinuity=new ParticipantContinuityTracker();
const transcriptLifecycle=new TranscriptLifecycleController();
const roomSessionStartedAt=Date.now();
let canonicalRuntimeInstanceId='';
try{
 canonicalRuntimeInstanceId=window.sessionStorage.getItem('tracky2-runtime-instance-id')||'';
 if(!canonicalRuntimeInstanceId){
  canonicalRuntimeInstanceId=(typeof crypto!=='undefined'&&crypto.randomUUID)
   ?crypto.randomUUID():'tab-'+Math.random().toString(36).slice(2,12);
  window.sessionStorage.setItem('tracky2-runtime-instance-id',canonicalRuntimeInstanceId);
 }
}catch{
 canonicalRuntimeInstanceId='tab-'+Math.random().toString(36).slice(2,12);
}
const canonicalSessionId=(typeof crypto!=='undefined'&&crypto.randomUUID)
 ? crypto.randomUUID()
 : 'room-'+roomSessionStartedAt.toString(36)+'-'+Math.random().toString(36).slice(2,8);
const roomSessionId=canonicalSessionId;
let roomHistory=[],saveRoomHistory=false,roomPrivacyEpoch=0,roomWrites=Promise.resolve();
let roomTrackHistory=[];
let roomTimelineFilter='all';
let lastRoomOccupancyCount=null;
const runtimeBudget=new RuntimeBudget();
const devicePerformanceGovernor=new DevicePerformanceGovernor();
let lastDevicePerformanceRuntime=null;
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
let proactiveTimer=0,lastProactiveDecisionSignature='',proactiveComposePending=false;
let lastRoomHandoffState=null,lastRoomIdentityId='';
let runtimeExitPrepared=false;
function activeAgentTaskCount(){
 return (taskUI?.getTasks?.()||[]).filter(task=>
  ['pending-confirmation','scheduled','running'].includes(task.status)).length;
}
function latestCanonicalDialogueAt(){
 const last=state.voice?.turns?.[state.voice.turns.length-1];
 if(!last)return 0;
 return Number.isFinite(last.at)?last.at:(Date.parse(last.createdAt||'')||0);
}
function proactiveContext(now=Date.now()){
 const visible=state.running?publicRoomTracks().filter(track=>
  !['occluded','reacquiring'].includes(track.status)&&track.participantId):[];
 return {
  now,pageVisible:!document.hidden,
  busy:Boolean(state.voice.vad||state.voice.processing||agentSpeechActive||
   state.voice.ttsPending>0||agentRuntime?.isBusy?.()),
  meetingActive:meetingUI?.activeMeeting()?.status==='active',
  visibleParticipantIds:[...new Set(visible.map(track=>track.participantId))],
  activeTaskCount:activeAgentTaskCount(),
  lastDialogueAt:latestCanonicalDialogueAt(),
  participantById,
  quietPolicy:cognitiveLoop.policy
 };
}
function loadSituationalAwareness(){
 if(!saveRoomHistory)return roomSituationalAwareness;
 try{
  const raw=window.localStorage.getItem('tracky2-room-situational-awareness-v1');
  if(raw)roomSituationalAwareness=restoreSituationalAwareness(JSON.parse(raw));
 }catch{}
 return roomSituationalAwareness;
}
function persistSituationalAwareness(){
 if(!saveRoomHistory)return false;
 try{
  window.localStorage.setItem('tracky2-room-situational-awareness-v1',
   JSON.stringify(exportSituationalAwareness(roomSituationalAwareness)));
  memoryUI?.refreshProposals?.();
  return true;
 }catch{return false;}
}
function clearSituationalAwareness(){
 roomSituationalAwareness=new RoomSituationalAwarenessTracker();
 roomContextPlanner=new RoomContextPlanner();
 pendingSituationalEngagement=null;pendingContextualFollowThrough=null;
 lastSituationalMediaKey='';lastSituationalMediaAt=0;
 try{window.localStorage.removeItem('tracky2-room-situational-awareness-v1');}catch{}
}
function situationalEventFromRoomEvent(event){
 if(!event||!event.semantic)return null;
 const allowed=new Set([
  'participant-observed','participant-out-of-view','environmental-alert',
  'music-identification','media-identification','room-media-continuity',
  'routine-deviation','room-departure-confirmed','room-arrival-observed'
 ]);
 if(!allowed.has(event.semantic))return null;
 let topicKey=event.semantic;
 let mediaKind=null;
 const music=event.evidence?.musicIdentification;
 const media=event.evidence?.mediaIdentification;
 const continuity=event.evidence?.roomMediaContinuity;
 const alert=event.evidence?.environmentalAlert;
 if(music?.artist||music?.title){
  mediaKind='music';
  topicKey='music:'+String(music.artist||'').toLowerCase()+'::'+String(music.title||'').toLowerCase();
 }else if(media?.title||media?.series){
  mediaKind=media.kind||'recorded-media';
  topicKey=mediaKind+':'+String(media.series||'').toLowerCase()+'::'+String(media.title||'').toLowerCase();
 }else if(continuity?.identity){
  mediaKind=continuity.kind||'recorded-media';
  topicKey=mediaKind+':'+String(continuity.identity.artist||continuity.identity.series||'').toLowerCase()+
   '::'+String(continuity.identity.title||'').toLowerCase();
 }else if(alert?.key){
  topicKey='environment:'+String(alert.key).toLowerCase();
 }
 const novelty=['participant-observed','participant-out-of-view','room-departure-confirmed','room-arrival-observed'].includes(event.semantic)
  ?.72:event.semantic==='environmental-alert'?.88:.66;
 const salience=event.semantic==='environmental-alert'?.92:
  event.semantic==='routine-deviation'?.78:.62;
 return roomSituationalAwareness.observe({
  id:event.id,participantId:event.participantId||null,
  type:event.semantic,semantic:event.semantic,topicKey,mediaKind,
  message:event.message,confidence:Number(event.confidence)||.5,
  novelty,salience,source:event.source,relatedEventId:event.relatedEventId||null
 },event.at||Date.now());
}
function situationalMediaEvent(candidate,now=Date.now()){
 const key=String(candidate?.participantId||'')+':'+String(candidate?.topicKey||'');
 if(!key||key===':')return null;
 const recent=roomSituationalAwareness.relatedContext({
  participantId:candidate.participantId,topicKey:candidate.topicKey,limit:1
 })[0]||null;
 if(recent&&recent.type==='media-context'&&now-recent.at<30000)return recent;
 const novelty=(lastSituationalMediaKey&&lastSituationalMediaKey!==key)?.9:
  lastSituationalMediaKey===key?.52:.76;
 lastSituationalMediaKey=key;lastSituationalMediaAt=now;
 return roomSituationalAwareness.observe({
  participantId:candidate.participantId,type:'media-context',
  topicKey:candidate.topicKey,mediaKind:candidate.mediaKind,
  message:candidate.mediaLabel||'identified media context',
  confidence:candidate.confidence,novelty,
  salience:.64,source:'room-contextual-media-cognition'
 },now);
}
function settlePendingSituationalFeedback(now=Date.now()){
 if(!pendingSituationalEngagement)return null;
 if(now-pendingSituationalEngagement.at<120000)return null;
 const feedback=roomSituationalAwareness.noteFeedback({
  participantId:pendingSituationalEngagement.participantId,
  topicKey:pendingSituationalEngagement.topicKey,
  eventType:'media-context',mediaKind:pendingSituationalEngagement.mediaKind,
  action:pendingSituationalEngagement.action,
  outcome:'ignored',weight:.7
 },now);
 roomContextPlanner.noteFeedback({
  action:pendingSituationalEngagement.action,
  mediaKind:pendingSituationalEngagement.mediaKind,
  topicKey:pendingSituationalEngagement.topicKey
 },{outcome:'ignored',at:now});
 pendingSituationalEngagement=null;
 persistSituationalAwareness();
 return feedback;
}
async function handleContextualFollowThrough(turn,now=Date.now()){
 const proposal=pendingContextualFollowThrough;
 if(!proposal||!turn?.participantId||
    String(turn.participantId)!==String(proposal.participantId))return false;
 const decision=followThroughReplyDecision(turn.transcript,proposal,now);
 if(decision.action==='none')return false;
 if(decision.action==='expire'){
  logRoomMessage('decision','Contextual follow-through expired before confirmation',
   'room-contextual-followthrough',{
    kind:'outcome',semantic:'context-followthrough-expired',
    participantId:proposal.participantId,relatedEventId:proposal.relatedEventId||null
   });
  pendingContextualFollowThrough=null;return false;
 }
 if(decision.action==='decline'){
  const cancelled=completedFollowThrough(proposal,{status:'cancelled',at:now});
  logRoomMessage('decision',followThroughResultMessage(cancelled),
   'room-contextual-followthrough',{
    kind:'outcome',semantic:'context-followthrough-cancelled',
    participantId:proposal.participantId,relatedEventId:proposal.relatedEventId||null,
    evidence:{contextualFollowThrough:cancelled}
   });
  pendingContextualFollowThrough=null;return false;
 }
 const confirmed=confirmedFollowThrough(proposal,now);
 if(!confirmed)return false;
 pendingContextualFollowThrough=null;
 logRoomMessage('decision','Owner confirmed contextual '+confirmed.action,
  'room-contextual-followthrough',{
   kind:'decision',semantic:'context-followthrough-confirmed',
   participantId:confirmed.participantId,relatedEventId:confirmed.relatedEventId||null,
   evidence:{contextualFollowThrough:{
    schema:confirmed.schema,id:confirmed.id,status:confirmed.status,
    action:confirmed.action,topicKey:confirmed.topicKey,subject:confirmed.subject,
    participantId:confirmed.participantId,confirmedAt:confirmed.confirmedAt,rawAudioStored:false
   }}
  });
 proactiveComposePending=true;
 try{
  let result=null;
  if(confirmed.action==='research'){
   result=await agentRuntime.researchContext(confirmed.query);
  }else{
   const prompt='The user explicitly accepted the proposed '+confirmed.action+
    ' follow-through about '+confirmed.subject+
    '. Complete that accepted follow-through now in a concise useful response. '+
    'Do not claim web research unless a research tool was actually used.';
   result=await agentRuntime.composeProactive(prompt,{
    participantId:confirmed.participantId,scopeId:'media-context:'+confirmed.participantId
   });
  }
  if(result?.ok&&result.reply){
   const spoken=agentRuntime.proactiveSpeak(result.reply,{
    participantId:confirmed.participantId,scopeId:'media-context:'+confirmed.participantId
   })===true;
   const completed=completedFollowThrough(confirmed,{
    status:spoken?'succeeded':'failed',summary:result.reply,
    sources:result.sources||[],provider:result.provider,model:result.model,at:Date.now()
   });
   logRoomMessage('decision',followThroughResultMessage(completed),
    'room-contextual-followthrough',{
     kind:'outcome',semantic:'context-followthrough-outcome',
     participantId:confirmed.participantId,relatedEventId:confirmed.relatedEventId||null,
     evidence:{contextualFollowThrough:completed}
    });
   if(spoken){
    roomContextPlanner.noteFeedback({
     action:confirmed.action,mediaKind:confirmed.mediaKind,topicKey:confirmed.topicKey
    },{outcome:'expanded',at:Date.now()});
   }
   return true;
  }
  const failed=completedFollowThrough(confirmed,{
   status:'failed',summary:String(result?.reason||'follow-through unavailable'),at:Date.now()
  });
  logRoomMessage('decision',followThroughResultMessage(failed)+' · '+failed.summary,
   'room-contextual-followthrough',{
    kind:'outcome',semantic:'context-followthrough-outcome',
    participantId:confirmed.participantId,relatedEventId:confirmed.relatedEventId||null,
    evidence:{contextualFollowThrough:failed}
   });
  return true;
 }finally{proactiveComposePending=false;}
}

function noteSituationalDialogueFeedback(turn,now=Date.now()){
 if(!pendingSituationalEngagement||!turn?.participantId||
    String(turn.participantId)!==String(pendingSituationalEngagement.participantId))return null;
 const elapsed=now-pendingSituationalEngagement.at;
 if(elapsed<0||elapsed>180000)return settlePendingSituationalFeedback(now);
 const classified=situationalFeedbackFromReply(turn.transcript,{elapsedMs:elapsed});
 const feedback=roomSituationalAwareness.noteFeedback({
  participantId:turn.participantId,topicKey:pendingSituationalEngagement.topicKey,
  eventType:'media-context',mediaKind:pendingSituationalEngagement.mediaKind,
  action:pendingSituationalEngagement.action,
  outcome:classified.outcome,weight:classified.weight
 },now);
 roomContextPlanner.noteFeedback({
  action:pendingSituationalEngagement.action,
  mediaKind:pendingSituationalEngagement.mediaKind,
  topicKey:pendingSituationalEngagement.topicKey
 },{outcome:classified.outcome,at:now});
 pendingSituationalEngagement=null;
 persistSituationalAwareness();
 return feedback;
}

function considerContextualMediaEngagement(now=Date.now()){
 if(state.mode!=='agent'||!agentRuntime||meetingUI?.activeMeeting()?.status==='active')return null;
 const visible=state.running?publicRoomTracks().filter(track=>
  !['occluded','reacquiring'].includes(track.status)&&track.participantId):[];
 const ids=[...new Set(visible.map(track=>track.participantId).filter(Boolean))];
 if(ids.length!==1)return null;
 const participant=participantById(ids[0]);
 if(!participant)return null;
 const temporal=roomTemporal.summary(effectiveRoomScene(),now)
  .find(row=>row.participantId===participant.id)||null;
 const continuity=roomMediaContinuity.snapshot();
 const audio=roomAudioIntelligence.snapshot();
 const {candidate}=roomContextualCognition.observe({
  participant,temporal,continuity,audio,lastDialogueAt:latestCanonicalDialogueAt()
 },now);
 if(!candidate?.eligible)return candidate||null;
 const situationalEvent=situationalMediaEvent(candidate,now);
 if(!situationalEvent)return candidate;
 const situationalDecision=roomSituationalAwareness.evaluate(situationalEvent,{
  participantId:candidate.participantId,
  recentInterruptions:proactiveGovernor.snapshot(now).interruptionsThisHour,
  now
 });
 if(!situationalDecision.interesting)return candidate;
 const awarenessContext=situationalPromptContext(
  roomSituationalAwareness,situationalEvent,situationalDecision
 );
 const recentFeedback=roomSituationalAwareness.snapshot().recentFeedback||[];
 const latestFeedback=[...recentFeedback].reverse().find(row=>
  !row.participantId||String(row.participantId)===String(candidate.participantId)
 )||null;
 const plan=roomContextPlanner.plan(candidate,situationalDecision,{
  recentDialogueTopicShift:latestFeedback?.outcome==='topic-changed',
  now
 });
 if(plan.action==='silence')return candidate;
 const prompt=contextualPlanPrompt(plan,candidate,awarenessContext)+
  '\nDo not reveal scoring, history mechanics, or internal observations.';
 if(!prompt)return candidate;
 const semanticKey='media-context:'+candidate.participantId+':'+candidate.topicKey+':'+plan.action;
 const offered=proactiveGovernor.offer(proactiveOpportunity({
  id:'media-context:'+candidate.participantId,
  type:'media-context',
  participantId:candidate.participantId,
  scopeId:'media-context:'+candidate.participantId,
  sourceAt:now,
  eligibleAt:now,
  expiresAt:now+120000,
  text:'Contextual media engagement',
  generationPrompt:prompt,
  semanticKey,
  dedupeKey:semanticKey,
  usefulness:.68,
  urgency:.12,
  confidence:candidate.confidence,
  requiresNoActiveTasks:true,
  source:'room-contextual-media-cognition'
 },now,proactiveGovernor.policy));
 if(offered?.opportunity?.id)
  contextualOpportunityCandidates.set(offered.opportunity.id,{candidate,plan});
 return candidate;
}

function renderCognitiveStatus(){
 const awarenessLabel=document.getElementById('roomSituationalAwarenessStatus');
 if(awarenessLabel&&state.mode==='agent'){
  const awareness=roomSituationalAwareness.snapshot();
  const last=awareness.lastDecision;
  const planning=roomContextPlanner.snapshot();
  awarenessLabel.textContent='Situational learning · '+awareness.eventCount+' events · '+
   awareness.feedbackCount+' feedback signals · '+
   (saveRoomHistory?'saved locally':'session only')+
   (last?' · last interest '+Math.round(last.score*100)+'%':'')+
   (planning.lastPlan?' · plan '+planning.lastPlan.action:'')+
   (pendingContextualFollowThrough?' · follow-through '+pendingContextualFollowThrough.action+' pending':'');
 }
 const label=document.getElementById('agentCognitiveStatus');
 if(!label||state.mode!=='agent')return;
 const cognitive=cognitiveLoop.snapshot(),proactive=proactiveGovernor.snapshot();
 const last=(proactive.pending||proactive.lastDecision?.opportunityId)
  ? proactive.lastDecision : cognitive.lastDecision;
 label.textContent=last?
  last.reason+' · '+proactive.pending+' proactive pending · '+
   proactive.interruptionsThisHour+'/'+proactive.maxInterruptionsPerHour+' interruptions this hour'+
   (proactive.topCandidate
    ?' · top '+proactive.topCandidate.type+' '+Math.round(proactive.topCandidate.score*100)+'%':'')+
   ' · '+proactive.sessionPlans+' session plan'+(proactive.sessionPlans===1?'':'s'):
  'Waiting for stable room evidence · no engagement decisions yet';
}
function recordProactiveSourceEvent(category,message,source,options={}){
 const event=logRoomMessage(category,message,source,options);
 if(event){
  proactiveGovernor.noteStatusEvent(event,Date.now());
  renderCognitiveStatus();
 }
 return event;
}
async function tickProactive(){
 if(state.mode!=='agent'||!agentRuntime||proactiveComposePending)return;
 const now=Date.now();
 settlePendingSituationalFeedback(now);
 considerContextualMediaEngagement(now);
 const decision=proactiveGovernor.evaluateNext(proactiveContext(now));
 renderCognitiveStatus();
 if(!decision?.opportunityId)return;
 const signature=decision.opportunityId+':'+decision.action+':'+decision.reason;
 if(decision.action==='speak'){
  const decisionEvent=logRoomMessage('decision',
   'Proactive opportunity approved · '+decision.opportunity.type+' · '+decision.reason,
   'agent-proactive-governor',{
    kind:'decision',semantic:'agent-proactive-decision',
    participantId:decision.participantId,
    relatedEventId:decision.opportunity.relatedEventId||null
   });
  let executed=false;
  if(decision.opportunity.type==='media-context'&&decision.opportunity.generationPrompt){
   proactiveComposePending=true;
   try{
    const generated=await agentRuntime.composeProactive(decision.opportunity.generationPrompt,{
     participantId:decision.participantId,scopeId:decision.opportunity.scopeId
    });
    if(generated?.ok&&generated.reply){
     executed=agentRuntime.proactiveSpeak(generated.reply,{
      participantId:decision.participantId,scopeId:decision.opportunity.scopeId
     })===true;
    }else{
     logRoomMessage('decision','Contextual media engagement abstained · '+
      String(generated?.reason||'model unavailable'),'room-contextual-media-cognition',{
       kind:'decision',semantic:'agent-proactive-abstain',
       participantId:decision.participantId,relatedEventId:decisionEvent?.id||null
      });
    }
   }finally{proactiveComposePending=false;}
  }else{
   executed=agentRuntime.proactiveSpeak(decision.opportunity.text,{
    participantId:decision.participantId,
    scopeId:decision.opportunity.scopeId
   })===true;
  }
  const contextualEntry=contextualOpportunityCandidates.get(decision.opportunityId)||null;
  if(contextualEntry){
   const contextualCandidate=contextualEntry.candidate;
   const contextualPlan=contextualEntry.plan;
   const outcomeAt=Date.now();
   roomContextualCognition.record(contextualCandidate,{executed,at:outcomeAt});
   roomContextPlanner.record(contextualPlan,{executed,at:outcomeAt});
   if(executed){
    pendingSituationalEngagement={
     participantId:contextualCandidate.participantId,
     topicKey:contextualCandidate.topicKey,
     action:contextualPlan?.action||null,
     mediaKind:contextualCandidate.mediaKind||null,
     at:outcomeAt
    };
    pendingContextualFollowThrough=contextualFollowThroughProposal({
     plan:contextualPlan,candidate:contextualCandidate,
     relatedEventId:decisionEvent?.id||decision.opportunity.relatedEventId||null,
     at:outcomeAt
    });
    if(pendingContextualFollowThrough){
     logRoomMessage('decision','Contextual '+pendingContextualFollowThrough.action+
      ' follow-through awaiting explicit user acceptance',
      'room-contextual-followthrough',{
       kind:'decision',semantic:'context-followthrough-proposed',
       participantId:contextualCandidate.participantId,
       relatedEventId:pendingContextualFollowThrough.relatedEventId||null,
       evidence:{contextualFollowThrough:{
        schema:pendingContextualFollowThrough.schema,id:pendingContextualFollowThrough.id,
        status:pendingContextualFollowThrough.status,action:pendingContextualFollowThrough.action,
        topicKey:pendingContextualFollowThrough.topicKey,subject:pendingContextualFollowThrough.subject,
        participantId:pendingContextualFollowThrough.participantId,
        expiresAt:pendingContextualFollowThrough.expiresAt,rawAudioStored:false
       }}
      });
    }
   }else{
    roomSituationalAwareness.noteFeedback({
     participantId:contextualCandidate.participantId,
     topicKey:contextualCandidate.topicKey,eventType:'media-context',
     outcome:'neutral',weight:.2
    },outcomeAt);
    persistSituationalAwareness();
   }
   contextualOpportunityCandidates.delete(decision.opportunityId);
  }
  const outcome=proactiveGovernor.recordOutcome(decision,{executed,at:Date.now()});
  if(outcome)logRoomMessage('decision',outcome.reason,'agent-proactive-governor',{
   kind:'outcome',semantic:'agent-proactive-outcome',
   participantId:outcome.participantId,
   relatedEventId:decisionEvent?.id||decision.opportunity.relatedEventId||null
  });
  lastProactiveDecisionSignature='';
 }else if(decision.action==='cancel'&&signature!==lastProactiveDecisionSignature){
  lastProactiveDecisionSignature=signature;
  logRoomMessage('decision','Proactive opportunity cancelled · '+decision.reason,
   'agent-proactive-governor',{
    kind:'decision',semantic:'agent-proactive-abstain',
    participantId:decision.participantId,
    relatedEventId:decision.opportunity.relatedEventId||null
   });
 }
 renderCognitiveStatus();
}
function considerCognitiveObservation(event){
 if(state.mode!=='agent'||event.semantic!=='participant-observed')return;
 if(meetingUI?.activeMeeting()?.status==='active')return;
 const person=event.participantId?participantById(event.participantId):null;
 const track=event.participantId?publicRoomTracks().find(x=>
   x.participantId===event.participantId&&['matched','body-lock'].includes(x.status)):null;
 const now=Date.now();
 const interrupt=proactiveGovernor.interruptionGate({
  ...proactiveContext(now),participantId:person?.id||null,participant:null,
  respectEnabled:false
 });
 const decision=cognitiveLoop.evaluate(event,{
  participant:person,track,now,
  busy:Boolean(state.voice.vad||state.voice.processing||agentSpeechActive||
    state.voice.ttsPending>0||agentRuntime?.isBusy?.()),
  interruptionAllowed:interrupt.allow,interruptionReason:interrupt.reason
 });
 if(!decision)return;
 const decisionEvent=logRoomMessage('decision',decision.reason,'agent-cognitive-loop',{
  kind:'decision',semantic:'agent-engagement-decision',
  participantId:decision.participantId,relatedEventId:event.id
 });
 if(decision.action==='greet'){
  const executed=agentRuntime?.greet(track,person)===true;
  const result=cognitiveLoop.recordOutcome(decision,{executed,at:Date.now()});
  if(executed)proactiveGovernor.recordExternalInterruption({
   participantId:person?.id||null,type:'greeting',at:Date.now()
  });
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
const roomAcousticPatternTracker=new RoomAcousticPatternTracker();
const environmentalAudioQueue=new EnvironmentalAudioQueue();
const environmentalAudioTracker=new EnvironmentalClassificationTracker();
const environmentalEventGrouper=new EnvironmentalEventGrouper();
const environmentalActivityTracker=new EnvironmentalActivityTracker();
const roomSpeechOriginTracker=new RoomSpeechOriginTracker();
const musicIdentificationTracker=new MusicIdentificationTracker();
const musicRecognitionQueue=new MusicRecognitionQueue();
const musicLyricLookupGuard=new MusicLyricLookupGuard();
const mediaIdentificationTracker=new MediaIdentificationTracker();
const mediaRecognitionQueue=new MediaRecognitionQueue();
const mediaLookupGuard=new MediaLookupGuard();
const roomMediaFusionTracker=new RoomMediaFusionTracker();
const roomAudioIntelligence=new RoomAudioIntelligenceCoordinator();
const roomLiveValidation=new RoomLiveValidationTracker();
const roomMediaContinuity=new RoomMediaContinuityTracker();
const roomContextualCognition=new RoomContextualCognitionTracker();
const longSessionAutonomyMonitor=new LongSessionAutonomyMonitor({startedAt:Date.now()});
let roomSituationalAwareness=new RoomSituationalAwarenessTracker();
let roomContextPlanner=new RoomContextPlanner();
const contextualOpportunityCandidates=new Map();
let pendingSituationalEngagement=null,pendingContextualFollowThrough=null;
let lastSituationalMediaKey='',lastSituationalMediaAt=0;
const environmentalAlertTracker=new EnvironmentalAlertTracker();
const environmentalMechanicalTracker=new EnvironmentalMechanicalTracker();
const personalizedSoundRecognitionTracker=new PersonalizedSoundRecognitionTracker();
let importantEnvironmentalEventsEnabled=true;
let personalizedSoundsEnabled=false;
let personalizedSoundProfiles=[];
let latestLearnableSound=null;
let musicIdentificationEnabled=true;
let musicLyricWebLookupEnabled=false;
let musicFingerprintLookupEnabled=false;
let musicFingerprintAbortController=null;
const musicFingerprintProvider=createAcrCloudMusicProvider({
 ownerEnabled:()=>musicFingerprintLookupEnabled
});
let musicRecognitionState='idle';
let musicRecognitionDecision='Waiting for stable music';
let musicWorkingLyricQuery='';
let musicLyricWebAbortController=null;
let musicRecognitionGeneration=0;
let mediaIdentificationEnabled=true;
let mediaWebLookupEnabled=false;
let mediaRecognitionDecision='Waiting for recorded TV / video / radio / podcast speech';
let mediaWorkingDialogueQuery='';
let mediaWorkingVisualClue='';
let mediaWebAbortController=null;
let mediaRecognitionGeneration=0;
let environmentalFeedback=[];
let routineFeedback=[],routineCandidates=[],routineLastDeviation=null,routineHistoryRows=[];
let environmentalAudioClassifier=null;
let environmentalAudioState='off',environmentalAudioLast=null,environmentalAudioCurrentGroup=null;
const environmentalSpeechEvidenceWaiters=new Map();
let environmentalSpeechEvidenceSequence=0;
function createEnvironmentalSpeechEvidenceRequest(){
 const id='speech-env-'+Date.now().toString(36)+'-'+(++environmentalSpeechEvidenceSequence).toString(36);
 let settle;
 const promise=new Promise(resolve=>{settle=resolve;});
 const timer=setTimeout(()=>{
  const waiter=environmentalSpeechEvidenceWaiters.get(id);
  if(!waiter)return;
  environmentalSpeechEvidenceWaiters.delete(id);
  waiter.resolve(null);
 },900);
 environmentalSpeechEvidenceWaiters.set(id,{
  resolve:value=>{clearTimeout(timer);settle(value);}
 });
 return Object.freeze({id,promise});
}
function resolveEnvironmentalSpeechEvidence(id,value=null){
 if(!id)return false;
 const waiter=environmentalSpeechEvidenceWaiters.get(id);
 if(!waiter)return false;
 environmentalSpeechEvidenceWaiters.delete(id);
 waiter.resolve(value);return true;
}
function clearEnvironmentalSpeechEvidence(){
 for(const [id,waiter] of environmentalSpeechEvidenceWaiters){
  environmentalSpeechEvidenceWaiters.delete(id);waiter.resolve(null);
 }
}
let environmentalAudioDecision='Disabled by owner';
let environmentalAudioLastErrorAt=-Infinity;
let analyzeAmbientPatterns=false,advancedRoomMappingEnabled=false;
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
async function refreshEnvironmentalFeedback(){
 try{environmentalFeedback=await listEnvironmentalFeedback();}
 catch(error){console.warn('Environmental feedback unavailable',error);environmentalFeedback=[];}
 renderEnvironmentalAudio();
 return environmentalFeedback;
}

function effectiveRoutineEvents(){
 if(!saveRoomHistory)return roomLedger.project().events.filter(event=>event?.participantId);
 const byId=new Map();
 for(const event of [...routineHistoryRows,...roomHistory]){
  if(event?.id)byId.set(event.id,event);
 }
 return projectRoomState([...byId.values()]).events.filter(event=>event?.participantId);
}
function renderRoutineInsights(){
 const mount=document.getElementById('roomRoutineInsights');
 const status=document.getElementById('roomRoutineStatus');
 if(!mount||!status)return;
 mount.replaceChildren();
 if(!routineCandidates.length){
  status.textContent=saveRoomHistory
   ?'No recurring routine candidate has enough canonical evidence yet.'
   :'No recurring routine candidate this session. Enable ROOM history saving to learn across sessions.';
  return;
 }
 const confirmed=routineCandidates.filter(row=>row.status==='confirmed').length;
 status.textContent=routineCandidates.length+' candidate'+
  (routineCandidates.length===1?'':'s')+' · '+confirmed+' confirmed'+
  (routineLastDeviation?' · '+routineLastDeviation:'');
 for(const routine of routineCandidates){
  const card=document.createElement('article');card.className='room-temporal-entry';
  const title=document.createElement('strong');title.textContent=routineLabel(routine);
  const meta=document.createElement('span');
  meta.textContent=routine.status.toUpperCase()+' · '+routine.occurrences+
   ' observations across '+routine.distinctDays+' days · review metadata only · no Agent Memory';
  const actions=document.createElement('div');actions.className='room-spatial-actions';
  for(const [label,outcome] of [['Confirm','confirmed'],['Reject','rejected'],['Revoke','revoked']]){
   const button=document.createElement('button');button.type='button';button.textContent=label;
   button.disabled=routine.status===outcome;
   button.addEventListener('click',()=>void recordRoutineOwnerFeedback(routine.id,outcome));
   actions.append(button);
  }
  card.append(title,meta,actions);mount.append(card);
 }
}
async function refreshRoutineInsights({reloadFeedback=true}={}){
 try{
  if(reloadFeedback)routineFeedback=await listRoutineFeedback();
  routineCandidates=Array.from(deriveRoutineCandidates(
   effectiveRoutineEvents(),routineFeedback,Date.now()
  ));
 }catch(error){
  console.warn('Routine intelligence unavailable',error);
  routineCandidates=[];
 }
 renderRoutineInsights();
 return routineCandidates;
}
async function recordRoutineOwnerFeedback(routineId,outcome){
 try{
  const record=normalizeRoutineFeedback({routineId,outcome,at:Date.now()});
  await saveRoutineFeedback(record);
  await refreshRoutineInsights({reloadFeedback:true});
  logRoomMessage('decision',
   'Owner '+(outcome==='confirmed'?'confirmed':outcome==='rejected'?'rejected':'revoked')+
    ' observed routine · no Agent Memory created',
   'owner-routine-review',{semantic:'routine-owner-review'});
  return true;
 }catch(error){
  console.warn('Routine review save failed',error);return false;
 }
}
function updateRoutineDeviation(event){
 if(!event?.participantId||!routineCandidates.length)return;
 const matches=routineCandidates.filter(row=>row.status==='confirmed'&&
  row.participantId===event.participantId&&row.semantic===event.semantic);
 if(!matches.length)return;
 const results=matches.map(routine=>({routine,result:routineDeviation(routine,event,Date.now())}))
  .filter(row=>Number.isFinite(row.result.distanceMinutes))
  .sort((a,b)=>a.result.distanceMinutes-b.result.distanceMinutes);
 const nearestRow=results[0]||null;
 const nearest=nearestRow?.result;
 routineLastDeviation=nearest?.state==='outside-baseline-window'
  ?'latest matching observation outside prior timing baseline'
  :null;
 if(nearestRow?.routine?.status==='confirmed'&&nearest?.state==='outside-baseline-window'){
  const now=Date.now();
  const signal=routineProactiveOpportunity({
   routine:nearestRow.routine,deviation:nearest,event,now
  });
  if(signal){
   const opportunity=proactiveOpportunity({
    ...signal,eligibleAt:now+30000,expiresAt:now+10*60*1000
   },now,proactiveGovernor.policy);
   proactiveGovernor.offer(opportunity);
   renderCognitiveStatus();
  }
 }
 renderRoutineInsights();
}
async function recordEnvironmentalOwnerFeedback(event,outcome){
 const feedback=environmentalFeedbackFromRoomEvent(event,outcome,Date.now());
 if(!feedback)return false;
 try{
  await saveEnvironmentalFeedback(feedback);
  await refreshEnvironmentalFeedback();
  logRoomMessage('system',
   'Owner '+(outcome==='confirmed'?'confirmed':'marked incorrect')+
   ' environmental classification · '+feedback.subtype.replaceAll('-',' '),
   'owner-environment-feedback',{
    semantic:'environmental-feedback',
    relatedEventId:event.id
   });
  return true;
 }catch(error){
  console.warn('Environmental feedback save failed',error);return false;
 }
}
function renderEnvironmentalAudio(){
 if(state.mode!=='agent')return;
 const status=document.getElementById('roomEnvironmentalAudioStatus');
 const result=document.getElementById('roomEnvironmentalAudioResult');
 const current=document.getElementById('roomEnvironmentalCurrent');
 const feedbackStatus=document.getElementById('roomEnvironmentalFeedbackStatus');
 const snapshot=environmentalAudioQueue.snapshot();
 const currentGroup=environmentalEventGrouper.current(Date.now());
 environmentalAudioCurrentGroup=currentGroup;
 if(status){
  const stateLabel=environmentalAudioState==='off'?'OFF':
   environmentalAudioState==='loading'?'LOADING MODEL':
   environmentalAudioState==='ready'?'READY':
   environmentalAudioState==='error'?'UNAVAILABLE':'STANDBY';
  status.textContent=stateLabel+' · '+environmentalAudioDecision+
   (snapshot.enabled?' · queue '+snapshot.queueDepth+(snapshot.processing?' + processing':''):'');
 }
 if(result){
  result.textContent=environmentalAudioLast
   ? environmentalV2Message(environmentalAudioLast)
   : 'No approved environmental classification this session.';
 }
 if(current){
  current.textContent=currentGroup
   ?(currentGroup.current?'Current grouped event: ':'Last grouped event: ')+
    currentGroup.subtype.replaceAll('-',' ')+' · '+currentGroup.observationCount+
    ' observation'+(currentGroup.observationCount===1?'':'s')+' · '+
    Math.round(currentGroup.currentConfidence*100)+'% decayed confidence · source '+
    currentGroup.sourceDirection
   :'No current grouped environmental event.';
 }
 if(feedbackStatus)feedbackStatus.textContent='Owner calibration feedback: '+
  environmentalFeedback.length+' record'+(environmentalFeedback.length===1?'':'s')+'.';
}
async function ensureEnvironmentalAudioClassifier(){
 if(environmentalAudioClassifier?.ready){
  environmentalAudioState='ready';environmentalAudioDecision='Local classifier ready';
  renderEnvironmentalAudio();return true;
 }
 if(!environmentalAudioClassifier)environmentalAudioClassifier=new LocalEnvironmentalAudioClassifier();
 environmentalAudioState='loading';
 environmentalAudioDecision='Downloading / initializing pinned local model; no room audio is uploaded';
 renderEnvironmentalAudio();
 try{
  await environmentalAudioClassifier.init();
  if(!environmentalAudioQueue.snapshot().enabled)return false;
  environmentalAudioState='ready';
  environmentalAudioDecision='Local classifier ready';
  renderEnvironmentalAudio();return true;
 }catch(error){
  environmentalAudioState='error';
  environmentalAudioDecision='Classifier unavailable';
  renderEnvironmentalAudio();
  const now=Date.now();
  if(state.mode==='agent'&&now-environmentalAudioLastErrorAt>15000){
   environmentalAudioLastErrorAt=now;
   logRoomMessage('system','Environmental audio classifier unavailable · conversation audio continues normally',
    'environment-audio',{semantic:'environmental-classifier-unavailable'});
  }
  console.warn('Environmental audio classifier unavailable',error);
  return false;
 }
}
function reportEnvironmentalDrops(dropped=[]){
 if(!dropped.length)return;
 for(const item of dropped)resolveEnvironmentalSpeechEvidence(item?.work?.correlationId,null);
 if(state.mode!=='agent')return;
 environmentalAudioDecision='Discarded '+dropped.length+' stale/overflow classification window'+
  (dropped.length===1?'':'s');
 renderEnvironmentalAudio();
}
function personalizedSoundProfileId(){
 return globalThis.crypto?.randomUUID?.()
  ?'ps-'+globalThis.crypto.randomUUID()
  :'ps-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
}
function renderPersonalizedSounds(){
 if(state.mode!=='agent')return;
 const status=document.getElementById('roomPersonalizedSoundStatus');
 const list=document.getElementById('roomPersonalizedSoundProfiles');
 const teach=document.getElementById('roomTeachLatestSound');
 const ready=personalizedSoundProfiles.filter(profile=>profile.ready).length;
 const eligibility=personalizedSoundLearningEligibility({
  signature:latestLearnableSound?.signature,
  at:latestLearnableSound?.at,now:Date.now(),speechSensitive:false
 });
 if(status)status.textContent=(personalizedSoundsEnabled?'ON':'OFF')+' · '+
  personalizedSoundProfiles.length+' profile'+(personalizedSoundProfiles.length===1?'':'s')+
  ' · '+ready+' recognition-ready'+
  (eligibility.allow?' · latest: '+String(latestLearnableSound?.modelHint||'unclassified sound'):'');
 if(teach)teach.disabled=!personalizedSoundsEnabled||!eligibility.allow;
 if(!list)return;
 list.replaceChildren();
 for(const profile of personalizedSoundProfiles){
  const row=document.createElement('div');row.className='room-temporal-entry';
  const label=document.createElement('strong');label.textContent=profile.label;
  const meta=document.createElement('span');
  meta.textContent=profile.examples.length+' / 5 examples · '+
   (profile.ready?'READY':'needs '+Math.max(0,2-profile.examples.length)+' more example'+
    (2-profile.examples.length===1?'':'s'));
  const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';
  remove.addEventListener('click',async()=>{
   if(!window.confirm('Delete personalized sound profile “'+profile.label+'”?'))return;
   try{
    await deletePersonalizedSoundProfile(profile.id);
    await refreshPersonalizedSoundProfiles();
    personalizedSoundRecognitionTracker.reset();
   }catch(error){console.warn('Unable to delete personalized sound profile',error);}
  });
  row.append(label,meta,remove);list.append(row);
 }
 if(!personalizedSoundProfiles.length){
  const empty=document.createElement('small');
  empty.textContent='No owner-labeled sounds yet. Enable learning, make the sound, then label the latest sound.';
  list.append(empty);
 }
}
async function refreshPersonalizedSoundProfiles(){
 try{personalizedSoundProfiles=await listPersonalizedSoundProfiles();}
 catch(error){console.warn('Personalized sound profiles unavailable',error);personalizedSoundProfiles=[];}
 renderPersonalizedSounds();return personalizedSoundProfiles;
}
function resetPersonalizedSoundRuntime(){
 latestLearnableSound=null;personalizedSoundRecognitionTracker.reset();
 renderPersonalizedSounds();
}
function logPersonalizedSoundMatch(result){
 if(!result?.emit||state.mode!=='agent')return null;
 const match=result.match||{},profile=match.profile;
 if(!profile)return null;
 return logRoomMessage('audio',personalizedSoundMessage(result),
  'personalized-sound-runtime',{
   semantic:'personalized-sound-recognized',
   confidence:Number(match.similarity)||null,
   dedupeKey:'personalized-sound:'+profile.id+':'+Date.now(),
   evidence:{personalizedSound:{
    profileId:profile.id,label:profile.label,
    similarity:Number(match.similarity)||0,
    exampleCount:profile.examples.length,
    ownerLabeled:true,localOnly:true,rawAudioStored:false
   }}
  });
}
function evaluatePersonalizedSound(signature,{
 classification=null,speechSensitive=false,at=Date.now()
}={}){
 if(!personalizedSoundsEnabled||!signature||speechSensitive)
  return {matched:false,reason:speechSensitive?'speech-sensitive-window':'disabled-or-missing'};
 if(classification&&!personalizedSoundCategoryEligible(classification))
  return {matched:false,reason:'category-reserved-for-canonical-handler'};
 latestLearnableSound={
  signature,at,modelHint:String(classification?.modelLabel||'unclassified sound').slice(0,96)
 };
 const match=matchPersonalizedSound(signature,personalizedSoundProfiles);
 const tracked=personalizedSoundRecognitionTracker.observe(match,Date.now());
 if(tracked.emit)logPersonalizedSoundMatch(tracked);
 renderPersonalizedSounds();return match;
}
async function teachLatestPersonalizedSound(){
 if(!personalizedSoundsEnabled)return false;
 const eligibility=personalizedSoundLearningEligibility({
  signature:latestLearnableSound?.signature,at:latestLearnableSound?.at,now:Date.now()
 });
 if(!eligibility.allow){renderPersonalizedSounds();return false;}
 const raw=window.prompt('Label this sound (for example: Coffee grinder or Garage door):');
 const label=String(raw||'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,48);
 if(label.length<2)return false;
 const now=Date.now();
 const existing=personalizedSoundProfiles.find(profile=>
  profile.label.toLowerCase()===label.toLowerCase());
 const next=existing
  ?appendPersonalizedSoundExample(existing,latestLearnableSound.signature,now)
  :createPersonalizedSoundProfile({
    id:personalizedSoundProfileId(),label,
    signature:latestLearnableSound.signature,at:now
   });
 try{
  await savePersonalizedSoundProfile(next);
  latestLearnableSound=null;personalizedSoundRecognitionTracker.reset();
  await refreshPersonalizedSoundProfiles();
  logRoomMessage('system','Owner labeled a local sound profile · '+next.label+
   ' · '+next.examples.length+' example'+(next.examples.length===1?'':'s')+
   (next.ready?' · recognition ready':' · one more example recommended'),
   'owner-sound-learning',{semantic:'personalized-sound-profile-updated'});
  return true;
 }catch(error){
  console.warn('Unable to save personalized sound profile',error);return false;
 }
}

function logEnvironmentalAlertResult(result,classification){
 if(!result?.accepted||!result.emit||state.mode!=='agent')return null;
 const event=result.event||{};
 const agentNotice=environmentalAlertAgentNotice(result);
 return recordProactiveSourceEvent('audio',environmentalAlertMessage(result),
  'environmental-alert-runtime',{
   at:event.at||classification?.at||Date.now(),
   semantic:'environmental-alert',
   confidence:Number(event.peakConfidence)||Number(classification?.confidence)||null,
   dedupeKey:'environment-alert:'+String(event.key||'sound')+':'+
    String(event.observationCount||1)+':'+String(event.firstAt||event.at||Date.now()),
   evidence:{
    durationMs:classification?.durationMs||null,
    environmentalAlert:{
     key:event.key||null,label:event.label||null,severity:event.severity||'info',
     modelLabel:event.modelLabel||classification?.modelLabel||null,
     observationCount:Number(event.observationCount)||1,
     sourceDirection:event.sourceDirection||'unavailable',
     proactiveEligible:result.proactiveEligible===true,
     agentNotice:agentNotice||null,
     sourceVerified:false,emergencyConfirmed:false,observableOnly:true
    }
   }
  });
}
function logEnvironmentalMechanicalTransition(event){
 if(!event||state.mode!=='agent')return null;
 return logRoomMessage('audio',environmentalMechanicalMessage(event),
  'environmental-mechanical-runtime',{
   at:event.at,semantic:'environmental-mechanical-state',
   confidence:Number(event.peakConfidence)||null,
   dedupeKey:'environment-mechanical:'+event.key+':'+event.type+':'+
    event.startedAt+':'+event.at,
   evidence:{environmentalMechanical:{
    type:event.type,modelLabel:event.modelLabel,
    observationCount:event.observationCount,
    observedDurationMs:event.observedDurationMs,
    sourceVerified:false,observableOnly:true
   }}
  });
}
async function processEnvironmentalAudioWork(work){
 let outcome='classified';
 if(!environmentalAudioQueue.current(work,Date.now())){
  resolveEnvironmentalSpeechEvidence(work?.correlationId,null);
  environmentalAudioQueue.complete(work,'cancelled');renderEnvironmentalAudio();return;
 }
 try{
  const ready=await ensureEnvironmentalAudioClassifier();
  if(!ready||!environmentalAudioQueue.current(work,Date.now())){
   outcome='cancelled';return;
  }
  const detail=await environmentalAudioClassifier.classify(work.samples,{topK:8});
  const personalizedSignature=personalizedSoundsEnabled
   ?acousticFeatureSignature(work.samples,{sampleRate:work.sampleRate,at:work.queuedAt})
   :null;
  const sameSegmentMediaCue=recordedMediaCueFromPredictions(detail.predictions,work.queuedAt);
  if(!environmentalAudioQueue.current(work,Date.now())){
   resolveEnvironmentalSpeechEvidence(work.correlationId,{
    mediaCue:sameSegmentMediaCue,classification:null,completedAt:detail.completedAt
   });
   outcome='cancelled';return;
  }
  const normalized=normalizeEnvironmentalV2Predictions(detail.predictions,{
   modelId:detail.modelId,modelRevision:detail.modelRevision,
   at:work.queuedAt,durationMs:work.durationMs,audioSource:work.audioSource
  });
  if(!normalized.accepted){
   resolveEnvironmentalSpeechEvidence(work.correlationId,{
    mediaCue:sameSegmentMediaCue,classification:null,completedAt:detail.completedAt
   });
   const speechSensitive=normalized.reason==='speech-or-sensitive-filtered';
   const personalized=evaluatePersonalizedSound(personalizedSignature,{
    classification:null,speechSensitive,at:work.queuedAt
   });
   environmentalAudioDecision=personalized.matched
    ?'Owner-labeled personalized sound recognized locally'
    :speechSensitive?'Speech / unsupported sensitive model label filtered'
    :normalized.reason.replaceAll('-',' ');
   renderEnvironmentalAudio();return;
  }
  const classification=calibrateEnvironmentalClassification(
   normalized.classification,environmentalFeedback
  );
  resolveEnvironmentalSpeechEvidence(work.correlationId,{
   mediaCue:classification.recordedMediaCue||sameSegmentMediaCue,
   classification,completedAt:detail.completedAt
  });
  environmentalAudioLast=classification;
  environmentalAudioDecision='V2 environmental event classified locally';
  // Preserve the bounded V2 grouping for burst events and owner feedback.
  // Long-lived music/media/room-voice states use a separate lifecycle tracker so
  // the ROOM feed reports start / continuing / no-longer-detected instead of spam.
  const legacyEmission=environmentalAudioTracker.observe(classification,Date.now());
  const grouped=environmentalEventGrouper.observe(classification,Date.now());
  const activity=environmentalActivityTracker.observe(classification,Date.now());
  const personalized=evaluatePersonalizedSound(personalizedSignature,{
   classification,at:work.queuedAt
  });
  const important=importantEnvironmentalEventsEnabled&&!personalized.matched
   ?environmentalAlertTracker.observe(classification,Date.now())
   :{accepted:false,emit:false,proactiveEligible:false,event:null};
  const mechanical=importantEnvironmentalEventsEnabled&&!personalized.matched
   ?environmentalMechanicalTracker.observe(classification,Date.now())
   :{accepted:false,transitions:[]};
  environmentalAudioCurrentGroup=grouped.group;
  renderEnvironmentalAudio();
  let specialized=personalized.matched===true;
  if(important.accepted){
   specialized=true;
   if(important.emit)logEnvironmentalAlertResult(important,classification);
  }
  if(mechanical.accepted){
   specialized=true;
   for(const transition of mechanical.transitions)logEnvironmentalMechanicalTransition(transition);
  }
  if(activity.persistent){
   for(const transition of activity.transitions)
    logEnvironmentalActivityTransition(transition,grouped.group);
  }else{
   const emit=grouped.reason==='new-group'?legacyEmission.emit:grouped.emit;
   if(!specialized&&emit&&grouped.group&&state.mode==='agent'){
    logRoomMessage('audio',environmentalV2Message(classification),
     'local-audioset-c38c005',{
      at:classification.at,semantic:'environmental-audio-classification-v2',
      confidence:classification.confidence,
      dedupeKey:'environment-v2:'+grouped.group.id+':'+grouped.group.observationCount,
      evidence:{
       durationMs:classification.durationMs,
       environmental:{
        category:classification.category,subtype:classification.subtype,
        modelLabel:classification.modelLabel,groupId:grouped.group.id,
        observationCount:grouped.group.observationCount,
        sourceDirection:grouped.group.sourceDirection,
        rawConfidence:classification.rawConfidence??classification.confidence,
        calibratedConfidence:classification.confidence,
        observableOnly:true,healthInference:'none'
       }
      }
     });
   }
  }
 }catch(error){
  resolveEnvironmentalSpeechEvidence(work?.correlationId,null);
  outcome='error';
  environmentalAudioState='error';
  environmentalAudioDecision='Classification failed; conversation audio unaffected';
  renderEnvironmentalAudio();
  const now=Date.now();
  if(state.mode==='agent'&&now-environmentalAudioLastErrorAt>15000){
   environmentalAudioLastErrorAt=now;
   logRoomMessage('system','Environmental audio classification failed · no source label recorded',
    'environment-audio',{semantic:'environmental-classifier-error'});
  }
  console.warn('Environmental audio classification failed',error);
 }finally{
  resolveEnvironmentalSpeechEvidence(work?.correlationId,null);
  environmentalAudioQueue.complete(work,outcome);
  void drainEnvironmentalAudioQueue();
 }
}
function drainEnvironmentalAudioQueue(){
 const snapshot=environmentalAudioQueue.snapshot();
 if(!snapshot.enabled||snapshot.processing)return;
 const next=environmentalAudioQueue.beginNext(Date.now());
 reportEnvironmentalDrops(next.dropped);
 if(!next.work){renderEnvironmentalAudio();return;}
 void processEnvironmentalAudioWork(next.work);
}
function queueEnvironmentalAudio(segment){
 const performancePolicy=devicePerformanceGovernor.snapshot().policy;
 if(!performancePolicy.environmentalAudioAllowed){
  environmentalAudioDecision='Paused by device performance policy; conversation audio continues';
  renderEnvironmentalAudio();return false;
 }
 if(!['ready','loading'].includes(environmentalAudioState)||document.hidden)return false;
 const queued=environmentalAudioQueue.enqueue(segment,Date.now());
 reportEnvironmentalDrops(queued.dropped);
 renderEnvironmentalAudio();
 if(queued.accepted)drainEnvironmentalAudioQueue();
 return queued.accepted;
}
function renderRoomLiveValidation(){
 if(state.mode!=='agent')return;
 const status=document.getElementById('roomLiveValidationStatus');
 if(!status)return;
 status.textContent=roomLiveValidationMessage(roomLiveValidation.snapshot(Date.now()));
}
function noteRoomProviderOutcome(provider,status,reason=''){
 const at=Date.now();
 roomLiveValidation.observeProvider({provider,status,reason,at});
 if(status==='failed'||status==='error')longSessionAutonomyMonitor.note('provider-failure',{provider,reason},at);
 else if(status==='recovered'||status==='success'||status==='ok')longSessionAutonomyMonitor.note('provider-recovery',{provider},at);
 renderRoomLiveValidation();renderAutonomyCertificationStatus();
}

function renderRoomMediaContinuity(){
 if(state.mode!=='agent')return;
 const status=document.getElementById('roomMediaContinuityStatus');
 if(!status)return;
 const snapshot=roomMediaContinuity.snapshot();
 const current=snapshot.active||snapshot.suspended;
 if(!current){
  status.textContent='Background continuity · idle';
  return;
 }
 const label=current.kind==='music'?'music':
  current.kind==='television'?'TV / video':
  current.kind==='radio'?'radio / podcast':
  current.kind==='video-game'?'video game':'recorded media';
 status.textContent='Background continuity · '+label+' · '+current.status+
  ' · '+current.resumes+' resumes · '+current.interruptions+' interruptions';
}
function logRoomMediaContinuity(result,at=Date.now()){
 renderRoomMediaContinuity();
 if(!result?.emit||state.mode!=='agent')return null;
 const message=roomMediaContinuityMessage(result);
 if(!message)return null;
 const row=result.continuity||{};
 return logRoomMessage('media',message,'room-media-continuity',{
  at,semantic:'room-media-continuity',
  dedupeKey:'room-media-continuity:'+result.transition+':'+
   String(row.continuityId||'none')+':'+String(row.identityKey||'none')+
   ':'+Math.floor(at/5000),
  evidence:{roomMediaContinuity:{
   schema:row.schema,continuityId:row.continuityId,status:row.status,
   kind:row.kind,startedAt:row.startedAt,lastAt:row.lastAt,
   suspendedAt:row.suspendedAt,resumeDeadline:row.resumeDeadline,
   lowLevelSessionId:row.lowLevelSessionId,
   interruption:row.interruption,interruptions:row.interruptions,
   resumes:row.resumes,contentChanges:row.contentChanges,
   identity:row.identity,participantId:null,rawAudioStored:false
  }}
 });
}

function renderRoomAudioIntelligence(){
 if(state.mode!=='agent')return;
 const status=document.getElementById('roomAudioIntelligenceStatus');
 if(!status)return;
 const current=roomAudioIntelligence.snapshot();
 if(current.status==='idle'){
  status.textContent='Unified ROOM audio · idle · waiting for stable background audio';
  return;
 }
 const identity=current.identity;
 const name=identity
  ?(current.kind==='music'
    ?[identity.artist,identity.title].filter(Boolean).join(' — ')
    :identity.series&&identity.title&&identity.series!==identity.title
      ?identity.series+' · '+identity.title:(identity.title||identity.series||''))
  :'';
 status.textContent='Unified ROOM audio · '+current.kind.replaceAll('-',' ')+' · '+
  current.status+(name?' · '+name:'')+' · '+current.observations+' observations';
}
function logRoomAudioIntelligence(result,at=Date.now()){
 renderRoomAudioIntelligence();
 if(!result?.emit||state.mode!=='agent')return null;
 const message=roomAudioIntelligenceMessage(result);
 if(!message)return null;
 const current=result.state||{};
 return logRoomMessage('audio',message,'room-audio-intelligence',{
  at,semantic:'room-audio-intelligence',
  confidence:Number(current.confidence)||null,
  dedupeKey:'room-audio-intelligence:'+result.transition+':'+
   String(current.sessionId||'none')+':'+String(current.identityKey||'none'),
  evidence:{roomAudioIntelligence:{
   schema:current.schema,status:current.status,sessionId:current.sessionId,
   kind:current.kind,startedAt:current.startedAt,lastAt:current.lastAt,
   observations:current.observations,sourceDirection:current.sourceDirection,
   identity:current.identity,provider:current.provider,reason:current.reason,
   participantId:null
  }}
 });
}
function observeRoomAudioIdentity(identity,at=Date.now()){
 const result=roomAudioIntelligence.observeIdentity(identity,at);
 const continuity=roomMediaContinuity.observeBackground(result,at);
 logRoomMediaContinuity(continuity,at);
 logRoomAudioIntelligence(result,at);
 return result;
}

function logEnvironmentalActivityTransition(transition,group=null){
 if(!transition||state.mode!=='agent')return null;
 if(transition.type==='stop'&&mediaKindForEnvironmentalState(transition))
  roomMediaFusionTracker.reset();
 if(transition.category==='music'&&transition.type==='stop'){
  const stopped=musicIdentificationTracker.clearConfirmed(transition.at);
  logMusicIdentificationResult(stopped);
  musicRecognitionQueue.clear();musicWorkingLyricQuery='';
  musicRecognitionDecision='Music stopped · waiting for next track';
  renderMusicIdentification();
 }
 if(transition.category==='media-playback'&&transition.type==='stop'){
  const stopped=mediaIdentificationTracker.clearConfirmed(transition.at);
  logMediaIdentificationResult(stopped);
  mediaRecognitionQueue.clear();mediaWorkingDialogueQuery='';mediaWorkingVisualClue='';
  mediaRecognitionDecision='Recorded media stopped · waiting for next program';
  renderMediaIdentification();
 }
 observeAudioMediaDeviceContext(transition);
 const unified=roomAudioIntelligence.observeEnvironmental(transition,transition.at||Date.now());
 roomLiveValidation.observeBackground(unified,transition.at||Date.now());
 renderRoomLiveValidation();
 const continuity=roomMediaContinuity.observeBackground(unified,transition.at||Date.now());
 logRoomMediaContinuity(continuity,transition.at||Date.now());
 logRoomAudioIntelligence(unified,transition.at||Date.now());
 const lifecycle=transition.type==='stop'?'environmental-audio-state':
  'environmental-audio-classification-v2';
 return logRoomMessage('audio',environmentalActivityMessage(transition),
  'local-audioset-c38c005',{
   at:transition.at,semantic:lifecycle,
   confidence:transition.peakConfidence,
   dedupeKey:'environment-activity:'+transition.key+':'+transition.type+':'+
    transition.startedAt+':'+transition.at,
   evidence:{
    durationMs:transition.observedDurationMs,
    environmental:{
     category:transition.category,subtype:transition.subtype,
     modelLabel:transition.modelLabel,groupId:group?.id||null,
     observationCount:transition.observationCount,
     sourceDirection:transition.sourceDirection,
     rawConfidence:transition.peakConfidence,
     calibratedConfidence:transition.peakConfidence,
     observableOnly:true,healthInference:'none'
    }
   }
  });
}
function setEnvironmentalAudioEnabled(enabled){
 if(enabled){
  clearEnvironmentalSpeechEvidence();
  environmentalAudioQueue.enable(Date.now());
  environmentalAudioTracker.reset();
  environmentalEventGrouper.reset();
  environmentalActivityTracker.reset();
  roomMediaFusionTracker.reset();
  roomAudioIntelligence.reset('environmental-audio-enabled');
  roomLiveValidation.reset();
  roomMediaContinuity.reset();
  contextualOpportunityCandidates.clear();
  renderRoomAudioIntelligence();
  renderRoomLiveValidation();
  renderRoomMediaContinuity();
  environmentalAlertTracker.reset();
  environmentalMechanicalTracker.reset();
  resetPersonalizedSoundRuntime();
  roomSpeechOriginTracker.reset();
  environmentalAudioLast=null;environmentalAudioCurrentGroup=null;
  environmentalAudioState='loading';
  environmentalAudioDecision='Basic ROOM environmental awareness enabled';
  renderEnvironmentalAudio();
  void refreshEnvironmentalFeedback();
  void ensureEnvironmentalAudioClassifier();
 }else{
  environmentalAudioQueue.disable();
  clearEnvironmentalSpeechEvidence();
  resetMusicIdentification('Environmental audio disabled');
  resetMediaIdentification('Environmental audio disabled');
  environmentalAudioTracker.reset();
  environmentalEventGrouper.reset();
  environmentalAlertTracker.reset();
  environmentalMechanicalTracker.reset();
  resetPersonalizedSoundRuntime();
  // Disabling the sensor does not prove that music/TV/voices stopped.
  environmentalActivityTracker.reset();
  roomMediaFusionTracker.reset();
  roomAudioIntelligence.reset('environmental-audio-disabled');
  roomLiveValidation.reset();
  roomMediaContinuity.reset();
  contextualOpportunityCandidates.clear();
  renderRoomAudioIntelligence();
  renderRoomLiveValidation();
  renderRoomMediaContinuity();
  roomSpeechOriginTracker.reset();
  environmentalAudioLast=null;environmentalAudioCurrentGroup=null;
  environmentalAudioState='off';
  environmentalAudioDecision='Disabled by owner';
  renderEnvironmentalAudio();
 }
}
function remoteProviderPreference(){
 const selected=String(document.getElementById('agentModelProvider')?.value||'').toLowerCase();
 if(['openai','anthropic'].includes(selected))return selected;
 try{
  const saved=String(window.localStorage.getItem('tracky2-agent-provider')||'').toLowerCase();
  if(['openai','anthropic'].includes(saved))return saved;
 }catch{}
 return 'auto';
}
function renderMusicIdentification(){
 if(state.mode!=='agent')return;
 const status=document.getElementById('roomMusicIdStatus');
 const result=document.getElementById('roomMusicIdResult');
 const queue=musicRecognitionQueue.snapshot();
 const track=musicIdentificationTracker.snapshot();
 if(status)status.textContent=(musicIdentificationEnabled?'ON':'OFF')+
  ' · ACRCloud '+(musicFingerprintLookupEnabled?'ON':'OFF')+
  ' · lyric web '+(musicLyricWebLookupEnabled?'ON':'OFF')+' · '+
  musicRecognitionDecision+(queue.processing?' · analyzing':'')+
  (queue.queueDepth?' · '+queue.queueDepth+' queued':'');
 if(result){
  if(track.status==='confirmed')
   result.textContent='Identified: '+track.artist+' — '+track.title+
    (track.album?' · '+track.album:'');
  else if(track.status==='candidate')
   result.textContent='Candidate: '+track.artist+' — '+track.title+' · verifying';
  else if(musicWorkingLyricQuery)
   result.textContent='Local lyric clue ready for candidate search · working text is memory-only';
  else result.textContent='No exact track identified this session.';
 }
}
function logMusicIdentificationResult(result){
 if(result?.track?.status==='confirmed'&&['confirmed','track-changed'].includes(result.transition)){
  observeRoomAudioIdentity({
   kind:'music',title:result.track.title,artist:result.track.artist,
   album:result.track.album,confidence:result.track.confidence,
   provider:result.track.provider,at:Date.now()
  },Date.now());
 }
 if(!result?.emit||state.mode!=='agent')return;
 const message=musicIdentificationMessage(result);
 if(!message)return;
 const track=result.track||{};
 logRoomMessage('media',message,'music-identification',{
  semantic:'music-identification',
  confidence:Number(track.confidence)||null,
  dedupeKey:'music-id:'+result.transition+':'+
   String(track.artist||'unknown')+':'+String(track.title||'unknown')+':'+Date.now(),
  evidence:{musicIdentification:{
   status:track.status||null,title:track.title||null,artist:track.artist||null,
   album:track.album||null,provider:track.provider||null,
   externalId:track.externalId||null,observations:Number(track.observations)||0,
   sourceUrls:Array.from(track.sourceUrls||[]).slice(0,5)
  }}
 });
}
async function processMusicRecognitionWork(job){
 let outcome='complete';
 const generation=job.generation;
 const current=()=>generation===musicRecognitionGeneration&&musicIdentificationEnabled;
 try{
  musicRecognitionState='analyzing';
  musicRecognitionDecision=musicFingerprintLookupEnabled
   ?'Trying ACRCloud exact music recognition'
   :'ACRCloud exact recognition is off · trying local lyric fallback';
  renderMusicIdentification();

  let fingerprint=Object.freeze({available:false,candidate:null,reason:'disabled'});
  if(musicFingerprintLookupEnabled&&job.remoteExactEligible){
   musicFingerprintAbortController?.abort();
   musicFingerprintAbortController=new AbortController();
   try{
    fingerprint=await identifyMusicFingerprint(musicFingerprintProvider,{
     samples:job.samples,sampleRate:job.sampleRate,durationMs:job.durationMs,at:job.at,
     evidenceId:job.evidenceId,signal:musicFingerprintAbortController.signal
    });
   }catch(error){
    if(error?.name==='AbortError'){outcome='cancelled';return;}
    noteRoomProviderOutcome('acrcloud','failure',String(error?.message||'recognition-error'));
    const status=Number(error?.status);
    musicRecognitionDecision=status===409
     ?'ACRCloud credentials are not configured · continuing with local lyric fallback'
     :status===403
      ?'ACRCloud recognition unavailable · provider permission required'
      :'ACRCloud recognition failed safely · continuing with local lyric fallback';
    console.warn('ACRCloud music recognition failed',error);
   }finally{
    musicFingerprintAbortController=null;
   }
   if(!current()){outcome='cancelled';return;}
   if(fingerprint.candidate){
    noteRoomProviderOutcome('acrcloud','success','candidate');
    const observed=musicIdentificationTracker.observeCandidate(fingerprint.candidate,Date.now());
    logMusicIdentificationResult(observed);
    musicRecognitionDecision=observed.track.status==='confirmed'
     ?'Track confirmed by ACRCloud evidence'
     :'ACRCloud candidate received · waiting for corroboration';
    if(observed.track.status==='confirmed'){
     musicWorkingLyricQuery='';renderMusicIdentification();return;
    }
   }else if(fingerprint.available&&fingerprint.reason==='no-match'){
    musicRecognitionDecision='ACRCloud found no match · trying local lyric fallback';
   }
  }

  if(musicFingerprintLookupEnabled&&!job.remoteExactEligible&&!fingerprint.candidate){
   musicRecognitionDecision='ACRCloud audio skipped · live-room speech may be present';
  }

  if(job.lyricEligible){
   const ready=await ensureTranscriptionEngine();
   if(ready){
    const detail=await state.voice.transcriber.transcribeDetailed(job.samples);
    if(!current()){outcome='cancelled';return;}
    const lyric=musicIdentificationTracker.noteLyrics(detail.text,Date.now());
    musicWorkingLyricQuery=lyric.usable?lyric.query:'';
    if(lyric.usable&&musicLyricWebLookupEnabled&&job.remoteLyricEligible){
     const lookup=musicLyricLookupGuard.claim(lyric.query,Date.now());
     if(lookup.allow){
      musicRecognitionDecision='Searching public web with a short lyric clue';
      renderMusicIdentification();
      musicLyricWebAbortController?.abort();
      musicLyricWebAbortController=new AbortController();
      try{
       const resolved=await searchMusicByLyricClue({
        query:lyric.query,evidenceId:job.evidenceId,
        ownerEnabled:true,preferredProvider:remoteProviderPreference(),
        signal:musicLyricWebAbortController.signal
       });
       if(!current()){outcome='cancelled';return;}
       if(resolved.candidate){
        noteRoomProviderOutcome('music-web','success','candidate');
        const observed=musicIdentificationTracker.observeCandidate(
         resolved.candidate,Date.now()
        );
        logMusicIdentificationResult(observed);
        musicRecognitionDecision=observed.track.status==='confirmed'
         ?'Track confirmed from corroborated lyric/web evidence'
         :'Web lyric candidate received · waiting for another independent clue';
       }else{
        musicRecognitionDecision='Public web search found no strong song candidate';
       }
      }catch(error){
       if(error?.name==='AbortError'){outcome='cancelled';return;}
       noteRoomProviderOutcome('music-web','failure',String(error?.message||'lookup-error'));
       const status=Number(error?.status);
       musicRecognitionDecision=status===409
        ?'Remote lyric lookup unavailable · OpenAI provider not configured'
        :status===403
          ?'Remote lyric lookup unavailable · provider permission required'
          :'Remote lyric lookup failed safely · local music detection continues';
       console.warn('Music lyric web lookup failed',error);
      }finally{
       musicLyricWebAbortController=null;
      }
     }else{
      musicRecognitionDecision=lookup.reason==='duplicate-lyric-clue'
       ?'Repeated lyric clue skipped · waiting for a different music window'
       :'Lyric web lookup cooling down';
     }
    }else{
     musicRecognitionDecision=lyric.usable
      ?(musicLyricWebLookupEnabled&&job.remoteLyricEligible
        ?'Local lyric clue captured'
        :musicLyricWebLookupEnabled
          ?'Local lyric clue captured · web lookup held for mixed live/recorded speech'
          :'Local lyric clue captured · remote lyric lookup is off')
      :'No usable lyric clue in this music window';
    }
   }else{
    musicRecognitionDecision='Local lyric transcription unavailable';
   }
  }else if(!fingerprint.candidate){
   musicRecognitionDecision=musicFingerprintLookupEnabled
    ?'No exact music match · live-room speech risk avoided'
    :'Music window retained no identity evidence · live-room speech risk avoided';
  }
 }catch(error){
  outcome='error';
  musicRecognitionState='error';
  musicRecognitionDecision='Music identification window failed safely';
  console.warn('Music identification failed',error);
 }finally{
  musicRecognitionQueue.complete(job);
  if(current()){
   if(outcome!=='error')musicRecognitionState='idle';
   renderMusicIdentification();
   void drainMusicRecognitionQueue();
  }
 }
}
function drainMusicRecognitionQueue(){
 if(musicRecognitionQueue.snapshot().processing)return;
 const job=musicRecognitionQueue.beginNext();
 if(!job){renderMusicIdentification();return;}
 void processMusicRecognitionWork(job);
}
function queueMusicRecognitionWindow(segment,{classification=null,speechOrigin=null,behaviorPolicy=null}={}){
 if(!musicIdentificationEnabled||!segment?.samples?.length)return false;
 const mediaKind=speechOrigin?.mediaContext?.kind||null;
 const primaryMusic=classification?.category==='music';
 if(!primaryMusic&&mediaKind!=='music')return false;
 const durationMs=Number(segment.captureDurationMs)||
  Math.max(0,Number(segment.endedAt||0)-Number(segment.startedAt||0));
 const policy=behaviorPolicy||roomAudioBehaviorPolicy({
  background:roomAudioIntelligence.snapshot(),speechOrigin
 });
 const lyricEligible=Boolean(primaryMusic&&speechOrigin?.state!=='live');
 const remoteLyricEligible=Boolean(policy.allowRemoteDialogueLookup);
 // Remote exact recognition requires V2A to positively classify the sound as recorded.
 const remoteExactEligible=Boolean(speechOrigin?.state==='recorded');
 const queued=musicRecognitionQueue.enqueue({
  category:'music',durationMs,sampleRate:Number(segment.sampleRate)||16000,
  samples:segment.samples,at:Number(segment.queuedAt)||Date.now(),
  lyricEligible,remoteLyricEligible,remoteExactEligible,
  evidenceId:String(segment.segmentId||('music-'+Date.now())).slice(0,96),
  generation:musicRecognitionGeneration,documentHidden:document.hidden
 },Date.now());
 if(queued.accepted){
  musicRecognitionDecision=remoteExactEligible
   ?(lyricEligible
     ?'Music window queued · ACRCloud exact match then local lyric fallback'
     :'Music window queued · ACRCloud exact match only')
   :'Music window queued · remote exact match held because live-room speech may be present';
  renderMusicIdentification();drainMusicRecognitionQueue();return true;
 }
 return false;
}
function resetMusicIdentification(reason='Waiting for stable music'){
 musicRecognitionGeneration++;
 musicFingerprintAbortController?.abort();musicFingerprintAbortController=null;
 musicLyricWebAbortController?.abort();musicLyricWebAbortController=null;
 musicRecognitionQueue.clear();musicIdentificationTracker.reset();
 musicLyricLookupGuard.reset();
 musicWorkingLyricQuery='';musicRecognitionState='idle';musicRecognitionDecision=reason;
 renderMusicIdentification();
}

function mediaKindForEnvironmentalState(row={}){
 if(row.category==='music')return 'music';
 if(row.category==='media-playback'&&row.subtype==='television')return 'television';
 if(row.category==='media-playback'&&row.subtype==='media-playback')return 'recorded-media';
 return null;
}
function logRoomMediaFusion(fusion,at=Date.now()){
 const tracked=roomMediaFusionTracker.observe(fusion,at);
 if(!tracked.emit||state.mode!=='agent')return tracked;
 const message=roomMediaFusionMessage(fusion);
 if(!message)return tracked;
 logRoomMessage('media',message,'room-media-fusion',{
  at,semantic:'room-media-fusion',confidence:Number(fusion.confidence)||null,
  dedupeKey:'room-media-fusion:'+fusion.state+':'+String(fusion.objectId||'unmapped')+
   ':'+String(fusion.mediaKind||'unknown')+':'+Math.floor(at/30000),
  evidence:{roomMediaFusion:{
   state:fusion.state,mediaKind:fusion.mediaKind,objectId:fusion.objectId,
   objectName:fusion.objectName,objectRole:fusion.objectRole,
   objectAudioDirection:fusion.objectAudioDirection,
   audioDirection:fusion.audioDirection,audioConfidence:fusion.audioConfidence,
   visualConfidence:fusion.visualConfidence,agreement:fusion.agreement,
   sourceVerified:fusion.sourceVerified,reason:fusion.reason
  }}
 });
 return tracked;
}
function observeAudioMediaDeviceContext(transition){
 const mediaKind=mediaKindForEnvironmentalState(transition);
 if(!mediaKind||!['start','continue'].includes(transition?.type))return null;
 const fusion=fuseRoomMediaEvidence({
  scene:effectiveRoomScene(),mediaKind,
  audioDirection:transition.sourceDirection,
  audioConfidence:transition.peakConfidence
 });
 logRoomMediaFusion(fusion,transition.at||Date.now());
 return fusion;
}

function mediaResultLabel(media={}){
 if(['episode','podcast-episode'].includes(media.kind)){
  const series=media.series||media.title||'Unknown series';
  const episode=media.title&&media.title!==series?' · '+media.title:'';
  const code=media.kind==='episode'&&media.season&&media.episode
   ?' · S'+media.season+'E'+media.episode:'';
  return series+episode+code;
 }
 if(media.kind==='radio-show'){
  return (media.series||media.title||'Unknown radio show')+
   (media.title&&media.series&&media.title!==media.series?' · '+media.title:'');
 }
 return media.title||media.series||'Unknown media';
}
function renderMediaIdentification(){
 if(state.mode!=='agent')return;
 const status=document.getElementById('roomMediaIdStatus');
 const result=document.getElementById('roomMediaIdResult');
 const queue=mediaRecognitionQueue.snapshot();
 const media=mediaIdentificationTracker.snapshot();
 if(status)status.textContent=(mediaIdentificationEnabled?'ON':'OFF')+
  ' · web '+(mediaWebLookupEnabled?'ON':'OFF')+' · '+mediaRecognitionDecision+
  (queue.processing?' · analyzing':'')+(queue.queueDepth?' · '+queue.queueDepth+' queued':'');
 if(result){
  if(media.status==='confirmed')result.textContent='Identified: '+mediaResultLabel(media)+
   (media.service?' · '+media.service:'');
  else if(media.status==='candidate')result.textContent='Candidate: '+mediaResultLabel(media)+' · verifying';
  else if(mediaWorkingDialogueQuery)result.textContent='Recorded dialogue clue ready · working text is memory-only';
  else if(mediaWorkingVisualClue)result.textContent='Visual metadata clue ready · no camera frame was uploaded';
  else result.textContent='No exact TV / movie / streaming / radio / podcast title identified this session.';
 }
}
function logMediaIdentificationResult(result){
 if(result?.media?.status==='confirmed'&&['confirmed','content-changed'].includes(result.transition)){
  observeRoomAudioIdentity({
   kind:result.media.kind,title:result.media.title,series:result.media.series,
   season:result.media.season,episode:result.media.episode,
   confidence:result.media.confidence,provider:result.media.provider,at:Date.now()
  },Date.now());
 }
 if(!result?.emit||state.mode!=='agent')return;
 const message=mediaIdentificationMessage(result);
 if(!message)return;
 const media=result.media||{};
 logRoomMessage('media',message,'media-identification',{
  semantic:'media-identification',
  confidence:Number(media.confidence)||null,
  dedupeKey:'media-id:'+result.transition+':'+String(media.kind||'unknown')+':'+
   String(media.series||'')+':'+String(media.title||'unknown')+':'+Date.now(),
  evidence:{mediaIdentification:{
   status:media.status||null,kind:media.kind||null,title:media.title||null,
   series:media.series||null,season:media.season||null,episode:media.episode||null,
   year:media.year||null,service:media.service||null,provider:media.provider||null,
   observations:Number(media.observations)||0,
   sourceUrls:Array.from(media.sourceUrls||[]).slice(0,5)
  }}
 });
}
async function processMediaRecognitionWork(job){
 let outcome='complete';
 const generation=job.generation;
 const current=()=>generation===mediaRecognitionGeneration&&mediaIdentificationEnabled;
 try{
  mediaRecognitionDecision='Transcribing a bounded recorded-media dialogue window locally';
  renderMediaIdentification();
  const ready=await ensureTranscriptionEngine();
  if(!ready){mediaRecognitionDecision='Local recorded-media transcription unavailable';return;}
  const detail=await state.voice.transcriber.transcribeDetailed(job.samples);
  if(!current()){outcome='cancelled';return;}
  const clue=mediaIdentificationTracker.noteDialogue(detail.text,Date.now());
  mediaWorkingDialogueQuery=clue.usable?clue.query:'';
  if(!clue.usable){
   mediaRecognitionDecision='No usable recorded dialogue clue in this window';return;
  }
  if(!mediaWebLookupEnabled){
   mediaRecognitionDecision='Recorded dialogue clue captured · remote media lookup is off';return;
  }
  const lookup=mediaLookupGuard.claim('dialogue:'+clue.query,Date.now());
  if(!lookup.allow){
   mediaRecognitionDecision=lookup.reason==='duplicate-clue'
    ?'Repeated media clue skipped · waiting for different dialogue'
    :'Media web lookup cooling down';
   return;
  }
  mediaRecognitionDecision='Searching public web with a short recorded-dialogue clue';
  renderMediaIdentification();
  mediaWebAbortController?.abort();
  mediaWebAbortController=new AbortController();
  const resolved=await searchMediaByClues({
   dialogueQuery:clue.query,visualClue:mediaWorkingVisualClue,
   mediaKind:job.mediaKind,evidenceId:job.evidenceId,
   ownerEnabled:true,preferredProvider:remoteProviderPreference(),
   signal:mediaWebAbortController.signal
  });
  if(!current()){outcome='cancelled';return;}
  if(resolved.candidate){
   noteRoomProviderOutcome('media-web','success','candidate');
   const observed=mediaIdentificationTracker.observeCandidate(resolved.candidate,Date.now());
   logMediaIdentificationResult(observed);
   mediaRecognitionDecision=observed.media.status==='confirmed'
    ?'Recorded media title confirmed from corroborated evidence'
    :'Media candidate received · waiting for another independent clue';
  }else mediaRecognitionDecision='Public web search found no strong media candidate';
 }catch(error){
  if(error?.name==='AbortError'){outcome='cancelled';return;}
  noteRoomProviderOutcome('media-web','failure',String(error?.message||'lookup-error'));
  outcome='error';
  const status=Number(error?.status);
  mediaRecognitionDecision=status===409
   ?'Remote media lookup unavailable · no configured OpenAI or Anthropic provider'
   :status===403
    ?'Remote media lookup unavailable · provider permission required'
    :'Media identification failed safely · recorded-media detection continues';
  console.warn('Media identification failed',error);
 }finally{
  mediaWebAbortController=null;
  mediaRecognitionQueue.complete(job);
  if(current()){
   renderMediaIdentification();
   void drainMediaRecognitionQueue();
  }
 }
}
function drainMediaRecognitionQueue(){
 if(mediaRecognitionQueue.snapshot().processing)return;
 const job=mediaRecognitionQueue.beginNext();
 if(!job){renderMediaIdentification();return;}
 void processMediaRecognitionWork(job);
}
function queueMediaRecognitionWindow(segment,{speechOrigin=null,behaviorPolicy=null}={}){
 if(!mediaIdentificationEnabled||!segment?.samples?.length)return false;
 const mediaKind=speechOrigin?.mediaContext?.kind||null;
 if(!['television','recorded-media','radio'].includes(mediaKind))return false;
 const policy=behaviorPolicy||roomAudioBehaviorPolicy({
  background:roomAudioIntelligence.snapshot(),speechOrigin
 });
 if(speechOrigin?.state!=='recorded')return false;
 if(!policy.allowRemoteDialogueLookup)return false;
 const durationMs=Number(segment.captureDurationMs)||
  Math.max(0,Number(segment.endedAt||0)-Number(segment.startedAt||0));
 const queued=mediaRecognitionQueue.enqueue({
  mediaKind,durationMs,sampleRate:Number(segment.sampleRate)||16000,
  samples:segment.samples,at:Number(segment.queuedAt)||Date.now(),
  evidenceId:String(segment.segmentId||('media-'+Date.now())).slice(0,96),
  generation:mediaRecognitionGeneration,documentHidden:document.hidden
 },Date.now());
 if(queued.accepted){
  mediaRecognitionDecision=mediaKind==='radio'
   ?'Recorded radio / podcast speech window queued for local transcription'
   :'Recorded TV / video dialogue window queued for local transcription';
  renderMediaIdentification();drainMediaRecognitionQueue();return true;
 }
 return false;
}
async function processMediaVisualClue(detail={}){
 if(!mediaIdentificationEnabled)return false;
 const active=environmentalActivityTracker.snapshot();
 const activeKind=active?.category==='media-playback'
  ?(active.subtype==='television'?'television':
    active.subtype==='radio'?'radio':
    active.subtype==='media-playback'?'recorded-media':null):null;
 if(!activeKind)return false;
 const evidenceId=String(detail.evidenceId||('visual-'+Date.now())).slice(0,96);
 const visualObservation=normalizeMediaVisualObservation({
  text:detail.text,objectId:detail.objectId,evidenceId,
  confidence:detail.confidence,at:Date.now()
 });
 if(!visualObservation){
  mediaRecognitionDecision='Visual media clue rejected · mapped display/device reference required';
  renderMediaIdentification();return false;
 }
 const fusion=fuseRoomMediaEvidence({
  scene:effectiveRoomScene(),mediaKind:activeKind,
  audioDirection:active.sourceDirection,audioConfidence:active.peakConfidence,
  visualObservation
 });
 logRoomMediaFusion(fusion,visualObservation.at);
 if(!mediaVisualLookupAllowed(fusion)){
  mediaRecognitionDecision=fusion.state==='audio-visual-owner-conflict'
   ?'Visual media clue held · audio direction conflicts with owner device map'
   :'Visual media clue held · owner-mapped media device could not be verified';
  renderMediaIdentification();return false;
 }
 const clue=mediaIdentificationTracker.noteVisual(visualObservation.text,Date.now());
 if(!clue.usable)return false;
 mediaWorkingVisualClue=clue.text;
 if(!mediaWebLookupEnabled){
  mediaRecognitionDecision='Verified visual metadata captured locally · remote media lookup is off';
  renderMediaIdentification();return true;
 }
 const lookup=mediaLookupGuard.claim('visual:'+clue.text,Date.now());
 if(!lookup.allow)return false;
 mediaWebAbortController?.abort();mediaWebAbortController=new AbortController();
 const generation=mediaRecognitionGeneration;
 try{
  mediaRecognitionDecision='Searching public web with owner-grounded visual media metadata';
  renderMediaIdentification();
  const mediaKind=activeKind;
  const resolved=await searchMediaByClues({
   dialogueQuery:'',visualClue:clue.text,mediaKind,evidenceId,
   ownerEnabled:true,preferredProvider:remoteProviderPreference(),
   signal:mediaWebAbortController.signal
  });
  if(generation!==mediaRecognitionGeneration||!mediaIdentificationEnabled)return false;
  if(resolved.candidate){
   const observed=mediaIdentificationTracker.observeCandidate(resolved.candidate,Date.now());
   logMediaIdentificationResult(observed);
   mediaRecognitionDecision=observed.media.status==='confirmed'
    ?'Media title confirmed with owner-grounded visual metadata'
    :'Visual media candidate received · waiting for corroboration';
  }else mediaRecognitionDecision='Visual metadata search found no strong media candidate';
  renderMediaIdentification();return true;
 }catch(error){
  if(error?.name!=='AbortError')console.warn('Visual media lookup failed',error);
  return false;
 }finally{
  mediaWebAbortController=null;
 }
}
function resetMediaIdentification(reason='Waiting for recorded TV / video / radio / podcast speech'){
 mediaRecognitionGeneration++;
 roomMediaFusionTracker.reset();
 mediaWebAbortController?.abort();mediaWebAbortController=null;
 mediaRecognitionQueue.clear();mediaIdentificationTracker.reset();mediaLookupGuard.reset();
 mediaWorkingDialogueQuery='';mediaWorkingVisualClue='';
 mediaRecognitionDecision=reason;renderMediaIdentification();
}

function saveRoomAudioSummary(summary){
 if(!summary||state.mode!=='agent')return;
 const ended=environmentalActivityTracker.expire(summary.at);
 if(ended)logEnvironmentalActivityTransition(ended);
 const unifiedEnded=roomAudioIntelligence.expire(summary.at);
 if(unifiedEnded){
  roomLiveValidation.observeBackground(unifiedEnded,summary.at);
  renderRoomLiveValidation();
  const continuityPaused=roomMediaContinuity.observeBackground(unifiedEnded,summary.at);
  logRoomMediaContinuity(continuityPaused,summary.at);
  logRoomAudioIntelligence(unifiedEnded,summary.at);
 }
 const continuityEnded=roomMediaContinuity.expire(summary.at);
 if(continuityEnded)logRoomMediaContinuity(continuityEnded,summary.at);
 const mechanicalEnded=environmentalMechanicalTracker.expire(summary.at);
 if(mechanicalEnded)logEnvironmentalMechanicalTransition(mechanicalEnded);
 // Raw dB/noise-floor audit remains diagnostic state; it does not spam the ROOM feed.
 if(analyzeAmbientPatterns){
  const pattern=describeAcousticPattern(summary);
  const tracked=roomAcousticPatternTracker.observe(pattern,summary.at);
  if(tracked.emit&&pattern)logRoomMessage('audio',pattern.description,pattern.source,{
   at:pattern.at,semantic:'acoustic-pattern',confidence:pattern.confidence,
   dedupeKey:'acoustic-pattern:'+pattern.pattern+':'+Math.floor(pattern.at/60000),
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
 const scene=effectiveRoomScene();
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
function noteAggregateRoomOccupancy(visibleTracks=[]){
 const count=Array.isArray(visibleTracks)?visibleTracks.filter(track=>
  !['occluded','reacquiring'].includes(String(track?.status||''))).length:0;
 if(lastRoomOccupancyCount===count)return;
 const previous=lastRoomOccupancyCount;lastRoomOccupancyCount=count;
 const message=count
  ?'ROOM occupancy'+(previous===null?'':' changed')+' · '+count+' '+(count===1?'person':'people')+' visible in the current camera view'
  :'ROOM occupancy'+(previous===null?'':' changed')+' · room appears empty in the current camera view';
 logRoomMessage('presence',message,'aggregate-camera-presence',{
  semantic:'room-occupancy',dedupeKey:'room-occupancy:'+count+':'+Date.now()
 });
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
  const filtered=roomHistory.slice(-90).reverse().filter(e=>!e?.participantId&&roomEventMatchesFilter(e,roomTimelineFilter));
 const count=document.getElementById('roomTimelineCount');
  if(count)count.textContent=filtered.length+' room event'+(filtered.length===1?'':'s')+' shown';
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
    ' · '+e.source+(e.roomId?' · room '+e.roomId:'')+
    (Number.isFinite(e.confidence)?' · '+Math.round(e.confidence*100)+'% confidence':'')+
    (Number.isFinite(duration)?' · '+Math.round(duration/1000)+'s measured':'')+
    (corrected?' · CORRECTED':'');
  item.append(time,heading,meta);
  if(e.kind!=='correction'&&!corrected){
   const environmental=e.semantic==='environmental-audio-classification-v2'&&
    Boolean(e.evidence?.environmental);
   if(environmental){
    const confirm=document.createElement('button');confirm.type='button';
    confirm.className='room-confirm-environment';confirm.textContent='Confirm event';
    confirm.setAttribute('aria-label','Confirm environmental event: '+e.message);
    confirm.addEventListener('click',()=>void recordEnvironmentalOwnerFeedback(e,'confirmed'));
    item.append(confirm);
   }
   const button=document.createElement('button');button.type='button';
   button.className='room-mark-incorrect';button.textContent='Mark incorrect';
   button.setAttribute('aria-label','Retract event: '+e.message);
   button.addEventListener('click',()=>{
    const reason=window.prompt('Correction reason (stored in your ROOM history):');
    if(!reason?.trim())return;
    if(environmental)void recordEnvironmentalOwnerFeedback(e,'incorrect');
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
   empty.textContent='ROOM activity appears here as the environment, shared audio and background systems change.';timeline.append(empty);
 }else if(!filtered.length){
  const empty=document.createElement('p');empty.className='dialogue-empty';
  empty.textContent='No ROOM events match this filter.';timeline.append(empty);
 }
}
function currentRoomIdentity(){
 const scene=sceneUI?.getScene?.()||emptyRoomScene();
 return {
  id:String(scene.roomIdentityId||'room-local').slice(0,96),
  name:String(scene.roomName||'Local room').slice(0,96)
 };
}
function effectiveRoomScene(){
 const scene=sceneUI?.getScene?.()||emptyRoomScene();
 if(advancedRoomMappingEnabled)return scene;
 return Object.freeze({...emptyRoomScene(),
  roomIdentityId:scene.roomIdentityId||'room-local',roomName:scene.roomName||'Local room'});
}
function roomNameForHandoff(id){
 const current=currentRoomIdentity();
 return id===current.id?current.name:id;
}

function renderMultiRoomRuntime(runtimeState=multiRoomRuntime?.state?.()){
 const status=document.getElementById('roomMultiNodeStatus');
 const list=document.getElementById('roomMultiNodeList');
 if(!status||!list)return;
 if(!runtimeState){
  status.textContent='Multi-room transport · local-only';
  list.textContent='No self-hosted room-node session.';
  return;
 }
 const transport=runtimeState.transport==='self-hosted'?'SELF-HOSTED':'LOCAL-ONLY';
 status.textContent='Multi-room transport · '+transport+
  ' · '+runtimeState.nodeCount+' live node'+(runtimeState.nodeCount===1?'':'s')+
  (runtimeState.nodeId?' · this '+runtimeState.nodeId:'')+
  (runtimeState.isPrimary?' · PRIMARY FOR ROOM':
   runtimeState.primaryNodeId?' · secondary · primary '+runtimeState.primaryNodeId:'')+
  (runtimeState.failures?' · relay errors '+runtimeState.failures:'');
 list.replaceChildren();
 const nodes=Array.from(runtimeState.nodes||[]);
 if(!nodes.length){
  list.textContent=runtimeState.transport==='self-hosted'
   ?'No healthy remote room nodes currently reported.'
   :'Sign in to the self-hosted Tracky2 runtime with room permissions to link room nodes.';
  return;
 }
 for(const node of nodes){
  const row=document.createElement('div');
  row.textContent=(node.roomName||node.roomId)+' · '+node.id+' · '+
   String(node.health?.state||'unknown').toUpperCase()+
   (node.id===runtimeState.primaryNodeId?' · PRIMARY':'');
  list.append(row);
 }
}

function applyRemoteRoomObservation(remote){
 if(!remote?.participantId||!participantById(remote.participantId))return false;
 const at=Number(remote.localNormalizedAt||remote.normalizedAt)||Date.now();
 if(remote.semantic==='room-handoff-declared'){
  if(!remote.fromRoomId||!remote.toRoomId)return false;
  const result=roomHandoffTracker.declareHandoff({
   participantId:remote.participantId,fromRoomId:remote.fromRoomId,
   toRoomId:remote.toRoomId,at,authority:remote.authority||'remote-owner'
  });
  addRoomObservation(roomObservation({
   id:remote.id,at,category:'decision',kind:'decision',
   semantic:'room-handoff-declared',
   message:roomHandoffMessage(result,roomNameForHandoff),
   source:'multi-room-node',deviceId:remote.nodeId,sessionId:roomSessionId,
   roomId:remote.roomId,participantId:remote.participantId
  },at));
  lastRoomHandoffState=result;renderRoomHandoffUi();
  return true;
 }
 if(remote.semantic==='room-departure-confirmed'){
  const result=roomHandoffTracker.declareDeparture({
   participantId:remote.participantId,roomId:remote.roomId,
   at,authority:remote.authority||'remote-owner'
  });
  addRoomObservation(roomObservation({
   id:remote.id,at,category:'decision',kind:'decision',
   semantic:'room-departure-confirmed',
   message:roomHandoffMessage(result,roomNameForHandoff),
   source:'multi-room-node',deviceId:remote.nodeId,sessionId:roomSessionId,
   roomId:remote.roomId,participantId:remote.participantId
  },at));
  lastRoomHandoffState=result;renderRoomHandoffUi();
  return true;
 }
 const message=remote.semantic==='participant-observed'
  ?'Remote room node observed enrolled participant'
  :'Remote room node reports participant out of camera view';
 return Boolean(addRoomObservation(roomObservation({
  id:remote.id,at,category:'presence',kind:'observation',
  semantic:remote.semantic,message,source:'multi-room-node',
  deviceId:remote.nodeId,sessionId:roomSessionId,roomId:remote.roomId,
  participantId:remote.participantId,
  evidence:{serverReceivedAt:remote.serverReceivedAt}
 },at)));
}

async function startMultiRoomRuntime(){
 if(state.mode!=='agent')return;
 const current=currentRoomIdentity();
 if(!multiRoomRuntime)multiRoomRuntime=new MultiRoomRuntimeClient({
  onRemoteObservation:applyRemoteRoomObservation,
  onState:renderMultiRoomRuntime
 });
 try{
  await multiRoomRuntime.start({
   nodeId:multiRoomNodeId(canonicalRuntimeInstanceId),
   roomId:current.id,roomName:current.name,
   runtimeInstanceId:canonicalRuntimeInstanceId
  });
 }catch(error){
  console.warn('Multi-room runtime unavailable; continuing local-only.',error);
  renderMultiRoomRuntime();
 }
}
function renderRoomHandoffUi(){
 if(state.mode!=='agent')return;
 const current=currentRoomIdentity();
 const currentEl=document.getElementById('roomHandoffCurrent');
 const status=document.getElementById('roomHandoffStatus');
 const list=document.getElementById('roomHandoffList');
 const select=document.getElementById('roomHandoffParticipant');
 if(currentEl)currentEl.textContent='Current room · '+current.name+' · '+current.id;
 if(select){
  const prior=select.value;select.replaceChildren(new Option('Choose enrolled participant',''));
  for(const person of state.identity.participants){
   select.add(new Option(person.nickname||person.name||person.id,person.id));
  }
  if(state.identity.participants.some(person=>person.id===prior))select.value=prior;
 }
 if(status)status.textContent=lastRoomHandoffState
  ? roomHandoffMessage(lastRoomHandoffState,roomNameForHandoff)
  : 'No explicit room handoff is active.';
 if(list){
  list.replaceChildren();
  const rows=roomHandoffTracker.snapshot();
  if(!rows.length){list.textContent='No enrolled participant has room-level handoff state yet.';return;}
  for(const row of rows){
   const person=participantById(row.participantId);
   const item=document.createElement('div');
   const label=person?.nickname||person?.name||'Participant';
   item.textContent=label+' · '+row.state+
    (row.currentRoomId?' · current '+roomNameForHandoff(row.currentRoomId):
     row.lastKnownRoomId?' · last known '+roomNameForHandoff(row.lastKnownRoomId):'')+
    (row.candidateRoomIds.length?' · candidates '+row.candidateRoomIds.map(roomNameForHandoff).join(' / '):'');
   list.append(item);
  }
 }
}
function emitRoomHandoffOutcome(result,sourceEvent){
 if(!result)return;
 lastRoomHandoffState=result;renderRoomHandoffUi();
 const notable={
  reentered:['presence','participant-reentered-room','inference'],
  'handoff-confirmed':['decision','room-handoff-confirmed','outcome'],
  'cross-room-unlinked':['decision','room-handoff-unlinked','inference'],
  'simultaneous-room-conflict':['decision','room-handoff-conflict','inference'],
  'observed-after-stale-gap':['presence','room-observed-after-stale-gap','observation']
 }[result.state];
 if(!notable)return;
 logRoomMessage(notable[0],roomHandoffMessage(result,roomNameForHandoff),'room-handoff',{
  kind:notable[2],semantic:notable[1],participantId:result.participantId,
  relatedEventId:sourceEvent?.id||null,
  roomId:sourceEvent?.roomId||currentRoomIdentity().id
 });
}
function updateRoomHandoffFromObservation(event){
 if(!event?.participantId||!event.roomId)return;
 let result=null;
 if(event.semantic==='participant-observed'){
  result=roomHandoffTracker.observe({
   participantId:event.participantId,roomId:event.roomId,at:event.at,source:event.source
  });
 }else if(event.semantic==='participant-out-of-view'){
  result=roomHandoffTracker.outOfView({
   participantId:event.participantId,roomId:event.roomId,at:event.at,source:event.source
  });
 }
 if(result)emitRoomHandoffOutcome(result,event);
}
function initRoomHandoffControls(){
 const form=document.getElementById('roomHandoffForm');
 const participant=document.getElementById('roomHandoffParticipant');
 const target=document.getElementById('roomHandoffTargetRoom');
 const depart=document.getElementById('roomHandoffDeparture');
 if(!form)return;
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const participantId=participant?.value||'',toRoomId=String(target?.value||'').trim();
  const current=currentRoomIdentity();
  if(!participantId||!toRoomId){
   lastRoomHandoffState=null;
   const status=document.getElementById('roomHandoffStatus');
   if(status)status.textContent='Choose a participant and destination room ID.';
   return;
  }
  try{
   const result=roomHandoffTracker.declareHandoff({
    participantId,fromRoomId:current.id,toRoomId,at:Date.now(),authority:'local-owner'
   });
   lastRoomHandoffState=result;renderRoomHandoffUi();
   logRoomMessage('decision',roomHandoffMessage(result,roomNameForHandoff),'owner-room-handoff',{
    kind:'decision',semantic:'room-handoff-declared',participantId,roomId:current.id
   });
   multiRoomRuntime?.publishObservation({
    semantic:'room-handoff-declared',participantId,roomId:current.id,
    fromRoomId:current.id,toRoomId,authority:'local-owner',at:Date.now()
   });
  }catch(error){
   const status=document.getElementById('roomHandoffStatus');
   if(status)status.textContent=error.message;
  }
 });
 depart?.addEventListener('click',()=>{
  const participantId=participant?.value||'',current=currentRoomIdentity();
  if(!participantId){
   const status=document.getElementById('roomHandoffStatus');
   if(status)status.textContent='Choose a participant before confirming departure.';
   return;
  }
  const result=roomHandoffTracker.declareDeparture({
   participantId,roomId:current.id,at:Date.now(),authority:'local-owner'
  });
  lastRoomHandoffState=result;renderRoomHandoffUi();
  logRoomMessage('decision',roomHandoffMessage(result,roomNameForHandoff),'owner-room-handoff',{
   kind:'decision',semantic:'room-departure-confirmed',participantId,roomId:current.id
  });
  multiRoomRuntime?.publishObservation({
   semantic:'room-departure-confirmed',participantId,roomId:current.id,
   authority:'local-owner',at:Date.now()
  });
 });
 renderRoomHandoffUi();
}

function noteAutonomyCertificationObservation(event){
 if(!event)return;
 const semantic=String(event.semantic||'');
 if(['participant-observed','participant-reentered-room','room-arrival-observed','room-departure-confirmed'].includes(semantic))
  longSessionAutonomyMonitor.note('participant-cycle',{},event.at||Date.now());
 if(semantic==='room-media-continuity'){
  const transition=String(event.evidence?.roomMediaContinuity?.status||'');
  longSessionAutonomyMonitor.note('media-transition',{transition},event.at||Date.now());
  if(String(event.evidence?.roomMediaContinuity?.interruption||'').includes('foreground-conversation'))
   longSessionAutonomyMonitor.note('conversation-over-media',{},event.at||Date.now());
 }
 if(semantic==='agent-proactive-outcome'&&/spoken|executed|success/i.test(String(event.message||'')))
  longSessionAutonomyMonitor.note('interruption',{},event.at||Date.now());
 if(semantic==='context-followthrough-expired')
  longSessionAutonomyMonitor.note('stale-followthrough',{},event.at||Date.now());
 const awareness=roomSituationalAwareness.snapshot();
 longSessionAutonomyMonitor.note('memory-bounds',{
  events:awareness.eventCount,feedback:awareness.feedbackCount
 },event.at||Date.now());
 renderAutonomyCertificationStatus();
}
function renderAutonomyCertificationStatus(){
 if(state.mode!=='agent')return;
 const mount=document.getElementById('roomAutonomyCertificationStatus');
 if(!mount)return;
 const result=longSessionAutonomyMonitor.certify(Date.now());
 mount.textContent=certificationLabel(result)+' · '+Math.round(result.snapshot.durationMs/60000)+
  ' min · '+result.failed.length+' gates pending/failed';
}

function addRoomObservation(observation){
 if(state.mode!=='agent'||!observation?.message)return;
 const current=currentRoomIdentity();
 const scoped=observation.roomId?observation:roomObservation({
  ...observation,roomId:current.id
 },observation.at);
 if(!scoped)return;
 const accepted=roomLedger.append(scoped);
 if(!accepted.added)return;
 noteAutonomyCertificationObservation(accepted.event);
 roomHistory=roomLedger.entries();renderRoomObservations();
 const situationalEvent=situationalEventFromRoomEvent(accepted.event);
 if(situationalEvent)persistSituationalAwareness();
 updateRoomHandoffFromObservation(accepted.event);
 updateRoutineDeviation(accepted.event);
 if(saveRoomHistory){
  routineHistoryRows=[
   ...routineHistoryRows.filter(row=>row?.id!==accepted.event.id),accepted.event
  ].sort((a,b)=>a.at-b.at).slice(-500);
 }
 if(accepted.event.participantId)void refreshRoutineInsights({reloadFeedback:false});
 considerCognitiveObservation(accepted.event);
 if(accepted.event.source!=='multi-room-node'&&
    ['participant-observed','participant-out-of-view'].includes(accepted.event.semantic)){
   multiRoomRuntime?.publishObservation({
    id:accepted.event.id,semantic:accepted.event.semantic,
    participantId:accepted.event.participantId,roomId:accepted.event.roomId,
    at:accepted.event.at
   });
 }
 if(saveRoomHistory&&storageHealth.optionalPersistence){
  const epoch=roomPrivacyEpoch,event=accepted.event;
  roomWrites=roomWrites.catch(()=>{}).then(()=>
   epoch===roomPrivacyEpoch&&storageHealth.optionalPersistence?saveRoomObservation(event):undefined
  ).catch(error=>console.warn('Room observation not saved:',error));
 }
 return accepted.event;
}
function logRoomMessage(category,message,source='runtime',options={}){
 return addRoomObservation(roomObservation({
  category,message,source,sessionId:roomSessionId,
  roomId:currentRoomIdentity().id,...options
 }));
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
    currentTranscriptState: 'idle',
    currentTranscriptSegmentId: null,
    currentTranscriptModelRevision: null,
    processing: false,
    micDb: -100,
    noiseFloorDb: -60,
    vad: false,
    turns: [],
    events: [],
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
    currentFusionState: 'unknown-speaker',
    currentFusionDecision: 'abstain',
    currentFusionConfidence: 0,
    currentFusionProvenance: [],
    currentFusionConflicts: [],
    currentFusionAbstentionReason: 'no-identity-authority',
    currentFusionTransition: null,
    currentDiarizationState: 'unknown',
    currentDiarizationSpeakerCount: 0,
    currentDiarizationOverlap: false,
    currentDiarizationReason: null,
    currentOverlapSeparationState: 'unavailable',
    currentOverlapSeparationQuality: 0,
    currentOverlapSeparationParticipantIds: [],
    currentOverlapSeparationReason: null,
    currentContinuousFusionState: 'unresolved',
    currentContinuousFusionParticipantIds: [],
    currentContinuousFusionConflicts: [],
    currentContinuousFusionUnresolvedWindows: 0,
    currentSpatialAudioState: 'source-unavailable',
    currentSpatialAudioDirection: 'unavailable',
    currentSpatialAudioConfidence: 0,
    currentSpatialAudioConflict: null,
    currentSpatialAudioMetric: false,
    inputChannelCount: 1,
    currentConversationAttention: 'unknown',
    currentConversationGroupSize: 1,
    currentConversationLabel: 'UNVERIFIED SPEAKER · SOLO',
    sessionId: canonicalSessionId,
    lastDecision: 'standby',
    rejectedSegments: 0,
    ttsPending: 0,
    captureMode: 'offline',
    generation: 0
  }
};

function reconcileLongSessionParticipantRefs(participantIds=[]){
 const ids=Array.from(participantIds||[]).map(String);
 const allowed=new Set(ids);
 state.voice.announcedParticipants=new Set(
  reconcileParticipantSet(state.voice.announcedParticipants,ids)
 );
 state.activity.seenParticipants=new Set(
  reconcileParticipantSet(state.activity.seenParticipants,ids)
 );
 state.activity.lastZones=new Map(
  reconcileParticipantMap(state.activity.lastZones,ids)
 );
 state.activity.events=state.activity.events
  .filter(event=>allowed.has(String(event.participantId||'')));
 state.voice.turns=Array.from(
  reconcileTransientDialogueTurns(state.voice.turns,ids,50)
 );
 continuousSpeakerFusionTracker.reconcile(ids);
 participantContinuity.reconcile(ids);
 multiRoomRuntime?.reconcileParticipants(ids);
 state.identity.tracks=state.identity.tracks.map(track=>
  track.participantId&&!allowed.has(String(track.participantId))
   ?{...track,participantId:null,participantName:null,similarity:0,
     status:track.face?'ready':'body-detected',identitySource:'participant-removed',
     continuityState:'removed',continuityParticipantId:null,continuityConfidence:0}
   :track
 );
 agentRuntime?.reconcileParticipants?.(ids);
 return {
  announcedParticipants:state.voice.announcedParticipants.size,
  seenParticipants:state.activity.seenParticipants.size,
  lastZones:state.activity.lastZones.size,
  turns:state.voice.turns.length
 };
}

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
 const heap=globalThis.performance?.memory;
 const heapRatio=heap?.jsHeapSizeLimit>0?heap.usedJSHeapSize/heap.jsHeapSizeLimit:null;
 const performanceSample=performanceSampleDelta({
  at:Date.now(),visible:!document.hidden,
  frameCount:runtime.frames,stallCount:runtime.stalls,
  meanFrameGapMs:runtime.meanFrameGapMs,maxFrameGapMs:runtime.maxFrameGapMs,
  meanScanMs:runtime.meanScanMs,maxScanMs:runtime.maxScanMs,
  audioQueueDepth:listeningController.snapshot().queueDepth,
  heapRatio,storageRatio:storageHealth.ratio
 },lastDevicePerformanceRuntime);
 lastDevicePerformanceRuntime={
  at:Date.now(),visible:!document.hidden,frameCount:runtime.frames,stallCount:runtime.stalls,
  meanFrameGapMs:runtime.meanFrameGapMs,maxFrameGapMs:runtime.maxFrameGapMs,
  meanScanMs:runtime.meanScanMs,maxScanMs:runtime.maxScanMs,
  audioQueueDepth:listeningController.snapshot().queueDepth,heapRatio,storageRatio:storageHealth.ratio
 };
 const devicePerformance=devicePerformanceGovernor.observe(performanceSample);
 longSessionAutonomyMonitor.note('performance',{level:devicePerformance.level},Date.now());
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
  ' · '+runtime.stalls+' stalls · '+runtime.meanScanMs+'ms scan avg · audio queue '+runtime.audioQueueMax+
  ' · device '+devicePerformance.level.toUpperCase()+
  ' · scan ×'+devicePerformance.policy.identityScanMultiplier;
 const cRetry=cameraRecovery.snapshot(),mRetry=microphoneRecovery.snapshot();
 if(cameraRetry)cameraRetry.textContent=(cameraRecoveryPending?'Pending · ':'Idle · ')+
  cRetry.attempts+'/'+cRetry.maxAttempts+' attempts in window';
 if(microphoneRetry)microphoneRetry.textContent=(microphoneRecoveryPending?'Pending · ':'Idle · ')+
  mRetry.attempts+'/'+mRetry.maxAttempts+' attempts in window';
 renderAutonomyCertificationStatus();
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
  const meetingEntry=agent&&ui.gameMode.value==='meeting';
  document.body.classList.toggle('agent-mode',agent);
  document.body.classList.toggle('meeting-mode',meetingEntry);
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
    proactiveGovernor.forgetRemovedParticipants(participantIds);
    memoryUI?.refreshParticipants();
    meetingUI?.refreshParticipants();
    recallUI?.refreshParticipants();
    workflowUI?.refresh();
    roomHandoffTracker.reconcileParticipants(participantIds);
    reconcileLongSessionParticipantRefs(participantIds);
    renderRoomHandoffUi();
    const currentSpeaker=state.voice.currentSpeakerId
      ? state.identity.participants.find(p=>p.id===state.voice.currentSpeakerId)
      : null;
    if(state.voice.currentSpeakerId&&(!currentSpeaker||currentSpeaker.voiceRecognitionEnabled===false)){
      state.voice.currentSpeakerId=null;
      state.voice.currentSpeakerName=null;
      state.voice.currentVoiceConfidence=0;
      state.voice.currentBodyLock=false;
      state.voice.currentGroupId=null;
      state.voice.currentAssociationState='unknown-speaker';
      state.voice.currentAssociationProvenance=[
       currentSpeaker?'voice-recognition-disabled':'participant-record-unavailable'
      ];
      state.voice.currentAssociationTransition=null;
      state.voice.currentFusionState='unknown-speaker';
      state.voice.currentFusionDecision='abstain';
      state.voice.currentFusionConfidence=0;
      state.voice.currentFusionProvenance=['signal-rejected'];
      state.voice.currentFusionConflicts=[];
      state.voice.currentFusionAbstentionReason='signal-rejected';
      state.voice.currentFusionTransition=null;
      state.voice.currentDiarizationState='unknown';
      state.voice.currentDiarizationSpeakerCount=0;
      state.voice.currentDiarizationOverlap=false;
      state.voice.currentDiarizationReason='signal-rejected';
      state.voice.currentOverlapSeparationState='unavailable';
      state.voice.currentOverlapSeparationQuality=0;
      state.voice.currentOverlapSeparationParticipantIds=[];
      state.voice.currentOverlapSeparationReason='signal-rejected';
      state.voice.currentContinuousFusionState='unresolved';
      state.voice.currentContinuousFusionParticipantIds=[];
      state.voice.currentContinuousFusionConflicts=[];
      state.voice.currentContinuousFusionUnresolvedWindows=0;
      state.voice.currentConversationAttention='unknown';
      state.voice.currentConversationGroupSize=1;
      state.voice.currentConversationLabel='UNVERIFIED SPEAKER · SOLO';
      speakerAssociationTracker.reset();
      multimodalFusionTracker.reset();
      diarizationSession.reset();
      continuousSpeakerFusionTracker.reset();
      renderVoiceHud();
    }
    refreshPlayerChoices();
    if(!state.identity.participants.length){ui.multiplayerSetupStatus.textContent='No enrolled participants on this site in this browser. Open Participants, save a profile and return to Games.';}
  } catch (error) {
    console.error(error);
    state.identity.participants = [];
    roomHandoffTracker.reconcileParticipants([]);
    reconcileLongSessionParticipantRefs([]);
    renderRoomHandoffUi();
    state.voice.currentSpeakerId=null;
    state.voice.currentSpeakerName=null;
    state.voice.currentVoiceConfidence=0;
    state.voice.currentBodyLock=false;
    state.voice.currentGroupId=null;
    state.voice.currentAssociationState='unknown-speaker';
    state.voice.currentAssociationProvenance=['participant-store-unavailable'];
    state.voice.currentAssociationTransition=null;
    state.voice.currentFusionState='unknown-speaker';
    state.voice.currentFusionDecision='abstain';
    state.voice.currentFusionConfidence=0;
    state.voice.currentFusionProvenance=['speaker-unverified'];
    state.voice.currentFusionConflicts=[];
    state.voice.currentFusionAbstentionReason='no-identity-authority';
    state.voice.currentFusionTransition=null;
    state.voice.currentDiarizationState='unknown';
    state.voice.currentDiarizationSpeakerCount=0;
    state.voice.currentDiarizationOverlap=false;
    state.voice.currentDiarizationReason=null;
    state.voice.currentOverlapSeparationState='unavailable';
    state.voice.currentOverlapSeparationQuality=0;
    state.voice.currentOverlapSeparationParticipantIds=[];
    state.voice.currentOverlapSeparationReason=null;
    state.voice.currentContinuousFusionState='unresolved';
    state.voice.currentContinuousFusionParticipantIds=[];
    state.voice.currentContinuousFusionConflicts=[];
    state.voice.currentContinuousFusionUnresolvedWindows=0;
    state.voice.currentSpatialAudioState='source-unavailable';
    state.voice.currentSpatialAudioDirection='unavailable';
    state.voice.currentSpatialAudioConfidence=0;
    state.voice.currentSpatialAudioConflict=null;
    state.voice.currentSpatialAudioMetric=false;
    state.voice.currentConversationAttention='unknown';
    state.voice.currentConversationGroupSize=1;
    state.voice.currentConversationLabel='UNVERIFIED SPEAKER · SOLO';
    speakerAssociationTracker.reset();
    multimodalFusionTracker.reset();
    diarizationSession.reset();
    continuousSpeakerFusionTracker.reset();
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
  if(track.continuityState==='owner-corrected')return 'OWNER-CORRECTED IDENTITY';
  if(track.continuityState==='voice-recovered')return 'VOICE + BODY RECOVERY';
  if(track.identitySource==='continuity-short-carry')return 'CONTINUITY RECOVERY';
  if(track.continuityState==='verification-required')return 'REENTRY · VERIFY IDENTITY';
  if(track.continuityState==='ambiguous')return 'IDENTITY AMBIGUOUS';
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
  } else if(track.continuityState==='owner-corrected'){
    detail.textContent='Owner-corrected identity · current track';
  } else if(track.continuityState==='voice-recovered'){
    detail.textContent='Verified voice + body association recovered identity';
  } else if(track.identitySource==='continuity-short-carry'){
    detail.textContent='Recent verified identity · fragmented body track recovered';
  } else if(track.continuityState==='verification-required'){
    const candidate=participantById(track.continuityParticipantId);
    detail.textContent='Prior '+(candidate?.name||'participant')+
      ' candidate · face or voice verification required';
  } else if(track.continuityState==='ambiguous'){
    detail.textContent='Multiple continuity candidates · identity not assigned';
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

  card.append(top, body);

  // AGENT participant cards stop at the verified Voice Profile/input meter.
  // Detailed diagnostic rows and duplicate saved-photo data belong outside this compact sidebar.
  if (state.mode !== 'agent') {
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
    card.append(voiceData);
  }

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

  if(state.mode==='agent'&&(track.participantId||track.visitorLabel||
     ['new','body-detected','ready','reacquiring'].includes(track.status))){
    const correction=document.createElement('select');
    correction.className='participant-identity-correction';
    correction.setAttribute('aria-label','Correct identity for '+(track.participantName||track.visitorLabel||track.id));
    const choose=document.createElement('option');choose.value='';choose.textContent='Correct identity…';
    correction.append(choose);
    if(track.participantId){
      const clear=document.createElement('option');clear.value='__clear__';clear.textContent='Clear identity';
      correction.append(clear);
    }
    for(const person of state.identity.participants.filter(person=>person.recognitionEnabled!==false)){
      const option=document.createElement('option');option.value=person.id;
      option.textContent='Assign '+(person.nickname||person.name);
      correction.append(option);
    }
    correction.addEventListener('change',()=>{
      const value=correction.value;
      correction.value='';
      if(value)correctTrackIdentity(track,value==='__clear__'?null:value);
    });
    actions.append(correction);
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
  if(state.mode==='agent')noteAggregateRoomOccupancy(state.running?visible:[]);
  if(state.mode==='agent'&&state.running){
   for(const event of roomPresence.update(visible,Date.now()))addRoomObservation(event);
   const scene=effectiveRoomScene();
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
    ? 'AudioWorklet · '+state.voice.inputChannelCount+'ch'
    : state.voice.captureMode === 'script-processor-fallback'
      ? 'Compatibility · '+state.voice.inputChannelCount+'ch'
      : 'Offline';
  if(ui.roomAudioSource){
    const sourceLabel=String(state.voice.currentSpatialAudioState||'source-unavailable')
      .replaceAll('-',' ').toUpperCase();
    const direction=String(state.voice.currentSpatialAudioDirection||'unavailable').toUpperCase();
    ui.roomAudioSource.textContent=sourceLabel+' · '+direction+
      (state.voice.currentSpatialAudioConfidence
       ?' · '+Math.round(state.voice.currentSpatialAudioConfidence*100)+'%':'')+
      (state.voice.currentSpatialAudioMetric?' · METRIC':' · NON-METRIC')+
      (state.voice.currentSpatialAudioConflict?' · CONFLICT':'');
  }
  ui.roomSpeaker.textContent = state.voice.currentSpeakerName || '—';
  ui.roomVoiceConfidence.textContent = state.voice.currentVoiceConfidence
    ? Math.round(state.voice.currentVoiceConfidence * 100) + '%'
    : '—';
  ui.roomBodyLock.textContent = state.voice.currentSpeakerId
    ? (state.voice.currentBodyLock ? 'CONFIRMED' : 'NOT CURRENT')
    : '—';
  if(ui.roomSpeakerAssociation)
    ui.roomSpeakerAssociation.textContent=speakerAssociationLabel(state.voice.currentAssociationState)+
      ' · FUSION '+String(state.voice.currentFusionState||'unknown-speaker').toUpperCase();
  if(ui.roomOverlapSeparation){
    ui.roomOverlapSeparation.textContent=
      String(state.voice.currentOverlapSeparationState||'unavailable').toUpperCase()+
      (state.voice.currentOverlapSeparationQuality
       ?' · '+Math.round(state.voice.currentOverlapSeparationQuality*100)+'%':'')+
      (state.voice.currentOverlapSeparationParticipantIds.length
       ?' · '+state.voice.currentOverlapSeparationParticipantIds.length+' VERIFIED SOURCE'+
        (state.voice.currentOverlapSeparationParticipantIds.length===1?'':'S'):'');
  }
  if(ui.roomSpeakerProvenance){
    const fusionBits=[
      ...state.voice.currentFusionConflicts.map(value=>'conflict:'+value),
      ...(state.voice.currentFusionAbstentionReason?
        ['abstain:'+state.voice.currentFusionAbstentionReason]:[])
    ];
    ui.roomSpeakerProvenance.textContent=[
      ...state.voice.currentAssociationProvenance,
      ...state.voice.currentFusionProvenance.map(value=>'fusion:'+value),
      ...fusionBits,
      'diarization:'+state.voice.currentDiarizationState+
       (state.voice.currentDiarizationSpeakerCount
        ?'('+state.voice.currentDiarizationSpeakerCount+')':''),
      'separation:'+state.voice.currentOverlapSeparationState+
       (state.voice.currentOverlapSeparationReason
        ?'('+state.voice.currentOverlapSeparationReason+')':''),
      'continuous:'+state.voice.currentContinuousFusionState+
       (state.voice.currentContinuousFusionParticipantIds.length
        ?'('+state.voice.currentContinuousFusionParticipantIds.length+' linked)':''),
      ...state.voice.currentContinuousFusionConflicts.map(value=>'continuous-conflict:'+value)
    ].slice(0,14).join(' · ')||'speaker-unverified';
  }
  if(ui.roomConversationAttention)
    ui.roomConversationAttention.textContent=state.voice.currentConversationLabel||'UNKNOWN';
  if(ui.roomConversationGroupSize)
    ui.roomConversationGroupSize.textContent=String(state.voice.currentConversationGroupSize||1);
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

  const transcriptLifecycleLabel={
    pending:'Transcribing…',partial:'Partial transcript · ephemeral',
    final:'Transcript final',corrected:'Transcript corrected',
    cancelled:'Transcript cancelled',unavailable:'Transcript unavailable'
  }[state.voice.currentTranscriptState];
  if(ui.transcriptModelState)ui.transcriptModelState.textContent = !ui.liveTranscription.checked
    ? 'Transcription off'
    : transcriptLifecycleLabel
      ? transcriptLifecycleLabel+(state.voice.currentTranscriptModelRevision
        ? ' · '+state.voice.currentTranscriptModelRevision.slice(0,8):'')
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
    const transcriptMeta=document.createElement('small');
    const transcriptBits=[
      String(turn.transcriptState||(turn.transcriptEditedAt?'corrected':'final')).toUpperCase(),
      turn.transcriptSource||'local-whisper'
    ];
    if(turn.transcriptModelRevision)transcriptBits.push('rev '+String(turn.transcriptModelRevision).slice(0,8));
    if(Number.isFinite(turn.transcriptCaptureDurationMs))
      transcriptBits.push((turn.transcriptCaptureDurationMs/1000).toFixed(1)+'s capture');
    if(Number.isFinite(turn.transcriptProcessingDurationMs))
      transcriptBits.push(Math.round(turn.transcriptProcessingDurationMs)+'ms process');
    transcriptMeta.textContent='Transcript · '+transcriptBits.join(' · ');
    const conversationMeta=document.createElement('small');
    const addressed=turn.addressedParticipantId?participantById(turn.addressedParticipantId):null;
    const conversationBits=[conversationContextLabel(turn),
      String(turn.conversationGroupSize||1)+' person'+((turn.conversationGroupSize||1)===1?'':'s')];
    if(turn.addressedAgent)conversationBits.push('AGENT addressed');
    if(addressed)conversationBits.push('addressed '+(addressed.nickname||addressed.name||'participant'));
    if(turn.overlapState&&turn.overlapState!=='not-observed')conversationBits.push(turn.overlapState);
    conversationMeta.textContent='Conversation · '+conversationBits.join(' · ');
    const fusionMeta=document.createElement('small');
    const fusionBits=[
      turn.multimodalState||'not-recorded',
      Number.isFinite(turn.multimodalConfidence)
        ? Math.round(turn.multimodalConfidence*100)+'% '+(turn.multimodalConfidenceBand||'')
        : '',
      ...(turn.multimodalConflicts||[]).map(value=>'conflict:'+value),
      ...(turn.multimodalAbstentionReason?['abstain:'+turn.multimodalAbstentionReason]:[])
    ].filter(Boolean);
    fusionMeta.textContent='Fusion · '+fusionBits.join(' · ');
    const diarizationMeta=document.createElement('small');
    const diarizationBits=[
      turn.diarizationState||'not-recorded',
      (turn.diarizationSpeakerCount||0)+' speaker cluster'+
       ((turn.diarizationSpeakerCount||0)===1?'':'s'),
      turn.diarizationOverlapObserved?'overlap unresolved':'',
      turn.diarizationAttributionSuppressed?'whole-turn identity suppressed':''
    ].filter(Boolean);
    diarizationMeta.textContent='Diarization · '+diarizationBits.join(' · ');
    const separationMeta=document.createElement('small');
    const separationBits=[
      turn.overlapSeparationState||'unavailable',
      Number.isFinite(turn.overlapSeparationQuality)
       ?Math.round(turn.overlapSeparationQuality*100)+'% quality':'',
      (turn.overlapSeparationParticipantIds||[]).length
       ?(turn.overlapSeparationParticipantIds||[]).length+' verified source candidate'+
        ((turn.overlapSeparationParticipantIds||[]).length===1?'':'s'):'',
      turn.overlapSeparationReason||''
    ].filter(Boolean);
    separationMeta.textContent='Overlap separation · '+separationBits.join(' · ');
    const continuousMeta=document.createElement('small');
    const continuousBits=[
      turn.continuousFusionState||'not-recorded',
      (turn.continuousFusionParticipantIds||[]).length
       ?(turn.continuousFusionParticipantIds||[]).length+' participant link'+
        ((turn.continuousFusionParticipantIds||[]).length===1?'':'s')
       :'no participant link',
      turn.continuousFusionUnresolvedWindows
       ?turn.continuousFusionUnresolvedWindows+' unresolved window'+
        (turn.continuousFusionUnresolvedWindows===1?'':'s'):'',
      ...(turn.continuousFusionConflicts||[]).map(value=>'conflict:'+value)
    ].filter(Boolean);
    continuousMeta.textContent='Continuous fusion · '+continuousBits.join(' · ');
    const attributionMeta=document.createElement('small');
    const attributionBits=[
      turn.multiPersonAttributionState||'not-recorded',
      (turn.multiPersonAttributionIntervals||[]).length+
       ' interval'+((turn.multiPersonAttributionIntervals||[]).length===1?'':'s'),
      turn.multiPersonOwnershipChangeCount
       ?turn.multiPersonOwnershipChangeCount+' ownership change'+
        (turn.multiPersonOwnershipChangeCount===1?'':'s'):'',
      turn.multiPersonInterruptionCount
       ?turn.multiPersonInterruptionCount+' interruption'+
        (turn.multiPersonInterruptionCount===1?'':'s'):'',
      turn.multiPersonPartialAttribution?'partial attribution':'',
      (turn.multiPersonAttributionCorrections||[]).length?'owner corrected':''
    ].filter(Boolean);
    attributionMeta.textContent='Turn attribution · '+attributionBits.join(' · ');
    const spatialAudioMeta=document.createElement('small');
    const spatialAudioBits=[
      turn.spatialAudioSourceState||'source-unavailable',
      turn.spatialAudioDirection||'unavailable',
      Number.isFinite(turn.spatialAudioDirectionConfidence)
       ?Math.round(turn.spatialAudioDirectionConfidence*100)+'%':'',
      turn.spatialAudioMetric?'metric floor context':'non-metric context',
      turn.spatialAudioConflict?'conflict:'+turn.spatialAudioConflict:''
    ].filter(Boolean);
    spatialAudioMeta.textContent='Spatial audio · '+spatialAudioBits.join(' · ');

    card.append(top, transcript, context,transcriptMeta,conversationMeta,
      fusionMeta,diarizationMeta,continuousMeta,attributionMeta,spatialAudioMeta);
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
  state.voice.inputChannelCount=Math.max(1,Number(level.inputChannelCount)||state.voice.inputChannelCount||1);
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

async function diarizeRoomSegment(segment,wholeEmbedding=null) {
  const windows=createDiarizationWindows(segment.samples,{
    sampleRate:segment.sampleRate||16000,segmentId:segment.segmentId
  });
  const emptyContinuous=()=>summarizeContinuousFusion([]);
  if(!windows.length){
    const diarization=finalizeDiarization([],{
      segmentId:segment.segmentId,reason:'segment-too-short'
    });
    return Object.freeze({...diarization,continuousFusion:emptyContinuous()});
  }

  const working=diarizationSession.fork();
  const fusionWorking=continuousSpeakerFusionTracker.fork();
  const assignments=[];
  const continuousResults=[];
  const activeParticipantIds=state.identity.participants.map(person=>person.id);
  const revokedParticipantIds=state.identity.participants
    .filter(person=>person.voiceRecognitionEnabled===false)
    .map(person=>person.id);
  fusionWorking.reconcile(activeParticipantIds);
  const signalQuality=Math.max(0,Math.min(1,
    (Number(segment.avgDb||-100)-Number(segment.noiseFloorDb||-100))/24));

  const cancelledResult=reason=>{
    const diarization=finalizeDiarization(assignments,{
      segmentId:segment.segmentId,cancelled:true,reason
    });
    return Object.freeze({
      ...diarization,
      continuousFusion:summarizeContinuousFusion(continuousResults)
    });
  };

  for(let index=0;index<windows.length;index++){
    if(!voiceSegmentIsCurrent(segment))return cancelledResult('segment-invalidated');

    const window=windows[index];
    let windowEmbedding=null;
    try{
      windowEmbedding=windows.length===1&&wholeEmbedding
        ? wholeEmbedding
        : await state.voice.engine.embedding(window.samples);
    }catch(error){
      console.warn('Diarization window embedding unavailable.',error);
    }
    if(!voiceSegmentIsCurrent(segment))return cancelledResult('segment-invalidated');

    const assignment=working.assign({
      embedding:windowEmbedding||[],windowId:window.id,
      startOffsetMs:window.startOffsetMs,endOffsetMs:window.endOffsetMs,
      quality:windowEmbedding?signalQuality:0
    });
    assignments.push(assignment);

    if(assignment.state==='speaker'&&assignment.speakerClusterId&&windowEmbedding){
      const visual=visualSnapshotForWindow(segment.roomTrackHistory||[],{
        segmentStartedAt:segment.startedAt,
        startOffsetMs:window.startOffsetMs,endOffsetMs:window.endOffsetMs
      });
      const referenceAt=Number(segment.startedAt||0)+
        (Number(window.startOffsetMs||0)+Number(window.endOffsetMs||0))/2;
      const windowVoiceMatch=bestVoiceMatch(windowEmbedding,state.identity.participants);
      const evidence=deriveMultimodalEvidence({
        voiceMatch:windowVoiceMatch,
        roomTracks:visual.tracks,
        conversationParticipantIds:visual.currentParticipantIds,
        referenceAt,revokedParticipantIds,spatialCalibrated:false
      });
      const windowFusion=fuseMultimodalIdentity({evidence,referenceAt});
      continuousResults.push(fusionWorking.observe({
        clusterId:assignment.speakerClusterId,fusion:windowFusion,at:referenceAt,
        windowId:window.id,startOffsetMs:window.startOffsetMs,endOffsetMs:window.endOffsetMs,
        activeParticipantIds,
        currentVisualParticipantIds:visual.currentParticipantIds,
        occludedParticipantIds:visual.occludedParticipantIds
      }));
    }else{
      continuousResults.push(Object.freeze({
        clusterId:assignment.speakerClusterId||null,windowId:window.id,
        participantId:null,state:assignment.state,confidence:assignment.confidence,
        at:Number(segment.startedAt||0)+
          (Number(window.startOffsetMs||0)+Number(window.endOffsetMs||0))/2,
        startOffsetMs:window.startOffsetMs,endOffsetMs:window.endOffsetMs,
        trackId:null,provenance:Object.freeze(['diarization:'+assignment.state]),
        conflicts:Object.freeze(assignment.state==='overlap-unresolved'
          ?['diarization-overlap-unresolved']:[]),
        reason:assignment.reason||null
      }));
    }
  }

  const diarization=finalizeDiarization(assignments,{segmentId:segment.segmentId});
  const continuousFusion=summarizeContinuousFusion(continuousResults);
  if(voiceSegmentIsCurrent(segment)){
    diarizationSession.commitFrom(working);
    continuousSpeakerFusionTracker.commitFrom(fusionWorking);
  }
  return Object.freeze({...diarization,continuousFusion});
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

    const rawVoiceMatch = bestVoiceMatch(embedding, state.identity.participants);
    const diarization=await diarizeRoomSegment(segment,embedding);
    if(diarization.state==='cancelled'){outcome='cancelled';return;}
    let overlapSeparation=separateStereoOverlap(
      diarization.overlapObserved?(segment.separationInput||{}):{},
      {expectedSpeakers:diarization.overlapObserved
        ?Math.max(2,Number(diarization.speakerCount)||2):1}
    );
    let separatedMatches=resolveSeparatedSpeakerMatches(overlapSeparation,[]);
    if(diarization.overlapObserved&&overlapSeparation.state==='separated'){
      const matches=[];
      for(const source of overlapSeparation.sources){
        if(!voiceSegmentIsCurrent(segment)){outcome='cancelled';return;}
        try{
          const sourceEmbedding=await state.voice.engine.embedding(source.samples);
          if(!voiceSegmentIsCurrent(segment)){outcome='cancelled';return;}
          matches.push(bestVoiceMatch(sourceEmbedding,state.identity.participants));
        }catch(error){
          console.warn('Separated overlap source voice match unavailable.',error);
          matches.push({matched:false,participant:null,similarity:0,margin:0,ambiguous:true});
        }
      }
      separatedMatches=resolveSeparatedSpeakerMatches(overlapSeparation,matches);
    }
    const overlapSeparationFields=overlapSeparationTurnFields(
      overlapSeparation,separatedMatches
    );
    const continuousFusion=diarization.continuousFusion||summarizeContinuousFusion([]);
    const continuousParticipantIds=Array.from(continuousFusion.participantIds||[]);
    const rawParticipantId=rawVoiceMatch.participant?.id||null;
    const continuousDisagreement=Boolean(
      rawParticipantId&&continuousParticipantIds.length===1&&
      continuousParticipantIds[0]!==rawParticipantId
    );
    const continuousConflict=Boolean(
      continuousDisagreement||(continuousFusion.conflicts||[]).length
    );
    const diarizationUnsafe=!diarization.safeWholeTurnAttribution||continuousConflict;
    let voiceMatch=diarizationUnsafe?{
      matched:false,participant:null,
      similarity:rawVoiceMatch.similarity,
      secondSimilarity:rawVoiceMatch.secondSimilarity,
      margin:rawVoiceMatch.margin,
      ambiguous:diarization.overlapObserved||diarization.speakerCount>1||continuousConflict,
      diarizationSuppressed:true,
      continuousFusionSuppressed:continuousConflict
    }:rawVoiceMatch;
    const roomTracks = segment.roomTracks || [];
    let association=resolveSpeakerAssociation({voiceMatch,roomTracks});
    const sameSegmentEnvironment=segment.environmentEvidencePromise
      ?await segment.environmentEvidencePromise:null;
    if(!voiceSegmentIsCurrent(segment)){outcome='cancelled';return;}
    const speechOrigin=resolveRoomSpeechOrigin({
      mediaActivity:environmentalActivityTracker.snapshot(),
      recentEnvironmental:sameSegmentEnvironment?.mediaCue||
        sameSegmentEnvironment?.classification?.recordedMediaCue||
        environmentalAudioLast?.recordedMediaCue||environmentalAudioLast,
      voiceMatch,association,roomTracks,audioSource:segment.audioSource||null,
      continuousFusion,
      now:Date.now()
    });
    const liveObservation=roomLiveValidation.observeSpeechOrigin(speechOrigin,Date.now());
    const behaviorPolicy=liveObservation.policy||roomAudioBehaviorPolicy({speechOrigin});
    const continuityInterruption=roomMediaContinuity.observeForeground(behaviorPolicy,Date.now());
    logRoomMediaContinuity(continuityInterruption,Date.now());
    renderRoomLiveValidation();
    const originNotice=roomSpeechOriginTracker.observe(speechOrigin,Date.now());
    if(originNotice.emit&&speechOrigin.mediaContext&&state.mode==='agent'){
      logRoomMessage('audio',roomSpeechOriginMessage(speechOrigin),'speech-origin-resolver',{
        semantic:'speech-origin',
        confidence:Math.max(
          Number(speechOrigin.mediaContext?.confidence)||0,
          Number(speechOrigin.evidence?.voiceConfidence)||0
        ),
        evidence:{
          durationMs:segment.captureDurationMs||
            Math.max(0,Number(segment.endedAt||0)-Number(segment.startedAt||0)),
          speechOrigin:{
            state:speechOrigin.state,reason:speechOrigin.reason,
            mediaKind:speechOrigin.mediaContext?.kind||null,
            visibleTrackCount:speechOrigin.evidence.visibleTrackCount,
            bodyConfirmed:speechOrigin.evidence.bodyConfirmed,
            spatialLive:speechOrigin.evidence.spatialLive
          }
        }
      });
    }
    if(!speechOrigin.allowConversation){
      queueMusicRecognitionWindow(segment,{
       classification:sameSegmentEnvironment?.classification||null,speechOrigin,
       behaviorPolicy
      });
      queueMediaRecognitionWindow(segment,{speechOrigin});
      state.voice.currentSpeakerId=null;
      state.voice.currentSpeakerName=speechOrigin.state==='recorded'
        ?'Recorded speech likely':'Speech origin uncertain';
      state.voice.currentVoiceConfidence=0;
      state.voice.currentBodyLock=false;
      state.voice.currentGroupId=null;
      state.voice.currentAssociationState='unknown-speaker';
      state.voice.currentAssociationProvenance=['speech-origin:'+speechOrigin.state];
      state.voice.currentAssociationTransition=null;
      state.voice.currentFusionState='unknown-speaker';
      state.voice.currentFusionDecision='abstain';
      state.voice.currentFusionConfidence=0;
      state.voice.currentFusionProvenance=['speech-origin:'+speechOrigin.state];
      state.voice.currentFusionConflicts=[];
      state.voice.currentFusionAbstentionReason=speechOrigin.reason;
      state.voice.currentFusionTransition=null;
      state.voice.currentDiarizationState=diarization.state;
      state.voice.currentDiarizationSpeakerCount=diarization.speakerCount;
      state.voice.currentDiarizationOverlap=diarization.overlapObserved;
      state.voice.currentDiarizationReason=diarization.reason;
      state.voice.currentConversationAttention='room';
      state.voice.currentConversationGroupSize=0;
      state.voice.currentConversationLabel=speechOrigin.state==='recorded'
        ?'RECORDED SPEECH · HELD OUT':'SPEECH ORIGIN UNCERTAIN · HELD OUT';
      state.voice.lastDecision='speech-origin-'+speechOrigin.state;
      renderParticipantCards();
      renderVoiceHud();
      return;
    }
    if(!speechOrigin.allowParticipantAttribution){
      voiceMatch={
        matched:false,participant:null,
        similarity:rawVoiceMatch.similarity,
        secondSimilarity:rawVoiceMatch.secondSimilarity,
        margin:rawVoiceMatch.margin,
        ambiguous:true,speechOriginSuppressed:true
      };
      association=resolveSpeakerAssociation({voiceMatch,roomTracks});
    }
    const participant=association.participantId
      ? (voiceMatch.participant?.id===association.participantId
        ? voiceMatch.participant : participantById(association.participantId))
      : null;
    if(speechOrigin.allowParticipantAttribution&&
       voiceMatch.matched&&association.participantId&&association.trackId&&participant){
      state.identity.tracks=Array.from(participantContinuity.recoverByVoice(
       state.identity.tracks,{
        participantId:participant.id,participantName:participant.nickname||participant.name,
        trackId:association.trackId,confidence:association.voiceConfidence,at:Date.now()
       }
      ));
    }
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
      voiceConfidence: rawVoiceMatch.similarity,
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
    const currentRoomTracks=roomTracks.filter(candidate=>
      candidate?.id&&!['occluded','reacquiring'].includes(candidate.status));
    const conversationTracks=group?.tracks?.length?group.tracks:currentRoomTracks;
    const fusionReferenceAt=Number(segment.queuedAt)||Date.now();
    const fusionEvidence=deriveMultimodalEvidence({
      voiceMatch,roomTracks,
      conversationParticipantIds:conversationTracks.map(candidate=>candidate.participantId).filter(Boolean),
      referenceAt:fusionReferenceAt,
      revokedParticipantIds:state.identity.participants
        .filter(candidate=>candidate.voiceRecognitionEnabled===false)
        .map(candidate=>candidate.id),
      // 12A preserves camera-relative spatial context only. Metric/source-aware spatial
      // evidence is introduced later and cannot become speaker identity proof here.
      spatialCalibrated:false
    });
    const fusion=fuseMultimodalIdentity({evidence:fusionEvidence,referenceAt:fusionReferenceAt});

    state.voice.currentSpeakerId = association.participantId;
    state.voice.currentSpeakerName = participant?.name
      || (association.state==='ambiguous-voice'?'Ambiguous voice':
        association.voiceConfidence?'Unknown voice':null);
    state.voice.currentVoiceConfidence = association.voiceConfidence;
    state.voice.currentBodyLock = association.bodyConfirmed;
    state.voice.currentAssociationState=association.state;
    state.voice.currentAssociationProvenance=Array.from(association.provenance);
    state.voice.currentFusionState=fusion.state;
    state.voice.currentFusionDecision=fusion.decision;
    state.voice.currentFusionConfidence=fusion.confidence;
    state.voice.currentFusionProvenance=Array.from(fusion.provenance);
    state.voice.currentFusionConflicts=Array.from(fusion.conflicts);
    state.voice.currentFusionAbstentionReason=fusion.abstentionReason;
    state.voice.currentDiarizationState=diarization.state;
    state.voice.currentDiarizationSpeakerCount=diarization.speakerCount;
    state.voice.currentDiarizationOverlap=diarization.overlapObserved;
    state.voice.currentDiarizationReason=diarization.reason;
    state.voice.currentOverlapSeparationState=overlapSeparationFields.overlapSeparationState;
    state.voice.currentOverlapSeparationQuality=overlapSeparationFields.overlapSeparationQuality;
    state.voice.currentOverlapSeparationParticipantIds=
      Array.from(overlapSeparationFields.overlapSeparationParticipantIds||[]);
    state.voice.currentOverlapSeparationReason=overlapSeparationFields.overlapSeparationReason;
    state.voice.currentContinuousFusionState=continuousFusion.state;
    state.voice.currentContinuousFusionParticipantIds=continuousParticipantIds;
    state.voice.currentContinuousFusionConflicts=[
      ...Array.from(continuousFusion.conflicts||[]),
      ...(continuousDisagreement?['whole-segment-voice-cluster-disagreement']:[])
    ];
    state.voice.currentContinuousFusionUnresolvedWindows=
      Number(continuousFusion.unresolvedWindows||0);
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
      state.voice.currentFusionState='unknown-speaker';
      state.voice.currentFusionDecision='abstain';
      state.voice.currentFusionConfidence=0;
      state.voice.currentFusionProvenance=['signal-rejected'];
      state.voice.currentFusionConflicts=[];
      state.voice.currentFusionAbstentionReason='signal-rejected';
      state.voice.currentFusionTransition=null;
      state.voice.currentDiarizationState='unknown';
      state.voice.currentDiarizationSpeakerCount=0;
      state.voice.currentDiarizationOverlap=false;
      state.voice.currentDiarizationReason='signal-rejected';
      state.voice.currentOverlapSeparationState='unavailable';
      state.voice.currentOverlapSeparationQuality=0;
      state.voice.currentOverlapSeparationParticipantIds=[];
      state.voice.currentOverlapSeparationReason='signal-rejected';
      state.voice.currentConversationAttention='unknown';
      state.voice.currentConversationGroupSize=1;
      state.voice.currentConversationLabel='TURN REJECTED';
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

    let transcript='';
    let transcriptRecord=null;
    if(ui.liveTranscription.checked){
      transcriptLifecycle.begin({
        segmentId:segment.segmentId,generation:segment.generation,
        sessionId:state.voice.sessionId,source:'local-whisper',
        captureDurationMs:segment.captureDurationMs,at:Date.now()
      });
      state.voice.currentTranscriptState='pending';
      state.voice.currentTranscriptSegmentId=segment.segmentId;
      state.voice.currentTranscriptModelRevision=null;
      renderVoiceHud();

      const transcriptReady=await ensureTranscriptionEngine();
      if(!voiceSegmentIsCurrent(segment)){
        transcriptLifecycle.cancel(segment.segmentId,'segment-invalidated',Date.now());
        state.voice.currentTranscriptState='cancelled';
        outcome='cancelled';return;
      }
      if(transcriptReady){
        const detail=await state.voice.transcriber.transcribeDetailed(segment.samples);
        if(!voiceSegmentIsCurrent(segment)){
          transcriptLifecycle.cancel(segment.segmentId,'stale-transcription-result',Date.now());
          state.voice.currentTranscriptState='cancelled';
          outcome='cancelled';return;
        }
        transcriptRecord=transcriptLifecycle.finalize(segment.segmentId,{
          text:detail.text,confidence:detail.confidence,language:detail.language,
          source:detail.source,modelId:detail.modelId,modelRevision:detail.modelRevision,
          processingDurationMs:detail.processingDurationMs,at:detail.completedAt
        });
        transcript=transcriptRecord?.text||'';
        state.voice.currentTranscriptState=transcriptRecord?.state||'unavailable';
        state.voice.currentTranscriptModelRevision=transcriptRecord?.modelRevision||null;
      }else{
        transcriptRecord=transcriptLifecycle.finalize(segment.segmentId,{
          text:'',source:'local-whisper',at:Date.now()
        });
        state.voice.currentTranscriptState='unavailable';
      }
      renderVoiceHud();
    }else{
      transcriptRecord={
        state:'unavailable',source:'disabled',segmentId:segment.segmentId,
        sessionId:state.voice.sessionId,captureDurationMs:segment.captureDurationMs,
        completedAt:Date.now()
      };
      state.voice.currentTranscriptState='unavailable';
      state.voice.currentTranscriptSegmentId=segment.segmentId;
      state.voice.currentTranscriptModelRevision=null;
    }
    const transcriptFields=canonicalTranscriptFields(transcriptRecord);

    const associationTransition=speakerAssociationTracker.preview(association,Date.now());
    const fusionTransition=multimodalFusionTracker.preview(fusion,Date.now());
    state.voice.currentAssociationTransition=associationTransition?.type||null;
    state.voice.currentFusionTransition=fusionTransition?.type||null;

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
    const fusionFields=multimodalFusionTurnFields(fusion);
    const diarizationFields=diarizationTurnFields(diarization);
    const continuousFields=continuousFusionTurnFields(continuousFusion);
    const spatialVisual=visualSpatialSourceEvidence({
      calibration:sceneUI?.getScene?.()?.calibration||null,
      track:track||null
    });
    const spatialAudio=fuseSpatialAudioSource({
      audioEvidence:segment.audioSource||null,
      visualEvidence:spatialVisual
    });
    const spatialAudioFields=spatialAudioSourceTurnFields(spatialAudio);
    state.voice.currentSpatialAudioState=spatialAudio.state;
    state.voice.currentSpatialAudioDirection=spatialAudio.direction;
    state.voice.currentSpatialAudioConfidence=spatialAudio.confidence;
    state.voice.currentSpatialAudioConflict=spatialAudio.conflict;
    state.voice.currentSpatialAudioMetric=spatialAudio.metric===true;
    const multiPersonAttribution=buildTurnAttribution({
      diarizationSpans:diarization.spans,
      continuousFusionWindowLinks:continuousFusion.windowLinks,
      overlapSeparation:overlapSeparationFields,
      turnDurationMs:segment.captureDurationMs||
        Math.max(0,Number(segment.endedAt||0)-Number(segment.startedAt||0))
    });
    const multiPersonFields=multiPersonAttributionTurnFields(multiPersonAttribution);
    const captureRoom=currentRoomIdentity();
    const participantRoomState=association.participantId
      ?roomHandoffTracker.snapshot().find(row=>row.participantId===association.participantId)||null
      :null;
    const roomHandoffFields=roomHandoffTurnFields(participantRoomState);
    let turn = {
     ...createSpeakerTurn({
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
     }),
     ...fusionFields,
     ...diarizationFields,
     ...continuousFields,
     ...overlapSeparationFields,
     ...spatialAudioFields,
     ...multiPersonFields,
     roomId:captureRoom.id,
     roomName:captureRoom.name,
     ...roomHandoffFields,
     speechOriginState:speechOrigin.state,
     speechOriginReason:speechOrigin.reason,
     speechOriginMediaKind:speechOrigin.mediaContext?.kind||null,
     speechOriginParticipantAttributionAllowed:speechOrigin.allowParticipantAttribution,
     overlapEvidence:diarization.overlapObserved,
     diarizationAttributionSuppressed:diarizationUnsafe,
     diarizationAttributionReason:diarizationUnsafe
      ?(continuousConflict
        ?'continuous-fusion-conflict-suppressed-whole-turn-attribution'
        :'diarization-suppressed-whole-turn-attribution'):null,
     multimodalTransition:fusionTransition?{
      type:fusionTransition.type,fromState:fusionTransition.fromState,
      toState:fusionTransition.toState,at:fusionTransition.at
     }:null,
     ...transcriptFields
    };
    if(nearestVisitor)turn=associateVisitorTurn(turn,nearestVisitor);
    if(nearestEnrolled && !participant)
      turn={...turn,speakerAssociation:'nearby-identified-person-unverified'};
    const visibleConversationParticipants=conversationTracks
      .map(candidate=>candidate.participantId?participantById(candidate.participantId):null)
      .filter(Boolean);
    const visibleConversationVisitorIds=conversationTracks
      .map(candidate=>candidate.visitorId||null).filter(Boolean);
    const conversationFields=multiConversationTurnFields(turn,{
      visibleParticipants:visibleConversationParticipants,
      visibleVisitorIds:visibleConversationVisitorIds,
      groupSize:Math.max(1,conversationTracks.length)
    });
    turn={...turn,...conversationFields,
      meetingId:segment.meetingId||null,
      meetingSchemaVersion:segment.meetingId?segment.meetingSchemaVersion||1:null
    };
    state.voice.currentConversationAttention=turn.attentionTarget;
    state.voice.currentConversationGroupSize=turn.conversationGroupSize;
    state.voice.currentConversationLabel=conversationContextLabel(turn);
    turn.at=Date.now();
    if (!voiceSegmentIsCurrent(segment)){
      transcriptLifecycle.cancel(segment.segmentId,'pre-persistence-stale',Date.now());
      state.voice.currentTranscriptState='cancelled';
      outcome='cancelled';return;
    }

    let savedTurn;
    try {
      savedTurn = await saveDialogueTurn({
        ...turn,
        sessionId: state.voice.sessionId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      transcriptLifecycle.cancel(segment.segmentId,'dialogue-save-failed',Date.now());
      state.voice.currentTranscriptState='cancelled';
      outcome='failed';
      state.voice.lastDecision='dialogue-save-failed';
      console.error('Could not persist dialogue turn', error);
      pushRoomEvent('Speech turn was not saved; AGENT reply skipped.', 'error');
      return;
    }

    if (!voiceSegmentIsCurrent(segment)) {
      transcriptLifecycle.cancel(segment.segmentId,'post-persistence-stale',Date.now());
      state.voice.currentTranscriptState='cancelled';
      outcome='cancelled';
      await deleteDialogueTurn(savedTurn.id).catch(() => {});
      return;
    }

    speakerAssociationTracker.commit(association);
    multimodalFusionTracker.commit(fusion);
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
    void refreshTranscriptSessionSummary();
    void meetingUI?.refreshTurns();
    memoryUI?.refreshProposals?.();
    state.voice.lastDecision = 'accepted';
    if(state.mode==='agent'){
      logRoomMessage('audio',savedTurn.participantId?'Voice-profile-matched speech segment':'Shared room speech segment · speaker unverified',
       'room-voice',savedTurn.participantId?{participantId:savedTurn.participantId}:{});
      const followThroughHandled=await handleContextualFollowThrough(savedTurn,Date.now());
      if(!followThroughHandled)agentRuntime?.onDialogue(savedTurn);
      noteSituationalDialogueFeedback(savedTurn,Date.now());
      proactiveGovernor.noteDialogue(savedTurn,Date.now());
      renderCognitiveStatus();
    }

    renderParticipantCards();
    renderDialogueTurns();
    renderVoiceHud();
  } catch (error) {
    outcome='failed';
    console.error(error);
    pushRoomEvent('Speech turn could not be analyzed.', 'error');
  } finally {
    transcriptLifecycle.forget(segment?.segmentId);
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
    bodyScore:Number(track.bodyScore||0),
    lastBodySeenAt:Number(track.lastBodySeenAt||0),
    lastFaceSeenAt:Number(track.lastFaceSeenAt||0),
    box: track.box ? { ...track.box } : null
  }));
}

function recordRoomTrackHistory(now=performance.now()) {
  roomTrackHistory=Array.from(recordVisualHistory(roomTrackHistory,{
    at:now,tracks:roomTrackSnapshot()
  },{now}));
  return roomTrackHistory;
}

function roomTrackHistoryForSegment(segment) {
  const started=Number(segment?.startedAt)||0;
  const ended=Number(segment?.endedAt)||started;
  const padding=1800;
  return roomTrackHistory
    .filter(row=>row.at>=started-padding&&row.at<=ended+padding)
    .slice(-36)
    .map(row=>({
      at:row.at,
      tracks:Array.from(row.tracks||[]).map(track=>({...track}))
    }));
}

function onRoomAudioSegment(segment) {
  const evidenceRequest=createEnvironmentalSpeechEvidenceRequest();
  const {separationInput,...environmentSegment}=segment;
  const environmentalQueued=queueEnvironmentalAudio({
    ...environmentSegment,environmentCorrelationId:evidenceRequest.id
  });
  if(!environmentalQueued)resolveEnvironmentalSpeechEvidence(evidenceRequest.id,null);
  const meetingFields=meetingUI?.turnFields?.()||{meetingId:null,meetingSchemaVersion:null};
  const queued=listeningController.enqueue({
    ...segment,...meetingFields,
    environmentEvidencePromise:evidenceRequest.promise,
    roomTrackHistory:roomTrackHistoryForSegment(segment)
  },{
    generation:state.voice.generation,
    roomTracks:roomTrackSnapshot(),
    now:Date.now()
  });
  reportListeningDrops(queued.dropped);
  runtimeBudget.recordAudioQueue(listeningController.snapshot().queueDepth);
  renderRuntimeHealth();renderListeningHealth();
  if(!queued.accepted){
    resolveEnvironmentalSpeechEvidence(evidenceRequest.id,null);
    return;
  }
  void drainRoomAudioQueue();
}

function transcriptParticipantName(turn){
 const person=turn?.participantId?participantById(turn.participantId):null;
 return turn?.participantId?(person?.nickname||person?.name||turn.participantName||'Participant'):'Unknown speaker';
}

function renderTranscriptSearchResults(matches=[],query=''){
 if(!ui.transcriptSearchResults)return;
 ui.transcriptSearchResults.replaceChildren();
 if(!query){
  ui.transcriptSearchResults.hidden=true;return;
 }
 ui.transcriptSearchResults.hidden=false;
 if(!matches.length){
  const empty=document.createElement('p');
  empty.className='dialogue-empty';empty.textContent='No canonical transcripts match “'+query+'”.';
  ui.transcriptSearchResults.append(empty);return;
 }
 for(const turn of matches){
  const row=document.createElement('article');row.className='transcript-search-result';
  const name=document.createElement('strong');name.textContent=transcriptParticipantName(turn);
  const text=document.createElement('p');text.textContent=turn.transcript;
  const meta=document.createElement('small');
  const at=Date.parse(turn.createdAt||'')||Number(turn.at||0);
  meta.textContent=(Number.isFinite(at)&&at>0?new Date(at).toLocaleString():'Unknown time')+
   ' · '+String(turn.transcriptState||(turn.transcriptEditedAt?'corrected':'final')).toUpperCase()+
   ' · '+String(turn.sessionId||'room-session');
  row.append(name,text,meta);ui.transcriptSearchResults.append(row);
 }
}

async function runTranscriptSearch(){
 const query=String(ui.transcriptSearch?.value||'').trim();
 if(!query){renderTranscriptSearchResults([],'');return;}
 try{
  const rows=await listDialogueTurns();
  const matches=searchTranscriptTurns(rows,query,{limit:30});
  renderTranscriptSearchResults(matches,query);
  if(ui.transcriptSessionSummary)
   ui.transcriptSessionSummary.textContent=matches.length+' result'+(matches.length===1?'':'s')+
    ' · canonical local transcript search';
 }catch(error){
  console.error('Transcript search failed',error);
  if(ui.transcriptSessionSummary)ui.transcriptSessionSummary.textContent='Transcript search unavailable.';
 }
}

async function refreshTranscriptSessionSummary(rows=null){
 if(!ui.transcriptSessionSummary)return;
 try{
  const all=rows||await listDialogueTurns();
  const summaries=transcriptSessionSummaries(all);
  const current=summaries.find(item=>item.sessionId===state.voice.sessionId);
  const total=all.filter(turn=>String(turn.transcript||'').trim()).length;
  ui.transcriptSessionSummary.textContent=current
   ? 'Current session · '+current.transcriptCount+' transcript'+(current.transcriptCount===1?'':'s')+
     (current.correctedCount?' · '+current.correctedCount+' corrected':'')+
     ' · '+total+' searchable on device'
   : total+' searchable transcript'+(total===1?'':'s')+' on this device · current session empty';
 }catch(error){
  console.error('Transcript session summary failed',error);
  ui.transcriptSessionSummary.textContent='Transcript session summary unavailable.';
 }
}

function downloadTranscriptJson(payload,scope){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 link.href=url;link.download='tracky2-transcripts-'+scope+'-'+stamp+'.json';
 link.hidden=true;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),0);
}

async function exportCanonicalTranscripts(all=false){
 try{
  const rows=await listDialogueTurns();
  const payload=transcriptExport(rows,state.identity.participants,{
   sessionId:all?null:state.voice.sessionId,includeUnknown:true
  });
  downloadTranscriptJson(payload,all?'all':'session');
  if(ui.transcriptSessionSummary)
   ui.transcriptSessionSummary.textContent='Exported '+payload.turnCount+
    ' canonical transcript'+(payload.turnCount===1?'':'s')+
    ' · text/provenance only · no audio, photos or biometrics';
 }catch(error){
  console.error('Transcript export failed',error);
  if(ui.transcriptSessionSummary)ui.transcriptSessionSummary.textContent='Transcript export unavailable.';
 }
}

async function loadSavedDialogue() {
  try {
    const rows = await listDialogueTurns();
    state.voice.turns = rows.slice(-50);
    await refreshTranscriptSessionSummary(rows);
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
    transcriptLifecycle.clear();
    state.voice.currentTranscriptState='idle';
    state.voice.currentTranscriptSegmentId=null;
    state.voice.currentTranscriptModelRevision=null;
    renderTranscriptSearchResults([],'');
    renderDialogueTurns();
    await refreshTranscriptSessionSummary([]);
    void meetingUI?.refreshTurns();
     memoryUI?.refreshProposals?.();
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
    state.voice.inputChannelCount=state.voice.audio.inputChannelCount||1;
    if (state.voice.ttsPending > 0 || agentSpeechActive) state.voice.audio.setSuppressed(true);
    state.voice.active = true;
    speakerAssociationTracker.reset();
    multimodalFusionTracker.reset();
    diarizationSession.reset();
    continuousSpeakerFusionTracker.reset();
    transcriptLifecycle.clear();
    state.voice.currentTranscriptState='idle';
    state.voice.currentTranscriptSegmentId=null;
    state.voice.currentTranscriptModelRevision=null;
    state.voice.currentAssociationState='unknown-speaker';
    state.voice.currentAssociationProvenance=['speaker-unverified'];
    state.voice.currentAssociationTransition=null;
    state.voice.currentFusionState='unknown-speaker';
    state.voice.currentFusionDecision='abstain';
    state.voice.currentFusionConfidence=0;
    state.voice.currentFusionProvenance=['speaker-unverified'];
    state.voice.currentFusionConflicts=[];
    state.voice.currentFusionAbstentionReason='no-identity-authority';
    state.voice.currentFusionTransition=null;
    state.voice.currentDiarizationState='unknown';
    state.voice.currentDiarizationSpeakerCount=0;
    state.voice.currentDiarizationOverlap=false;
    state.voice.currentDiarizationReason=null;
    state.voice.currentConversationAttention='unknown';
    state.voice.currentConversationGroupSize=1;
    state.voice.currentConversationLabel='UNVERIFIED SPEAKER · SOLO';
    listeningController.start(state.voice.generation,Date.now());
    const initiallySuppressed=Boolean(state.voice.ttsPending>0||agentSpeechActive);
    listeningController.setAgentSpeaking(Boolean(agentSpeechActive));
    listeningController.setSuppressed(initiallySuppressed,
      agentSpeechActive?'agent-tts':state.voice.ttsPending>0?'acknowledgement-tts':'capture-active');
    roomSensorState('microphone','online','Room microphone online');
    roomAmbientAudit.reset();
    clearEnvironmentalSpeechEvidence();
    roomSpeechOriginTracker.reset();
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
  void recordingUI?.stopIfActive?.('room-audio-stopped');
  if(state.mode==='agent'&&state.voice.active)
   roomSensorState('microphone','offline','Room microphone stopped · silence not inferred');
  if(state.mode==='agent')saveRoomAudioSummary(roomAmbientAudit.flush(Date.now()));
  roomAmbientAudit.reset();
  roomAcousticPatternTracker.reset();
  roomSpeechOriginTracker.reset();
  environmentalAlertTracker.reset();
  environmentalMechanicalTracker.reset();
  resetPersonalizedSoundRuntime();
  clearEnvironmentalSpeechEvidence();
  resetMusicIdentification('Room microphone stopped');
  resetMediaIdentification('Room microphone stopped');
  // Microphone shutdown is an evidence gap, not proof that an active sound stopped.
  environmentalActivityTracker.reset();
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
  state.voice.currentFusionState='unknown-speaker';
  state.voice.currentFusionDecision='abstain';
  state.voice.currentFusionConfidence=0;
  state.voice.currentFusionProvenance=['speaker-unverified'];
  state.voice.currentFusionConflicts=[];
  state.voice.currentFusionAbstentionReason='no-identity-authority';
  state.voice.currentFusionTransition=null;
  state.voice.currentDiarizationState='unknown';
  state.voice.currentDiarizationSpeakerCount=0;
  state.voice.currentDiarizationOverlap=false;
  state.voice.currentDiarizationReason=null;
  state.voice.currentOverlapSeparationState='unavailable';
  state.voice.currentOverlapSeparationQuality=0;
  state.voice.currentOverlapSeparationParticipantIds=[];
  state.voice.currentOverlapSeparationReason=null;
  state.voice.currentContinuousFusionState='unresolved';
  state.voice.currentContinuousFusionParticipantIds=[];
  state.voice.currentContinuousFusionConflicts=[];
  state.voice.currentContinuousFusionUnresolvedWindows=0;
  state.voice.currentSpatialAudioState='source-unavailable';
  state.voice.currentSpatialAudioDirection='unavailable';
  state.voice.currentSpatialAudioConfidence=0;
  state.voice.currentSpatialAudioConflict=null;
  state.voice.currentSpatialAudioMetric=false;
  state.voice.currentConversationAttention='unknown';
  state.voice.currentConversationGroupSize=1;
  state.voice.currentConversationLabel='UNVERIFIED SPEAKER · SOLO';
  speakerAssociationTracker.reset();
  multimodalFusionTracker.reset();
  diarizationSession.reset();
  continuousSpeakerFusionTracker.reset();
  transcriptLifecycle.clear();
  state.voice.currentTranscriptState='idle';
  state.voice.currentTranscriptSegmentId=null;
  state.voice.currentTranscriptModelRevision=null;
  state.voice.captureMode = 'offline';
  state.voice.inputChannelCount = 1;
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
    void meetingUI?.updateRoster(publicRoomTracks());
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

function correctTrackIdentity(track,participantId){
 const person=participantId?participantById(participantId):null;
 if(participantId&&!person)return;
 try{
  state.identity.tracks=Array.from(participantContinuity.noteOwnerCorrection(
   state.identity.tracks,{
    trackId:track.id,participantId:person?.id||null,
    participantName:person?.nickname||person?.name||null,at:Date.now()
   }
  ));
  if(state.mode==='agent')logRoomMessage(
   'identity',
   person?'Owner corrected track '+track.id+' to '+(person.nickname||person.name):
    'Owner cleared identity from track '+track.id,
   'participant-continuity',
   {semantic:'participant-continuity-correction',participantId:person?.id||null,
    confidence:person?1:0,evidence:{trackId:track.id}}
  );
  reconcileRoomVisitors(performance.now());
  updateConversationGroups();
  recordRoomTrackHistory(performance.now());
  renderParticipantCards();
 }catch(error){
  console.error('Identity correction failed',error);
  if(state.mode==='agent')logRoomMessage('identity',
   'Identity correction blocked · '+String(error?.message||error),
   'participant-continuity',{semantic:'participant-continuity-correction-blocked'});
 }
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
    },{accountSync:false});
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

    const continuityNow=Date.now();
    for(const track of resolved){
      if(track.participantId&&track.status==='matched'&&track.face){
        participantContinuity.observeVerified({
          participantId:track.participantId,participantName:track.participantName,
          trackId:track.id,authority:track.identitySource==='owner-correction'
           ?'owner-correction':'face',
          confidence:track.identitySource==='owner-correction'?1:track.similarity,
          at:continuityNow,track
        });
      }else if(track.participantId){
        participantContinuity.observeVisibleTrack(track,continuityNow);
      }
    }
    const continuityPass=participantContinuity.annotateTracks(resolved,continuityNow);
    const continuityResolved=Array.from(continuityPass.tracks);
    for(const track of continuityResolved)
      if(track.participantId)participantContinuity.observeVisibleTrack(track,continuityNow);

    const liveParticipantIds = new Set(
      continuityResolved
        .filter((track) => track.participantId)
        .map((track) => track.participantId)
    );
    const nonConflictingCarried = carried.filter(
      (track) => !track.participantId || !liveParticipantIds.has(track.participantId)
    );

    state.identity.tracks = dedupeParticipantAssignments([
      ...continuityResolved,
      ...nonConflictingCarried
    ]);
    reconcileRoomVisitors(now);
    updateConversationGroups();
    recordRoomTrackHistory(now);
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
  const scanMultiplier=devicePerformanceGovernor.snapshot().policy.identityScanMultiplier;
  if (now - state.identity.lastScanAt < IDENTITY_SCAN_INTERVAL * scanMultiplier) return;
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
  roomTrackHistory=[];
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
    roomTrackHistory=[];
    continuousSpeakerFusionTracker.reset();
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
  if(['agent','meeting'].includes(ui.gameMode.value)){
    window.location.assign('./vertical-motion.html?mode='+encodeURIComponent(ui.gameMode.value));return;
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
ui.transcriptSearchRun?.addEventListener('click',()=>{void runTranscriptSearch();});
ui.transcriptSearch?.addEventListener('keydown',event=>{
 if(event.key==='Enter'){event.preventDefault();void runTranscriptSearch();}
});
ui.transcriptExportSession?.addEventListener('click',()=>{void exportCanonicalTranscripts(false);});
ui.transcriptExportAll?.addEventListener('click',()=>{void exportCanonicalTranscripts(true);});
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
function prepareRuntimeExit(reason='runtime-exit'){
 if(runtimeExitPrepared)return false;
 runtimeExitPrepared=true;
 environmentalAudioQueue.disable();
 cancelCameraRecovery();
 cancelMicrophoneRecovery();
 state.voice.generation+=1;
 listeningController.invalidateGeneration(state.voice.generation,reason,Date.now());
 transcriptLifecycle.clear();
 diarizationSession.reset();
 continuousSpeakerFusionTracker.reset();
 multiRoomRuntime?.stop();
 roomTrackHistory=[];
 return true;
}
window.addEventListener('beforeunload', () => {
  prepareRuntimeExit('beforeunload');
  if(cameraRecoveryTimer)clearTimeout(cameraRecoveryTimer);
  if(microphoneRecoveryTimer)clearTimeout(microphoneRecoveryTimer);
  if(storageHealthTimer)clearInterval(storageHealthTimer);
  if(proactiveTimer)clearInterval(proactiveTimer);
  proactiveTimer=0;
  for(const unwatch of permissionWatchers)unwatch();
  taskUI?.destroy();
  workflowUI?.destroy();
  meetingUI?.destroy();
  recordingUI?.destroy();
  stopRoomAudio();
  stopCamera();
});

async function captureGovernedSceneImage({target}={}){
 if(!target?.area?.rect)throw Object.assign(new Error('Mapped camera area required for capture.'),{retryable:false});
 if(!state.running||document.hidden||ui.video.readyState<2)
  throw Object.assign(new Error('Camera must be visibly active for capture.'),{retryable:false});
 const sourceWidth=ui.video.videoWidth||0,sourceHeight=ui.video.videoHeight||0;
 if(sourceWidth<2||sourceHeight<2)throw Object.assign(new Error('Live camera frame unavailable.'),{retryable:true});
 const rect=target.area.rect;
 const sx=Math.max(0,Math.floor(rect.x*sourceWidth)),sy=Math.max(0,Math.floor(rect.y*sourceHeight));
 const sw=Math.max(1,Math.min(sourceWidth-sx,Math.round(rect.width*sourceWidth)));
 const sh=Math.max(1,Math.min(sourceHeight-sy,Math.round(rect.height*sourceHeight)));
 const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
 const context=canvas.getContext('2d',{alpha:false});
 if(!context)throw Object.assign(new Error('Camera capture canvas unavailable.'),{retryable:false});
 context.drawImage(ui.video,sx,sy,sw,sh,0,0,sw,sh);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>
  value?resolve(value):reject(new Error('Camera capture encoding failed.')),'image/jpeg',.9));
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 const safeName=String(target.name||'object').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'object';
 link.href=url;link.download='tracky2-'+safeName+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jpg';
 link.hidden=true;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),0);
 return Object.freeze({
  summary:'Captured the current mapped camera area for '+target.name+' and downloaded it locally.',
  mediaBytes:blob.size,width:sw,height:sh
 });
}

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
  if(requestedMode==='meeting'){
    // Dedicated meeting entry point, but reuse the exact AGENT/camera/audio runtime.
    state.mode='agent';
    ui.gameMode.value='meeting';
  }else if(['solo','multiplayer','agent'].includes(requestedMode)){
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
  await startSessionIdentity(createSessionIdentity({
   id:canonicalSessionId,runtimeScope:'agent-room',
   runtimeInstanceId:canonicalRuntimeInstanceId
  },roomSessionStartedAt)).catch(error=>
   console.warn('Session identity metadata unavailable:',error));
  void watchMediaPermission('camera');
  void watchMediaPermission('microphone');
  void refreshStorageHealth({announce:false});
  storageHealthTimer=window.setInterval(()=>{void refreshStorageHealth();},60000);
  renderRuntimeHealth(true);
  meetingUI=createMeetingUi({
   participants:()=>state.identity.participants,
   sessionId:()=>canonicalSessionId,
   recordEvent:(category,message,source,options)=>recordProactiveSourceEvent(category,message,source,options),
   onChange:active=>{
    agentRuntime?.onMeetingChange?.(active);
    agentRuntime?.refreshConversation();
     memoryUI?.refreshProposals?.();
    void recallUI?.refreshTimeline?.();
   }
  });
  await meetingUI.init().catch(error=>console.warn('Meeting runtime initialization failed:',error));
  agentRuntime=createAgentRoom({
    participants:()=>state.identity.participants,
    getDialogueTurns:()=>state.voice.turns,
    getMemories:participantId=>memoryUI?.contextFor(participantId)||[],
    getMeeting:()=>meetingUI?.activeMeeting()||null,
    getScene:()=>effectiveRoomScene(),
    editTranscript:async(id,text)=>{
     const revised=await reviseDialogueTurn(id,text);
     state.voice.turns=state.voice.turns.map(turn=>turn.id===id?revised:turn);
     state.voice.currentTranscriptState='corrected';
     void refreshTranscriptSessionSummary();
     if(String(ui.transcriptSearch?.value||'').trim())void runTranscriptSearch();
     void meetingUI?.refreshTurns();
     memoryUI?.refreshProposals?.();
     logRoomMessage('system','Owner corrected canonical transcript wording · original retained locally',
      'transcript-correction',{participantId:revised.participantId||null});
     agentRuntime?.refreshConversation();
     void recallUI?.refreshTimeline?.();
     return revised;
    },
    editAttribution:async(id,correction)=>{
     const revised=await reviseDialogueAttribution(id,correction);
     state.voice.turns=state.voice.turns.map(turn=>turn.id===id?revised:turn);
     if(String(ui.transcriptSearch?.value||'').trim())void runTranscriptSearch();
     void meetingUI?.refreshTurns();
     memoryUI?.refreshProposals?.();
     logRoomMessage('system','Owner corrected speaker attribution · canonical transcript wording unchanged',
      'speaker-attribution-correction',{participantId:correction?.participantId||null});
     agentRuntime?.refreshConversation();
     void recallUI?.refreshTimeline?.();
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
  agentRuntime.onMeetingChange?.(meetingUI?.activeMeeting()||null);
  const autoGreet=document.getElementById('agentAutoGreet');
  const proactiveEnabled=document.getElementById('agentProactiveEnabled');
  const followupsEnabled=document.getElementById('agentFollowupsEnabled');
  const quietHours=document.getElementById('agentQuietHours');
  const quietStart=document.getElementById('agentQuietStart');
  const quietEnd=document.getElementById('agentQuietEnd');
  const followupDelay=document.getElementById('agentFollowupDelay');
  const interruptionBudget=document.getElementById('agentInterruptionBudget');
  const refreshCognitivePolicy=()=>{
   cognitiveLoop.setPolicy({...DEFAULT_COGNITIVE_POLICY,
    autoGreet:autoGreet.checked,quietEnabled:quietHours.checked,
    quietStart:quietStart.value,quietEnd:quietEnd.value});
   proactiveGovernor.setPolicy(normalizeProactivePolicy({...DEFAULT_PROACTIVE_POLICY,
    enabled:proactiveEnabled.checked,followupsEnabled:followupsEnabled.checked,
    followupDelayMs:Number(followupDelay.value),
    maxInterruptionsPerHour:Number(interruptionBudget.value)}));
   renderCognitiveStatus();
  };
  for(const control of [autoGreet,proactiveEnabled,followupsEnabled,quietHours,
   quietStart,quietEnd,followupDelay,interruptionBudget])
   control.addEventListener('change',refreshCognitivePolicy);
  autoGreet.checked=true;proactiveEnabled.checked=true;followupsEnabled.checked=true;
  quietHours.checked=false;followupDelay.value='60000';interruptionBudget.value='3';
  refreshCognitivePolicy();
  proactiveTimer=window.setInterval(()=>{void tickProactive();},1000);
  void tickProactive();
  sceneUI=createRoomSceneUi({
   getTracks:()=>state.running?publicRoomTracks():[],
   mirror:()=>ui.mirror.checked,
   onChange:message=>{
    roomTemporal.sceneChanged();
    renderRoomTemporalSummary();
    taskUI?.refresh();
    workflowUI?.refresh();
    const current=currentRoomIdentity();
    const identityChanged=Boolean(lastRoomIdentityId&&lastRoomIdentityId!==current.id);
    lastRoomIdentityId=current.id;
    multiRoomRuntime?.updateRoom({roomId:current.id,roomName:current.name});
    renderRoomHandoffUi();
    logRoomMessage('activity',message,'owner-scene',{semantic:'owner-map-edit'});
    if(identityChanged){
     roomPresence.unavailable();
     renderParticipantCards();
    }
   }
  });
  initRoomHandoffControls();
   taskUI=createAgentTaskUi({
    getScene:()=>effectiveRoomScene(),
    recordEvent:(category,message,source,options)=>recordProactiveSourceEvent(category,message,source,options),
    captureImage:captureGovernedSceneImage,
    cameraActive:()=>state.running&&ui.video.readyState>=2,
    documentVisible:()=>!document.hidden
   });
   void taskUI.init().catch(error=>console.warn('Task runtime initialization failed:',error));
   workflowUI=createAgentWorkflowUi({
    getScene:()=>effectiveRoomScene(),
    getParticipants:()=>state.identity.participants,
    recordEvent:(category,message,source,options)=>recordProactiveSourceEvent(category,message,source,options),
    captureImage:captureGovernedSceneImage,
    cameraActive:()=>state.running&&ui.video.readyState>=2,
    documentVisible:()=>!document.hidden
   });
   void workflowUI.init().catch(error=>console.warn('Workflow runtime initialization failed:',error));
  memoryUI=createAgentMemoryUi({
   participants:()=>state.identity.participants,
   getDialogueTurns:()=>state.voice.turns,
   getRoomEvents:()=>roomLedger.entries(),
    getMeetings:()=>meetingUI?.meetings?.()||[],
   getSituationalAwareness:()=>exportSituationalAwareness(roomSituationalAwareness),
   onAudit:(message,memory)=>logRoomMessage('system',message,'owner-memory',{
    kind:'decision',semantic:'owner-memory-change',participantId:memory?.participantId||null
   }),
   onChanged:()=>agentRuntime?.refreshConversation()
  });
  void memoryUI.init().catch(error=>console.warn('Memory runtime initialization failed:',error));
  recallUI=createSessionRecallUi({
   participants:()=>state.identity.participants,
   getCurrentRoomEvents:()=>roomLedger.entries(),
   getSessionMemories:()=>memoryUI?.getMemories?.()||[],
   getAgentHistory:()=>agentRuntime?.getHistory?.()||[],
   currentSessionIds:()=>[canonicalSessionId],
   currentSessionStartedAt:()=>roomSessionStartedAt
  });
  void recallUI.init().catch(error=>console.warn('Recall runtime initialization failed:',error));
  recordingUI=createRecordingUi({
   getStream:()=>state.voice.audio?.stream||null,
   getSessionId:()=>canonicalSessionId,
   getStorageHealth:()=>storageHealth,
   getStorageEstimate:()=>navigator.storage?.estimate?.()||Promise.resolve(null),
   onChanged:()=>{
    void recallUI?.refreshTimeline?.();
    if(String(document.getElementById('agentRecallQuery')?.value||'').trim())
     void recallUI?.search?.();
   },
   onAudit:(message,recording)=>logRoomMessage(
    'system',message,'owner-recording',{
     kind:'decision',semantic:'recording-lifecycle',
     relatedEventId:null,
     evidence:{durationMs:recording?.durationMs??null}
    }
   )
  });
  void recordingUI.init().catch(error=>console.warn('Recording runtime initialization failed:',error));
   void sceneUI.init().then(ok=>{
    if(ok){
     const toggle=document.getElementById('roomAdvancedMappingEnabled');
     const controls=document.getElementById('roomAdvancedMappingControls');
     const status=document.getElementById('roomAdvancedMappingStatus');
     let stored=null;try{stored=window.localStorage.getItem('tracky2-advanced-room-mapping');}catch{}
     const savedScene=sceneUI.getScene();
     const existingMap=Boolean(savedScene.calibration||savedScene.areas?.length||savedScene.objects?.length);
     advancedRoomMappingEnabled=stored==='yes'||(stored===null&&existingMap);
     const renderAdvancedMapping=()=>{
      if(toggle)toggle.checked=advancedRoomMappingEnabled;
      if(controls)controls.hidden=!advancedRoomMappingEnabled;
      if(status)status.textContent=advancedRoomMappingEnabled
       ?'Advanced mapping enabled · owner-defined zones, calibration and objects may be used for spatial context.'
       :'Advanced mapping is off · ROOM uses aggregate camera-relative observations only.';
     };
     renderAdvancedMapping();
     toggle?.addEventListener('change',()=>{
      advancedRoomMappingEnabled=toggle.checked;
      try{window.localStorage.setItem('tracky2-advanced-room-mapping',advancedRoomMappingEnabled?'yes':'no');}catch{}
      renderAdvancedMapping();roomTemporal.sceneChanged();renderRoomTemporalSummary();
      taskUI?.refresh();workflowUI?.refresh();
      logRoomMessage('system','Advanced Room Mapping '+(advancedRoomMappingEnabled?'enabled':'disabled')+' by owner',
       'owner-room-policy',{semantic:'advanced-room-mapping-policy'});
     });
     roomTemporal.sceneChanged();renderRoomTemporalSummary();taskUI?.refresh();
     lastRoomIdentityId=currentRoomIdentity().id;renderRoomHandoffUi();
     void startMultiRoomRuntime();
    }
   }).catch(error=>console.warn('Scene initialization failed:',error));
  ui.mirror.addEventListener('change',()=>sceneUI?.renderTracks());
  renderAmbientAudioMeter(true);
  const ambientAnalysis=document.getElementById('roomAnalyzeAcousticPatterns');
  if(ambientAnalysis){
    let savedAmbient=null;try{savedAmbient=window.localStorage.getItem('tracky2-room-acoustic-patterns');}catch{}
    ambientAnalysis.checked=savedAmbient!=='no';
    analyzeAmbientPatterns=ambientAnalysis.checked;
   ambientAnalysis.addEventListener('change',()=>{
    analyzeAmbientPatterns=ambientAnalysis.checked;
     try{window.localStorage.setItem('tracky2-room-acoustic-patterns',analyzeAmbientPatterns?'yes':'no');}catch{}
    if(analyzeAmbientPatterns)logRoomMessage('system',
     'Owner enabled local room energy-pattern notes · no sound identification','audio-consent');
    else logRoomMessage('system','Owner disabled local room energy-pattern notes','audio-consent');
   });
  }
  void refreshEnvironmentalFeedback();
  void refreshRoutineInsights({reloadFeedback:true});
  const routineRefresh=document.getElementById('roomRoutineRefresh');
  routineRefresh?.addEventListener('click',()=>void refreshRoutineInsights({reloadFeedback:true}));
  const routineClear=document.getElementById('roomRoutineClearFeedback');
  routineClear?.addEventListener('click',async()=>{
   if(!window.confirm('Clear saved routine review metadata on this device?'))return;
   try{
    await clearRoutineFeedback();routineFeedback=[];routineCandidates=[];
    routineLastDeviation=null;await refreshRoutineInsights({reloadFeedback:false});
    logRoomMessage('system','Owner cleared routine review metadata',
     'owner-routine-review',{semantic:'routine-feedback-cleared'});
   }catch(error){console.warn('Unable to clear routine reviews',error);}
  });
  const clearEnvironmentalFeedbackButton=document.getElementById('roomClearEnvironmentalFeedback');
  clearEnvironmentalFeedbackButton?.addEventListener('click',async()=>{
   if(!window.confirm('Clear saved environmental calibration feedback on this device?'))return;
   try{
    await clearEnvironmentalFeedback();
    environmentalFeedback=[];
    renderEnvironmentalAudio();
    logRoomMessage('system','Owner cleared environmental calibration feedback',
     'owner-environment-feedback',{semantic:'environmental-feedback-cleared'});
   }catch(error){console.warn('Unable to clear environmental feedback',error);}
  });
  const environmentalAudioToggle=document.getElementById('roomClassifyEnvironmentalAudio');
  if(environmentalAudioToggle){
    let savedEnvironmental=null;try{savedEnvironmental=window.localStorage.getItem('tracky2-room-environmental-audio');}catch{}
    environmentalAudioToggle.checked=savedEnvironmental!=='no';
    if(environmentalAudioToggle.checked)setEnvironmentalAudioEnabled(true);else renderEnvironmentalAudio();
   environmentalAudioToggle.addEventListener('change',()=>{
    setEnvironmentalAudioEnabled(environmentalAudioToggle.checked);
     try{window.localStorage.setItem('tracky2-room-environmental-audio',environmentalAudioToggle.checked?'yes':'no');}catch{}
    if(environmentalAudioToggle.checked){
     logRoomMessage('system',
      'Owner enabled session-only local environmental audio classification · raw audio is not saved or uploaded',
      'audio-consent',{semantic:'environmental-audio-consent'});
    }else{
     logRoomMessage('system',
      'Owner disabled environmental audio classification',
      'audio-consent',{semantic:'environmental-audio-consent'});
    }
   });
  }
  const musicIdToggle=document.getElementById('roomIdentifyMusic');
  if(musicIdToggle){
   let savedMusicId=null;try{savedMusicId=window.localStorage.getItem('tracky2-room-music-id');}catch{}
   musicIdToggle.checked=savedMusicId!=='no';
   musicIdentificationEnabled=musicIdToggle.checked;
   musicRecognitionQueue.setEnabled(musicIdentificationEnabled);
   if(!musicIdentificationEnabled)resetMusicIdentification('Music identification disabled');
   else renderMusicIdentification();
   musicIdToggle.addEventListener('change',()=>{
    musicIdentificationEnabled=musicIdToggle.checked;
    musicRecognitionQueue.setEnabled(musicIdentificationEnabled);
    const webToggle=document.getElementById('roomIdentifyMusicWeb');
    if(webToggle)webToggle.disabled=!musicIdentificationEnabled;
    const fingerprintToggle=document.getElementById('roomIdentifyMusicFingerprint');
    if(fingerprintToggle)fingerprintToggle.disabled=!musicIdentificationEnabled;
    if(!musicIdentificationEnabled)resetMusicIdentification('Music identification disabled');
    else{
     musicRecognitionGeneration++;
     musicRecognitionDecision='Waiting for stable music';
     renderMusicIdentification();
    }
    try{window.localStorage.setItem('tracky2-room-music-id',musicIdentificationEnabled?'yes':'no');}catch{}
    logRoomMessage('system',
     'Owner '+(musicIdentificationEnabled?'enabled':'disabled')+
      ' memory-only background music identification',
     'audio-consent',{semantic:'music-identification-consent'});
   });
  }
  const musicFingerprintToggle=document.getElementById('roomIdentifyMusicFingerprint');
  if(musicFingerprintToggle){
   let savedMusicFingerprint=null;
   try{savedMusicFingerprint=window.localStorage.getItem('tracky2-room-music-acrcloud');}catch{}
   musicFingerprintLookupEnabled=savedMusicFingerprint==='yes';
   musicFingerprintToggle.checked=musicFingerprintLookupEnabled;
   musicFingerprintToggle.disabled=!musicIdentificationEnabled;
   musicFingerprintToggle.addEventListener('change',()=>{
    musicFingerprintLookupEnabled=musicFingerprintToggle.checked&&musicIdentificationEnabled;
    musicFingerprintToggle.checked=musicFingerprintLookupEnabled;
    if(!musicFingerprintLookupEnabled){
     musicFingerprintAbortController?.abort();musicFingerprintAbortController=null;
    }
    try{window.localStorage.setItem(
     'tracky2-room-music-acrcloud',musicFingerprintLookupEnabled?'yes':'no'
    );}catch{}
    musicRecognitionDecision=musicFingerprintLookupEnabled
     ?'ACRCloud exact recognition enabled · waiting for a stable music window'
     :'ACRCloud exact recognition disabled · local Music ID continues';
    renderMusicIdentification();
    logRoomMessage('system',
     'Owner '+(musicFingerprintLookupEnabled?'enabled':'disabled')+
      ' ACRCloud exact music recognition for bounded music windows',
     'audio-consent',{semantic:'music-fingerprint-consent'});
   });
  }
  const musicWebToggle=document.getElementById('roomIdentifyMusicWeb');
  if(musicWebToggle){
   let savedMusicWeb=null;try{savedMusicWeb=window.localStorage.getItem('tracky2-room-music-web');}catch{}
   musicLyricWebLookupEnabled=savedMusicWeb==='yes';
   musicWebToggle.checked=musicLyricWebLookupEnabled;
   musicWebToggle.disabled=!musicIdentificationEnabled;
   musicWebToggle.addEventListener('change',()=>{
    musicLyricWebLookupEnabled=musicWebToggle.checked&&musicIdentificationEnabled;
    musicWebToggle.checked=musicLyricWebLookupEnabled;
    if(!musicLyricWebLookupEnabled){
     musicLyricWebAbortController?.abort();musicLyricWebAbortController=null;
     musicLyricLookupGuard.reset();
    }
    try{window.localStorage.setItem('tracky2-room-music-web',
     musicLyricWebLookupEnabled?'yes':'no');}catch{}
    musicRecognitionDecision=musicLyricWebLookupEnabled
     ?'Remote lyric lookup enabled · waiting for a usable music clue'
     :'Remote lyric lookup disabled · local music detection continues';
    renderMusicIdentification();
    logRoomMessage('system',
     'Owner '+(musicLyricWebLookupEnabled?'enabled':'disabled')+
      ' remote lyric web lookup for Music ID',
     'audio-consent',{semantic:'music-lyric-web-consent'});
   });
  }
  const mediaIdToggle=document.getElementById('roomIdentifyMedia');
  if(mediaIdToggle){
   let savedMediaId=null;try{savedMediaId=window.localStorage.getItem('tracky2-room-media-id');}catch{}
   mediaIdToggle.checked=savedMediaId!=='no';
   mediaIdentificationEnabled=mediaIdToggle.checked;
   mediaRecognitionQueue.setEnabled(mediaIdentificationEnabled);
   if(!mediaIdentificationEnabled)resetMediaIdentification('Recorded media identification disabled');
   else renderMediaIdentification();
   mediaIdToggle.addEventListener('change',()=>{
    mediaIdentificationEnabled=mediaIdToggle.checked;
    mediaRecognitionQueue.setEnabled(mediaIdentificationEnabled);
    const webToggle=document.getElementById('roomIdentifyMediaWeb');
    if(webToggle)webToggle.disabled=!mediaIdentificationEnabled;
    if(!mediaIdentificationEnabled)resetMediaIdentification('Recorded media identification disabled');
    else{
     mediaRecognitionGeneration++;
     mediaRecognitionDecision='Waiting for recorded TV / video / radio / podcast speech';
     renderMediaIdentification();
    }
    try{window.localStorage.setItem('tracky2-room-media-id',mediaIdentificationEnabled?'yes':'no');}catch{}
    logRoomMessage('system','Owner '+(mediaIdentificationEnabled?'enabled':'disabled')+
     ' memory-only TV / movie / streaming / radio / podcast identification',
     'audio-consent',{semantic:'media-identification-consent'});
   });
  }
  const mediaWebToggle=document.getElementById('roomIdentifyMediaWeb');
  if(mediaWebToggle){
   let savedMediaWeb=null;try{savedMediaWeb=window.localStorage.getItem('tracky2-room-media-web');}catch{}
   mediaWebLookupEnabled=savedMediaWeb==='yes';
   mediaWebToggle.checked=mediaWebLookupEnabled;mediaWebToggle.disabled=!mediaIdentificationEnabled;
   mediaWebToggle.addEventListener('change',()=>{
    mediaWebLookupEnabled=mediaWebToggle.checked&&mediaIdentificationEnabled;
    mediaWebToggle.checked=mediaWebLookupEnabled;
    if(!mediaWebLookupEnabled){
     mediaWebAbortController?.abort();mediaWebAbortController=null;mediaLookupGuard.reset();
    }
    try{window.localStorage.setItem('tracky2-room-media-web',mediaWebLookupEnabled?'yes':'no');}catch{}
    mediaRecognitionDecision=mediaWebLookupEnabled
     ?'Remote recorded-media lookup enabled · waiting for TV / radio / podcast evidence'
     :'Remote recorded-media lookup disabled · local detection continues';
    renderMediaIdentification();
    logRoomMessage('system','Owner '+(mediaWebLookupEnabled?'enabled':'disabled')+
     ' remote TV / movie / streaming / radio / podcast web lookup',
     'audio-consent',{semantic:'media-web-consent'});
   });
  }
  window.addEventListener('tracky:media-visual-clue',event=>{
   const detail=event?.detail&&typeof event.detail==='object'?event.detail:{};
   void processMediaVisualClue(detail);
  });
  const personalizedSoundsToggle=document.getElementById('roomPersonalizedSounds');
  if(personalizedSoundsToggle){
   let savedPersonalized=null;try{savedPersonalized=window.localStorage.getItem('tracky2-room-personalized-sounds');}catch{}
   personalizedSoundsEnabled=savedPersonalized==='yes';
   personalizedSoundsToggle.checked=personalizedSoundsEnabled;
   void refreshPersonalizedSoundProfiles();
   personalizedSoundsToggle.addEventListener('change',()=>{
    personalizedSoundsEnabled=personalizedSoundsToggle.checked;
    resetPersonalizedSoundRuntime();
    try{window.localStorage.setItem('tracky2-room-personalized-sounds',
     personalizedSoundsEnabled?'yes':'no');}catch{}
    logRoomMessage('system','Owner '+(personalizedSoundsEnabled?'enabled':'disabled')+
     ' local personalized sound learning and recognition',
     'audio-consent',{semantic:'personalized-sound-consent'});
   });
  }
  document.getElementById('roomTeachLatestSound')?.addEventListener('click',()=>
   void teachLatestPersonalizedSound());
  document.getElementById('roomClearPersonalizedSounds')?.addEventListener('click',async()=>{
   if(!window.confirm('Clear all owner-labeled personalized sound profiles on this device?'))return;
   try{
    await clearPersonalizedSoundProfiles();personalizedSoundProfiles=[];
    resetPersonalizedSoundRuntime();renderPersonalizedSounds();
    logRoomMessage('system','Owner cleared personalized sound profiles',
     'owner-sound-learning',{semantic:'personalized-sound-profiles-cleared'});
   }catch(error){console.warn('Unable to clear personalized sound profiles',error);}
  });
  const importantSoundsToggle=document.getElementById('roomImportantSoundEvents');
  if(importantSoundsToggle){
   let savedImportant=null;try{savedImportant=window.localStorage.getItem('tracky2-room-important-sounds');}catch{}
   importantEnvironmentalEventsEnabled=savedImportant!=='no';
   importantSoundsToggle.checked=importantEnvironmentalEventsEnabled;
   importantSoundsToggle.addEventListener('change',()=>{
    importantEnvironmentalEventsEnabled=importantSoundsToggle.checked;
    if(!importantEnvironmentalEventsEnabled){
     environmentalAlertTracker.reset();environmentalMechanicalTracker.reset();
    }
    try{window.localStorage.setItem('tracky2-room-important-sounds',
     importantEnvironmentalEventsEnabled?'yes':'no');}catch{}
    logRoomMessage('system','Owner '+(importantEnvironmentalEventsEnabled?'enabled':'disabled')+
     ' important environmental sound events and governed notices',
     'audio-consent',{semantic:'environmental-alert-consent'});
   });
  }
   const roomOptIn=document.getElementById('roomSaveObservations');
   const roomClear=document.getElementById('roomClearObservations');
   try{
    const savedRoomHistory=window.localStorage.getItem('tracky2-save-room-observations');
    saveRoomHistory=savedRoomHistory!=='no';
   }catch{saveRoomHistory=true;}
   roomOptIn.checked=saveRoomHistory;
  if(saveRoomHistory){
   loadSituationalAwareness();
   const epoch=roomPrivacyEpoch;
   void listRoomObservations().then(rows=>{
    if(epoch!==roomPrivacyEpoch)return;
    routineHistoryRows=[...rows];
    roomHistory=roomLedger.restore([...rows,...roomHistory]);
    renderRoomObservations();
    void refreshRoutineInsights({reloadFeedback:true});
   }).catch(console.warn);
  }
  roomOptIn.addEventListener('change',()=>{
   roomPrivacyEpoch++;
   saveRoomHistory=roomOptIn.checked;
   try{window.localStorage.setItem('tracky2-save-room-observations',saveRoomHistory?'yes':'no');}catch{}
   if(saveRoomHistory){
    persistCurrentRoomSnapshot();
    persistSituationalAwareness();
    void refreshRoutineInsights({reloadFeedback:true});
   }else{
    routineCandidates=[];routineLastDeviation=null;renderRoutineInsights();
   }
  });
  roomClear.addEventListener('click',async()=>{
   if(!window.confirm('Clear ROOM observations saved on this device?'))return;
   roomPrivacyEpoch++;
   roomLedger.clear();roomHistory=[];routineHistoryRows=[];
   routineCandidates=[];routineLastDeviation=null;
   clearSituationalAwareness();
   renderRoomObservations();renderRoutineInsights();
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
window.addEventListener('pagehide',event=>{
 if(event.persisted)return;
 prepareRuntimeExit('pagehide');
 if(state.mode!=='agent')return;
 void endStoredSessionIdentity(canonicalSessionId,'pagehide',Date.now())
  .catch(error=>console.warn('Session close metadata unavailable:',error));
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)return;
 void refreshStorageHealth();
 if(cameraRecoveryPending)void scheduleCameraRecovery('foreground-resume');
 if(microphoneRecoveryPending)void scheduleMicrophoneRecovery('foreground-resume');
 if(!state.running&&!cameraStoppedThisPage&&!cameraRecoveryPending)void maybeStartApprovedCamera();
 void multiRoomRuntime?.sync?.();
});

// V0.14.8J standalone ROOM-audio release certification contract.
export const V0148_RELEASE_VERSION='0.14.8';
export const V0148_AUDIO_GATES=Object.freeze([
 'environmental-awareness','speech-origin-separation','music-identification',
 'lyric-web-resolution','recorded-media-identification','important-sound-governance',
 'personalized-sound-learning','audio-visual-media-fusion','spoken-media-identification',
 'acrcloud-exact-recognition','unified-audio-orchestration','privacy-regression',
 'restart-recovery','package-integrity'
]);

const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function v0148AudioRuntimeBounds({
 environmentalQueueDepth=0,environmentalQueueLimit=2,
 musicQueueDepth=0,musicQueueLimit=1,
 mediaQueueDepth=0,mediaQueueLimit=1,
 roomAudioSessions=0,roomAudioSessionLimit=1,
 providerRequestsInFlight=0,providerRequestLimit=2
}={}){
 const rows=[
  ['environmentalQueueDepth','environmentalQueueLimit','environmental-queue'],
  ['musicQueueDepth','musicQueueLimit','music-queue'],
  ['mediaQueueDepth','mediaQueueLimit','media-queue'],
  ['roomAudioSessions','roomAudioSessionLimit','room-audio-session'],
  ['providerRequestsInFlight','providerRequestLimit','provider-requests']
 ];
 const values={environmentalQueueDepth,environmentalQueueLimit,musicQueueDepth,musicQueueLimit,
  mediaQueueDepth,mediaQueueLimit,roomAudioSessions,roomAudioSessionLimit,
  providerRequestsInFlight,providerRequestLimit};
 for(const key of Object.keys(values))values[key]=Math.max(0,Number(values[key])||0);
 const reasons=rows.filter(([v,l])=>values[v]>values[l]).map(([, ,r])=>r);
 return Object.freeze({status:reasons.length?'degraded':'healthy',reasons:Object.freeze(reasons),...values});
}

export function v0148PrivacyBoundary({
 rawAudioPersisted=false,rawAudioInRoomFeed=false,workingLyricsPersisted=false,
 recordedDialoguePersisted=false,cameraFramesUploaded=false,
 participantIdentityFromEnvironmentalAudio=false,remoteRecognitionRequiresOptIn=true
}={}){
 const violations=[];
 if(rawAudioPersisted)violations.push('raw-audio-persisted');
 if(rawAudioInRoomFeed)violations.push('raw-audio-room-feed');
 if(workingLyricsPersisted)violations.push('working-lyrics-persisted');
 if(recordedDialoguePersisted)violations.push('recorded-dialogue-persisted');
 if(cameraFramesUploaded)violations.push('camera-frames-uploaded');
 if(participantIdentityFromEnvironmentalAudio)violations.push('environmental-participant-identity');
 if(remoteRecognitionRequiresOptIn!==true)violations.push('remote-recognition-opt-in');
 return Object.freeze({status:violations.length?'violated':'preserved',violations:Object.freeze(violations)});
}

export function v0148RestartRecovery({
 environmentalReset=true,musicAbort=true,mediaAbort=true,
 unifiedSessionReset=true,providerCircuitPreserved=true,
 persistedRawAudio=false
}={}){
 const failed=[];
 if(!environmentalReset)failed.push('environmental-reset');
 if(!musicAbort)failed.push('music-abort');
 if(!mediaAbort)failed.push('media-abort');
 if(!unifiedSessionReset)failed.push('unified-session-reset');
 if(!providerCircuitPreserved)failed.push('provider-circuit');
 if(persistedRawAudio)failed.push('persisted-raw-audio');
 return Object.freeze({status:failed.length?'failed':'ready',failed:Object.freeze(failed)});
}

export function v0148ArtifactIntegrity({
 version='',zipVerified=false,checksumProduced=false,pwaVerified=false,
 auditPassed=false,phpFoundationPassed=false,acceptanceDocumentIncluded=false
}={}){
 const checks={
  version:String(version)===V0148_RELEASE_VERSION,zip:zipVerified===true,
  checksum:checksumProduced===true,pwa:pwaVerified===true,audit:auditPassed===true,
  php:phpFoundationPassed===true,acceptanceDocument:acceptanceDocumentIncluded===true
 };
 const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 return Object.freeze({status:failed.length?'incomplete':'verified',failed:Object.freeze(failed),checks:Object.freeze(checks)});
}

export function v0148ReleaseReadiness({
 gates={},runtimeBounds={},privacyBoundary={},restartRecovery={},artifactIntegrity={}
}={}){
 const passed=[],failed=[],pending=[];
 for(const gate of V0148_AUDIO_GATES){
  if(gates?.[gate]===true)passed.push(gate);
  else if(gates?.[gate]===false)failed.push(gate);
  else pending.push(gate);
 }
 const bounds=v0148AudioRuntimeBounds(runtimeBounds);
 const privacy=v0148PrivacyBoundary(privacyBoundary);
 const restart=v0148RestartRecovery(restartRecovery);
 const artifact=v0148ArtifactIntegrity(artifactIntegrity);
 const reasons=[];
 if(bounds.status!=='healthy')reasons.push('runtime-bounds');
 if(privacy.status!=='preserved')reasons.push('privacy-boundary');
 if(restart.status!=='ready')reasons.push('restart-recovery');
 if(artifact.status!=='verified')reasons.push('artifact-integrity');
 return Object.freeze({
  version:V0148_RELEASE_VERSION,
  status:failed.length||reasons.length?'failed':pending.length?'incomplete':'software-ready',
  passed:Object.freeze(passed),failed:Object.freeze(failed),pending:Object.freeze(pending),
  releaseReasons:Object.freeze(reasons),runtimeBounds:bounds,privacyBoundary:privacy,
  restartRecovery:restart,artifactIntegrity:artifact,
  liveDeviceCertification:'representative-device-required-for-hardware-claim',
  universalHardwareClaim:false
 });
}

export function v0148CertificationScenario(input={}){
 const allowed=['music','television','radio','recorded-media','important-sound','speech-origin','restart'];
 const kind=allowed.includes(String(input.kind))?String(input.kind):'unknown';
 return Object.freeze({
  kind,status:['pass','fail','not-run'].includes(String(input.status))?String(input.status):'not-run',
  durationMs:finite(input.durationMs)?Math.max(0,Math.round(input.durationMs)):null,
  rawAudioStored:false,participantId:null,
  note:String(input.note||'').replace(/[\r\n\t]+/g,' ').trim().slice(0,160)
 });
}

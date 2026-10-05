// V0.12J standalone release-readiness contract.
// Aggregate software evidence only. Never captures or stores media, transcripts,
// identity biometrics, or physical-device certification claims.

export const V012_RELEASE_VERSION='0.12.9';
export const V012_SOFTWARE_GATES=Object.freeze([
 'multimodal-identity',
 'shared-mic-diarization',
 'continuous-camera-voice-fusion',
 'multi-person-attribution',
 'session-identity-timeline',
 'multi-room-handoff',
 'spatial-audio-source',
 'agent-multimodal-reasoning',
 'long-session-hardening',
 'deletion-revocation-propagation',
 'privacy-regression',
 'accessibility-regression',
 'package-integrity'
]);

const finite=value=>typeof value==='number'&&Number.isFinite(value);

export function v012RuntimeBounds({
 listeningQueueDepth=0,listeningQueueLimit=4,
 diarizationClusters=0,diarizationClusterLimit=4,
 fusionLinks=0,fusionLinkLimit=8,
 roomEvents=0,roomEventLimit=120,
 visualHistory=0,visualHistoryLimit=72,
 activityEvents=0,activityEventLimit=36
}={}){
 const values={
  listeningQueueDepth:Math.max(0,Number(listeningQueueDepth)||0),
  listeningQueueLimit:Math.max(1,Number(listeningQueueLimit)||4),
  diarizationClusters:Math.max(0,Number(diarizationClusters)||0),
  diarizationClusterLimit:Math.max(1,Number(diarizationClusterLimit)||4),
  fusionLinks:Math.max(0,Number(fusionLinks)||0),
  fusionLinkLimit:Math.max(1,Number(fusionLinkLimit)||8),
  roomEvents:Math.max(0,Number(roomEvents)||0),
  roomEventLimit:Math.max(1,Number(roomEventLimit)||120),
  visualHistory:Math.max(0,Number(visualHistory)||0),
  visualHistoryLimit:Math.max(1,Number(visualHistoryLimit)||72),
  activityEvents:Math.max(0,Number(activityEvents)||0),
  activityEventLimit:Math.max(1,Number(activityEventLimit)||36)
 };
 const reasons=[];
 if(values.listeningQueueDepth>values.listeningQueueLimit)reasons.push('listening-queue');
 if(values.diarizationClusters>values.diarizationClusterLimit)reasons.push('diarization-clusters');
 if(values.fusionLinks>values.fusionLinkLimit)reasons.push('continuous-fusion-links');
 if(values.roomEvents>values.roomEventLimit)reasons.push('room-events');
 if(values.visualHistory>values.visualHistoryLimit)reasons.push('visual-history');
 if(values.activityEvents>values.activityEventLimit)reasons.push('activity-events');
 return Object.freeze({
  status:reasons.length?'degraded':'healthy',
  reasons:Object.freeze(reasons),
  ...values
 });
}

export function v012EvidenceBoundary({
 liveRoomMicrophones=1,canonicalTranscriptStores=1,
 identityOverrideAllowed=false,spatialIdentityAuthority=false,
 unknownAllowed=true,physicalCalibrationRequiredForMetric=true
}={}){
 const violations=[];
 if(Number(liveRoomMicrophones)!==1)violations.push('one-live-room-microphone');
 if(Number(canonicalTranscriptStores)!==1)violations.push('single-canonical-transcript-authority');
 if(identityOverrideAllowed===true)violations.push('agent-identity-override');
 if(spatialIdentityAuthority===true)violations.push('spatial-identity-authority');
 if(unknownAllowed!==true)violations.push('unknown-must-remain-valid');
 if(physicalCalibrationRequiredForMetric!==true)violations.push('metric-calibration-boundary');
 return Object.freeze({
  status:violations.length?'violated':'preserved',
  violations:Object.freeze(violations),
  liveRoomMicrophones:Number(liveRoomMicrophones),
  canonicalTranscriptStores:Number(canonicalTranscriptStores),
  identityOverrideAllowed:identityOverrideAllowed===true,
  spatialIdentityAuthority:spatialIdentityAuthority===true,
  unknownAllowed:unknownAllowed===true,
  physicalCalibrationRequiredForMetric:physicalCalibrationRequiredForMetric===true
 });
}

export function v012ArtifactIntegrity({
 version='',zipVerified=false,checksumProduced=false,
 pwaVerified=false,auditPassed=false,phpFoundationPassed=false
}={}){
 const expected=String(version)===V012_RELEASE_VERSION;
 const checks={
  version:expected,
  zip:zipVerified===true,
  checksum:checksumProduced===true,
  pwa:pwaVerified===true,
  audit:auditPassed===true,
  php:phpFoundationPassed===true
 };
 const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 return Object.freeze({
  status:failed.length?'incomplete':'verified',
  failed:Object.freeze(failed),checks:Object.freeze(checks)
 });
}

export function v012SoftwareReadiness({
 gates={},runtimeBounds={},evidenceBoundary={},artifactIntegrity={}
}={}){
 const passed=[],failed=[],pending=[];
 for(const gate of V012_SOFTWARE_GATES){
  const value=gates?.[gate];
  if(value===true)passed.push(gate);
  else if(value===false)failed.push(gate);
  else pending.push(gate);
 }
 const bounds=v012RuntimeBounds(runtimeBounds);
 const boundary=v012EvidenceBoundary(evidenceBoundary);
 const artifact=v012ArtifactIntegrity(artifactIntegrity);
 const runtimeReasons=[];
 if(bounds.status!=='healthy')runtimeReasons.push('runtime-bounds');
 if(boundary.status!=='preserved')runtimeReasons.push('evidence-boundary');
 if(artifact.status!=='verified')runtimeReasons.push('artifact-integrity');
 const status=failed.length||runtimeReasons.length?'failed':
  pending.length?'incomplete':'software-ready';
 return Object.freeze({
  version:V012_RELEASE_VERSION,status,
  physicalDeviceAcceptance:'separate-required-evidence',
  universalHardwareClaim:false,
  passed:Object.freeze(passed),failed:Object.freeze(failed),pending:Object.freeze(pending),
  runtimeReasons:Object.freeze(runtimeReasons),
  runtimeBounds:bounds,evidenceBoundary:boundary,artifactIntegrity:artifact
 });
}

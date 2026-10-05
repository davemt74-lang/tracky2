// V0.13J standalone release-certification contract.
export const V013_RELEASE_VERSION='0.13.9';
export const V013_SOFTWARE_GATES=Object.freeze([
 'representative-hardware-certification','overlap-source-separation',
 'advanced-participant-continuity','multi-room-runtime','recording-recall-runtime',
 'environmental-intelligence','routine-intelligence','proactive-agent-intelligence',
 'long-run-device-hardening','deletion-revocation-propagation',
 'privacy-regression','accessibility-regression','package-integrity'
]);

export function v013AuthorityBoundary({
 liveRoomMicrophones=1,canonicalTranscriptStores=1,hiddenRecordingAllowed=false,
 agentIdentityOverrideAllowed=false,noTeleportInference=true,unknownAllowed=true,
 sourceSeparationCreatesTranscriptAuthority=false,representativeHardwareClaimOnly=true
}={}){
 const violations=[];
 if(Number(liveRoomMicrophones)!==1)violations.push('one-live-room-microphone');
 if(Number(canonicalTranscriptStores)!==1)violations.push('single-canonical-transcript-authority');
 if(hiddenRecordingAllowed===true)violations.push('hidden-recording');
 if(agentIdentityOverrideAllowed===true)violations.push('agent-identity-override');
 if(noTeleportInference!==true)violations.push('no-teleport-boundary');
 if(unknownAllowed!==true)violations.push('unknown-must-remain-valid');
 if(sourceSeparationCreatesTranscriptAuthority===true)violations.push('source-separation-transcript-authority');
 if(representativeHardwareClaimOnly!==true)violations.push('universal-hardware-claim');
 return Object.freeze({
  status:violations.length?'violated':'preserved',
  violations:Object.freeze(violations),
  liveRoomMicrophones:Number(liveRoomMicrophones),
  canonicalTranscriptStores:Number(canonicalTranscriptStores),
  hiddenRecordingAllowed:hiddenRecordingAllowed===true,
  agentIdentityOverrideAllowed:agentIdentityOverrideAllowed===true,
  noTeleportInference:noTeleportInference===true,
  unknownAllowed:unknownAllowed===true,
  sourceSeparationCreatesTranscriptAuthority:sourceSeparationCreatesTranscriptAuthority===true,
  representativeHardwareClaimOnly:representativeHardwareClaimOnly===true
 });
}

export function v013RuntimeBounds({
 listeningQueueDepth=0,listeningQueueLimit=4,
 diarizationClusters=0,diarizationClusterLimit=4,
 fusionLinks=0,fusionLinkLimit=8,
 roomEvents=0,roomEventLimit=120,
 visualHistory=0,visualHistoryLimit=72,
 activityEvents=0,activityEventLimit=36,
 certificationEvents=0,certificationEventLimit=160,
 continuityHistory=0,continuityHistoryLimit=36,
 multiRoomEvents=0,multiRoomEventLimit=512,
 environmentalGroups=0,environmentalGroupLimit=80,
 environmentalFeedback=0,environmentalFeedbackLimit=200,
 routineRows=0,routineRowLimit=60,
 routineFeedback=0,routineFeedbackLimit=160,
 proactivePending=0,proactivePendingLimit=24,
 performanceSamples=0,performanceSampleLimit=360,
 recordingIndexRows=0,recordingIndexLimit=120
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
  activityEventLimit:Math.max(1,Number(activityEventLimit)||36),
  certificationEvents:Math.max(0,Number(certificationEvents)||0),
  certificationEventLimit:Math.max(1,Number(certificationEventLimit)||160),
  continuityHistory:Math.max(0,Number(continuityHistory)||0),
  continuityHistoryLimit:Math.max(1,Number(continuityHistoryLimit)||36),
  multiRoomEvents:Math.max(0,Number(multiRoomEvents)||0),
  multiRoomEventLimit:Math.max(1,Number(multiRoomEventLimit)||512),
  environmentalGroups:Math.max(0,Number(environmentalGroups)||0),
  environmentalGroupLimit:Math.max(1,Number(environmentalGroupLimit)||80),
  environmentalFeedback:Math.max(0,Number(environmentalFeedback)||0),
  environmentalFeedbackLimit:Math.max(1,Number(environmentalFeedbackLimit)||200),
  routineRows:Math.max(0,Number(routineRows)||0),
  routineRowLimit:Math.max(1,Number(routineRowLimit)||60),
  routineFeedback:Math.max(0,Number(routineFeedback)||0),
  routineFeedbackLimit:Math.max(1,Number(routineFeedbackLimit)||160),
  proactivePending:Math.max(0,Number(proactivePending)||0),
  proactivePendingLimit:Math.max(1,Number(proactivePendingLimit)||24),
  performanceSamples:Math.max(0,Number(performanceSamples)||0),
  performanceSampleLimit:Math.max(1,Number(performanceSampleLimit)||360),
  recordingIndexRows:Math.max(0,Number(recordingIndexRows)||0),
  recordingIndexLimit:Math.max(1,Number(recordingIndexLimit)||120)
 };
 const checks=[
  ['listeningQueueDepth','listeningQueueLimit','listening-queue'],
  ['diarizationClusters','diarizationClusterLimit','diarization-clusters'],
  ['fusionLinks','fusionLinkLimit','continuous-fusion-links'],
  ['roomEvents','roomEventLimit','room-events'],
  ['visualHistory','visualHistoryLimit','visual-history'],
  ['activityEvents','activityEventLimit','activity-events'],
  ['certificationEvents','certificationEventLimit','certification-events'],
  ['continuityHistory','continuityHistoryLimit','continuity-history'],
  ['multiRoomEvents','multiRoomEventLimit','multi-room-events'],
  ['environmentalGroups','environmentalGroupLimit','environmental-groups'],
  ['environmentalFeedback','environmentalFeedbackLimit','environmental-feedback'],
  ['routineRows','routineRowLimit','routine-history'],
  ['routineFeedback','routineFeedbackLimit','routine-feedback'],
  ['proactivePending','proactivePendingLimit','proactive-pending'],
  ['performanceSamples','performanceSampleLimit','performance-samples'],
  ['recordingIndexRows','recordingIndexLimit','recording-index']
 ];
 const reasons=checks.filter(([v,l])=>values[v]>values[l]).map(([, ,reason])=>reason);
 return Object.freeze({status:reasons.length?'degraded':'healthy',reasons:Object.freeze(reasons),...values});
}

export function v013RepresentativeDeviceScope({
 hardwareReportPresent=false,hardwareStatus='not-run',
 performanceEvidencePresent=false,performanceStatus='not-run',
 universalHardwareClaim=false
}={}){
 const normalize=value=>['not-run','pass','partial','fail'].includes(String(value))
  ?String(value):'not-run';
 const violations=universalHardwareClaim===true?['universal-hardware-claim']:[];
 return Object.freeze({
  status:violations.length?'violated':
   hardwareReportPresent||performanceEvidencePresent?'representative-evidence':'software-only',
  violations:Object.freeze(violations),
  hardwareReportPresent:hardwareReportPresent===true,
  hardwareStatus:normalize(hardwareStatus),
  performanceEvidencePresent:performanceEvidencePresent===true,
  performanceStatus:normalize(performanceStatus),
  universalHardwareClaim:false,
  certificationScope:'representative-device'
 });
}

export function v013ArtifactIntegrity({
 version='',zipVerified=false,checksumProduced=false,pwaVerified=false,
 auditPassed=false,phpFoundationPassed=false,directReleaseAssets=false,
 acceptanceDocumentIncluded=false
}={}){
 const checks={
  version:String(version)===V013_RELEASE_VERSION,zip:zipVerified===true,
  checksum:checksumProduced===true,pwa:pwaVerified===true,
  audit:auditPassed===true,php:phpFoundationPassed===true,
  directReleaseAssets:directReleaseAssets===true,
  acceptanceDocument:acceptanceDocumentIncluded===true
 };
 const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 return Object.freeze({status:failed.length?'incomplete':'verified',failed:Object.freeze(failed),checks:Object.freeze(checks)});
}

export function v013ReleaseReadiness({
 gates={},runtimeBounds={},authorityBoundary={},
 representativeDeviceScope={},artifactIntegrity={}
}={}){
 const passed=[],failed=[],pending=[];
 for(const gate of V013_SOFTWARE_GATES){
  const value=gates?.[gate];
  if(value===true)passed.push(gate);
  else if(value===false)failed.push(gate);
  else pending.push(gate);
 }
 const bounds=v013RuntimeBounds(runtimeBounds);
 const authority=v013AuthorityBoundary(authorityBoundary);
 const device=v013RepresentativeDeviceScope(representativeDeviceScope);
 const artifact=v013ArtifactIntegrity(artifactIntegrity);
 const reasons=[];
 if(bounds.status!=='healthy')reasons.push('runtime-bounds');
 if(authority.status!=='preserved')reasons.push('authority-boundary');
 if(device.status==='violated')reasons.push('representative-device-scope');
 if(artifact.status!=='verified')reasons.push('artifact-integrity');
 const status=failed.length||reasons.length?'failed':pending.length?'incomplete':'software-ready';
 return Object.freeze({
  version:V013_RELEASE_VERSION,status,
  passed:Object.freeze(passed),failed:Object.freeze(failed),pending:Object.freeze(pending),
  releaseReasons:Object.freeze(reasons),runtimeBounds:bounds,authorityBoundary:authority,
  representativeDeviceScope:device,artifactIntegrity:artifact,
  hardwareCertification:'representative-device-only',universalHardwareClaim:false
 });
}

export function v013CertificationDigestInput({
 releaseVersion=V013_RELEASE_VERSION,softwareStatus='unknown',
 hardwareStatus='not-run',performanceStatus='not-run',mergedCommit=''
}={}){
 return Object.freeze({
  releaseVersion:String(releaseVersion),softwareStatus:String(softwareStatus),
  hardwareStatus:String(hardwareStatus),performanceStatus:String(performanceStatus),
  mergedCommit:String(mergedCommit).slice(0,64),universalHardwareClaim:false
 });
}

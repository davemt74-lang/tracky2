// V0.11J standalone release-readiness primitives.
// Aggregate software evidence only. Never stores frames, audio, transcripts, identity,
// biometrics, or physical-device claims.

export const V011_SOFTWARE_GATES=Object.freeze([
 'conversation-listening',
 'speaker-participant',
 'transcription',
 'multi-participant',
 'meeting-runtime',
 'environmental-audio',
 'spatial-interaction',
 'proactive-agent',
 'session-recall',
 'runtime-resilience',
 'privacy-regression',
 'accessibility-regression',
 'package-integrity'
]);

export function boundedBacklogHealth({
 queueDepth=0,oldestAgeMs=0,maxDepth=4,maxAgeMs=30000,dropped=0
}={}){
 const depth=Math.max(0,Math.floor(Number(queueDepth)||0));
 const age=Math.max(0,Number(oldestAgeMs)||0);
 const depthLimit=Math.max(1,Math.floor(Number(maxDepth)||4));
 const ageLimit=Math.max(1000,Number(maxAgeMs)||30000);
 const dropCount=Math.max(0,Math.floor(Number(dropped)||0));
 const reasons=[];
 if(depth>depthLimit)reasons.push('queue-depth');
 if(age>ageLimit)reasons.push('queue-age');
 if(dropCount>0)reasons.push('dropped-work');
 return Object.freeze({
  status:reasons.length?'degraded':'healthy',
  reasons:Object.freeze(reasons),queueDepth:depth,oldestAgeMs:age,dropped:dropCount,
  maxDepth:depthLimit,maxAgeMs:ageLimit
 });
}

export function modelServiceHealth({
 configured=false,available=true,pending=false,lastError=''
}={}){
 const error=String(lastError||'').trim().slice(0,200);
 if(!configured)return Object.freeze({status:'optional-disabled',blocking:false,lastError:''});
 if(pending)return Object.freeze({status:'pending',blocking:false,lastError:error});
 if(!available)return Object.freeze({status:'degraded-fallback',blocking:false,lastError:error});
 return Object.freeze({status:'healthy',blocking:false,lastError:''});
}

export function meetingLifecycleHealth(meetings=[]){
 const rows=Array.isArray(meetings)?meetings:[];
 let active=0,invalid=0;
 for(const meeting of rows){
  if(!meeting?.id){invalid++;continue;}
  const status=String(meeting.status||'ended');
  if(status==='active')active++;
  if(status==='ended'&&Number(meeting.endedAt)>0&&Number(meeting.startedAt)>Number(meeting.endedAt))
   invalid++;
 }
 const reasons=[];
 if(active>1)reasons.push('multiple-active-meetings');
 if(invalid)reasons.push('invalid-meeting-record');
 return Object.freeze({
  status:reasons.length?'degraded':'healthy',active,invalid,
  reasons:Object.freeze(reasons)
 });
}

export function v011SoftwareReadiness({
 gates={},backlog={},model={},meetings=[],storageStatus='healthy',
 permissionState='healthy'
}={}){
 const passed=[],failed=[],pending=[];
 for(const gate of V011_SOFTWARE_GATES){
  const value=gates?.[gate];
  if(value===true)passed.push(gate);
  else if(value===false)failed.push(gate);
  else pending.push(gate);
 }
 const backlogHealth=boundedBacklogHealth(backlog);
 const modelHealth=modelServiceHealth(model);
 const meetingHealth=meetingLifecycleHealth(meetings);
 const runtimeReasons=[];
 if(backlogHealth.status!=='healthy')runtimeReasons.push('backlog');
 if(meetingHealth.status!=='healthy')runtimeReasons.push('meeting-lifecycle');
 if(String(storageStatus)==='critical')runtimeReasons.push('storage-critical');
 if(['denied','revoked'].includes(String(permissionState)))runtimeReasons.push('permission-unavailable');
 const softwareStatus=failed.length||runtimeReasons.length?'failed':
  pending.length?'incomplete':'software-ready';
 return Object.freeze({
  status:softwareStatus,
  physicalDeviceAcceptance:'separate-required-evidence',
  passed:Object.freeze(passed),failed:Object.freeze(failed),pending:Object.freeze(pending),
  runtimeReasons:Object.freeze(runtimeReasons),
  backlog:backlogHealth,model:modelHealth,meetings:meetingHealth
 });
}

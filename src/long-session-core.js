export const LONG_SESSION_SCHEMA=1;
export const LONG_SESSION_MAX_PARTICIPANT_REFS=128;

const short=(value,max=96)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).map(value=>short(value)).filter(Boolean))];

export function boundedParticipantIds(values=[],limit=LONG_SESSION_MAX_PARTICIPANT_REFS){
 const cap=Math.max(1,Math.min(512,Math.floor(Number(limit)||LONG_SESSION_MAX_PARTICIPANT_REFS)));
 return Object.freeze(uniq(values).slice(-cap));
}

export function reconcileParticipantSet(values=[],validParticipantIds=[],limit=LONG_SESSION_MAX_PARTICIPANT_REFS){
 const valid=new Set(uniq(validParticipantIds));
 return boundedParticipantIds(
  Array.from(values||[]).filter(id=>valid.has(String(id))),
  limit
 );
}

export function reconcileParticipantMap(entries=[],validParticipantIds=[],limit=LONG_SESSION_MAX_PARTICIPANT_REFS){
 const valid=new Set(uniq(validParticipantIds));
 const cap=Math.max(1,Math.min(512,Math.floor(Number(limit)||LONG_SESSION_MAX_PARTICIPANT_REFS)));
 const rows=Array.from(entries||[]).filter(entry=>
  Array.isArray(entry)&&entry.length>=2&&valid.has(String(entry[0]))
 );
 return Object.freeze(rows.slice(-cap).map(([key,value])=>
  Object.freeze([short(key),value])
 ));
}

export function longSessionHealth({
 listening=null,diarization=null,continuousFusion=null,
 roomEventCount=0,visualHistoryCount=0,activityEventCount=0,
 participantRefCounts={}
}={}){
 const issues=[];
 const queueDepth=Math.max(0,Number(listening?.queueDepth)||0);
 const diarizationClusters=Math.max(0,Number(diarization?.clusterCount)||0);
 const fusionLinks=Array.isArray(continuousFusion)?continuousFusion.length:
  Math.max(0,Number(continuousFusion?.linkCount)||0);
 const counts={
  announcedParticipants:Math.max(0,Number(participantRefCounts.announcedParticipants)||0),
  seenParticipants:Math.max(0,Number(participantRefCounts.seenParticipants)||0),
  lastZones:Math.max(0,Number(participantRefCounts.lastZones)||0),
  greeted:Math.max(0,Number(participantRefCounts.greeted)||0)
 };
 if(queueDepth>12)issues.push('listening-queue-unbounded');
 if(diarizationClusters>8)issues.push('diarization-clusters-unbounded');
 if(fusionLinks>8)issues.push('continuous-fusion-links-unbounded');
 if(Number(roomEventCount)>120)issues.push('room-events-unbounded');
 if(Number(visualHistoryCount)>200)issues.push('visual-history-unbounded');
 if(Number(activityEventCount)>36)issues.push('activity-events-unbounded');
 for(const [name,count] of Object.entries(counts))
  if(count>LONG_SESSION_MAX_PARTICIPANT_REFS)issues.push(name+'-unbounded');
 return Object.freeze({
  schema:LONG_SESSION_SCHEMA,
  status:issues.length?'degraded':'healthy',
  issues:Object.freeze(issues),
  queueDepth,diarizationClusters,fusionLinks,
  roomEventCount:Math.max(0,Number(roomEventCount)||0),
  visualHistoryCount:Math.max(0,Number(visualHistoryCount)||0),
  activityEventCount:Math.max(0,Number(activityEventCount)||0),
  participantRefCounts:Object.freeze(counts)
 });
}

export function restartIntegritySnapshot({
 listening=null,roomTrackHistory=[],participantRefs={},transientTurnState={}
}={}){
 const stale=[];
 if((listening?.queueDepth||0)>0)stale.push('audio-queue');
 if(listening?.processingSegmentId)stale.push('audio-processing');
 if((roomTrackHistory||[]).length)stale.push('visual-history');
 for(const [key,value] of Object.entries(participantRefs||{}))
  if((value instanceof Set||value instanceof Map)&&value.size)stale.push(key);
 for(const [key,value] of Object.entries(transientTurnState||{}))
  if(value!==null&&value!==false&&value!==0&&value!==''&&
     !(Array.isArray(value)&&value.length===0))stale.push(key);
 return Object.freeze({
  clean:stale.length===0,
  stale:Object.freeze(stale.slice(0,32))
 });
}

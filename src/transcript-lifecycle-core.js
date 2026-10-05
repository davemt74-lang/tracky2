export const TRANSCRIPT_LIFECYCLE_VERSION=1;
export const TRANSCRIPT_STATES=Object.freeze([
 'pending','partial','final','corrected','cancelled','unavailable'
]);
export const MAX_TRANSCRIPT_EXPORT_TURNS=1000;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const cleanText=value=>String(value||'').replace(/\s+/g,' ').trim();

function cleanConfidence(value){
 return finite(value)?Math.max(0,Math.min(1,value)):null;
}

function baseRecord(input={}){
 const at=finite(input.at)?input.at:Date.now();
 return {
  lifecycleVersion:TRANSCRIPT_LIFECYCLE_VERSION,
  segmentId:String(input.segmentId||'').slice(0,96),
  sessionId:String(input.sessionId||'room-session').slice(0,96),
  generation:Number.isInteger(input.generation)&&input.generation>=0?input.generation:0,
  state:'pending',
  text:'',
  partialText:'',
  source:String(input.source||'local-whisper').slice(0,64),
  modelId:String(input.modelId||'').slice(0,160)||null,
  modelRevision:String(input.modelRevision||'').slice(0,80)||null,
  confidence:null,
  language:String(input.language||'').slice(0,24)||null,
  captureDurationMs:finite(input.captureDurationMs)?Math.max(0,input.captureDurationMs):null,
  startedAt:at,
  updatedAt:at,
  completedAt:null,
  processingDurationMs:null,
  cancelReason:null
 };
}

export class TranscriptLifecycleController{
 constructor(){this.records=new Map();}
 begin(input={}){
  if(!input.segmentId)throw new Error('Transcript lifecycle requires segmentId.');
  const record=baseRecord(input);
  this.records.set(record.segmentId,record);
  return Object.freeze({...record});
 }
 partial(segmentId,text,{at=Date.now(),confidence=null}={}){
  const current=this.records.get(segmentId);
  if(!current||['final','corrected','cancelled','unavailable'].includes(current.state))return null;
  const partialText=cleanText(text);
  const next={...current,state:'partial',partialText,updatedAt:at,
   confidence:cleanConfidence(confidence)};
  this.records.set(segmentId,next);
  return Object.freeze({...next,ephemeral:true});
 }
 finalize(segmentId,{
  text,at=Date.now(),confidence=null,language=null,processingDurationMs=null,
  source=null,modelId=null,modelRevision=null
 }={}){
  const current=this.records.get(segmentId);
  if(!current||current.state==='cancelled')return null;
  const finalText=cleanText(text);
  const next={...current,state:finalText?'final':'unavailable',text:finalText,
   partialText:'',updatedAt:at,completedAt:at,
   source:String(source||current.source||'local-whisper').slice(0,64),
   modelId:String(modelId||current.modelId||'').slice(0,160)||null,
   modelRevision:String(modelRevision||current.modelRevision||'').slice(0,80)||null,
   confidence:cleanConfidence(confidence),
   language:String(language||current.language||'').slice(0,24)||null,
   processingDurationMs:finite(processingDurationMs)?
    Math.max(0,processingDurationMs):Math.max(0,at-current.startedAt)};
  this.records.set(segmentId,next);
  return Object.freeze({...next});
 }
 cancel(segmentId,reason='cancelled',at=Date.now()){
  const current=this.records.get(segmentId);
  if(!current)return null;
  const next={...current,state:'cancelled',partialText:'',updatedAt:at,
   completedAt:at,cancelReason:String(reason||'cancelled').slice(0,96)};
  this.records.set(segmentId,next);
  return Object.freeze({...next});
 }
 get(segmentId){
  const record=this.records.get(segmentId);
  return record?Object.freeze({...record}):null;
 }
 forget(segmentId){return this.records.delete(segmentId);}
 clear(){this.records.clear();}
}

export function canonicalTranscriptFields(record={}){
 const state=record.state==='final'?'final':record.state==='corrected'?'corrected':
  record.state==='unavailable'?'unavailable':'unavailable';
 return Object.freeze({
  transcriptLifecycleVersion:TRANSCRIPT_LIFECYCLE_VERSION,
  transcriptState:state,
  transcriptSource:String(record.source||'local-whisper').slice(0,64),
  transcriptModelId:String(record.modelId||'').slice(0,160)||null,
  transcriptModelRevision:String(record.modelRevision||'').slice(0,80)||null,
  transcriptConfidence:cleanConfidence(record.confidence),
  transcriptLanguage:String(record.language||'').slice(0,24)||null,
  transcriptSegmentId:String(record.segmentId||'').slice(0,96)||null,
  transcriptCaptureDurationMs:finite(record.captureDurationMs)?
   Math.max(0,record.captureDurationMs):null,
  transcriptProcessingDurationMs:finite(record.processingDurationMs)?
   Math.max(0,record.processingDurationMs):null,
  transcribedAt:finite(record.completedAt)?new Date(record.completedAt).toISOString():null
 });
}

export function transcriptSessionSummaries(turns=[]){
 const groups=new Map();
 for(const turn of Array.isArray(turns)?turns:[]){
  const sessionId=String(turn?.sessionId||'room-session');
  const at=Date.parse(turn?.createdAt||'')||Number(turn?.at||0)||0;
  const current=groups.get(sessionId)||{
   sessionId,turnCount:0,transcriptCount:0,correctedCount:0,
   startedAt:null,endedAt:null,participantIds:new Set()
  };
  current.turnCount+=1;
  if(cleanText(turn?.transcript))current.transcriptCount+=1;
  if(turn?.transcriptState==='corrected'||turn?.transcriptEditedAt)current.correctedCount+=1;
  if(turn?.participantId)current.participantIds.add(turn.participantId);
  if(at>0){
   current.startedAt=current.startedAt===null?at:Math.min(current.startedAt,at);
   current.endedAt=current.endedAt===null?at:Math.max(current.endedAt,at);
  }
  groups.set(sessionId,current);
 }
 return Object.freeze([...groups.values()].map(item=>Object.freeze({
  sessionId:item.sessionId,turnCount:item.turnCount,transcriptCount:item.transcriptCount,
  correctedCount:item.correctedCount,startedAt:item.startedAt,endedAt:item.endedAt,
  participantIds:Object.freeze([...item.participantIds])
 })).sort((a,b)=>(b.endedAt||0)-(a.endedAt||0)));
}

export function searchTranscriptTurns(turns=[],query='',options={}){
 const q=cleanText(query).toLocaleLowerCase();
 const limit=Math.max(1,Math.min(200,Number(options.limit)||50));
 if(!q)return Object.freeze([]);
 const participantId=options.participantId||null;
 const sessionId=options.sessionId||null;
 return Object.freeze((Array.isArray(turns)?turns:[])
  .filter(turn=>cleanText(turn?.transcript))
  .filter(turn=>!participantId||turn.participantId===participantId)
  .filter(turn=>!sessionId||turn.sessionId===sessionId)
  .filter(turn=>cleanText(turn.transcript).toLocaleLowerCase().includes(q))
  .sort((a,b)=>(Date.parse(b.createdAt||'')||b.at||0)-(Date.parse(a.createdAt||'')||a.at||0))
  .slice(0,limit)
  .map(turn=>Object.freeze({...turn})));
}

export function transcriptExport(turns=[],participants=[],options={}){
 const people=new Map((Array.isArray(participants)?participants:[]).map(p=>[p.id,p]));
 const sessionId=options.sessionId||null;
 const participantId=options.participantId||null;
 const includeUnknown=options.includeUnknown!==false;
 const selected=(Array.isArray(turns)?turns:[])
  .filter(turn=>cleanText(turn?.transcript))
  .filter(turn=>!sessionId||turn.sessionId===sessionId)
  .filter(turn=>!participantId||
   turn.participantId===participantId||
   (turn.multiPersonParticipantIds||[]).includes(participantId)||
   (turn.multiPersonCandidateParticipantIds||[]).includes(participantId))
  .filter(turn=>includeUnknown||Boolean(
   turn.participantId||(turn.multiPersonParticipantIds||[]).length
  ))
  .sort((a,b)=>(Date.parse(a.createdAt||'')||a.at||0)-(Date.parse(b.createdAt||'')||b.at||0))
  .slice(-MAX_TRANSCRIPT_EXPORT_TURNS);

 const rows=selected.map(turn=>{
  const person=turn.participantId?people.get(turn.participantId):null;
  const attributionIntervals=Array.from(turn.multiPersonAttributionIntervals||[])
   .slice(0,16).map(interval=>{
    const intervalPerson=interval?.participantId?people.get(interval.participantId):null;
    const candidates=Array.from(interval?.candidateParticipantIds||[]).slice(0,6);
    return Object.freeze({
     id:String(interval?.id||'').slice(0,96),
     startOffsetMs:Math.max(0,Number(interval?.startOffsetMs)||0),
     endOffsetMs:Math.max(0,Number(interval?.endOffsetMs)||0),
     state:String(interval?.state||'unknown').slice(0,48),
     speakerClusterId:String(interval?.speakerClusterId||'').slice(0,48)||null,
     candidateClusterIds:Object.freeze(
      Array.from(interval?.candidateClusterIds||[]).map(value=>String(value).slice(0,48)).slice(0,4)
     ),
     participantId:interval?.participantId||null,
     participantName:interval?.participantId
      ?(intervalPerson?.nickname||intervalPerson?.name||'Participant'):null,
     candidateParticipantIds:Object.freeze(candidates),
     candidateParticipantNames:Object.freeze(candidates.map(id=>{
      const candidate=people.get(id);
      return candidate?.nickname||candidate?.name||'Participant';
     })),
     confidence:cleanConfidence(interval?.confidence),
     authority:String(interval?.authority||'derived').slice(0,48),
     provenance:Object.freeze(
      Array.from(interval?.provenance||[]).map(value=>String(value).slice(0,96)).slice(0,12)
     ),
     conflicts:Object.freeze(
      Array.from(interval?.conflicts||[]).map(value=>String(value).slice(0,96)).slice(0,8)
     ),
     reason:String(interval?.reason||'').slice(0,120)||null,
     correctedAt:finite(interval?.correctedAt)?interval.correctedAt:null,
     correctedBy:String(interval?.correctedBy||'').slice(0,48)||null
    });
   });
  const attributionCorrections=Array.from(turn.multiPersonAttributionCorrections||[])
   .slice(-10).map(correction=>Object.freeze({
    at:Math.max(0,Number(correction?.at)||0),
    intervalId:String(correction?.intervalId||'').slice(0,96),
    previousParticipantId:correction?.previousParticipantId||null,
    participantId:correction?.participantId||null,
    previousState:String(correction?.previousState||'').slice(0,48)||null,
    source:'local-owner',
    note:String(correction?.note||'').slice(0,160)||null
   }));
  return Object.freeze({
   id:String(turn.id||'').slice(0,96),
   sessionId:String(turn.sessionId||'room-session').slice(0,96),
   createdAt:turn.createdAt||null,
   participantId:turn.participantId||null,
   participantName:turn.participantId?(person?.nickname||person?.name||turn.participantName||'Participant'):'Unknown speaker',
   speakerVerified:Boolean(turn.participantId&&turn.attribution!=='unknown'),
   associationState:String(turn.associationState||'unknown-speaker').slice(0,64),
   roomId:String(turn.roomId||'').slice(0,96)||null,
   roomName:String(turn.roomName||'').slice(0,96)||null,
   roomPresenceState:String(turn.roomPresenceState||'').slice(0,64)||null,
   currentRoomId:String(turn.currentRoomId||'').slice(0,96)||null,
   lastKnownRoomId:String(turn.lastKnownRoomId||'').slice(0,96)||null,
   candidateRoomIds:Object.freeze(
    Array.from(turn.candidateRoomIds||[]).map(value=>String(value).slice(0,96)).slice(0,8)
   ),
   roomTransition:turn.roomTransition?Object.freeze({
    type:String(turn.roomTransition.type||'').slice(0,64),
    fromRoomId:String(turn.roomTransition.fromRoomId||'').slice(0,96)||null,
    toRoomId:String(turn.roomTransition.toRoomId||'').slice(0,96)||null,
    roomId:String(turn.roomTransition.roomId||'').slice(0,96)||null,
    at:finite(turn.roomTransition.at)?turn.roomTransition.at:null,
    declaredAt:finite(turn.roomTransition.declaredAt)?turn.roomTransition.declaredAt:null,
    confirmedAt:finite(turn.roomTransition.confirmedAt)?turn.roomTransition.confirmedAt:null,
    authority:String(turn.roomTransition.authority||'').slice(0,48)||null
   }):null,
   roomHandoffReason:String(turn.roomHandoffReason||'').slice(0,160)||null,
   roomHandoffProvenance:Object.freeze(
    Array.from(turn.roomHandoffProvenance||[]).map(value=>String(value).slice(0,96)).slice(0,12)
   ),
   spatialAudioSourceState:String(turn.spatialAudioSourceState||'').slice(0,64)||null,
   spatialAudioDirection:String(turn.spatialAudioDirection||'').slice(0,32)||null,
   spatialAudioDirectionConfidence:cleanConfidence(turn.spatialAudioDirectionConfidence),
   spatialAudioAudioDirection:String(turn.spatialAudioAudioDirection||'').slice(0,32)||null,
   spatialAudioVisualDirection:String(turn.spatialAudioVisualDirection||'').slice(0,32)||null,
   spatialAudioAgreement:turn.spatialAudioAgreement===true?true:
    turn.spatialAudioAgreement===false?false:null,
   spatialAudioMetric:turn.spatialAudioMetric===true,
   spatialAudioDistanceM:finite(turn.spatialAudioDistanceM)?turn.spatialAudioDistanceM:null,
   spatialAudioBearingDeg:finite(turn.spatialAudioBearingDeg)?turn.spatialAudioBearingDeg:null,
   spatialAudioConflict:String(turn.spatialAudioConflict||'').slice(0,96)||null,
   spatialAudioReason:String(turn.spatialAudioReason||'').slice(0,160)||null,
   spatialAudioProvenance:Object.freeze(
    Array.from(turn.spatialAudioProvenance||[]).map(value=>String(value).slice(0,96)).slice(0,12)
   ),
   multiPersonAttributionState:String(turn.multiPersonAttributionState||'').slice(0,48)||null,
   multiPersonTurnOwnership:String(turn.multiPersonTurnOwnership||'').slice(0,48)||null,
   multiPersonParticipantIds:Object.freeze(
    Array.from(turn.multiPersonParticipantIds||[]).slice(0,12)
   ),
   multiPersonCandidateParticipantIds:Object.freeze(
    Array.from(turn.multiPersonCandidateParticipantIds||[]).slice(0,12)
   ),
   multiPersonOwnershipChangeCount:Math.max(0,Number(turn.multiPersonOwnershipChangeCount)||0),
   multiPersonInterruptionCount:Math.max(0,Number(turn.multiPersonInterruptionCount)||0),
   multiPersonPartialAttribution:turn.multiPersonPartialAttribution===true,
   multiPersonAttributionIntervals:Object.freeze(attributionIntervals),
   multiPersonAttributionCorrections:Object.freeze(attributionCorrections),
   transcript:cleanText(turn.transcript),
   transcriptState:String(turn.transcriptState||(
    turn.transcriptEditedAt?'corrected':'final')).slice(0,32),
   transcriptEditedAt:turn.transcriptEditedAt||null,
   transcriptSource:String(turn.transcriptSource||'local-whisper').slice(0,64),
   transcriptModelId:String(turn.transcriptModelId||'').slice(0,160)||null,
   transcriptModelRevision:String(turn.transcriptModelRevision||'').slice(0,80)||null,
   transcriptConfidence:cleanConfidence(turn.transcriptConfidence),
   transcriptCaptureDurationMs:finite(turn.transcriptCaptureDurationMs)?
    Math.max(0,turn.transcriptCaptureDurationMs):null,
   transcriptProcessingDurationMs:finite(turn.transcriptProcessingDurationMs)?
    Math.max(0,turn.transcriptProcessingDurationMs):null,
   transcribedAt:turn.transcribedAt||null
  });
 });
 return Object.freeze({
  schema:'tracky2-transcript-export-v1',
  exportedAt:new Date().toISOString(),
  filters:Object.freeze({sessionId,participantId,includeUnknown}),
  turnCount:rows.length,
  turns:Object.freeze(rows)
 });
}

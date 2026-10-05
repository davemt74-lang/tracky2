export const RECORDING_SCHEMA=1;
export const RECORDING_DEFAULT_RETENTION_DAYS=7;
export const RECORDING_ALLOWED_RETENTION_DAYS=Object.freeze([1,7,30]);
export const RECORDING_MAX_DURATION_MS=60*60*1000;
export const RECORDING_CHUNK_INTERVAL_MS=2000;
export const MAX_RECORDINGS=120;
export const MAX_RECORDING_TURN_REFS=500;

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const short=(value,max=160)=>String(value??'').trim().slice(0,max);
const uniq=values=>[...new Set((values||[]).filter(Boolean).map(value=>short(value,96)))];
const atOf=value=>{
 if(finite(value))return value;
 const parsed=Date.parse(String(value||''));
 return Number.isFinite(parsed)?parsed:0;
};
const identifier=()=>globalThis.crypto?.randomUUID?.()||
 'recording-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const retentionDays=value=>{
 const n=Math.floor(Number(value)||RECORDING_DEFAULT_RETENTION_DAYS);
 return RECORDING_ALLOWED_RETENTION_DAYS.includes(n)?n:RECORDING_DEFAULT_RETENTION_DAYS;
};
const validStatus=value=>[
 'recording','available','failed','expired','missing','damaged'
].includes(String(value))?String(value):'failed';
const validMediaState=value=>[
 'pending','available','missing','damaged'
].includes(String(value))?String(value):'pending';

export function normalizeRecordingRecord(input={}){
 const id=short(input.id||identifier(),96);
 const sessionId=short(input.sessionId,96);
 if(!id||!sessionId)throw new TypeError('Recording id and session id required.');
 const startedAt=finite(input.startedAt)?input.startedAt:Date.now();
 const status=validStatus(input.status||'recording');
 const endedAt=finite(input.endedAt)?Math.max(startedAt,input.endedAt):null;
 const durationMs=finite(input.durationMs)?Math.max(0,input.durationMs):
  endedAt?Math.max(0,endedAt-startedAt):null;
 const days=retentionDays(input.retentionDays);
 const expiresAt=finite(input.expiresAt)?Math.max(startedAt,input.expiresAt):
  startedAt+days*24*60*60*1000;
 return Object.freeze({
  id,sessionId,schemaVersion:RECORDING_SCHEMA,
  status,mediaState:validMediaState(input.mediaState||
   (status==='available'?'available':status==='recording'?'pending':status)),
  startedAt,endedAt,durationMs,
  retentionDays:days,expiresAt,
  mimeType:short(input.mimeType,120)||null,
  chunkCount:Math.max(0,Math.floor(Number(input.chunkCount)||0)),
  bytes:Math.max(0,Math.floor(Number(input.bytes)||0)),
  transcriptTurnIds:Object.freeze(uniq(input.transcriptTurnIds).slice(0,MAX_RECORDING_TURN_REFS)),
  consent:Object.freeze({
   mode:'explicit-owner',
   grantedAt:finite(input.consent?.grantedAt)?input.consent.grantedAt:startedAt
  }),
  stoppedReason:short(input.stoppedReason,96)||null,
  failureReason:short(input.failureReason,160)||null,
  createdAt:finite(input.createdAt)?input.createdAt:startedAt,
  updatedAt:finite(input.updatedAt)?Math.max(startedAt,input.updatedAt):startedAt
 });
}

export function createRecordingRecord({
 id=null,sessionId,retentionDays:days=RECORDING_DEFAULT_RETENTION_DAYS,mimeType=null
}={},now=Date.now()){
 return normalizeRecordingRecord({
  id:id||identifier(),sessionId,status:'recording',mediaState:'pending',
  startedAt:now,retentionDays:days,mimeType,
  consent:{mode:'explicit-owner',grantedAt:now},
  createdAt:now,updatedAt:now
 });
}

export function finishRecordingRecord(record,{
 chunkCount=0,bytes=0,mimeType=null,transcriptTurnIds=[],stoppedReason='owner-stop'
}={},at=Date.now()){
 const current=normalizeRecordingRecord(record);
 const endedAt=Math.max(current.startedAt,Number(at)||current.startedAt);
 const validMedia=Number(chunkCount)>0&&Number(bytes)>0;
 return normalizeRecordingRecord({
  ...current,status:validMedia?'available':'missing',
  mediaState:validMedia?'available':'missing',
  endedAt,durationMs:endedAt-current.startedAt,
  chunkCount,bytes,mimeType:mimeType||current.mimeType,
  transcriptTurnIds,stoppedReason,
  failureReason:validMedia?null:'no-media-chunks',
  updatedAt:endedAt
 });
}

export function failRecordingRecord(record,reason='recording-failed',at=Date.now()){
 const current=normalizeRecordingRecord(record);
 const endedAt=Math.max(current.startedAt,Number(at)||current.startedAt);
 return normalizeRecordingRecord({
  ...current,status:'failed',mediaState:current.chunkCount>0?'damaged':'missing',
  endedAt,durationMs:endedAt-current.startedAt,
  stoppedReason:'failed',failureReason:short(reason,160)||'recording-failed',
  updatedAt:endedAt
 });
}

export function recoverInterruptedRecording(record,at=Date.now()){
 const current=normalizeRecordingRecord(record);
 if(current.status!=='recording')return current;
 const endedAt=Math.max(current.startedAt,Number(at)||current.startedAt);
 return normalizeRecordingRecord({
  ...current,status:current.chunkCount>0?'damaged':'missing',
  mediaState:current.chunkCount>0?'damaged':'missing',
  endedAt,durationMs:endedAt-current.startedAt,
  stoppedReason:'interrupted-recovered',
  failureReason:'recording-interrupted-before-finalization',
  updatedAt:endedAt
 });
}

export function recordingTurnIdsForInterval(
 turns=[],sessionId,startedAt,endedAt,limit=MAX_RECORDING_TURN_REFS
){
 const session=String(sessionId||'');
 const start=Math.max(0,Number(startedAt)||0);
 const end=Math.max(start,Number(endedAt)||start);
 const ids=[];
 for(const turn of Array.isArray(turns)?turns:[]){
  if(!turn?.id||String(turn.sessionId||'')!==session)continue;
  const at=atOf(turn.createdAt)||Number(turn.at)||0;
  if(at<start||at>end)continue;
  ids.push(String(turn.id).slice(0,96));
 }
 return Object.freeze([...new Set(ids)].slice(0,Math.max(1,Math.min(MAX_RECORDING_TURN_REFS,
  Number(limit)||MAX_RECORDING_TURN_REFS))));
}

export function recordingMediaState(record,chunks=[]){
 const current=normalizeRecordingRecord(record);
 const rows=(Array.isArray(chunks)?chunks:[])
  .filter(row=>row&&Number.isInteger(Number(row.seq)))
  .sort((a,b)=>Number(a.seq)-Number(b.seq));
 if(!rows.length)return Object.freeze({
  state:'missing',expectedChunks:current.chunkCount,actualChunks:0,
  expectedBytes:current.bytes,actualBytes:0,reason:'media-chunks-missing'
 });
 const actualBytes=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.size)||0),0);
 const contiguous=rows.every((row,index)=>Number(row.seq)===index);
 const countMatches=current.chunkCount===0||rows.length===current.chunkCount;
 const bytesMatch=current.bytes===0||actualBytes===current.bytes;
 const available=contiguous&&countMatches&&bytesMatch;
 return Object.freeze({
  state:available?'available':'damaged',
  expectedChunks:current.chunkCount,actualChunks:rows.length,
  expectedBytes:current.bytes,actualBytes,
  reason:available?'media-complete':
   !contiguous?'chunk-sequence-gap':
   !countMatches?'chunk-count-mismatch':'byte-count-mismatch'
 });
}

export function recordingIdsToExpire(records=[],now=Date.now()){
 return Object.freeze((records||[]).map(normalizeRecordingRecord)
  .filter(record=>record.expiresAt<=now||record.status==='expired')
  .sort((a,b)=>a.expiresAt-b.expiresAt)
  .map(record=>record.id));
}

export function recordingIdsToPrune(records=[],maxRows=MAX_RECORDINGS){
 const rows=(records||[]).map(normalizeRecordingRecord)
  .filter(record=>record.status!=='recording')
  .sort((a,b)=>a.startedAt-b.startedAt);
 const cap=Math.max(1,Math.min(500,Math.floor(Number(maxRows)||MAX_RECORDINGS)));
 return Object.freeze(rows.slice(0,Math.max(0,rows.length-cap)).map(record=>record.id));
}

export function recordingPlaybackDescriptor(record,mediaState=null){
 const current=normalizeRecordingRecord(record);
 const state=mediaState?.state||current.mediaState;
 return Object.freeze({
  recordingId:current.id,sessionId:current.sessionId,
  playable:current.status==='available'&&state==='available',
  state,
  reason:mediaState?.reason||(
   current.status==='available'?'media-state-unavailable':current.failureReason||current.status),
  mimeType:current.mimeType,
  durationMs:current.durationMs,
  transcriptTurnIds:current.transcriptTurnIds
 });
}

export function recordingMetadataExport(records=[]){
 const rows=(records||[]).map(normalizeRecordingRecord)
  .sort((a,b)=>b.startedAt-a.startedAt)
  .map(record=>Object.freeze({
   id:record.id,sessionId:record.sessionId,status:record.status,
   mediaState:record.mediaState,startedAt:record.startedAt,endedAt:record.endedAt,
   durationMs:record.durationMs,retentionDays:record.retentionDays,
   expiresAt:record.expiresAt,mimeType:record.mimeType,
   chunkCount:record.chunkCount,bytes:record.bytes,
   transcriptTurnIds:record.transcriptTurnIds,
   stoppedReason:record.stoppedReason,failureReason:record.failureReason,
   provenance:Object.freeze(['canonical-recording-metadata','media-excluded'])
  }));
 return Object.freeze({
  schema:'tracky2-recording-metadata-export-v1',
  exportedAt:new Date().toISOString(),recordingCount:rows.length,
  recordings:Object.freeze(rows)
 });
}

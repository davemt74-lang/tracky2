import { participantRecord, cryptoRandomId } from './participant-core.js';
import { browserMatchStorage, deleteParticipantMatchHistory } from './match-history.js';
import {normalizeRoomScene,emptyRoomScene} from './room-scene-graph.js';
import {reviseTranscriptRecord} from './transcript-correction.js';
import {
 applyAttributionCorrection,attributionFromTurn,multiPersonAttributionTurnFields,
 scrubAttributionParticipant
} from './multi-person-attribution-core.js';
import {normalizeMemoryRecord,revokeMemoryRecord} from './agent-memory-core.js';
import {normalizeMeetingRecord,scrubMeetingParticipant} from './meeting-core.js';
import {
 endSessionIdentity as closeSessionIdentity,normalizeSessionIdentity,
 recoverPriorSessionIdentities
} from './session-identity-core.js';
import {
 MAX_RECORDINGS,normalizeRecordingRecord,recordingIdsForStoragePressure,
 recordingIdsToExpire,recordingIdsToPrune,recordingMediaState,recoverInterruptedRecording
} from './recording-core.js';
import {normalizeEnvironmentalFeedback} from './environmental-intelligence-core.js';
import {
 normalizeRoutineFeedback,routineFeedbackIdsToPrune,scrubRoutineFeedbackParticipant
} from './routine-intelligence-core.js';

const DB_NAME = 'tracky-participants-v1';
const DB_VERSION = 15;
const PARTICIPANTS = 'participants';
const PENDING = 'pending-captures';
const DIALOGUE = 'dialogue-turns';
const ROOM_OBSERVATIONS = 'room-observations';
const ROOM_SCENE = 'room-scene-map';
const AGENT_TASKS = 'agent-tasks';
const AGENT_WORKFLOWS = 'agent-workflows';
const AGENT_MEMORIES = 'agent-memories';
const PARTICIPANT_SYNC = 'participant-sync-state';
const ACCOUNT_PARTICIPANT_SYNC = 'account-participant-sync-state';
const RESOURCE_SYNC_CONFIG = 'resource-sync-config';
const RESOURCE_SYNC_STATE = 'resource-sync-state';
const RESOURCE_SYNC_JOURNAL = 'resource-sync-journal';
const MEETINGS = 'meetings';
const SESSION_IDENTITIES = 'session-identities';
const RECORDINGS = 'recordings';
const RECORDING_MEDIA = 'recording-media';
const ENVIRONMENTAL_FEEDBACK = 'environmental-feedback';
const ROUTINE_FEEDBACK = 'routine-feedback';
export const MAX_PERSISTED_ROOM_OBSERVATIONS=500;
export const MAX_PERSISTED_ENVIRONMENTAL_FEEDBACK=200;
export const MAX_PERSISTED_ROUTINE_FEEDBACK=160;

export const PENDING_CAPTURE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_DIALOGUE_TURNS = 500;
export const MAX_PERSISTED_AGENT_TASKS = 200;
export const MAX_PERSISTED_AGENT_WORKFLOWS = 80;
export const MAX_PERSISTED_AGENT_MEMORIES = 200;
export const MAX_PERSISTED_RESOURCE_SYNC_JOURNAL = 200;
export const MAX_PERSISTED_MEETINGS = 120;
export const MAX_PERSISTED_SESSION_IDENTITIES = 120;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
  });
}

export function isPendingCaptureExpired(
  record,
  now = Date.now(),
  ttlMs = PENDING_CAPTURE_TTL_MS
) {
  const createdAt = Date.parse(record?.createdAt || '');
  if (!Number.isFinite(createdAt)) return true;
  return now - createdAt > ttlMs;
}

export function dialogueIdsToPrune(rows, maxRows = MAX_DIALOGUE_TURNS) {
  if (!Array.isArray(rows) || rows.length <= maxRows) return [];
  return [...rows]
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .slice(0, Math.max(0, rows.length - maxRows))
    .map((row) => row.id)
    .filter(Boolean);
}

export async function openParticipantDb() {
  if (!('indexedDB' in window)) throw new Error('IndexedDB is not available in this browser.');

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PARTICIPANTS)) {
        const participants = db.createObjectStore(PARTICIPANTS, { keyPath: 'id' });
        participants.createIndex('name', 'name', { unique: false });
        participants.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(PENDING)) {
        db.createObjectStore(PENDING, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(ROOM_OBSERVATIONS)) {
        const observations=db.createObjectStore(ROOM_OBSERVATIONS,{keyPath:'id'});
        observations.createIndex('at','at',{unique:false});
      }
      if (!db.objectStoreNames.contains(ROOM_SCENE)) {
        db.createObjectStore(ROOM_SCENE,{keyPath:'id'});
      }
      if (!db.objectStoreNames.contains(AGENT_TASKS)) {
        const tasks=db.createObjectStore(AGENT_TASKS,{keyPath:'id'});
        tasks.createIndex('status','status',{unique:false});
        tasks.createIndex('runAt','runAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(AGENT_WORKFLOWS)) {
        const workflows=db.createObjectStore(AGENT_WORKFLOWS,{keyPath:'id'});
        workflows.createIndex('status','status',{unique:false});
        workflows.createIndex('updatedAt','updatedAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(AGENT_MEMORIES)) {
        const memories=db.createObjectStore(AGENT_MEMORIES,{keyPath:'id'});
        memories.createIndex('participantId','participantId',{unique:false});
        memories.createIndex('status','status',{unique:false});
        memories.createIndex('expiresAt','expiresAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(PARTICIPANT_SYNC)) {
        db.createObjectStore(PARTICIPANT_SYNC,{keyPath:'participantId'});
      }
      if (!db.objectStoreNames.contains(ACCOUNT_PARTICIPANT_SYNC)) {
        const accountSync=db.createObjectStore(ACCOUNT_PARTICIPANT_SYNC,{keyPath:'participantId'});
        accountSync.createIndex('pending','pending',{unique:false});
        accountSync.createIndex('updatedAt','updatedAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(RESOURCE_SYNC_CONFIG)) {
        db.createObjectStore(RESOURCE_SYNC_CONFIG,{keyPath:'id'});
      }
      if (!db.objectStoreNames.contains(RESOURCE_SYNC_STATE)) {
        const resourceSync=db.createObjectStore(RESOURCE_SYNC_STATE,{keyPath:'key'});
        resourceSync.createIndex('resourceType','resourceType',{unique:false});
        resourceSync.createIndex('updatedAt','updatedAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(RESOURCE_SYNC_JOURNAL)) {
        const journal=db.createObjectStore(RESOURCE_SYNC_JOURNAL,{keyPath:'id'});
        journal.createIndex('status','status',{unique:false});
        journal.createIndex('updatedAt','updatedAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(MEETINGS)) {
        const meetings=db.createObjectStore(MEETINGS,{keyPath:'id'});
        meetings.createIndex('status','status',{unique:false});
        meetings.createIndex('startedAt','startedAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(SESSION_IDENTITIES)) {
        const sessions=db.createObjectStore(SESSION_IDENTITIES,{keyPath:'id'});
        sessions.createIndex('status','status',{unique:false});
        sessions.createIndex('startedAt','startedAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(RECORDINGS)) {
        const recordings=db.createObjectStore(RECORDINGS,{keyPath:'id'});
        recordings.createIndex('sessionId','sessionId',{unique:false});
        recordings.createIndex('startedAt','startedAt',{unique:false});
        recordings.createIndex('expiresAt','expiresAt',{unique:false});
        recordings.createIndex('status','status',{unique:false});
      }
      if (!db.objectStoreNames.contains(RECORDING_MEDIA)) {
        const media=db.createObjectStore(RECORDING_MEDIA,{keyPath:'key'});
        media.createIndex('recordingId','recordingId',{unique:false});
        media.createIndex('seq','seq',{unique:false});
      }
      if (!db.objectStoreNames.contains(ENVIRONMENTAL_FEEDBACK)) {
        const feedback=db.createObjectStore(ENVIRONMENTAL_FEEDBACK,{keyPath:'id'});
        feedback.createIndex('at','at',{unique:false});
        feedback.createIndex('category','category',{unique:false});
      }
      if (!db.objectStoreNames.contains(ROUTINE_FEEDBACK)) {
        const routines=db.createObjectStore(ROUTINE_FEEDBACK,{keyPath:'id'});
        routines.createIndex('at','at',{unique:false});
        routines.createIndex('routineId','routineId',{unique:false});
      }
      if (!db.objectStoreNames.contains(DIALOGUE)) {
        const dialogue = db.createObjectStore(DIALOGUE, { keyPath: 'id' });
        dialogue.createIndex('sessionId', 'sessionId', { unique: false });
        dialogue.createIndex('participantId', 'participantId', { unique: false });
        dialogue.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Participant database upgrade is blocked by another tab.'));
  });
}

async function storeAction(storeName, mode, action) {
  const db = await openParticipantDb();
  try {
    const tx = db.transaction(storeName, mode);
    const done = transactionToPromise(tx);
    const store = tx.objectStore(storeName);
    const result = await action(store);
    await done;
    return result;
  } finally {
    db.close();
  }
}

export function startSessionIdentity(input) {
  const record=normalizeSessionIdentity(input);
  return storeAction(SESSION_IDENTITIES,'readwrite',async store=>{
    const rows=await requestToPromise(store.getAll());
    const recovered=recoverPriorSessionIdentities(rows,record,record.startedAt);
    for(const prior of recovered)await requestToPromise(store.put(prior));
    await requestToPromise(store.put(record));
    const all=[...recovered.filter(row=>row.id!==record.id),record]
      .sort((a,b)=>(Number(a.startedAt)||0)-(Number(b.startedAt)||0));
    for(const stale of all.slice(0,Math.max(0,all.length-MAX_PERSISTED_SESSION_IDENTITIES)))
      store.delete(stale.id);
    return record;
  });
}

export function saveSessionIdentity(input) {
  const record=normalizeSessionIdentity(input);
  return storeAction(SESSION_IDENTITIES,'readwrite',async store=>{
    await requestToPromise(store.put(record));
    const rows=await requestToPromise(store.getAll());
    const remove=rows
      .sort((a,b)=>(Number(a.startedAt)||0)-(Number(b.startedAt)||0))
      .slice(0,Math.max(0,rows.length-MAX_PERSISTED_SESSION_IDENTITIES));
    for(const row of remove)store.delete(row.id);
    return record;
  });
}

export function getSessionIdentity(id) {
  return storeAction(SESSION_IDENTITIES,'readonly',store=>requestToPromise(store.get(id)));
}

export function listSessionIdentities() {
  return storeAction(SESSION_IDENTITIES,'readonly',async store=>{
    const rows=await requestToPromise(store.getAll());
    return rows.map(normalizeSessionIdentity)
      .sort((a,b)=>(Number(b.startedAt)||0)-(Number(a.startedAt)||0));
  });
}

export function endStoredSessionIdentity(id,reason='ended',at=Date.now()) {
  if(typeof id!=='string'||!id)return Promise.reject(new TypeError('Invalid session ID.'));
  return storeAction(SESSION_IDENTITIES,'readwrite',async store=>{
    const current=await requestToPromise(store.get(id));
    if(!current)return null;
    const ended=closeSessionIdentity(current,reason,at);
    await requestToPromise(store.put(ended));
    return ended;
  });
}


/* V0.13E explicit owner recording metadata + incremental media chunks.
   Canonical transcript text stays in DIALOGUE; recordings keep turn IDs only. */
export async function saveRecording(input){
 const record=normalizeRecordingRecord(input);
 await storeAction(RECORDINGS,'readwrite',store=>requestToPromise(store.put(record)));
 await pruneRecordingLimit().catch(()=>{});
 return record;
}
export function getRecording(id){
 return storeAction(RECORDINGS,'readonly',async store=>{
  const row=await requestToPromise(store.get(id));
  return row?normalizeRecordingRecord(row):null;
 });
}
export function listRecordings(sessionId=null){
 return storeAction(RECORDINGS,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.map(normalizeRecordingRecord)
   .filter(row=>!sessionId||row.sessionId===sessionId)
   .sort((a,b)=>b.startedAt-a.startedAt);
 });
}
export async function saveRecordingChunk(recordingId,seq,blob){
 if(typeof recordingId!=='string'||!recordingId)throw new TypeError('Recording id required.');
 const index=Math.max(0,Math.floor(Number(seq)||0));
 if(!(blob instanceof Blob)||blob.size<=0)throw new TypeError('Non-empty recording Blob required.');
 const db=await openParticipantDb();
 try{
  const tx=db.transaction([RECORDINGS,RECORDING_MEDIA],'readwrite');
  const done=transactionToPromise(tx);
  const recordings=tx.objectStore(RECORDINGS);
  const media=tx.objectStore(RECORDING_MEDIA);
  const currentRaw=await requestToPromise(recordings.get(recordingId));
  if(!currentRaw)throw new Error('Recording metadata no longer exists.');
  const current=normalizeRecordingRecord(currentRaw);
  if(current.status!=='recording')throw new Error('Recording is not active.');
  const key=recordingId+':'+String(index).padStart(8,'0');
  const prior=await requestToPromise(media.get(key));
  const size=blob.size;
  await requestToPromise(media.put({
   key,recordingId,seq:index,blob,size,type:String(blob.type||'').slice(0,120),
   createdAt:Date.now()
  }));
  const updated=normalizeRecordingRecord({
   ...current,
   chunkCount:Math.max(current.chunkCount,index+1),
   bytes:Math.max(0,current.bytes-(Number(prior?.size)||0)+size),
   mimeType:current.mimeType||String(blob.type||'').slice(0,120)||null,
   updatedAt:Date.now()
  });
  await requestToPromise(recordings.put(updated));
  await done;
  return updated;
 }finally{db.close();}
}
export function listRecordingChunks(recordingId){
 return storeAction(RECORDING_MEDIA,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.filter(row=>row.recordingId===recordingId)
   .sort((a,b)=>Number(a.seq)-Number(b.seq));
 });
}
export async function getRecordingMedia(recordingId){
 const db=await openParticipantDb();
 try{
  const tx=db.transaction([RECORDINGS,RECORDING_MEDIA],'readwrite');
  const done=transactionToPromise(tx);
  const recordingRaw=await requestToPromise(tx.objectStore(RECORDINGS).get(recordingId));
  if(!recordingRaw){await done;return {recording:null,state:'missing',reason:'recording-metadata-missing',blob:null};}
  const recording=normalizeRecordingRecord(recordingRaw);
  const rows=(await requestToPromise(tx.objectStore(RECORDING_MEDIA).getAll()))
   .filter(row=>row.recordingId===recordingId)
   .sort((a,b)=>Number(a.seq)-Number(b.seq));
  await done;
  const mediaState=recordingMediaState(recording,rows);
  if(mediaState.state!=='available'){
   const damaged=normalizeRecordingRecord({
    ...recording,status:mediaState.state,mediaState:mediaState.state,
    failureReason:mediaState.reason,updatedAt:Date.now()
   });
   await storeAction(RECORDINGS,'readwrite',store=>requestToPromise(store.put(damaged)));
   return {recording:damaged,state:mediaState.state,reason:mediaState.reason,blob:null};
  }
  return {
   recording,state:'available',reason:'media-complete',
   blob:new Blob(rows.map(row=>row.blob),{type:recording.mimeType||rows[0]?.type||'audio/webm'})
  };
 }finally{db.close();}
}
export async function deleteRecording(id){
 const db=await openParticipantDb();
 try{
  const tx=db.transaction([RECORDINGS,RECORDING_MEDIA],'readwrite');
  const done=transactionToPromise(tx);
  await requestToPromise(tx.objectStore(RECORDINGS).delete(id));
  const media=tx.objectStore(RECORDING_MEDIA);
  const rows=await requestToPromise(media.getAll());
  for(const row of rows)if(row.recordingId===id)media.delete(row.key);
  await done;return true;
 }finally{db.close();}
}
async function deleteRecordingIds(ids=[]){
 const remove=new Set(ids||[]);
 if(!remove.size)return 0;
 const db=await openParticipantDb();
 try{
  const tx=db.transaction([RECORDINGS,RECORDING_MEDIA],'readwrite');
  const done=transactionToPromise(tx);
  const recordings=tx.objectStore(RECORDINGS),media=tx.objectStore(RECORDING_MEDIA);
  for(const id of remove)recordings.delete(id);
  const chunks=await requestToPromise(media.getAll());
  for(const row of chunks)if(remove.has(row.recordingId))media.delete(row.key);
  await done;return remove.size;
 }finally{db.close();}
}
export async function pruneExpiredRecordings(now=Date.now()){
 const rows=await listRecordings();
 return deleteRecordingIds(recordingIdsToExpire(rows,now));
}
export async function pruneRecordingLimit(maxRows=MAX_RECORDINGS){
 const rows=await listRecordings();
 return deleteRecordingIds(recordingIdsToPrune(rows,maxRows));
}
export async function pruneRecordingStoragePressure(estimate={}){
 const rows=await listRecordings();
 return deleteRecordingIds(recordingIdsForStoragePressure(rows,estimate));
}
export async function recoverInterruptedRecordings(now=Date.now()){
 const rows=await listRecordings();
 const active=rows.filter(row=>row.status==='recording');
 for(const row of active)await saveRecording(recoverInterruptedRecording(row,now));
 return active.length;
}

export function listParticipants() {
  return storeAction(PARTICIPANTS, 'readonly', async (store) => {
    const rows = await requestToPromise(store.getAll());
    return rows.sort((a, b) => {
      const aSeen = a.lastSeenAt || a.updatedAt || '';
      const bSeen = b.lastSeenAt || b.updatedAt || '';
      return bSeen.localeCompare(aSeen) || String(a.name).localeCompare(String(b.name));
    });
  });
}

export function getParticipant(id) {
  return storeAction(PARTICIPANTS, 'readonly', (store) => requestToPromise(store.get(id)));
}

export function saveParticipant(input) {
  const record = participantRecord(input);
  return storeAction(PARTICIPANTS, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
    return record;
  });
}

export async function patchParticipant(id, patch) {
  const current = await getParticipant(id);
  if (!current) throw new Error('Participant not found.');
  return saveParticipant({ ...current, ...patch, id, createdAt: current.createdAt });
}

export async function deleteParticipant(id,{remoteSyncState=null}={}) {
  const db = await openParticipantDb();
  try {
    const tx = db.transaction([PARTICIPANTS, DIALOGUE, ROOM_OBSERVATIONS, AGENT_MEMORIES, PARTICIPANT_SYNC, MEETINGS, RECORDINGS, ROUTINE_FEEDBACK], 'readwrite');
    const done = transactionToPromise(tx);
    const participants = tx.objectStore(PARTICIPANTS);
    const dialogue = tx.objectStore(DIALOGUE);
    const observations = tx.objectStore(ROOM_OBSERVATIONS);
    const memories = tx.objectStore(AGENT_MEMORIES);
    const sync = tx.objectStore(PARTICIPANT_SYNC);
    const meetings = tx.objectStore(MEETINGS);
    const recordings = tx.objectStore(RECORDINGS);
    const routineFeedback = tx.objectStore(ROUTINE_FEEDBACK);
    const deletedTurnIds=new Set();

    const participant = await requestToPromise(participants.get(id));
    await requestToPromise(participants.delete(id));

    const rows = await requestToPromise(dialogue.getAll());
    for (const row of rows) {
      if (row.participantId === id) {
        deletedTurnIds.add(String(row.id));
        dialogue.delete(row.id);
        continue;
      }

      const nearbyIds = Array.from(row.nearbyParticipantIds || []);
      const nearbyNames = Array.from(row.nearbyParticipantNames || []);
      const conversationIds=Array.from(row.conversationParticipantIds||[]);
      const addressedIds=Array.from(row.addressedParticipantIds||[]);
      const multimodalContextParticipantIds=Array.from(row.multimodalContextParticipantIds||[]);
      const multimodalEvidence=Array.isArray(row.multimodalEvidence)?row.multimodalEvidence:[];
      const continuousFusionParticipantIds=Array.from(row.continuousFusionParticipantIds||[]);
      const continuousFusionClusterLinks=Array.isArray(row.continuousFusionClusterLinks)
        ?row.continuousFusionClusterLinks:[];
      const continuousFusionWindowLinks=Array.isArray(row.continuousFusionWindowLinks)
        ?row.continuousFusionWindowLinks:[];
      const overlapSeparationParticipantIds=Array.from(row.overlapSeparationParticipantIds||[]);
      const overlapSeparationSources=Array.isArray(row.overlapSeparationSources)
        ?row.overlapSeparationSources:[];
      const multiPersonParticipantIds=Array.from(row.multiPersonParticipantIds||[]);
      const multiPersonCandidateParticipantIds=Array.from(row.multiPersonCandidateParticipantIds||[]);
      const multiPersonAttributionIntervals=Array.isArray(row.multiPersonAttributionIntervals)
        ?row.multiPersonAttributionIntervals:[];
      const multiPersonAttributionCorrections=Array.isArray(row.multiPersonAttributionCorrections)
        ?row.multiPersonAttributionCorrections:[];
      const hasNearbyReference = nearbyIds.includes(id);
      const hasNameReference = participant?.name && nearbyNames.includes(participant.name);
      const hasConversationReference=conversationIds.includes(id);
      const hasAddressReference=addressedIds.includes(id)||row.addressedParticipantId===id;
      const hasMultimodalReference=multimodalContextParticipantIds.includes(id)||
        multimodalEvidence.some(evidence=>evidence?.participantId===id);
      const hasContinuousFusionReference=continuousFusionParticipantIds.includes(id)||
        continuousFusionClusterLinks.some(link=>link?.participantId===id)||
        continuousFusionWindowLinks.some(link=>link?.participantId===id);
      const hasOverlapSeparationReference=overlapSeparationParticipantIds.includes(id)||
        overlapSeparationSources.some(source=>source?.participantId===id);
      const hasMultiPersonReference=multiPersonParticipantIds.includes(id)||
        multiPersonCandidateParticipantIds.includes(id)||
        multiPersonAttributionIntervals.some(interval=>
          interval?.participantId===id||(interval?.candidateParticipantIds||[]).includes(id))||
        multiPersonAttributionCorrections.some(correction=>
          correction?.participantId===id||correction?.previousParticipantId===id);

      if (hasNearbyReference || hasNameReference || hasConversationReference ||
          hasAddressReference || hasMultimodalReference || hasContinuousFusionReference ||
          hasOverlapSeparationReference || hasMultiPersonReference) {
        const nextAddressed=addressedIds.filter(participantId=>participantId!==id);
        dialogue.put({
          ...row,
          nearbyParticipantIds: nearbyIds.filter((participantId) => participantId !== id),
          nearbyParticipantNames: participant?.name
            ? nearbyNames.filter((name) => name !== participant.name)
            : nearbyNames,
          conversationParticipantIds:conversationIds.filter(participantId=>participantId!==id),
          conversationScopeId:null,
          addressedParticipantId:row.addressedParticipantId===id?null:row.addressedParticipantId||null,
          addressedParticipantIds:nextAddressed,
          addressKind:row.addressedParticipantId===id||addressedIds.includes(id)
            ? (row.addressedAgent?'agent':'unspecified'):(row.addressKind||'unspecified'),
          multimodalContextParticipantIds:multimodalContextParticipantIds
            .filter(participantId=>participantId!==id),
          multimodalEvidence:multimodalEvidence.filter(evidence=>evidence?.participantId !== id),
          continuousFusionParticipantIds:continuousFusionParticipantIds
            .filter(participantId=>participantId!==id),
          continuousFusionClusterLinks:continuousFusionClusterLinks
            .filter(link=>link?.participantId!==id),
          continuousFusionWindowLinks:continuousFusionWindowLinks
            .filter(link=>link?.participantId!==id),
          overlapSeparationParticipantIds:overlapSeparationParticipantIds
            .filter(participantId=>participantId!==id),
          overlapSeparationSources:overlapSeparationSources.map(source=>
            source?.participantId===id
             ?{...source,participantId:null,state:'unverified',voiceConfidence:0,voiceMargin:null}
             :source
          ),
          overlapSeparationState:row.overlapSeparationState==='separated-verified'&&
            overlapSeparationParticipantIds.filter(participantId=>participantId!==id).length<2
             ?(overlapSeparationParticipantIds.filter(participantId=>participantId!==id).length
               ?'separated-partial':'separated-unverified')
             :row.overlapSeparationState,
          ...multiPersonAttributionTurnFields(
            scrubAttributionParticipant(attributionFromTurn(row),id)
          )
        });
      }
    }

    // Erase attributed room observations in the same transaction as the profile.
    const roomRows = await requestToPromise(observations.getAll());
    for (const event of roomRows) {
      if (event.participantId === id) observations.delete(event.id);
    }

    // Routine review metadata follows the same participant deletion boundary.
    const routineRows=await requestToPromise(routineFeedback.getAll());
    const keepRoutine=scrubRoutineFeedbackParticipant(routineRows,id);
    const keepRoutineIds=new Set(keepRoutine.map(row=>row.id));
    for(const row of routineRows)if(!keepRoutineIds.has(row.id))routineFeedback.delete(row.id);

    // Explicit participant memories have the same local deletion boundary.
    const memoryRows = await requestToPromise(memories.getAll());
    for (const memory of memoryRows) {
      if (memory.participantId === id) { memories.delete(memory.id); continue; }
      if ((Array.isArray(memory.sourceRefs)?memory.sourceRefs:[])
          .some(ref=>ref?.participantId===id)) memories.delete(memory.id);
    }

    // Meeting metadata references participant IDs only; scrub them without deleting
    // the whole meeting or copying/deleting unrelated canonical transcript content.
    const meetingRows=await requestToPromise(meetings.getAll());
    for(const meeting of meetingRows){
      const scrubbed=scrubMeetingParticipant(normalizeMeetingRecord(meeting),id,Date.now());
      if(JSON.stringify(scrubbed)!==JSON.stringify(meeting))meetings.put(scrubbed);
    }

    // Recording media is not participant-owned, but transcript reference IDs must
    // follow the same deletion boundary as canonical DIALOGUE.
    if(deletedTurnIds.size){
      const recordingRows=await requestToPromise(recordings.getAll());
      for(const recording of recordingRows){
        const current=normalizeRecordingRecord(recording);
        const nextIds=current.transcriptTurnIds.filter(turnId=>!deletedTurnIds.has(turnId));
        if(nextIds.length!==current.transcriptTurnIds.length)
          recordings.put(normalizeRecordingRecord({
            ...current,transcriptTurnIds:nextIds,updatedAt:Date.now()
          }));
      }
    }

    const priorSync=await requestToPromise(sync.get(id));
    if(remoteSyncState&&typeof remoteSyncState==='object'){
      sync.put({
        participantId:id,enabled:true,
        serverVersion:Math.max(0,Number(remoteSyncState.serverVersion)||0),
        lastSyncedLocalUpdatedAt:null,localDeletedAt:null,
        consentConfirmedAt:Number(remoteSyncState.consentConfirmedAt)||priorSync?.consentConfirmedAt||null,
        serverUpdatedAt:Number(remoteSyncState.serverUpdatedAt)||Date.now(),
        updatedAt:Date.now()
      });
    }else if(priorSync?.enabled){
      sync.put({...priorSync,localDeletedAt:Date.now(),updatedAt:Date.now()});
    }
    await done;
    // Follow participant deletion with local game-history cleanup on the same device.
    deleteParticipantMatchHistory(browserMatchStorage(), id);
    return true;
  } finally {
    db.close();
  }
}

export async function prunePendingCaptures(now = Date.now()) {
  return storeAction(PENDING, 'readwrite', async (store) => {
    const rows = await requestToPromise(store.getAll());
    let deleted = 0;
    for (const row of rows) {
      if (isPendingCaptureExpired(row, now)) {
        store.delete(row.id);
        deleted += 1;
      }
    }
    return deleted;
  });
}

export async function savePendingCapture(input) {
  await prunePendingCaptures().catch(() => {});

  const record = {
    id: input.id || cryptoRandomId(),
    photo: input.photo || null,
    embedding: input.embedding ? Array.from(input.embedding) : null,
    trackId: input.trackId || null,
    createdAt: new Date().toISOString()
  };

  return storeAction(PENDING, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
    return record;
  });
}

export async function getPendingCapture(id) {
  const record = await storeAction(
    PENDING,
    'readonly',
    (store) => requestToPromise(store.get(id))
  );

  if (record && isPendingCaptureExpired(record)) {
    await deletePendingCapture(id).catch(() => {});
    return undefined;
  }

  return record;
}

export function deletePendingCapture(id) {
  return storeAction(PENDING, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
    return true;
  });
}

export async function pruneDialogueTurns(maxRows = MAX_DIALOGUE_TURNS) {
  return storeAction(DIALOGUE, 'readwrite', async (store) => {
    const rows = await requestToPromise(store.getAll());
    const ids = dialogueIdsToPrune(rows, maxRows);
    for (const id of ids) store.delete(id);
    return ids.length;
  });
}

export async function saveDialogueTurn(input) {
  if(!input||typeof input!=='object')throw new TypeError('Invalid dialogue turn.');
  if(['pending','partial','cancelled'].includes(input.transcriptState))
    throw new Error('Ephemeral transcript lifecycle state cannot be persisted.');
  const {
    partialText:discardPartial,samples:discardSamples,pcm:discardPcm,
    rawAudio:discardRawAudio,audio:discardAudio,
    separationInput:discardSeparationInput,leftSamples:discardLeftSamples,
    rightSamples:discardRightSamples,...safeInput
  }=input;
  const transcript=String(safeInput.transcript||'').trim();
  const record = {
    ...safeInput,
    transcript,
    transcriptState:safeInput.transcriptState||
      (safeInput.transcriptEditedAt?'corrected':transcript?'final':'unavailable'),
    id: safeInput.id || cryptoRandomId(),
    sessionId: safeInput.sessionId || 'room-session',
    createdAt: safeInput.createdAt || new Date().toISOString()
  };

  await storeAction(DIALOGUE, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
  await pruneDialogueTurns().catch(() => {});
  return record;
}

// Transactional owner correction retains original source text and speaker attribution.
export function reviseDialogueTurn(id,text,at=Date.now()){
 if(typeof id!=='string'||!id)return Promise.reject(new TypeError('Invalid transcript ID.'));
 return storeAction(DIALOGUE,'readwrite',async store=>{
  const current=await requestToPromise(store.get(id));
  if(!current)throw new Error('Transcript no longer exists.');
  const corrected=reviseTranscriptRecord(current,text,at);
  await requestToPromise(store.put(corrected));
  return corrected;
 });
}

export function reviseDialogueAttribution(id,correction={},at=Date.now()){
 if(typeof id!=='string'||!id)return Promise.reject(new TypeError('Invalid transcript ID.'));
 return storeAction(DIALOGUE,'readwrite',async store=>{
  const current=await requestToPromise(store.get(id));
  if(!current)throw new Error('Transcript no longer exists.');
  const attribution=attributionFromTurn(current);
  const correctedAttribution=applyAttributionCorrection(attribution,{...correction,at});
  const corrected={
   ...current,
   ...multiPersonAttributionTurnFields(correctedAttribution),
   speakerAttributionEditedAt:new Date(at).toISOString(),
   speakerAttributionEditedBy:'local-owner'
  };
  await requestToPromise(store.put(corrected));
  return corrected;
 });
}

export function listDialogueTurns(sessionId = null) {
  return storeAction(DIALOGUE, 'readonly', async (store) => {
    const rows = await requestToPromise(store.getAll());
    return rows
      .filter((row) => !sessionId || row.sessionId === sessionId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  });
}

export async function clearDialogueTurns(sessionId = null) {
  return storeAction(DIALOGUE, 'readwrite', async (store) => {
    if (!sessionId) {
      await requestToPromise(store.clear());
      return true;
    }

    const rows = await requestToPromise(store.getAll());
    for (const row of rows) {
      if (row.sessionId === sessionId) store.delete(row.id);
    }
    return true;
  });
}


export function deleteDialogueTurn(id) {
  return storeAction(DIALOGUE, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
    return true;
  });
}

/* Metadata only; never persist snapshots, audio or raw biometrics in room events. */
export function listRoomObservations(){
 return storeAction(ROOM_OBSERVATIONS,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.sort((a,b)=>a.at-b.at).slice(-MAX_PERSISTED_ROOM_OBSERVATIONS);
 });
}
export async function saveRoomObservation(record){
 if(!record||!['presence','audio','system','activity','media','decision'].includes(record.category))
  throw new Error('Invalid room observation');
 // Persist only bounded, audited metadata. No raw media, embeddings, transcripts,
 // free-form evidence, images or cross-source identity guesses are copied.
 const correction=record.kind==='correction'&&record.correction?{
  targetId:String(record.correction.targetId||'').slice(0,96),
  operation:['retract','replace'].includes(record.correction.operation)?record.correction.operation:'retract',
  replacement:record.correction.operation==='replace'?{
   message:String(record.correction.replacement?.message||'').slice(0,240),
   confidence:Number.isFinite(record.correction.replacement?.confidence)?
    Math.max(0,Math.min(1,record.correction.replacement.confidence)):null
  }:null
 }:null;
 const safe={id:record.id,at:record.at,category:record.category,
  message:String(record.message||'').slice(0,240),participantId:record.participantId||null,
  confidence:record.confidence??null,source:record.source||'local',
  relatedEventId:record.relatedEventId?String(record.relatedEventId).slice(0,96):null,
  evidence:(Number.isFinite(record.evidence?.durationMs)||record.evidence?.durationMs===null||
    record.evidence?.environmental)?{
   durationMs:Number.isFinite(record.evidence?.durationMs)?record.evidence.durationMs:null,
   environmental:record.evidence?.environmental?{
    category:String(record.evidence.environmental.category||'').slice(0,64)||null,
    subtype:String(record.evidence.environmental.subtype||'').slice(0,64)||null,
    modelLabel:String(record.evidence.environmental.modelLabel||'').slice(0,96)||null,
    groupId:String(record.evidence.environmental.groupId||'').slice(0,96)||null,
    observationCount:Number.isFinite(record.evidence.environmental.observationCount)?
     Math.max(1,Math.floor(record.evidence.environmental.observationCount)):null,
    sourceDirection:['left','right','center','unavailable'].includes(
     record.evidence.environmental.sourceDirection)?
     record.evidence.environmental.sourceDirection:'unavailable',
    rawConfidence:Number.isFinite(record.evidence.environmental.rawConfidence)?
     Math.max(0,Math.min(1,record.evidence.environmental.rawConfidence)):null,
    calibratedConfidence:Number.isFinite(record.evidence.environmental.calibratedConfidence)?
     Math.max(0,Math.min(1,record.evidence.environmental.calibratedConfidence)):null,
    observableOnly:record.evidence.environmental.observableOnly===true,
    healthInference:'none'
   }:null
  }:null,
  version:record.version===1?1:null,kind:record.kind||'observation',
  semantic:String(record.semantic||'').slice(0,48),
  deviceId:String(record.deviceId||'browser').slice(0,40),
  sessionId:String(record.sessionId||'room-session').slice(0,64),
  roomId:String(record.roomId||'').slice(0,96)||null,
  sensor:['camera','microphone'].includes(record.sensor)?record.sensor:null,
  status:['online','offline','paused','degraded'].includes(record.status)?record.status:null,
  dedupeKey:record.dedupeKey?String(record.dedupeKey).slice(0,96):null,
  retention:'local',correction
 };
 return storeAction(ROOM_OBSERVATIONS,'readwrite',async store=>{
  await requestToPromise(store.put(safe));
  const rows=await requestToPromise(store.getAll());
  for(const item of rows.sort((a,b)=>a.at-b.at).slice(0,Math.max(0,rows.length-MAX_PERSISTED_ROOM_OBSERVATIONS)))
   store.delete(item.id);
  return safe;
 });
}
export function clearRoomObservations(){
 return storeAction(ROOM_OBSERVATIONS,'readwrite',store=>requestToPromise(store.clear()));
}


/* V0.13F owner feedback only: bounded category/subtype correction metadata.
   Never store raw audio, model tensors, transcripts or participant identity here. */
export function listEnvironmentalFeedback(){
 return storeAction(ENVIRONMENTAL_FEEDBACK,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.map(row=>normalizeEnvironmentalFeedback(row,row.at))
   .sort((a,b)=>a.at-b.at).slice(-MAX_PERSISTED_ENVIRONMENTAL_FEEDBACK);
 });
}
export async function saveEnvironmentalFeedback(input){
 const record=normalizeEnvironmentalFeedback(input,input?.at);
 return storeAction(ENVIRONMENTAL_FEEDBACK,'readwrite',async store=>{
  await requestToPromise(store.put(record));
  const rows=await requestToPromise(store.getAll());
  for(const row of rows.sort((a,b)=>a.at-b.at)
   .slice(0,Math.max(0,rows.length-MAX_PERSISTED_ENVIRONMENTAL_FEEDBACK)))
   store.delete(row.id);
  return record;
 });
}
export function clearEnvironmentalFeedback(){
 return storeAction(ENVIRONMENTAL_FEEDBACK,'readwrite',store=>requestToPromise(store.clear()));
}


/* V0.13G owner review metadata only. Routine candidates are derived from
   canonical ROOM observations at read time and are never copied into Agent Memory. */
export function listRoutineFeedback(){
 return storeAction(ROUTINE_FEEDBACK,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.map(row=>normalizeRoutineFeedback(row,row.at))
   .sort((a,b)=>a.at-b.at).slice(-MAX_PERSISTED_ROUTINE_FEEDBACK);
 });
}
export async function saveRoutineFeedback(input){
 const record=normalizeRoutineFeedback(input,input?.at);
 return storeAction(ROUTINE_FEEDBACK,'readwrite',async store=>{
  await requestToPromise(store.put(record));
  const rows=await requestToPromise(store.getAll());
  for(const id of routineFeedbackIdsToPrune(rows,MAX_PERSISTED_ROUTINE_FEEDBACK))
   store.delete(id);
  return record;
 });
}
export function clearRoutineFeedback(){
 return storeAction(ROUTINE_FEEDBACK,'readwrite',store=>requestToPromise(store.clear()));
}


// Only owner-entered area rectangles, object labels and optional floor-plane
// calibration metadata. Never save people, camera frames, photographs,
// coordinates from live tracks or audio here.
export async function loadRoomScene(){
 const record=await storeAction(ROOM_SCENE,'readonly',store=>
  requestToPromise(store.get('local-room')));
 return record?normalizeRoomScene(record):emptyRoomScene();
}
export async function saveRoomScene(scene){
 const safe=normalizeRoomScene(scene);
 await storeAction(ROOM_SCENE,'readwrite',store=>requestToPromise(store.put(safe)));
 return safe;
}
export function clearRoomScene(){
 return storeAction(ROOM_SCENE,'readwrite',store=>requestToPromise(store.clear()));
}


/* V0.10F task metadata only: no raw media, arbitrary commands, credentials or model prompts. */
export function listAgentTasks(){
 return storeAction(AGENT_TASKS,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(-MAX_PERSISTED_AGENT_TASKS);
 });
}
export async function saveAgentTask(record){
 if(!record||!record.id||!['describe_object','capture_image','product_search'].includes(record.skillId))
  throw new Error('Invalid agent task');
 const statuses=['pending-confirmation','scheduled','running','succeeded','failed','cancelled'];
 const sources=(Array.isArray(record.resultSources)?record.resultSources:[]).slice(0,5)
  .map(row=>({title:String(row?.title||'').slice(0,160),url:String(row?.url||'').slice(0,700)}))
  .filter(row=>/^https:\/\//i.test(row.url));
 const provenance=record.executionProvenance&&typeof record.executionProvenance==='object'
  ?Object.fromEntries(Object.entries(record.executionProvenance).filter(([key,value])=>
    ['contract','skillId','skillVersion','sideEffect','targetId','targetSource','outcome','executedAt',
     'authorization','provider','model','resultCount','mediaBytes','mediaWidth','mediaHeight'].includes(key)&&
    (typeof value==='string'||Number.isFinite(value))))
  :null;
 const safe={
  schema:record.schema===2?2:record.schema===1?1:null,id:String(record.id).slice(0,96),
  skillId:record.skillId,targetId:String(record.targetId||'').slice(0,96),
  targetSource:record.targetSource==='server-approved'?'server-approved':'local-owner-defined',
  idempotencyKey:String(record.idempotencyKey||'').slice(0,180),
  status:statuses.includes(record.status)?record.status:'failed',
  runAt:Number.isFinite(record.runAt)?record.runAt:Date.now(),
  createdAt:Number.isFinite(record.createdAt)?record.createdAt:Date.now(),
  updatedAt:Number.isFinite(record.updatedAt)?record.updatedAt:Date.now(),
  confirmedAt:Number.isFinite(record.confirmedAt)?record.confirmedAt:null,
  startedAt:Number.isFinite(record.startedAt)?record.startedAt:null,
  completedAt:Number.isFinite(record.completedAt)?record.completedAt:null,
  attempts:Math.max(0,Math.min(5,Number(record.attempts)||0)),
  maxAttempts:Math.max(1,Math.min(5,Number(record.maxAttempts)||2)),
  resultText:String(record.resultText||'').slice(0,900),resultSources:sources,
  executionProvenance:provenance,
  errorText:String(record.errorText||'').slice(0,240),
  relatedEventId:String(record.relatedEventId||'').slice(0,96)||null
 };
 return storeAction(AGENT_TASKS,'readwrite',async store=>{
  await requestToPromise(store.put(safe));
  const rows=await requestToPromise(store.getAll());
  for(const item of rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(0,Math.max(0,rows.length-MAX_PERSISTED_AGENT_TASKS))) store.delete(item.id);
  return safe;
 });
}
export function deleteAgentTask(id){
 return storeAction(AGENT_TASKS,'readwrite',async store=>{
  await requestToPromise(store.delete(id));return true;
 });
}
export function clearAgentTasks(){
 return storeAction(AGENT_TASKS,'readwrite',store=>requestToPromise(store.clear()));
}


/* V0.14C workflow metadata only: bounded policy/step/result metadata.
   Never persist raw media, arbitrary commands, credentials, prompts or hidden tool payloads. */
export function listAgentWorkflows(){
 return storeAction(AGENT_WORKFLOWS,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(-MAX_PERSISTED_AGENT_WORKFLOWS);
 });
}
function safeWorkflowSources(input=[]){
 return (Array.isArray(input)?input:[]).slice(0,5)
  .map(row=>({title:String(row?.title||'').slice(0,160),url:String(row?.url||'').slice(0,700)}))
  .filter(row=>/^https:\/\//i.test(row.url));
}
function safeWorkflowProvenance(input){
 if(!input||typeof input!=='object')return null;
 const allowed=['contract','skillId','skillVersion','sideEffect','targetId','targetSource','outcome',
  'executedAt','authorization','provider','model','resultCount','mediaBytes','mediaWidth','mediaHeight'];
 return Object.fromEntries(Object.entries(input).filter(([key,value])=>
  allowed.includes(key)&&(typeof value==='string'||Number.isFinite(value))));
}
export async function saveAgentWorkflow(record){
 if(!record||record.schema!==1||!record.id||!record.policySnapshot||!Array.isArray(record.steps))
  throw new Error('Invalid agent workflow');
 const workflowStatuses=['pending-confirmation','running','awaiting-owner','paused','succeeded','failed','cancelled','invalidated'];
 const stepStatuses=['pending','running','awaiting-owner','needs-review','succeeded','failed','cancelled','invalidated'];
 const targetSource=record.targetSource==='server-approved'?'server-approved':'local-owner-defined';
 const policy=record.policySnapshot;
 const allowedSkills=[...new Set((Array.isArray(policy.allowedSkills)?policy.allowedSkills:[])
  .map(value=>String(value||'').slice(0,48))
  .filter(value=>['describe_object','capture_image','product_search'].includes(value)))].slice(0,3).sort();
 const safePolicy={
  contract:String(policy.contract||'').slice(0,32),skillContract:String(policy.skillContract||'').slice(0,32),
  createdAt:Number.isFinite(policy.createdAt)?policy.createdAt:Date.now(),
  targetId:String(policy.targetId||record.targetId||'').slice(0,96),
  targetSource:policy.targetSource==='server-approved'?'server-approved':'local-owner-defined',
  targetFingerprint:String(policy.targetFingerprint||'').slice(0,500),allowedSkills,
  participantId:String(policy.participantId||record.participantId||'').slice(0,96)||null
 };
 const steps=record.steps.slice(0,6).map((step,index)=>({
  id:String(step?.id||('step-'+(index+1))).slice(0,64),
  skillId:['describe_object','capture_image','product_search'].includes(step?.skillId)?step.skillId:'describe_object',
  dependsOn:[...new Set((Array.isArray(step?.dependsOn)?step.dependsOn:[])
   .map(value=>String(value||'').slice(0,64)).filter(Boolean))].slice(0,5),
  idempotencyKey:String(step?.idempotencyKey||'').slice(0,180),
  status:stepStatuses.includes(step?.status)?step.status:'failed',
  attempts:Math.max(0,Math.min(3,Number(step?.attempts)||0)),
  maxAttempts:Math.max(1,Math.min(3,Number(step?.maxAttempts)||2)),
  startedAt:Number.isFinite(step?.startedAt)?step.startedAt:null,
  completedAt:Number.isFinite(step?.completedAt)?step.completedAt:null,
  resultText:String(step?.resultText||'').slice(0,900),resultSources:safeWorkflowSources(step?.resultSources),
  executionProvenance:safeWorkflowProvenance(step?.executionProvenance),
  errorText:String(step?.errorText||'').slice(0,240),
  lastAttemptId:String(step?.lastAttemptId||'').slice(0,96)||null
 }));
 if(!safePolicy.targetId||!steps.length)throw new Error('Invalid workflow target or steps');
 const safe={
  schema:1,id:String(record.id).slice(0,96),name:String(record.name||'Agent workflow').slice(0,120),
  targetId:String(record.targetId||safePolicy.targetId).slice(0,96),targetSource,
  participantId:String(record.participantId||safePolicy.participantId||'').slice(0,96)||null,
  policySnapshot:safePolicy,status:workflowStatuses.includes(record.status)?record.status:'failed',
  createdAt:Number.isFinite(record.createdAt)?record.createdAt:Date.now(),
  updatedAt:Number.isFinite(record.updatedAt)?record.updatedAt:Date.now(),
  confirmedAt:Number.isFinite(record.confirmedAt)?record.confirmedAt:null,
  completedAt:Number.isFinite(record.completedAt)?record.completedAt:null,
  cancelRequested:Boolean(record.cancelRequested),recoveryRequired:Boolean(record.recoveryRequired),
  currentStepId:String(record.currentStepId||'').slice(0,64)||null,
  steps,errorText:String(record.errorText||'').slice(0,240)
 };
 return storeAction(AGENT_WORKFLOWS,'readwrite',async store=>{
  await requestToPromise(store.put(safe));
  const rows=await requestToPromise(store.getAll());
  for(const item of rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(0,Math.max(0,rows.length-MAX_PERSISTED_AGENT_WORKFLOWS)))store.delete(item.id);
  return safe;
 });
}
export function deleteAgentWorkflow(id){
 return storeAction(AGENT_WORKFLOWS,'readwrite',async store=>{
  await requestToPromise(store.delete(id));return true;
 });
}
export function clearAgentWorkflows(){
 return storeAction(AGENT_WORKFLOWS,'readwrite',store=>requestToPromise(store.clear()));
}


/* V0.14D durable memory remains owner-authorized only. Owner-authored rows and
   explicitly owner-approved proposal rows may persist; proposal queues never do. */
export function listAgentMemories(){
 return storeAction(AGENT_MEMORIES,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(-MAX_PERSISTED_AGENT_MEMORIES);
 });
}
function persistableAgentMemory(input){
 const memory=normalizeMemoryRecord({...input,persistent:true});
 if(memory.authority!=='owner'||!['owner-authored','owner-approved-proposal'].includes(memory.provenance))
  throw new Error('Only owner-authorized memory can be persisted.');
 const sourceRefs=memory.provenance==='owner-approved-proposal'
  ?memory.sourceRefs.slice(0,5).map(ref=>({
    kind:String(ref.kind||'').slice(0,32),sourceId:String(ref.sourceId||'').slice(0,96),
    meetingId:String(ref.meetingId||'').slice(0,96)||null,
    participantId:String(ref.participantId||'').slice(0,96)||null,
    at:Number.isFinite(ref.at)?ref.at:null,fingerprint:String(ref.fingerprint||'').slice(0,96)||null
   })):[];
 return {
  schema:2,id:memory.id,type:memory.type,participantId:memory.participantId,
  text:memory.text,authority:'owner',provenance:memory.provenance,
  sourceRefs,approvedAt:Number.isFinite(memory.approvedAt)?memory.approvedAt:null,
  proposalMethod:String(memory.proposalMethod||'').slice(0,64)||null,
  createdAt:memory.createdAt,updatedAt:memory.updatedAt,expiresAt:memory.expiresAt,
  status:memory.status,revokedAt:memory.revokedAt,revokeReason:memory.revokeReason,
  revisions:memory.revisions.map(r=>({text:r.text,at:r.at})),persistent:true
 };
}
export async function saveAgentMemory(input){
 const safe=persistableAgentMemory(input);
 return storeAction(AGENT_MEMORIES,'readwrite',async store=>{
  await requestToPromise(store.put(safe));
  const rows=await requestToPromise(store.getAll());
  for(const item of rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(0,Math.max(0,rows.length-MAX_PERSISTED_AGENT_MEMORIES))) store.delete(item.id);
  return safe;
 });
}
export async function saveApprovedMemoryProposal(input,{
 revokeIds=[],reason='Superseded by owner-approved memory proposal',at=Date.now()
}={}){
 const memory=normalizeMemoryRecord({...input,persistent:true});
 if(memory.provenance!=='owner-approved-proposal')
  throw new Error('Approved proposal memory required.');
 const ids=[...new Set((Array.isArray(revokeIds)?revokeIds:[])
  .map(value=>String(value||'').slice(0,96)).filter(Boolean))].slice(0,12);
 const db=await openParticipantDb();
 try{
  const tx=db.transaction([AGENT_MEMORIES],'readwrite'),store=tx.objectStore(AGENT_MEMORIES);
  const done=transactionToPromise(tx);
  const revoked=[];
  for(const id of ids){
   const existing=await requestToPromise(store.get(id));
   if(!existing)continue;
   const current=normalizeMemoryRecord(existing,at);
   if(current.status!=='active')continue;
   const next=revokeMemoryRecord(current,reason,at);
   await requestToPromise(store.put(persistableAgentMemory(next)));revoked.push(next);
  }
  const safe=persistableAgentMemory(memory);
  await requestToPromise(store.put(safe));
  const rows=await requestToPromise(store.getAll());
  for(const item of rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(0,Math.max(0,rows.length-MAX_PERSISTED_AGENT_MEMORIES)))store.delete(item.id);
  await done;return {memory:safe,revoked};
 }finally{db.close();}
}
export function deleteAgentMemory(id){
 return storeAction(AGENT_MEMORIES,'readwrite',async store=>{
  await requestToPromise(store.delete(id));return true;
 });
}
export function clearAgentMemories(){
 return storeAction(AGENT_MEMORIES,'readwrite',store=>requestToPromise(store.clear()));
}


/* Account-backed participant sync state. This is separate from the legacy manual
   biometric participant-sync state so signed-in desktop/mobile persistence can be automatic. */
export function normalizeAccountParticipantSyncState(input={}){
 const participantId=String(input.participantId||'').slice(0,96);
 if(!participantId)throw new Error('participantId required');
 return {
  participantId,
  serverVersion:Math.max(0,Number(input.serverVersion)||0),
  serverUpdatedAt:Number.isFinite(input.serverUpdatedAt)?input.serverUpdatedAt:null,
  lastSyncedLocalUpdatedAt:String(input.lastSyncedLocalUpdatedAt||'').slice(0,64)||null,
  pending:input.pending===true,
  localDeletedAt:Number.isFinite(input.localDeletedAt)?input.localDeletedAt:null,
  conflict:input.conflict===true,
  errorText:String(input.errorText||'').slice(0,240),
  updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now()
 };
}
export function listAccountParticipantSyncStates(){
 return storeAction(ACCOUNT_PARTICIPANT_SYNC,'readonly',store=>requestToPromise(store.getAll()));
}
export function getAccountParticipantSyncState(participantId){
 return storeAction(ACCOUNT_PARTICIPANT_SYNC,'readonly',
  store=>requestToPromise(store.get(String(participantId||''))));
}
export async function saveAccountParticipantSyncState(input){
 const safe=normalizeAccountParticipantSyncState(input);
 await storeAction(ACCOUNT_PARTICIPANT_SYNC,'readwrite',store=>requestToPromise(store.put(safe)));
 return safe;
}
export function deleteAccountParticipantSyncState(participantId){
 return storeAction(ACCOUNT_PARTICIPANT_SYNC,'readwrite',async store=>{
  await requestToPromise(store.delete(String(participantId||'')));return true;
 });
}
export async function markAccountParticipantPending(participantId,{deleted=false,errorText=''}={}){
 const current=await getAccountParticipantSyncState(participantId);
 return saveAccountParticipantSyncState({
  ...(current||{}),participantId,
  pending:true,localDeletedAt:deleted?Date.now():null,
  conflict:false,errorText,updatedAt:Date.now()
 });
}


/* V0.10H explicit manual participant sync state. This is reconciliation metadata,
   not a background transport and contains no participant profile/biometric data. */
export function normalizeParticipantSyncState(input={}){
 const participantId=String(input.participantId||'').slice(0,96);
 if(!participantId)throw new Error('participantId required');
 return {
  participantId,enabled:input.enabled===true,
  serverVersion:Math.max(0,Number(input.serverVersion)||0),
  lastSyncedLocalUpdatedAt:Number.isFinite(input.lastSyncedLocalUpdatedAt)?input.lastSyncedLocalUpdatedAt:null,
  localDeletedAt:Number.isFinite(input.localDeletedAt)?input.localDeletedAt:null,
  consentConfirmedAt:Number.isFinite(input.consentConfirmedAt)?input.consentConfirmedAt:null,
  serverUpdatedAt:Number.isFinite(input.serverUpdatedAt)?input.serverUpdatedAt:null,
  updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now()
 };
}
export function listParticipantSyncStates(){
 return storeAction(PARTICIPANT_SYNC,'readonly',store=>requestToPromise(store.getAll()));
}
export function getParticipantSyncState(participantId){
 return storeAction(PARTICIPANT_SYNC,'readonly',store=>requestToPromise(store.get(participantId)));
}
export async function saveParticipantSyncState(input){
 const safe=normalizeParticipantSyncState(input);
 await storeAction(PARTICIPANT_SYNC,'readwrite',store=>requestToPromise(store.put(safe)));
 return safe;
}
export function deleteParticipantSyncState(participantId){
 return storeAction(PARTICIPANT_SYNC,'readwrite',async store=>{
  await requestToPromise(store.delete(participantId));return true;
 });
}


/* V0.14F generalized metadata sync state. These stores contain device/scope,
   version and journal metadata only; synchronized resource payloads remain canonical. */
function resourceSyncType(value){
 const type=String(value||'');if(!['memory','task','scene'].includes(type))
  throw new Error('Invalid resource sync type.');return type;
}
function resourceSyncKey(type,id){
 const t=resourceSyncType(type),rid=String(id||'').slice(0,96);
 if(!rid)throw new Error('Resource sync ID required.');return t+':'+rid;
}
export function normalizeResourceSyncConfig(input={}){
 const deviceId=String(input.deviceId||'').slice(0,96);
 const scopes=[...new Set((Array.isArray(input.scopes)?input.scopes:[])
  .filter(value=>['memory','task','scene'].includes(value)))];
 return {
  id:'server-sync-v2',deviceId,label:String(input.label||'This browser').slice(0,80),
  scopes,cursor:Math.max(0,Number(input.cursor)||0),
  registered:input.registered===true,revokedAt:Number.isFinite(input.revokedAt)?input.revokedAt:null,
  lastSyncAt:Number.isFinite(input.lastSyncAt)?input.lastSyncAt:null,
  updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now()
 };
}
export function getResourceSyncConfig(){
 return storeAction(RESOURCE_SYNC_CONFIG,'readonly',async store=>{
  const row=await requestToPromise(store.get('server-sync-v2'));return row?normalizeResourceSyncConfig(row):null;
 });
}
export async function saveResourceSyncConfig(input){
 const safe=normalizeResourceSyncConfig(input);
 await storeAction(RESOURCE_SYNC_CONFIG,'readwrite',store=>requestToPromise(store.put(safe)));
 return safe;
}
export function clearResourceSyncConfig(){
 return storeAction(RESOURCE_SYNC_CONFIG,'readwrite',store=>requestToPromise(store.clear()));
}
export function normalizeResourceSyncState(input={}){
 const type=resourceSyncType(input.resourceType),resourceId=String(input.resourceId||'').slice(0,96);
 if(!resourceId)throw new Error('Resource sync ID required.');
 return {
  key:resourceSyncKey(type,resourceId),resourceType:type,resourceId,
  serverVersion:Math.max(0,Number(input.serverVersion)||0),
  lastSyncedFingerprint:String(input.lastSyncedFingerprint||'').slice(0,160)||null,
  serverUpdatedAt:Number.isFinite(input.serverUpdatedAt)?input.serverUpdatedAt:null,
  updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now()
 };
}
export function listResourceSyncStates(){
 return storeAction(RESOURCE_SYNC_STATE,'readonly',store=>requestToPromise(store.getAll()));
}
export function getResourceSyncState(type,id){
 return storeAction(RESOURCE_SYNC_STATE,'readonly',store=>requestToPromise(store.get(resourceSyncKey(type,id))));
}
export async function saveResourceSyncState(input){
 const safe=normalizeResourceSyncState(input);
 await storeAction(RESOURCE_SYNC_STATE,'readwrite',store=>requestToPromise(store.put(safe)));
 return safe;
}
export function deleteResourceSyncState(type,id){
 return storeAction(RESOURCE_SYNC_STATE,'readwrite',async store=>{
  await requestToPromise(store.delete(resourceSyncKey(type,id)));return true;
 });
}
export function normalizeResourceSyncJournal(input={}){
 const type=resourceSyncType(input.resourceType),resourceId=String(input.resourceId||'').slice(0,96);
 const id=String(input.id||'').slice(0,96);
 if(!id||!resourceId||!['push-upsert','push-delete','pull-upsert','pull-delete'].includes(input.operation))
  throw new Error('Invalid resource sync journal entry.');
 return {
  id,key:resourceSyncKey(type,resourceId),resourceType:type,resourceId,operation:input.operation,
  baseVersion:Math.max(0,Number(input.baseVersion)||0),
  serverVersion:Math.max(0,Number(input.serverVersion)||0),
  localFingerprint:String(input.localFingerprint||'').slice(0,160)||null,
  status:input.status==='applied'?'applied':'pending',
  attempts:Math.max(0,Math.min(9,Number(input.attempts)||0)),
  createdAt:Number.isFinite(input.createdAt)?input.createdAt:Date.now(),
  updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now(),
  errorText:String(input.errorText||'').slice(0,240)
 };
}
export function listResourceSyncJournal(){
 return storeAction(RESOURCE_SYNC_JOURNAL,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.map(normalizeResourceSyncJournal).sort((a,b)=>a.createdAt-b.createdAt)
   .slice(-MAX_PERSISTED_RESOURCE_SYNC_JOURNAL);
 });
}
export async function saveResourceSyncJournal(input){
 const safe=normalizeResourceSyncJournal(input);
 return storeAction(RESOURCE_SYNC_JOURNAL,'readwrite',async store=>{
  await requestToPromise(store.put(safe));
  const rows=await requestToPromise(store.getAll());
  for(const row of rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(0,Math.max(0,rows.length-MAX_PERSISTED_RESOURCE_SYNC_JOURNAL)))store.delete(row.id);
  return safe;
 });
}
export function deleteResourceSyncJournal(id){
 return storeAction(RESOURCE_SYNC_JOURNAL,'readwrite',async store=>{
  await requestToPromise(store.delete(String(id||'')));return true;
 });
}
export async function clearAppliedResourceSyncJournal(){
 return storeAction(RESOURCE_SYNC_JOURNAL,'readwrite',async store=>{
  const rows=await requestToPromise(store.getAll());let removed=0;
  for(const row of rows)if(row.status==='applied'){store.delete(row.id);removed++;}
  return removed;
 });
}


/* V0.11E meeting metadata only. Canonical transcript text remains in DIALOGUE. */
export function pruneMeetings(maxRows=MAX_PERSISTED_MEETINGS){
 return storeAction(MEETINGS,'readwrite',async store=>{
  const rows=await requestToPromise(store.getAll());
  if(rows.length<=maxRows)return 0;
  const ended=rows.filter(row=>row.status==='ended')
   .sort((a,b)=>Number(a.startedAt||0)-Number(b.startedAt||0));
  const remove=ended.slice(0,Math.max(0,rows.length-maxRows));
  for(const row of remove)store.delete(row.id);
  return remove.length;
 });
}
export async function saveMeeting(input){
 const record=normalizeMeetingRecord(input);
 await storeAction(MEETINGS,'readwrite',async store=>{
  if(record.status==='active'){
   const rows=await requestToPromise(store.getAll());
   const other=rows.find(row=>row.status==='active'&&row.id!==record.id);
   if(other)throw new Error('Another meeting is already active in this browser profile.');
  }
  await requestToPromise(store.put(record));
 });
 await pruneMeetings().catch(()=>{});
 return record;
}
export function getMeeting(id){
 return storeAction(MEETINGS,'readonly',store=>requestToPromise(store.get(id)));
}
export function listMeetings(){
 return storeAction(MEETINGS,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.map(normalizeMeetingRecord)
   .sort((a,b)=>Number(b.startedAt||0)-Number(a.startedAt||0));
 });
}
export async function getActiveMeeting(){
 const rows=await listMeetings();
 return rows.find(row=>row.status==='active')||null;
}
export function deleteMeeting(id){
 return storeAction(MEETINGS,'readwrite',async store=>{
  await requestToPromise(store.delete(id));return true;
 });
}

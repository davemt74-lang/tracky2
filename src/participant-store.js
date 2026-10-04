import { participantRecord, cryptoRandomId } from './participant-core.js';
import { browserMatchStorage, deleteParticipantMatchHistory } from './match-history.js';
import {normalizeRoomScene,emptyRoomScene} from './room-scene-graph.js';
import {reviseTranscriptRecord} from './transcript-correction.js';
import {normalizeMemoryRecord} from './agent-memory-core.js';
import {normalizeMeetingRecord,scrubMeetingParticipant} from './meeting-core.js';

const DB_NAME = 'tracky-participants-v1';
const DB_VERSION = 8;
const PARTICIPANTS = 'participants';
const PENDING = 'pending-captures';
const DIALOGUE = 'dialogue-turns';
const ROOM_OBSERVATIONS = 'room-observations';
const ROOM_SCENE = 'room-scene-map';
const AGENT_TASKS = 'agent-tasks';
const AGENT_MEMORIES = 'agent-memories';
const PARTICIPANT_SYNC = 'participant-sync-state';
const MEETINGS = 'meetings';
export const MAX_PERSISTED_ROOM_OBSERVATIONS=500;

export const PENDING_CAPTURE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_DIALOGUE_TURNS = 500;
export const MAX_PERSISTED_AGENT_TASKS = 200;
export const MAX_PERSISTED_AGENT_MEMORIES = 200;
export const MAX_PERSISTED_MEETINGS = 120;

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
      if (!db.objectStoreNames.contains(AGENT_MEMORIES)) {
        const memories=db.createObjectStore(AGENT_MEMORIES,{keyPath:'id'});
        memories.createIndex('participantId','participantId',{unique:false});
        memories.createIndex('status','status',{unique:false});
        memories.createIndex('expiresAt','expiresAt',{unique:false});
      }
      if (!db.objectStoreNames.contains(PARTICIPANT_SYNC)) {
        db.createObjectStore(PARTICIPANT_SYNC,{keyPath:'participantId'});
      }
      if (!db.objectStoreNames.contains(MEETINGS)) {
        const meetings=db.createObjectStore(MEETINGS,{keyPath:'id'});
        meetings.createIndex('status','status',{unique:false});
        meetings.createIndex('startedAt','startedAt',{unique:false});
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
    const tx = db.transaction([PARTICIPANTS, DIALOGUE, ROOM_OBSERVATIONS, AGENT_MEMORIES, PARTICIPANT_SYNC, MEETINGS], 'readwrite');
    const done = transactionToPromise(tx);
    const participants = tx.objectStore(PARTICIPANTS);
    const dialogue = tx.objectStore(DIALOGUE);
    const observations = tx.objectStore(ROOM_OBSERVATIONS);
    const memories = tx.objectStore(AGENT_MEMORIES);
    const sync = tx.objectStore(PARTICIPANT_SYNC);
    const meetings = tx.objectStore(MEETINGS);

    const participant = await requestToPromise(participants.get(id));
    await requestToPromise(participants.delete(id));

    const rows = await requestToPromise(dialogue.getAll());
    for (const row of rows) {
      if (row.participantId === id) {
        dialogue.delete(row.id);
        continue;
      }

      const nearbyIds = Array.from(row.nearbyParticipantIds || []);
      const nearbyNames = Array.from(row.nearbyParticipantNames || []);
      const conversationIds=Array.from(row.conversationParticipantIds||[]);
      const addressedIds=Array.from(row.addressedParticipantIds||[]);
      const hasNearbyReference = nearbyIds.includes(id);
      const hasNameReference = participant?.name && nearbyNames.includes(participant.name);
      const hasConversationReference=conversationIds.includes(id);
      const hasAddressReference=addressedIds.includes(id)||row.addressedParticipantId===id;

      if (hasNearbyReference || hasNameReference || hasConversationReference || hasAddressReference) {
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
            ? (row.addressedAgent?'agent':'unspecified'):(row.addressKind||'unspecified')
        });
      }
    }

    // Erase attributed room observations in the same transaction as the profile.
    const roomRows = await requestToPromise(observations.getAll());
    for (const event of roomRows) {
      if (event.participantId === id) observations.delete(event.id);
    }

    // Explicit participant memories have the same local deletion boundary.
    const memoryRows = await requestToPromise(memories.getAll());
    for (const memory of memoryRows) {
      if (memory.participantId === id) memories.delete(memory.id);
    }

    // Meeting metadata references participant IDs only; scrub them without deleting
    // the whole meeting or copying/deleting unrelated canonical transcript content.
    const meetingRows=await requestToPromise(meetings.getAll());
    for(const meeting of meetingRows){
      const scrubbed=scrubMeetingParticipant(normalizeMeetingRecord(meeting),id,Date.now());
      if(JSON.stringify(scrubbed)!==JSON.stringify(meeting))meetings.put(scrubbed);
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
    rawAudio:discardRawAudio,audio:discardAudio,...safeInput
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
  evidence:Number.isFinite(record.evidence?.durationMs)||record.evidence?.durationMs===null?
   {durationMs:record.evidence.durationMs}:null,
  version:record.version===1?1:null,kind:record.kind||'observation',
  semantic:String(record.semantic||'').slice(0,48),
  deviceId:String(record.deviceId||'browser').slice(0,40),
  sessionId:String(record.sessionId||'room-session').slice(0,64),
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
 const safe={
  schema:record.schema===1?1:null,id:String(record.id).slice(0,96),
  skillId:record.skillId,targetId:String(record.targetId||'').slice(0,96),
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
  resultText:String(record.resultText||'').slice(0,500),
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


/* V0.10G durable memory is owner-authored only. Canonical transcripts and ROOM
   events stay in their existing stores and are referenced at retrieval time. */
export function listAgentMemories(){
 return storeAction(AGENT_MEMORIES,'readonly',async store=>{
  const rows=await requestToPromise(store.getAll());
  return rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(-MAX_PERSISTED_AGENT_MEMORIES);
 });
}
export async function saveAgentMemory(input){
 const memory=normalizeMemoryRecord({...input,persistent:true});
 if(memory.authority!=='owner'||memory.provenance!=='owner-authored')
  throw new Error('Only owner-authored memory can be persisted.');
 const safe={
  schema:1,id:memory.id,type:memory.type,participantId:memory.participantId,
  text:memory.text,authority:'owner',provenance:'owner-authored',
  createdAt:memory.createdAt,updatedAt:memory.updatedAt,expiresAt:memory.expiresAt,
  status:memory.status,revokedAt:memory.revokedAt,revokeReason:memory.revokeReason,
  revisions:memory.revisions.map(r=>({text:r.text,at:r.at})),persistent:true
 };
 return storeAction(AGENT_MEMORIES,'readwrite',async store=>{
  await requestToPromise(store.put(safe));
  const rows=await requestToPromise(store.getAll());
  for(const item of rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
   .slice(0,Math.max(0,rows.length-MAX_PERSISTED_AGENT_MEMORIES))) store.delete(item.id);
  return safe;
 });
}
export function deleteAgentMemory(id){
 return storeAction(AGENT_MEMORIES,'readwrite',async store=>{
  await requestToPromise(store.delete(id));return true;
 });
}
export function clearAgentMemories(){
 return storeAction(AGENT_MEMORIES,'readwrite',store=>requestToPromise(store.clear()));
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

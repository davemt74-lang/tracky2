import { participantRecord, cryptoRandomId } from './participant-core.js';
import { browserMatchStorage, deleteParticipantMatchHistory } from './match-history.js';
import {normalizeRoomScene,emptyRoomScene} from './room-scene-graph.js';

const DB_NAME = 'tracky-participants-v1';
const DB_VERSION = 4;
const PARTICIPANTS = 'participants';
const PENDING = 'pending-captures';
const DIALOGUE = 'dialogue-turns';
const ROOM_OBSERVATIONS = 'room-observations';
const ROOM_SCENE = 'room-scene-map';
export const MAX_PERSISTED_ROOM_OBSERVATIONS=500;

export const PENDING_CAPTURE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_DIALOGUE_TURNS = 500;

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

export async function deleteParticipant(id) {
  const db = await openParticipantDb();
  try {
    const tx = db.transaction([PARTICIPANTS, DIALOGUE, ROOM_OBSERVATIONS], 'readwrite');
    const done = transactionToPromise(tx);
    const participants = tx.objectStore(PARTICIPANTS);
    const dialogue = tx.objectStore(DIALOGUE);
    const observations = tx.objectStore(ROOM_OBSERVATIONS);

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
      const hasNearbyReference = nearbyIds.includes(id);
      const hasNameReference = participant?.name && nearbyNames.includes(participant.name);

      if (hasNearbyReference || hasNameReference) {
        dialogue.put({
          ...row,
          nearbyParticipantIds: nearbyIds.filter((participantId) => participantId !== id),
          nearbyParticipantNames: participant?.name
            ? nearbyNames.filter((name) => name !== participant.name)
            : nearbyNames
        });
      }
    }

    // Erase attributed room observations in the same transaction as the profile.
    const roomRows = await requestToPromise(observations.getAll());
    for (const event of roomRows) {
      if (event.participantId === id) observations.delete(event.id);
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
  const record = {
    ...input,
    id: input.id || cryptoRandomId(),
    sessionId: input.sessionId || 'room-session',
    createdAt: input.createdAt || new Date().toISOString()
  };

  await storeAction(DIALOGUE, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
  await pruneDialogueTurns().catch(() => {});
  return record;
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


// Only owner-entered area rectangles and object labels. Never save people,
// camera frames, photographs, coordinates from live tracks or audio here.
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

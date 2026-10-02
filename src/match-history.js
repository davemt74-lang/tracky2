// Consent-controlled local match results. Never persist faces, voices, camera frames or raw input.
export const MATCH_HISTORY_KEY = 'tracky2-match-history-v1';
export const MAX_SAVED_MATCHES = 100;
const validColor = color => color === 'green' || color === 'blue';

function sanitized(input) {
  if (!input || typeof input.id !== 'string' || input.id.length < 1 || input.id.length > 128 ||
      !Number.isSafeInteger(input.startMs) || !Number.isSafeInteger(input.endMs) ||
      input.startMs < 0 || input.endMs < input.startMs ||
      !Array.isArray(input.players) || input.players.length < 1 || input.players.length > 2 ||
      typeof input.completed !== 'boolean') return null;
  const ids=new Set(),colors=new Set(),players=[];
  for (const player of input.players) {
    if (!player || typeof player.participantId !== 'string' || !player.participantId ||
        player.participantId.length > 128 || !validColor(player.color) ||
        !Number.isInteger(player.score) || player.score < 0 || player.score > 50 ||
        !Number.isInteger(player.completedRounds) || player.completedRounds < 0 ||
        player.completedRounds > 10000 ||
        ids.has(player.participantId) || colors.has(player.color)) return null;
    ids.add(player.participantId);colors.add(player.color);
    players.push({ participantId:player.participantId,color:player.color,
      score:player.score,completedRounds:player.completedRounds });
  }
  return { id:input.id,startMs:input.startMs,endMs:input.endMs,completed:input.completed,players };
}
export function readMatchHistory(storage) {
  try {
    const raw=storage?.getItem(MATCH_HISTORY_KEY);
    if (!raw) return [];
    const list=JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map(sanitized).filter(Boolean).sort((a,b)=>b.endMs-a.endMs)
      .slice(0,MAX_SAVED_MATCHES);
  } catch { return []; }
}
export function saveMatchHistory(storage, match) {
  const record=sanitized(match);
  if (!record) return {saved:false,reason:'invalid-match'};
  if (!storage?.setItem) return {saved:false,reason:'storage-unavailable'};
  const previous=readMatchHistory(storage);
  if (previous.some(x=>x.id===record.id)) return {saved:true,duplicate:true,count:previous.length};
  const updated=[record,...previous].sort((a,b)=>b.endMs-a.endMs)
    .slice(0,MAX_SAVED_MATCHES);
  try {
    storage.setItem(MATCH_HISTORY_KEY,JSON.stringify(updated));
    return {saved:true,duplicate:false,count:updated.length};
  } catch {return {saved:false,reason:'storage-unavailable'};}
}
export function clearMatchHistory(storage) {
  try {
    storage?.removeItem(MATCH_HISTORY_KEY);
    return Boolean(storage?.removeItem);
  } catch { return false; }
}
export function deleteParticipantMatchHistory(storage,participantId) {
  if (typeof participantId !== 'string' || !participantId) return false;
  const original=readMatchHistory(storage);
  const changed=original.map(match=>({
    ...match,players:match.players.filter(p=>p.participantId!==participantId)
  })).filter(match=>match.players.length>0);
  try {
    if (!storage?.setItem || !storage?.removeItem) return false;
    if (!changed.length) storage.removeItem(MATCH_HISTORY_KEY);
    else storage.setItem(MATCH_HISTORY_KEY,JSON.stringify(changed));
    return true;
  } catch {return false;}
}
export function playerProgress(history,participantId) {
  const results=(Array.isArray(history)?history:[]).filter(match=>
    match && Array.isArray(match.players) &&
    match.players.some(player=>player.participantId===participantId));
  const performances=results.map(match=>match.players.find(p=>p.participantId===participantId));
  return Object.freeze({
    matches:performances.length,
    completedMatches:results.filter(match=>match.completed).length,
    bestScore:performances.length?Math.max(...performances.map(p=>p.score)):0,
    totalRounds:performances.reduce((sum,p)=>sum+p.completedRounds,0)
  });
}
export function browserMatchStorage() {
  try {return typeof window==='undefined'?null:window.localStorage;}
  catch {return null;}
}

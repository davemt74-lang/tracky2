// Game-lobby validation is independent of DOM, webcams and participant biometrics.
// Ticket is a one-time same-tab handoff. Never serialize full participant profiles.
import { GAME_SETTINGS } from './game-platform.js';

export const LOBBY_TICKET_KEY = 'tracky2-pending-game-v1';
export const LOBBY_GAME_ID = 'random-follow-pattern';
export const LOBBY_GAME_IDS = Object.freeze(['random-follow-pattern','reaction-challenge']);

export function validateLobbySelection(roster, choice) {
  if (!Array.isArray(roster) || !choice || !LOBBY_GAME_IDS.includes(choice.gameId) ||
      !Array.isArray(choice.playerIds) || !GAME_SETTINGS.playerCounts.includes(choice.playerIds.length) ||
      !GAME_SETTINGS.intervals.includes(choice.intervalSeconds) ||
      !GAME_SETTINGS.rounds.includes(choice.rounds)) {
    throw new RangeError('Choose a supported game, number of players, interval and rounds.');
  }
  if (choice.rounds < choice.playerIds.length) {
    throw new RangeError('Select at least as many rounds as players so everyone gets a turn.');
  }
  const ids = new Set();
  const players = choice.playerIds.map((id,index)=>{
    if (typeof id !== 'string' || !id || ids.has(id)) {
      throw new TypeError('Select different enrolled participants for each roster position.');
    }
    const p=roster.find(person=>person && person.id===id);
    if (!p) throw new TypeError('A selected participant is no longer enrolled.');
    ids.add(id);
    return Object.freeze({ participantId:id, name:String(p.name || p.nickname || ('Player '+(index+1))).trim().slice(0,80) });
  });
  // For 3–6 players, pass one green physical marker between turns. We do NOT claim
  // to know which person is holding the marker; identity is a manually assigned roster.
  const controllerMode=players.length===2 ? 'individual-colors' : 'shared-green';
  const assignments=Object.freeze(players.map((p,index)=>Object.freeze({
    ...p,color:controllerMode==='individual-colors' && index===1?'blue':'green'
  })));
  return Object.freeze({
    gameId:choice.gameId,
    players:assignments,
    intervalSeconds:choice.intervalSeconds,
    rounds:choice.rounds,
    controllerMode,
    totalSeconds:choice.intervalSeconds*choice.rounds
  });
}

export function makeLobbyTicket(verified) {
  if (!verified || !LOBBY_GAME_IDS.includes(verified.gameId) || !Array.isArray(verified.players)) {
    throw new TypeError('Validate the roster before creating a game handoff.');
  }
  return JSON.stringify({
    version:1,gameId:verified.gameId,
    playerIds:verified.players.map(p=>p.participantId),
    intervalSeconds:verified.intervalSeconds,
    rounds:verified.rounds
  });
}
export function consumeLobbyTicket(storage, roster) {
  if (!storage || typeof storage.getItem!=='function' || typeof storage.removeItem!=='function') {
    return {status:'unavailable'};
  }
  let text;
  try {
    text=storage.getItem(LOBBY_TICKET_KEY);
    storage.removeItem(LOBBY_TICKET_KEY); // one-time even when the ticket is malformed
  } catch { return {status:'unavailable'}; }
  if (!text) return {status:'empty'};
  if (text.length>2048) return {status:'invalid'};
  try {
    const ticket=JSON.parse(text);
    if (!ticket || ticket.version!==1 || !Array.isArray(ticket.playerIds)) return {status:'invalid'};
    return {status:'ready',setup:validateLobbySelection(roster,ticket)};
  } catch {
    return {status:'invalid'};
  }
}

export function roundRosterPreview(verified) {
  if (!verified || !Array.isArray(verified.players)) throw new TypeError('Expected validated lobby setup.');
  return Object.freeze(Array.from({length:verified.rounds},(_,i)=>Object.freeze({
    round:i+1,
    playerNumber:i%verified.players.length+1,
    participantId:verified.players[i%verified.players.length].participantId,
    name:verified.players[i%verified.players.length].name,
    color:verified.players[i%verified.players.length].color,
    intervalSeconds:verified.intervalSeconds
  })));
}

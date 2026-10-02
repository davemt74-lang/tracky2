// Manual enrollment-based assignment; a colored object never proves its holder's identity.
import { createGameSession } from './game-session.js';
import { CONTROLLER_COLORS } from './color-controllers.js';

const COLORS = Object.keys(CONTROLLER_COLORS);
export function createMultiplayerMatch({ pointGoal = 5 } = {}) {
  const sessions = Object.fromEntries(COLORS.map(color => [color, createGameSession({ pointGoal })]));
  let players = [];
  let started = false;
  return {
    configure(assignments, participants) {
      if (started) throw new Error('Stop the match before changing player assignments.');
      if (!Array.isArray(assignments) || assignments.length !== 2 || !Array.isArray(participants)) {
        throw new Error('Select two enrolled players.');
      }
      const known = new Map(participants.filter(p => p && typeof p.id === 'string' && p.id)
        .map(p => [p.id, p]));
      const ids = new Set(), colors = new Set();
      const verified = assignments.map(a => {
        if (!a || !COLORS.includes(a.color) || typeof a.participantId !== 'string' ||
            !known.has(a.participantId) || ids.has(a.participantId) || colors.has(a.color)) {
          throw new Error('Each distinct enrolled player needs one distinct color.');
        }
        ids.add(a.participantId); colors.add(a.color);
        const p = known.get(a.participantId);
        return Object.freeze({ participantId: p.id, name: String(p.name || p.nickname || 'Player'),
          color: a.color });
      });
      players = verified.sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color));
      return this.snapshot();
    },
    begin(goal = pointGoal, random = Math.random) {
      if (started) return { type: 'already-active' };
      if (players.length !== 2) return { type: 'players-required' };
      if (!Number.isFinite(goal) || goal < 1 || goal > 50) return { type: 'invalid-goal' };
      for (const color of COLORS) sessions[color].begin(goal, random);
      started = true;
      return { type: 'match-start' };
    },
    sample(color, input, random = Math.random) {
      if (!started) return { type: 'inactive' };
      if (!COLORS.includes(color) || !players.some(p => p.color === color)) {
        return { type: 'unassigned-controller' };
      }
      const result = sessions[color].sample(input, random);
      if (COLORS.every(c => sessions[c].game.over)) started = false;
      return result;
    },
    signalLost(color) {
      if (!started || !COLORS.includes(color)) return { type: 'inactive' };
      return sessions[color].signalLost();
    },
    stop() {
      if (!started) return { type: 'inactive' };
      for (const color of COLORS) sessions[color].stop();
      started = false;
      return { type: 'match-stopped' };
    },
    getSession(color) { return sessions[color] || null; },
    snapshot() {
      return Object.freeze({
        active: started,
        complete: players.length === 2 && COLORS.every(c => sessions[c].game.over),
        players: Object.freeze(players.map(p => Object.freeze({ ...p, ...sessions[p.color].snapshot() })))
      });
    }
  };
}

// DOM-free game lifecycle. Camera and participant engines supply only normalized samples.
import { createGameState, recordGameSample, resetRepDetector, startGame, stopGame } from './gameplay-core.js';

export function createGameSession({ pointGoal = 5, zoneCount = 3, onEvent = null, maxEvents = 64 } = {}) {
  const game = createGameState(pointGoal, zoneCount);
  const history = [];
  let lastTimestamp = null;
  let signalPresent = false;
  let sessionNumber = 0;
  const eventLimit = Math.max(1, Math.min(256, Math.floor(Number(maxEvents) || 64)));

  function publish(type) {
    const event = Object.freeze({
      type, sessionNumber, score: game.score, repsRemaining: game.repsRemaining,
      completedRounds: game.completedRounds, activeZone: game.activeZone
    });
    history.push(event);
    if (history.length > eventLimit) history.shift();
    if (typeof onEvent === 'function') onEvent(event);
    return event;
  }

  return {
    get game() { return game; },
    get signalPresent() { return signalPresent; },
    get sessionNumber() { return sessionNumber; },
    history() { return history.slice(); },
    snapshot() {
      return Object.freeze({
        sessionNumber, zoneCount: game.zoneCount, active: game.active, over: game.over,
        score: game.score, pointGoal: game.pointGoal, activeZone: game.activeZone,
        repsRemaining: game.repsRemaining, completedRounds: game.completedRounds,
        signalPresent, lastEvent: game.lastEvent
      });
    },
    begin(goal = game.pointGoal, random = Math.random) {
      if (game.active) return { type: 'already-active' };
      sessionNumber += 1;
      lastTimestamp = null;
      signalPresent = false;
      startGame(game, goal, random);
      publish('game-start');
      return { type: 'game-start', game };
    },
    sample(input, random = Math.random) {
      if (!game.active || game.over) return { type: 'inactive', zone: null };
      if (!input || !Number.isFinite(input.x) || !Number.isFinite(input.y) ||
          input.x < 0 || input.x > 1 || input.y < 0 || input.y > 1 ||
          !Number.isFinite(input.timestamp) || input.timestamp < 0) {
        return { type: 'invalid-input', zone: null };
      }
      // Never score the same or an older camera frame twice.
      if (lastTimestamp !== null && input.timestamp <= lastTimestamp) {
        return { type: 'stale-input', zone: null };
      }
      lastTimestamp = input.timestamp;
      signalPresent = true;
      const result = recordGameSample(game, input.y, random);
      if (result.type === 'rep' || result.type === 'point' || result.type === 'game-over') {
        publish(result.type);
      }
      if (result.type === 'game-over') signalPresent = false;
      return result;
    },
    suspendTurn() {
      // Switching players must discard partial reps without falsely reporting a camera outage.
      if (!game.active) return { type: 'inactive' };
      signalPresent = false;
      lastTimestamp = null;
      resetRepDetector(game.detector);
      game.lastEvent = 'round-start';
      return { type: 'turn-suspended' };
    },
    signalLost() {
      if (!game.active) return { type: 'inactive' };
      if (!signalPresent) return { type: 'already-lost' };
      signalPresent = false;
      lastTimestamp = null;
      // Require a complete new up/down movement after tracking resumes.
      resetRepDetector(game.detector);
      game.lastEvent = 'signal-lost';
      publish('signal-lost');
      return { type: 'signal-lost' };
    },
    stop() {
      if (!game.active) return { type: 'inactive' };
      stopGame(game);
      signalPresent = false;
      lastTimestamp = null;
      publish('stopped');
      return { type: 'stopped' };
    }
  };
}

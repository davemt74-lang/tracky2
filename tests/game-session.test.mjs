import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameSession } from '../src/game-session.js';
import { toColorControllerInput } from '../src/game-input.js';

const frame = (y, timestamp, x = 0.5) => ({ x, y, timestamp, source: 'color-object' });

test('input adapter preserves raw vertical samples, mirrors X only, and rejects invalid data', () => {
  assert.deepEqual(toColorControllerInput({ x: 0.2, y: 0.6 }, true, 12), {
    source: 'color-object', x: 0.8, y: 0.6, timestamp: 12
  });
  assert.equal(toColorControllerInput(null), null);
  assert.equal(toColorControllerInput({ x: NaN, y: 0.5 }), null);
  assert.equal(toColorControllerInput({ x: 0.5, y: 0.5 }, false, -1), null);
});

test('game session runs original zone-scoring rules without camera, DOM or identity', () => {
  const s = createGameSession({ pointGoal: 1 });
  assert.equal(s.begin(1, () => 0).type, 'game-start');
  const game = s.game;
  game.activeZone = 1;
  game.roundTarget = 1;
  game.repsRemaining = 1;
  game.detector.minExcursion = 0.03;
  const events = [0.58, 0.54, 0.50, 0.54].map((y, i) => s.sample(frame(y, i + 1), () => 0));
  assert.equal(events.at(-1).type, 'game-over');
  assert.equal(s.snapshot().score, 1);
  assert.equal(s.snapshot().over, true);
  assert.deepEqual(s.history().map(e => e.type), ['game-start', 'game-over']);
});

test('session does not accept invalid, out-of-bounds, stale or duplicate frames', () => {
  const s = createGameSession();
  s.begin(3, () => 0);
  assert.equal(s.sample(frame(0.6, 5)).type, 'outside-zone');
  assert.equal(s.sample(frame(0.4, 5)).type, 'stale-input');
  assert.equal(s.sample(frame(0.4, 4)).type, 'stale-input');
  assert.equal(s.sample(frame(1.2, 6)).type, 'invalid-input');
  assert.equal(s.sample(frame(NaN, 6)).type, 'invalid-input');
  assert.equal(s.snapshot().score, 0);
});

test('lost camera signal discards incomplete rep and accepts recovery frames', () => {
  const s = createGameSession();
  s.begin(4, () => 0);
  s.game.activeZone = 1;
  s.game.detector.minExcursion = 0.03;
  s.sample(frame(0.58, 1));
  s.sample(frame(0.50, 2)); // up only
  assert.equal(s.signalLost().type, 'signal-lost');
  assert.equal(s.signalLost().type, 'already-lost');
  assert.equal(s.snapshot().lastEvent, 'signal-lost');
  assert.notEqual(s.sample(frame(0.58, 3)).type, 'rep'); // stale downward leg must not score
  assert.notEqual(s.sample(frame(0.54, 4)).type, 'rep');
  assert.notEqual(s.sample(frame(0.50, 5)).type, 'rep');
  assert.equal(s.sample(frame(0.54, 6)).type, 'rep');
  assert.equal(s.snapshot().signalPresent, true);
});

test('restart clears stale frame and is not allowed to interrupt an active session', () => {
  const s = createGameSession();
  assert.equal(s.begin(2).type, 'game-start');
  assert.equal(s.begin(6).type, 'already-active');
  assert.equal(s.game.pointGoal, 2);
  s.sample(frame(0.25, 900));
  assert.equal(s.stop().type, 'stopped');
  assert.equal(s.stop().type, 'inactive');
  assert.equal(s.begin(6).type, 'game-start');
  assert.notEqual(s.sample(frame(0.24, 1)).type, 'stale-input');
  assert.equal(s.snapshot().sessionNumber, 2);
});

test('history is bounded, minimal and does not retain supplied participant data', () => {
  const received = [];
  const s = createGameSession({ maxEvents: 2, onEvent: e => received.push(e) });
  s.begin();
  s.sample({ ...frame(0.1, 1), participantId: 'private-person', embedding: [1, 2] });
  s.signalLost();
  s.stop();
  assert.equal(s.history().length, 2);
  assert.equal(received.length, 3);
  assert.equal(JSON.stringify(s.history()).includes('private-person'), false);
  assert.throws(() => { s.history()[0].score = 999; }, TypeError);
});

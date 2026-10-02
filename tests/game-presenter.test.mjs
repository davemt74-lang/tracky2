import test from 'node:test';
import assert from 'node:assert/strict';
import { gamePresentation } from '../src/game-presenter.js';
import { createGameState } from '../src/gameplay-core.js';

test('presenter covers all original gameplay states without DOM access', () => {
  const g = createGameState();
  assert.match(gamePresentation(g).title, /Choose/);
  g.active = true;
  g.activeZone = 1;
  g.repsRemaining = 4;
  g.lastEvent = 'round-start';
  assert.match(gamePresentation(g).title, /Zone 2: 4 reps/);
  g.lastEvent = 'outside-zone';
  assert.match(gamePresentation(g).title, /Move into Zone 2/);
  g.lastEvent = 'rep';
  assert.match(gamePresentation(g).title, /4 reps left/);
  g.lastEvent = 'tracking';
  assert.match(gamePresentation(g).title, /Zone 2: 4 reps left/);
  g.lastEvent = 'signal-lost';
  assert.match(gamePresentation(g).title, /Tracking lost/);
  g.over = true;
  g.score = 5;
  assert.match(gamePresentation(g).title, /Game over/);
});

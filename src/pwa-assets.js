// Shell is deliberately limited to same-origin static files only; local profile storage
// and optional CDN recognition/voice models are NEVER pre-cached or intercepted.
const STATIC_CACHE='tracky2-static-v0.6.2';
const SHELL=Object.freeze([
  './','./index.html','./tracker.html','./games.html','./participants.html',
  './vertical-motion.html','./diagnostics.html','./styles.css','./launch.js',
  './app.js','./games.js','./participants.js','./participant-voice.js',
  './vertical-motion.js','./diagnostics.js','./pwa.js','./manifest.webmanifest',
  './assets/tracky-mark.svg','./assets/icon-192.png','./assets/icon-512.png',
  './src/launch-core.js','./src/tracker-core.js','./src/movement-core.js',
  './src/gameplay-core.js','./src/game-platform.js','./src/shared-board.js',
  './src/game-lobby.js','./src/game-session.js','./src/game-input.js',
  './src/game-presenter.js','./src/color-controllers.js','./src/multiplayer-match.js',
  './src/controller-stability.js','./src/player-presence.js','./src/match-history.js',
  './src/hardware-diagnostics.js','./src/participant-core.js','./src/participant-store.js',
  './src/identity-engine.js','./src/room-tracking-core.js','./src/voice-core.js',
  './src/voice-engine.js','./src/room-audio-engine.js','./src/room-audio-worklet.js',
  './src/model-config.js','./src/games/random-follow-pattern.js',
  './src/games/pattern-setup.js','./src/games/reaction-challenge.js'
]);
export {STATIC_CACHE,SHELL};

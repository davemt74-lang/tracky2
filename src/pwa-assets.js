// Shell is deliberately limited to same-origin static AGENT files only; local profile
// storage and optional recognition/voice models are NEVER pre-cached or intercepted.
const STATIC_CACHE='tracky2-static-v0.16.0-agent-only-r1';
const SHELL=Object.freeze([
  './','./index.html','./tracker.html','./games.html','./participants.html',
  './vertical-motion.html','./diagnostics.html','./styles.css','./launch.js',
  './app.js','./participants.js','./participants-sidebar.js','./participants-stage.js','./participant-voice.js',
  './vertical-motion.js','./room-tabs-controller.js','./agent-mode.js','./agent-presence.js',
  './account-participants.js','./control-center.js','./diagnostics.js','./pwa.js',
  './participants-stage.css','./scene-analysis.css','./room-tabs.css','./agent-mode.css',
  './agent-presence.css','./manifest.webmanifest',
  './assets/tracky-mark.svg','./assets/icon-192.png','./assets/icon-512.png',
  './src/launch-core.js','./src/tracker-core.js','./src/camera-preference.js',
  './src/color-controllers.js','./src/controller-stability.js','./src/player-presence.js',
  './src/hardware-diagnostics.js','./src/participant-core.js','./src/face-gallery.js',
  './src/roster-layout.js','./src/face-preview.js','./src/participant-store.js',
  './src/identity-engine.js','./src/room-tracking-core.js','./src/scene-analysis.js',
  './src/player-activity.js','./src/visitor-session.js','./src/room-tabs-state.js',
  './src/agent-conversation.js','./src/agent-provider.js','./src/provider-router-core.js',
  './src/provider-recovery-core.js','./src/restart-reconnect-core.js',
  './src/agent-presentation.js','./src/participant-audio-meter.js',
  './src/voice-core.js','./src/voice-engine.js','./src/room-audio-engine.js',
  './src/room-audio-worklet.js','./src/model-config.js','./src/games/agent.js'
]);
export {STATIC_CACHE,SHELL};

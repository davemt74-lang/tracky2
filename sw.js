// Install static application shell; installed models remain explicit network dependencies.
// Do not skipWaiting automatically while a match may be active.
const CACHE='tracky2-static-v0.14.5';
const ASSETS=[
  './','./index.html','./tracker.html','./games.html','./participants.html',
  './vertical-motion.html','./diagnostics.html','./styles.css','./launch.js',
  './app.js','./games.js','./participants.js','./participants-sidebar.js','./participants-stage.js','./participant-voice.js',
  './vertical-motion.js','./room-tabs-controller.js','./agent-mode.js','./agent-presence.js','./diagnostics.js','./pwa.js','./participants-stage.css','./game-stage.css','./scene-analysis.css','./room-tabs.css','./agent-mode.css','./agent-presence.css','./manifest.webmanifest',
  './assets/tracky-mark.svg','./assets/icon-192.png','./assets/icon-512.png',
  './src/launch-core.js','./src/tracker-core.js','./src/movement-core.js',
  './src/gameplay-core.js','./src/game-platform.js','./src/shared-board.js',
  './src/game-lobby.js','./src/camera-preference.js','./src/game-session.js','./src/game-input.js',
  './src/game-presenter.js','./src/color-controllers.js','./src/multiplayer-match.js',
  './src/controller-stability.js','./src/player-presence.js','./src/match-history.js',
  './src/hardware-diagnostics.js','./src/hardware-certification-core.js','./src/overlap-source-separation-core.js','./src/participant-continuity-core.js','./src/multi-room-runtime-core.js','./src/multi-room-runtime.js','./src/participant-core.js','./src/face-gallery.js','./src/roster-layout.js','./src/face-preview.js','./src/participant-store.js',
  './src/identity-engine.js','./src/room-tracking-core.js','./src/scene-analysis.js','./src/player-activity.js','./src/visitor-session.js','./src/room-tabs-state.js','./src/agent-conversation.js','./src/agent-provider.js','./src/provider-router-core.js','./src/governed-skill-core.js','./src/governed-skill-client.js','./src/agent-presentation.js','./src/conversation-timeline.js','./src/room-event-core.js','./src/room-scene-graph.js','./src/room-scene-ui.js','./src/room-temporal-core.js','./src/room-acoustic-patterns.js','./src/transcript-correction.js','./src/agent-cognitive-core.js','./src/agent-proactive-core.js','./src/agent-proactive-intelligence-core.js','./src/session-recall-core.js','./src/semantic-recall-core.js','./src/session-recall-ui.js','./src/recording-core.js','./src/recording-ui.js','./src/agent-task-core.js','./src/agent-task-ui.js','./src/agent-workflow-core.js','./src/agent-workflow-ui.js','./src/agent-memory-core.js','./src/agent-memory-learning-core.js','./src/agent-memory-ui.js','./src/resource-sync-core.js','./src/room-ui-core.js','./src/runtime-resilience-core.js','./src/multimodal-identity-core.js','./src/speaker-diarization-core.js','./src/continuous-fusion-core.js','./src/multi-person-attribution-core.js','./src/session-identity-core.js','./src/room-handoff-core.js','./src/spatial-audio-source-core.js','./src/agent-multimodal-context.js','./src/long-session-core.js','./src/device-performance-core.js','./src/v012-release-core.js','./src/v013-release-core.js','./src/conversation-listening-core.js','./src/speaker-participant-core.js','./src/transcript-lifecycle-core.js','./src/multi-conversation-core.js','./src/meeting-core.js','./src/meeting-ui.js','./src/environmental-audio-core.js','./src/environmental-intelligence-core.js','./src/routine-intelligence-core.js','./src/environmental-audio-engine.js','./src/spatial-calibration-core.js','./src/orb-spatial-core.js','./src/agent-shortcuts.js','./src/participant-audio-meter.js','./src/room-audio-audit.js','./src/voice-core.js',
  './src/voice-engine.js','./src/room-audio-engine.js','./src/room-audio-worklet.js',
  './src/model-config.js','./src/games/random-follow-pattern.js',
  './src/games/pattern-setup.js','./src/games/reaction-challenge.js','./src/games/agent.js'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(
  keys.filter(key=>key.startsWith('tracky2-static-')&&key!==CACHE)
   .map(key=>caches.delete(key))
 )).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 // Never cache non-shell paths: model downloads, uploads, IndexedDB, and local APIs.
 const shellUrl=new URL(self.registration.scope);
 const relative=url.pathname.slice(shellUrl.pathname.length);
 if(url.search || !ASSETS.some(path=>path.replace(/^\.\//,'')===relative) &&
    relative!=='')return;
 if(request.mode==='navigate'){
   event.respondWith(fetch(request).then(response=>response.ok?response:
     caches.match(request).then(cached=>cached||response)).catch(()=>
       caches.match(request).then(cached=>cached||caches.match('./games.html'))));
 }else{
   event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
 }
});

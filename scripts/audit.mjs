import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'pwa.js',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'tracker.html',
  'launch.js',
  'assets/tracky-mark.svg',
  'games.html',
  'games.js',
  'vertical-motion.html',
  'participants.html',
  'diagnostics.html',
  'app.js',
  'src/launch-core.js',
  'vertical-motion.js',
  'room-tabs-controller.js',
  'agent-mode.js',
  'agent-presence.js',
  'participants.js',
  'participants-sidebar.js',
  'participants-stage.js',
  'src/roster-layout.js',
  'participant-voice.js',
  'diagnostics.js',
  'styles.css',
  'participants-stage.css',
  'game-stage.css',
  'scene-analysis.css',
  'room-tabs.css',
  'agent-mode.css',
  'agent-presence.css',
  'README.md',
  'docs/V010-RELEASE-ACCEPTANCE.md',
  'docs/V011-MASTER-PLAN.md',
  'package.json',
  'src/tracker-core.js',
  'src/movement-core.js',
  'src/gameplay-core.js',
  'src/game-platform.js',
  'src/shared-board.js',
  'src/game-lobby.js',
  'src/camera-preference.js',
  'src/games/random-follow-pattern.js',
  'src/games/reaction-challenge.js',
  'src/games/agent.js',
  'src/games/pattern-setup.js',
  'src/game-session.js',
  'src/game-input.js',
  'src/game-presenter.js',
  'src/color-controllers.js',
  'src/multiplayer-match.js',
  'src/controller-stability.js',
  'src/player-presence.js',
  'src/match-history.js',
  'src/hardware-diagnostics.js',
  'src/participant-core.js',
  'src/face-gallery.js',
  'src/face-preview.js',
  'src/participant-store.js',
  'src/identity-engine.js',
  'src/room-tracking-core.js',
  'src/scene-analysis.js',
  'src/player-activity.js',
  'src/visitor-session.js',
  'src/room-tabs-state.js',
  'src/agent-conversation.js',
  'src/agent-provider.js',
  'src/agent-presentation.js',
  'src/conversation-timeline.js',
  'src/room-event-core.js',
  'src/room-scene-graph.js',
  'src/room-scene-ui.js',
  'src/room-temporal-core.js',
  'src/room-acoustic-patterns.js',
  'src/transcript-correction.js',
  'src/agent-cognitive-core.js',
  'src/agent-task-core.js',
  'src/agent-task-ui.js',
  'src/agent-memory-core.js',
  'src/agent-memory-ui.js',
  'src/server-sync-core.js',
  'src/room-ui-core.js',
  'src/runtime-resilience-core.js',
  'src/conversation-listening-core.js',
  'src/speaker-participant-core.js',
  'src/transcript-lifecycle-core.js',
  'src/multi-conversation-core.js',
  'src/meeting-core.js',
  'src/meeting-ui.js',
  'src/environmental-audio-core.js',
  'src/environmental-audio-engine.js',
  'src/spatial-calibration-core.js',
  'src/orb-spatial-core.js',
  'src/agent-shortcuts.js',
  'src/participant-audio-meter.js',
  'src/room-audio-audit.js',
  'src/voice-core.js',
  'src/voice-engine.js',
  'src/room-audio-engine.js',
  'src/room-audio-worklet.js',
  'src/model-config.js'
];

const runtimeJs = [
  'pwa.js',
  'launch.js',
  'src/launch-core.js',
  'app.js',
  'vertical-motion.js',
  'room-tabs-controller.js',
  'agent-mode.js',
  'agent-presence.js',
  'participants.js',
  'participants-sidebar.js',
  'participants-stage.js',
  'src/roster-layout.js',
  'participant-voice.js',
  'src/tracker-core.js',
  'src/movement-core.js',
  'src/gameplay-core.js',
  'src/game-platform.js',
  'src/shared-board.js',
  'src/game-lobby.js',
  'src/camera-preference.js',
  'src/games/random-follow-pattern.js',
  'src/games/reaction-challenge.js',
  'src/games/agent.js',
  'src/games/pattern-setup.js',
  'src/game-session.js',
  'src/game-input.js',
  'src/game-presenter.js',
  'src/color-controllers.js',
  'src/multiplayer-match.js',
  'src/controller-stability.js',
  'src/player-presence.js',
  'src/match-history.js',
  'src/hardware-diagnostics.js',
  'src/participant-core.js',
  'src/face-gallery.js',
  'src/face-preview.js',
  'src/participant-store.js',
  'src/identity-engine.js',
  'src/room-tracking-core.js',
  'src/scene-analysis.js',
  'src/player-activity.js',
  'src/visitor-session.js',
  'src/room-tabs-state.js',
  'src/agent-conversation.js',
  'src/agent-provider.js',
  'src/agent-presentation.js',
  'src/conversation-timeline.js',
  'src/room-event-core.js',
  'src/room-scene-graph.js',
  'src/room-scene-ui.js',
  'src/room-temporal-core.js',
  'src/room-acoustic-patterns.js',
  'src/transcript-correction.js',
  'src/agent-cognitive-core.js',
  'src/agent-task-core.js',
  'src/agent-task-ui.js',
  'src/agent-memory-core.js',
  'src/agent-memory-ui.js',
  'src/server-sync-core.js',
  'src/room-ui-core.js',
  'src/runtime-resilience-core.js',
  'src/conversation-listening-core.js',
  'src/speaker-participant-core.js',
  'src/transcript-lifecycle-core.js',
  'src/multi-conversation-core.js',
  'src/meeting-core.js',
  'src/meeting-ui.js',
  'src/environmental-audio-core.js',
  'src/environmental-audio-engine.js',
  'src/spatial-calibration-core.js',
  'src/orb-spatial-core.js',
  'src/agent-shortcuts.js',
  'src/voice-core.js',
  'src/voice-engine.js',
  'src/room-audio-engine.js',
  'src/room-audio-worklet.js',
  'src/model-config.js'
];

const htmlContracts = [
  ['index.html', ['launch.js']],
  ['tracker.html', ['app.js']],
  ['games.html', ['games.js']],
  ['vertical-motion.html', ['vertical-motion.js', 'room-tabs-controller.js', 'agent-presence.js', 'agent-mode.css', 'agent-presence.css']],
  ['participants.html', ['participants.js', 'participants-sidebar.js', 'participants-stage.js', 'participant-voice.js']],
  ['diagnostics.html', ['diagnostics.js']]
];

function fail(message) {
  failures.push(message);
}

function read(file) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) {
    fail('Missing required file: ' + file);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

for (const file of requiredFiles) read(file);

const packageJson = JSON.parse(read('package.json') || '{}');
if (packageJson.version !== '0.11.6') {
  fail('package.json version must be 0.11.6');
}
if (packageJson.type !== 'module') {
  fail('package.json must use ESM via type=module');
}
if (!packageJson.scripts?.audit?.includes('scripts/audit.mjs')) {
  fail('package.json must expose the release audit script');
}
if (!packageJson.scripts?.validate) {
  fail('package.json must expose a validate script');
}

for (const file of runtimeJs) {
  const source = read(file);
  if (!source) continue;

  const banned = [
    ['innerHTML', /\.innerHTML\s*=/],
    ['eval()', /\beval\s*\(/],
    ['new Function()', /\bnew\s+Function\s*\(/],
    ['document.write()', /\bdocument\.write\s*\(/],
    ['insecure HTTP URL', /http:\/\//i]
  ];

  for (const [label, pattern] of banned) {
    if(label==='insecure HTTP URL'&&file==='src/agent-provider.js'){
      // This one optional connector only accepts verified browser loopback origins.
      // Never waive the HTTP prohibition for any other runtime module or host.
      const nonLoopback=source.replace(/http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?=[:/'"`])/gi,'');
      if(pattern.test(nonLoopback))fail(file+' contains non-loopback insecure HTTP URL');
      if(!source.includes("validateLocalAgentEndpoint")||
         !source.includes("['localhost','127.0.0.1','[::1]']"))
        fail('Local model exception requires strict loopback hostname validation');
      continue;
    }
    if (pattern.test(source)) fail(file + ' contains banned runtime pattern: ' + label);
  }

  if (/clone/i.test(source)) {
    fail(file + ' contains obsolete voice-clone terminology');
  }

  const imports = [
    ...source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)
  ].map((match) => match[1]);

  for (const specifier of imports) {
    if (!specifier.startsWith('.')) continue;
    const resolved = path.resolve(root, path.dirname(file), specifier);
    const candidates = [
      resolved,
      resolved + '.js',
      path.join(resolved, 'index.js')
    ];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      fail(file + ' imports missing local module: ' + specifier);
    }
  }
}

for (const [htmlFile, jsFiles] of htmlContracts) {
  const html = read(htmlFile);
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const seen = new Set();

  for (const id of ids) {
    if (seen.has(id)) fail(htmlFile + ' contains duplicate id #' + id);
    seen.add(id);
  }

  const externalScripts = [...html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((src) => /^https?:\/\//i.test(src));
  if (externalScripts.length) {
    fail(htmlFile + ' contains external script tags: ' + externalScripts.join(', '));
  }

  for (const jsFile of jsFiles) {
    const source = read(jsFile);
    const refs = new Set();

    for (const match of source.matchAll(/\$\(\s*['"]#([^'"]+)['"]\s*\)/g)) refs.add(match[1]);
    for (const match of source.matchAll(/document\.querySelector\(\s*['"]#([^'"]+)['"]\s*\)/g)) refs.add(match[1]);
    for (const match of source.matchAll(/document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.add(match[1]);

    for (const id of refs) {
      if (!seen.has(id)) fail(jsFile + ' references missing ' + htmlFile + ' element #' + id);
    }
  }

  for (const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const ref = match[1];
    if (!ref.startsWith('./') && !ref.startsWith('../')) continue;
    const clean = ref.split(/[?#]/)[0];
    const resolved = path.resolve(root, path.dirname(htmlFile), clean);
    if (!fs.existsSync(resolved)) fail(htmlFile + ' references missing asset: ' + ref);
  }
}

const modelConfig = read('src/model-config.js');
if (!/@huggingface\/transformers@3\.8\.1\/\+esm/.test(modelConfig)) {
  fail('Transformers.js browser dependency is not pinned to 3.8.1 ESM');
}
if (!/@vladmandic\/human@3\.3\.6\//.test(modelConfig)) {
  fail('Human browser dependency is not pinned to 3.3.6');
}
if (!/VOICE_MODEL_REVISION\s*=\s*['"][0-9a-f]{40}['"]/.test(modelConfig)) {
  fail('Voice model must be pinned to a full commit revision');
}
if (!/TRANSCRIPTION_MODEL_REVISION\s*=\s*['"][0-9a-f]{7,40}['"]/.test(modelConfig)) {
  fail('Transcription model must be pinned to a commit revision');
}
if (!/ENVIRONMENT_AUDIO_MODEL_REVISION\s*=\s*['"][0-9a-f]{40}['"]/.test(modelConfig)) {
  fail('Environmental audio model must be pinned to a full commit revision');
}
if (/REVISION\s*=\s*['"](?:main|master)['"]/.test(modelConfig)) {
  fail('Model revision may not use a moving main/master ref');
}

const workflow = read('.github/workflows/test.yml');
if (!/npm run validate/.test(workflow)) {
  fail('CI must execute npm run validate');
}
if (!/tracky2-v0\.11\.6-deploy\.zip/.test(workflow)) {
  fail('CI must build Tracky2 V0.11.6 deploy ZIP');
}
for (const file of requiredFiles.filter((file) => !file.startsWith('README') && file !== 'package.json')) {
  const filename = path.basename(file);
  if (!workflow.includes(filename)) {
    fail('CI deploy manifest does not mention required runtime file: ' + file);
  }
}

const worklet = read('src/room-audio-worklet.js');
if (!/registerProcessor\(['"]tracky-pcm-processor['"]/.test(worklet)) {
  fail('AudioWorklet processor registration is missing');
}

const roomAudio = read('src/room-audio-engine.js');
if (!/audioWorklet\.addModule/.test(roomAudio) || !/createScriptProcessor/.test(roomAudio)) {
  fail('Room audio must provide AudioWorklet primary path and ScriptProcessor fallback');
}

for(const file of ['server/bootstrap.php','server/install.php','server/admin.php','server/api.php',
  'server/session.php','server/providers.php','server/sync.js','server/sync-api.php','server/backup.php',
  'docs/SELFHOST-FOUNDATION.md']){
 if(!workflow.includes(file))fail('Self-hosted deploy manifest missing: '+file);
 if(!fs.existsSync(path.join(root,file)))fail('Missing self-hosted runtime file: '+file);
}

if (failures.length) {
  console.error('\nTracky release audit: FAIL\n');
  for (const failure of failures) console.error(' - ' + failure);
  console.error('\n' + failures.length + ' issue(s) found.');
  process.exit(1);
}

console.log('Tracky release audit: PASS');
console.log('Checked ' + requiredFiles.length + ' release files, DOM contracts, imports, model pins, runtime safety, and deploy manifest.');

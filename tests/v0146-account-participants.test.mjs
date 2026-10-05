import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {nextTripleShortcut} from '../src/agent-shortcuts.js';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v0.14.6 account participant API is authenticated encrypted versioned and consent gated',()=>{
 const api=read('server/account-participants-api.php');
 assert.match(api,/tracky_require\(\$db,'participants\.read'\)/);
 assert.match(api,/tracky_require\(\$db,'participants\.write'\)/);
 assert.match(api,/tracky_check_csrf\(\)/);
 assert.match(api,/BEGIN IMMEDIATE/);
 assert.match(api,/tracky_encrypt\(\$json\)/);
 assert.match(api,/tracky_decrypt/);
 assert.match(api,/Explicit participant consent is required for cross-device biometric synchronization/);
 assert.match(api,/status'=>'conflict'/);
 assert.match(api,/deleted_at/);
});

test('v0.14.6 account sync is automatic foreground page sync, not a hidden background service',()=>{
 const runtime=read('account-participants.js');
 assert.match(runtime,/server\/session\.php/);
 assert.match(runtime,/server\/account-participants-api\.php/);
 assert.match(runtime,/tracky:participant-account-change/);
 assert.match(runtime,/window\.addEventListener\('online'/);
 assert.match(runtime,/window\.addEventListener\('focus'/);
 assert.match(runtime,/visibilitychange/);
 assert.match(runtime,/accountSyncDecision/);
 assert.match(runtime,/participantServerProfile/);
 assert.doesNotMatch(runtime,/setInterval|serviceWorker\.sync|periodicSync|Background Sync/i);
});

test('v0.14.6 participant storage has a separate offline account-sync state lane',()=>{
 const store=read('src/participant-store.js');
 assert.match(store,/const DB_VERSION = 15/);
 assert.match(store,/account-participant-sync-state/);
 assert.match(store,/markAccountParticipantPending/);
 assert.match(store,/tracky:participant-account-change/);
 assert.match(store,/accountSync=true/);
 assert.match(store,/ACCOUNT_PARTICIPANT_SYNC/);
});

test('v0.14.6 passive recognition freshness never queues account writes',()=>{
 const runtime=read('vertical-motion.js');
 const marker="latestPhoto: currentPhoto || match.participant.latestPhoto || match.participant.primaryPhoto";
 const i=runtime.indexOf(marker);assert.ok(i>0);
 assert.match(runtime.slice(i,i+350),/\{accountSync:false\}/);
 const legacy=read('server/sync.js');
 assert.match(legacy,/saveParticipant\([\s\S]{0,180}\{accountSync:false\}\)/);
});

test('v0.14.6 participant editor supports account biometric consent and mobile basic edits',()=>{
 const html=read('participants.html'),js=read('participants.js'),core=read('src/participant-core.js');
 assert.match(html,/id="accountBiometricSyncEnabled"/);
 assert.match(html,/Sync encrypted face\/voice identity data across my signed-in Tracky2 devices/);
 assert.match(js,/accountBiometricSyncEnabled/);
 assert.match(js,/accountOnlyExisting/);
 assert.match(js,/Signed-in account sync will update automatically/);
 assert.match(core,/accountBiometricSyncEnabled: input\.accountBiometricSyncEnabled === true/);
});

test('CCC is a centralized triple-key shortcut that opens Control Center',()=>{
 const shortcuts=read('src/agent-shortcuts.js'),presence=read('agent-presence.js');
 const html=read('vertical-motion.html'),center=read('control-center.js');
 assert.match(shortcuts,/\['x','z','c'\]/);
 assert.match(presence,/tracky:control-center-toggle/);
 assert.match(html,/id="agentControlCenter"/);
 assert.doesNotMatch(html,/CCC ◎|ZZZ ⇄|XXX ⇔|agent-shortcut-hint/);
 assert.match(center,/server\/session\.php/);
 assert.match(html,/Participants/);
 assert.match(html,/Admin/);
 assert.match(html,/Diagnostics/);
 assert.match(html,/Account controls do not start camera, microphone, recording, provider calls, or background synchronization/i);
 assert.match(html,/ROOM settings never grant new sensor permission/i);
});

test('Control Center is responsive while AGENT header is Camera/Orb only',()=>{
 const css=read('agent-mode.css'),html=read('vertical-motion.html');
 assert.match(css,/\.control-center-modal/);
 assert.match(css,/\.control-center-grid/);
 assert.match(css,/@media\(max-width:760px\)/);
 const start=html.indexOf('<nav id="agentViewChooser"');
 const end=html.indexOf('</nav>',start);
 const chooser=html.slice(start,end);
 assert.match(chooser,/>Camera<\/button>/);
 assert.match(chooser,/>Orb<\/button>/);
 assert.doesNotMatch(chooser,/Control Center|CCC|ZZZ|XXX|Exit/);
});


test('CCC triple key fires independently of existing ZZZ and XXX shortcuts',()=>{
 let state={key:'',count:0,lastAt:0};
 let step=nextTripleShortcut(state,'c',0);state=step.state;assert.equal(step.trigger,null);
 step=nextTripleShortcut(state,'c',100);state=step.state;assert.equal(step.trigger,null);
 step=nextTripleShortcut(state,'c',200);assert.equal(step.trigger,'c');
 state={key:'',count:0,lastAt:0};
 step=nextTripleShortcut(state,'z',0);state=step.state;assert.equal(step.trigger,null);
 step=nextTripleShortcut(state,'z',100);state=step.state;assert.equal(step.trigger,null);
 step=nextTripleShortcut(state,'z',200);assert.equal(step.trigger,'z');
});

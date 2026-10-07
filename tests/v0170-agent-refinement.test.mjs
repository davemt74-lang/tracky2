import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.17.1 exposes only Conversation, Participant Activity, AGENT and ROOM as primary tabs',()=>{
 const html=read('vertical-motion.html');
 const tablistStart=html.indexOf('<div class="room-left-tabs"');
 const tablist=html.slice(tablistStart,html.indexOf('</div>',tablistStart));
 const ids=[...tablist.matchAll(/<button[^>]*id="([^"]+)"[^>]*role="tab"/g)].map(m=>m[1]);
 assert.deepEqual(ids,['roomDialogueTab','playerActivityTab','roomAgentTab','roomTab']);
 assert.doesNotMatch(tablist,/Meeting|roomMeeting/);
});

test('V0.17.1 Meeting is an Admin/Control Center surface, not a runtime mode',()=>{
 const html=read('vertical-motion.html');
 const runtime=read('vertical-motion.js');
 const controller=read('room-tabs-controller.js');
 const admin=read('server/admin.php');
 assert.match(html,/id="controlCenterMeetingTab"/);
 assert.match(html,/id="controlCenterMeetingPanel"/);
 assert.match(html,/id="meetingStartForm"/);
 assert.match(admin,/Open meeting controls/);
 assert.match(admin,/vertical-motion\.html\?admin=meeting/);
 assert.doesNotMatch(runtime,/requestedMode|classList\.toggle\('meeting-mode'/);
 assert.doesNotMatch(controller,/roomMeetingTab|requestedMeeting|mode.*meeting/);
});

test('V0.17.1 preserves one shared meeting/conversation sensor pipeline',()=>{
 const runtime=read('vertical-motion.js');
 const meeting=read('src/meeting-core.js');
 assert.equal((runtime.match(/new RoomAudioCapture\(/g)||[]).length,1);
 assert.match(runtime,/createMeetingUi\(/);
 assert.match(runtime,/const meetingFields=meetingUI\?\.turnFields\?\.\(\)/);
 assert.doesNotMatch(meeting,/getUserMedia|MediaRecorder|AudioContext|transcribe\(|embedding\(|fetch\(/);
});

test('V0.17.1 release metadata and deploy package are aligned',()=>{
 const pkg=JSON.parse(read('package.json'));
 const sw=read('sw.js');
 const workflow=read('.github/workflows/test.yml');
 const audit=read('scripts/audit.mjs');
 assert.equal(pkg.version,'0.17.1');
 assert.match(sw,/tracky2-static-v0\.17\.1-agent-refinement-r1/);
 assert.match(workflow,/tracky2-v0\.17\.1-deploy\.zip/);
 assert.match(workflow,/V0170-RELEASE-ACCEPTANCE\.md/);
 assert.match(audit,/package\.json version must be 0\.17\.1/);
});

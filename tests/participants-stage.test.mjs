import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('participants.html','utf8');
const css=fs.readFileSync('participants-stage.css','utf8');
test('Participants visual shell has no five-column status strip and only one main camera',()=>{
 assert.equal(html.includes('class="system-strip"'),false);
 assert.equal((html.match(/id="identityCameraStage"/g)||[]).length,1);
 assert.ok(html.includes('participant-main-stage'));
 assert.ok(html.includes('participant-camera-dock'));
});
test('both functional profiles float over camera and reuse their original form controls',()=>{
 const camera=html.indexOf('id="identityCameraStage"');
 const gallery=html.indexOf('id="participantGalleryOverlay"');
 const voice=html.indexOf('id="participantVoiceOverlay"');
 const controls=html.indexOf('id="participant-camera-dock"');
 assert.ok(camera<gallery&&gallery<voice);
 assert.ok(html.includes('id="faceSampleGallery"'));
 assert.ok(html.includes('id="voiceEnrollmentBlock"'));
 assert.ok(html.includes('id="captureSample"'));
 assert.ok(html.includes('id="participantSettingsSheet"'));
 assert.match(css,/backdrop-filter:blur/);
 assert.ok(html.includes('id="participantRoster"'));
});
test('unique enrollment, camera, voice, roster, and gallery controls survive re-layout',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['participantVideo','participantCameraStatus','primaryPhotoPreview','latestPhotoPreview',
  'participantName','participantNickname','recognitionEnabled','capturePrimary','captureSample',
  'voiceEnrollmentBlock','recordVoiceSample','stopVoiceSample','newParticipant','participantList',
  'saveParticipant','participantRosterBackdrop','collapseParticipantRoster'])
   assert.ok(ids.includes(id),'Missing '+id);
});

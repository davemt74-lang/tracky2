import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('participants.html','utf8');
const css=fs.readFileSync('participants-stage.css','utf8');
const runtime=fs.readFileSync('participants.js','utf8');
const stage=fs.readFileSync('participants-stage.js','utf8');
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
  'saveParticipant','participantRosterBackdrop','collapseParticipantRoster','faceCaptureCoach',
  'faceCaptureStep','faceCaptureReady','faceCaptureInstruction','faceAngleMap','capturePhotoLabel'])
   assert.ok(ids.includes(id),'Missing '+id);
});

test('guided face capture exposes nine target angles without covering the camera workflow',()=>{
 assert.match(html,/id="faceCaptureCoach"/);
 assert.equal((html.match(/data-pose="/g)||[]).length,9);
 for(const pose of ['upper-left','up','upper-right','left','front','right','lower-left','down','lower-right'])
  assert.ok(html.includes('data-pose="'+pose+'"'),'Missing guided pose '+pose);
 assert.match(css,/\.face-capture-coach/);
 assert.match(css,/\.face-angle-map i\.active/);
});

test('main shutter advances guided enrollment and photo capture no longer forces gallery open',()=>{
 assert.match(runtime,/function captureGuidedPhoto\(\)/);
 assert.match(runtime,/nextFaceCapturePose\(state\.gallery\)/);
 assert.match(runtime,/poseId:pose\.id/);
 assert.match(runtime,/ui\.capturePrimary\.addEventListener\('click', captureGuidedPhoto\)/);
 assert.match(runtime,/Guided face capture complete: all 9 angles are saved/);
 assert.match(stage,/event\.detail\?\.openGallery===true/);
 assert.doesNotMatch(stage,/participant-photo-captured',\(\)=>panel\('gallery',true\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {faceGalleryStatus,MIN_FACE_SAMPLES,MAX_FACE_SAMPLES} from '../src/face-gallery.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sample=i=>({embedding:[1,0,i+1],photo:'data:image/jpeg;base64,QQ==',quality:.9,poseId:['front','left','right'][i]||null});

test('participant photo profile requires exactly the first three samples for recognition readiness',()=>{
 const two=faceGalleryStatus([sample(0),sample(1)],true);
 assert.equal(two.required,3);assert.equal(two.requiredComplete,false);assert.equal(two.ready,false);
 const three=faceGalleryStatus([sample(0),sample(1),sample(2)],true);
 assert.equal(three.required,MIN_FACE_SAMPLES);assert.equal(three.requiredComplete,true);assert.equal(three.ready,true);
 assert.equal(three.maximum,MAX_FACE_SAMPLES);
});

test('participant UI submits after three required photos and opens Voice',()=>{
 const js=read('participants.js'),stage=read('participants-stage.js'),html=read('participants.html');
 assert.match(js,/Save Photo Profile & Continue to Voice/);
 assert.match(js,/status\.requiredComplete\)void saveForm\(\)/);
 assert.match(js,/openVoice:wasNew&&galleryStatus\.requiredComplete/);
 assert.match(stage,/event\.detail\?\.openVoice/);
 assert.match(stage,/panel\('voice',true\)/);
 assert.match(html,/3 required · 6 optional/);
 assert.match(html,/6 additional angles are optional/);
});

test('participant save requires three photos only when face recognition is enabled',()=>{
 const js=read('participants.js');
 assert.match(js,/ui\.recognitionEnabled\.checked&&!galleryStatus\.requiredComplete/);
 assert.match(js,/Capture the 3 required face photos before continuing to Voice/);
});

test('local participant save is isolated from account-sync metadata failure',()=>{
 const store=read('src/participant-store.js');
 assert.match(store,/const DB_VERSION = 17/);
 assert.match(store,/storeAction\(PARTICIPANTS,'readwrite'/);
 assert.match(store,/queueAccountParticipantUpsert/);
 assert.match(store,/Participant saved locally but account sync metadata could not be queued/);
 const save=store.slice(store.indexOf('export async function saveParticipant'),store.indexOf('export async function patchParticipant'));
 assert.doesNotMatch(save,/transaction\(\[PARTICIPANTS,ACCOUNT_PARTICIPANT_SYNC\]/);
});

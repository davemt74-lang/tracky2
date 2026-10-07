import test from 'node:test';import assert from 'node:assert/strict';
import {
 cameraAutostartEligible,cameraPermissionState,cameraPreferenceState,cameraStartupAction,
 selectGamePlayer,loadCameraPreference,saveCameraPreference,CAMERA_PREFERENCE_KEY
} from '../src/camera-preference.js';

const participants=[{id:'a',name:'Dave'},{id:'b',name:'Another'}];

test('legacy already-granted autostart helper remains conservative',()=>{
 assert.equal(cameraAutostartEligible({optIn:true,permission:'granted'}),true);
 for(const args of [{optIn:false,permission:'granted'},{optIn:true,permission:'prompt'},
  {optIn:true,permission:'denied'},{optIn:true,permission:'unsupported'},
  {optIn:true,permission:'granted',sessionStopped:true}])
   assert.equal(cameraAutostartEligible(args),false);
});

test('V0.17.3 AGENT startup distinguishes first run, explicit off and browser denial',()=>{
 assert.equal(cameraStartupAction({preference:'unset',permission:'prompt'}),'onboard');
 assert.equal(cameraStartupAction({preference:'unset',permission:'unsupported'}),'onboard');
 assert.equal(cameraStartupAction({preference:'enabled',permission:'granted'}),'start');
 assert.equal(cameraStartupAction({preference:'enabled',permission:'prompt'}),'onboard');
 assert.equal(cameraStartupAction({preference:'disabled',permission:'granted'}),'manual');
 assert.equal(cameraStartupAction({preference:'unset',permission:'denied'}),'blocked');
 assert.equal(cameraStartupAction({preference:'unset',permission:'prompt',supported:false}),'unsupported');
 assert.equal(cameraStartupAction({preference:'enabled',permission:'granted',sessionStopped:true}),'manual');
});

test('saved participant prefills only real enrolled IDs and one-person roster defaults safely',()=>{
 assert.equal(selectGamePlayer(participants,'','a'),'a');
 assert.equal(selectGamePlayer(participants,'b','a'),'b');
 assert.equal(selectGamePlayer(participants,'deleted','deleted'),'');
 assert.equal(selectGamePlayer(participants.slice(0,1)),'a');
 assert.equal(selectGamePlayer([],null,'a'),'');
});

test('camera preference uses the V0.17.3 contract and preserves explicit off',()=>{
 assert.equal(CAMERA_PREFERENCE_KEY,'tracky2-camera-autostart-v2');
 const values=new Map(),storage={getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)};
 assert.equal(cameraPreferenceState(storage),'unset');
 assert.equal(loadCameraPreference(storage),false);
 assert.equal(saveCameraPreference(storage,true),true);
 assert.equal(values.get(CAMERA_PREFERENCE_KEY),'true');
 assert.equal(cameraPreferenceState(storage),'enabled');
 assert.equal(loadCameraPreference(storage),true);
 saveCameraPreference(storage,false);
 assert.equal(cameraPreferenceState(storage),'disabled');
 assert.equal(loadCameraPreference(storage),false);
 assert.equal(cameraPreferenceState({getItem(){throw Error('storage denied')}}),'unset');
});

test('permission probe reports browser authority without itself requesting media',async()=>{
 assert.equal(await cameraPermissionState(), 'unsupported');
 assert.equal(await cameraPermissionState({query:async()=>({state:'granted'})}),'granted');
 assert.equal(await cameraPermissionState({query:async()=>({state:'prompt'})}),'prompt');
 assert.equal(await cameraPermissionState({query:async()=>({state:'denied'})}),'denied');
 assert.equal(await cameraPermissionState({query:async()=>{throw Error('unsupported')}}),'unsupported');
});

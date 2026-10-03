import test from 'node:test';import assert from 'node:assert/strict';
import {cameraAutostartEligible,selectGamePlayer,loadCameraPreference,saveCameraPreference,cameraPermissionState,CAMERA_PREFERENCE_KEY} from '../src/camera-preference.js';
const participants=[{id:'a',name:'Dave'},{id:'b',name:'Another'}];
test('explicit preference and browser grant are BOTH required before page camera autostart',()=>{
 assert.equal(cameraAutostartEligible({optIn:true,permission:'granted'}),true);
 for(const args of [{optIn:false,permission:'granted'},{optIn:true,permission:'prompt'},
  {optIn:true,permission:'denied'},{optIn:true,permission:'unsupported'},
  {optIn:true,permission:'granted',sessionStopped:true}])
   assert.equal(cameraAutostartEligible(args),false);
});
test('saved participant prefills only real enrolled IDs and one-person roster defaults safely',()=>{
 assert.equal(selectGamePlayer(participants,'','a'),'a');
 assert.equal(selectGamePlayer(participants,'b','a'),'b');
 assert.equal(selectGamePlayer(participants,'deleted','deleted'),'');
 assert.equal(selectGamePlayer(participants.slice(0,1)),'a');
 assert.equal(selectGamePlayer([],null,'a'),'');
});
test('camera preference is opt-in and safe when storage is unavailable',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(loadCameraPreference(storage),false);
 assert.equal(saveCameraPreference(storage,true),true);
 assert.equal(values.get(CAMERA_PREFERENCE_KEY),'true');
 assert.equal(loadCameraPreference(storage),true);
 saveCameraPreference(storage,false);
 assert.equal(loadCameraPreference(storage),false);
 assert.equal(loadCameraPreference({getItem(){throw Error('storage denied')}}),false);
});
test('permission probe treats unsupported and denied permissions as no automatic request',async()=>{
 assert.equal(await cameraPermissionState(), 'unsupported');
 assert.equal(await cameraPermissionState({query:async()=>({state:'granted'})}),'granted');
 assert.equal(await cameraPermissionState({query:async()=>({state:'denied'})}),'denied');
 assert.equal(await cameraPermissionState({query:async()=>{throw Error('unsupported')}}),'unsupported');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 CAMERA_PREFERENCE_KEY,cameraPreferenceState,cameraStartupAction
} from '../src/camera-preference.js';
import {nextTripleShortcut,shortcutNavigationTarget} from '../src/agent-shortcuts.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V0.17.3 first-run camera policy enters onboarding instead of silently idling',()=>{
 const values=new Map();
 const store={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(CAMERA_PREFERENCE_KEY,'tracky2-camera-autostart-v2');
 assert.equal(cameraPreferenceState(store),'unset');
 assert.equal(cameraStartupAction({preference:'unset',permission:'prompt'}),'onboard');
 assert.equal(cameraStartupAction({preference:'unset',permission:'unsupported'}),'onboard');
 assert.equal(cameraStartupAction({preference:'enabled',permission:'granted'}),'start');
 assert.equal(cameraStartupAction({preference:'enabled',permission:'prompt'}),'onboard');
 assert.equal(cameraStartupAction({preference:'disabled',permission:'granted'}),'manual');
 assert.equal(cameraStartupAction({preference:'unset',permission:'denied'}),'blocked');
 assert.equal(cameraStartupAction({preference:'unset',permission:'prompt',supported:false}),'unsupported');
 assert.equal(cameraStartupAction({preference:'unset',permission:'granted',sessionStopped:true}),'manual');
});

test('V0.17.3 camera onboarding is core bootstrap, before optional AGENT modules',()=>{
 const runtime=read('vertical-motion.js');
 const bootstrap=runtime.indexOf('void maybeStartAgentCameraOnboarding();');
 const dialogue=runtime.indexOf('await loadSavedDialogue();');
 const meeting=runtime.indexOf('meetingUI=createMeetingUi(');
 const memory=runtime.indexOf('memoryUI=createAgentMemoryUi(');
 assert.ok(bootstrap>0);
 assert.ok(bootstrap<dialogue);
 assert.ok(bootstrap<meeting);
 assert.ok(bootstrap<memory);
 assert.match(runtime,/updateGameScene\('permission'\)/);
 assert.match(runtime,/cameraStartupAction\(/);
 assert.match(runtime,/if\(preference==='unset'\)saveCameraPreference\(window\.localStorage,true\)/);
 assert.doesNotMatch(runtime,/!loadCameraPreference\(window\.localStorage\)/);
});

test('V0.17.3 permission stage is visible and truthful while browser permission is pending',()=>{
 const scene=read('src/scene-analysis.js');
 assert.match(scene,/permission:\{label:'Starting camera · approve browser permission if asked',progress:10,ready:false\}/);
 const html=read('vertical-motion.html');
 assert.match(html,/id="gameSceneOverlay"/);
 assert.match(html,/ANALYZING SCENE/);
});

test('VVV routes to Participants and BBB routes to AGENT Conversation',()=>{
 let state;
 for(const [key,expected] of [['v','v'],['b','b']]){
  state=undefined;
  let trigger=null;
  for(const at of [10,100,190]){
   const next=nextTripleShortcut(state,key,at);state=next.state;trigger=next.trigger||trigger;
  }
  assert.equal(trigger,expected);
 }
 assert.equal(shortcutNavigationTarget('v'),'./participants.html');
 assert.equal(shortcutNavigationTarget('b'),'./vertical-motion.html?tab=dialogue');
});

test('global shortcut runtime is present on primary Tracky2 pages and ignores editable targets',async()=>{
 for(const path of ['vertical-motion.html','participants.html','index.html','tracker.html','diagnostics.html'])
  assert.match(read(path),/src="\.\/app-shortcuts\.js"/,path);

 const listeners={},assigned=[],dispatched=[];
 const tab={clicks:0,click(){this.clicks+=1;}};
 globalThis.document={
  addEventListener:(name,fn)=>{listeners[name]=fn;},
  getElementById:id=>id==='roomDialogueTab'?tab:null
 };
 globalThis.window={
  location:{assign:url=>assigned.push(url)},
  dispatchEvent:event=>dispatched.push(event.type)
 };
 globalThis.CustomEvent=class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}};
 const body={tagName:'BODY',isContentEditable:false,closest:()=>null};
 const input={tagName:'INPUT',isContentEditable:false,closest:()=>null};
 const event=(key,target=body)=>({key,target,repeat:false,ctrlKey:false,altKey:false,metaKey:false,isComposing:false});
 try{
  await import('../app-shortcuts.js?v0173-shortcut-test=1');
  listeners.keydown(event('v',input));listeners.keydown(event('v',input));listeners.keydown(event('v',input));
  assert.deepEqual(assigned,[]);
  listeners.keydown(event('v'));listeners.keydown(event('v'));listeners.keydown(event('v'));
  assert.deepEqual(assigned,['./participants.html']);
  listeners.keydown(event('b'));listeners.keydown(event('b'));listeners.keydown(event('b'));
  assert.equal(tab.clicks,1);
  assert.deepEqual(dispatched,['tracky:agent-show-conversation']);
 }finally{
  delete globalThis.CustomEvent;delete globalThis.window;delete globalThis.document;
 }
});

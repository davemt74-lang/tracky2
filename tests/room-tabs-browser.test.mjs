import test from 'node:test';import assert from 'node:assert/strict';
test('primary AGENT tab clicks work without depending on the camera runtime',async()=>{
 const ids=['roomDialogueTab','playerActivityTab','roomAgentTab','roomTab',
  'roomDialoguePanel','playerActivityPanel','roomAgentPanel','roomObservationsPanel'];
 const elements=new Map(ids.map(id=>[id,{id,hidden:false,style:{},tabIndex:0,attributes:{},handlers:{},
  setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;},
  addEventListener(k,fn){this.handlers[k]=fn;}}]));
 globalThis.document={getElementById:id=>elements.get(id)};
 globalThis.window={location:{search:''},dispatchEvent:()=>{}};
 globalThis.CustomEvent=class CustomEvent{constructor(type){this.type=type;}};
 try {
  await import('../room-tabs-controller.js?room-tab-test=1');
  assert.equal(elements.get('roomDialoguePanel').hidden,false);
  assert.equal(elements.get('playerActivityPanel').hidden,true);
  assert.equal(elements.get('roomAgentPanel').hidden,true);
  assert.equal(elements.get('roomObservationsPanel').hidden,true);
  elements.get('playerActivityTab').handlers.click();
  assert.equal(elements.get('playerActivityPanel').hidden,false);
  let prevented=false;
  elements.get('playerActivityTab').handlers.keydown({key:'ArrowRight',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(elements.get('roomAgentPanel').hidden,false);
  assert.equal(elements.get('roomAgentTab').focused,true);
 }finally{
  delete globalThis.CustomEvent;delete globalThis.window;delete globalThis.document;
 }
});

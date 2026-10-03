import test from 'node:test';import assert from 'node:assert/strict';
test('actual Player Activity click opens panel without depending on the camera runtime',async()=>{
 const elements=new Map();
 for(const id of ['roomDialogueTab','playerActivityTab','roomDialoguePanel','playerActivityPanel']){
  elements.set(id,{id,hidden:false,style:{},tabIndex:0,attributes:{},handlers:{},
   setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;},
   addEventListener(k,fn){this.handlers[k]=fn;}});
 }
 globalThis.document={getElementById:id=>elements.get(id)};
 try {
  await import('../room-tabs-controller.js?room-tab-test=1');
  const d=elements.get('roomDialoguePanel'),a=elements.get('playerActivityPanel');
  assert.equal(a.hidden,true);assert.equal(d.hidden,false);
  elements.get('playerActivityTab').handlers.click();
  assert.equal(a.hidden,false);assert.equal(a.style.display,'block');
  assert.equal(d.hidden,true);assert.equal(elements.get('playerActivityTab').attributes['aria-selected'],'true');
  let prevented=false;
  elements.get('playerActivityTab').handlers.keydown({key:'ArrowRight',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(d.hidden,false);
  assert.equal(elements.get('roomDialogueTab').focused,true);
 }finally{delete globalThis.document;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('AGENT mobile rails independently slide out, dismiss outside and do not affect ZZZ',async()=>{
 const ids=['agentViewChooser','agentCameraView','agentOrbView','agentOrbStage','agentVoiceOrb',
 'agentOrbCaption','agentOrbFollower','agentMobileLeftRail','agentMobileRightRail','agentMobileBackdrop'];
 const props=new Map(),events={},listeners={},classes=new Map();
 const elements=new Map(ids.map(id=>{
  const handlers={};const attrs={};const css={};
  return [id,{id,hidden:false,dataset:{},style:{setProperty(k,v){css[k]=v;},removeProperty(k){delete css[k];},css},
   events:handlers,attributes:attrs,
   setAttribute(k,v){attrs[k]=v;},addEventListener(k,fn){handlers[k]=fn;},
   animate(){},querySelector(){return null;},querySelectorAll(){return []}}];
 }));
 const priorWindow=globalThis.window,priorDocument=globalThis.document;
 globalThis.window={location:{search:'?mode=agent&view=orb'},
  addEventListener:(k,fn)=>{listeners[k]=fn;},
  matchMedia:()=>({matches:false})};
 globalThis.document={getElementById:id=>elements.get(id),
  addEventListener:(k,fn)=>{events[k]=fn;},
  body:{classList:{add:name=>classes.set(name,true),toggle:(name,val)=>classes.set(name,val)}}};
 try{
  await import('../agent-presence.js?mobile-rails-test=1');
  const left=elements.get('agentMobileLeftRail'),right=elements.get('agentMobileRightRail');
  const backdrop=elements.get('agentMobileBackdrop');
  assert.equal(left.hidden,false);assert.equal(right.hidden,false);
  left.events.click();assert.equal(classes.get('agent-mobile-panel-left'),true);
  assert.equal(left.attributes['aria-expanded'],'true');assert.equal(backdrop.hidden,false);
  right.events.click();assert.equal(classes.get('agent-mobile-panel-left'),false);
  assert.equal(classes.get('agent-mobile-panel-right'),true);
  backdrop.events.click();assert.equal(backdrop.hidden,true);
  const key=(letter,target={tagName:'BODY'})=>({key:letter,target,repeat:false});
  for(let i=0;i<3;i++)events.keydown(key('x',{tagName:'INPUT'}));
  assert.notEqual(classes.get('room-sidebars-hidden'),true);
  for(let i=0;i<3;i++)events.keydown(key('x'));
  assert.equal(classes.get('room-sidebars-hidden'),true);
  for(let i=0;i<3;i++)events.keydown(key('x'));
  assert.equal(classes.get('room-sidebars-hidden'),false);
  for(let i=0;i<3;i++)events.keydown(key('z'));
  assert.equal(elements.get('agentOrbStage').hidden,true,'ZZZ still switches to camera');
  listeners['tracky:agent-room-tracks']({detail:{target:{x:.42,y:.56,scale:1.11}}});
  assert.equal(elements.get('agentOrbFollower').style.css['--orb-x'],'42.00%');
  assert.equal(elements.get('agentOrbFollower').style.css['--orb-scale'],'1.11');
 }finally{globalThis.window=priorWindow;globalThis.document=priorDocument;}
});
test('privacy and styling contracts include deletion of room events and readable mobile rails',()=>{
 const js=fs.readFileSync('src/participant-store.js','utf8');
 const css=fs.readFileSync('agent-presence.css','utf8');
 const agent=fs.readFileSync('agent-presence.js','utf8');
 assert.match(js,/tx = db.transaction\(\[PARTICIPANTS, DIALOGUE, ROOM_OBSERVATIONS\]/);
 assert.match(js,/if \(event.participantId === id\) observations.delete\(event.id\)/);
 assert.match(css,/agent-mobile-rail\[hidden\]\{display:none!important\}/);
 assert.match(css,/agent-mobile-backdrop:not\(\[hidden\]\)/);
 assert.match(agent,/prefers-reduced-motion/);
});

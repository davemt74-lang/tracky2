import test from 'node:test';import assert from 'node:assert/strict';
test('mobile rails are mutual-exclusive slide-outs; XXX is reversible and does not intercept text fields',async()=>{
 const ids=['agentViewChooser','agentCameraView','agentOrbView','agentOrbStage',
  'agentVoiceOrb','agentOrbCaption','agentOrbFollower','agentMobileLeftRail',
  'agentMobileRightRail','agentMobileBackdrop'];
 const e=new Map(ids.map(id=>[id,{id,hidden:false,dataset:{},attributes:{},handlers:{},
  css:{},style:{setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}},
  setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.handlers[k]=fn},
  querySelectorAll(){return []},querySelector(){return null}}]));
 const classes=new Map(),win={},doc={};
 globalThis.window={location:{search:'?mode=agent&view=orb'},addEventListener:(k,fn)=>win[k]=fn};
 globalThis.document={getElementById:id=>e.get(id),addEventListener:(k,fn)=>doc[k]=fn,
  body:{classList:{add:k=>classes.set(k,true),toggle:(k,v)=>classes.set(k,v)}}};
 try{
  await import('../agent-presence.js?v09-rails');
  assert.equal(e.get('agentMobileLeftRail').hidden,false);
  e.get('agentMobileLeftRail').handlers.click();
  assert.equal(classes.get('agent-mobile-panel-left'),true);
  assert.equal(e.get('agentMobileLeftRail').attributes['aria-expanded'],'true');
  e.get('agentMobileRightRail').handlers.click();
  assert.equal(classes.get('agent-mobile-panel-left'),false);
  assert.equal(classes.get('agent-mobile-panel-right'),true);
  e.get('agentMobileBackdrop').handlers.click();
  assert.equal(classes.get('agent-mobile-panel-right'),false);
  const key=(letter,tagName='BODY')=>({key:letter,target:{tagName},repeat:false});
  for(let i=0;i<3;i++)doc.keydown(key('x','INPUT'));
  assert.equal(classes.get('room-sidebars-hidden'),false);
  for(let i=0;i<3;i++)doc.keydown(key('x'));
  assert.equal(classes.get('room-sidebars-hidden'),true);
  for(let i=0;i<3;i++)doc.keydown(key('x'));
  assert.equal(classes.get('room-sidebars-hidden'),false);
  for(let i=0;i<3;i++)doc.keydown(key('z'));
  assert.equal(e.get('agentOrbStage').hidden,true);
  e.get('agentOrbView').handlers.click();
  win['tracky:agent-room-tracks']({detail:{target:{x:.35,y:.42,scale:1.1}}});
  assert.equal(e.get('agentOrbFollower').style['--orb-x'],'35.00%');
  win['tracky:agent-speech-state']({detail:{speaking:true}});
  assert.equal(e.get('agentVoiceOrb').dataset.speech,'speaking');
 }finally{delete globalThis.window;delete globalThis.document}
});

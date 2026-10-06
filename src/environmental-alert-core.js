const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=(v,n=140)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const ENVIRONMENT_ALERT_SCHEMA=1;
export const ENVIRONMENT_ALERT_GROUP_MS=20000;
export const ENVIRONMENT_ALERT_REPEAT_NOTICE_MS=60000;
export const ENVIRONMENT_MECHANICAL_STALE_MS=30000;
export const ENVIRONMENT_MECHANICAL_CONTINUE_MS=120000;

function ruleFor(classification={}){
 const category=clean(classification.category,64);
 const subtype=clean(classification.subtype,64);
 const label=clean(classification.modelLabel,96);
 if(category==='alarm'){
  if(/smoke detector|fire alarm/i.test(label))
   return {key:'smoke-fire-alarm-like',label:'Smoke / fire-alarm-like sound',severity:'urgent',
    minConfidence:.72,immediateConfidence:.88,repeatForProactive:2};
  if(/doorbell|buzzer|telephone bell/i.test(label))
   return {key:'doorbell-chime-like',label:'Doorbell / chime-like sound',severity:'attention',
    minConfidence:.7,immediateConfidence:.84,repeatForProactive:2};
  if(/siren|alarm/i.test(label))
   return {key:'alarm-siren-like',label:'Alarm / siren-like sound',severity:'urgent',
    minConfidence:.74,immediateConfidence:.88,repeatForProactive:2};
 }
 if(category==='impact-crowd'){
  if(/knock/i.test(label)||subtype==='door-impact')
   return {key:'door-knock-like',label:'Knocking / door-impact-like sound',severity:'attention',
    minConfidence:.72,immediateConfidence:.9,repeatForProactive:2};
  if(/breaking|crash/i.test(label))
   return {key:'breaking-impact-like',label:'Breaking / crash-like impact',severity:'urgent',
    minConfidence:.74,immediateConfidence:.9,repeatForProactive:2};
  if(/slam|bang|thump/i.test(label)||subtype==='impact')
   return {key:'impact-like',label:'Impact / bang-like sound',severity:'attention',
    minConfidence:.72,immediateConfidence:.92,repeatForProactive:2};
  if(/applause|clapping/i.test(label)||subtype==='applause')
   return {key:'applause-like',label:'Applause / clapping-like sound',severity:'info',
    minConfidence:.72,immediateConfidence:1.1,repeatForProactive:99};
 }
 if(category==='animal')
  return {key:'animal:'+label.toLowerCase(),label:(label||'Animal')+'-like sound',
   severity:'info',minConfidence:.72,immediateConfidence:1.1,repeatForProactive:99};
 if(category==='household-mechanical'&&subtype==='door-motion')
  return {key:'door-motion-like',label:'Door / drawer movement-like sound',severity:'info',
   minConfidence:.72,immediateConfidence:1.1,repeatForProactive:99};
 return null;
}

function eventSnapshot(group,now=Date.now(),type='detected'){
 return Object.freeze({
  schema:ENVIRONMENT_ALERT_SCHEMA,type,key:group.key,label:group.label,
  severity:group.severity,modelLabel:group.modelLabel,
  firstAt:group.firstAt,lastAt:group.lastAt,at:now,
  observationCount:group.observationCount,
  peakConfidence:Number(group.peakConfidence.toFixed(4)),
  sourceDirection:group.sourceDirection||'unavailable',
  participantId:null,sourceVerified:false,emergencyConfirmed:false,
  observableOnly:true
 });
}

export class EnvironmentalAlertTracker{
 constructor({groupMs=ENVIRONMENT_ALERT_GROUP_MS,repeatNoticeMs=ENVIRONMENT_ALERT_REPEAT_NOTICE_MS}={}){
  this.groupMs=Math.max(5000,Number(groupMs)||ENVIRONMENT_ALERT_GROUP_MS);
  this.repeatNoticeMs=Math.max(15000,Number(repeatNoticeMs)||ENVIRONMENT_ALERT_REPEAT_NOTICE_MS);
  this.groups=new Map();
 }
 reset(){this.groups.clear();}
 observe(classification,now=Date.now()){
  const rule=ruleFor(classification);
  if(!rule||clamp(classification?.confidence)<rule.minConfidence)
   return Object.freeze({accepted:false,emit:false,proactiveEligible:false,reason:'not-important-event',event:null});
  const at=finite(classification.at)?classification.at:now;
  let group=this.groups.get(rule.key);
  const same=group&&at-group.lastAt<=this.groupMs;
  if(!same){
   group={
    ...rule,modelLabel:clean(classification.modelLabel,96),
    firstAt:at,lastAt:at,lastNoticeAt:0,observationCount:0,peakConfidence:0,
    sourceDirection:classification.sourceContext?.direction||'unavailable'
   };
  }
  group.lastAt=at;group.observationCount++;
  group.peakConfidence=Math.max(group.peakConfidence,clamp(classification.confidence));
  const direction=classification.sourceContext?.direction||'unavailable';
  if(group.sourceDirection==='unavailable')group.sourceDirection=direction;
  else if(direction!=='unavailable'&&group.sourceDirection!==direction)group.sourceDirection='unavailable';
  const first=!same;
  const repeatMilestone=[2,3,5].includes(group.observationCount);
  const repeatWindow=group.lastNoticeAt&&at-group.lastNoticeAt>=this.repeatNoticeMs;
  const emit=first||repeatMilestone||repeatWindow;
  if(emit)group.lastNoticeAt=at;
  this.groups.set(rule.key,group);
  for(const [key,row] of this.groups)if(at-row.lastAt>this.repeatNoticeMs*4)this.groups.delete(key);
  const proactiveEligible=rule.severity!=='info'&&(
   group.peakConfidence>=rule.immediateConfidence||
   group.observationCount>=rule.repeatForProactive
  );
  return Object.freeze({
   accepted:true,emit,proactiveEligible,
   reason:proactiveEligible?'attention-threshold-met':emit?'observable-event':'grouped',
   event:eventSnapshot(group,at,first?'detected':'repeated')
  });
 }
}

export function environmentalAlertMessage(result){
 const event=result?.event;if(!event)return '';
 const count=event.observationCount;
 const confidence=Math.round(event.peakConfidence*100);
 if(event.type==='repeated')
  return 'Repeated '+event.label.toLowerCase()+' · '+count+' observations · '+
   confidence+'% peak model confidence · source unverified';
 return event.label+' detected · '+confidence+
  '% model confidence · source unverified · no emergency inferred';
}

export function environmentalAlertAgentNotice(result){
 const event=result?.event;
 if(!event||result.proactiveEligible!==true)return '';
 if(event.key==='smoke-fire-alarm-like')
  return 'I heard what sounds like a smoke or fire alarm. I cannot verify the source or whether there is an emergency.';
 if(event.key==='alarm-siren-like')
  return 'I heard an alarm- or siren-like sound. I cannot verify its source.';
 if(event.key==='doorbell-chime-like')
  return 'I heard what sounds like a doorbell or chime.';
 if(event.key==='door-knock-like')
  return 'I heard repeated knocking or a door-impact-like sound.';
 if(event.key==='breaking-impact-like')
  return 'I heard a repeated breaking- or crash-like impact. I cannot verify what caused it.';
 if(event.key==='impact-like')
  return 'I heard repeated impact or banging sounds. I cannot verify the source.';
 return '';
}

function mechanicalRule(classification={}){
 if(classification.category!=='household-mechanical'||classification.subtype!=='appliance')return null;
 const label=clean(classification.modelLabel,96)||'Appliance';
 return {key:'appliance:'+label.toLowerCase(),label,confidence:clamp(classification.confidence)};
}
function mechanicalSnapshot(active,at,type){
 return Object.freeze({
  schema:ENVIRONMENT_ALERT_SCHEMA,type,key:active.key,modelLabel:active.label,
  startedAt:active.startedAt,lastAt:active.lastAt,at,
  observationCount:active.observationCount,
  peakConfidence:Number(active.peakConfidence.toFixed(4)),
  observedDurationMs:Math.max(0,active.lastAt-active.startedAt),
  participantId:null,sourceVerified:false,observableOnly:true
 });
}
export class EnvironmentalMechanicalTracker{
 constructor({staleMs=ENVIRONMENT_MECHANICAL_STALE_MS,continueMs=ENVIRONMENT_MECHANICAL_CONTINUE_MS}={}){
  this.staleMs=Math.max(10000,Number(staleMs)||ENVIRONMENT_MECHANICAL_STALE_MS);
  this.continueMs=Math.max(30000,Number(continueMs)||ENVIRONMENT_MECHANICAL_CONTINUE_MS);
  this.active=null;
 }
 reset(){this.active=null;}
 observe(classification,now=Date.now()){
  const rule=mechanicalRule(classification);
  if(!rule||rule.confidence<.72)return Object.freeze({accepted:false,transitions:Object.freeze([]),active:this.snapshot()});
  const at=finite(classification.at)?classification.at:now,transitions=[];
  if(this.active&&(this.active.key!==rule.key||at-this.active.lastAt>=this.staleMs)){
   transitions.push(mechanicalSnapshot(this.active,at,'stop'));this.active=null;
  }
  if(!this.active){
   this.active={key:rule.key,label:rule.label,startedAt:at,lastAt:at,lastNoticeAt:at,
    observationCount:1,peakConfidence:rule.confidence};
   transitions.push(mechanicalSnapshot(this.active,at,'start'));
  }else{
   this.active.lastAt=at;this.active.observationCount++;
   this.active.peakConfidence=Math.max(this.active.peakConfidence,rule.confidence);
   if(at-this.active.lastNoticeAt>=this.continueMs){
    this.active.lastNoticeAt=at;transitions.push(mechanicalSnapshot(this.active,at,'continue'));
   }
  }
  return Object.freeze({accepted:true,transitions:Object.freeze(transitions),active:this.snapshot()});
 }
 expire(now=Date.now()){
  if(!this.active||now-this.active.lastAt<this.staleMs)return null;
  const stopped=mechanicalSnapshot(this.active,now,'stop');this.active=null;return stopped;
 }
 snapshot(){return this.active?mechanicalSnapshot(this.active,this.active.lastAt,'active'):null;}
}
function duration(ms){
 const sec=Math.max(0,Math.round((Number(ms)||0)/1000));
 if(sec<60)return sec+'s';const min=Math.floor(sec/60),rest=sec%60;
 return min+'m'+(rest?' '+rest+'s':'');
}
export function environmentalMechanicalMessage(event){
 if(!event)return '';
 const label=event.modelLabel+'-like appliance sound';
 if(event.type==='start')return label+' detected';
 if(event.type==='continue')return label+' continues · observed '+duration(event.observedDurationMs);
 if(event.type==='stop')return label+' no longer detected · observed '+duration(event.observedDurationMs);
 return label;
}

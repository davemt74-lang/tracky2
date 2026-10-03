// V0.10E: explicit, bounded, safe decision loop from canonical ROOM events.
// This section ONLY permits the existing local greeting. No arbitrary skill execution.
export const DEFAULT_COGNITIVE_POLICY=Object.freeze({
 autoGreet:true,quietEnabled:false,quietStart:'22:00',quietEnd:'07:00',
 cooldownMs:120000,maxGreetsPerHour:5
});
const timePart=(hhmm)=>{
 if(typeof hhmm!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm))return null;
 const [h,m]=hhmm.split(':').map(Number);return h*60+m;
};
export function inQuietHours(localMinute,policy=DEFAULT_COGNITIVE_POLICY){
 if(!policy.quietEnabled)return false;
 const start=timePart(policy.quietStart),end=timePart(policy.quietEnd);
 if(start===null||end===null||!Number.isFinite(localMinute)||localMinute<0||localMinute>=1440)
  return false;
 if(start===end)return true;
 return start<end?localMinute>=start&&localMinute<end:
  localMinute>=start||localMinute<end;
}
export function normalizedCognitivePolicy(p={}){
 const input=p&&typeof p==='object'?p:{};
 return Object.freeze({autoGreet:input.autoGreet!==false,
  quietEnabled:input.quietEnabled===true,
  quietStart:timePart(input.quietStart)!==null?input.quietStart:'22:00',
  quietEnd:timePart(input.quietEnd)!==null?input.quietEnd:'07:00',
  cooldownMs:Math.max(120000,Math.min(3600000,
   Number.isFinite(input.cooldownMs)?input.cooldownMs:120000)),
  maxGreetsPerHour:Math.max(1,Math.min(10,
   Number.isFinite(input.maxGreetsPerHour)?Math.floor(input.maxGreetsPerHour):5))
 });
}
export class AgentCognitiveLoop{
 constructor(policy=DEFAULT_COGNITIVE_POLICY){
  this.policy=normalizedCognitivePolicy(policy);this.processed=new Set();
  this.greetings=new Map();this.history=[];this.lastDecision=null;
 }
 setPolicy(policy){this.policy=normalizedCognitivePolicy(policy);}
 evaluate(event,{participant=null,track=null,busy=false,now=Date.now(),
  localMinute=null}={}){
  if(!event||event.semantic!=='participant-observed'||event.category!=='presence')return null;
  const key=String(event.id||'');
  if(!key||this.processed.has(key))return null;
  this.processed.add(key);
  if(this.processed.size>240)this.processed.delete(this.processed.values().next().value);
  const policy=this.policy;
  const minute=localMinute===null?new Date(now).getHours()*60+
   new Date(now).getMinutes():localMinute;
  const eligible=Boolean(event.source==='stable-camera-track'&&
   event.participantId&&participant&&participant.id===event.participantId&&
   participant.recognitionEnabled!==false&&
   track&&track.participantId===participant.id&&
   ['matched','body-lock'].includes(track.status));
  let reason='',action=null;
  if(!eligible)reason='abstain: identity or live camera evidence not verified';
  else if(!policy.autoGreet)reason='abstain: automatic greetings disabled';
  else if(participant.agentGreetingEnabled===false)
   reason='abstain: participant greeting preference disabled';
  else if(inQuietHours(minute,policy))reason='abstain: quiet hours';
  else if(busy)reason='abstain: conversation or agent audio busy';
  else{
   const last=this.greetings.get(participant.id);
   this.history=this.history.filter(item=>now-item.at>=0&&now-item.at<3600000);
   if(last!==undefined&&now-last<policy.cooldownMs)
    reason='abstain: participant cooldown active';
   else if(this.history.length>=policy.maxGreetsPerHour)
    reason='abstain: hourly interruption limit';
   else{action='greet';reason='engage: verified participant in view and policy allows greeting';}
  }
  this.lastDecision=Object.freeze({eventId:key,participantId:eligible?participant.id:null,
   at:now,action,reason,stage:action?'approved-opportunity':'abstain',
   evidence:'stable-camera-track',priority:action?'low':null});
  return this.lastDecision;
 }
 recordOutcome(decision,{executed=false,at=Date.now()}={}){
  if(!decision||decision!==this.lastDecision||decision.action!=='greet')return null;
  if(executed&&decision.participantId){
   this.greetings.set(decision.participantId,at);
   this.history.push({at,participantId:decision.participantId});
   this.history=this.history.slice(-10);
  }
  return Object.freeze({eventId:decision.eventId,participantId:decision.participantId,
   at,action:decision.action,executed:Boolean(executed),
   reason:executed?'Built-in greeting emitted':'Greeting cancelled or unavailable'});
 }
 snapshot(){return Object.freeze({lastDecision:this.lastDecision,
  greetedThisHour:this.history.length});}
}

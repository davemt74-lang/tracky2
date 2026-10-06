// V0.14.9F governed contextual follow-through.
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const clean=(v,n=480)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const FOLLOW_THROUGH_SCHEMA=1;
export const FOLLOW_THROUGH_TTL_MS=3*60*1000;
export const FOLLOW_THROUGH_ACTIONS=Object.freeze(['research','recommendation','explanation','follow-up']);

const id=()=>globalThis.crypto?.randomUUID?.()||
 'follow-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);

export function contextualFollowThroughProposal({
 plan=null,candidate=null,relatedEventId=null,at=Date.now()
}={}){
 const action=clean(plan?.action,32);
 if(!FOLLOW_THROUGH_ACTIONS.includes(action))return null;
 const identity=candidate?.mediaIdentity||{};
 const subject=action==='research'
  ?clean([identity.artist,identity.title,identity.series].filter(Boolean).join(' — '),280)
  :clean(candidate?.mediaLabel||identity.title||identity.series||identity.artist,280);
 if(!candidate?.participantId||!candidate?.topicKey||!subject)return null;
 const query=action==='research'
  ?clean('Research current reliable information related to '+subject+
   ' and return concise useful context, related works, or comparisons relevant to the user.',700)
  :'';
 return Object.freeze({
  schema:FOLLOW_THROUGH_SCHEMA,id:id(),status:'pending-confirmation',
  action,participantId:clean(candidate.participantId,96),
  topicKey:clean(candidate.topicKey,360),mediaKind:clean(candidate.mediaKind,48)||null,
  subject,query,createdAt:at,expiresAt:at+FOLLOW_THROUGH_TTL_MS,
  relatedEventId:clean(relatedEventId,96)||null,
  rawAudioStored:false
 });
}

export function followThroughReplyDecision(transcript,proposal,now=Date.now()){
 if(!proposal||proposal.status!=='pending-confirmation')
  return Object.freeze({action:'none',reason:'no-pending-proposal'});
 if(now>proposal.expiresAt)
  return Object.freeze({action:'expire',reason:'proposal-expired'});
 const text=clean(transcript,500).toLowerCase();
 if(!text)return Object.freeze({action:'none',reason:'empty'});
 if(/\b(stop|don't|do not|not now|no thanks|no thank you|leave it|skip it|cancel)\b/.test(text))
  return Object.freeze({action:'decline',reason:'explicit-decline'});
 const yes=/^(yes|yeah|yep|sure|ok|okay|please|go ahead|do it|sounds good)\b/.test(text)||
  /\b(look it up|research it|find out|show me|tell me more|give me recommendations?|recommend some|what else is like)\b/.test(text);
 if(yes)return Object.freeze({action:'confirm',reason:'explicit-acceptance'});
 return Object.freeze({action:'none',reason:'not-explicit'});
}

export function confirmedFollowThrough(proposal,now=Date.now()){
 if(!proposal||proposal.status!=='pending-confirmation'||now>proposal.expiresAt)return null;
 return Object.freeze({...proposal,status:'confirmed',confirmedAt:now});
}
export function completedFollowThrough(proposal,{
 status='succeeded',summary='',sources=[],provider=null,model=null,at=Date.now()
}={}){
 if(!proposal)return null;
 const finalStatus=['succeeded','failed','cancelled'].includes(status)?status:'failed';
 const seen=new Set(),safeSources=[];
 for(const row of Array.isArray(sources)?sources:[]){
  const url=/^https:\/\//i.test(String(row?.url||''))?String(row.url).slice(0,700):'';
  if(!url||seen.has(url))continue;
  seen.add(url);
  safeSources.push(Object.freeze({url,title:clean(row?.title,160)}));
  if(safeSources.length>=5)break;
 }
 return Object.freeze({
  ...proposal,status:finalStatus,completedAt:at,
  summary:clean(summary,900),sources:Object.freeze(safeSources),
  provider:clean(provider,32)||null,model:clean(model,80)||null
 });
}

export function followThroughResultMessage(result={}){
 if(result.status==='succeeded'){
  const sources=result.sources?.length?' · '+result.sources.length+' sources':'';
  return 'Contextual '+result.action+' completed'+sources;
 }
 if(result.status==='failed')return 'Contextual '+result.action+' failed cleanly';
 if(result.status==='cancelled')return 'Contextual '+result.action+' cancelled';
 return '';
}

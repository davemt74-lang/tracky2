const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=(v,n=180)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const MEDIA_ID_SCHEMA=1;
export const MEDIA_ID_MIN_WINDOW_MS=2500;
export const MEDIA_ID_MAX_WINDOW_MS=20000;
export const MEDIA_ID_ATTEMPT_COOLDOWN_MS=12000;
export const MEDIA_ID_LOOKUP_COOLDOWN_MS=20000;
export const MEDIA_ID_LOOKUP_DEDUPE_MS=10*60*1000;
export const MEDIA_ID_CANDIDATE_MAX_AGE_MS=3*60*1000;
export const MEDIA_ID_CONFIRM_OBSERVATIONS=2;
export const MEDIA_ID_MAX_DIALOGUE_WORDS=28;

export function mediaWindowEligibility({
 mediaKind='',durationMs=0,at=Date.now(),lastAttemptAt=0,
 processing=false,enabled=true,documentHidden=false
}={}){
 if(!enabled)return Object.freeze({accept:false,reason:'disabled'});
 if(documentHidden)return Object.freeze({accept:false,reason:'document-hidden'});
 if(processing)return Object.freeze({accept:false,reason:'recognition-busy'});
 if(!['television','recorded-media','radio'].includes(mediaKind))
  return Object.freeze({accept:false,reason:'unsupported-media-kind'});
 const duration=Math.max(0,Number(durationMs)||0);
 if(duration<MEDIA_ID_MIN_WINDOW_MS)return Object.freeze({accept:false,reason:'window-too-short'});
 if(duration>MEDIA_ID_MAX_WINDOW_MS)return Object.freeze({accept:false,reason:'window-too-long'});
 if(finite(lastAttemptAt)&&lastAttemptAt>0&&at-lastAttemptAt<MEDIA_ID_ATTEMPT_COOLDOWN_MS)
  return Object.freeze({accept:false,reason:'recognition-cooldown'});
 return Object.freeze({accept:true,reason:'eligible'});
}

export function normalizeMediaDialogueClue(text){
 const value=clean(text,420)
  .replace(/\[(?:music|applause|inaudible|noise|instrumental)[^\]]*\]/gi,' ')
  .replace(/\s+/g,' ').trim();
 if(!value)return Object.freeze({usable:false,text:'',query:'',wordCount:0,reason:'empty'});
 const words=value.split(/\s+/).filter(Boolean).slice(0,MEDIA_ID_MAX_DIALOGUE_WORDS);
 const bounded=words.join(' ').slice(0,260);
 const lexical=words.filter(word=>/[a-z0-9]{2,}/i.test(word.replace(/[^a-z0-9']/gi,'')));
 if(lexical.length<5)
  return Object.freeze({usable:false,text:bounded,query:'',wordCount:words.length,reason:'too-few-words'});
 const query=lexical.slice(0,18).join(' ').slice(0,190);
 return Object.freeze({usable:true,text:bounded,query,wordCount:words.length,reason:'usable'});
}

export function normalizeMediaVisualClue(text){
 const value=clean(text,220);
 if(!value)return Object.freeze({usable:false,text:'',reason:'empty'});
 if(value.split(/\s+/).filter(Boolean).length<2)
  return Object.freeze({usable:false,text:value,reason:'too-short'});
 return Object.freeze({usable:true,text:value,reason:'usable'});
}

export function normalizeMediaCandidate(input={},source='dialogue',at=Date.now()){
 const title=clean(input.title,140);
 if(!title)return null;
 const kind=[
  'movie','tv-series','episode','streaming-video',
  'podcast','podcast-episode','radio-show','radio-station','unknown'
 ].includes(input.kind)?input.kind:'unknown';
 const series=clean(input.series,140)||null;
 const season=Number.isInteger(Number(input.season))&&Number(input.season)>0?Number(input.season):null;
 const episode=Number.isInteger(Number(input.episode))&&Number(input.episode)>0?Number(input.episode):null;
 const year=Number.isInteger(Number(input.year))&&Number(input.year)>=1888&&Number(input.year)<=2100
  ?Number(input.year):null;
 const service=clean(input.service,80)||null;
 const provider=clean(input.provider,64)||'unknown';
 const confidence=clamp(input.confidence??0);
 return Object.freeze({
  schema:MEDIA_ID_SCHEMA,kind,title,series,season,episode,year,service,provider,
  source:['dialogue','visual','audio-fingerprint','metadata'].includes(source)?source:'metadata',
  evidenceId:clean(input.evidenceId,96)||null,
  sourceUrls:Object.freeze((Array.isArray(input.sourceUrls)?input.sourceUrls:[])
   .map(value=>clean(value,700)).filter(value=>/^https:\/\//i.test(value)).slice(0,5)),
  confidence,at:finite(at)?at:Date.now()
 });
}

export function mediaCandidateKey(candidate){
 if(!candidate)return '';
 const norm=v=>String(v||'').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g,' ').trim();
 return [candidate.kind,norm(candidate.series||''),norm(candidate.title),
  candidate.season||'',candidate.episode||''].join('::');
}

function publicMedia(candidate,status,observations,at,firstAt){
 return Object.freeze({
  schema:MEDIA_ID_SCHEMA,status,kind:candidate?.kind||null,
  title:candidate?.title||null,series:candidate?.series||null,
  season:candidate?.season||null,episode:candidate?.episode||null,
  year:candidate?.year||null,service:candidate?.service||null,
  provider:candidate?.provider||null,
  sourceUrls:Object.freeze(Array.from(candidate?.sourceUrls||[]).slice(0,5)),
  confidence:candidate?Number(clamp(candidate.confidence).toFixed(4)):0,
  observations,firstAt:firstAt||null,lastAt:at||null
 });
}

export class MediaIdentificationTracker{
 constructor({confirmObservations=MEDIA_ID_CONFIRM_OBSERVATIONS,
  candidateMaxAgeMs=MEDIA_ID_CANDIDATE_MAX_AGE_MS}={}){
  this.confirmObservations=Math.max(2,Math.min(4,Math.floor(confirmObservations)||2));
  this.candidateMaxAgeMs=Math.max(60000,Number(candidateMaxAgeMs)||MEDIA_ID_CANDIDATE_MAX_AGE_MS);
  this.pending=null;this.confirmed=null;this.lastDialogue=null;this.lastVisual=null;
 }
 reset(){this.pending=null;this.confirmed=null;this.lastDialogue=null;this.lastVisual=null;}
 noteDialogue(text,at=Date.now()){
  const clue=normalizeMediaDialogueClue(text);
  this.lastDialogue=clue.usable?Object.freeze({...clue,at}):null;return clue;
 }
 noteVisual(text,at=Date.now()){
  const clue=normalizeMediaVisualClue(text);
  this.lastVisual=clue.usable?Object.freeze({...clue,at}):null;return clue;
 }
 observeCandidate(candidate,now=Date.now()){
  if(!candidate)return Object.freeze({emit:false,transition:'no-candidate',media:this.snapshot(),candidate:null});
  const key=mediaCandidateKey(candidate);
  if(!key)return Object.freeze({emit:false,transition:'invalid-candidate',media:this.snapshot(),candidate:null});
  if(this.confirmed&&mediaCandidateKey(this.confirmed.candidate)===key){
   this.confirmed={...this.confirmed,candidate,observations:this.confirmed.observations+1,lastAt:now};
   return Object.freeze({emit:false,transition:'confirmed-repeat',media:this.snapshot(),candidate});
  }
  if(!this.pending||this.pending.key!==key||now-this.pending.lastAt>this.candidateMaxAgeMs){
   this.pending={key,candidate,observations:1,firstAt:now,lastAt:now,
    sources:new Set([candidate.source]),
    evidenceIds:new Set(candidate.evidenceId?[candidate.evidenceId]:[])};
   return Object.freeze({emit:true,transition:'candidate',media:this.snapshot(),candidate});
  }
  this.pending.candidate=candidate;this.pending.observations++;this.pending.lastAt=now;
  this.pending.sources.add(candidate.source);
  if(candidate.evidenceId)this.pending.evidenceIds.add(candidate.evidenceId);
  const enough=this.pending.observations>=this.confirmObservations;
  const independent=this.pending.sources.size>=2;
  const repeatedDistinctDialogue=candidate.source==='dialogue'&&candidate.confidence>=.78&&
    this.pending.evidenceIds.size>=this.confirmObservations;
  const highConfidenceVisual=candidate.source==='visual'&&candidate.confidence>=.92;
  if(enough&&(independent||repeatedDistinctDialogue||highConfidenceVisual)){
   const prior=this.confirmed;
   this.confirmed={candidate,observations:this.pending.observations,
    firstAt:this.pending.firstAt,lastAt:now};
   this.pending=null;
   const changed=Boolean(prior&&mediaCandidateKey(prior.candidate)!==key);
   return Object.freeze({emit:true,transition:changed?'content-changed':'confirmed',
    media:this.snapshot(),candidate});
  }
  return Object.freeze({emit:false,transition:'candidate-repeat',media:this.snapshot(),candidate});
 }
 clearConfirmed(now=Date.now()){
  if(!this.confirmed&&!this.pending)return Object.freeze({emit:false,transition:'idle',media:this.snapshot()});
  const prior=this.snapshot();this.confirmed=null;this.pending=null;this.lastDialogue=null;this.lastVisual=null;
  return Object.freeze({emit:true,transition:'stopped',media:prior,at:now});
 }
 snapshot(){
  if(this.confirmed)return publicMedia(this.confirmed.candidate,'confirmed',
    this.confirmed.observations,this.confirmed.lastAt,this.confirmed.firstAt);
  if(this.pending)return publicMedia(this.pending.candidate,'candidate',
    this.pending.observations,this.pending.lastAt,this.pending.firstAt);
  return publicMedia(null,'unknown',0,null,null);
 }
}

function clueKey(query){
 return clean(query,220).toLowerCase().normalize('NFKD').replace(/[^a-z0-9']+/g,' ').trim();
}
export class MediaLookupGuard{
 constructor({cooldownMs=MEDIA_ID_LOOKUP_COOLDOWN_MS,dedupeMs=MEDIA_ID_LOOKUP_DEDUPE_MS,maxSeen=32}={}){
  this.cooldownMs=Math.max(5000,Number(cooldownMs)||MEDIA_ID_LOOKUP_COOLDOWN_MS);
  this.dedupeMs=Math.max(60000,Number(dedupeMs)||MEDIA_ID_LOOKUP_DEDUPE_MS);
  this.maxSeen=Math.max(4,Math.min(100,Math.floor(maxSeen)||32));
  this.lastAt=0;this.seen=new Map();
 }
 reset(){this.lastAt=0;this.seen.clear();}
 claim(query,now=Date.now()){
  const key=clueKey(query);
  if(!key)return Object.freeze({allow:false,reason:'empty-query',key:''});
  if(this.lastAt&&now-this.lastAt<this.cooldownMs)
   return Object.freeze({allow:false,reason:'lookup-cooldown',key});
  const seenAt=this.seen.get(key)||0;
  if(seenAt&&now-seenAt<this.dedupeMs)
   return Object.freeze({allow:false,reason:'duplicate-clue',key});
  this.lastAt=now;this.seen.set(key,now);
  for(const [candidate,at] of this.seen)if(now-at>this.dedupeMs)this.seen.delete(candidate);
  while(this.seen.size>this.maxSeen)this.seen.delete(this.seen.keys().next().value);
  return Object.freeze({allow:true,reason:'allowed',key});
 }
}

export class MediaRecognitionQueue{
 constructor({maxQueue=1,cooldownMs=MEDIA_ID_ATTEMPT_COOLDOWN_MS}={}){
  this.maxQueue=Math.max(1,Math.min(2,Math.floor(maxQueue)||1));
  this.cooldownMs=Math.max(3000,Number(cooldownMs)||MEDIA_ID_ATTEMPT_COOLDOWN_MS);
  this.enabled=true;this.processing=null;this.queue=[];this.lastAttemptAt=0;
 }
 setEnabled(value){this.enabled=Boolean(value);if(!this.enabled)this.clear();return this.enabled;}
 clear(){this.processing=null;this.queue=[];}
 enqueue(job,now=Date.now()){
  const eligibility=mediaWindowEligibility({
   mediaKind:job?.mediaKind,durationMs:job?.durationMs,at:now,
   lastAttemptAt:this.lastAttemptAt,processing:Boolean(this.processing),
   enabled:this.enabled,documentHidden:Boolean(job?.documentHidden)
  });
  if(!eligibility.accept)return Object.freeze({accepted:false,reason:eligibility.reason,dropped:[]});
  const dropped=[];while(this.queue.length>=this.maxQueue)dropped.push(this.queue.shift());
  const safe=Object.freeze({...job,queuedAt:now});this.queue.push(safe);this.lastAttemptAt=now;
  return Object.freeze({accepted:true,reason:'queued',dropped:Object.freeze(dropped)});
 }
 beginNext(){if(this.processing||!this.enabled||!this.queue.length)return null;this.processing=this.queue.shift();return this.processing;}
 complete(job){if(this.processing===job)this.processing=null;}
 snapshot(){return Object.freeze({enabled:this.enabled,processing:Boolean(this.processing),
  queueDepth:this.queue.length,lastAttemptAt:this.lastAttemptAt});}
}

function mediaLabel(media={}){
 if(['episode','podcast-episode'].includes(media.kind)){
  const series=media.series||media.title;
  const suffix=media.kind==='episode'&&media.season&&media.episode
   ?' · S'+media.season+'E'+media.episode:'';
  return series+(media.title&&media.title!==series?' · '+media.title:'')+suffix;
 }
 if(media.kind==='radio-show'){
  return (media.series||media.title)+(media.title&&media.series&&media.title!==media.series
   ?' · '+media.title:'');
 }
 return media.title||media.series||'Unknown media';
}
export function mediaIdentificationMessage(result){
 if(!result)return '';
 const media=result.media||{};
 if(result.transition==='candidate')return 'Media ID candidate · '+mediaLabel(media)+' · verifying';
 if(result.transition==='confirmed')return 'Media identified · '+mediaLabel(media);
 if(result.transition==='content-changed')return 'Media changed · '+mediaLabel(media);
 if(result.transition==='stopped'&&media.status==='confirmed')return 'Identified media stopped · '+mediaLabel(media);
 return '';
}

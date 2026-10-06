const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=(v,n=160)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export const MUSIC_ID_SCHEMA=1;
export const MUSIC_ID_MIN_WINDOW_MS=3000;
export const MUSIC_ID_MAX_WINDOW_MS=18000;
export const MUSIC_ID_ATTEMPT_COOLDOWN_MS=12000;
export const MUSIC_ID_CANDIDATE_MAX_AGE_MS=120000;
export const MUSIC_ID_CONFIRM_OBSERVATIONS=2;
export const MUSIC_ID_MAX_LYRIC_WORDS=24;

export function musicWindowEligibility({
 category='',durationMs=0,at=Date.now(),lastAttemptAt=0,processing=false,
 enabled=true,documentHidden=false
}={}){
 if(!enabled)return Object.freeze({accept:false,reason:'disabled'});
 if(documentHidden)return Object.freeze({accept:false,reason:'document-hidden'});
 if(processing)return Object.freeze({accept:false,reason:'recognition-busy'});
 if(category!=='music')return Object.freeze({accept:false,reason:'not-music'});
 const duration=Math.max(0,Number(durationMs)||0);
 if(duration<MUSIC_ID_MIN_WINDOW_MS)return Object.freeze({accept:false,reason:'window-too-short'});
 if(duration>MUSIC_ID_MAX_WINDOW_MS)return Object.freeze({accept:false,reason:'window-too-long'});
 if(finite(lastAttemptAt)&&lastAttemptAt>0&&at-lastAttemptAt<MUSIC_ID_ATTEMPT_COOLDOWN_MS)
  return Object.freeze({accept:false,reason:'recognition-cooldown'});
 return Object.freeze({accept:true,reason:'eligible'});
}

export function normalizeLyricWorkingText(text){
 const value=clean(text,320)
  .replace(/\[(?:music|applause|inaudible|instrumental)[^\]]*\]/gi,' ')
  .replace(/\s+/g,' ').trim();
 if(!value)return Object.freeze({usable:false,text:'',query:'',wordCount:0,reason:'empty'});
 const words=value.split(/\s+/).filter(Boolean).slice(0,MUSIC_ID_MAX_LYRIC_WORDS);
 const bounded=words.join(' ').slice(0,220);
 const lexical=words.filter(word=>/[a-z0-9]{2,}/i.test(word.replace(/[^a-z0-9']/gi,'')));
 if(lexical.length<4)
  return Object.freeze({usable:false,text:bounded,query:'',wordCount:words.length,reason:'too-few-words'});
 const query=lexical.slice(0,14).join(' ').slice(0,160);
 return Object.freeze({usable:true,text:bounded,query,wordCount:words.length,reason:'usable'});
}

export function normalizeMusicCandidate(input={},source='fingerprint',at=Date.now()){
 const title=clean(input.title,120),artist=clean(input.artist,120);
 if(!title||!artist)return null;
 const provider=clean(input.provider,64)||'unknown';
 const externalId=clean(input.externalId||input.id,160)||null;
 const album=clean(input.album,120)||null;
 const confidence=clamp(input.confidence??0);
 return Object.freeze({
  schema:MUSIC_ID_SCHEMA,title,artist,album,externalId,provider,
  source:['fingerprint','lyrics','visual','metadata'].includes(source)?source:'metadata',
  confidence,at:finite(at)?at:Date.now()
 });
}
export async function identifyMusicFingerprint(provider,{
 samples=null,sampleRate=16000,durationMs=0,at=Date.now(),signal=null
}={}){
 if(!provider)return Object.freeze({available:false,candidate:null,reason:'provider-not-configured'});
 if(typeof provider.identify!=='function')
  return Object.freeze({available:false,candidate:null,reason:'provider-invalid'});
 if(!samples?.length)
  return Object.freeze({available:true,candidate:null,reason:'missing-samples'});
 const raw=await provider.identify({samples,sampleRate,durationMs,at,signal});
 const candidate=normalizeMusicCandidate(raw||{},'fingerprint',at);
 return Object.freeze({
  available:true,candidate,reason:candidate?'candidate':'no-match'
 });
}

export function musicLyricSearchSeed(text){
 const lyric=typeof text==='string'?normalizeLyricWorkingText(text):text;
 if(!lyric?.usable)return '';
 return lyric.query;
}

export function musicCandidateKey(candidate){
 if(!candidate)return '';
 const norm=v=>String(v||'').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g,' ').trim();
 return norm(candidate.artist)+'::'+norm(candidate.title);
}

function publicTrack(candidate,status,observations,at,firstAt){
 return Object.freeze({
  schema:MUSIC_ID_SCHEMA,status,title:candidate?.title||null,artist:candidate?.artist||null,
  album:candidate?.album||null,provider:candidate?.provider||null,
  externalId:candidate?.externalId||null,
  confidence:candidate?Number(clamp(candidate.confidence).toFixed(4)):0,
  observations,firstAt:firstAt||null,lastAt:at||null
 });
}

export class MusicIdentificationTracker{
 constructor({confirmObservations=MUSIC_ID_CONFIRM_OBSERVATIONS,
  candidateMaxAgeMs=MUSIC_ID_CANDIDATE_MAX_AGE_MS}={}){
  this.confirmObservations=Math.max(2,Math.min(4,Math.floor(confirmObservations)||2));
  this.candidateMaxAgeMs=Math.max(30000,Number(candidateMaxAgeMs)||MUSIC_ID_CANDIDATE_MAX_AGE_MS);
  this.pending=null;this.confirmed=null;this.lastLyric=null;
 }
 reset(){this.pending=null;this.confirmed=null;this.lastLyric=null;}
 noteLyrics(text,at=Date.now()){
  const lyric=normalizeLyricWorkingText(text);
  this.lastLyric=lyric.usable?Object.freeze({...lyric,at}):null;
  return lyric;
 }
 observeCandidate(candidate,now=Date.now()){
  if(!candidate)return Object.freeze({emit:false,transition:'no-candidate',track:this.snapshot(),candidate:null});
  const key=musicCandidateKey(candidate);
  if(!key)return Object.freeze({emit:false,transition:'invalid-candidate',track:this.snapshot(),candidate:null});
  if(this.confirmed&&musicCandidateKey(this.confirmed.candidate)===key){
   this.confirmed={...this.confirmed,candidate,
    observations:this.confirmed.observations+1,lastAt:now};
   return Object.freeze({emit:false,transition:'confirmed-repeat',track:this.snapshot(),candidate});
  }
  if(!this.pending||this.pending.key!==key||now-this.pending.lastAt>this.candidateMaxAgeMs){
   this.pending={key,candidate,observations:1,firstAt:now,lastAt:now,
    sources:new Set([candidate.source])};
   return Object.freeze({emit:true,transition:'candidate',track:this.snapshot(),candidate});
  }
  this.pending.candidate=candidate;this.pending.observations++;
  this.pending.lastAt=now;this.pending.sources.add(candidate.source);
  const enough=this.pending.observations>=this.confirmObservations;
  const independent=this.pending.sources.size>=2;
  const strongFingerprint=candidate.source==='fingerprint'&&candidate.confidence>=.9;
  if(enough&&(independent||strongFingerprint)){
   const prior=this.confirmed;
   this.confirmed={candidate,observations:this.pending.observations,
    firstAt:this.pending.firstAt,lastAt:now};
   this.pending=null;
   const changed=Boolean(prior&&musicCandidateKey(prior.candidate)!==key);
   return Object.freeze({emit:true,transition:changed?'track-changed':'confirmed',
    track:this.snapshot(),candidate});
  }
  return Object.freeze({emit:false,transition:'candidate-repeat',track:this.snapshot(),candidate});
 }
 clearConfirmed(now=Date.now()){
  if(!this.confirmed&&!this.pending)return Object.freeze({emit:false,transition:'idle',track:this.snapshot()});
  const prior=this.snapshot();this.confirmed=null;this.pending=null;this.lastLyric=null;
  return Object.freeze({emit:true,transition:'stopped',track:prior,at:now});
 }
 snapshot(){
  if(this.confirmed)return publicTrack(this.confirmed.candidate,'confirmed',
    this.confirmed.observations,this.confirmed.lastAt,this.confirmed.firstAt);
  if(this.pending)return publicTrack(this.pending.candidate,'candidate',
    this.pending.observations,this.pending.lastAt,this.pending.firstAt);
  return publicTrack(null,'unknown',0,null,null);
 }
}

export class MusicRecognitionQueue{
 constructor({maxQueue=1,cooldownMs=MUSIC_ID_ATTEMPT_COOLDOWN_MS}={}){
  this.maxQueue=Math.max(1,Math.min(2,Math.floor(maxQueue)||1));
  this.cooldownMs=Math.max(3000,Number(cooldownMs)||MUSIC_ID_ATTEMPT_COOLDOWN_MS);
  this.enabled=true;this.processing=null;this.queue=[];this.lastAttemptAt=0;
 }
 setEnabled(value){this.enabled=Boolean(value);if(!this.enabled)this.clear();return this.enabled;}
 clear(){this.processing=null;this.queue=[];}
 enqueue(job,now=Date.now()){
  const eligibility=musicWindowEligibility({
   category:job?.category,durationMs:job?.durationMs,at:now,
   lastAttemptAt:this.lastAttemptAt,processing:Boolean(this.processing),
   enabled:this.enabled,documentHidden:Boolean(job?.documentHidden)
  });
  if(!eligibility.accept)return Object.freeze({accepted:false,reason:eligibility.reason,dropped:[]});
  const dropped=[];
  while(this.queue.length>=this.maxQueue)dropped.push(this.queue.shift());
  const safe=Object.freeze({...job,queuedAt:now});
  this.queue.push(safe);this.lastAttemptAt=now;
  return Object.freeze({accepted:true,reason:'queued',dropped:Object.freeze(dropped)});
 }
 beginNext(){
  if(this.processing||!this.enabled||!this.queue.length)return null;
  this.processing=this.queue.shift();return this.processing;
 }
 complete(job){
  if(this.processing===job)this.processing=null;
 }
 snapshot(){
  return Object.freeze({enabled:this.enabled,processing:Boolean(this.processing),
   queueDepth:this.queue.length,lastAttemptAt:this.lastAttemptAt});
 }
}

export function musicIdentificationMessage(result){
 if(!result)return '';
 const track=result.track||{};
 if(result.transition==='candidate')
  return 'Music ID candidate · '+track.artist+' — '+track.title+' · verifying';
 if(result.transition==='confirmed')
  return 'Music identified · '+track.artist+' — '+track.title;
 if(result.transition==='track-changed')
  return 'Track changed · '+track.artist+' — '+track.title;
 if(result.transition==='stopped'&&track.status==='confirmed'&&track.title&&track.artist)
  return 'Identified music stopped · '+track.artist+' — '+track.title;
 return '';
}

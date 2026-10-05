// V0.14D session-only memory proposal engine.
// Proposals are never persisted. Only explicit owner approval may create durable memory.
import {MEMORY_TYPES,normalizeMemoryRecord} from './agent-memory-core.js';

export const MEMORY_PROPOSAL_SCHEMA=1;
export const MAX_MEMORY_PROPOSALS=40;
export const MAX_PROPOSAL_SOURCE_REFS=5;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const SOURCE_KINDS=new Set(['dialogue','room-event','meeting-note','meeting-decision']);

function hashText(value=''){
 let h=0x811c9dc5;
 for(const ch of String(value)){
  h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;
 }
 return h.toString(16).padStart(8,'0');
}
function normalizeWords(value=''){
 return short(value,600).toLowerCase()
  .replace(/[’']/g,'').replace(/[^a-z0-9\s-]/g,' ')
  .replace(/\s+/g,' ').trim();
}
function tokens(value=''){
 const stop=new Set(['a','an','the','and','or','but','to','of','for','in','on','at','is','are',
  'i','me','my','we','our','this','that','it','please','remember','memory']);
 return [...new Set(normalizeWords(value).split(' ').filter(x=>x.length>1&&!stop.has(x)))];
}
function similarity(a,b){
 const aa=new Set(tokens(a)),bb=new Set(tokens(b));
 if(!aa.size||!bb.size)return 0;
 let intersection=0;for(const x of aa)if(bb.has(x))intersection++;
 return intersection/(aa.size+bb.size-intersection);
}
function polarity(value=''){
 const text=' '+normalizeWords(value)+' ';
 return /\b(?:not|never|dont|doesnt|dislike|hate|avoid|without)\b/.test(text)?'negative':'positive';
}
function comparableText(value=''){
 return normalizeWords(value)
  .replace(/\b(?:not|never|dont|doesnt|dislike|hate|avoid|without)\b/g,' ')
  .replace(/\b(?:prefer|prefers|like|likes|love|loves|favorite|favourite)\b/g,' ')
  .replace(/\s+/g,' ').trim();
}

const SENSITIVE_PATTERNS=Object.freeze([
 {reason:'health-or-medical',re:/\b(?:diagnos\w*|disease|disorder|medicat\w*|medicine|doctor|therapy|therapist|cancer|diabetes|pregnan\w*|disab\w*|autis\w*|adhd|bipolar|ptsd|allerg\w*|chronic pain|mental health)\b/i},
 {reason:'emotion-or-mood',re:/\b(?:feel(?:ing|s)?|felt|sad|happy|angry|upset|lonely|stressed|stress|anxious|anxiety|depress\w*|mood|emotion\w*)\b/i},
 {reason:'protected-trait',re:/\b(?:race|racial|ethnic\w*|religio\w*|christian|muslim|jewish|hindu|buddhist|atheist|politic\w*|democrat\w*|republican\w*|liberal|conservative|sexual(?:ity| orientation)?|gay|lesbian|bisexual|transgender|gender identity|trade union|union member)\b/i},
 {reason:'criminal-history',re:/\b(?:arrested|convicted|conviction|felony|criminal record|probation|parole)\b/i},
 {reason:'financial-sensitive',re:/\b(?:bank account|credit card|salary|income|debt|social security|ssn)\b/i},
 {reason:'precise-location',re:/\b(?:home address|street address|live at\s+\d{1,6}\b)\b/i}
]);
export function sensitiveMemoryReason(value=''){
 const text=short(value,800);
 for(const rule of SENSITIVE_PATTERNS)if(rule.re.test(text))return rule.reason;
 return null;
}

export function dialogueEligibleForParticipantMemory(turn={}){
 const participantId=short(turn.participantId,96);
 if(!participantId||!short(turn.transcript,600))return false;
 const ownership=short(turn.multiPersonTurnOwnership,48);
 const state=short(turn.multiPersonAttributionState,64);
 const unresolved=Math.max(0,Number(turn.multiPersonUnresolvedCount)||0);
 const partial=turn.multiPersonPartialAttribution===true;
 const association=short(turn.associationState||turn.speakerAssociation,80).toLowerCase();
 const corrected=Array.isArray(turn.multiPersonAttributionCorrections)&&
  turn.multiPersonAttributionCorrections.some(row=>row?.participantId===participantId&&row?.source==='local-owner');
 if(ownership!=='single-speaker'||partial||unresolved>0)return false;
 if(/conflict|unknown|ambiguous|unverified/.test(state)&&!corrected)return false;
 if(/conflict|unknown|ambiguous|unverified/.test(association)&&!corrected)return false;
 return true;
}

function candidateFromExplicitSpeech(text=''){
 const value=short(text,600);
 let match=value.match(/\b(?:i|we)\s+(prefer|like|love|dislike|hate|avoid)\s+(.{2,220}?)(?:[.!?]|$)/i);
 if(match){
  const verb=match[1].toLowerCase(),body=short(match[2],220);
  const prefix=({prefer:'Prefers',like:'Likes',love:'Loves',dislike:'Dislikes',hate:'Dislikes',avoid:'Avoids'})[verb];
  return {type:'preference',text:short(prefix+' '+body,500),method:'explicit-preference-statement'};
 }
 match=value.match(/\bmy\s+favou?rite\s+(.{2,70}?)\s+is\s+(.{2,160}?)(?:[.!?]|$)/i);
 if(match)return {type:'preference',text:short('Favorite '+match[1]+': '+match[2],500),method:'explicit-favorite-statement'};
 match=value.match(/\b(?:please\s+)?remember(?:\s+that)?\s+(.{3,260}?)(?:[.!?]|$)/i);
 if(match)return {type:'note',text:short(match[1],500),method:'explicit-remember-request'};
 return null;
}
function candidateFromOwnerText(text='',{decision=false}={}){
 const value=short(text,600);
 let match=value.match(/^\s*(?:preference|prefers?)\s*:\s*(.{2,260})$/i);
 if(match)return {type:'preference',text:short(match[1],500),method:'owner-labeled-preference'};
 match=value.match(/^\s*(?:remember|memory|note)\s*:\s*(.{2,260})$/i);
 if(match)return {type:'note',text:short(match[1],500),method:'owner-labeled-note'};
 if(decision&&value.length>=3)return {type:'note',text:short('Meeting decision: '+value,500),method:'owner-marked-meeting-decision'};
 return null;
}
function evidenceFingerprint({kind,sourceId,participantId=null,meetingId=null,at=null,text=''}) {
 return hashText([kind,sourceId,participantId||'',meetingId||'',finite(at)?at:'',normalizeWords(text)].join('|'));
}
function proposalSource({kind,sourceId,participantId=null,meetingId=null,at=null,text=''}) {
 if(!SOURCE_KINDS.has(kind)||!short(sourceId,96))return null;
 const excerpt=short(text,300);
 return Object.freeze({
  kind,sourceId:short(sourceId,96),participantId:short(participantId,96)||null,
  meetingId:short(meetingId,96)||null,at:finite(at)?at:null,excerpt,
  fingerprint:evidenceFingerprint({kind,sourceId,participantId,meetingId,at,text:excerpt})
 });
}
function proposalRecord({type='note',text,participantId=null,sourceRefs=[],method,createdAt=Date.now()}={}){
 const clean=short(text,500),refs=(Array.isArray(sourceRefs)?sourceRefs:[]).filter(Boolean).slice(0,MAX_PROPOSAL_SOURCE_REFS);
 if(!clean||!refs.length||!MEMORY_TYPES.includes(type)||type==='relationship')return null;
 const sensitiveReason=sensitiveMemoryReason(clean);
 if(sensitiveReason)return null;
 const scope=short(participantId,96)||null;
 const key=[type,scope||'room',normalizeWords(clean),...refs.map(r=>r.fingerprint)].join('|');
 return Object.freeze({
  schema:MEMORY_PROPOSAL_SCHEMA,id:'proposal-'+hashText(key),type,participantId:scope,text:clean,
  status:'pending',createdAt:finite(createdAt)?createdAt:Date.now(),
  method:short(method,64)||'canonical-evidence',
  sourceRefs:Object.freeze(refs),sensitiveReason:null
 });
}
function turnsById(turns=[]){return new Map((Array.isArray(turns)?turns:[]).filter(x=>x?.id).map(x=>[String(x.id),x]));}

export function canonicalMemoryEvidence({dialogueTurns=[],roomEvents=[],meetings=[]}={}){
 const rows=[],turnMap=turnsById(dialogueTurns);
 for(const turn of Array.isArray(dialogueTurns)?dialogueTurns:[]){
  if(!dialogueEligibleForParticipantMemory(turn))continue;
  const candidate=candidateFromExplicitSpeech(turn.transcript);if(!candidate)continue;
  if(sensitiveMemoryReason(turn.transcript)||sensitiveMemoryReason(candidate.text))continue;
  const at=Date.parse(turn.createdAt||'')||Number(turn.at)||0;
  const source=proposalSource({kind:'dialogue',sourceId:turn.id,participantId:turn.participantId,at,text:turn.transcript});
  const proposal=proposalRecord({...candidate,participantId:turn.participantId,sourceRefs:[source],
   method:candidate.method,createdAt:at||Date.now()});
  if(proposal)rows.push(proposal);
 }
 for(const event of Array.isArray(roomEvents)?roomEvents:[]){
  if(event?.kind!=='decision'||!/^owner[-_]/i.test(String(event.source||'')))continue;
  const candidate=candidateFromOwnerText(event.message);if(!candidate)continue;
  if(sensitiveMemoryReason(event.message)||sensitiveMemoryReason(candidate.text))continue;
  const source=proposalSource({kind:'room-event',sourceId:event.id,participantId:event.participantId,
   at:Number(event.at)||0,text:event.message});
  const proposal=proposalRecord({...candidate,participantId:event.participantId||null,sourceRefs:[source],
   method:'owner-room-decision',createdAt:Number(event.at)||Date.now()});
  if(proposal)rows.push(proposal);
 }
 for(const meeting of Array.isArray(meetings)?meetings:[]){
  for(const note of Array.isArray(meeting?.notes)?meeting.notes:[]){
   const candidate=candidateFromOwnerText(note.text);if(!candidate)continue;
   if(sensitiveMemoryReason(note.text)||sensitiveMemoryReason(candidate.text))continue;
   const source=proposalSource({kind:'meeting-note',sourceId:note.id,meetingId:meeting.id,at:note.at,text:note.text});
   const proposal=proposalRecord({...candidate,participantId:null,sourceRefs:[source],
    method:'owner-meeting-note',createdAt:note.at||meeting.startedAt||Date.now()});
   if(proposal)rows.push(proposal);
  }
  for(const decision of Array.isArray(meeting?.decisions)?meeting.decisions:[]){
   const note=short(decision.note,500);if(!note)continue;
   const candidate=candidateFromOwnerText(note,{decision:true});if(!candidate)continue;
   if(sensitiveMemoryReason(note)||sensitiveMemoryReason(candidate.text))continue;
   const refs=[proposalSource({kind:'meeting-decision',sourceId:decision.id,meetingId:meeting.id,
    at:decision.at,text:note})];
   const turn=turnMap.get(String(decision.sourceTurnId||''));
   let participantId=null;
   if(turn&&dialogueEligibleForParticipantMemory(turn)){
    participantId=turn.participantId;
    refs.push(proposalSource({kind:'dialogue',sourceId:turn.id,participantId:turn.participantId,
     meetingId:meeting.id,at:Date.parse(turn.createdAt||'')||Number(turn.at)||0,text:turn.transcript}));
   }
   const proposal=proposalRecord({...candidate,participantId,sourceRefs:refs,
    method:'owner-marked-meeting-decision',createdAt:decision.at||meeting.startedAt||Date.now()});
   if(proposal)rows.push(proposal);
  }
 }
 const unique=new Map();
 for(const row of rows)if(!unique.has(row.id))unique.set(row.id,row);
 return Object.freeze([...unique.values()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,MAX_MEMORY_PROPOSALS));
}

function evidenceIndex({dialogueTurns=[],roomEvents=[],meetings=[]}={}){
 const map=new Map();
 for(const turn of Array.isArray(dialogueTurns)?dialogueTurns:[]){
  const at=Date.parse(turn.createdAt||'')||Number(turn.at)||0;
  const ref=proposalSource({kind:'dialogue',sourceId:turn.id,participantId:turn.participantId,at,text:turn.transcript});
  if(ref)map.set('dialogue:'+ref.sourceId,ref);
 }
 for(const event of Array.isArray(roomEvents)?roomEvents:[]){
  const ref=proposalSource({kind:'room-event',sourceId:event.id,participantId:event.participantId,
   at:Number(event.at)||0,text:event.message});if(ref)map.set('room-event:'+ref.sourceId,ref);
 }
 for(const meeting of Array.isArray(meetings)?meetings:[]){
  for(const note of Array.isArray(meeting?.notes)?meeting.notes:[]){
   const ref=proposalSource({kind:'meeting-note',sourceId:note.id,meetingId:meeting.id,at:note.at,text:note.text});
   if(ref)map.set('meeting-note:'+ref.sourceId,ref);
  }
  for(const decision of Array.isArray(meeting?.decisions)?meeting.decisions:[]){
   const ref=proposalSource({kind:'meeting-decision',sourceId:decision.id,meetingId:meeting.id,
    at:decision.at,text:decision.note||''});if(ref)map.set('meeting-decision:'+ref.sourceId,ref);
  }
 }
 return map;
}
export function validateMemoryProposalSources(proposal,evidence={}){
 if(!proposal||proposal.schema!==MEMORY_PROPOSAL_SCHEMA||!proposal.sourceRefs?.length)
  return Object.freeze({valid:false,reason:'proposal-source-missing'});
 const index=evidenceIndex(evidence);
 for(const ref of proposal.sourceRefs){
  const current=index.get(ref.kind+':'+ref.sourceId);
  if(!current)return Object.freeze({valid:false,reason:'proposal-source-deleted',sourceId:ref.sourceId});
  if(current.fingerprint!==ref.fingerprint)
   return Object.freeze({valid:false,reason:'proposal-source-changed',sourceId:ref.sourceId});
  if(ref.kind==='dialogue'&&proposal.participantId){
   const turn=(evidence.dialogueTurns||[]).find(row=>String(row?.id)===ref.sourceId);
   if(!turn||turn.participantId!==proposal.participantId||!dialogueEligibleForParticipantMemory(turn))
    return Object.freeze({valid:false,reason:'proposal-speaker-no-longer-eligible',sourceId:ref.sourceId});
  }
 }
 return Object.freeze({valid:true,reason:null});
}

export function reviewMemoryProposal(proposal,memories=[]){
 const duplicateIds=[],contradictionIds=[],relatedIds=[];
 const pText=comparableText(proposal?.text||''),pPolarity=polarity(proposal?.text||'');
 for(const raw of Array.isArray(memories)?memories:[]){
  let memory;try{memory=normalizeMemoryRecord(raw);}catch{continue;}
  if(memory.status!=='active'||memory.participantId!==(proposal?.participantId||null))continue;
  const exact=normalizeWords(memory.text)===normalizeWords(proposal.text);
  const score=similarity(pText,comparableText(memory.text));
  if(exact||score>=.82){
   if(pPolarity===polarity(memory.text))duplicateIds.push(memory.id);
   else contradictionIds.push(memory.id);
  }else if(score>=.55&&pPolarity!==polarity(memory.text))contradictionIds.push(memory.id);
  else if(score>=.5)relatedIds.push(memory.id);
 }
 return Object.freeze({
  duplicateIds:Object.freeze(duplicateIds),contradictionIds:Object.freeze(contradictionIds),
  relatedIds:Object.freeze(relatedIds),
  state:contradictionIds.length?'contradiction':duplicateIds.length?'duplicate':relatedIds.length?'related':'clear'
 });
}

export function approvedMemoryFromProposal(proposal,{
 text=proposal?.text,type=proposal?.type,participantId=proposal?.participantId,
 expiresAt=null,persistent=true,now=Date.now()
}={}){
 if(!proposal||proposal.schema!==MEMORY_PROPOSAL_SCHEMA||proposal.status!=='pending')
  throw new Error('Pending memory proposal required.');
 const clean=short(text,500);
 if(!clean)throw new Error('Memory text is required.');
 const sensitive=sensitiveMemoryReason(clean);
 if(sensitive)throw new Error('Proposal contains blocked sensitive content: '+sensitive);
 if(type==='relationship'||!MEMORY_TYPES.includes(type))throw new Error('Proposal memory type is not allowed.');
 const refs=proposal.sourceRefs.slice(0,MAX_PROPOSAL_SOURCE_REFS).map(ref=>({
  kind:ref.kind,sourceId:ref.sourceId,meetingId:ref.meetingId,participantId:ref.participantId,
  at:ref.at,fingerprint:ref.fingerprint
 }));
 return normalizeMemoryRecord({
  type,text:clean,participantId:short(participantId,96)||null,expiresAt,persistent,
  provenance:'owner-approved-proposal',sourceRefs:refs,approvedAt:now,
  proposalMethod:proposal.method,createdAt:now,updatedAt:now
 },now);
}

export class MemoryProposalLedger{
 constructor({max=MAX_MEMORY_PROPOSALS}={}){this.max=Math.max(1,Math.min(MAX_MEMORY_PROPOSALS,max));this.rows=[];this.dismissed=new Set();}
 scan(evidence={}){
  const generated=canonicalMemoryEvidence(evidence).filter(row=>!this.dismissed.has(row.id));
  const prior=new Map(this.rows.map(row=>[row.id,row]));
  this.rows=generated.map(row=>prior.get(row.id)||row).slice(0,this.max);
  return this.entries();
 }
 dismiss(id){this.dismissed.add(String(id));this.rows=this.rows.filter(row=>row.id!==id);return true;}
 remove(id){const before=this.rows.length;this.rows=this.rows.filter(row=>row.id!==id);return this.rows.length<before;}
 entries(){return [...this.rows];}
 clear(){this.rows=[];this.dismissed.clear();}
}

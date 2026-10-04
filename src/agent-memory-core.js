// V0.10G controlled memory: durable rows are owner-authored only.
// Canonical dialogue/ROOM events are referenced at retrieval time and never copied here.
export const AGENT_MEMORY_SCHEMA=1;
export const MAX_AGENT_MEMORIES=200;
export const MEMORY_TYPES=Object.freeze(['preference','relationship','note']);
export const MAX_MEMORY_REVISIONS=10;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,n)=>String(v??'').trim().slice(0,n);
const id=()=>globalThis.crypto?.randomUUID?.()||
 'memory-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

export function normalizeMemoryRecord(input={},now=Date.now()){
 const text=short(input.text,500);
 if(!text)throw new Error('Memory text is required.');
 const type=MEMORY_TYPES.includes(input.type)?input.type:'note';
 const participantId=short(input.participantId,96)||null;
 const createdAt=finite(input.createdAt)?input.createdAt:now;
 const expiresAt=finite(input.expiresAt)&&input.expiresAt>createdAt?input.expiresAt:null;
 const status=input.status==='revoked'?'revoked':'active';
 const revisions=(Array.isArray(input.revisions)?input.revisions:[])
  .filter(r=>r&&typeof r.text==='string'&&r.text.trim()&&finite(r.at))
  .slice(-MAX_MEMORY_REVISIONS)
  .map(r=>Object.freeze({text:short(r.text,500),at:r.at}));
 return Object.freeze({
  schema:AGENT_MEMORY_SCHEMA,id:short(input.id,96)||id(),type,participantId,text,
  authority:'owner',provenance:'owner-authored',
  createdAt,updatedAt:finite(input.updatedAt)?input.updatedAt:createdAt,
  expiresAt,status,revokedAt:status==='revoked'&&finite(input.revokedAt)?input.revokedAt:null,
  revokeReason:status==='revoked'?short(input.revokeReason,160):'',
  revisions:Object.freeze(revisions),persistent:input.persistent===true
 });
}
export function memoryExpired(memory,now=Date.now()){
 return Boolean(memory&&finite(memory.expiresAt)&&memory.expiresAt<=now);
}
export function activeMemories(rows,{participantId=null,now=Date.now(),limit=20}={}){
 const pid=short(participantId,96)||null;
 return (Array.isArray(rows)?rows:[])
  .map(row=>{try{return normalizeMemoryRecord(row,now);}catch{return null;}})
  .filter(Boolean)
  .filter(row=>row.status==='active'&&!memoryExpired(row,now))
  .filter(row=>row.participantId===null||(pid&&row.participantId===pid))
  .sort((a,b)=>b.updatedAt-a.updatedAt||b.createdAt-a.createdAt)
  .slice(0,Math.max(1,Math.min(50,limit)));
}
export function reviseMemoryRecord(memory,text,at=Date.now()){
 const current=normalizeMemoryRecord(memory,at),nextText=short(text,500);
 if(!nextText)throw new Error('Memory text is required.');
 if(current.status!=='active')throw new Error('Revoked memory cannot be edited.');
 if(nextText===current.text)return current;
 return normalizeMemoryRecord({...current,text:nextText,updatedAt:at,
  revisions:[...current.revisions,{text:current.text,at}]},at);
}
export function revokeMemoryRecord(memory,reason='',at=Date.now()){
 const current=normalizeMemoryRecord(memory,at);
 if(current.status==='revoked')return current;
 return normalizeMemoryRecord({...current,status:'revoked',revokedAt:at,
  revokeReason:short(reason,160)||'Owner revoked memory',updatedAt:at},at);
}
export function memoryContextLines(rows,{participantId=null,now=Date.now(),limit=8}={}){
 return activeMemories(rows,{participantId,now,limit}).map(row=>
  'Historical owner memory ['+row.type+']: '+row.text);
}
export function sessionContextReferences({dialogueTurns=[],roomEvents=[],participantId=null,limit=8}={}){
 const pid=short(participantId,96)||null,refs=[];
 for(const turn of Array.isArray(dialogueTurns)?dialogueTurns:[]){
  if(!String(turn?.transcript||'').trim())continue;
  if(pid&&turn.participantId!==pid)continue;
  const at=Date.parse(turn.createdAt||'')||Number(turn.at)||0;
  refs.push(Object.freeze({kind:'dialogue',sourceId:String(turn.id||''),at,
   label:'Current session transcript',text:short(turn.transcript,300),
   participantId:turn.participantId||null,temporal:'current-session'}));
 }
 for(const event of Array.isArray(roomEvents)?roomEvents:[]){
  if(!String(event?.message||'').trim())continue;
  if(pid&&event.participantId&&event.participantId!==pid)continue;
  refs.push(Object.freeze({kind:'room-event',sourceId:String(event.id||''),at:Number(event.at)||0,
   label:'Current session ROOM event',text:short(event.message,300),
   participantId:event.participantId||null,temporal:'current-session'}));
 }
 return refs.sort((a,b)=>b.at-a.at).slice(0,Math.max(1,Math.min(30,limit)));
}
export class AgentMemoryLedger{
 constructor({max=MAX_AGENT_MEMORIES}={}){this.max=Math.max(1,Math.min(MAX_AGENT_MEMORIES,max));this.rows=[];}
 restore(rows=[]){
  this.rows=[];
  for(const row of Array.isArray(rows)?rows:[]){
   try{
    const memory=normalizeMemoryRecord({...row,persistent:true});
    if(this.rows.some(x=>x.id===memory.id))continue;
    this.rows.push(memory);
   }catch{}
  }
  this.rows=this.rows.sort((a,b)=>a.createdAt-b.createdAt).slice(-this.max);
  return this.entries();
 }
 add(input,now=Date.now()){
  const memory=normalizeMemoryRecord(input,now);
  this.rows=[...this.rows,memory].slice(-this.max);return memory;
 }
 replace(memory){
  const next=normalizeMemoryRecord(memory),i=this.rows.findIndex(x=>x.id===next.id);
  if(i<0)return null;
  this.rows=[...this.rows.slice(0,i),next,...this.rows.slice(i+1)];return next;
 }
 revise(id,text,at=Date.now()){
  const current=this.rows.find(x=>x.id===id);if(!current)return null;
  return this.replace(reviseMemoryRecord(current,text,at));
 }
 revoke(id,reason='',at=Date.now()){
  const current=this.rows.find(x=>x.id===id);if(!current)return null;
  return this.replace(revokeMemoryRecord(current,reason,at));
 }
 delete(id){const before=this.rows.length;this.rows=this.rows.filter(x=>x.id!==id);return this.rows.length<before;}
 purgeParticipant(participantId){
  const before=this.rows.length;this.rows=this.rows.filter(x=>x.participantId!==participantId);
  return before-this.rows.length;
 }
 entries(){return [...this.rows];}
 contextFor(participantId,now=Date.now()){return memoryContextLines(this.rows,{participantId,now});}
}

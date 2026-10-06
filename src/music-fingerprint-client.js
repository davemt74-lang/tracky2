const SESSION='./server/session.php';
const FINGERPRINT_API='./server/music-fingerprint-api.php';
const clamp=v=>Math.max(-1,Math.min(1,Number(v)||0));

async function json(response,message){
 let data={};try{data=await response.json();}catch{}
 if(!response.ok)throw Object.assign(
  new Error(String(data?.error||message||('HTTP '+response.status)).slice(0,260)),
  {status:response.status}
 );
 return data;
}
function resampleMono(samples,inputRate,targetRate=16000){
 const source=samples instanceof Float32Array?samples:Float32Array.from(samples||[]);
 if(!source.length)throw new TypeError('PCM samples required.');
 const from=Math.max(8000,Math.min(96000,Math.round(Number(inputRate)||16000)));
 const to=Math.max(8000,Math.min(48000,Math.round(Number(targetRate)||16000)));
 if(from===to)return source;
 const length=Math.max(1,Math.round(source.length*to/from));
 const output=new Float32Array(length);
 const ratio=from/to;
 for(let i=0;i<length;i++){
  const position=i*ratio;
  const left=Math.min(source.length-1,Math.floor(position));
  const right=Math.min(source.length-1,left+1);
  const mix=position-left;
  output[i]=source[left]*(1-mix)+source[right]*mix;
 }
 return output;
}
export function encodePcm16Wav(samples,sampleRate=16000){
 const rate=16000;
 const input=resampleMono(samples,sampleRate,rate);
 const bytes=new Uint8Array(44+input.length*2);
 const view=new DataView(bytes.buffer);
 const text=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,36+input.length*2,true);text(8,'WAVE');
 text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
 view.setUint16(22,1,true);view.setUint32(24,rate,true);
 view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 text(36,'data');view.setUint32(40,input.length*2,true);
 for(let i=0;i<input.length;i++){
  const value=clamp(input[i]);
  view.setInt16(44+i*2,value<0?Math.round(value*32768):Math.round(value*32767),true);
 }
 return bytes;
}
async function sessionForProvider(fetcher,signal){
 const response=await fetcher(SESSION,{
  credentials:'same-origin',headers:{Accept:'application/json'},signal
 });
 const session=await json(response,'Authenticated server session required.');
 if(!session?.csrf||!Array.isArray(session.permissions)||
    !session.permissions.includes('providers.use'))
  throw new Error('Provider use permission required.');
 return session;
}
export async function recognizeMusicWithAcrCloud({
 samples=null,sampleRate=16000,fingerprint=null,durationMs=0,evidenceId='',
 ownerEnabled=false,fetcher=fetch,signal
}={}){
 if(ownerEnabled!==true)throw new Error('Exact music recognition is not enabled.');
 const hasFingerprint=fingerprint instanceof Uint8Array&&fingerprint.length>0;
 const payload=hasFingerprint?fingerprint:encodePcm16Wav(samples,sampleRate);
 if(payload.byteLength>768000)throw new RangeError('Music recognition sample exceeds Tracky2 limit.');
 const session=await sessionForProvider(fetcher,signal);
 const params=new URLSearchParams({
  provider:'acrcloud',ownerEnabled:'1',
  dataType:hasFingerprint?'fingerprint':'audio',
  durationMs:String(Math.max(0,Math.round(Number(durationMs)||0))),
  evidenceId:String(evidenceId||'').slice(0,96)
 });
 const response=await fetcher(FINGERPRINT_API+'?'+params.toString(),{
  method:'POST',credentials:'same-origin',signal,
  headers:{
   'Content-Type':hasFingerprint?'application/octet-stream':'audio/wav',
   'Accept':'application/json','X-CSRF-Token':session.csrf
  },
  body:payload
 });
 const data=await json(response,'ACRCloud music recognition failed.');
 if(data?.found!==true||!data?.candidate)return null;
 const candidate=data.candidate;
 return Object.freeze({
  title:String(candidate.title||'').replace(/\s+/g,' ').trim().slice(0,120),
  artist:String(candidate.artist||'').replace(/\s+/g,' ').trim().slice(0,120),
  album:String(candidate.album||'').replace(/\s+/g,' ').trim().slice(0,120)||null,
  confidence:Math.max(0,Math.min(1,Number(candidate.confidence)||0)),
  provider:'acrcloud',
  externalId:String(candidate.externalId||'').trim().slice(0,160)||null,
  evidenceId:String(candidate.evidenceId||evidenceId||'').slice(0,96),
  sourceUrls:Object.freeze([])
 });
}
export function createAcrCloudMusicProvider({
 ownerEnabled=()=>false,fetcher=fetch
}={}){
 return Object.freeze({
  id:'acrcloud',
  identify:args=>recognizeMusicWithAcrCloud({
   ...args,ownerEnabled:ownerEnabled()===true,fetcher
  })
 });
}

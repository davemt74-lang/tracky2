// V0.16.0H final installed-device certification gate.
// Combines representative-device hardware evidence, live scenario evidence,
// long-session/runtime evidence, and unified autonomy evidence into one release verdict.
const text=(v,n=240)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const arr=v=>Array.isArray(v)?v:[];
export const FINAL_CERT_SCHEMA=1;
export const FINAL_CERT_VERSION='0.16.0';

export function evaluateFinalInstalledDeviceCertification({
 hardwareSummary=null,liveSummary=null,autonomy=null,longSession=null,releaseVersion=FINAL_CERT_VERSION
}={}){
 const hardwareStatus=text(hardwareSummary?.status,32)||'not-run';
 const liveStatus=text(liveSummary?.status,32)||'incomplete';
 const autonomyStatus=text(autonomy?.status,32)||'failed';
 const longSessionStatus=text(longSession?.status,32)||'failed';
 const blockers=[];
 if(hardwareStatus!=='pass')blockers.push('hardware:'+hardwareStatus);
 if(liveStatus!=='certified')blockers.push('live:'+liveStatus);
 if(autonomyStatus!=='certified')blockers.push(...arr(autonomy?.failed).map(x=>'autonomy:'+text(x,96)));
 if(longSessionStatus!=='certified')blockers.push(...arr(longSession?.failed).map(x=>'long-session:'+text(x,96)));
 const requiredNotRun=[
  ...arr(hardwareSummary?.notRun).map(x=>'hardware:'+text(x,96)),
  ...arr(liveSummary?.scenarios).filter(x=>x?.outcome==='not-run').map(x=>'live:'+text(x.id,96))
 ];
 const failures=[
  ...arr(hardwareSummary?.failed).map(x=>'hardware:'+text(x,96)),
  ...arr(liveSummary?.scenarios).filter(x=>x?.outcome==='fail').map(x=>'live:'+text(x.id,96))
 ];
 const partial=[
  ...arr(hardwareSummary?.partial).map(x=>'hardware:'+text(x,96)),
  ...arr(liveSummary?.scenarios).filter(x=>x?.outcome==='partial').map(x=>'live:'+text(x.id,96))
 ];
 for(const x of requiredNotRun)if(!blockers.includes(x))blockers.push(x);
 for(const x of failures)if(!blockers.includes(x))blockers.push(x);
 for(const x of partial)if(!blockers.includes(x))blockers.push(x);
 const status=blockers.length?'blocked':'certified';
 return Object.freeze({
  schema:FINAL_CERT_SCHEMA,version:FINAL_CERT_VERSION,releaseVersion:text(releaseVersion,32)||FINAL_CERT_VERSION,
  status,freezeRelease:status==='certified',
  hardwareStatus,liveStatus,autonomyStatus,longSessionStatus,
  blockers:Object.freeze(blockers.slice(0,96)),
  requiredNotRun:Object.freeze(requiredNotRun.slice(0,64)),
  failures:Object.freeze(failures.slice(0,64)),
  partial:Object.freeze(partial.slice(0,64))
 });
}

export function finalCertificationLabel(result={}){
 if(result.status==='certified')return 'V0.16.0 final installed-device certification · PASS · release may be frozen';
 const count=Array.isArray(result.blockers)?result.blockers.length:0;
 return 'V0.16.0 final installed-device certification · BLOCKED · '+count+' gate'+(count===1?'':'s')+' unresolved';
}

export function buildFinalCertificationReport({
 hardwareReport={},liveCertification={},autonomy={},longSession={},releaseVersion=FINAL_CERT_VERSION,notes=''
}={}){
 const final=evaluateFinalInstalledDeviceCertification({
  hardwareSummary:hardwareReport?.summary,liveSummary:liveCertification?.summary,
  autonomy,longSession,releaseVersion
 });
 return Object.freeze({
  schema:'tracky2-final-installed-device-certification-v1',
  schemaVersion:FINAL_CERT_SCHEMA,product:'Tracky2',version:text(releaseVersion,32)||FINAL_CERT_VERSION,
  measuredAt:new Date().toISOString(),
  final,
  hardware:hardwareReport,
  liveCertification,
  autonomy:Object.freeze({
   status:text(autonomy?.status,32)||'failed',
   failed:Object.freeze(arr(autonomy?.failed).map(x=>text(x,96)).slice(0,64))
  }),
  longSession:Object.freeze({
   status:text(longSession?.status,32)||'failed',
   failed:Object.freeze(arr(longSession?.failed).map(x=>text(x,96)).slice(0,64)),
   snapshot:longSession?.snapshot?Object.freeze({...longSession.snapshot}):null
  }),
  notes:text(notes,1200),
  privacy:Object.freeze({
   rawMedia:false,conversationContent:false,biometrics:false,providerPayloads:false,
   scope:'final-installed-device-certification-evidence'
  })
 });
}

function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object'){
  const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;
 }
 return value;
}
export function canonicalFinalCertificationJson(report={}){
 return JSON.stringify(stable(report));
}

// Local-only camera preference; the browser remains the sole camera permission authority.
export const CAMERA_PREFERENCE_KEY='tracky2-camera-autostart-v1';
export const LAST_PARTICIPANT_KEY='tracky2-last-enrolled-participant-v1';

export function cameraAutostartEligible({optIn=false,permission='prompt',supported=true,sessionStopped=false}={}){
 return Boolean(optIn && supported && permission==='granted' && !sessionStopped);
}
export function selectGamePlayer(roster,requestedId='',preferredId=''){
 if(!Array.isArray(roster))return '';
 const valid=roster.filter(p=>p&&typeof p.id==='string'&&p.id&&typeof p.name==='string'&&p.name.trim());
 if(valid.some(p=>p.id===requestedId))return requestedId;
 if(valid.some(p=>p.id===preferredId))return preferredId;
 return valid.length===1?valid[0].id:'';
}
export function loadCameraPreference(store){
 try{return store?.getItem(CAMERA_PREFERENCE_KEY)==='true';}catch{return false;}
}
export function saveCameraPreference(store,enabled){
 try{store?.setItem(CAMERA_PREFERENCE_KEY,enabled?'true':'false');return true;}catch{return false;}
}
export async function cameraPermissionState(permissions){
 if(!permissions||typeof permissions.query!=='function')return 'unsupported';
 try{
  const permission=await permissions.query({name:'camera'});
  return ['granted','denied','prompt'].includes(permission?.state)?permission.state:'unsupported';
 }catch{return 'unsupported';}
}

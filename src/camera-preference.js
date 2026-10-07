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
export function cameraPreferenceState(store){
 try{
  const value=store?.getItem(CAMERA_PREFERENCE_KEY);
  if(value==='true')return 'enabled';
  if(value==='false')return 'disabled';
  return 'unset';
 }catch{return 'unset';}
}
export function cameraStartupAction({preference='unset',permission='unsupported',supported=true,sessionStopped=false}={}){
 if(sessionStopped||preference==='disabled')return 'manual';
 if(!supported)return 'unsupported';
 if(permission==='denied')return 'blocked';
 if(preference==='enabled'&&permission==='granted')return 'start';
 if(preference==='enabled'||preference==='unset')return 'onboard';
 return 'manual';
}
export function loadCameraPreference(store){
 return cameraPreferenceState(store)==='enabled';
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

import {listParticipants} from '../src/participant-store.js';
// Explicit one-way local-to-server migration. No background sync of biometrics.
const load=document.getElementById('loadLocalParticipants');
const area=document.getElementById('migrationArea');
const token=document.querySelector('input[name="csrf"]')?.value||'';
function line(text){const p=document.createElement('p');p.textContent=text;return p;}
load?.addEventListener('click',async()=>{
 area.replaceChildren(line('Reading only this browser’s saved participants…'));
 let profiles;
 try{profiles=await listParticipants();}
 catch(error){area.replaceChildren(line('Cannot access browser profiles: '+error.message));return;}
 area.replaceChildren();
 if(!profiles.length){area.append(line('No profiles in this browser.'));return;}
 area.append(line('Select individual participants to copy. Copying does not delete the local profile. Explicit participant consent is required for face/voice embeddings or saved photographs.'));
 for(const p of profiles){
  const row=document.createElement('section');
  const title=document.createElement('strong');title.textContent=p.name||'Unnamed participant';
  const include=document.createElement('input');include.type='checkbox';include.className='migration-select';
  include.setAttribute('aria-label','Select '+(p.name||p.id));
  const consent=document.createElement('input');consent.type='checkbox';consent.className='migration-consent';
  consent.setAttribute('aria-label','Confirm explicit consent to copy biometric records for '+(p.name||p.id));
  const desc=line('I confirm this participant has agreed to copy their photos, face and voice profiles onto this self-hosted server.');
  row.append(title,line('Copy this profile'),include,desc,consent);
  row.dataset.profileId=p.id;area.append(row);
 }
 const action=document.createElement('button');action.type='button';action.textContent='Copy selected profiles to server';
 const result=line('');result.setAttribute('role','status');
 action.addEventListener('click',async()=>{
  action.disabled=true;let copied=0,failed=0;
  for(const row of area.querySelectorAll('[data-profile-id]')){
   if(!row.querySelector('.migration-select')?.checked)continue;
   const p=profiles.find(item=>item.id===row.dataset.profileId);
   if(!p)continue;
   const approved=Boolean(row.querySelector('.migration-consent')?.checked);
   if(!approved){failed++;continue;}
   try{
    const response=await fetch('./api.php?resource=participants',{
     method:'POST',credentials:'same-origin',
     headers:{'Content-Type':'application/json','X-CSRF-Token':token},
     body:JSON.stringify({id:p.id,name:p.name,profile:p,consent:true})
    });
    if(!response.ok)throw new Error('Server rejected profile ('+response.status+')');
    copied++;
   }catch(error){failed++;console.warn('Profile migration was not completed:',error.message);}
  }
  result.textContent=copied+' saved on server; '+failed+' not copied. Local profiles remain untouched.';
  action.disabled=false;
 });
 area.append(action,result);
});

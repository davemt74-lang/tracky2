// Per-participant display is a RECENT VERIFIED VOICE PROFILE segment only.
// A shared room microphone cannot deliver a continuous isolated waveform.
// Never use raw dB, room VAD, proximity or unverified voice similarity here.
export const VERIFIED_SEGMENT_DISPLAY_MS=2600;
export function roomMeterState({active=false,suppressed=false,track=null,now=0,voiceProfileReady=false}={}){
 const enrolled=Boolean(track?.participantId && voiceProfileReady);
 const age=now-Number(track?.lastVoiceAt);
 const profileAt=Number(track?.lastVoiceProfileMatchAt);
 const profileAge=now-profileAt;
 const recentProfileMatch=Boolean(active&&!suppressed&&enrolled&&
   Number.isFinite(profileAt)&&profileAt>0&&Number.isFinite(profileAge)&&profileAge>=0&&
   profileAge<VERIFIED_SEGMENT_DISPLAY_MS&&track.voiceProfileMatchedSegment===true&&
   Number(track.voiceProfileMatchConfidence)>0&&Number.isFinite(track.voiceLevelDb));
 const recentMatch=Boolean(active&&!suppressed&&enrolled&&
   Number.isFinite(track?.lastVoiceAt)&&track.lastVoiceAt>0 &&
   Number.isFinite(age)&&age>=0&&age<VERIFIED_SEGMENT_DISPLAY_MS &&
   track.verifiedVoiceSegment===true &&
   Number(track.voiceMatchConfidence)>0 && Number.isFinite(track.voiceLevelDb));
 if(!active)return Object.freeze({mode:'off',level:0,text:'MIC OFF',recentMatch:false});
 if(!enrolled)return Object.freeze({mode:'unenrolled',level:0,text:'VOICE PROFILE REQUIRED',recentMatch:false});
 if(suppressed)return Object.freeze({mode:'suppressed',level:0,text:'PAUSED · AGENT SPEAKING',recentMatch:false});
 if(!recentMatch&&!recentProfileMatch)
  return Object.freeze({mode:'waiting',level:0,text:'LISTENING FOR VOICE PROFILE',recentMatch:false});
 const confidence=recentMatch?Number(track.voiceMatchConfidence):Number(track.voiceProfileMatchConfidence);
 const strength=Math.max(0,Math.min(100,Math.round((track.voiceLevelDb+70)*100/62)));
 const fade=Math.min(1,Math.max(0,(VERIFIED_SEGMENT_DISPLAY_MS-age)/900));
 if(recentMatch)return Object.freeze({mode:'verified',level:Math.round(strength*fade),
  text:'VERIFIED VOICE · LAST SEGMENT',recentMatch:true,confidence});
 const profileFade=Math.min(1,Math.max(0,(VERIFIED_SEGMENT_DISPLAY_MS-profileAge)/900));
 return Object.freeze({mode:'profile-match',level:Math.round(strength*profileFade),
  text:'VOICE PROFILE MATCH · '+Math.round(confidence*100)+'%',recentMatch:true,confidence});
}

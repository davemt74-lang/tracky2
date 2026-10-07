// The participant meter is a LIVE microphone input display.
// A saved Voice Profile may help filter room/background audio and associate the
// live signal with a participant, but enrollment is never a prerequisite for
// the meter itself to respond.
export const VERIFIED_SEGMENT_DISPLAY_MS=2600;
export const PARTICIPANT_SIGNAL_GATE_DB=6;

function clamp(value,min=0,max=1){
 return Math.max(min,Math.min(max,Number(value)||0));
}

export function participantSignalLevel(liveDb=-100,noiseFloorDb=-60){
 const signalDb=Number(liveDb)-Number(noiseFloorDb);
 if(!Number.isFinite(signalDb)||signalDb<PARTICIPANT_SIGNAL_GATE_DB)return 0;
 // 6 dB over the current room floor is the opening gate. About 30 dB over
 // the floor is treated as a strong close-mic/user signal.
 return Math.round(clamp((signalDb-PARTICIPANT_SIGNAL_GATE_DB)/24)*100);
}

function legacyVerifiedSegmentState({active=false,suppressed=false,track=null,now=0,voiceProfileReady=false}={}){
 const enrolled=Boolean(track?.participantId&&voiceProfileReady);
 const age=now-Number(track?.lastVoiceAt);
 const profileAt=Number(track?.lastVoiceProfileMatchAt);
 const profileAge=now-profileAt;
 const recentProfileMatch=Boolean(active&&!suppressed&&enrolled&&
   Number.isFinite(profileAt)&&profileAt>0&&Number.isFinite(profileAge)&&profileAge>=0&&
   profileAge<VERIFIED_SEGMENT_DISPLAY_MS&&track.voiceProfileMatchedSegment===true&&
   Number(track.voiceProfileMatchConfidence)>0&&Number.isFinite(track.voiceLevelDb));
 const recentMatch=Boolean(active&&!suppressed&&enrolled&&
   Number.isFinite(track?.lastVoiceAt)&&track.lastVoiceAt>0&&
   Number.isFinite(age)&&age>=0&&age<VERIFIED_SEGMENT_DISPLAY_MS&&
   track.verifiedVoiceSegment===true&&Number(track.voiceMatchConfidence)>0&&
   Number.isFinite(track.voiceLevelDb));
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

export function roomMeterState({
 active=false,suppressed=false,track=null,now=0,voiceProfileReady=false,
 participantId=null,liveDb=null,noiseFloorDb=null,speaking=null,
 liveSpeakerParticipantId=null,liveSpeakerConfidence=0,soleCandidate=false
}={}){
 // Backward-compatible rendering for older callers/tests that supplied only a
 // completed verified segment. The AGENT runtime now uses the live path below.
 if(track&&liveDb==null&&noiseFloorDb==null&&speaking==null&&!liveSpeakerParticipantId){
  return legacyVerifiedSegmentState({active,suppressed,track,now,voiceProfileReady});
 }

 const id=String(participantId||track?.participantId||'');
 if(!active)return Object.freeze({mode:'off',level:0,text:'MIC OFF',recentMatch:false});
 if(suppressed)return Object.freeze({mode:'suppressed',level:0,text:'PAUSED · AGENT SPEAKING',recentMatch:false});
 if(!id)return Object.freeze({mode:'unassigned',level:0,text:'VOICE INPUT · NO PARTICIPANT',recentMatch:false});

 const db=Number.isFinite(Number(liveDb))?Number(liveDb):-100;
 const floor=Number.isFinite(Number(noiseFloorDb))?Number(noiseFloorDb):-60;
 const signalDb=db-floor;
 const liveSpeech=Boolean(speaking)&&signalDb>=PARTICIPANT_SIGNAL_GATE_DB;
 if(!liveSpeech){
  return Object.freeze({
   mode:'quiet',level:0,text:'VOICE INPUT · LISTENING',
   recentMatch:false,signalDb,profileFiltered:false
  });
 }

 const matched=Boolean(liveSpeakerParticipantId&&String(liveSpeakerParticipantId)===id);
 const provisional=Boolean(!liveSpeakerParticipantId&&soleCandidate);
 if(!matched&&!provisional){
  return Object.freeze({
   mode:'background-filtered',level:0,text:'BACKGROUND / OTHER SPEAKER FILTERED',
   recentMatch:false,signalDb,profileFiltered:Boolean(voiceProfileReady)
  });
 }

 const level=participantSignalLevel(db,floor);
 if(matched){
  const confidence=clamp(liveSpeakerConfidence);
  return Object.freeze({
   mode:'speaker',level,
   text:voiceProfileReady
    ?'VOICE INPUT · USER FILTER '+Math.round(confidence*100)+'%'
    :'VOICE INPUT · LIVE',
   recentMatch:true,confidence,signalDb,profileFiltered:Boolean(voiceProfileReady)
  });
 }

 return Object.freeze({
  mode:voiceProfileReady?'filtering':'live',level,
  text:voiceProfileReady?'VOICE INPUT · FILTERING ROOM AUDIO':'VOICE INPUT · LIVE',
  recentMatch:false,signalDb,profileFiltered:false
 });
}

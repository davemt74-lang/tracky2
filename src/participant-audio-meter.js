// Display ONLY the shared room microphone level. One microphone cannot isolate
// a participant's live speech; voice verification arrives after a full segment.
export function roomMeterState({active=false,suppressed=false,db=-100,vad=false,track=null,now=0}={}){
 const level=active&&!suppressed&&Number.isFinite(db)
   ? Math.max(0,Math.min(100,Math.round((db+70)*100/62))) : 0;
 const recentMatch=Boolean(track?.participantId && Number.isFinite(track.lastVoiceAt) &&
   Number(track.lastVoiceAt)>0 && now-Number(track.lastVoiceAt)>=0 &&
   now-Number(track.lastVoiceAt)<2600 && Number(track.voiceMatchConfidence)>0);
 const mode=!active?'off':suppressed?'suppressed':vad?'speech':'quiet';
 const text=mode==='off'?'MIC OFF':mode==='suppressed'?'MIC PAUSED · AGENT SPEAKING':
   mode==='speech'?'ROOM SPEECH · SPEAKER UNVERIFIED':
   recentMatch?'QUIET · RECENT VOICE MATCH':'QUIET · ROOM MIC';
 return Object.freeze({mode,level,text,recentMatch});
}

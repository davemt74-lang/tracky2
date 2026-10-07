// Participant Voice Input is a direct live view of RoomAudioCapture.
// It must never depend on voice-profile enrollment, camera/body identity,
// transcription, diarization, or a completed speech segment.
export function roomMeterState({
 active=false,suppressed=false,db=-100,vad=false,noiseFloorDb=-100
}={}){
 const inputDb=Number.isFinite(Number(db))?Number(db):-100;
 const floorDb=Number.isFinite(Number(noiseFloorDb))?Number(noiseFloorDb):-100;

 // Keep the display responsive to the microphone itself. The capture engine's
 // echoCancellation/noiseSuppression/autoGainControl and adaptive VAD handle
 // room/background suppression before this UI layer.
 const level=active&&!suppressed
   ?Math.max(0,Math.min(100,Math.round((inputDb+70)*100/62)))
   :0;
 const mode=!active?'off':suppressed?'suppressed':vad?'speech':'quiet';
 const text=mode==='off'?'MIC OFF':
   mode==='suppressed'?'MIC PAUSED · AGENT SPEAKING':
   mode==='speech'?'VOICE INPUT · SPEECH':
   'VOICE INPUT · LISTENING';
 return Object.freeze({
  mode,level,text,
  signalDb:inputDb-floorDb
 });
}

// Shared-room acoustic METADATA only. This class never stores PCM/audio,
// performs speaker attribution, infers music/cough/health or records media.
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
export const ROOM_AUDIO_AUDIT_INTERVAL_MS=15000;
export class RoomAmbientAudit{
 constructor({intervalMs=ROOM_AUDIO_AUDIT_INTERVAL_MS}={}){
  this.intervalMs=intervalMs;this.reset();
 }
 reset(){this.startAt=null;this.count=0;this.dbSum=0;this.peakDb=-100;
  this.floorSum=0;this.speechFrames=0;this.quietFrames=0;this.lastObservedAt=null;}
 update(frame,at=Date.now()){
  if(frame?.suppressed || !Number.isFinite(frame?.db) || !Number.isFinite(at))return null;
  // A muted/paused engine is never used to infer room silence.
  if(this.startAt===null)this.startAt=at;
  this.lastObservedAt=at;
  this.count++;
  this.dbSum+=Math.max(-100,Math.min(0,frame.db));
  this.peakDb=Math.max(this.peakDb,frame.db);
  this.floorSum+=Math.max(-100,Math.min(0,finite(frame.noiseFloorDb,-100)));
  if(frame.speaking)this.speechFrames++;else this.quietFrames++;
  if(at-this.startAt<this.intervalMs)return null;
  return this.flush(at);
 }
 flush(at=Date.now()){
  if(!this.count)return null;
  const measuredMs=Math.max(0,finite(this.lastObservedAt,at)-this.startAt);
  const result=Object.freeze({
   at:finite(at,Date.now()),from:this.startAt,durationMs:measuredMs,
   frames:this.count,speechFrames:this.speechFrames,quietFrames:this.quietFrames,
   meanDb:Math.round(this.dbSum/this.count*10)/10,
   peakDb:Math.round(this.peakDb*10)/10,
   noiseFloorDb:Math.round(this.floorSum/this.count*10)/10
  });
  this.reset();return result;
 }
}
export function roomAudioAuditMessage(summary){
 if(!summary)return '';
 return 'Shared room audio: average '+summary.meanDb+' dB, peak '+summary.peakDb+
  ' dB, noise floor '+summary.noiseFloorDb+' dB; voice activity '+
  Math.round(summary.speechFrames/summary.frames*100)+'% of sampled frames';
}

// Opt-in descriptive signal patterns from EXISTING 15-second room acoustic metadata.
// These are amplitude/VAD patterns, NOT an environmental sound-source classifier.
export function describeAcousticPattern(summary){
 if(!summary||!Number.isFinite(summary.frames)||summary.frames<20||
  !Number.isFinite(summary.durationMs)||summary.durationMs<3000||
  ![summary.meanDb,summary.peakDb,summary.noiseFloorDb,
    summary.speechFrames].every(Number.isFinite))return null;
 const speechShare=Math.max(0,Math.min(1,summary.speechFrames/summary.frames));
 const peakSpread=summary.peakDb-summary.meanDb;
 const rise=summary.meanDb-summary.noiseFloorDb;
 let pattern='unclassified',description='Mixed or inconclusive room audio energy';
 if(speechShare>=.6){
  pattern='voice-activity-heavy';
  description='Room voice-activity detector flagged sustained activity; speaker unverified';
 }else if(peakSpread>=16){
  pattern='intermittent-peaks';
  description='Intermittent room-level peaks measured; sound source unknown';
 }else if(rise>=15&&speechShare<.3){
  pattern='elevated-energy';
  description='Sustained elevated room-level energy; sound source unknown';
 }else if(peakSpread<8&&rise<10){
  pattern='low-variation';
  description='Relatively stable, low-variation ambient signal; sound source unknown';
 }
 const confidence=pattern==='unclassified'?null:Math.min(.85,
  .45+Math.min(.2,(summary.frames-20)/500));
 return Object.freeze({pattern,description,confidence,
  at:summary.at,durationMs:summary.durationMs,source:'shared-room-mic-metadata'});
}


export class RoomAcousticPatternTracker{
 constructor({repeatMs=60000}={}){
  this.repeatMs=Math.max(15000,Number(repeatMs)||60000);
  this.last=null;
 }
 reset(){this.last=null;}
 observe(pattern,now=Date.now()){
  if(!pattern)return Object.freeze({emit:false,reason:'no-pattern',pattern:null});
  const same=this.last&&this.last.pattern===pattern.pattern;
  const emit=!same||!this.last||now-this.last.emittedAt>=this.repeatMs;
  if(emit)this.last={pattern:pattern.pattern,emittedAt:now};
  return Object.freeze({emit,reason:emit?(same?'repeat-window':'changed'):'deduplicated',pattern});
 }
}

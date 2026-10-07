// Hardware diagnostics for the AGENT runtime.
// Aggregate camera timing only; no frames, images, transcripts, biometrics, or gameplay markers are retained.
export function createHardwareDiagnostics() {
  let frames=0,firstTime=null,lastTime=null,maxGapMs=0,totalGapMs=0;
  return {
    reset(){
      frames=0;firstTime=null;lastTime=null;maxGapMs=0;totalGapMs=0;
    },
    record(timestamp){
      if(!Number.isFinite(timestamp)||timestamp<0||(lastTime!==null&&timestamp<=lastTime))return false;
      if(firstTime===null)firstTime=timestamp;
      if(lastTime!==null){
        const gap=timestamp-lastTime;
        maxGapMs=Math.max(maxGapMs,gap);
        totalGapMs+=gap;
      }
      lastTime=timestamp;frames+=1;
      return true;
    },
    snapshot(){
      const durationMs=firstTime===null?0:Math.max(0,lastTime-firstTime);
      const measuredFps=durationMs>0?Number(((frames-1)*1000/durationMs).toFixed(1)):0;
      const meanFrameGapMs=frames>1?Number((totalGapMs/(frames-1)).toFixed(1)):0;
      const cameraReadiness=durationMs>=8000&&measuredFps>=15
        ?'camera-performance-observed':'hardware-review-incomplete';
      return Object.freeze({
        frames,durationMs,measuredFps,maxFrameGapMs:Number(maxGapMs.toFixed(1)),
        meanFrameGapMs,cameraReadiness
      });
    }
  };
}

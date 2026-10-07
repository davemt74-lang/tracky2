function diagnosticZoneForY(y,zoneCount=4){
 const value=Math.max(0,Math.min(0.999999,Number(y)||0));
 return Math.min(zoneCount-1,Math.floor(value*zoneCount));
}

// Hardware results retain aggregated counters only; never an input frame, transcript or face.
export function createHardwareDiagnostics() {
  const fresh=()=>({detections:0,stableFrames:0,dropouts:0,rejectedJumps:0,
    confidenceTotal:0,zones:new Set()});
  let colors={green:fresh(),blue:fresh()};
  let frames=0,firstTime=null,lastTime=null;
  return {
    reset() {
      colors={green:fresh(),blue:fresh()};
      frames=0;firstTime=null;lastTime=null;
    },
    record(timestamp,detections,results) {
      if (!Number.isFinite(timestamp) || timestamp<0 ||
          (lastTime!==null && timestamp<=lastTime)) return false;
      if (firstTime===null) firstTime=timestamp;
      lastTime=timestamp;frames+=1;
      for (const color of ['green','blue']) {
        const found=detections?.[color];
        const event=results?.[color];
        const item=colors[color];
        if (found && Number.isFinite(found.confidence) && found.confidence>=0 &&
            found.confidence<=1 && Number.isFinite(found.y)) {
          item.detections+=1;
          item.confidenceTotal+=found.confidence;
        }
        if (event?.type==='lost')item.dropouts+=1;
        if (event?.type==='jump-rejected')item.rejectedJumps+=1;
        if (event?.accepted && Number.isFinite(event.sample?.y) &&
            event.sample.y>=0 && event.sample.y<=1) {
          item.stableFrames+=1;
          item.zones.add(diagnosticZoneForY(event.sample.y,4));
        }
      }
      return true;
    },
    snapshot() {
      const durationMs=firstTime===null?0:Math.max(0,lastTime-firstTime);
      const output={};
      for (const color of ['green','blue']) {
        const item=colors[color];
        output[color]=Object.freeze({
          detections:item.detections,stableFrames:item.stableFrames,
          dropouts:item.dropouts,rejectedJumps:item.rejectedJumps,
          meanConfidence:item.detections?Number((item.confidenceTotal/item.detections).toFixed(3)):0,
          visitedZones:Object.freeze([...item.zones].sort((a,b)=>a-b))
        });
      }
      return Object.freeze({
        frames,durationMs,measuredFps:durationMs>0?Number(((frames-1)*1000/durationMs).toFixed(1)):0,
        colors:Object.freeze(output),
        cameraReadiness:durationMs>=8000 && (frames-1)*1000/durationMs>=15 &&
          output.green.visitedZones.length===4 && output.blue.visitedZones.length===4 ?
          'coverage-and-performance-observed':'hardware-review-incomplete'
      });
    }
  };
}

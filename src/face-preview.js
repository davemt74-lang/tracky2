// Map model-normalized camera coordinates into an object-fit:cover, mirrored preview.
// The reticle itself is NOT mirrored, only its position follows the mirrored video.
export function facePreviewRect(box, {
  videoWidth,videoHeight,displayWidth,displayHeight,mirror=true,fit='cover'
}={}){
  const values=[videoWidth,videoHeight,displayWidth,displayHeight,box?.x,box?.y,box?.width,box?.height];
  if(values.some(v=>!Number.isFinite(v)) || values.slice(0,4).some(v=>v<=0) ||
     box.width<=0 || box.height<=0 || !['cover','contain'].includes(fit))return null;
  const scale=fit==='cover'?Math.max(displayWidth/videoWidth,displayHeight/videoHeight):
    Math.min(displayWidth/videoWidth,displayHeight/videoHeight);
  const offsetX=(displayWidth-videoWidth*scale)/2,offsetY=(displayHeight-videoHeight*scale)/2;
  const x=offsetX+(mirror?1-box.x-box.width:box.x)*videoWidth*scale;
  const y=offsetY+box.y*videoHeight*scale;
  const right=x+box.width*videoWidth*scale,bottom=y+box.height*videoHeight*scale;
  const left=Math.max(0,x),top=Math.max(0,y);
  const width=Math.min(displayWidth,right)-left,height=Math.min(displayHeight,bottom)-top;
  if(width<=0 || height<=0)return null;
  return Object.freeze({left,top,width,height});
}
// Stabilize tiny detector jitter without latching the wrong person or moving the box
// to the old person's position after a real off-axis relocation.
export function smoothPreviewRect(previous,current,alpha=.6){
 if(!current)return null;
 if(!previous)return current;
 if(!Number.isFinite(alpha)||alpha<=0||alpha>1)throw new RangeError('Invalid smoothing factor.');
 const prevCX=previous.left+previous.width/2,prevCY=previous.top+previous.height/2,
   nextCX=current.left+current.width/2,nextCY=current.top+current.height/2;
 if(Math.hypot(nextCX-prevCX,nextCY-prevCY)>Math.max(current.width,current.height)*.8){
   return current;
 }
 return Object.freeze(Object.fromEntries(['left','top','width','height'].map(k=>
   [k,previous[k]+alpha*(current[k]-previous[k])])));
}

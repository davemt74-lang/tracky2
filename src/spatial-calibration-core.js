// V0.11G optional owner-defined floor-plane calibration.
// This module works only with normalized camera coordinates and explicit room dimensions.
// It never opens a camera, stores frames, infers 3-D pose or claims survey-grade distance.

export const FLOOR_CALIBRATION_SCHEMA=1;
export const FLOOR_POINT_KEYS=Object.freeze(['nearLeft','nearRight','farRight','farLeft']);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

function safePoint(input){
 if(!input||typeof input!=='object')return null;
 const x=Number(input.x),y=Number(input.y);
 if(!finite(x)||!finite(y)||x<0||x>1||y<0||y>1)return null;
 return Object.freeze({x,y});
}
function polygonArea(points){
 let sum=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  sum+=a.x*b.y-b.x*a.y;
 }
 return Math.abs(sum)/2;
}
function orientation(a,b,c){
 const value=(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y);
 if(Math.abs(value)<1e-9)return 0;
 return value>0?1:2;
}
function segmentsCross(a,b,c,d){
 const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);
 return o1!==0&&o2!==0&&o3!==0&&o4!==0&&o1!==o2&&o3!==o4;
}
function quadrilateralValid(points){
 if(points.length!==4||polygonArea(points)<.01)return false;
 return !segmentsCross(points[0],points[1],points[2],points[3]) &&
  !segmentsCross(points[1],points[2],points[3],points[0]);
}
function dimensions(input){
 const widthM=Number(input?.widthM),depthM=Number(input?.depthM);
 if(!finite(widthM)||!finite(depthM)||widthM<.5||depthM<.5||widthM>50||depthM>50)return null;
 return {widthM,depthM};
}
function listenerAnchor(input,dims){
 if(!input||typeof input!=='object')return null;
 const xM=Number(input.xM),depthM=Number(input.depthM);
 if(!finite(xM)||!finite(depthM)||xM<0||depthM<0||xM>dims.widthM||depthM>dims.depthM)return null;
 return Object.freeze({xM,depthM});
}

export function normalizeFloorCalibration(input){
 if(!input||typeof input!=='object'||input.mode!=='floor-plane')return null;
 const dims=dimensions(input);if(!dims)return null;
 const points={};
 for(const key of FLOOR_POINT_KEYS){
  const point=safePoint(input.points?.[key]);
  if(!point)return null;
  points[key]=point;
 }
 const ordered=FLOOR_POINT_KEYS.map(key=>points[key]);
 if(!quadrilateralValid(ordered))return null;
 const listener=listenerAnchor(input.listener,dims);
 const updatedAt=finite(input.updatedAt)?input.updatedAt:Date.now();
 return Object.freeze({
  schema:FLOOR_CALIBRATION_SCHEMA,mode:'floor-plane',
  provenance:'owner-defined-floor-plane',units:'meters',
  widthM:dims.widthM,depthM:dims.depthM,
  points:Object.freeze(points),listener,updatedAt
 });
}

function solveLinear(matrix,values){
 const n=values.length;
 const a=matrix.map((row,i)=>[...row,values[i]]);
 for(let col=0;col<n;col++){
  let pivot=col;
  for(let row=col+1;row<n;row++)
   if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
  if(Math.abs(a[pivot][col])<1e-10)return null;
  if(pivot!==col)[a[col],a[pivot]]=[a[pivot],a[col]];
  const div=a[col][col];
  for(let j=col;j<=n;j++)a[col][j]/=div;
  for(let row=0;row<n;row++){
   if(row===col)continue;
   const factor=a[row][col];
   for(let j=col;j<=n;j++)a[row][j]-=factor*a[col][j];
  }
 }
 return a.map(row=>row[n]);
}
export function floorHomography(calibration){
 const c=normalizeFloorCalibration(calibration);if(!c)return null;
 const src=FLOOR_POINT_KEYS.map(key=>c.points[key]);
 const dst=[
  {x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}
 ];
 const matrix=[],values=[];
 for(let i=0;i<4;i++){
  const {x,y}=src[i],u=dst[i].x,v=dst[i].y;
  matrix.push([x,y,1,0,0,0,-u*x,-u*y]);values.push(u);
  matrix.push([0,0,0,x,y,1,-v*x,-v*y]);values.push(v);
 }
 const h=solveLinear(matrix,values);
 return h?Object.freeze([...h,1]):null;
}
export function mapCameraPointToFloor(calibration,point){
 const c=normalizeFloorCalibration(calibration),p=safePoint(point);
 if(!c||!p)return null;
 const h=floorHomography(c);if(!h)return null;
 const denominator=h[6]*p.x+h[7]*p.y+h[8];
 if(!finite(denominator)||Math.abs(denominator)<1e-9)return null;
 const u=(h[0]*p.x+h[1]*p.y+h[2])/denominator;
 const v=(h[3]*p.x+h[4]*p.y+h[5])/denominator;
 if(!finite(u)||!finite(v))return null;
 return Object.freeze({
  normalized:Object.freeze({x:u,depth:v}),
  xM:u*c.widthM,depthM:v*c.depthM
 });
}
export function trackFootpoint(track){
 if(!track||['occluded','reacquiring'].includes(track.status)||!track.box)return null;
 const {x,y,width,height}=track.box;
 if(![x,y,width,height].every(finite)||width<=0||height<=0)return null;
 const point={x:x+width/2,y:y+height};
 if(point.x<0||point.x>1||point.y<0||point.y>.985)return null;
 return Object.freeze(point);
}
export function calibratedTrackPosition(calibration,track){
 const c=normalizeFloorCalibration(calibration);
 if(!c)return Object.freeze({status:'uncalibrated',trackId:track?.id||null});
 const foot=trackFootpoint(track);
 if(!foot)return Object.freeze({
  status:track?.status==='occluded'||track?.status==='reacquiring'?'not-current':'footpoint-unavailable',
  trackId:track?.id||null,provenance:'owner-defined-floor-plane'
 });
 const mapped=mapCameraPointToFloor(c,foot);
 if(!mapped)return Object.freeze({status:'projection-failed',trackId:track?.id||null,
  provenance:'owner-defined-floor-plane'});
 const {x,depth}=mapped.normalized;
 if(x<-.03||x>1.03||depth<-.03||depth>1.03)
  return Object.freeze({status:'outside-calibrated-plane',trackId:track?.id||null,
   provenance:'owner-defined-floor-plane'});
 const normalized=Object.freeze({x:clamp(x,0,1),depth:clamp(depth,0,1)});
 return Object.freeze({
  status:'calibrated-floor',trackId:track?.id||null,
  participantId:track?.participantId||null,
  xM:normalized.x*c.widthM,depthM:normalized.depth*c.depthM,normalized,
  coordinateSpace:'owner-calibrated-floor-plane',
  provenance:'owner-defined-floor-plane',
  precision:'approximate-planar-projection'
 });
}
export function listenerRelation(calibration,position){
 const c=normalizeFloorCalibration(calibration);
 if(!c?.listener||position?.status!=='calibrated-floor')return null;
 const dx=position.xM-c.listener.xM,dz=position.depthM-c.listener.depthM;
 const distanceM=Math.hypot(dx,dz);
 const bearingDeg=Math.atan2(dx,dz)*180/Math.PI;
 const direction=bearingDeg<-15?'left':bearingDeg>15?'right':'ahead';
 return Object.freeze({
  distanceM,bearingDeg,direction,
  provenance:'owner-defined-floor-plane+listener-anchor',
  precision:'approximate-planar-projection'
 });
}
export function calibratedPairDistance(calibration,a,b){
 const pa=calibratedTrackPosition(calibration,a),pb=calibratedTrackPosition(calibration,b);
 if(pa.status!=='calibrated-floor'||pb.status!=='calibrated-floor')return null;
 return Object.freeze({
  distanceM:Math.hypot(pa.xM-pb.xM,pa.depthM-pb.depthM),
  trackIds:Object.freeze([pa.trackId,pb.trackId]),
  provenance:'owner-defined-floor-plane',
  precision:'approximate-planar-projection'
 });
}
export function calibratedReplyVolume(calibration,relation){
 const c=normalizeFloorCalibration(calibration);
 if(!c||!relation||!finite(relation.distanceM))return null;
 const roomDiagonal=Math.max(.5,Math.hypot(c.widthM,c.depthM));
 const proximity=1-clamp(relation.distanceM/roomDiagonal,0,1);
 return Number(clamp(.6+proximity*.33,.6,.93).toFixed(3));
}

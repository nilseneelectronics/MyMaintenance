// Wall/stair contact is measured against the occupied stair polygon, including
// the empty corner of an L stair. Coordinates and thicknesses are centimetres.
const STAIR_OBSTACLE_EPSILON=1e-7;
function stairObstacleCross(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function stairObstacleArea(points){return points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0)/2;}
function stairObstacleDistance(a,b){return Math.hypot(b.x-a.x,b.y-a.y);}
function stairObstaclePoint(point){return point&&Number.isFinite(point.x)&&Number.isFinite(point.y);}
function stairObstacleCleanPolygon(polygon){
  const points=[];
  for(const point of polygon||[]){
    if(!stairObstaclePoint(point))return [];
    if(!points.length||stairObstacleDistance(point,points.at(-1))>STAIR_OBSTACLE_EPSILON)points.push({x:point.x,y:point.y});
  }
  if(points.length>1&&stairObstacleDistance(points[0],points.at(-1))<STAIR_OBSTACLE_EPSILON)points.pop();
  let changed=true;
  while(changed&&points.length>3){
    changed=false;
    for(let i=0;i<points.length;i++)if(Math.abs(stairObstacleCross(points[(i+points.length-1)%points.length],points[i],points[(i+1)%points.length]))<STAIR_OBSTACLE_EPSILON){points.splice(i,1);changed=true;break;}
  }
  return points;
}
function stairObstacleTriangulate(polygon){
  const points=stairObstacleCleanPolygon(polygon),triangles=[];
  if(points.length<3||Math.abs(stairObstacleArea(points))<STAIR_OBSTACLE_EPSILON)return triangles;
  const winding=Math.sign(stairObstacleArea(points)),indices=points.map((_,i)=>i);
  const inside=(point,a,b,c)=>[stairObstacleCross(a,b,point),stairObstacleCross(b,c,point),stairObstacleCross(c,a,point)].every(value=>value*winding>=-STAIR_OBSTACLE_EPSILON);
  while(indices.length>3){
    let found=false;
    for(let i=0;i<indices.length;i++){
      const before=indices[(i+indices.length-1)%indices.length],current=indices[i],after=indices[(i+1)%indices.length];
      const a=points[before],b=points[current],c=points[after];
      if(stairObstacleCross(a,b,c)*winding<=STAIR_OBSTACLE_EPSILON)continue;
      if(indices.some(index=>index!==before&&index!==current&&index!==after&&inside(points[index],a,b,c)))continue;
      triangles.push([a,b,c]);indices.splice(i,1);found=true;break;
    }
    if(!found)return []; // Do not replace a malformed concave polygon by its box.
  }
  triangles.push(indices.map(index=>points[index]));return triangles;
}
function stairObstacleRecords(stairs){
  return (stairs||[]).map(stair=>{
    let polygon=Array.isArray(stair)?stair:stair?.polygon;
    if(!polygon&&typeof floorplanStairPolygon==='function')polygon=floorplanStairPolygon(stair);
    polygon=stairObstacleCleanPolygon(polygon);
    return {stair,polygon,triangles:stairObstacleTriangulate(polygon)};
  }).filter(record=>record.triangles.length);
}
function stairObstacleClip(polygon,signedDistance){
  if(!polygon.length)return [];
  const output=[];
  let previous=polygon.at(-1),before=signedDistance(previous);
  for(const current of polygon){
    const after=signedDistance(current),previousInside=before>=-STAIR_OBSTACLE_EPSILON,currentInside=after>=-STAIR_OBSTACLE_EPSILON;
    if(previousInside!==currentInside){
      const fraction=before/(before-after);
      output.push({x:previous.x+(current.x-previous.x)*fraction,y:previous.y+(current.y-previous.y)*fraction});
    }
    if(currentInside)output.push(current);
    previous=current;before=after;
  }
  return output;
}
function stairObstacleBasis(start,end){
  const length=stairObstacleDistance(start,end);
  if(length<STAIR_OBSTACLE_EPSILON)return null;
  const u={x:(end.x-start.x)/length,y:(end.y-start.y)/length};
  return {length,u,v:{x:-u.y,y:u.x}};
}
function stairObstacleIntervals(start,end,thickness,records){
  const basis=stairObstacleBasis(start,end);if(!basis)return [];
  const half=thickness/2,intervals=[];
  for(const record of records){
    const parts=[];
    for(const triangle of record.triangles){
      let clipped=triangle.map(point=>({x:(point.x-start.x)*basis.u.x+(point.y-start.y)*basis.u.y,
        y:(point.x-start.x)*basis.v.x+(point.y-start.y)*basis.v.y}));
      clipped=stairObstacleClip(clipped,point=>point.y+half);
      clipped=stairObstacleClip(clipped,point=>half-point.y);
      // A line touching the stair face is contact, not overlapping floor area.
      if(clipped.length<3||Math.abs(stairObstacleArea(clipped))<=STAIR_OBSTACLE_EPSILON)continue;
      parts.push({entry:Math.min(...clipped.map(point=>point.x)),exit:Math.max(...clipped.map(point=>point.x)),stair:record.stair});
    }
    parts.sort((a,b)=>a.entry-b.entry);
    const merged=[];
    for(const part of parts){const previous=merged.at(-1);if(previous&&part.entry<=previous.exit+STAIR_OBSTACLE_EPSILON)previous.exit=Math.max(previous.exit,part.exit);else merged.push({...part});}
    intervals.push(...merged);
  }
  return intervals.sort((a,b)=>a.entry-b.entry);
}
function wallIntersectsStairs(start,end,thickness,stairs){
  if(!stairObstaclePoint(start)||!stairObstaclePoint(end)||!Number.isFinite(thickness)||thickness<=0)return false;
  const length=stairObstacleDistance(start,end);
  return stairObstacleIntervals(start,end,thickness,stairObstacleRecords(stairs)).some(interval=>Math.min(length,interval.exit)-Math.max(0,interval.entry)>STAIR_OBSTACLE_EPSILON);
}
function polygonIntersectsStairs(polygon,stairs){
  const triangles=stairObstacleTriangulate(polygon);
  for(const record of stairObstacleRecords(stairs))for(const a of triangles)for(const b of record.triangles){
    const winding=Math.sign(stairObstacleArea(b));let overlap=a;
    for(let i=0;i<3&&overlap.length;i++)overlap=stairObstacleClip(overlap,point=>stairObstacleCross(b[i],b[(i+1)%3],point)*winding);
    if(overlap.length>=3&&Math.abs(stairObstacleArea(overlap))>STAIR_OBSTACLE_EPSILON)return true;
  }
  return false;
}
function stairObstacleEdges(records){
  return records.flatMap(record=>{
    const winding=Math.sign(stairObstacleArea(record.polygon));
    return record.polygon.map((a,index)=>{
      const b=record.polygon[(index+1)%record.polygon.length],length=stairObstacleDistance(a,b);
      const tangent={x:(b.x-a.x)/length,y:(b.y-a.y)/length};
      return {a,b,length,tangent,normal:{x:winding*tangent.y,y:-winding*tangent.x},stair:record.stair,index};
    });
  });
}
function stairObstacleSideCandidates(start,end,thickness,records,tolerance,angleTolerance=Math.sin(Math.PI/90)){
  const basis=stairObstacleBasis(start,end);if(!basis)return [];
  const half=thickness/2,candidates=[];
  for(const edge of stairObstacleEdges(records)){
    if(Math.abs(basis.u.x*edge.tangent.y-basis.u.y*edge.tangent.x)>angleTolerance)continue;
    const along=point=>(point.x-edge.a.x)*edge.tangent.x+(point.y-edge.a.y)*edge.tangent.y;
    const signed=point=>(point.x-edge.a.x)*edge.normal.x+(point.y-edge.a.y)*edge.normal.y;
    const aAlong=along(start),bAlong=along(end);
    if(Math.max(aAlong,bAlong)<-tolerance||Math.min(aAlong,bAlong)>edge.length+tolerance)continue;
    const aShift=half-signed(start),bShift=half-signed(end),distance=Math.max(Math.abs(aShift),Math.abs(bShift));
    if(distance>tolerance+STAIR_OBSTACLE_EPSILON)continue;
    const a={x:start.x+edge.normal.x*aShift,y:start.y+edge.normal.y*aShift};
    let b={x:end.x+edge.normal.x*bShift,y:end.y+edge.normal.y*bShift};
    const endAlong=along(b),corner=Math.abs(endAlong)<Math.abs(endAlong-edge.length)?0:edge.length;
    if(Math.abs(endAlong-corner)<=tolerance)b={x:edge.a.x+edge.tangent.x*corner+edge.normal.x*half,y:edge.a.y+edge.tangent.y*corner+edge.normal.y*half};
    candidates.push({start:a,end:b,point:b,kind:'side',stair:edge.stair,edge:[edge.a,edge.b],distance});
  }
  return candidates.sort((a,b)=>a.distance-b.distance);
}
function getStairWallSnap(point,start,thickness,stairs,tolerance=12){
  if(!stairObstaclePoint(point)||!Number.isFinite(thickness)||thickness<=0||!Number.isFinite(tolerance)||tolerance<0)return null;
  const records=stairObstacleRecords(stairs);if(!records.length)return null;
  if(!start){
    let best=null;
    for(const edge of stairObstacleEdges(records)){
      const half=thickness/2,along=Math.max(0,Math.min(edge.length,(point.x-edge.a.x)*edge.tangent.x+(point.y-edge.a.y)*edge.tangent.y));
      const candidate={x:edge.a.x+edge.tangent.x*along+edge.normal.x*half,y:edge.a.y+edge.tangent.y*along+edge.normal.y*half};
      const distance=stairObstacleDistance(point,candidate);
      if(distance<=tolerance&&(!best||distance<best.distance))best={point:candidate,start:null,end:candidate,kind:'side',stair:edge.stair,edge:[edge.a,edge.b],distance};
    }
    return best;
  }
  if(!stairObstaclePoint(start))return null;
  const basis=stairObstacleBasis(start,point);if(!basis)return null;
  const sides=stairObstacleSideCandidates(start,point,thickness,records,tolerance);
  // A flush side may need its end trimmed at another occupied flight of an L.
  for(const side of sides){
    const fitted=stairObstacleFitLine(side.start,side.end,thickness,records);
    if(!fitted.error&&stairObstacleDistance(point,fitted.end)<=tolerance+side.distance+STAIR_OBSTACLE_EPSILON)
      return {...side,...fitted,point:fitted.end,kind:'side'};
  }
  const intervals=stairObstacleIntervals(start,point,thickness,records);
  for(const interval of intervals){
    if(interval.entry<.1)continue;
    const candidate={x:start.x+basis.u.x*interval.entry,y:start.y+basis.u.y*interval.entry};
    const distance=stairObstacleDistance(point,candidate);
    if(distance<=tolerance)return {point:candidate,start:{...start},end:candidate,kind:'end',stair:interval.stair,edge:null,distance};
  }
  return null;
}
function stairObstacleFitLine(start,end,thickness,records){
  const basis=stairObstacleBasis(start,end);
  if(!basis||basis.length<.1)return {error:'The wall is too short.'};
  const first=stairObstacleIntervals(start,end,thickness,records).find(interval=>Math.min(basis.length,interval.exit)-Math.max(0,interval.entry)>STAIR_OBSTACLE_EPSILON);
  if(!first)return {start:{...start},end:{...end},adjusted:false,kind:'clear'};
  if(first.entry<.1)return {error:'Start the wall outside the stair footprint.'};
  return {start:{...start},end:{x:start.x+basis.u.x*first.entry,y:start.y+basis.u.y*first.entry},adjusted:true,kind:'end',stair:first.stair};
}
function fitWallAgainstStairs(start,end,thickness,stairs,options={}){
  if(!stairObstaclePoint(start)||!stairObstaclePoint(end)||!Number.isFinite(thickness)||thickness<=0)return {error:'Enter a valid wall and thickness.'};
  const records=stairObstacleRecords(stairs),direct=stairObstacleFitLine(start,end,thickness,records);
  if(!direct.error&&!direct.adjusted)return direct;
  if(options.alignSides!==false){
    const tolerance=Number.isFinite(options.maxSideShift)?Math.max(0,options.maxSideShift):thickness/2;
    for(const side of stairObstacleSideCandidates(start,end,thickness,records,tolerance,1e-6)){
      const fitted=stairObstacleFitLine(side.start,side.end,thickness,records);
      if(!fitted.error)return {...fitted,adjusted:true,kind:'side',stair:side.stair};
    }
  }
  return direct;
}

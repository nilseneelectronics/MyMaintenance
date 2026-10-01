const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../script/pages/floorplan-stairs.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../script/pages/floorplan-wall-obstacles.js'),'utf8'),context);
const run=source=>vm.runInContext(source,context);
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.0001,`${actual} != ${expected}`);
run(`
  const box=(x,y,w,h)=>({polygon:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
  const stair=box(0,0,100,300);
  let fitted,snap;
`);
// A wall's inner side sits exactly on the stair edge, including half-centimetre
// offsets. The centreline must not be snapped onto the stair outline.
run('snap=getStairWallSnap({x:1,y:280},{x:1,y:10},15,[stair],12)');
assert.equal(run('snap.kind'),'side');
close(run('snap.start.x'),-7.5);close(run('snap.end.x'),-7.5);
assert.equal(run('wallIntersectsStairs(snap.start,snap.end,15,[stair])'),false);
run('fitted=fitWallAgainstStairs({x:0,y:0},{x:0,y:300},20,[stair])');
assert.equal(run('fitted.kind'),'side');close(run('fitted.start.x'),-10);close(run('fitted.end.x'),-10);
run('fitted=fitWallAgainstStairs({x:100,y:300},{x:100,y:0},15,[stair])');
close(run('fitted.start.x'),107.5);close(run('fitted.end.x'),107.5);
run('snap=getStairWallSnap({x:1,y:150},null,20,[stair],12)');
close(run('snap.point.x'),-10);close(run('snap.point.y'),150);
// A connected start can prohibit any sideways translation.
assert.equal(run('Boolean(fitWallAgainstStairs({x:0,y:0},{x:0,y:300},20,[stair],{alignSides:false}).error)'),true);
// Perpendicular approaches stop on the face; diagonal approaches account for
// the whole wall thickness, not only a clear centreline.
run('fitted=fitWallAgainstStairs({x:-100,y:150},{x:120,y:150},20,[stair])');
close(run('fitted.start.x'),-100);close(run('fitted.end.x'),0);close(run('fitted.end.y'),150);
assert.equal(run('fitted.kind'),'end');assert.equal(run('wallIntersectsStairs(fitted.start,fitted.end,20,[stair])'),false);
run('fitted=fitWallAgainstStairs({x:-100,y:50},{x:50,y:200},20,[stair])');
close(run('fitted.end.x'),-Math.sqrt(50));close(run('fitted.end.y'),150-Math.sqrt(50));
assert.equal(run('wallIntersectsStairs(fitted.start,fitted.end,20,[stair])'),false);
run('snap=getStairWallSnap({x:-4,y:150},{x:-100,y:150},20,[stair],8)');
assert.equal(run('snap.kind'),'end');close(run('snap.end.x'),0);
assert.equal(run('Boolean(fitWallAgainstStairs({x:50,y:100},{x:200,y:100},20,[stair]).error)'),true);
assert.equal(run('Boolean(fitWallAgainstStairs({x:0,y:0},{x:0,y:0},20,[stair]).error)'),true);
// Swept-thickness detection catches side overlap while allowing exact contact.
assert.equal(run('wallIntersectsStairs({x:-5,y:50},{x:-5,y:250},20,[stair])'),true);
assert.equal(run('wallIntersectsStairs({x:-10,y:50},{x:-10,y:250},20,[stair])'),false);
// The first stair along the drawing direction is the stopping point even when
// the list is in reverse order or the requested wall continues through both.
run('fitted=fitWallAgainstStairs({x:-100,y:150},{x:400,y:150},20,[box(200,0,100,300),stair])');
close(run('fitted.end.x'),0);
run('fitted=fitWallAgainstStairs({x:400,y:150},{x:-100,y:150},20,[stair,box(200,0,100,300)])');
close(run('fitted.end.x'),300);
// Concave quarter-turn stairs must leave their empty corner usable. A diagonal
// strip can meet both flights with a gap between; triangulation preserves it.
run(`const elbow={polygon:[{x:0,y:0},{x:300,y:0},{x:300,y:90},{x:90,y:90},{x:90,y:300},{x:0,y:300}]};`);
assert.equal(run('wallIntersectsStairs({x:120,y:120},{x:280,y:120},20,[elbow])'),false);
assert.equal(run('wallIntersectsStairs({x:130,y:170},{x:170,y:130},10,[elbow])'),false);
run('fitted=fitWallAgainstStairs({x:130,y:170},{x:170,y:130},10,[elbow])');
assert.equal(run('fitted.adjusted'),false);
run('fitted=fitWallAgainstStairs({x:90,y:100},{x:90,y:280},20,[elbow])');
close(run('fitted.start.x'),100);close(run('fitted.end.x'),100);
assert.equal(run('wallIntersectsStairs(fitted.start,fitted.end,20,[elbow])'),false);
run('fitted=fitWallAgainstStairs({x:150,y:150},{x:150,y:0},20,[elbow])');
close(run('fitted.end.y'),90);
// Actual rendered wall polygons (including mitres) can be checked separately.
assert.equal(run('polygonIntersectsStairs(box(130,130,50,30).polygon,[elbow])'),false);
assert.equal(run('polygonIntersectsStairs(box(80,130,50,30).polygon,[elbow])'),true);
assert.equal(run('polygonIntersectsStairs(box(90,130,50,30).polygon,[elbow])'),false);
// Winding and arbitrary rotation must not change the physical result.
run(`const turn=(point)=>{const angle=.61;return {x:400+point.x*Math.cos(angle)-point.y*Math.sin(angle),y:-200+point.x*Math.sin(angle)+point.y*Math.cos(angle)}};
  const rotated={polygon:stair.polygon.map(turn).reverse()};
  fitted=fitWallAgainstStairs(turn({x:0,y:0}),turn({x:0,y:300}),20,[rotated]);
  const expectedStart=turn({x:-10,y:0}),expectedEnd=turn({x:-10,y:300});`);
close(run('fitted.start.x'),run('expectedStart.x'));close(run('fitted.start.y'),run('expectedStart.y'));
close(run('fitted.end.x'),run('expectedEnd.x'));close(run('fitted.end.y'),run('expectedEnd.y'));
assert.equal(run('wallIntersectsStairs(fitted.start,fitted.end,20,[rotated])'),false);
// Production stair objects use their current L shape and transform, not a box.
run(`const actual={left:200,top:300,angle:37,data:{kind:'stair',width:300,length:300,stairType:'quarter',direction:'reverse'}};
  const sourcePolygon=floorplanStairPolygon(actual);
  const obstaclePolygon=stairObstacleRecords([actual])[0].polygon;`);
assert.equal(run('obstaclePolygon.length'),6);
assert.equal(run('JSON.stringify(sourcePolygon)===JSON.stringify(obstaclePolygon)'),true);
assert.equal(run('stairObstacleTriangulate(sourcePolygon).length'),4);
close(run('stairObstacleTriangulate(sourcePolygon).reduce((sum,triangle)=>sum+Math.abs(stairObstacleArea(triangle)),0)'),run('Math.abs(stairObstacleArea(sourcePolygon))'));
console.log('Wall/stair obstacles: exact side offsets, full-thickness end contact, connected-start protection, first-hit trim, concave clearance, actual polygons, winding and rotated stairs passed.');

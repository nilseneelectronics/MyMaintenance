const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const objects = [];
let checkpoints=0;
const snapshots=[];
const ctx=vm.createContext({console,Math,Date,snapEnabled:true,isDirty:false,getSnapInterval:()=>10,
  wallCheckpoint:()=>{checkpoints++;snapshots.push(JSON.stringify(objects));},syncSaveButton(){},setTool(){},
  canvas:{getObjects:()=>objects,add:o=>objects.push(o),requestRenderAll(){},setActiveObject(){}},
  fabric:{Rect:function(options){Object.assign(this,options);this.set=values=>Object.assign(this,values);this.setCoords=()=>{};this.getBoundingRect=()=>({left:this.left-this.width/2,top:this.top-this.height/2,width:this.width,height:this.height});}}
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../script/pages/floorplan-stairs.js'),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
assert.deepEqual(JSON.parse(run('JSON.stringify(stairRectangle({x:400,y:300},{x:100,y:200}))')),{left:250,top:250,width:100,length:300,angle:90});
run('stairDraft={start:{x:0,y:0},end:{x:100,y:300}};commitFloorplanStair(stairDraft.end)');
assert.equal(objects.length,1);assert.equal(objects[0].data.kind,'stair');
assert.equal(objects[0].data.width,100);assert.equal(objects[0].data.length,300);
run('stairDraft={start:{x:100,y:0},end:{x:400,y:100}};commitFloorplanStair(stairDraft.end)');
assert.equal(objects[1].data.routeId,objects[0].data.routeId);
assert.equal(objects[1].data.direction,'forward');
assert.equal(objects[1].angle,90);
assert.equal(run('updateFloorplanStair(canvas.getObjects()[0],{stairType:"half",direction:"reverse",width:150})'),true);
assert.equal(objects[0].data.stairType,'half');assert.equal(objects[0].data.direction,'reverse');
const before=checkpoints;
assert.equal(run('updateFloorplanStair(canvas.getObjects()[0],{width:0})'),false);
assert.equal(checkpoints,before);
const calls=[];const draw={save(){},restore(){},rotate(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){calls.push(1);},closePath(){},fill(){},stroke(){}};
ctx.draw=draw;
for(const type of ['straight','quarter','half'])run(`renderStairSymbol(draw,{width:120,length:300,stairType:'${type}',direction:'forward'})`);
assert.ok(calls.length>20);
const centre={left:objects[0].left,top:objects[0].top};
assert.equal(run('updateFloorplanStair(canvas.getObjects()[0],{angle:-22.5})'),true);
assert.equal(objects[0].angle,337.5);
assert.deepEqual({left:objects[0].left,top:objects[0].top},centre);
assert.equal(JSON.parse(snapshots.at(-1))[0].angle,0);
const rotationCheckpoint=checkpoints;
assert.equal(run('updateFloorplanStair(canvas.getObjects()[0],{angle:NaN})'),false);
assert.equal(checkpoints,rotationCheckpoint);
// The Fabric angle is part of the serialized object. Reinstalling the custom
// renderer must preserve it and expose only the rotation control.
ctx.savedStair=JSON.stringify(objects[0]);
run('const reloaded=new fabric.Rect(JSON.parse(savedStair));let controls;reloaded.setControlsVisibility=values=>controls=values;installFloorplanStair(reloaded)');
assert.equal(run('reloaded.angle'),337.5);
assert.equal(run('reloaded.data.stairType'),'half');
assert.equal(run('reloaded.lockRotation'),false);
assert.equal(run('controls.mtr'),true);
assert.equal(run('controls.br'),false);
assert.equal(run('reloaded._toSVG().join("").includes("rotate(180)")'),true);
assert.equal(run('reloaded._toSVG().join("").includes("<path")'),true);
const handlers={};ctx.handlers=handlers;
run('canvas.on=(event,handler)=>handlers[event]=handler;setupFloorplanStairs();');
handlers['before:transform']({transform:{target:objects[0],action:'rotate'}});
objects[0].angle=58;
assert.equal(JSON.parse(snapshots.at(-1))[0].angle,337.5);
assert.equal(checkpoints,rotationCheckpoint+1);
// Use the real wall-face geometry: stairs must start at the visible inner corner,
// including half-centimetre offsets and unequal wall thicknesses, not at (0,0).
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../script/pages/floorplan-dimensions.js'),'utf8'),ctx);
run(`
  const stairWall=(id,ax,ay,bx,by,thickness=25)=>({wall:id,points:[{x:ax,y:ay},{x:bx,y:by}],thickness});
  let stairWalls=[stairWall('top',0,0,500,0),stairWall('right',500,0,500,500),stairWall('bottom',500,500,0,500),stairWall('left',0,500,0,0)];
`);
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.001,`${actual} != ${expected}`);
run('let stairCorner=stairSnapPoint({x:14,y:14},stairWalls,1)');
close(run('stairCorner.x'),12.5);close(run('stairCorner.y'),12.5);
// Clicking the centreline joint of a thick wall still chooses the room-facing
// corner. The resulting footprint begins there and extends into the room.
run('stairCorner=stairSnapPoint({x:0,y:0},stairWalls,1);let cornerFootprint=stairRectangle(stairCorner,{x:110,y:310})');
close(run('stairCorner.x'),12.5);close(run('stairCorner.y'),12.5);
close(run('cornerFootprint.left-cornerFootprint.width/2'),12.5);
close(run('cornerFootprint.top-cornerFootprint.length/2'),12.5);
run('let outsideCorner=stairSnapPoint({x:-14,y:-14},stairWalls,1)');
close(run('outsideCorner.x'),-12.5);close(run('outsideCorner.y'),-12.5);
// A face click keeps its exact wall offset while the along-wall coordinate snaps.
run('let faceSnap=stairSnapPoint({x:153,y:14},stairWalls,1)');
close(run('faceSnap.x'),150);close(run('faceSnap.y'),12.5);
// Zooming in makes nearby free-space grid points reachable instead of extending
// the wall's snap radius by a fixed number of centimetres.
run('let fineSnap=stairSnapPoint({x:17,y:17},stairWalls,10)');
close(run('fineSnap.x'),20);close(run('fineSnap.y'),20);
run('stairWalls[0].thickness=20;stairWalls[3].thickness=40;stairCorner=stairSnapPoint({x:21,y:11},stairWalls,1)');
close(run('stairCorner.x'),20);close(run('stairCorner.y'),10);
// Diagonal faces retain their true normal offset after along-face grid snapping.
run(`stairWalls=[stairWall('diagonal',0,0,400,400,20)];
  const diagonalFace=wallFaceGeometry(stairWalls[0],stairWalls).faces[0];
  const diagonalMid={x:(diagonalFace.points[0].x+diagonalFace.points[1].x)/2,y:(diagonalFace.points[0].y+diagonalFace.points[1].y)/2};
  const diagonalSnap=stairSnapPoint(diagonalMid,stairWalls,1);`);
close(run('Math.abs(diagonalSnap.x-diagonalSnap.y)/Math.sqrt(2)'),10);
// T-junction faces end at the actual branch edge; they do not expose a snap
// point at the covered centreline junction.
run(`stairWalls=[stairWall('host',0,0,400,0,20),stairWall('branch',200,0,200,250,15)];
  const teeSnap=stairSnapPoint({x:193,y:11},stairWalls,1);`);
close(run('teeSnap.x'),192.5);close(run('teeSnap.y'),10);
run('let freeSnap=stairSnapPoint({x:83,y:117},[],1)');
close(run('freeSnap.x'),80);close(run('freeSnap.y'),120);
run('snapEnabled=false;let unsnapped=stairSnapPoint({x:13,y:14},stairWalls,1);snapEnabled=true');
close(run('unsnapped.x'),13);close(run('unsnapped.y'),14);
// Pointer noise around a centreline junction must not select the outer corner
// when the actual rectangle is being drawn into the room, in either winding.
run(`stairWalls=[stairWall('top',0,0,400,0),stairWall('right',400,0,400,400),stairWall('bottom',400,400,0,400),stairWall('left',0,400,0,0)];`);
for(const winding of [1,-1]){
  if(winding===-1)run('stairWalls=stairWalls.map(record=>({...record,points:record.points.slice().reverse()})).reverse()');
  for(const [x,y] of [[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]]){
    run(`stairCorner=stairResolveStart({x:${x},y:${y}},{x:100,y:300},stairSnapPoint({x:${x},y:${y}},stairWalls,1),stairWalls,1);
      cornerFootprint=stairRectangle(stairCorner,{x:100,y:300});`);
    close(run('stairCorner.x'),12.5);close(run('stairCorner.y'),12.5);
    close(run('cornerFootprint.width'),87.5);close(run('cornerFootprint.length'),287.5);
    close(run('cornerFootprint.left-cornerFootprint.width/2'),12.5);
    close(run('cornerFootprint.top-cornerFootprint.length/2'),12.5);
    run(`outsideCorner=stairResolveStart({x:${x},y:${y}},{x:-100,y:-300},stairSnapPoint({x:${x},y:${y}},stairWalls,1),stairWalls,1)`);
    close(run('outsideCorner.x'),-12.5);close(run('outsideCorner.y'),-12.5);
  }
}
// Preview resolves the start using drag direction, and commit uses the same
// coordinates even if the first hover chose the closer outside surface.
run(`wallRecords=()=>stairWalls;canvas.getZoom=()=>1;
  stairDraft={start:stairSnapPoint({x:-.5,y:-.5},stairWalls,1),startBase:stairSnapPoint({x:-.5,y:-.5},stairWalls,1),startInput:{x:-.5,y:-.5},end:{x:100,y:300}};
  stairDraft.start=stairResolveStart(stairDraft.startInput,stairDraft.end,stairDraft.startBase);commitFloorplanStair(stairDraft.end);`);
close(objects.at(-1).data.width,87.5);close(objects.at(-1).left-objects.at(-1).width/2,12.5);
close(objects.at(-1).top-objects.at(-1).height/2,12.5);
console.log('Stairs: wall-face/corner/grid snapping, thick and unequal corners, T and diagonal faces, rectangles, rotation undo, JSON persistence, SVG and validation passed.');

// The same concave footprint drives painting and crossing selection at every
// rotation/direction, so the unused corner is neither filled nor selectable.
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../script/pages/floorplan-selection.js'),'utf8'),ctx);
run(`const quarter=new fabric.Rect({left:300,top:400,width:200,height:400,angle:0,
  data:{kind:'stair',width:200,length:400,stairType:'quarter',direction:'forward'}});
  installFloorplanStair(quarter);`);
assert.equal(run('quarter.perPixelTargetFind'),true);
assert.equal(run('quarter.hasBorders'),false);
assert.equal(run('floorplanStairPolygon(quarter).length'),6);
const area=points=>Math.abs(points.reduce((sum,a,index)=>{const b=points[(index+1)%points.length];return sum+a.x*b.y-a.y*b.x;},0))/2;
close(area(run('floorplanStairPolygon(quarter)')),45900);
const painted=[];let paintPath=[];
ctx.paint={save(){},restore(){},rotate(){},beginPath(){paintPath=[];},moveTo(x,y){paintPath.push({x,y});},lineTo(x,y){paintPath.push({x,y});},closePath(){},stroke(){},fill(){painted.push(paintPath.slice());}};
run('renderStairSymbol(paint,quarter.data)');
assert.equal(painted.length,1);close(area(painted[0]),45900);
assert.equal(run('floorplanStairSVG(quarter.data).includes("<rect")'),false,'SVG must not paint a rectangular backing over the unused corner');
for(const angle of [0,45,90,137.5,270])for(const direction of ['forward','reverse']){
  run(`quarter.angle=${angle};quarter.data.direction='${direction}';
    var sign=quarter.data.direction==='reverse'?-1:1;
    var empty=stairWorldPoint(quarter,{x:50*sign,y:100*sign});
    var flight=stairWorldPoint(quarter,{x:-55*sign,y:100*sign});`);
  assert.equal(run('floorplanPolygonInBox(floorplanStairPolygon(quarter),{x:empty.x+2,y:empty.y+2},{x:empty.x-2,y:empty.y-2})'),false,'A crossing box in the empty corner must not select the stair');
  assert.equal(run('floorplanPolygonInBox(floorplanStairPolygon(quarter),{x:flight.x+2,y:flight.y+2},{x:flight.x-2,y:flight.y-2})'),true);
  close(run('Math.hypot(stairMeasurements(quarter)[0].points[1].x-stairMeasurements(quarter)[0].points[0].x,stairMeasurements(quarter)[0].points[1].y-stairMeasurements(quarter)[0].points[0].y)'),200);
  close(run('Math.hypot(stairMeasurements(quarter)[1].points[1].x-stairMeasurements(quarter)[1].points[0].x,stairMeasurements(quarter)[1].points[1].y-stairMeasurements(quarter)[1].points[0].y)'),400);
}
console.log('Quarter stairs: transparent L footprint, rotated/reversed crossing selection, pixel hit testing and matching SVG passed.');

// Dimension labels share the existing double-click interaction and stay in place
// through edits, zoom and unit changes. Invalid edits must not change geometry.
class Element {
  constructor(tag){this.tag=tag;this.style={};this.children=[];this.handlers={};this.attributes={};}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,handler){this.handlers[name]=handler;}
  setCustomValidity(message){this.error=message;}
  reportValidity(){}
  focus(){ctx.document.activeElement=this;}
  select(){this.selected=true;}
  dispatch(name,values={}){this.handlers[name]?.({preventDefault(){},stopPropagation(){},...values});}
}
const wrapper=new Element('div');
ctx.document={getElementById:id=>id==='canvasWrapper'?wrapper:null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
ctx.currentTool='select';
ctx.fabric.util={transformPoint:(p,m)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]})};
ctx.canvas.width=1200;ctx.canvas.height=1000;ctx.canvas.viewportTransform=[1,0,0,1,0,0];
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../script/pages/floorplan-units.js'),'utf8'),ctx);
run(`quarter.angle=0;quarter.data.direction='forward';canvas.getObjects().splice(0,canvas.getObjects().length,quarter);setupStairDimensions();renderStairDimensions();`);
let labels=run('stairDimensionUI.children.filter(element=>element.tag==="button")');
assert.equal(labels.length,2);assert.equal(labels[0].textContent,'2000');assert.equal(labels[1].textContent,'4000');
labels[0].dispatch('click',{detail:1});assert.equal(run('stairLengthEdit'),null);
labels[0].dispatch('dblclick');assert.equal(run('stairLengthEdit.key'),'width');
assert.equal(run('stairLengthInput.value'),'2000');assert.equal(run('stairLengthInput.selected'),true);
assert.equal(run('stairLengthEditor.style.left'),labels[0].style.left);assert.equal(run('stairLengthEditor.style.top'),labels[0].style.top);
const beforeDimension=checkpoints;
run('stairLengthInput.value="2500";stairLengthEditor.dispatch("submit");renderStairDimensions();');
close(run('quarter.data.width'),250);assert.equal(checkpoints,beforeDimension+1);assert.equal(run('stairLengthEditor.hidden'),true);
run('stairDimensionUI.children.filter(element=>element.tag==="button")[1].dispatch("dblclick");stairLengthInput.value="-10";stairLengthEditor.dispatch("submit");');
close(run('quarter.data.length'),400);assert.ok(run('stairLengthInput.error'));assert.equal(checkpoints,beforeDimension+1);
run('stairLengthInput.dispatch("keydown",{key:"Escape"});floorplanUnit="cm";renderStairDimensions();');
assert.equal(run('stairDimensionUI.children.filter(element=>element.tag==="button")[0].textContent'),'250');
run('floorplanDimensionsVisible=false;renderStairDimensions();');
assert.equal(run('stairDimensionUI.hidden'),true);
console.log('Stair dimensions: width/length labels, double-click in-place editing, units, validation, visibility and undo checkpoint passed.');

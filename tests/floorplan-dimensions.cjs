const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../script/pages/floorplan-units.js'), 'utf8'), context);
vm.runInContext("floorplanUnit='cm'", context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../script/pages/floorplan-dimensions.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
run(`
  const r = (id, ax, ay, bx, by, t = 20) => ({wall: id, points: [{x:ax,y:ay},{x:bx,y:by}], thickness:t});
  let records = [r('a',0,0,300,0), r('b',300,0,300,200)];
  let faces = wallFaceGeometry(records[0], records).faces;
`);
close(run('faces.find(f => f.name === "Inner").length'), 290);
close(run('faces.find(f => f.name === "Outer").length'), 310);
run('records[1].thickness = 30; faces = wallFaceGeometry(records[0], records).faces;');
close(run('faces.find(f => f.name === "Inner").length'), 285);
close(run('faces.find(f => f.name === "Outer").length'), 315);
run(`records = [r('a',0,0,300,0),r('b',300,0,300,200),r('c',300,200,0,200),r('d',0,200,0,0)];
  faces = wallFaceGeometry(records[0], records).faces;`);
close(run('faces.find(f => f.name === "Inner").length'), 280);
close(run('faces.find(f => f.name === "Outer").length'), 320);
// Face edits preserve directions: the complete connected wall translates.
run(`let solution = wallResizeSolution(records, 'a', faces.find(f => f.name === 'Inner').side, 350);`);
assert.ok(run('solution !== null'));
close(run('wallFaceGeometry(solution[0], solution).faces.find(f => f.name === "Inner").length'), 350);
assert.equal(run('wallSamePoint(solution[0].points[1], solution[1].points[0])'), true);
close(run('solution[0].points[0].x'), 0);
close(run('solution[1].points[1].x'), 370);
close(run('solution[1].points[0].x'), 370);
close(run('solution[2].points[0].x'), 370);
close(run('solution[3].points[0].x'), 0);
// 45-degree joints must use intersecting faces, not a fixed half-thickness deduction.
run(`records = [r('a',0,0,300,0),r('b',300,0,400,100)]; faces = wallFaceGeometry(records[0],records).faces;`);
close(run('faces.find(f => f.name === "Inner").length'), 300 - 10 * Math.tan(Math.PI / 8));
close(run('faces.find(f => f.name === "Outer").length'), 300 + 10 * Math.tan(Math.PI / 8));
// Reversed drawing order has identical physical face lengths.
run(`records = [r('a',300,0,0,0),r('b',300,0,400,100)]; faces = wallFaceGeometry(records[0],records).faces;`);
close(run('faces.find(f => f.name === "Inner").length'), 300 - 10 * Math.tan(Math.PI / 8));
assert.equal(run('wallResizeSolution(records,"a",1,0)'), null);
assert.equal(run('wallResizeSolution(records,"a",1,NaN)'), null);
run(`let wallStart = {x:0,y:0}; wallLengthInput = {value:'123.4'};`);
run('wallLengthTyped = true');
close(run('typedWallPoint({x:300,y:0}).x'), 123.4);
run(`wallLengthInput.value = '-600';`);
close(run('typedWallPoint({x:123.4,y:0}).x'), -600);
close(run('typedWallPoint({x:-600,y:0}).x'), -600);
run(`wallLengthInput.value = '600';`);
close(run('typedWallPoint({x:-600,y:0}).x'), 600);
run(`records = [r('a',0,0,600,0),r('b',300,0,300,200)]; faces = wallFaceGeometry(records[0],records).faces;`);
close(run('faces.find(f => f.name === "Outer").segments[0].length'), 600);
assert.equal(run('faces.find(f => f.name === "Inner").segments.length'), 2);
close(run('faces.find(f => f.name === "Inner").segments[0].length'), 290);
close(run('faces.find(f => f.name === "Inner").segments[1].length'), 290);
close(run('wallFaceGeometry(records[1],records).faces[0].length'), 190);
close(run('wallFaceGeometry(records[1],records).faces[1].length'), 190);
run(`solution = wallResizeSolution(records,'a',1,350,0);`);
assert.ok(run('solution !== null'));
close(run('wallFaceGeometry(solution[0],solution).faces[1].segments[0].length'), 350);
close(run('solution[0].points[1].x'), 600);
close(run('solution[1].points[0].y'), 0);
close(run('solution[1].points[0].x'), 360);
close(run('solution[1].points[1].x'), 360);
close(run('wallDistance(...solution[1].points)'), 200);
run(`solution = wallResizeSolution(records,'a',-1,800,0);`);
close(run('wallFaceGeometry(solution[0],solution).faces[0].segments[0].length'), 800);
assert.equal(run('wallInteriorPoint(solution[1].points[0],solution[0].points)'), true);
run(`records = [r('a',0,0,300,0)]; solution = wallResizeSolution(records,'a',1,-600,0);`);
close(run('solution[0].points[1].x'), -600);
run(`let merged = mergedWallPoints(r('a',0,0,300,0), r('b',300,0,600,0));`);
close(run('merged[1].x'), 600);
run(`merged = mergedWallPoints(r('a',0,0,300,0), r('b',600,0,300,0));`);
close(run('merged[1].x'), 600);
run(`merged = mergedWallPoints(r('a',0,0,300,0), r('b',400,0,200,0));`);
close(run('merged[1].x'), 400);
assert.equal(run(`mergedWallPoints(r('a',0,0,300,0), r('b',301,0,600,0))`), null);
assert.equal(run(`mergedWallPoints(r('a',0,0,300,0), r('b',300,0,600,0,30))`), null);
assert.equal(run(`mergedWallPoints(r('a',0,0,300,0), r('b',300,0,400,100))`), null);
run(`records = [r('a',600,0,0,0),r('b',300,200,300,0)]; faces = wallFaceGeometry(records[0],records).faces;`);
close(run('faces.find(f => f.name === "Outer").segments[0].length'), 600);
close(run('faces.find(f => f.name === "Inner").segments[0].length'), 290);
console.log('Straight merging, T-junction face segments, junction resizing and signed lengths passed.');
console.log('Face lengths, unequal thickness, closed rooms, angled joints and connected resizing passed.');

// Default construction follows auto classification, while explicit choices survive.
run(`let outsideWall = {data:{wallType:'outer'}}, insideWall = {data:{wallType:'inner'}};
  ensureFloorplanWallId(outsideWall); ensureFloorplanWallId(insideWall);`);
assert.equal(run('outsideWall.data.insulated && outsideWall.data.loadBearing'), true);
assert.equal(run('insideWall.data.insulated || insideWall.data.loadBearing'), false);
run(`let explicitWall = {data:{wallType:'outer',insulated:false,loadBearing:false}}; ensureFloorplanWallId(explicitWall);`);
assert.equal(run('explicitWall.data.insulated || explicitWall.data.loadBearing'), false);

// Hatch lines must cross both halves of horizontal, vertical, and angled footprints.
for (const points of [[[-300,-12.5],[300,-12.5],[300,12.5],[-300,12.5]],[[-12.5,-300],[12.5,-300],[12.5,300],[-12.5,300]],[[-160,-140],[140,160],[160,140],[-140,-160]]]) {
  const pattern = run(`wallHatchSegments(${JSON.stringify(points.map(([x,y])=>({x,y})))})`);
  for (const sign of [-1,1]) assert.ok(pattern.some(([a,b]) => sign*(a.x+b.x)/2 > 0));
  for (let i=1;i<pattern.length;i++) close(pattern[i][0].x-pattern[i-1][0].x,18);
}

// Floating inputs stay clear of placement endpoints, including upward and short drafts.
for (const [start,end] of [[{x:100,y:450},{x:100,y:100}],[{x:300,y:350},{x:300,y:310}],[{x:20,y:250},{x:20,y:40}],[{x:350,y:150},{x:150,y:150}]]) {
  const p = run(`floorplanEditorPosition(${JSON.stringify({x:(start.x+end.x)/2,y:(start.y+end.y)/2})},${JSON.stringify(start)},${JSON.stringify(end)},186,76,570,620)`);
  for (const q of [start,end]) assert.ok(Math.hypot(Math.max(0,Math.abs(p.x-q.x)-93),Math.max(0,Math.abs(p.y-q.y)-38)) >= 25.9);
}

// Precise starts reference the nearest branch face, including reversed host direction.
run(`records=[r('host',0,0,600,0),r('branch',300,0,300,200)];
  let gapPoint=wallClearancePoint(records[0],records,'a',100,20,{x:0,y:1},1,{x:450,y:0});`);
close(run('gapPoint.x'),420);
assert.equal(run("wallClearancePoint(records[0],records,'a',400,20,{x:0,y:1},1,{x:450,y:0})"),null);
run(`gapPoint=wallClearancePoint(records[0],records,'a',100,20,{x:1,y:1},1,{x:450,y:0});`);
close(run('gapPoint.x'),410+Math.SQRT2*10-10);
console.log('Construction defaults, full hatching, clear placement inputs and nearest-wall offsets passed.');

// Three walls at one corner share adjacent miters instead of independently
// picking the shortest intersection. The central junction is tiled without gaps.
run(`
  function junctionFixture(reverseMask=0, order=[0,1,2]) {
    const walls=[r('horizontal',0,0,600,0,25),r('vertical',0,0,0,600,35),r('diagonal',0,0,400,400,15)];
    walls.forEach(wall=>wall.wallType='inner');
    walls.forEach((wall,index)=>{if(reverseMask&(1<<index))wall.points.reverse();});
    return order.map(index=>walls[index]);
  }
  function polygonContains(point,polygon){
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function junctionDetails(list){return list.map(record=>{
    const geometry=wallFaceGeometry(record,list),index=record.points.findIndex(point=>wallSamePoint(point,{x:0,y:0}));
    return {id:record.wall,joins:geometry.faces.map(face=>face.points[index]),polygon:geometry.polygon,caps:geometry.caps};
  });}
  let cornerJunction=junctionDetails(junctionFixture());
`);
close(run("cornerJunction.find(wall=>wall.id==='horizontal').joins.find(point=>point.y>0).x"), 12.5 + 15 / Math.SQRT2);
close(run("cornerJunction.find(wall=>wall.id==='vertical').joins.find(point=>point.x>0).y"), 17.5 + 15 / Math.SQRT2);
assert.equal(run('cornerJunction.every(wall=>wall.caps.length===1)'), true, 'Only the remote unconnected endpoints retain caps');
const baselineJoins = JSON.stringify(run('cornerJunction.flatMap(wall=>wall.joins).map(p=>[Number(p.x.toFixed(6)),Number(p.y.toFixed(6))]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])'));
for (let reversed = 0; reversed < 8; reversed++) {
  run(`cornerJunction=junctionDetails(junctionFixture(${reversed},[2,0,1]));`);
  assert.equal(JSON.stringify(run('cornerJunction.flatMap(wall=>wall.joins).map(p=>[Number(p.x.toFixed(6)),Number(p.y.toFixed(6))]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])')), baselineJoins, 'Join geometry does not depend on wall creation order or endpoint direction');
  assert.equal(run('cornerJunction.every(wall=>wall.joins.every(point=>cornerJunction.some(other=>other!==wall&&other.joins.some(q=>wallSamePoint(point,q)))))'), true, 'Every miter is shared by the two adjoining faces');
  for (let i = 1; i < 8; i++) for (let j = 1; j < 8 - i; j++) {
    run(`var sampleJoins=[...new Map(cornerJunction.flatMap(w=>w.joins).map(p=>[p.x.toFixed(6)+','+p.y.toFixed(6),p])).values()];
      var samplePoint={x:(sampleJoins[0].x*${i}+sampleJoins[1].x*${j}+sampleJoins[2].x*${8-i-j})/8,
        y:(sampleJoins[0].y*${i}+sampleJoins[1].y*${j}+sampleJoins[2].y*${8-i-j})/8};`);
    assert.equal(run('cornerJunction.filter(wall=>polygonContains(samplePoint,wall.polygon)).length'), 1, 'The junction has neither an empty triangle nor overlapping wall polygons');
  }
}

// The opposite end can land at a stepped orthogonal corner, with a different ray order.
run(`records=[r('top',0,0,600,0,25),r('left',0,0,0,500,25),r('diagonal',0,0,300,300,15),
  r('step-horizontal',300,300,600,300,25),r('step-vertical',300,300,300,500,25)];
  records.forEach(wall=>wall.wallType='inner');
  let diagonalRecord=records[2],diagonalGeometry=wallFaceGeometry(diagonalRecord,records);
`);
assert.equal(run('diagonalGeometry.caps.length'), 0);
assert.equal(run('diagonalGeometry.polygon.length'), 6, 'Both multiwall endpoints have a shared junction vertex');
assert.equal(run('diagonalGeometry.faces.every(face=>face.points.every((point,index)=>records.some(other=>other!==diagonalRecord&&wallFaceGeometry(other,records).faces.some(neighbor=>neighbor.points.some(p=>wallSamePoint(p,point))))))'), true);
// Continuous T hosts keep their clear segments and have no line across the branch mouth.
run(`records=[r('host',0,0,600,0,25),r('branch',300,0,450,150,15)];
  let hostGeometry=wallFaceGeometry(records[0],records),branchGeometry=wallFaceGeometry(records[1],records);`);
assert.equal(run('hostGeometry.faces.filter(face=>face.divided)[0].segments.length'), 2);
assert.equal(run('branchGeometry.caps.length'), 1);
close(run('branchGeometry.faces[0].points[0].y'), 12.5);
close(run('branchGeometry.faces[1].points[0].y'), 12.5);
run(`records=[r('wide',0,0,300,0,30),r('thin',300,0,600,0,10)];
  let shoulders=wallFaceGeometry(records[0],records).caps;`);
assert.equal(run('shoulders.length'), 3, 'A straight thickness change retains the free cap and two exposed shoulders');
close(run('wallDistance(...shoulders[1])+wallDistance(...shoulders[2])'), 20);
console.log('Diagonal multiwall corners share watertight miters and expose only real boundaries.');

// An inner partition meets the finished room faces and leaves the outer shell intact.
run(`
  function fittedCorner(angle=90,reverseMask=0,reentrant=false){
    const radians=angle*Math.PI/180,partitionAngle=radians/2+(reentrant?Math.PI:0);
    const list=[r('outer-a',0,0,1000,0,25),r('outer-b',0,0,1000*Math.cos(radians),1000*Math.sin(radians),35),
      r('partition',0,0,800*Math.cos(partitionAngle),800*Math.sin(partitionAngle),15)];
    list.forEach((record,index)=>{record.wall={data:{wallType:index<2?'outer':'inner'},name:record.wall};if(reverseMask&(1<<index))record.points.reverse();});
    return list;
  }
  function nearSegment(point,ends){const projection=wallProjection(point,ends);return projection.t>=-0.00001&&projection.t<=1.00001&&wallDistance(point,projection.point)<0.001;}
  let fitted=fittedCorner(),fittedGeometry=wallFaceGeometry(fitted[2],fitted);
`);
assert.equal(run('polygonContains({x:0,y:0},fittedGeometry.polygon)'), false, 'Partition fill cannot reach the outside centreline corner');
assert.equal(run('fittedGeometry.polygon.some(p=>wallSamePoint(p,{x:17.5,y:12.5}))'), true, 'The cap follows both finished room faces through their corner');
close(run('fittedGeometry.faces[0].points[0].x'), 12.5 + 15 / Math.SQRT2);
close(run('fittedGeometry.faces[1].points[0].y'), 17.5 + 15 / Math.SQRT2);
close(run('wallFaceGeometry(fitted[0],fitted).faces.find(face=>face.side===1).segments[0].length'), 1000 - 12.5 - 15 / Math.SQRT2);
for (const angle of [30,60,90,120,150]) for (const reentrant of [false,true]) for (let mask=0;mask<8;mask++) {
  run(`fitted=fittedCorner(${angle},${mask},${reentrant});fittedGeometry=wallFaceGeometry(fitted[2],fitted);`);
  assert.equal(run('fitted.slice(0,2).every(record=>JSON.stringify(wallFaceGeometry(record,fitted).polygon)===JSON.stringify(wallFaceGeometry(record,fitted.slice(0,2)).polygon))'), true, 'An added partition never cuts into the outer-wall corner');
  assert.equal(run('polygonContains({x:0,y:0},fittedGeometry.polygon)'), false);
  assert.equal(run(`fittedGeometry.faces.every(face=>{const index=fitted[2].points.findIndex(p=>wallSamePoint(p,{x:0,y:0}));return fitted.slice(0,2).some(outer=>wallFaceGeometry(outer,fitted).faces.some(boundary=>nearSegment(face.points[index],boundary.points)));})`), true, 'Every diagonal face ends on an actual finished outer-wall face');
  run(`var fittedPolygons=fitted.map(record=>wallFaceGeometry(record,fitted).polygon);`);
  for(let x=-80;x<=80;x+=16)for(let y=-80;y<=80;y+=16){
    assert.equal(run(`polygonContains({x:${x+0.31},y:${y+0.67}},fittedPolygons[2])&&fittedPolygons.slice(0,2).some(polygon=>polygonContains({x:${x+0.31},y:${y+0.67}},polygon))`), false, 'Fitted partition and outer-wall material do not overlap');
  }
}
run(`fitted=fittedCorner();fitted.forEach(record=>{record.wall=record.wall.name;});fittedGeometry=wallFaceGeometry(fitted[2],fitted);`);
assert.equal(run('fittedGeometry.polygon.some(p=>wallSamePoint(p,{x:17.5,y:12.5}))'), true, 'Legacy walls without construction metadata infer the enclosed corner');
console.log('Inner partitions fit convex/re-entrant finished corners while outer shell geometry stays continuous.');

// Existing measurements open only on double-click or keyboard activation, at the label.
run(`
  function dimensionElement(tag) { return {tag,style:{},handlers:{},children:[],setAttribute(){},
    addEventListener(name,handler){this.handlers[name]=handler;},append(...items){this.children.push(...items);},
    replaceChildren(){this.children=[];}}; }
  let document={activeElement:null,createElement:dimensionElement,createElementNS:(_ns,tag)=>dimensionElement(tag)};
  let canvas={width:800,height:600,viewportTransform:[1,0,0,1,100,200]};
  let fabric={util:{transformPoint:p=>({x:p.x+100,y:p.y+200})}};
  let currentTool='select',wallPointer=null,wallThickness=20;
  wallStart=null;
  let editFinished=0;
  function finishCurrent(){editFinished++;}
  let dimensionWall={data:{kind:'wall'}};
  wallRecords=()=>[{wall:dimensionWall,points:[{x:0,y:0},{x:300,y:0}],thickness:20}];
  wallDimensionUI=dimensionElement('div');wallLengthEditor={hidden:true,style:{},offsetWidth:186,offsetHeight:76};
  wallLengthCaption={};wallLengthInput={value:'',setCustomValidity(){},focus(){document.activeElement=this;},select(){}};
  renderWallDimensions();
  let dimensionButton=wallDimensionUI.children.find(item=>item.tag==='button');
  let mouseEvent={detail:1,preventDefault(){},stopPropagation(){}};
  dimensionButton.handlers.click(mouseEvent);
`);
assert.equal(run('wallLengthEditor.hidden'), true, 'A single mouse click never edits');
assert.equal(run('editFinished'), 0, 'A single click does not disrupt the current editor');
run('dimensionButton.handlers.dblclick(mouseEvent)');
assert.equal(run('wallLengthEditor.hidden'), false);
close(run('parseFloat(wallLengthEditor.style.left)'), run('parseFloat(dimensionButton.style.left)'));
close(run('parseFloat(wallLengthEditor.style.top)'), run('parseFloat(dimensionButton.style.top)'));
run("wallLengthEditor.hidden=true;dimensionButton.handlers.keydown({...mouseEvent,key:'Enter'})");
assert.equal(run('wallLengthEditor.hidden'), false, 'Enter edits a focused measurement');
const cornerEditor = run('floorplanMeasurementEditorPosition({x:795,y:595},186,76,800,600)');
close(cornerEditor.x, 699); close(cornerEditor.y, 554);
console.log('Double-click/keyboard measurement editing stays anchored to the displayed value.');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../script/pages/floorplan-rooms.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../script/pages/floorplan-dimensions.js'), 'utf8'), context);
const run = source => vm.runInContext(source, context);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
run(`
  const wall = (id, ax, ay, bx, by, thickness=20) => ({ wall:{data:{id}}, points:[{x:ax,y:ay},{x:bx,y:by}], thickness });
  const box = (x=0,y=0,w=600,h=400,prefix='') => [wall(prefix+'a',x,y,x+w,y), wall(prefix+'b',x+w,y,x+w,y+h),
    wall(prefix+'c',x+w,y+h,x,y+h),wall(prefix+'d',x,y+h,x,y)];
  let records = box(), rooms = detectFloorplanRooms(records);
`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), 5.8 * 3.8);
close(run('rooms[0].labelPoint.x'), 300);
close(run('rooms[0].labelPoint.y'), 200);
// A divider whose endpoints lie in the middle of uncut hosts creates two rooms.
run(`records.push(wall('partition',300,0,300,400)); rooms = detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 2);
close(run('rooms[0].area'), 2.8 * 3.8);
close(run('rooms[1].area'), 2.8 * 3.8);
assert.notEqual(run('rooms[0].boundaryKey'), run('rooms[1].boundaryKey'));
// Cross intersections are split into four planar faces without modifying walls.
run(`records.push(wall('cross',0,200,600,200)); rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 4);
assert.equal(run('rooms.every(room => Math.abs(room.area - 2.8*1.8)<0.001)'), true);
// Drawing order and line direction do not change room detection or floor areas.
run(`records.reverse().forEach(record => record.points.reverse()); rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 4);
assert.equal(run('rooms.every(room => Math.abs(room.area - 2.8*1.8)<0.001)'), true);
// Open shapes do not count as rooms; an unfinished divider keeps a single room.
assert.equal(run('detectFloorplanRooms(box().slice(0,3)).length'), 0);
run(`records=box(); records.push(wall('unfinished',300,0,300,200)); rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), 21.66); // 22.04 m² minus 20 × 190 cm of interior wall
// Concave floor outlines have their labels inside the usable floor.
run(`const corners=[{x:0,y:0},{x:600,y:0},{x:600,y:200},{x:200,y:200},{x:200,y:600},{x:0,y:600}];
  records=corners.map((a,i)=>{const b=corners[(i+1)%corners.length];return wall(String(i),a.x,a.y,b.x,b.y);});
  rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), 17.64);
assert.equal(run('roomPointInside(rooms[0].labelPoint, rooms[0].innerPolygon)'), true);
// 45-degree rooms use intersected inner faces, including differing thicknesses.
run(`records=[wall('a',0,200,200,0),wall('b',200,0,400,200),wall('c',400,200,200,400),wall('d',200,400,0,200)];rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), (200*Math.SQRT2-20)**2/10000);
// Collinear subdivisions and overlapping duplicate segments do not add rooms.
run(`records=box();records[0]=wall('a',0,0,300,0);records.push(wall('e',300,0,600,0),wall('duplicate',100,0,500,0));rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), 22.04);
// Tiny/narrow rooms still detect, but invalid inner offsets do not claim an area.
run(`rooms=detectFloorplanRooms(box(0,0,15,200));`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), 0);
// Disconnected ordinary rooms keep independent faces.
assert.equal(run(`detectFloorplanRooms([...box(), ...box(1000,0,300,200,'other')]).length`), 2);
// An enclosed room inside a disconnected outer loop gets its own label; the
// surrounding room's name remains outside the inner enclosure.
run(`rooms=detectFloorplanRooms([...box(), ...box(200,100,200,200,'inside')]);`);
assert.equal(run('rooms.length'), 2);
close(run('rooms.find(room=>room.holes.length).area'), 17.2);
assert.equal(run('rooms.every(room=>room.holes.every(hole=>!roomPointInside(room.labelPoint,hole)))'), true);
// Concave 45-degree outline with two joined unfinished partition segments.
// Floor is the inset L (17.64 m²) plus its chamfer triangle; partition area is
// thickness times the two useful segment lengths, including the angled join.
run(`const chamfer=[{x:0,y:0},{x:600,y:0},{x:600,y:200},{x:400,y:200},{x:200,y:400},{x:200,y:600},{x:0,y:600}];
  records=chamfer.map((a,i)=>{const b=chamfer[(i+1)%chamfer.length];return wall('ch'+i,a.x,a.y,b.x,b.y);});
  rooms=detectFloorplanRooms(records);`);
const chamferFloor = 17.64 + (220 - 10 * Math.SQRT2) ** 2 / 20000;
close(run('rooms[0].area'), chamferFloor);
run(`records.push(wall('branchA',300,0,300,150),wall('branchB',300,150,200,250));rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), chamferFloor - 20 * (140 + 100 * Math.SQRT2) / 10000);
// A crossing dangling partition subtracts its union, so its 20 × 20 overlap
// with the vertical branch is counted once rather than twice.
run(`records.push(wall('crossingBranch',200,100,400,100));rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'), 1);
close(run('rooms[0].area'), chamferFloor - 20 * (140 + 100 * Math.SQRT2) / 10000 - 0.36);
assert.equal(run('records.filter(record=>record.wall.data.id.startsWith("branch")).every(record=>!roomPointInside(rooms[0].labelPoint,roomWallFootprint(record,records)))'), true);
// Floor subtraction handles overlapping polygons and diagonal edges directly.
run(`const square=[{x:0,y:0},{x:400,y:0},{x:400,y:400},{x:0,y:400}];
  const vertical=[{x:100,y:0},{x:120,y:0},{x:120,y:300},{x:100,y:300}];
  const horizontal=[{x:0,y:100},{x:300,y:100},{x:300,y:120},{x:0,y:120}];`);
close(run('roomUsableArea(square,[vertical,horizontal])'), 14.84);
close(run('roomUsableArea(square,[vertical,horizontal,vertical])'), 14.84);
// Outer host walls remain outer even when several rooms share the same side.
run(`records=box();records.push(wall('partition',300,0,300,400));let classifications=classifyFloorplanWalls(records);`);
assert.equal(run('classifications.get(records[0].wall)'), 'outer');
assert.equal(run('classifications.get(records[4].wall)'), 'inner');
assert.equal(run('records.slice(0,4).every(record=>classifications.get(record.wall)==="outer")'), true);
run(`records=box();records.push(wall('inside',300,0,300,200),wall('outside',800,0,1000,0));classifications=classifyFloorplanWalls(records);`);
assert.equal(run('classifications.get(records[4].wall)'), 'inner');
assert.equal(run('classifications.get(records[5].wall)'), 'outer');
run(`records=[...box(),...box(200,100,200,200,'inside')];classifications=classifyFloorplanWalls(records);`);
assert.equal(run('records.slice(4).every(record=>classifications.get(record.wall)==="inner")'), true);
console.log('Room graph: closed/open shapes, T/cross partitions, concave/45° rooms, inner areas, and duplicate segments passed.');
// A diagonal between two three-wall corners divides the clear floor into two
// right triangles. Shared junction fill must not leave ghost floor triangles.
run(`records=box(0,0,400,400).map(record=>({...record,thickness:25}));
  records.push({...wall('diagonal',0,0,400,400),thickness:15});rooms=detectFloorplanRooms(records);`);
assert.equal(run('rooms.length'),2);
const diagonalRoomArea=(375-15/Math.SQRT2)**2/20000;
close(run('rooms[0].area'),diagonalRoomArea);close(run('rooms[1].area'),diagonalRoomArea);
run('records=records.slice().reverse().map(record=>({...record,points:record.points.slice().reverse()}));rooms=detectFloorplanRooms(records);');
close(run('rooms.reduce((sum,room)=>sum+room.area,0)'),2*diagonalRoomArea);
console.log('Diagonal rooms: unequal wall thickness and reversed multiwall corners preserve exact usable floor area.');
// Derived labels stay out of the user's dirty state, and names survive geometry
// edits plus the object replacement performed by JSON load / undo.
run(`
  class MockText {
    constructor(text, options) { Object.assign(this, options, {text}); }
    set(key, value) { if(typeof key==='string') this[key]=value; else Object.assign(this,key); }
    setCoords() {}
  }
  const fabric = { Text: MockText };
  let isDirty = false, checkpoints = 0, objects = [], renders = 0;
  const roomSnapshots=[];
  const syncSaveButton = () => {}, wallCheckpoint = () => {checkpoints++;roomSnapshots.push(JSON.stringify(objects));};
  const canvas = {getObjects:()=>objects, add:label=>{objects.push(label);isDirty=true;},
    remove:label=>{objects=objects.filter(object=>object!==label);isDirty=true;},requestRenderAll:()=>renders++};
  function wallRecords() { return records; }
  records = box();
  refreshFloorplanRooms();
`);
assert.equal(run('objects.length'), 1);
assert.equal(run('isDirty'), false);
assert.equal(run('objects[0].data.name'), 'Room 1');
run(`renameFloorplanRoom(objects[0], 'Living room');`);
assert.equal(run('checkpoints'), 1);
assert.equal(run('objects[0].data.name'), 'Living room');
assert.equal(run('isDirty'), true);
run(`records = box(0,0,800,400); refreshFloorplanRooms();`);
assert.equal(run('objects[0].data.name'), 'Living room');
assert.equal(run('objects[0].left'), 400);
// The same fingerprint with reloaded Fabric objects must rebuild references.
run(`objects=objects.map(object=>new MockText(object.text,JSON.parse(JSON.stringify(object))));refreshFloorplanRooms();`);
assert.equal(run('floorplanRoomFaces[0].label===objects[0]'), true);
assert.equal(run('objects[0].data.name'), 'Living room');
run(`records.push(wall('divider',400,0,400,400));refreshFloorplanRooms();`);
assert.equal(run('objects.length'), 2);
assert.equal(run('objects.some(object=>object.data.name === "Living room")'), true);
assert.equal(run('objects.some(object=>object.data.name === "Room 2")'), true);
// A deleted closure removes its derived label without changing a clean state.
run(`isDirty=false;records=[];refreshFloorplanRooms();`);
assert.equal(run('objects.length'), 0);
assert.equal(run('isDirty'), false);
console.log('Room labels: derived dirty state, rename checkpoint, resizing, JSON replacement, room splits, and cleanup passed.');
// A split-wall dimension edit translates its partition, updates both adjoining
// rooms, and keeps their names even when the visual order changes.
run(`wallRecords = () => records;records=box();records.push(wall('divider',300,0,300,400));refreshFloorplanRooms();
  renameFloorplanRoom(floorplanRoomFaces.find(face=>face.labelPoint.x<300).label,'Kitchen');
  renameFloorplanRoom(floorplanRoomFaces.find(face=>face.labelPoint.x>300).label,'Dining');
  records=wallResizeSolution(records,records[0].wall,1,350,0);refreshFloorplanRooms();`);
assert.equal(run('floorplanRoomFaces.length'), 2);
close(run('floorplanRoomFaces.find(face=>face.label.data.name==="Kitchen").area'), 13.3);
close(run('floorplanRoomFaces.find(face=>face.label.data.name==="Dining").area'), 7.98);
// Translate the entire plan without losing room names or area.
run(`records=records.map(record=>({...record,points:record.points.map(point=>({x:point.x+500,y:point.y-250}))}));refreshFloorplanRooms();`);
close(run('floorplanRoomFaces.find(face=>face.label.data.name==="Kitchen").labelPoint.x'), 685);
close(run('floorplanRoomFaces.find(face=>face.label.data.name==="Kitchen").area'), 13.3);
// Offscreen export must multiply the labels along with all other canvas objects.
run(`canvas.getZoom=()=>0.5;canvas.contextContainer={};scaleFloorplanRoomLabels({ctx:canvas.contextContainer});`);
close(run('objects[0].scaleX'), 2);
run(`canvas.getZoom=()=>1;scaleFloorplanRoomLabels({ctx:{}});`);
close(run('objects[0].scaleX'), 2);
console.log('Room integration: translated partitions, both floor areas, stable names, whole-plan moves, and export scaling passed.');
// Moving the name moves the combined name/area label without exposing the room
// to Fabric selection, and stores an offset from its derived geometric anchor.
run(`objects=[];records=box();refreshFloorplanRooms(true);renameFloorplanRoom(objects[0],'Office');
  let currentTool='select';canvas.viewportTransform=[2,0,0,2,100,50];canvas.getZoom=()=>2;
  // Actual editor CSS scale is .75. Raw client deltas drift away from the cursor.
  canvas.getPointer=event=>({x:((event.clientX-13)/.75-100)/2,y:((event.clientY-27)/.75-50)/2});
  const dragStartCheckpoint=checkpoints,dragSnapshotIndex=roomSnapshots.length;
  const roomButton={dataset:{},handlers:{},classList:{add(){},remove(){}},
    addEventListener(name,callback){this.handlers[name]=callback;},setPointerCapture(){},hasPointerCapture(){return false;}};
  setupFloorplanRoomDragging(roomButton,objects[0]);
  const pointer=(x,y)=>({clientX:x*.75+13,clientY:y*.75+27,button:0,pointerId:1,stopPropagation(){},preventDefault(){}});
  roomButton.handlers.pointerdown(pointer(100,100));
  roomButton.handlers.pointermove(pointer(120,140));
  roomButton.handlers.pointermove(pointer(160,200));
  roomButton.handlers.pointerup(pointer(160,200));
`);
assert.equal(run('checkpoints-dragStartCheckpoint'),1);
close(run('objects[0].left'),330);close(run('objects[0].top'),250);
close(run('objects[0].data.labelOffset.x'),30);close(run('objects[0].data.labelOffset.y'),50);
assert.equal(run('objects[0].selectable'),false);assert.equal(run('objects[0].evented'),false);
assert.equal(run('objects[0].text.startsWith("Office\\n")'),true);
assert.equal(run('floorplanRoomDrag'),null);
// A click with no real drag remains available for double-click renaming and
// does not consume an undo step.
run('roomButton.handlers.pointerdown(pointer(100,100));roomButton.handlers.pointermove(pointer(101,101));roomButton.handlers.pointerup(pointer(101,101));');
assert.equal(run('checkpoints-dragStartCheckpoint'),1);
run('refreshFloorplanRooms(true)');
close(run('objects[0].left'),330);close(run('objects[0].top'),250);
run('objects=objects.map(object=>new MockText(object.text,JSON.parse(JSON.stringify(object))));refreshFloorplanRooms();');
close(run('objects[0].left'),330);close(run('objects[0].top'),250);
assert.equal(run('objects[0].data.name'),'Office');
// Changes to the wall geometry preserve the user's relative label placement.
run('records=box(0,0,800,400);refreshFloorplanRooms();renameFloorplanRoom(objects[0],"Study");');
close(run('objects[0].left'),430);close(run('objects[0].top'),250);
run('records=records.map(record=>({...record,points:record.points.map(point=>({x:point.x+1000,y:point.y-250}))}));refreshFloorplanRooms();');
close(run('objects[0].left'),1430);close(run('objects[0].top'),0);
// Restoring the single pre-drag snapshot restores the automatic label position.
run('records=box();objects=JSON.parse(roomSnapshots[dragSnapshotIndex]).map(object=>new MockText(object.text,object));refreshFloorplanRooms();');
close(run('objects[0].left'),300);close(run('objects[0].top'),200);
close(run('objects[0].data.labelOffset.x'),0);close(run('objects[0].data.labelOffset.y'),0);
// The hover/drag target measures only the first line even if the area is wider.
run(`objects[0].height=49;objects[0].width=120;objects[0].scaleX=.5;objects[0].scaleY=.5;
  objects[0].getLineWidth=line=>line===0?80:120;objects[0].getHeightOfLine=()=>27.459;
  const nameBounds=floorplanRoomNameBounds(objects[0]);`);
close(run('nameBounds.width'),80);close(run('nameBounds.height'),20.34);
assert.equal(run('nameBounds.y<objects[0].top*2+50'),true);
console.log('Room label movement: one undo per gesture, name-only hover bounds, area follows, relative geometry offset, rename, JSON reload and undo passed.');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handlers = {}, elements = {};
const objects = [];
const context = vm.createContext({
  console, Math, Number, JSON,
  currentTool: 'wall', snapEnabled: true, isPanning: false, isDirty: false,
  getGridInterval: () => 50, syncSaveButton() {},
  document: {
    getElementById(id) { return elements[id] ||= { value: 15, addEventListener(type, fn) { this[type] = fn; } }; },
    addEventListener() {}, querySelectorAll(){return [];}
  },
  fabric: {
    Point: function(x, y) { this.x = x; this.y = y; },
    util: { transformPoint: (p, m) => ({ x: p.x + m[4], y: p.y + m[5] }) },
    Line: function(points, options) {
      Object.assign(this, options);
      this.x1 = points[0]; this.y1 = points[1]; this.x2 = points[2]; this.y2 = points[3];
      this.set = values => Object.assign(this, values);
      this.setCoords = () => {};
      this.calcLinePoints = () => ({x1: this.x1 - this.left, y1: this.y1 - this.top, x2: this.x2 - this.left, y2: this.y2 - this.top});
      this.calcTransformMatrix = () => [1,0,0,1,this.left,this.top];
    }
  },
  canvas: {
    getZoom: () => 1, getObjects: () => objects, getPointer: e => e,
    on: (name, fn) => handlers[name] = fn,
    add: o => objects.push(o), requestRenderAll() {}, clearContext() {},
    discardActiveObject() {}, remove: o => objects.splice(objects.indexOf(o), 1),
    toJSON: () => ({ objects }),
    loadFromJSON(data, done) { objects.splice(0, objects.length, ...data.objects); done(); }
  }
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../script/pages/floorplan-units.js'), 'utf8'), context);
vm.runInContext("floorplanUnit='cm'; restoreFloorplanSettings=()=>{}",context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../script/pages/floorplan-dimensions.js'), 'utf8'), context);
vm.runInContext('setupWallDimensions = () => {};', context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../script/pages/floorplan-walls.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);
run('setupWalls()');
const click = (x,y) => handlers['mouse:down']({e:{x,y,button:0}});
click(2,3); click(201,4); click(202,199);
assert.equal(objects.length, 2);
assert.deepEqual(JSON.parse(run('JSON.stringify(wallEndpoints(canvas.getObjects()[0])[1])')), {x:200,y:0});
assert.deepEqual(JSON.parse(run('JSON.stringify(wallEndpoints(canvas.getObjects()[1])[0])')), {x:200,y:0});
click(202,199);
assert.equal(objects.length, 2, 'Repeated corner does not create a zero-length wall');
run('snapEnabled = false');
assert.equal(run('wallSnap({x:213,y:297}, true).x'), 200, 'Shift locks direction with snapping disabled');
run('finishCurrent()');
assert.equal(objects.length, 2, 'Finish preserves committed walls');
run('snapEnabled = true');
assert.equal(run('wallSnap({x:207,y:4}, false).x'), 200, 'Endpoints attract within the screen tolerance');
run('undo()');
assert.equal(objects.length, 1, 'Undo removes the last segment');
run('resetWallSession(); undo()');
assert.equal(objects.length, 1, 'A new session cannot undo into a different plan');
run('wallStart = null');
elements.wallThickness.value = '';
const previousThickness = run('wallThickness');
elements.wallThickness.change();
assert.equal(run('wallThickness'), previousThickness, 'Invalid thickness leaves the previous value intact');
objects.length = 0;
run('resetWallSession()');
click(0,0); click(200,0); click(400,0);
assert.equal(objects.length, 1, 'Straight consecutive walls become one object');
assert.equal(run('wallEndpoints(canvas.getObjects()[0])[1].x'), 400);
run('finishCurrent()');
assert.equal(run('wallSnap({x:173,y:4},false).y'), 0, 'Can snap to the middle of a host');
assert.equal(run('wallSnap({x:173,y:4},false).x'), 170, 'Points on a host also snap to grid');
assert.equal(run('wallSnap({x:203,y:4},false).x'), 200, 'Snaps precisely to the host midpoint');
run('undo()');
assert.equal(objects.length, 1);
assert.equal(objects[0].x2, 200, 'Undo merging restores the original wall');
objects.length = 0;
run('wallStart = {x:0,y:0}');
assert.deepEqual(JSON.parse(run('JSON.stringify(wallSnap({x:102,y:4},false))')), {x:100,y:0});
const diagonal = JSON.parse(run('JSON.stringify(wallSnap({x:102,y:96},false))'));
assert.equal(diagonal.x, diagonal.y, 'Default angle snap keeps 45 degree diagonals exact');
console.log('Wall drawing, snapping, finish, undo and session checks passed.');
objects.length=0;
run('finishCurrent()'); click(0,0);click(400,0);run('finishCurrent()');
click(200,-200);click(200,0);
assert.equal(run('wallStart'),null,'Connecting into an existing wall ends the chain');
const countBeforeStart=objects.length;click(300,200);
assert.equal(objects.length,countBeforeStart,'Next click chooses a new start without adding an accidental wall');
assert.equal(run('wallStart.x'),300);
click(400,200);
assert.equal(run('wallStart.x'),400,'A free endpoint stays the start for the next segment');
console.log('Wall chain termination at a junction and continuation on the free grid passed.');

// Parallel guides reference actual centreline endpoints without adding objects.
const reference = (a, b) => [{ wall: 'reference', points: [a, b], thickness: 15 }];
const parallel = (start, point, records, options = {}) => {
  Object.assign(context, { guideStart: start, guidePoint: point, guideRecords: records, guideOptions: options });
  return JSON.parse(run('JSON.stringify(parallelWallAlignment(guideStart,guidePoint,guideRecords,guideOptions))'));
};
const horizontalReference = reference({ x: 0, y: 0 }, { x: 400, y: 0 });
const horizontalGuide = parallel({ x: 0, y: 100 }, { x: 394, y: 100 }, horizontalReference);
assert.equal(horizontalGuide.kind, 'endpoint');
assert.deepEqual(horizontalGuide.point, { x: 400, y: 100 });
assert.deepEqual(horizontalGuide.lines[0], [{ x: 400, y: 0 }, { x: 400, y: 100 }]);
const verticalGuide = parallel({ x: 100, y: 20 }, { x: 100, y: 296 }, reference({ x: 0, y: 0 }, { x: 0, y: 300 }));
assert.deepEqual(verticalGuide.point, { x: 100, y: 300 });
const diagonalGuide = parallel({ x: 100, y: -100 }, { x: 297, y: 97 }, reference({ x: 0, y: 0 }, { x: 200, y: 200 }));
assert.ok(Math.abs(diagonalGuide.point.x - 300) < 0.00001);
assert.ok(Math.abs(diagonalGuide.point.y - 100) < 0.00001);
const angledGuide = parallel({ x: 80, y: -60 }, { x: 378, y: 338 }, reference({ x: 0, y: 0 }, { x: 300, y: 400 }));
assert.ok(Math.abs(angledGuide.point.x - 380) < 0.00001);
assert.ok(Math.abs(angledGuide.point.y - 340) < 0.00001);
const reversedGuide = parallel({ x: 400, y: 100 }, { x: 3, y: 100 }, horizontalReference);
assert.deepEqual(reversedGuide.point, { x: 0, y: 100 });
const equalLengthGuide = parallel({ x: 100, y: 100 }, { x: 497, y: 100 }, horizontalReference);
assert.equal(equalLengthGuide.kind, 'equal-length');
assert.deepEqual(equalLengthGuide.point, { x: 500, y: 100 });
assert.equal(equalLengthGuide.lines.length, 2, 'Equal lengths connect both pairs of matching endpoints');
assert.equal(parallel({ x: 200, y: 100 }, { x: 200, y: 400 }, horizontalReference), null, 'Perpendicular walls do not produce parallel guides');
assert.equal(parallel({ x: 100, y: 0 }, { x: 397, y: 0 }, horizontalReference), null, 'Collinear joining is handled by wall merging');
assert.equal(parallel({ x: 0, y: 100 }, { x: 394, y: 100 }, horizontalReference, { tolerance: 2 }), null, 'Zoomed-in proximity keeps the same screen-pixel threshold');
assert.equal(parallel({ x: 0, y: 100 }, { x: 394, y: 100 }, horizontalReference, { tolerance: 0.6 }), null, 'A nearby typed measurement is not falsely shown as aligned');
const typedReference = reference({ x: 0, y: 0 }, { x: 403, y: 0 });
assert.equal(parallel({ x: 0, y: 100 }, { x: 400, y: 100 }, typedReference, { gridStep: 10 }), null, 'Secondary alignment does not break grid spacing');
assert.deepEqual(parallel({ x: 0, y: 100 }, { x: 400, y: 100 }, typedReference).point, { x: 403, y: 100 });

// Exercise the real snapping integration. Connections still take priority and
// turning snap off never silently changes a point to match another wall.
objects.length = 0; run('finishCurrent()'); click(0, 0); click(403, 0); run('finishCurrent()');
run('setWallEndpoints(canvas.getObjects()[0],[{x:0,y:0},{x:403,y:0}]); wallStart={x:0,y:100}; floorplanGridStep=1');
assert.deepEqual(JSON.parse(run('JSON.stringify(wallSnap({x:397,y:100},false))')), { x: 403, y: 100 });
run('snapEnabled=false');
assert.deepEqual(JSON.parse(run('JSON.stringify(wallSnap({x:397,y:100},false))')), { x: 397, y: 100 });
run('snapEnabled=true; floorplanGridStep=10');
assert.deepEqual(JSON.parse(run('JSON.stringify(wallSnap({x:397,y:100},false))')), { x: 400, y: 100 });
run('setWallEndpoints(canvas.getObjects()[0],[{x:0,y:0},{x:403,y:3.5}]); floorplanGridStep=0.1');
assert.equal(run('wallSnap({x:403,y:100},true).y'), 100, 'A nearly parallel reference cannot override the 90-degree direction lock');
const beforeGuideObjects = objects.length, beforeGuideHistory = run('wallHistory.length');
const strokes = [], dashPatterns = [];
context.guideContext = {
  save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
  setLineDash(value) { dashPatterns.push(Array.from(value)); },
  stroke() { strokes.push(this.lineWidth); }
};
context.testGuide = horizontalGuide;
run('drawParallelWallGuide(guideContext,testGuide,2)');
assert.deepEqual(dashPatterns, [[2.5, 2]]);
assert.deepEqual(strokes, [0.5]);
assert.equal(objects.length, beforeGuideObjects);
assert.equal(run('wallHistory.length'), beforeGuideHistory, 'Guides never become saved objects or undo edits');
console.log('Parallel endpoint/equal-length guides, horizontal/vertical/angled matching, grid restrictions and transient dashed rendering passed.');

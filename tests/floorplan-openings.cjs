const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const objects = [];
let checkpoints = 0, changes = 0;
const context = vm.createContext({
  console, Math, Number, JSON,
  isDirty: false, snapEnabled: true,
  wallCheckpoint: () => checkpoints++, syncSaveButton() {},
  getSnapInterval: () => 10,
  fabric: { Rect: function(options) { Object.assign(this, options); this.set = values => Object.assign(this, values); this.setCoords = () => {}; } },
  canvas: {
    getObjects: () => objects, getZoom: () => 1, requestRenderAll() {},
    remove: object => objects.splice(objects.indexOf(object), 1),
    fire: () => changes++, clearContext() {},
  },
  wallDistance: (a, b) => Math.hypot(b.x - a.x, b.y - a.y),
  wallEndpoints: wall => wall.points,
  setWallEndpoints: (wall, points) => { wall.points = points; },
  wallProjection(point, [a, b]) {
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2;
    return { t, point: { x: a.x + dx * t, y: a.y + dy * t } };
  },
  wallRecords: () => objects.filter(object => object.data.kind === 'wall').map(wall => ({ wall, points: wall.points, thickness: wall.strokeWidth })),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages/floorplan-units.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages/floorplan-openings.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages/floorplan-rooms.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
const plain = result => JSON.parse(JSON.stringify(result));
const wall = (id, ax, ay, bx, by) => ({ data: { kind: 'wall', id }, strokeWidth: 20, points: [{ x: ax, y: ay }, { x: bx, y: by }],
  set(key, value) { if (typeof key === 'string') this[key] = value; else Object.assign(this, key); }
});
const opening = (kind, hostWallId, offset, length) => {
  const object = { data: { kind, hostWallId, offset, length, depth: 20, hinge: 'start', swing: 1 } };
  object.set = values => Object.assign(object, values); object.setCoords = () => {}; object.bringToFront = () => {};
  return object;
};
objects.push(wall('host', 0, 0, 600, 0));
const windowObject = opening('window', 'host', 100, 120);
const doorObject = opening('door', 'host', 300, 90);
objects.push(windowObject, doorObject);
context.windowObject = windowObject; context.doorObject = doorObject;

// Wall hit testing snaps to a fixed world grid, including 45-degree runs.
assert.deepEqual(plain(run('findOpeningWall({x:123,y:8}).point')), { x: 120, y: 0 });
assert.equal(run('findOpeningWall({x:123,y:100})'), null);
assert.deepEqual(plain(run('openingProject({x:123,y:125},[{x:0,y:0},{x:300,y:300}],10).point')), { x: 120, y: 120 });
close(run('openingProject({x:490,y:5},[{x:600,y:0},{x:0,y:0}],10).offset'), 110);
assert.equal(run('validateFloorplanOpenings()'), true);

// Editing an opening keeps the host's geometry untouched and creates one undo step.
const before = JSON.stringify(objects[0]);
assert.equal(run('updateFloorplanOpening(windowObject,{length:150})'), true);
assert.equal(JSON.stringify(objects[0]), before);
assert.equal(checkpoints, 1); assert.equal(changes, 1);
assert.equal(windowObject.data.length, 150); assert.equal(windowObject.data.depth, 20);
close(windowObject.left, 175); close(windowObject.top, 0);
assert.equal(run('updateFloorplanOpening(windowObject,{length:150})'), true);
assert.equal(checkpoints, 1, 'No-op edits do not add undo entries');
assert.equal(run('updateFloorplanOpening(windowObject,{length:230})'), false, 'Overlapping an existing door is rejected');
assert.equal(run('updateFloorplanOpening(windowObject,{offset:500})'), false, 'Openings cannot extend past the host');
assert.equal(run('updateFloorplanOpening(windowObject,{length:-600})'), false, 'Existing opening lengths must be positive');
assert.equal(windowObject.data.length, 150, 'Rejected edits preserve all previous values');
assert.equal(checkpoints, 1);

// Opening and wall thickness are one shared measurement, updated in one undo operation.
const beforeDepthPoints = JSON.stringify(objects[0].points), depthCheckpoint = checkpoints;
assert.equal(run('updateFloorplanOpening(windowObject,{depth:16})'), true);
assert.equal(objects[0].strokeWidth, 16);
assert.equal(windowObject.data.depth, 16);
assert.equal(doorObject.data.depth, 16, 'Every opening on the same host shares its thickness');
assert.equal(objects[0].data.thicknessManual, true, 'Opening edits override automatic wall-thickness defaults');
assert.equal(JSON.stringify(objects[0].points), beforeDepthPoints, 'Thickness changes preserve the centreline');
assert.equal(checkpoints, depthCheckpoint + 1, 'Host and opening changes share one undo checkpoint');
objects[0].strokeWidth = 20;
run('syncFloorplanOpenings()');
assert.equal(windowObject.data.depth, 20, 'Direct wall thickness edits propagate into the window');
assert.equal(doorObject.data.depth, 20, 'Direct wall thickness edits propagate into the door');
assert.equal(checkpoints, depthCheckpoint + 1, 'Synchronizing geometry does not add an undo checkpoint');

// Doors offer all four hinge/swing combinations without altering wall lengths.
const beforeDoorEdit = JSON.stringify(objects[0]);
assert.equal(run('updateFloorplanOpening(doorObject,{hinge:"end",swing:-1})'), true);
assert.equal(doorObject.data.hinge, 'end'); assert.equal(doorObject.data.swing, -1);
close(doorObject.left, 345); close(doorObject.top, -45);
assert.equal(JSON.stringify(objects[0]), beforeDoorEdit);

// Hosted objects translate and rotate with a wall, keeping their measured offset.
objects[0].points = [{ x: 50, y: 50 }, { x: 50, y: 650 }];
run('syncFloorplanOpenings()');
close(windowObject.left, 50); close(windowObject.top, 225); close(windowObject.angle, 90);
close(doorObject.left, 95); close(doorObject.top, 395);
assert.equal(typeof windowObject._render, 'function', 'Rendering is restored from persisted data');
assert.equal(run('validateFloorplanOpenings([{wall:canvas.getObjects()[0],points:[{x:0,y:0},{x:200,y:0}],thickness:20}])'), false, 'Graph edits may not clip hosted objects');

// A merge preserves world positions even when both origin and direction change.
objects[0].points = [{ x: 0, y: 0 }, { x: 600, y: 0 }];
const extension = wall('extension', -300, 0, 0, 0);
objects.push(extension);
const extensionOpening = opening('window', 'extension', 50, 100);
objects.push(extensionOpening);
context.extension = extension;
run('rehostFloorplanOpenings(extension,canvas.getObjects()[0],[{x:600,y:0},{x:-300,y:0}])');
close(windowObject.data.offset, 350);
close(doorObject.data.offset, 210);
close(extensionOpening.data.offset, 750);
assert.equal(extensionOpening.data.hostWallId, 'host');
assert.equal(windowObject.data.hinge, 'end'); assert.equal(windowObject.data.swing, -1);
objects[0].points = [{ x: 600, y: 0 }, { x: -300, y: 0 }];
objects.splice(objects.indexOf(extension), 1);
run('syncFloorplanOpenings()');
close(windowObject.left, 175); close(windowObject.top, 0);
close(extensionOpening.left, -200);

// New openings cannot erase a T-junction; existing junction-free wall intervals are usable.
objects.push(wall('branch', 175, 0, 175, 200));
assert.equal(run('validateFloorplanOpenings()'), false);
assert.match(run('openingLastError'), /connecting wall/);
objects.pop();

// Thickness coupling must reject new conflicts atomically, including a 45-degree junction.
objects.push(wall('angled-branch', 280, 0, 80, 200));
assert.equal(run('validateFloorplanOpenings()'), true);
const beforeRejectedThickness = JSON.stringify(objects), beforeRejectedCheckpoint = checkpoints;
assert.equal(run('updateFloorplanOpening(windowObject,{depth:40})'), false);
assert.match(run('openingLastError'), /connecting wall/);
assert.equal(JSON.stringify(objects), beforeRejectedThickness);
assert.equal(checkpoints, beforeRejectedCheckpoint);
objects.pop();
assert.equal(run('validateFloorplanOpenings()'), true);
objects.push(wall('near-branch', 255, 0, 255, 200));
assert.equal(run('validateFloorplanOpenings()'), false, 'The branch thickness must fit beside the opening, even when its centreline is outside');
objects[objects.length - 1].points = [{ x: 260, y: 0 }, { x: 260, y: 200 }];
assert.equal(run('validateFloorplanOpenings()'), true, 'An opening can end exactly at the branch face');
objects.pop();

// Both raster and vector exports retain actual window frames and door swings.
const symbolContext = {
  arcs: [], fills: [], beginPath() {}, save() {}, restore() {}, setLineDash() {}, fillRect(...values) { this.fills.push(values); }, strokeRect() {}, moveTo() {}, lineTo() {}, stroke() {},
  arc(...values) { this.lastArc = values; this.arcs.push(values); }
};
context.symbolContext = symbolContext;
for (const hinge of ['start', 'end']) {
  for (const swing of [-1, 1]) {
    context.symbolData = { kind: 'door', length: 90, depth: 20, hinge, swing };
    run('renderOpeningSymbol(symbolContext,symbolData,20)');
    assert.equal(symbolContext.lastArc[2], 90);
    assert.equal(symbolContext.lastArc[5], hinge === 'start' ? swing < 0 : swing > 0);
    assert.match(run('openingSvgSymbol(symbolData,20)'), / A 90 90 0 0 [01] /);
  }
}
assert.match(run('openingSvgSymbol(windowObject.data,20)'), /<rect/);
assert.match(windowObject._toSVG().join(''), /COMMON_PARTS/);

// Door variants retain the correct symbol in both the canvas and vector export.
for (const doorType of ['single', 'double', 'garage', 'sliding', 'opening']) {
  context.symbolData = { kind: 'door', doorType, length: 180, depth: 20, hinge: 'start', swing: 1 };
  symbolContext.arcs = []; symbolContext.fills = [];
  run('renderOpeningSymbol(symbolContext,symbolData,20)');
  const expectedArcs = doorType === 'double' ? 2 : doorType === 'single' ? 1 : 0;
  assert.equal(symbolContext.arcs.length, expectedArcs, `${doorType} canvas arc count`);
  assert.equal((run('openingSvgSymbol(symbolData,20)').match(/ A /g) || []).length, expectedArcs, `${doorType} SVG arc count`);
  if (doorType === 'double') symbolContext.arcs.forEach(arc => close(arc[2], 90));
  assert.equal(symbolContext.fills.length, 1 + expectedArcs, 'White paint is limited to the wall cut and narrow leaves');
  assert.equal(symbolContext.fills[0][2], 180); close(symbolContext.fills[0][3], 21.4);
  symbolContext.fills.slice(1).forEach(fill => assert.ok(fill[2] <= 3, 'A swing sector never receives a white fill'));
  assert.equal(run(`updateFloorplanOpening(doorObject,{doorType:'${doorType}'})`), true);
  const extent = run('openingSwingExtent(doorObject.data)');
  close(doorObject.height, extent + objects[0].strokeWidth + 3);
  assert.equal(doorObject.data.doorType, doorType);
  const restored = opening('door', doorObject.data.hostWallId, doorObject.data.offset, doorObject.data.length);
  restored.data = JSON.parse(JSON.stringify(doorObject.data));
  context.restored = restored;
  run('installOpeningRenderer(restored); positionFloorplanOpening(restored,canvas.getObjects()[0])');
  assert.equal(typeof restored._render, 'function');
  assert.equal((restored._toSVG().join('').match(/ A /g) || []).length, expectedArcs, 'Reload preserves the selected door symbol');
  close(restored.height, doorObject.height);
}
const beforeInvalidVariant = checkpoints;
assert.equal(run('updateFloorplanOpening(doorObject,{doorType:"invalid"})'), false);
assert.equal(checkpoints, beforeInvalidVariant);

// New doors select their symbol from the width, including exact boundary values.
for (const [width, expected] of [[90, 'single'], [100, 'single'], [100.1, 'double'], [189.9, 'double'], [190, 'garage'], [300, 'garage']]) {
  assert.equal(run(`automaticFloorplanDoorType(${width})`), expected);
  run(`openingDraft={kind:'door',wall:canvas.getObjects()[0],startOffset:500,endOffset:${500 - width}}`);
  assert.equal(run('openingDraftData().doorType'), expected, 'Reverse drawing uses the same width thresholds');
}
assert.equal(run('openingMeasurementName({kind:"door"})'), 'width');
assert.equal(run('openingMeasurementName({kind:"window"})'), 'length');

// Mouse movement chooses the physical side, independently of draw direction or typed width.
run('floorplanRoomFaces=[{polygon:[{x:0,y:0},{x:400,y:0},{x:400,y:400},{x:0,y:400}],holes:[]}]');
for (const [ax, ay, bx, by, inward] of [[0,0,400,0,1],[400,0,0,0,-1],[0,400,400,400,-1],[400,400,0,400,1],
  [0,0,0,400,-1],[0,400,0,0,1],[400,0,400,400,1],[400,400,400,0,-1]]) {
  const testHost = wall('swing-host', ax, ay, bx, by);
  context.testHost = testHost;
  const basis = run('openingBasis(testHost.points)');
  for (const reverse of [false, true]) {
    run(`openingDraft={kind:'door',wall:testHost,startOffset:${reverse ? 190 : 100},endOffset:${reverse ? 100 : 190},typed:false}`);
    for (const side of [-1, 1]) {
      context.swingPoint = { x: ax + basis.u.x * 190 + basis.n.x * 35 * side, y: ay + basis.u.y * 190 + basis.n.y * 35 * side };
      run('updateOpeningDraftSwing(swingPoint)');
      assert.equal(run('openingDraftData().swing'), side);
      close(run('openingDraftData().length'), 90);
    }
    run('setOpeningDraftLength(90)');
    context.swingPoint = { x: ax + basis.u.x * 190 - basis.n.x * 35, y: ay + basis.u.y * 190 - basis.n.y * 35 };
    run('updateOpeningDraftSwing(swingPoint)');
    assert.equal(run('openingDraftData().swing'), -1, 'Typed widths still allow mouse-controlled swing');
    close(run('openingDraftData().length'), 90);
    context.swingPoint = { x: ax + basis.u.x * 190 + basis.n.x, y: ay + basis.u.y * 190 + basis.n.y };
    run('updateOpeningDraftSwing(swingPoint)');
    assert.equal(run('openingDraftData().swing'), -1, 'The centreline dead zone avoids flicker');
    run('setOpeningDraftLength(200)');
    assert.equal(run('openingDraftData().doorType'), 'garage');
    assert.equal(run('openingDraftData().swing'), inward, 'Garage tracks always face the room, in either drawing direction');
  }
  const garageObject = opening('door', 'swing-host', 100, 200);
  garageObject.data.doorType = 'garage'; garageObject.data.swing = -inward;
  context.garageObject = garageObject; objects.push(testHost, garageObject);
  run('installOpeningRenderer(garageObject); positionFloorplanOpening(garageObject,testHost)');
  assert.equal(garageObject.data.swing, inward, 'Reload repairs a garage facing outside');
  assert.equal(run(`updateFloorplanOpening(garageObject,{swing:${-inward}})`), true);
  assert.equal(garageObject.data.swing, inward, 'Edits cannot turn a garage towards the exterior');
  objects.splice(-2);
}
run('floorplanRoomFaces[0].holes=[[{x:80,y:80},{x:300,y:80},{x:300,y:300},{x:80,y:300}]]');
context.testHost = wall('courtyard', 80, 300, 300, 300);
assert.equal(run('openingInwardSide({offset:50,length:90},testHost)'), 1, 'A courtyard hole is outside, not a room interior');
run('floorplanRoomFaces=[]; openingDraft=null');

// The floating measurement avoids the whole symbol and the pointer, even near viewport edges.
const overlaps = (centre, bounds) => Math.min(centre.x + 92, bounds.right) > Math.max(centre.x - 92, bounds.left) &&
  Math.min(centre.y + 37, bounds.bottom) > Math.max(centre.y - 37, bounds.top);
for (const [bounds, normal, pointer] of [
  [{left:220,right:310,top:190,bottom:300},{x:0,y:-1},{x:310,y:200}],
  [{left:220,right:330,top:170,bottom:260},{x:-1,y:0},{x:220,y:170}],
  [{left:15,right:125,top:15,bottom:105},{x:-1,y:0},{x:30,y:15}],
  [{left:660,right:790,top:480,bottom:590},{x:1,y:0},{x:790,y:580}],
  [{left:280,right:430,top:220,bottom:370},{x:Math.SQRT1_2,y:-Math.SQRT1_2},{x:350,y:290}]
]) {
  Object.assign(context, { editorBounds: bounds, editorNormal: normal, editorPointer: pointer });
  const position = plain(run('openingEditorPosition({x:300,y:250},editorBounds,184,74,800,600,editorNormal,editorPointer)'));
  assert.equal(overlaps(position, bounds), false, 'The width editor cannot cover the door footprint');
  assert.equal(overlaps(position, {left:pointer.x-18,right:pointer.x+18,top:pointer.y-18,bottom:pointer.y+18}), false, 'The placement pointer remains clear');
  assert.ok(position.x >= 102 && position.x <= 698 && position.y >= 47 && position.y <= 553, 'The input stays in the viewport');
}
for (const swing of [-1,1]) {
  context.boundsData = {kind:'door',doorType:'single',length:90,depth:20,swing};
  const bounds = plain(run('openingSymbolBounds(boundsData,20)'));
  assert.equal(bounds[swing < 0 ? 'top' : 'bottom'], swing * 100, 'Collision bounds include the complete swing arc');
}

// Sliding doors retain position and direction on reload, with a pocket or an exterior rail.
const beforeSlidingHost = JSON.stringify(objects[0]);
assert.equal(run('updateFloorplanOpening(doorObject,{offset:130})'), true);
for (const slidingPosition of ['pocket', 'side-a', 'side-b']) {
  for (const hinge of ['start', 'end']) {
    assert.equal(run(`updateFloorplanOpening(doorObject,{doorType:'sliding',slidingPosition:'${slidingPosition}',hinge:'${hinge}'})`), true);
    const slider = plain(run('openingSlidingGeometry(doorObject.data,20)'));
    close(slider.x, hinge === 'end' ? doorObject.data.length / 2 : -doorObject.data.length * 1.5);
    close(slider.y, slidingPosition === 'pocket' ? 0 : slidingPosition === 'side-a' ? -16 : 16);
    const svg = run('openingSvgSymbol(doorObject.data,20)');
    assert.equal(svg.includes('stroke-dasharray'), slidingPosition === 'pocket');
    assert.doesNotMatch(svg, / A /, 'Sliding doors never draw a swinging arc');
    assert.equal(doorObject.data.slidingPosition, slidingPosition);
    const restored = opening('door', doorObject.data.hostWallId, doorObject.data.offset, doorObject.data.length);
    restored.data = JSON.parse(JSON.stringify(doorObject.data)); context.restored = restored;
    run('installOpeningRenderer(restored); positionFloorplanOpening(restored,canvas.getObjects()[0])');
    close(restored.width, doorObject.data.length * 2 + 3);
    close(restored.left, doorObject.left); close(restored.top, doorObject.top);
  }
}
assert.equal(JSON.stringify(objects[0]), beforeSlidingHost, 'Sliding style edits preserve the wall');
assert.equal(run('updateFloorplanOpening(doorObject,{slidingPosition:"invalid"})'), false);
assert.equal(run('updateFloorplanOpening(doorObject,{length:100})'), true);
assert.equal(doorObject.data.doorType, 'sliding', 'Editing width preserves an explicitly selected door style');

// A pocket must fit along the same wall, clear of windows and connecting walls.
const pocketHost = wall('pocket-host', 1000, 0, 1000, 360);
const pocketDoor = opening('door', 'pocket-host', 90, 130);
pocketDoor.data.doorType = 'double';
objects.push(pocketHost, pocketDoor); context.pocketDoor = pocketDoor;
assert.equal(run('updateFloorplanOpening(pocketDoor,{doorType:"sliding"})'), true);
assert.equal(pocketDoor.data.hinge, 'end', 'The default direction flips when the first pocket would extend beyond the wall');
assert.equal(run('openingSlidingPosition(pocketDoor.data)'), 'pocket');
const beforePocketRejected = JSON.stringify(pocketDoor), pocketUndo = checkpoints;
assert.equal(run('updateFloorplanOpening(pocketDoor,{hinge:"start"})'), false);
assert.match(run('openingLastError'), /past its wall/);
assert.equal(JSON.stringify(pocketDoor), beforePocketRejected); assert.equal(checkpoints, pocketUndo);
context.pocketCandidate = { kind: 'window', hostWallId: 'pocket-host', offset: 250, length: 40, depth: 20 };
assert.match(run('openingPlacementError(pocketCandidate)'), /wall pocket/);
objects.push(wall('pocket-branch', 1000, 300, 1200, 300));
assert.equal(run('validateFloorplanOpenings()'), false);
assert.match(run('openingLastError'), /pocket crosses/);
objects.pop();
assert.equal(run('updateFloorplanOpening(pocketDoor,{doorType:"double",offset:120})'), true);
assert.equal(run('updateFloorplanOpening(pocketDoor,{doorType:"sliding"})'), true);
assert.equal(pocketDoor.data.slidingPosition, 'side-a', 'A side-mounted door is the usable default if neither pocket direction fits');
assert.equal(run('updateFloorplanOpening(pocketDoor,{slidingPosition:"pocket"})'), false, 'An explicit invalid pocket choice is rejected');
objects.splice(objects.indexOf(pocketHost), 2);

// Standalone placement preserves cm geometry while accepting the current display units.
assert.deepEqual(plain(run('openingSnapPoint({x:123,y:88})')), { x: 120, y: 90 });
const diagonal = plain(run('openingSnapPoint({x:118,y:113},{x:0,y:0})'));
close(diagonal.x, diagonal.y); close(diagonal.x / 10, Math.round(diagonal.x / 10));
run('openingDraft={kind:"door",wall:null,startPoint:{x:20,y:30},endPoint:{x:20,y:130},depth:18,typed:false}; setOpeningDraftLength(floorplanFromDisplayLength("1300"))');
let freeData = plain(run('openingDraftData()'));
assert.equal(freeData.hostWallId, null); close(freeData.length, 130); close(freeData.angle, 90);
assert.equal(freeData.doorType, 'double'); close(freeData.x, 20); close(freeData.y, 95);
run('setOpeningDraftLength(floorplanFromDisplayLength("-600"))');
freeData = plain(run('openingDraftData()')); close(freeData.length, 60); close(freeData.angle, -90);
run('setOpeningDraftLength(floorplanFromDisplayLength("-600"))');
assert.deepEqual(plain(run('openingDraftData()')), freeData, 'Negative typed lengths never alternate direction');
run('floorplanUnit="cm"; setOpeningDraftLength(floorplanFromDisplayLength("130,5"))');
close(run('openingDraftData().length'), 130.5); run('floorplanUnit="mm"');
const freeObject = opening('door', null, 0, 130);
freeObject.data = { ...plain(run('openingDraftData()')), id: 'standalone-door' };
context.freeObject = freeObject; objects.push(freeObject);
run('installOpeningRenderer(freeObject); positionFloorplanOpening(freeObject,null)');
assert.equal(freeObject.lockMovementX, false); assert.equal(freeObject.lockRotation, false);
assert.equal(run('validateFloorplanOpenings()'), true);
const freeCenter = [freeObject.data.x, freeObject.data.y], freeUndo = checkpoints;
assert.equal(run('updateFloorplanOpening(freeObject,{length:140,depth:16,angle:45})'), true);
assert.equal(checkpoints, freeUndo + 1); assert.deepEqual([freeObject.data.x, freeObject.data.y], freeCenter);
close(freeObject.angle, 45); assert.match(freeObject._toSVG().join(''), /COMMON_PARTS/);
run('freeObject.left+=23; freeObject.top+=37; syncStandaloneOpeningTransform(freeObject)');
close(freeObject.data.x / 10, Math.round(freeObject.data.x / 10)); close(freeObject.data.y / 10, Math.round(freeObject.data.y / 10));
const rotatedCenter = [freeObject.data.x, freeObject.data.y];
run('freeObject.angle=88; syncStandaloneOpeningTransform(freeObject,true)');
close(freeObject.data.angle, 90); assert.deepEqual([freeObject.data.x, freeObject.data.y], rotatedCenter);
const freeSaved = JSON.stringify(freeObject.data);
run('syncFloorplanOpenings()'); assert.equal(JSON.stringify(freeObject.data), freeSaved, 'Wall synchronization preserves standalone geometry');
const freeRestored = opening('door', null, 0, 140); freeRestored.data = JSON.parse(freeSaved); context.freeRestored = freeRestored;
run('installOpeningRenderer(freeRestored); positionFloorplanOpening(freeRestored,null)');
close(freeRestored.left, freeObject.left); close(freeRestored.top, freeObject.top); close(freeRestored.angle, 90);
let savedTransform;
context.wallCheckpoint = () => { checkpoints++; savedTransform = JSON.stringify({ left: freeObject.left, top: freeObject.top, data: freeObject.data }); };
const beforeMove = JSON.stringify({ left: freeObject.left, top: freeObject.top, data: freeObject.data });
run('openingTransformState={object:freeObject,left:freeObject.left,top:freeObject.top,angle:freeObject.angle,data:{...freeObject.data},recorded:false}; freeObject.left+=40; checkpointOpeningTransform(freeObject); syncStandaloneOpeningTransform(freeObject)');
assert.equal(savedTransform, beforeMove, 'Drag undo captures the geometry before Fabric moved the object');
const moveUndo = checkpoints;
run('freeObject.left+=10; checkpointOpeningTransform(freeObject); syncStandaloneOpeningTransform(freeObject)');
assert.equal(checkpoints, moveUndo, 'A whole drag creates one undo step');
context.wallCheckpoint = () => checkpoints++;

// Dimension visibility clears the overlay without affecting saved opening geometry.
run('openingDimensionUI = {hidden:false, replaceChildren(){this.cleared=true;}}; var floorplanDimensionsVisible = false; renderOpeningDimensions()');
assert.equal(run('openingDimensionUI.hidden'), true);
assert.equal(run('openingDimensionUI.cleared'), true);
run('openingDimensionUI.cleared=false; renderOpeningDimensions({ctx:{}})');
assert.equal(run('openingDimensionUI.cleared'), false, 'Thumbnail/export rendering cannot reposition live measurement overlays');

// Negative typed lengths have a stable direction rather than oscillating on render.
run('openingDraft={kind:"window",wall:canvas.getObjects()[0],startOffset:500,endOffset:200,typed:true,typedDirection:1}');
assert.equal(run('openingDraftData().length'), 300);
assert.equal(run('openingDraftData().offset'), 200);
assert.equal(run('openingDraftData().hinge'), 'end');

// Defer initial input focus until Fabric's pointer-down handling has finished.
const focusFrames = [];
let openingFocusCount = 0, openingSelectCount = 0;
const inputStub = { tagName: 'INPUT', focus() { openingFocusCount++; context.document.activeElement = this; }, select() { openingSelectCount++; } };
context.document = { activeElement: { tagName: 'BODY' } };
context.requestAnimationFrame = callback => focusFrames.push(callback);
context.inputStub = inputStub;
run('openingLengthInput=inputStub; openingLengthEditor={hidden:false}; openingDraft={}; focusNewOpeningDraft(openingDraft)');
assert.equal(openingFocusCount, 0, 'Focus cannot be overwritten by the rest of the pointer-down event');
focusFrames.shift()();
assert.equal(openingFocusCount, 1); assert.equal(openingSelectCount, 1);
context.document.activeElement = { tagName: 'BODY' };
run('focusNewOpeningDraft(openingDraft)'); focusFrames.shift()();
assert.equal(openingFocusCount, 1, 'Later redraws do not steal focus after the user blurs the field');
run('openingDraft={}; focusNewOpeningDraft(openingDraft); openingDraft=null'); focusFrames.shift()();
assert.equal(openingFocusCount, 1, 'A cancelled draft cannot focus its stale editor');
context.document.activeElement = { tagName: 'INPUT' };
run('openingDraft={}; focusNewOpeningDraft(openingDraft)'); focusFrames.shift()();
assert.equal(openingFocusCount, 1, 'A deliberate focus move to another control is respected');

// Deleting a host removes only its openings; loaded objects remain JSON-serializable.
assert.doesNotThrow(() => JSON.stringify(windowObject));
objects.splice(0, 1);
run('syncFloorplanOpenings()');
assert.equal(objects.length, 1); assert.equal(objects[0], freeObject, 'Standalone openings survive deleting an unrelated wall');

// Opening measurements use the shared double-click editor, anchored to their label.
const dimensionHelpers = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages/floorplan-dimensions.js'), 'utf8'), dimensionHelpers);
context.bindFloorplanDimensionEditing = dimensionHelpers.bindFloorplanDimensionEditing;
context.floorplanMeasurementEditorPosition = dimensionHelpers.floorplanMeasurementEditorPosition;
run(`
  function openingTestElement(tag){return{tag,style:{},handlers:{},children:[],setAttribute(){},
    addEventListener(name,handler){this.handlers[name]=handler;},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}};}
  document={activeElement:null,createElement:openingTestElement};
  currentTool='select'; canvas.width=800;canvas.height=600;canvas.viewportTransform=[1,0,0,1,350,200];
  canvas.setActiveObject=object=>{canvas.activeObject=object;};
  fabric.util={transformPoint:p=>({x:p.x+350,y:p.y+200})};
  openingDraft=null;openingEditObject=null;openingEditAnchor=null;floorplanDimensionsVisible=true;
  openingDimensionUI=openingTestElement('div');openingLengthEditor={hidden:true,style:{},offsetWidth:184,offsetHeight:74};
  openingLengthInput={value:'',setCustomValidity(){},focus(){document.activeElement=this;},select(){}};openingLengthCaption={};
  renderOpeningDimensions();
  let openingButton=openingDimensionUI.children[0],dimensionEvent={detail:1,stopPropagation(){},preventDefault(){}};
  openingButton.handlers.click(dimensionEvent);
`);
assert.equal(run('openingLengthEditor.hidden'), true);
assert.equal(run('openingEditObject'), null);
run('openingButton.handlers.dblclick(dimensionEvent)');
assert.equal(run('openingLengthEditor.hidden'), false);
close(run('parseFloat(openingLengthEditor.style.left)'), run('parseFloat(openingButton.style.left)'));
close(run('parseFloat(openingLengthEditor.style.top)'), run('parseFloat(openingButton.style.top)'));
assert.equal(run('canvas.activeObject===freeObject'), true);
run("openingLengthEditor.hidden=true;openingButton.handlers.keydown({...dimensionEvent,key:'Enter'})");
assert.equal(run('openingLengthEditor.hidden'), false);
console.log('Opening snapping, placement, edits, overlap validation, hosting, door swings, merges and deletion checks passed.');

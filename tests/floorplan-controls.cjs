const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages/floorplan-controls.js'), 'utf8'), ctx);
const run = source => vm.runInContext(source, ctx);

// CSS scale is applied before the viewport inverse, regardless of display DPI.
for (const cssScale of [.75, 1, 1.25]) for (const zoom of [.5, 1, 2.5]) {
  const world = {x:125,y:-90}, width=800,height=600,tx=330,ty=210;
  ctx.pointerEvent={clientX:12+(world.x*zoom+tx)*cssScale,clientY:85+(world.y*zoom+ty)*cssScale};
  ctx.bounds={left:12,top:85,width:width*cssScale,height:height*cssScale};
  ctx.viewport=[zoom,0,0,zoom,tx,ty];
  const point=run('floorplanPointerCoordinates(pointerEvent,bounds,800,600,viewport)');
  assert.ok(Math.abs(point.x-world.x)<1e-8&&Math.abs(point.y-world.y)<1e-8,'Selection and drag points must stay under the cursor after pan/zoom');
  const screen=run('floorplanPointerCoordinates(pointerEvent,bounds,800,600,viewport,true)');
  assert.ok(Math.abs(screen.x-(world.x*zoom+tx))<1e-8&&Math.abs(screen.y-(world.y*zoom+ty))<1e-8);
}
ctx.pointerCanvas={width:800,height:600,viewportTransform:[2,0,0,2,300,200],
  upperCanvasEl:{width:1000,height:750,getBoundingClientRect:()=>({left:20,top:40,width:600,height:450})},
  getPointer:()=>({x:-999,y:-999})};
run('installFloorplanPointerMapping(pointerCanvas)');
assert.deepEqual(JSON.parse(JSON.stringify(run('pointerCanvas.getPointer({clientX:320,clientY:265})'))),{x:50,y:50});
assert.deepEqual(JSON.parse(JSON.stringify(run('pointerCanvas.getPointer({touches:[{clientX:320,clientY:265}]})'))),{x:50,y:50});

// Restacking changes only display order, and preserves order inside each layer.
const objects = ['room', 'symbol', 'wall', 'door', 'stair', 'symbol', 'window', 'wall'].map((kind, index) => ({data:{kind,id:String(index),groupId:'group-a'}}));
const geometry = new Map(objects.map(object => [object, JSON.stringify(object)]));
ctx.canvas = { renderOnAddRemove: true, getObjects: () => objects,
  moveTo(object, index) { assert.equal(this.renderOnAddRemove, false); objects.splice(objects.indexOf(object), 1); objects.splice(index, 0, object); } };
run('syncFloorplanObjectLayers()');
assert.deepEqual(objects.map(object => object.data.kind), ['stair','symbol','symbol','wall','wall','door','window','room']);
assert.deepEqual(objects.filter(object => object.data.kind === 'symbol').map(object => object.data.id), ['1','5']);
objects.forEach(object => assert.equal(JSON.stringify(object), geometry.get(object), 'Drawing order cannot change geometry or grouping'));
assert.equal(ctx.canvas.renderOnAddRemove, true);
ctx.canvas.moveTo = () => { throw Error('An unchanged drawing should not be restacked'); };
run('syncFloorplanObjectLayers()');

// The curved control retains Fabric's rotate/snap action and never changes shared defaults.
const rotate = () => 'rotate';
const shared = { mtr: { actionHandler: rotate, actionName: 'rotate', x: 0, y: -.5 }, br: {} };
const makeObject = data => ({ data, controls: shared, setCoords() { this.coordsUpdated = true; } });
ctx.symbol = makeObject({kind:'symbol'}); ctx.other = makeObject({kind:'symbol'});
ctx.hosted = makeObject({kind:'door',hostWallId:'wall-1'});
run('installFloorplanRotationControl(symbol); installFloorplanRotationControl(hosted)');
assert.equal(ctx.symbol.controls.mtr.actionHandler, rotate);
assert.equal(ctx.symbol.controls.mtr.actionName, 'rotate');
assert.equal(ctx.symbol.controls.mtr.y, -.5);
assert.equal(ctx.symbol.controls.mtr.sizeX, 28);
assert.equal(ctx.symbol.coordsUpdated, true);
assert.equal(ctx.other.controls, shared);
assert.equal(ctx.hosted.controls, shared, 'Hosted doors keep their wall-constrained controls');
assert.equal(shared.mtr.render, undefined);
const installed = ctx.symbol.controls.mtr;
run('installFloorplanRotationControl(symbol)');
assert.equal(ctx.symbol.controls.mtr, installed, 'Reinstallation preserves control identity');
console.log('Control layering preserves geometry/grouping and curved rotation handles retain Fabric rotation actions.');

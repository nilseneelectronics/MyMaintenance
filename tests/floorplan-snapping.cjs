const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the production geometry and resolver together. The fake canvas only
// supplies storage and coordinate transforms; snapping and wall faces are real.
const objects = [], elements = {};
let zoom = 1;
class Line {
  constructor(points, options = {}) {
    Object.assign(this, { x1: points[0], y1: points[1], x2: points[2], y2: points[3],
      left: (points[0] + points[2]) / 2, top: (points[1] + points[3]) / 2,
      strokeWidth: 25, data: {} }, options);
  }
  set(key, value) { if (typeof key === 'string') this[key] = value; else Object.assign(this, key); }
  setCoords() {}
  calcLinePoints() { return { x1: this.x1 - this.left, y1: this.y1 - this.top, x2: this.x2 - this.left, y2: this.y2 - this.top }; }
  calcTransformMatrix() { return [1, 0, 0, 1, this.left, this.top]; }
}
const context = vm.createContext({ console, Math, Number, JSON, Date,
  currentTool: 'wall', snapEnabled: true, isPanning: false, isDirty: false,
  syncSaveButton() {},
  document: {
    getElementById(id) { return elements[id] ||= { value: '', textContent: '', hidden: true,
      setCustomValidity(value) { this.validationMessage = value; }, reportValidity() {},
      classList: { toggle() {} }, setAttribute() {} }; }
  },
  fabric: { Line, Point: function(x, y) { this.x = x; this.y = y; },
    util: { transformPoint: (p, matrix) => ({ x: p.x * matrix[0] + p.y * matrix[2] + matrix[4], y: p.x * matrix[1] + p.y * matrix[3] + matrix[5] }) } },
  canvas: { getZoom: () => zoom, getObjects: () => objects, requestRenderAll() {}, clearContext() {},
    add: object => objects.push(object), remove: object => objects.splice(objects.indexOf(object), 1),
    toJSON: () => ({ objects }), discardActiveObject() {}, getActiveObject: () => null }
});
const scripts = ['floorplan-units.js', 'floorplan-dimensions.js', 'floorplan-stairs.js', 'floorplan-rooms.js', 'floorplan-wall-obstacles.js', 'floorplan-walls.js'];
for (const filename of scripts) vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages', filename), 'utf8'), context, { filename });
const run = source => vm.runInContext(source, context);
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 0.001, `${message}: ${actual} != ${expected}`);
const samePoint = (actual, expected, message = '') => { assert.ok(actual, `${message}: expected a point`); near(actual.x, expected.x, message + ' x'); near(actual.y, expected.y, message + ' y'); };
const ray = (angle, start = { x: 0, y: 0 }, length = 200) => ({ x: start.x + Math.cos(angle * Math.PI / 180) * length, y: start.y + Math.sin(angle * Math.PI / 180) * length });
const addWall = (id, ax, ay, bx, by, thickness = 25) => {
  const object = new Line([ax, ay, bx, by], { strokeWidth: thickness, data: { id, kind: 'wall' } });
  objects.push(object); return object;
};
const addStair = (left, top, width, length, stairType = 'straight', angle = 0) => {
  const object = { left, top, angle, visible: true, data: { kind: 'stair', width, length, stairType, direction: 'forward' } };
  objects.push(object); return object;
};
function reset(start = null) {
  objects.length = 0; zoom = 1;
  context.testStart = start;
  run("wallStart=testStart; wallPointer=null; wallStartReference=null; wallLengthTyped=false; wallTypedDirection=null; wallThickness=15; wallDrawingThicknessManual=false; floorplanGridStep=10; snapEnabled=true; angleSnapEnabled=true; floorplanUnit='cm'");
}
const failures = [];
let checks = 0;
function test(name, fn) {
  try { fn(); checks++; }
  catch (error) { failures.push({ name, error }); console.error(`FAIL ${name}\n  ${error.message}`); }
}

for (const thickness of [25, 40, 60]) for (const scale of [1, 4]) for (const side of [-1, 1]) {
  test(`Visible ${thickness} cm host face connects at zoom ${scale}, side ${side}`, () => {
    reset({ x: 200, y: side * 200 }); zoom = scale;
    addWall('host', 0, 0, 500, 0, thickness);
    const point = context.wallSnap({ x: 200, y: side * thickness / 2 });
    samePoint(point, { x: 200, y: 0 });
    assert.equal(context.wallInteriorPoint(point, context.wallRecords()[0].points), true, 'The visible connection must create an actual centreline junction');
    const branch = { wall: {}, points: [{ x: 200, y: side * 200 }, point], thickness: 15 };
    const records = [...context.wallRecords(), branch];
    const face = context.wallFaceGeometry(branch, records).faces[0];
    near(face.points[1].y, side * thickness / 2, 'Joined branch must terminate flush at the host face');
  });
}

test('Choosing a start on a thick wall face preserves its along-wall grid point', () => {
  reset(); addWall('host', 0, 0, 500, 0, 60);
  samePoint(context.wallSnap({ x: 173, y: 30 }), { x: 170, y: 0 });
});

for (const scale of [1, 4]) test(`Inner corner maps visible 12.5 cm offsets to one shared node at zoom ${scale}`, () => {
  reset({ x: 200, y: 200 }); zoom = scale;
  addWall('top', 0, 0, 500, 0); addWall('left', 0, 500, 0, 0);
  samePoint(context.wallSnap({ x: 12.5, y: 12.5 }), { x: 0, y: 0 });
});

for (const angle of [20, 30, 60, 70, 110, 150, 200, 290]) test(`${angle} degree free wall remains free with angle assistance enabled`, () => {
  const start = { x: 35.5, y: -12.5 }, point = ray(angle, start);
  reset(start); run('snapEnabled=false');
  const constraint = context.wallDirectionConstraint(point, start);
  assert.equal(constraint.locked, false);
  samePoint(constraint.point, point);
  samePoint(context.wallSnap(point), point, 'Grid-disabled pointer direction must not be forced to 45 degrees');
});

for (const [angle, target] of [[4, 0], [7.5, 0], [82.5, 90], [94, 90], [173, 180], [187, 180], [263, 270], [356, 360], [40, 45], [50, 45], [130, 135], [230, 225], [310, 315]]) {
  test(`Magnetic ${angle} degree wall assists toward ${target} degrees`, () => {
    const start = { x: 35.5, y: -12.5 };
    reset(start); run('snapEnabled=false');
    const constrained = context.wallDirectionConstraint(ray(angle, start), start);
    assert.equal(constrained.locked, true);
    const direction = { x: constrained.point.x - start.x, y: constrained.point.y - start.y };
    const targetVector = ray(target, { x: 0, y: 0 }, 1);
    near(direction.x * targetVector.y - direction.y * targetVector.x, 0, 'Constrained vector follows the magnetic angle');
    assert.ok(direction.x * targetVector.x + direction.y * targetVector.y > 0, 'Magnetism cannot reverse the wall');
  });
}

for (const [angle, horizontal] of [[20, true], [30, true], [60, false], [70, false], [150, true], [240, false]]) test(`Shift keeps ${angle} degree input orthogonal`, () => {
  const start = { x: 25, y: 35 };
  reset(start); run('snapEnabled=false;angleSnapEnabled=false');
  const point = context.wallSnap(ray(angle, start), true);
  if (horizontal) near(point.y, start.y); else near(point.x, start.x);
});

test('A wall dragged beyond two hosts joins the first crossed wall', () => {
  reset({ x: 200, y: -200 });
  // Deliberately put the farther host first to avoid array-order targeting.
  addWall('far', 0, 100, 500, 100, 40); addWall('near', 0, 0, 500, 0, 25);
  samePoint(context.wallSnap({ x: 200, y: 150 }), { x: 200, y: 0 });
});

test('Clear-gap adjustment retains both the gap and the snapped end connection', () => {
  reset({ x: 207.5, y: 0 });
  const host = addWall('host', 0, 0, 500, 0), target = addWall('target', 400, 0, 400, 500);
  context.clearanceHost = host;
  run("wallStartReference={wall:clearanceHost,from:'a',clearance:200,side:1,point:{x:207.5,y:0}}");
  const point = context.resolveWallDraft({ x: 400, y: 192.5 });
  assert.ok(point, 'An unobstructed draft should resolve');
  const records = context.wallRecords(), targetRecord = records.find(record => record.wall === target);
  assert.equal(context.wallInteriorPoint(point, targetRecord.points), true, 'Clearance adjustment must not pull the endpoint away from the target wall');
  const start = plain(run('wallStart'));
  assert.equal(context.wallInteriorPoint(start, records[0].points), true);
  near(point.x - start.x, point.y - start.y, 'The 45 degree direction survives both end constraints');
  const draft = { wall: {}, points: [start, point], thickness: 15 };
  const hostFace = context.wallFaceGeometry(records[0], [...records, draft]).faces.find(face => face.side === 1);
  near(hostFace.segments[0].length, 200, 'The selected clear gap remains exact');
});

test('The production resolver stops a wall at the first occupied stair edge', () => {
  reset({ x: -200, y: 0 });
  const stair = addStair(150, 0, 100, 200);
  const point = context.resolveWallDraft({ x: 250, y: 0 });
  samePoint(point, { x: 100, y: 0 });
  assert.equal(context.wallIntersectsStairs(plain(run('wallStart')), point, run('wallThickness'), [stair]), false);
});

test('A free parallel wall moves its full thickness flush against the stair side', () => {
  reset({ x: -100, y: -5 });
  run('wallThickness=20;wallDrawingThicknessManual=true');
  const stair = addStair(50, 100, 100, 200);
  const point = context.resolveWallDraft({ x: 200, y: -5 });
  samePoint(plain(run('wallStart')), { x: -100, y: -10 });
  samePoint(point, { x: 200, y: -10 });
  assert.equal(context.wallIntersectsStairs(plain(run('wallStart')), point, 20, [stair]), false);
});

test('A wall may use the empty inside corner of the actual L stair footprint', () => {
  reset({ x: 150, y: 150 });
  const stair = addStair(100, 150, 200, 300, 'quarter');
  const point = context.resolveWallDraft({ x: 300, y: 150 });
  samePoint(point, { x: 300, y: 150 });
  samePoint(plain(run('wallStart')), { x: 150, y: 150 });
  assert.equal(context.wallIntersectsStairs(plain(run('wallStart')), point, run('wallThickness'), [stair]), false);
});

test('Stair side fitting never detaches a wall from its host', () => {
  reset({ x: 200, y: 0 });
  addWall('host', 0, 0, 500, 0);
  const stair = addStair(250, 200, 100, 100);
  const point = context.resolveWallDraft({ x: 200, y: 400 });
  samePoint(plain(run('wallStart')), { x: 200, y: 0 });
  samePoint(point, { x: 200, y: 150 });
  assert.equal(context.wallIntersectsStairs(plain(run('wallStart')), point, run('wallThickness'), [stair]), false);
});

test('An invalid start inside stairs is rejected without mutating its anchor', () => {
  reset({ x: 150, y: 150 });
  addStair(150, 150, 300, 300);
  assert.equal(context.resolveWallDraft({ x: 400, y: 150 }), null);
  samePoint(plain(run('wallStart')), { x: 150, y: 150 });
  assert.match(run('wallDraftError'), /stair/i);
});

if (failures.length) {
  console.error(`${failures.length} snapping regressions failed; ${checks} checks passed.`);
  process.exitCode = 1;
} else console.log(`Wall snapping: ${checks} thick-face, corner, free-angle, magnetic-angle, first-crossing, clear-gap and stair-contact checks passed.`);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.handlers = {}; this.attributes = {}; this.style = {}; this.dataset = {}; this.hidden = false; this.offsetWidth = 230; this.offsetHeight = 330; }
  append(...nodes) { nodes.forEach(node => { node.parentNode = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); }
  dispatch(name, values = {}) {
    const event = { target: this, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...values };
    for (const handler of this.handlers[name] || []) { handler(event); if (event.stopped) break; }
    return event;
  }
  contains(node) { return node === this || this.children.some(child => child.contains?.(node)); }
  closest() { return ['input', 'select', 'textarea'].includes(this.tag) ? this : null; }
  querySelectorAll(selector) {
    const all = this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]);
    return selector === 'button:not(:disabled)' ? all.filter(child => child.tag === 'button' && !child.disabled) : [];
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
}
class ObjectShape {
  constructor(values) { Object.assign(this, { left: 0, top: 0, width: 40, height: 40, angle: 0, visible: true }, values); }
  set(key, value) { if (typeof key === 'string') this[key] = value; else Object.assign(this, key); }
  setCoords() {}
  getCoords() {
    const angle = this.angle * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ x: this.left + x * this.width / 2 * cos - y * this.height / 2 * sin, y: this.top + x * this.width / 2 * sin + y * this.height / 2 * cos }));
  }
  calcLinePoints() { return { x1: this.x1 - this.left, y1: this.y1 - this.top, x2: this.x2 - this.left, y2: this.y2 - this.top }; }
  calcTransformMatrix() { return [1, 0, 0, 1, this.left, this.top]; }
}
const objects = [], events = {}, elements = {};
const document = new Element('document');
document.getElementById = id => elements[id] ||= new Element();
document.createElement = tag => new Element(tag);
document.querySelectorAll = () => [];
const upper = new Element('canvas');
let active = null, offsetChecks = 0;
const canvas = {
  width: 800, height: 600, upperCanvasEl: upper, viewportTransform: [2, 0, 0, 2, 120, 90],
  getZoom: () => 2, getObjects: () => objects, calcOffset() { offsetChecks++; },
  getPointer(event, screen = false) {
    // Simulate the app at CSS zoom .75 with an offset canvas and panned/zoomed viewport.
    const point = { x: (event.clientX - 30) / 0.75, y: (event.clientY - 45) / 0.75 };
    return screen ? point : { x: (point.x - 120) / 2, y: (point.y - 90) / 2 };
  },
  findTarget: event => event.hit,
  getActiveObject: () => active,
  getActiveObjects: () => active ? [active] : [],
  setActiveObject(object) { const previous = active; active = object; this.fire(previous ? 'selection:updated' : 'selection:created', {}); },
  discardActiveObject() { if (active) { active = null; this.fire('selection:cleared', {}); } },
  on(name, handler) { (events[name] ||= []).push(handler); },
  fire(name, event) { for (const handler of events[name] || []) handler(event); },
  remove(object) { objects.splice(objects.indexOf(object), 1); this.fire('object:removed', { target: object }); },
  requestRenderAll() {}, clearContext() {},
  toJSON() { return { objects: objects.map(object => ({ ...object })) }; },
  loadFromJSON(data, done) { objects.splice(0, objects.length, ...data.objects.map(object => new ObjectShape(object))); active = null; done(); }
};
const context = vm.createContext({ console, Math, Date, Number, JSON, Map, Set, document, canvas,
  currentTool: 'select', snapEnabled: true, isPanning: false, isDirty: false,
  fabric: { Point: function(x, y) { this.x = x; this.y = y; }, util: { transformPoint: (point, matrix) => ({ x: point.x + matrix[4], y: point.y + matrix[5] }) } },
  syncSaveButton() {}, refreshFloorplanInspector() {},
  setTool(tool) { context.currentTool = tool; context.syncFloorplanSelectionTool(tool); }
});
for (const file of ['floorplan-units.js', 'floorplan-dimensions.js', 'floorplan-openings.js', 'floorplan-walls.js', 'floorplan-selection.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages', file), 'utf8'), context);
}
const run = source => vm.runInContext(source, context);
run('refreshFloorplanGeometry=()=>{}; syncFloorplanOpenings=()=>{}; closeWallLengthEditor=()=>{}; closeWallStartOffset=()=>{}; cancelFloorplanOpening=()=>{}; restoreFloorplanSettings=()=>{}');
const symbol = (id, x, y, angle = 0) => new ObjectShape({ left: x, top: y, angle, data: { kind: 'symbol', id } });
const wall = (id, ax, ay, bx, by) => new ObjectShape({ x1: ax, y1: ay, x2: bx, y2: by, left: (ax + bx) / 2, top: (ay + by) / 2, strokeWidth: 15, data: { kind: 'wall', id } });
const pointer = (x, y, extra = {}) => ({ clientX: (x * 2 + 120) * 0.75 + 30, clientY: (y * 2 + 90) * 0.75 + 45, button: 0, ...extra });
const json = source => JSON.parse(run(`JSON.stringify(${source})`));
const ids = () => Array.from(context.floorplanSelectedObjects(), object => object.data.id).sort();

const a = symbol('a', 30, 30), b = symbol('b', 170, 50), c = symbol('c', 310, 50);
const room = symbol('room', 70, 40); room.data.kind = 'room';
const hidden = symbol('hidden', 100, 40); hidden.visible = false;
objects.push(a, b, c, room, hidden);
context.setupFloorplanSelection();
upper.dispatch('mousedown', pointer(-20, -20));
document.dispatch('mousemove', pointer(210, 90));
assert.deepEqual(json('floorplanSelectionGesture.origin'), { x: -20, y: -20 });
assert.deepEqual(json('floorplanSelectionGesture.point'), { x: 210, y: 90 }, 'Marquee uses canvas world coordinates under CSS/page/viewport zoom');
document.dispatch('mouseup', pointer(210, 90));
assert.deepEqual(ids(), ['a', 'b']);
assert.equal(active, null, 'Multiple selection never creates a Fabric ActiveSelection');
upper.dispatch('mousedown', pointer(310, 50, { hit: c, ctrlKey: true }));
assert.deepEqual(ids(), ['a', 'b', 'c'], 'Ctrl-click adds an item');
upper.dispatch('mousedown', pointer(30, 30, { hit: a, ctrlKey: true }));
assert.deepEqual(ids(), ['b', 'c'], 'Ctrl-click removes an item');
upper.dispatch('mousedown', pointer(30, 30, { hit: a, shiftKey: true }));
assert.deepEqual(ids(), ['a', 'b', 'c'], 'Shift additive selection remains supported');

const box = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];
assert.equal(context.floorplanPolygonInBox(box, { x: 20, y: -10 }, { x: 50, y: 50 }), false, 'Left-to-right requires the whole object');
assert.equal(context.floorplanPolygonInBox(box, { x: 50, y: -10 }, { x: 20, y: 50 }), true, 'Right-to-left selects an intersecting object');
const diagonal = [{ x: 0, y: -2 }, { x: 100, y: 98 }, { x: 100, y: 102 }, { x: 0, y: 2 }];
assert.equal(context.floorplanPolygonInBox(diagonal, { x: 100, y: 0 }, { x: 80, y: 20 }), false, 'Diagonal empty bounding-box space is not treated as painted wall');

context.setFloorplanSelection([a, b]);
assert.equal(context.groupFloorplanSelection(), true);
assert.equal(a.data.groupId, b.data.groupId);
assert.equal(objects.length, 5, 'Grouping preserves top-level objects');
context.setFloorplanSelection([a]);
assert.deepEqual(ids(), ['a', 'b'], 'Selecting a group member selects the whole group');
const historyBeforeMove = run('wallHistory.length');
upper.dispatch('mousedown', pointer(30, 30, { hit: a }));
document.dispatch('mousemove', pointer(60, 70));
document.dispatch('mousemove', pointer(70, 80));
document.dispatch('mouseup', pointer(70, 80));
assert.equal(a.left, 70); assert.equal(a.top, 80); assert.equal(b.left, 210); assert.equal(b.top, 100);
assert.equal(c.left, 310, 'Unselected objects do not move with the group');
assert.equal(run('wallHistory.length'), historyBeforeMove + 1, 'A drag uses one history entry');
context.undo();
assert.equal(objects.find(object => object.data.id === 'a').left, 30);
context.redo();
assert.equal(objects.find(object => object.data.id === 'a').left, 70);
assert.equal(objects.find(object => object.data.id === 'a').data.groupId, objects.find(object => object.data.id === 'b').data.groupId);
context.setFloorplanSelection([objects.find(object => object.data.id === 'a')]);
assert.equal(context.ungroupFloorplanSelection(), true);
assert.equal(objects.some(object => object.data?.groupId), false);
context.undo();
assert.ok(objects.find(object => object.data.id === 'a').data.groupId);
context.wallCheckpoint();
assert.equal(run('wallRedoHistory.length'), 0, 'A new edit invalidates redo');

context.setFloorplanSelection([objects.find(object => object.data.id === 'a')]);
context.deleteSelected();
assert.equal(objects.some(object => ['a', 'b'].includes(object.data.id)), false, 'Delete acts on all logical selected members');
context.undo();
assert.equal(objects.filter(object => ['a', 'b'].includes(object.data.id)).length, 2, 'Undo restores grouped deletion');

objects.length = 0;
const host = wall('host', 0, 0, 400, 0), neighbor = wall('neighbor', 400, 0, 400, 200);
const hosted = new ObjectShape({ left: 140, data: { kind: 'window', id: 'window', hostWallId: 'host', offset: 100, length: 80, depth: 15 } });
const free = new ObjectShape({ left: 500, top: 100, data: { kind: 'door', id: 'free', hostWallId: null, x: 500, y: 100, angle: 0, offset: 0, length: 90, depth: 15 } });
const table = symbol('table', 550, 170);
objects.push(host, neighbor, hosted, free, table);
context.clearFloorplanSelection();
const state = context.floorplanSelectionMoveState([host, hosted, table], { x: 0, y: 0 });
const plan = context.floorplanSelectionMovePlan(state, { x: 20, y: 40 });
assert.ok(plan);
assert.equal(plan.records[0].points[0].x, 20);
assert.equal(plan.records[1].points[0].x, 400, 'Unselected connected wall remains in place');
assert.equal(plan.placements.find(item => item.object === hosted).data.offset, 100, 'Hosted offset does not double-translate with its host');
assert.equal(plan.placements.find(item => item.object === table).left, 570);
const openingOnly = context.floorplanSelectionMoveState([hosted], { x: 0, y: 0 });
assert.equal(context.floorplanSelectionMovePlan(openingOnly, { x: 0, y: 10 }), null, 'Hosted openings cannot be dragged off their host');
assert.equal(context.floorplanSelectionMovePlan(openingOnly, { x: 350, y: 0 }), null, 'Hosted openings must still fit inside their wall');
assert.equal(context.floorplanSelectionMovePlan(openingOnly, { x: 20, y: 0 }).placements[0].data.offset, 120);
const standalone = context.floorplanSelectionMoveState([free, table], { x: 0, y: 0 });
assert.equal(context.floorplanSelectionMovePlan(standalone, { x: -50, y: 30 }).placements[0].data.x, 450);
assert.equal(context.floorplanSelectionMovePlan(standalone, { x: -50, y: 30 }).placements[0].data.y, 130);

context.setFloorplanSelection([free, table]);
const beforeCancel = run('wallHistory.length');
upper.dispatch('mousedown', pointer(500, 100, { hit: free }));
document.dispatch('mousemove', pointer(520, 130));
assert.equal(free.data.x, 520);
document.dispatch('keydown', { key: 'Escape' });
assert.equal(free.data.x, 500); assert.equal(table.left, 550);
assert.equal(run('wallHistory.length'), beforeCancel, 'Canceling a drag restores geometry and history');

const beforeMenuSelection = ids();
upper.dispatch('mousedown', pointer(100, 100, { button: 2 }));
upper.dispatch('contextmenu', pointer(100, 100, { button: 2 }));
assert.deepEqual(ids(), beforeMenuSelection, 'Right-click does not disturb the current selection');
assert.equal(run('floorplanSelectionGesture'), null);
assert.equal(run('floorplanSelectionMenu.style.left'), '320px', 'Menu is positioned in CSS canvas pixels rather than visual client pixels');
assert.equal(run('floorplanSelectionMenu.style.top'), '266px', 'Menu remains inside the visible canvas');
context.syncFloorplanSelectionTool('window'); context.syncFloorplanSelectionTool('select'); context.repeatFloorplanTool();
assert.equal(context.currentTool, 'window', 'Repeat retains the last drawing tool when switching back to Select');
context.resetWallSession();
assert.equal(run('wallHistory.length'), 0); assert.equal(run('wallRedoHistory.length'), 0); assert.equal(context.floorplanSelectedObjects().length, 0);
assert.ok(offsetChecks > 0);
console.log('CAD marquee/Ctrl selection, logical grouping, rigid moves, hosted constraints, CSS-scale coordinates, undo/redo, deletion, menu and repeat passed.');

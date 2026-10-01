const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class TestEvent {
  constructor(type, values = {}) { this.type = type; Object.assign(this, values); }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
}
class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attributes = {}; this.handlers = {};
    this.dataset = {}; this.hidden = false; this.disabled = false; this.textContent = '';
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle(value, active) { if (active ?? !classes.has(value)) classes.add(value); else classes.delete(value); }
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...nodes) { nodes.forEach(node => { this.insertBefore(node, null); }); }
  insertBefore(node, before) {
    if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
    node.parentNode = this;
    const index = before ? this.children.indexOf(before) : -1;
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
  }
  replaceChildren(...nodes) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...nodes); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  get options() { return this.children.filter(child => child.tag === 'option'); }
  get value() { return this._value ?? (this.tag === 'select' ? this.options[0]?.value || '' : ''); }
  set value(value) { this._value = String(value); }
  addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
  dispatchEvent(event) {
    event.target ||= this;
    for (const handler of this.handlers[event.type] || []) handler(event);
    if (event.bubbles && !event.stopped) this.parentNode?.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  focus() { document.activeElement = this; }
}
const body = new Element('body');
const document = new Element('document');
document.append(body);
document.createElement = tag => new Element(tag);
document.createElementNS = (_, tag) => new Element(tag);
document.getElementById = id => {
  const find = node => node.id === id ? node : node.children.map(find).find(Boolean);
  return find(body) || null;
};
const option = (value, text) => { const node = new Element('option'); node.value = value; node.textContent = text; return node; };
const units = new Element('select'); units.id = 'floorplanUnit'; units.setAttribute('aria-label', 'Measurement units');
units.append(option('mm', 'mm'), option('cm', 'cm'));
const unitLabel = new Element('label'); unitLabel.htmlFor = units.id; units.labels = [unitLabel];
const categories = new Element('select'); categories.id = 'floorplanSymbolCategory'; categories.setAttribute('aria-label', 'Symbol category');
categories.append(option('all', 'All categories'), option('Living', 'Living'), option('Kitchen', 'Kitchen'));
body.append(unitLabel, units, categories);
let unitChanges = 0, categoryChanges = 0;
units.addEventListener('change', () => { unitChanges++; });
categories.addEventListener('change', () => { categoryChanges++; });
const context = vm.createContext({ document, Event: TestEvent, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/pages/floorplan-dropdowns.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);
const state = id => run(`floorplanDropdowns.get('${id}')`);
const key = (target, name) => target.dispatchEvent(new TestEvent('keydown', { key: name, bubbles: true }));

context.setupFloorplanDropdowns();
const childCount = body.children.length;
context.setupFloorplanDropdowns();
assert.equal(body.children.length, childCount, 'Setup must not create duplicate controls');
assert.equal(units.hidden, true);
assert.equal(unitLabel.htmlFor, 'floorplanUnitToggle');
assert.equal(units.value, 'mm', 'Enhancement retains the original native value');

key(state(units.id).toggle, 'ArrowDown');
assert.equal(state(units.id).menu.hidden, false);
assert.equal(document.activeElement.dataset.value, 'mm');
key(document.activeElement, 'ArrowDown');
assert.equal(document.activeElement.dataset.value, 'cm');
key(document.activeElement, 'Enter');
assert.equal(units.value, 'cm');
assert.equal(unitChanges, 1, 'Keyboard selection dispatches the native change listener exactly once');
assert.equal(state(units.id).value.textContent, 'cm');
assert.equal(state(units.id).menu.hidden, true);
assert.equal(document.activeElement, state(units.id).toggle);

key(state(units.id).toggle, 'Enter');
key(document.activeElement, 'Home');
key(document.activeElement, 'Escape');
assert.equal(units.value, 'cm', 'Escape cancels navigation without changing units');
assert.equal(unitChanges, 1);
assert.equal(state(units.id).toggle.getAttribute('aria-expanded'), 'false');
units.value = 'mm'; context.syncFloorplanDropdowns();
assert.equal(state(units.id).value.textContent, 'mm', 'Loading a saved unit updates the custom label');
assert.equal(unitChanges, 1, 'Programmatic synchronization does not create user edits');

categories.append(option('Bedroom', 'Bedroom')); context.syncFloorplanDropdowns();
key(state(categories.id).toggle, ' ');
key(document.activeElement, 'End');
assert.equal(document.activeElement.dataset.value, 'Bedroom', 'Dynamic symbol categories are available');
key(document.activeElement, 'Enter');
assert.equal(categories.value, 'Bedroom');
assert.equal(categoryChanges, 1);
assert.equal(state(categories.id).buttons.at(-1).getAttribute('aria-selected'), 'true');
key(state(categories.id).toggle, 'Enter');
key(document.activeElement, 'k');
assert.equal(document.activeElement.dataset.value, 'Kitchen', 'Typing jumps to a matching option');
key(document.activeElement, 'Tab');
assert.equal(state(categories.id).menu.hidden, true);
assert.equal(categories.value, 'Bedroom', 'Tab closes without silently committing a highlighted option');
key(state(categories.id).toggle, 'Enter');
body.dispatchEvent(new TestEvent('pointerdown', { bubbles: true }));
assert.equal(state(categories.id).menu.hidden, true, 'Clicking outside closes the menu');
console.log('Floorplan dropdown initialization, native event compatibility, saved values, dynamic options and keyboard interaction passed.');

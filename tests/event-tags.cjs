const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script/modules/events.js'), 'utf8');
const gridCss = fs.readFileSync(path.join(root, 'css/grid.css'), 'utf8');
const context = {
    window: { dispatchEvent() {} },
    document: { addEventListener() {} },
    crypto: { randomUUID: () => 'event-id' },
    CustomEvent: function CustomEvent() {},
    console
};

vm.runInNewContext(source, context);

const render = context.window.MyMaintenanceEvents.eventRowHtml;
const tagged = render('2026-09-24', {
    name: 'Street cleanup',
    isNeighborhood: true,
    isPlannedMaintenance: true,
    startTime: '09:00',
    finishTime: '11:30'
});
const ordinary = render('2026-09-24', { name: 'Birthday' });

assert.match(tagged, /ev-tag neighborhood[^>]*>Neighborhood</);
assert.match(tagged, /ev-tag maintenance[^>]*>Maintenance</);
assert.match(tagged, /ev-cell-time-start">09:00/);
assert.match(tagged, /ev-cell-time-end">11:30/);
assert.doesNotMatch(ordinary, /ev-tag neighborhood/);
assert.doesNotMatch(ordinary, /ev-tag maintenance/);
assert.match(source, /db\.request\('neighborhood_events'/);
assert.match(source, /event\._source !== 'neighborhood'/);
assert.match(gridCss, /#dash-upcoming \.ev-row,[\s\S]*?display: grid;[\s\S]*?grid-template-columns:/);
assert.match(gridCss, /#dash-upcoming \.ev-row-left,[\s\S]*?#dash-planned \.ev-row-right\s*{\s*display: contents;/);

console.log('Event tag checks passed.');

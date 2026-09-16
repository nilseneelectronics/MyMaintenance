const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../script/modules/neighborhood-defaults.js'), 'utf8'), context);
const create = context.window.MyMaintenanceNeighborhoodDefaults.create;
const profile = { id: 'user-1', name: 'Owner', email: 'owner@example.test' };
const home = { id: 'home-1', ownerId: 'user-1', address: 'Example Street 1', houseType: 'House' };

const result = create(profile, [home], []);
assert(result);
assert.equal(result.addresses[0].address, home.address);
assert.equal(result.addresses[0].people[0].userId, profile.id);
assert.equal(create(profile, [{ ...home, ownerId: 'user-2' }], []), null);
console.log('PASS: signed-in homeowner can create a neighborhood without relying on family cache.');

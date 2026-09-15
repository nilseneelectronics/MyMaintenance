const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function main() {
    const members = [
        { id: 'owner', name: 'Family Owner', role: 'Owner', status: 'active' },
        { id: 'member', name: 'Accepted Member', role: 'Member', status: 'active' }
    ];
    for (const signedInUser of ['owner', 'member']) {
        const store = new Map([['mymaintenance_family', JSON.stringify([
            { id: 'old-invitation', name: 'Accepted Member', status: 'invited' }
        ])]]);
        let fail = false;
        let changes = 0;
        const context = {
            window: {
                MyMaintenanceAuth: { familyRequest: async action => {
                    assert.equal(action, 'list');
                    if (fail) throw new Error('Permission denied');
                    return { members };
                } },
                dispatchEvent() { changes++; }
            },
            localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) },
            CustomEvent: function () {},
            console: { warn() {} }
        };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../script/modules/profile-data.js'), 'utf8'), context);
        const data = context.window.MyMaintenanceProfileData;
        data.saveProfile = () => {};
        assert.equal(await data.hydrateFamily(), true);
        assert.deepEqual(JSON.parse(JSON.stringify(data.getFamily())), members, signedInUser);
        assert.equal(data.getFamilyLoadError(), '');
        assert.equal(changes, 1);
        fail = true;
        assert.equal(await data.hydrateFamily(), false);
        assert.match(data.getFamilyLoadError(), /Could not load family members/);
        assert.equal(data.getFamily().length, 2);
        fail = false;
        assert.equal(await data.hydrateFamily(), true);
        assert.equal(data.getFamilyLoadError(), '');
    }
    console.log('PASS: active membership replaces cached invitations, failed loading is visible, and retry recovers.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function main() {
    const store = new Map([
        ['mymaintenance_profile', JSON.stringify({ id: 'first-user', name: 'First User', email: 'first@example.test', address: 'Old address' })],
        ['mymaintenance.supabaseSession', JSON.stringify({ user: { email: 'second@example.test' } })]
    ]);
    let savedProfile = null;
    const context = {
        window: {
            MyMaintenanceData: {
                userId: async () => 'second-user',
                request: async (table, options) => {
                    if (options.method === 'POST') { savedProfile = options.body; return null; }
                    return [];
                }
            },
            MyMaintenanceAuth: { familyRequest: async () => ({ members: [] }) },
            dispatchEvent() {}
        },
        localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
        CustomEvent: function () {}, console, setTimeout, clearTimeout
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../script/modules/profile-data.js'), 'utf8'), context);
    const data = context.window.MyMaintenanceProfileData;
    await data.hydrate();
    const profile = data.getProfile();
    assert.equal(profile.id, 'second-user');
    assert.equal(profile.email, 'second@example.test');
    assert.equal(profile.name, '');
    assert.equal(profile.address, '');
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(savedProfile.id, 'second-user');
    assert.equal(savedProfile.details.profile.email, 'second@example.test');
    assert.equal(savedProfile.details.profile.name, '');
    console.log('PASS: switching accounts cannot copy the previous user profile or email into the new account.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });

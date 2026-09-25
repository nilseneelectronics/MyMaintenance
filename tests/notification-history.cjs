const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
    const source = fs.readFileSync(path.join(__dirname, '../script/script.js'), 'utf8');
    const section = source.slice(source.indexOf('const NOTIF_STORAGE_KEY'), source.indexOf('/* ==================== MAIN SCRIPT'));
    const item = { id: 'notification-1', reference_id: 'invite-1', invitationKind: 'neighborhood', read: false };
    const store = new Map([['mymaintenance_notif_items', JSON.stringify([item])]]);
    const calls = [];
    const context = {
        window: {
            MyMaintenanceAuth: { familyRequest: async (action, body) => calls.push({ type: 'action', action, body }) },
            MyMaintenanceData: { request: async (url, options) => calls.push({ type: 'data', url, options }) }
        },
        document: { getElementById: () => null },
        localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) },
        console,
        Date,
        Set
    };
    vm.runInNewContext(section, context);
    await context.notifInvitationAction(context.notifLoad()[0], 'accept');
    const saved = JSON.parse(store.get('mymaintenance_notif_items'));
    assert.equal(calls[0].action, 'accept-neighborhood');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].read, true);
    assert(saved[0].read_at);
    assert.equal(calls.some(call => call.options?.method === 'DELETE'), false);
    assert.match(section, /bell\.addEventListener\('click', async function[\s\S]*await notifHydrateCloud\(\)/);
    console.log('PASS: accepted neighborhood notification moves to previous notifications.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });

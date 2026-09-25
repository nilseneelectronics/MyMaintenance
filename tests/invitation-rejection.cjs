const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
    const file = path.join(__dirname, '../supabase/functions/family-invitations/index.ts');
    const source = fs.readFileSync(file, 'utf8');
    const helpers = source.slice(source.indexOf('const env'), source.indexOf('Deno.serve'));
    const calls = [];
    const details = {
        addresses: [{ address: 'Example Street 2', people: [
            { invitationId: 'invite-1', invitationStatus: 'invited', email: 'guest@example.test' },
            { userId: 'member-1', email: 'member@example.test' }
        ] }]
    };
    const context = {
        Deno: { env: { get: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'service-test' })[key] || '' } },
        fetch: async (url, options = {}) => {
            calls.push({ url, options });
            if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify([{ id: 'neighborhood-1', name: 'Test Neighborhood', details }]));
            return new Response(JSON.stringify([JSON.parse(options.body)]));
        },
        Response, URL, Set, String, Date, Array, Object, JSON, console,
        nodemailer: { createTransport() {} }
    };
    vm.runInNewContext(require('node:module').stripTypeScriptTypes(helpers), context);
    const invitation = {
        id: 'invite-1', inviter_id: 'owner-1', neighborhood_id: 'neighborhood-1',
        email: 'guest@example.test', name: 'Guest', address: 'Example Street 2'
    };
    const name = await context.removeRejectedResident(invitation);
    await context.notifyInvitationRejected(invitation, 'neighborhood', name);
    const neighborhoodPatch = calls.find(call => call.url.includes('/neighborhoods?') && call.options.method === 'PATCH');
    const notificationPost = calls.find(call => call.url.includes('/notifications?') && call.options.method === 'POST');
    const saved = JSON.parse(neighborhoodPatch.options.body);
    const notification = JSON.parse(notificationPost.options.body);
    assert.equal(saved.details.addresses[0].people.length, 1);
    assert.equal(saved.details.addresses[0].people[0].userId, 'member-1');
    assert.equal(notification.recipient_id, 'owner-1');
    assert.equal(notification.kind, 'system');
    assert.equal(notification.reference_id, 'invite-1');
    assert.match(notification.body, /Guest declined the invitation to Test Neighborhood/);
    assert.match(source, /await removeRejectedResident\(rejected\[0\]\)/);
    assert.match(source, /await notifyInvitationRejected\(rejected\[0\], kind, neighborhoodName\)/);
    console.log('PASS: rejected invitations notify inviter and remove pending neighborhood person.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });

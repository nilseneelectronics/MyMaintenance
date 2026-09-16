const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');

async function main() {
    const owner = '11111111-1111-4111-8111-111111111111';
    const recipient = '22222222-2222-4222-8222-222222222222';
    const asset = '33333333-3333-4333-8333-333333333333';
    let handler, mail, patchCount = 0, failMail = false;
    const env = { SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'server-test', SMTP_HOST: 'mail.test.invalid', SMTP_USER: 'sender@test.invalid', SMTP_PASSWORD: 'test-only', SMTP_FROM: 'sender@test.invalid' };
    const context = {
        Request, Response, Set, Map, Date, Number, String, Error, URL, console: { error() {} },
        Deno: { env: { get: key => env[key] }, serve: callback => { handler = callback; } },
        nodemailer: { createTransport: () => ({ close() {}, sendMail: async message => { mail = message; if (failMail) throw Error('SMTP offline'); return { accepted: [message.to] }; } }) },
        fetch: async (url, options) => {
            if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: owner, email: 'owner@test.invalid', email_confirmed_at: '2026-01-01' }));
            if (url.includes('/family_members?user_id=eq.')) return new Response(JSON.stringify([{ family_id: 'family-id' }]));
            if (url.includes('/family_members?family_id=eq.')) return new Response(JSON.stringify(url.includes('user_id=eq.' + recipient) ? [{ user_id: recipient }] : []));
            if (url.includes('/profiles?')) return new Response(JSON.stringify([{ display_name: 'Recipient', details: {} }]));
            if (url.includes('/family_invitations?')) return new Response(JSON.stringify([{ email: 'recipient@test.invalid' }]));
            if (url.includes('/homes?')) {
                assert.equal(options.headers.Authorization, 'Bearer signed-in-user');
                if (options.method === 'PATCH') { patchCount++; return new Response(JSON.stringify([{ id: asset, name: 'House <North>', owner_id: recipient }])); }
                return new Response(JSON.stringify([{ id: asset, name: 'House <North>', owner_id: owner }]));
            }
            throw Error('Unexpected request: ' + url);
        }
    };
    const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/family-invitations/index.ts'), 'utf8');
    vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import[^\r\n]*\r?\n/, '')), context);
    const request = recipientId => new Request('https://test.invalid/functions/v1/family-invitations', { method: 'POST', headers: { origin: 'http://127.0.0.1:5500', authorization: 'Bearer signed-in-user', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'transfer', kind: 'home', assetId: asset, recipientId }) });
    const invalid = await handler(request(owner));
    assert.equal(invalid.status, 400);
    assert.equal(patchCount, 0);
    const success = await (await handler(request(recipient))).json();
    assert.equal(success.transferred, true);
    assert.equal(success.notified, true);
    assert.equal(patchCount, 1);
    assert.equal(mail.to, 'recipient@test.invalid');
    assert.match(mail.html, /Vedlikeholdt/);
    assert.match(mail.html, /House &lt;North&gt;/);
    assert(!mail.html.includes('House <North>'));
    assert.match(mail.text, /View it at/);
    failMail = true;
    const failedNotification = await (await handler(request(recipient))).json();
    assert.equal(failedNotification.transferred, true);
    assert.equal(failedNotification.notified, false);
    console.log('PASS: recipient validation, owner-token transfer, branded mail, HTML escaping, and mail-failure reporting. No email sent.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

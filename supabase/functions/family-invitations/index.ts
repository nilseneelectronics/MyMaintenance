import nodemailer from 'npm:nodemailer@7';

const env = (name: string) => Deno.env.get(name) || '';
const base = env('SUPABASE_URL');
const adminKey = env('SUPABASE_SERVICE_ROLE_KEY');
const site = 'https://vedlikeholdt.no';
const allowedOrigins = new Set([site, 'https://www.vedlikeholdt.no', 'http://127.0.0.1:5500', 'http://localhost:5500']);
async function database(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + '/rest/v1/' + path, { method,
        headers: { apikey: adminKey, Authorization: 'Bearer ' + adminKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        if (data?.code === '23505') throw new Error('An invitation or member already exists for this email. Cancel the old invitation first.');
        if (data?.code === 'P0001') throw new Error(data.message);
        throw new Error('Could not update invitation records.');
    }
    return data;
}
function member(row: Record<string, any>) {
    return { ...row.member_profile, id: row.id, name: row.member_profile?.name || row.name, email: row.email,
        role: row.role, status: row.status === 'accepted' ? 'active' : 'invited', sentAt: row.sent_at,
        expiresAt: row.expires_at, serverInvitation: true };
}
Deno.serve(async request => {
    const origin = request.headers.get('origin') || '';
    const cors = { 'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : site,
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    const authorization = request.headers.get('authorization') || '';
    const userResponse = await fetch(base + '/auth/v1/user', { headers: { apikey: adminKey, Authorization: authorization } });
    const user = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !user?.id || !user.email_confirmed_at) return reply({ error: 'Sign in with a verified email address first.' }, 401);
    try {
        const body = await request.json();
        if (body.action === 'list') {
            const rows = await database('family_invitations?inviter_id=eq.' + user.id + '&status=in.(pending,accepted)&order=created_at.asc');
            return reply({ members: rows.map(member) });
        }
        if (body.action === 'accept') {
            if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Invalid invitation.');
            await database('rpc/accept_family_invitation', 'POST', { p_id: body.id, p_user: user.id, p_email: user.email });
            return reply({ accepted: true });
        }
        if (body.action === 'cancel') {
            if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Invalid invitation.');
            await database('family_invitations?id=eq.' + body.id + '&inviter_id=eq.' + user.id + '&status=in.(pending,accepted)', 'PATCH', { status: 'cancelled' });
            return reply({ cancelled: true });
        }
        if (body.action !== 'send') throw new Error('Unknown invitation action.');
        const email = String(body.email || '').trim().toLowerCase();
        const name = String(body.name || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 120) throw new Error('Enter a valid name and email.');
        if (email === user.email.toLowerCase()) throw new Error('You cannot invite yourself.');
        if (!['Member', 'Viewer'].includes(body.role)) throw new Error('Invalid role.');
        if (!env('SMTP_HOST') || !env('SMTP_USER') || !env('SMTP_PASSWORD') || !env('SMTP_FROM')) throw new Error('Invitation email sending is not configured yet.');
        const row = await database('rpc/reserve_family_invitation', 'POST', { p_inviter: user.id, p_email: email, p_name: name, p_role: body.role, p_limit: Number(env('INVITE_HOURLY_LIMIT')) || 5 });
        const transport = nodemailer.createTransport({ host: env('SMTP_HOST'), port: 465, secure: true,
            auth: { user: env('SMTP_USER'), pass: env('SMTP_PASSWORD') }, connectionTimeout: 10000, socketTimeout: 20000 });
        try {
            const delivery = await transport.sendMail({ from: { name: 'Vedlikeholdt', address: env('SMTP_FROM') }, to: email,
                subject: 'You are invited to a family on Vedlikeholdt',
                text: `${user.email} invited you to join their family on Vedlikeholdt.\n\nSign in or create an account using ${email}, then accept here:\n${site}/pages/email-action.html?invitation=${row.id}\n\nThis invitation expires in 7 days. You are not added until you accept. If unexpected, ignore this email.` });
            if (!delivery.accepted?.length) throw new Error('Rejected');
        } catch (_) {
            await database('family_invitations?id=eq.' + row.id, 'PATCH', { status: 'failed' });
            throw new Error('The mail server did not confirm delivery. No member was added. Please check email delivery logs before retrying.');
        } finally { transport.close(); }
        const saved = await database('family_invitations?id=eq.' + row.id, 'PATCH', { status: 'pending', sent_at: new Date().toISOString() });
        return reply({ member: member(saved[0]) });
    } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Could not process invitation.' }, 400); }
});

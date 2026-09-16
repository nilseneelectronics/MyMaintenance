import nodemailer from 'npm:nodemailer@7';

const env = (name: string) => Deno.env.get(name) || '';
const base = env('SUPABASE_URL');
const adminKey = env('SUPABASE_SERVICE_ROLE_KEY');
const site = 'https://vedlikeholdt.no';
const allowedOrigins = new Set([site, 'https://www.vedlikeholdt.no', 'http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:58525', 'http://127.0.0.1:4173', 'http://localhost:4173']);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
const emailLogoBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFNUlEQVR4nOyaWYhcRRSG/24XxLghPrjgioIPKkYcMUwmMdGHOKKJJo4TFzToUyT4ICqYNzcQIQjqiyjBF2MkxigxCcYYFHxxTTLBLUqCJOMIxnU0KtH2O1O3se3cqrnVfXub7h9+qvveU1XnP31uVXXVLarLUVSXoxcAdTl6AVCX43C1EKVS6WIrC4XCNrUITc8ARJ8NN8ESXz8xlhzWw7PUZBTURCBwHsVL8HiPyc9wmIzYpCahKRmA8CJ8jI8b5Bev5N4GbB+1OmoCGp4BCDmJYg2crTi8A68nG35UA9HQACC+j+J1eLJqwz65IHygBqFhaYb4eyjeV1j8EngHPOC5fxp8j7aWqUHIPQNw9miKVfC6gNluu88vuzOpc75cppwXqGOP0e3U+V05ItcAIORcuYEuJMSE3oKQ8aq6FrgX4KJA3V1wkLpfKSfk9gggYCGFLWh84g/Ce3F+frV4g/2y8EY+Wrr/5WnD2t5GX9cqJ9SdAThjq8kVco77MCaX8pkGs2SF+Bo8I2D2JLyPNg+qDtQVABw9leJVeFnAzKazRTj6veLaPk5u0XR1wMwGWQvsd6oRNT8CODiLYkR+8bbUfRjOjRVvoM4vcJCPD8g9PmmwvkcSX2pCTRlAhw/KifMF8Ac4hIAtygH0N4NirfxT6t9wOf09rkhEBSAiLW3xMqockXFFuVEu8OPKiMyPAA5cIJfyIfFPwf68xRuSx2gufAj+4zEz33YkvmZrN4sRDd5J8TQ8ymPym9wi5RU1AfhzJcXL8ESPyZ9wCf6smqSpcADo6EiKlfDmgNlnciNxbouTLMg4Az0Ll+Gbb13hDwAd2By8Dk5XGNPyXp7GAD9t4Ls/YPIRvAEfv0m7WfA0OtnGxX8NALUYGTdaFqbNSsWUxmxFt1EZxLcLkh0ky9SPPSam5S20LT2kbuUXDGxQ2a+4zlueAZVAwzMUSwMmp+Py3vKX6gwI/Ytbpw4A4u6mGIa+tcD/Zo7qAGyHX1Zd+0lu8fGiOgQEYTXFpXIzVCVGuLej8kKxquIfcouN8mBh29Z9XH9Xbm3fMcDnL+SC8ITcIGiaDlnEZX5+ebaGKFandNRWY0AsemeD6nL0AqAuRy8AEbYdMw0yY62A++Gn8IqQbUvfD2gEEGznEuX53lZ9W7k23fcOwpR6BKrEV2LIV2fKZADi35B/u27MV29KBCARP+i5bf/8nvPVjQlA2y15EX6E3FnjPI+JHZjMCu1YdewYkEG8vVswA/G7Q+20dBpExAnwItUG24EOiZ85mXhDTADyPkp/hMJef9nO513wkoi66yl8J8R2JjGA+D3KgJZkQHKWt7zikr1X8DbXL89Q18Rf47ltO7/9WX75Mlo1BpyScs02LjcjcMBXiXu2LecTb6L7s/7yZcQEYNTjVBoOwDXJ4UUatsK0kfkYaC9Rzknpx8TPT29Oe+RG+72KRMyO0DT5Nxp92IJTV3nau0luLz8NtjVnp02bE9uQ+K/hbGz3qQZkzgA6sPO/5xWHvkB7tr12q+e2nUG+ifAF0I6/fOLtnaGBWsVP+BFjjDPHyr0HdE7GKjtx7sJJ2lys2nac7SzS0v5b1YGoQZDOfqWw6WptBnP7Ve7K0Kad4A4rDrbjO7Ne8RP9q0Ykp0hnKv0IbRznPlQEfLvOKfgczqH9MeWAdjvWWiD3FshhHhP75W2qizq+C6Ed/+D4gpC7eEPb/RlCoE15i6su28A7kLf4if7Upkhe0LgNjiJ8pRqEjj7WygO9bXF1OXoBUJej6wPwLwAAAP//Tx6GXwAAAAZJREFUAwAEX+8R7bZaZQAAAABJRU5ErkJggg==';
const emailAttachments = () => [{ filename: 'vedlikeholdt-logo.png', content: emailLogoBase64, encoding: 'base64', cid: 'vedlikeholdt-logo', contentType: 'image/png', contentDisposition: 'inline' }];
function brandedEmail(title: string, intro: string, button: string, href: string, detail: string) {
    return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;color:#05141c">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0f4f8"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" width="560" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #afeeee;border-radius:12px;overflow:hidden">
<tr><td style="background:#20b2aa;padding:22px 32px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="32" style="width:32px"><img src="cid:vedlikeholdt-logo" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0"></td>
<td style="padding-left:8px;color:#ffffff!important;-webkit-text-fill-color:#ffffff;font-size:23px;font-weight:700">Vedlikeholdt</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 32px"><h1 style="margin:0 0 18px;font-size:25px;line-height:1.25">${escapeHtml(title)}</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:1.6">${escapeHtml(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#20b2aa;border-radius:8px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-weight:700">${escapeHtml(button)}</a></td></tr></table>
<p style="margin:24px 0 0;color:#52616b;font-size:13px;line-height:1.5">${escapeHtml(detail)}</p></td></tr>
<tr><td style="background:#f5f5f5;border-top:1px solid #afeeee;padding:20px 32px;color:#52616b;font-size:13px">Vedlikeholdt · Keep your home well maintained<br><a href="${site}" style="color:#008080">vedlikeholdt.no</a></td></tr>
</table></td></tr></table></body></html>`;
}
function mailTransport() {
    return nodemailer.createTransport({ host: env('SMTP_HOST'), port: 465, secure: true,
        auth: { user: env('SMTP_USER'), pass: env('SMTP_PASSWORD') }, connectionTimeout: 10000, socketTimeout: 20000 });
}
async function database(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + '/rest/v1/' + path, { method,
        headers: { apikey: adminKey, Authorization: 'Bearer ' + adminKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        console.error('Database request failed', path.split('?')[0], response.status, data);
        if (data?.code === '23505' && path.includes('reserve_family_invitation')) throw new Error('A family invitation is already pending or this person is already a family member.');
        if (data?.code === '23505' && path.includes('reserve_neighborhood_invitation')) throw new Error('A neighborhood invitation is already pending for this email.');
        if (data?.code === '23505') throw new Error('This record already exists.');
        if (data?.code === 'P0001') throw new Error(data.message);
        if (['42P01', '42501', '42703', '42883', 'PGRST202'].includes(data?.code)) throw new Error('Neighborhood invitation database setup is missing. Apply the latest Supabase migrations.');
        throw new Error('Could not update invitation records.');
    }
    return data;
}
function member(row: Record<string, any>, incoming = false) {
    return { ...row.member_profile, id: row.id, name: row.member_profile?.name || row.name, email: row.email,
        role: row.role, status: row.status === 'accepted' ? 'active' : 'invited', sentAt: row.sent_at,
        expiresAt: row.expires_at, serverInvitation: true, incomingInvitation: incoming };
}
async function userDatabase(path: string, authorization: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + '/rest/v1/' + path, { method,
        headers: { apikey: adminKey, Authorization: authorization, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error('Could not transfer this asset.');
    return data;
}
async function familyFor(userId: string) {
    const existing = await database('family_members?user_id=eq.' + userId + '&select=family_id');
    if (existing[0]?.family_id) return existing[0].family_id;
    const created = await database('families', 'POST', { created_by: userId });
    const familyId = created[0].id;
    await database('family_members', 'POST', { family_id: familyId, user_id: userId, role: 'Owner' });
    // Make existing assets visible as soon as their owner creates a family.
    await Promise.all([
        database('homes?owner_id=eq.' + userId, 'PATCH', { family_id: familyId }),
        database('vehicles?owner_id=eq.' + userId, 'PATCH', { family_id: familyId })
    ]);
    return familyId;
}
async function inviterName(user: Record<string, any>) {
    const rows = await database('profiles?id=eq.' + user.id + '&select=display_name,details');
    const profile = rows[0] || {};
    return String(profile.details?.profile?.name || profile.display_name || user.email || 'A Vedlikeholdt user').trim();
}
async function linkedMember(userId: string, familyId: string) {
    const memberships = await database('family_members?family_id=eq.' + familyId + '&user_id=eq.' + userId + '&select=user_id,role');
    if (!memberships.length) throw new Error('Select an active family member first.');
    const profiles = await database('profiles?id=eq.' + userId + '&select=display_name,details');
    const profile = profiles[0] || {};
    const accepted = await database('family_invitations?family_id=eq.' + familyId + '&recipient_id=eq.' + userId + '&status=eq.accepted&select=email,name&order=accepted_at.desc&limit=1');
    const email = String(profile.details?.profile?.email || accepted[0]?.email || '').trim().toLowerCase();
    const name = String(profile.details?.profile?.name || profile.display_name || accepted[0]?.name || 'Family member').trim();
    if (!email) throw new Error('This family member does not have a linked email address.');
    return { email, name };
}
async function neighborhoodAccess(userId: string, neighborhoodId: string) {
    const neighborhoods = await database('neighborhoods?id=eq.' + neighborhoodId + '&select=id,owner_id,name,details');
    if (!neighborhoods.length) throw new Error('Neighborhood not found.');
    const neighborhood = neighborhoods[0];
    if (neighborhood.owner_id === userId) return { neighborhood, owner: true };
    const members = await database('neighborhood_members?neighborhood_id=eq.' + neighborhoodId + '&user_id=eq.' + userId + '&role=in.(admin,edit)&select=user_id');
    if (!members.length) throw new Error('You do not have permission to invite people to this neighborhood.');
    return { neighborhood, owner: false };
}
async function familyRecipientByEmail(userId: string, email: string) {
    const familyId = await familyFor(userId);
    const memberships = await database('family_members?family_id=eq.' + familyId + '&select=user_id');
    const ids = memberships.map((item: Record<string, any>) => item.user_id);
    if (!ids.length) return null;
    const profiles = await database('profiles?id=in.(' + ids.join(',') + ')&select=id,display_name,details');
    const match = profiles.find((profile: Record<string, any>) =>
        String(profile.details?.profile?.email || '').trim().toLowerCase() === email.toLowerCase());
    if (match) return { id: match.id, name: String(match.details?.profile?.name || match.display_name || 'Family member').trim() };
    const accepted = await database('family_invitations?family_id=eq.' + familyId + '&recipient_id=in.(' + ids.join(',') + ')&email=eq.' + encodeURIComponent(email) + '&status=eq.accepted&select=recipient_id,name&limit=1');
    if (!accepted.length) return null;
    return { id: accepted[0].recipient_id, name: accepted[0].name || 'Family member' };
}
async function reserveNeighborhoodInvite(inviter: Record<string, any>, email: string, name: string, recipientId: string | null, neighborhoodId?: string, address = '') {
    let selectedId = neighborhoodId;
    if (!selectedId) {
        const owned = await database('neighborhoods?owner_id=eq.' + inviter.id + '&select=id&limit=1');
        if (!owned.length) throw new Error('Register a neighborhood before inviting someone to it.');
        selectedId = owned[0].id;
    }
    return database('rpc/reserve_neighborhood_invitation', 'POST', {
        p_neighborhood: selectedId, p_inviter: inviter.id, p_recipient: recipientId,
        p_email: email, p_name: name, p_address: address
    });
}
async function sendNeighborhoodInviteEmail(inviter: Record<string, any>, invitation: Record<string, any>, email: string, neighborhoodName = 'MyNeighborhood') {
    if (!env('SMTP_HOST') || !env('SMTP_USER') || !env('SMTP_PASSWORD') || !env('SMTP_FROM')) throw new Error('Invitation email sending is not configured yet.');
    const sender = await inviterName(inviter);
    const href = site + '/pages/email-action.html?neighborhood-invitation=' + invitation.id;
    const transport = mailTransport();
    try {
        const delivery = await transport.sendMail({ from: { name: 'Vedlikeholdt', address: env('SMTP_FROM') }, to: email,
            subject: sender + ' invited you to ' + neighborhoodName + ' on Vedlikeholdt',
            text: `${sender} invited you to join ${neighborhoodName} on Vedlikeholdt. After accepting, you can add and view neighborhood photos, documents, and events, and invite your own family members.\n\nAccept here:\n${href}\n\nThis invitation expires in 7 days.`,
            html: brandedEmail('Join ' + neighborhoodName, `${sender} invited you to join this neighborhood. After accepting, you can add and view neighborhood photos, documents, and events, and invite your own family members.`, 'Accept invitation', href, 'This invitation expires in 7 days. Access starts only after you accept.'),
            attachments: emailAttachments() });
        if (!delivery.accepted?.length) throw new Error('Rejected');
    } catch (_) {
        await database('neighborhood_invitations?id=eq.' + invitation.id, 'PATCH', { status: 'failed' });
        throw new Error('The mail server did not confirm delivery. Neighborhood access was not added.');
    } finally { transport.close(); }
    await database('neighborhood_invitations?id=eq.' + invitation.id, 'PATCH', { status: 'pending', sent_at: new Date().toISOString() });
}
async function addAcceptedResident(invitation: Record<string, any>, user: Record<string, any>) {
    if (!invitation?.neighborhood_id) return;
    const [rows, profiles] = await Promise.all([
        database('neighborhoods?id=eq.' + invitation.neighborhood_id + '&select=id,details'),
        database('profiles?id=eq.' + user.id + '&select=display_name,details')
    ]);
    if (!rows.length) return;
    const profile = profiles[0] || {};
    const details = rows[0].details && typeof rows[0].details === 'object' ? rows[0].details : {};
    const addresses = Array.isArray(details.addresses) ? details.addresses : [];
    const normalizedAddress = String(invitation.address || '').trim().toLowerCase();
    let address = addresses.find((item: Record<string, any>) => String(item.address || '').trim().toLowerCase() === normalizedAddress);
    if (!address) {
        address = { id: crypto.randomUUID(), address: invitation.address || '', people: [] };
        addresses.push(address);
    }
    if (!Array.isArray(address.people)) address.people = [];
    address.people = address.people.filter((person: Record<string, any>) =>
        person.userId !== user.id && String(person.email || '').toLowerCase() !== user.email.toLowerCase());
    address.people.push({ userId: user.id, name: profile.details?.profile?.name || profile.display_name || invitation.name,
        email: user.email, phone: profile.details?.profile?.phone || '', role: 'edit' });
    details.addresses = addresses;
    await database('neighborhoods?id=eq.' + invitation.neighborhood_id, 'PATCH', { details });
}
Deno.serve(async request => {
    const requestUrl = new URL(request.url);
    if (request.method === 'GET' && requestUrl.pathname.endsWith('/email-logo.png')) {
        const binary = atob(emailLogoBase64);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new Response(bytes, { headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': 'inline; filename="vedlikeholdt-logo.png"',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff'
        } });
    }
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
        if (body.action === 'details-neighborhood') {
            if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Invalid neighborhood invitation.');
            const invitations = await database('neighborhood_invitations?id=eq.' + body.id + '&email=eq.' + encodeURIComponent(user.email.toLowerCase()) + '&status=eq.pending&select=inviter_id,neighborhood_id,address,expires_at');
            if (!invitations.length) throw new Error('Neighborhood invitation not found for your email address.');
            const sender = await inviterName({ id: invitations[0].inviter_id, email: '' });
            const neighborhoods = await database('neighborhoods?id=eq.' + invitations[0].neighborhood_id + '&select=name');
            return reply({ invitation: { inviterName: sender, neighborhoodName: neighborhoods[0]?.name || 'MyNeighborhood', address: invitations[0].address || '', expiresAt: invitations[0].expires_at } });
        }
        if (body.action === 'accept-neighborhood') {
            if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Invalid neighborhood invitation.');
            const accepted = await database('rpc/accept_neighborhood_invitation', 'POST', { p_id: body.id, p_user: user.id, p_email: user.email });
            await addAcceptedResident(Array.isArray(accepted) ? accepted[0] : accepted, user);
            return reply({ accepted: true });
        }
        if (body.action === 'invite-neighborhood-address') {
            const neighborhoodId = String(body.neighborhoodId || '');
            const email = String(body.email || '').trim().toLowerCase();
            const address = String(body.address || '').trim();
            if (!/^[0-9a-f-]{36}$/i.test(neighborhoodId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !address) throw new Error('Enter a valid address and email.');
            if (email === user.email.toLowerCase()) throw new Error('You already belong to this neighborhood.');
            const access = await neighborhoodAccess(user.id, neighborhoodId);
            let recipientId = null;
            let name = email.split('@')[0];
            if (!access.owner) {
                const familyRecipient = await familyRecipientByEmail(user.id, email);
                if (!familyRecipient) throw new Error('Neighborhood members can invite only active members of their own family.');
                recipientId = familyRecipient.id;
                name = familyRecipient.name;
            }
            const invitation = await reserveNeighborhoodInvite(user, email, name, recipientId, neighborhoodId, address);
            await sendNeighborhoodInviteEmail(user, invitation, email, access.neighborhood.name || 'MyNeighborhood');
            return reply({ invited: true, email, invitationId: invitation.id });
        }
        if (body.action === 'invite-neighborhood') {
            if (!/^[0-9a-f-]{36}$/i.test(body.recipientId || '')) throw new Error('Select an active family member first.');
            const familyId = await familyFor(user.id);
            const owners = await database('family_members?family_id=eq.' + familyId + '&user_id=eq.' + user.id + '&role=eq.Owner&select=user_id');
            if (!owners.length) throw new Error('Only the family owner can invite members to MyNeighborhood.');
            const recipient = await linkedMember(body.recipientId, familyId);
            const owned = await database('neighborhoods?owner_id=eq.' + user.id + '&select=id,name&limit=1');
            if (!owned.length) throw new Error('Register a neighborhood before inviting someone to it.');
            const invitation = await reserveNeighborhoodInvite(user, recipient.email, recipient.name, body.recipientId, owned[0].id);
            await sendNeighborhoodInviteEmail(user, invitation, recipient.email, owned[0].name || 'MyNeighborhood');
            return reply({ invited: true, email: recipient.email });
        }
        if (body.action === 'details') {
            if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Invalid invitation.');
            const invitations = await database('family_invitations?id=eq.' + body.id + '&email=eq.' + encodeURIComponent(user.email.toLowerCase()) + '&status=eq.pending&select=inviter_id,role,expires_at');
            if (!invitations.length) throw new Error('Invitation not found for your email address.');
            const profiles = await database('profiles?id=eq.' + invitations[0].inviter_id + '&select=display_name,details');
            const profile = profiles[0] || {};
            const inviterName = String(profile.details?.profile?.name || profile.display_name || '').trim() || 'A Vedlikeholdt user';
            const neighborhoodInvites = await database('neighborhood_invitations?inviter_id=eq.' + invitations[0].inviter_id + '&email=eq.' + encodeURIComponent(user.email.toLowerCase()) + '&status=eq.pending&select=id');
            return reply({ invitation: { inviterName, role: invitations[0].role, expiresAt: invitations[0].expires_at, includesNeighborhood: neighborhoodInvites.length > 0 } });
        }
        if (body.action === 'list') {
            // A family invitation belongs in both people's settings: the sender sees
            // the member they invited, while the recipient sees the invitation before
            // accepting and their membership afterward.
            const familyId = await familyFor(user.id);
            const [memberships, profiles, outgoingPending, incomingPending, ownedNeighborhoods] = await Promise.all([
                database('family_members?family_id=eq.' + familyId + '&select=user_id,role,joined_at&order=joined_at.asc'),
                database('profiles?select=id,display_name,details'),
                database('family_invitations?family_id=eq.' + familyId + '&status=eq.pending&order=created_at.asc'),
                database('family_invitations?email=eq.' + encodeURIComponent(user.email.toLowerCase()) + '&status=eq.pending&order=created_at.asc'),
                database('neighborhoods?owner_id=eq.' + user.id + '&select=id')
            ]);
            const profileById = new Map(profiles.map((profile: Record<string, any>) => [profile.id, profile]));
            const neighborhoodIds = ownedNeighborhoods.map((item: Record<string, any>) => item.id);
            const [neighborhoodMembers, neighborhoodInvites] = neighborhoodIds.length ? await Promise.all([
                database('neighborhood_members?neighborhood_id=in.(' + neighborhoodIds.join(',') + ')&select=user_id'),
                database('neighborhood_invitations?inviter_id=eq.' + user.id + '&status=eq.pending&select=recipient_id,email')
            ]) : [[], []];
            const neighborhoodMemberIds = new Set(neighborhoodMembers.map((item: Record<string, any>) => item.user_id));
            const active = memberships.map((membership: Record<string, any>) => {
                const profile = profileById.get(membership.user_id) || {};
                const details = profile.details?.profile || {};
                const email = details.email || '';
                const pendingNeighborhood = neighborhoodInvites.some((item: Record<string, any>) =>
                    item.recipient_id === membership.user_id || (email && item.email.toLowerCase() === email.toLowerCase()));
                return { id: membership.user_id, name: details.name || profile.display_name || 'Family member', email, role: membership.role,
                    status: 'active', familyId, serverInvitation: true, neighborhoodStatus: neighborhoodMemberIds.has(membership.user_id) ? 'active' : (pendingNeighborhood ? 'invited' : '') };
            });
            const outgoing = outgoingPending.filter((row: Record<string, any>) => row.inviter_id === user.id).map((row: Record<string, any>) => member(row));
            const outgoingIds = new Set(outgoing.map((row: Record<string, any>) => row.id));
            const incoming = incomingPending.filter((row: Record<string, any>) => !outgoingIds.has(row.id)).map((row: Record<string, any>) => member(row, true));
            return reply({ members: [...active, ...outgoing, ...incoming], familyId });
            /* legacy rows are retained below for compatibility with pre-migration deployments. */
            /*
            const [sent, pending, accepted] = await Promise.all([
                database('family_invitations?inviter_id=eq.' + user.id + '&status=in.(pending,accepted)&order=created_at.asc'),
                database('family_invitations?email=eq.' + encodeURIComponent(user.email.toLowerCase()) + '&status=eq.pending&order=created_at.asc'),
                database('family_invitations?recipient_id=eq.' + user.id + '&status=eq.accepted&order=created_at.asc')
            ]);
            const sentIds = new Set(sent.map((row: Record<string, any>) => row.id));
            const incoming = [...pending, ...accepted].filter((row: Record<string, any>) => !sentIds.has(row.id));
            return reply({ members: [...sent.map((row: Record<string, any>) => member(row)), ...incoming.map((row: Record<string, any>) => member(row, true))] });
            */
        }
        if (body.action === 'accept') {
            if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Invalid invitation.');
            const accepted = await database('rpc/accept_family_invitation', 'POST', { p_id: body.id, p_user: user.id, p_email: user.email });
            const invitation = Array.isArray(accepted) ? accepted[0] : accepted;
            if (invitation?.family_id) await database('family_members', 'POST', { family_id: invitation.family_id, user_id: user.id, role: invitation.role });
            const neighborhoodInvites = await database('neighborhood_invitations?inviter_id=eq.' + invitation.inviter_id + '&email=eq.' + encodeURIComponent(user.email.toLowerCase()) + '&status=eq.pending&select=id');
            for (const neighborhoodInvite of neighborhoodInvites) {
                const joined = await database('rpc/accept_neighborhood_invitation', 'POST', { p_id: neighborhoodInvite.id, p_user: user.id, p_email: user.email });
                await addAcceptedResident(Array.isArray(joined) ? joined[0] : joined, user);
            }
            return reply({ accepted: true });
        }
        if (body.action === 'cancel') {
            if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Invalid invitation.');
            await database('family_invitations?id=eq.' + body.id + '&inviter_id=eq.' + user.id + '&status=in.(pending,accepted)', 'PATCH', { status: 'cancelled' });
            return reply({ cancelled: true });
        }
        if (body.action === 'transfer') {
            const table = body.kind === 'home' ? 'homes' : body.kind === 'vehicle' ? 'vehicles' : null;
            if (!table || !/^[0-9a-f-]{36}$/i.test(body.assetId || '') || !/^[0-9a-f-]{36}$/i.test(body.recipientId || '')) throw new Error('Invalid transfer.');
            const familyId = await familyFor(user.id);
            const memberships = await database('family_members?family_id=eq.' + familyId + '&user_id=eq.' + body.recipientId + '&select=user_id');
            if (!memberships.length || body.recipientId === user.id) throw new Error('Select another active family member.');
            const assets = await userDatabase(table + '?id=eq.' + body.assetId + '&owner_id=eq.' + user.id + '&select=id,name,owner_id', authorization);
            if (!assets.length) throw new Error('Only the current owner can transfer this asset.');
            const changed = await userDatabase(table + '?id=eq.' + body.assetId + '&owner_id=eq.' + user.id + '&select=id,name,owner_id', authorization, 'PATCH', { owner_id: body.recipientId });
            if (!changed.length) throw new Error('The asset changed before the transfer completed.');
            const profiles = await database('profiles?id=eq.' + body.recipientId + '&select=display_name,details');
            const recipient = profiles[0] || {};
            const recipientName = recipient.display_name || recipient.details?.profile?.name || 'family member';
            const acceptedInvites = await database('family_invitations?family_id=eq.' + familyId + '&recipient_id=eq.' + body.recipientId + '&status=eq.accepted&select=email&order=accepted_at.desc&limit=1');
            const recipientEmail = recipient.details?.profile?.email || acceptedInvites[0]?.email || '';
            if (!recipientEmail || !env('SMTP_HOST') || !env('SMTP_USER') || !env('SMTP_PASSWORD') || !env('SMTP_FROM')) return reply({ transferred: true, notified: false });
            const transport = mailTransport();
            let notified = false;
            try {
                const delivery = await transport.sendMail({ from: { name: 'Vedlikeholdt', address: env('SMTP_FROM') }, to: recipientEmail,
                    subject: 'An asset was transferred to you on Vedlikeholdt',
                    text: `${user.email} transferred ${changed[0].name} to you on Vedlikeholdt.\n\nView it at ${site}/pages/myprofile.html\n\nIf this is unexpected, contact your family owner.`,
                    html: brandedEmail('An asset is now yours', `${user.email} transferred ${changed[0].name} to you on Vedlikeholdt.`, 'View my assets', site + '/pages/myprofile.html', `Sent to ${recipientName}. If this is unexpected, contact your family owner.`),
                    attachments: emailAttachments() });
                notified = !!delivery.accepted?.length;
            } catch (error) { console.error('Could not send transfer email:', error); }
            finally { transport.close(); }
            return reply({ transferred: true, notified });
        }
        if (body.action !== 'send') throw new Error('Unknown invitation action.');
        const email = String(body.email || '').trim().toLowerCase();
        const name = String(body.name || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 120) throw new Error('Enter a valid name and email.');
        if (email === user.email.toLowerCase()) throw new Error('You cannot invite yourself.');
        if (!['Member', 'Viewer'].includes(body.role)) throw new Error('Invalid role.');
        if (!env('SMTP_HOST') || !env('SMTP_USER') || !env('SMTP_PASSWORD') || !env('SMTP_FROM')) throw new Error('Invitation email sending is not configured yet.');
        const familyId = await familyFor(user.id);
        const row = await database('rpc/reserve_family_invitation', 'POST', { p_inviter: user.id, p_email: email, p_name: name, p_role: body.role, p_limit: Number(env('INVITE_HOURLY_LIMIT')) || 5 });
        await database('family_invitations?id=eq.' + row.id, 'PATCH', { family_id: familyId });
        let neighborhoodInvitation = null;
        let createdNeighborhoodInvitation = false;
        if (body.inviteNeighborhood) {
            try {
                const existingNeighborhoodInvites = await database('neighborhood_invitations?inviter_id=eq.' + user.id + '&email=eq.' + encodeURIComponent(email) + '&status=eq.pending&select=id&limit=1');
                neighborhoodInvitation = existingNeighborhoodInvites[0] || await reserveNeighborhoodInvite(user, email, name, null);
                createdNeighborhoodInvitation = !existingNeighborhoodInvites.length;
            }
            catch (error) {
                await database('family_invitations?id=eq.' + row.id, 'PATCH', { status: 'failed' });
                throw error;
            }
        }
        const transport = mailTransport();
        try {
            const sender = await inviterName(user);
            const includesNeighborhood = Boolean(neighborhoodInvitation);
            const delivery = await transport.sendMail({ from: { name: 'Vedlikeholdt', address: env('SMTP_FROM') }, to: email,
                subject: includesNeighborhood ? 'Family and neighborhood invitation from ' + sender : 'Family invitation from ' + sender,
                text: `${sender} invited you to join their family${includesNeighborhood ? ' and MyNeighborhood' : ''} on Vedlikeholdt.\n\nSign in or create an account using ${email}, then accept here:\n${site}/pages/email-action.html?invitation=${row.id}\n\nThis invitation expires in 7 days. You are not added until you accept.`,
                html: brandedEmail(includesNeighborhood ? 'Family and neighborhood invitation' : 'Family invitation', `${sender} invited you to join their family${includesNeighborhood ? ' and view their neighborhood' : ''} on Vedlikeholdt. Sign in or create an account with ${email} to accept.`, 'Accept invitation', site + '/pages/email-action.html?invitation=' + row.id, 'This invitation expires in 7 days. You receive access only after you accept it.'),
                attachments: emailAttachments() });
            if (!delivery.accepted?.length) throw new Error('Rejected');
        } catch (_) {
            await database('family_invitations?id=eq.' + row.id, 'PATCH', { status: 'failed' });
            if (createdNeighborhoodInvitation) await database('neighborhood_invitations?id=eq.' + neighborhoodInvitation.id, 'PATCH', { status: 'failed' });
            throw new Error('The mail server did not confirm delivery. No member was added. Please check email delivery logs before retrying.');
        } finally { transport.close(); }
        if (createdNeighborhoodInvitation) await database('neighborhood_invitations?id=eq.' + neighborhoodInvitation.id, 'PATCH', { status: 'pending', sent_at: new Date().toISOString() });
        const saved = await database('family_invitations?id=eq.' + row.id, 'PATCH', { status: 'pending', sent_at: new Date().toISOString() });
        return reply({ member: member(saved[0]) });
    } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Could not process invitation.' }, 400); }
});

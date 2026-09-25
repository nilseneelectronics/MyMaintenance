import nodemailer from 'npm:nodemailer@7';

const env = (name: string) => Deno.env.get(name) || '';
const base = env('SUPABASE_URL');
const adminKey = env('SUPABASE_SERVICE_ROLE_KEY');
const site = 'https://vedlikeholdt.no';
const logoUrl = 'https://nrmhojdkoxnlvssdksvf.supabase.co/functions/v1/family-invitations/email-logo.png';
const allowedOrigins = new Set([site, 'https://www.vedlikeholdt.no', 'http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:4173', 'http://localhost:4173', 'http://127.0.0.1:8080', 'http://localhost:8080']);

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
const transport = () => nodemailer.createTransport({
    host: env('SMTP_HOST'), port: 465, secure: true,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASSWORD') }, connectionTimeout: 10000, socketTimeout: 20000
});
const emailHtml = (title: string, body: string, detail: string) => `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f0f4f8;font-family:Arial,sans-serif;color:#05141c"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #afeeee;border-radius:12px;overflow:hidden"><div style="padding:22px 30px;background:#20b2aa;color:#fff;font-size:23px;font-weight:700"><img src="${logoUrl}" width="32" height="32" alt="" style="vertical-align:middle;margin-right:8px;border:0">Vedlikeholdt</div><div style="padding:30px"><h1>${escapeHtml(title)}</h1><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(body)}</p><p style="color:#52616b;font-size:13px">${escapeHtml(detail)}</p></div></div></body></html>`;

Deno.serve(async request => {
    const origin = request.headers.get('origin') || '';
    const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = { 'Access-Control-Allow-Origin': allowedOrigins.has(origin) || localOrigin ? origin : site, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    try {
        const authorization = request.headers.get('authorization') || '';
        const userResponse = await fetch(base + '/auth/v1/user', { headers: { apikey: adminKey, Authorization: authorization } });
        const user = await userResponse.json().catch(() => null);
        if (!userResponse.ok || !user?.id || !user.email_confirmed_at) return reply({ error: 'Please sign in with a verified email address first.' }, 401);
        const message = String((await request.json()).message || '').trim();
        if (!message) return reply({ error: 'Write a message before sending your request.' }, 400);
        if (message.length > 5000) return reply({ error: 'Your message is too long. Please keep it under 5000 characters.' }, 400);
        if (!env('SMTP_HOST') || !env('SMTP_USER') || !env('SMTP_PASSWORD') || !env('SMTP_FROM')) return reply({ error: 'Email service is not configured yet. Please try again later.' }, 503);
        const name = String(user.user_metadata?.name || user.email).trim();
        const mailer = transport();
        try {
            await mailer.sendMail({ from: { name: 'Vedlikeholdt support', address: env('SMTP_FROM') }, to: 'support@vedlikeholdt.no', replyTo: user.email, subject: 'Vedlikeholdt request from ' + name, text: message, html: emailHtml('New support request', message, `Reply to: ${user.email}`) });
            await mailer.sendMail({ from: { name: 'Vedlikeholdt', address: env('SMTP_FROM') }, to: user.email, subject: 'We received your Vedlikeholdt request', text: `Hi ${name},\n\nWe received your request and will look into it.\n\nYour message:\n${message}`, html: emailHtml('Request received', `Hi ${name}, we received your request and will look into it.`, `Your message: ${message}`) });
        } finally { mailer.close(); }
        return reply({ sent: true });
    } catch (error) {
        console.error('Support request failed:', error);
        return reply({ error: 'We could not send your request. Please try again later.' }, 500);
    }
});

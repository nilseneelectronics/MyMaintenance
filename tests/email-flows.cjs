const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
async function main() {
  const store = new Map(); const calls = [];
  const context = { window: { MyMaintenanceConfig: { supabaseUrl: 'https://test.invalid', supabasePublishableKey: 'public-test', emailActionUrl: 'https://vedlikeholdt.no/pages/email-action.html' } },
    URLSearchParams, Date, localStorage: { getItem: k => store.get(k), setItem: (k,v) => store.set(k,v) },
    location: { search: '?next=https://evil.invalid' }, fetch: async (url,opts) => { calls.push({url,opts}); return { ok:true, json:async()=>({}) }; } };
  vm.runInNewContext(read('script/modules/auth.js'), context);
  const auth = context.window.MyMaintenanceAuth;
  await auth.sendRecovery('test@example.test');
  assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'), 'https://vedlikeholdt.no/pages/email-action.html');
  assert.equal(JSON.parse(calls[0].opts.body).email, 'test@example.test');
  assert.equal(auth.safeNext(), 'dashboard.html');
  context.location.search = '?next=' + encodeURIComponent('email-action.html?invitation=test');
  assert.equal(auth.safeNext(), 'email-action.html?invitation=test');
  auth._storeSupabaseSession({ access_token:'test', expires_in:3600 });
  assert(auth._readSupabaseSession().expires_at > Date.now()/1000);

  // Exercise the actual Edge Function handler with mock Auth, DB, and SMTP.
  let handler, verified = true, smtpFails = false; const operations = [];
  const id='11111111-1111-4111-8111-111111111111';
  const row={id,name:'Recipient',email:'recipient@example.test',role:'Member',status:'sending',member_profile:{}};
  const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',SMTP_HOST:'mail.test.invalid',SMTP_USER:'noreply@example.test',SMTP_PASSWORD:'test-only',SMTP_FROM:'noreply@example.test'};
  const backend = { Request, Response, Set, Date, Number, String, Error,
    Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn}},
    nodemailer:{createTransport:()=>({close(){},sendMail:async mail=>{operations.push('smtp');assert(mail.text.includes('https://vedlikeholdt.no/pages/email-action.html?invitation='));if(smtpFails)throw Error('mock failure');return {accepted:[mail.to]}}})},
    fetch:async(url,options)=>{
      if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'owner',email:'owner@example.test',email_confirmed_at:verified?'2026-01-01':null}));
      if(url.includes('reserve_family_invitation')){operations.push('reserve');return new Response(JSON.stringify(row));}
      if(url.includes('accept_family_invitation'))return new Response(JSON.stringify({code:'P0001',message:'Invitation not found for your email address.'}),{status:400});
      const body=JSON.parse(options.body);operations.push(body.status);return new Response(JSON.stringify([{...row,...body}]));
    }
  };
  vm.runInNewContext(require('node:module').stripTypeScriptTypes(read('supabase/functions/family-invitations/index.ts').replace(/^import .*\n/,'')),backend);
  const request = body=>new Request('https://test.invalid/functions/v1/family-invitations',{method:'POST',headers:{authorization:'Bearer test','Content-Type':'application/json',origin:'http://127.0.0.1:5500'},body:JSON.stringify(body)});
  const send={action:'send',name:'Recipient',email:'recipient@example.test',role:'Member'};
  verified=false;assert.equal((await handler(request(send))).status,401);assert.equal(operations.length,0);
  verified=true;const result=await (await handler(request(send))).json();assert.equal(result.member.status,'invited');assert(result.member.sentAt);assert.deepEqual(operations,['reserve','smtp','pending']);
  operations.length=0;smtpFails=true;assert.equal((await handler(request(send))).status,400);assert.deepEqual(operations,['reserve','smtp','failed']);
  assert.equal((await handler(request({action:'send',...send,role:'Owner'}))).status,400);
  assert.equal((await handler(request({action:'accept',id}))).status,400);

  // Test reset landing-page flow without a real session or password change.
  const elements={};
  for(const key of ['action-message','action-title','reset-form','verify-link','accept-invite','sign-in','new-password','repeat-password'])elements[key]={textContent:'',hidden:true,value:'',addEventListener(type,fn){this[type]=fn},querySelector(){return this.button||(this.button={})},reset(){this.didReset=true}};
  let resetCalls=0, cleared=false;
  const page={window:{MyMaintenanceAuth:{_getSupabaseUser:async()=>({id:'test'}),_supabaseRequest:async()=>{resetCalls++;return {response:{ok:true},data:{}}},_clearSupabaseSession(){cleared=true}}},document:{getElementById:id=>elements[id]},URLSearchParams,
    location:{search:'',hash:'#type=recovery&access_token=test-only',pathname:'/pages/email-action.html'},history:{replaceState(_a,_b,url){assert(!url.includes('access_token'))}}};
  await vm.runInNewContext(read('script/pages/email-action.js'),page);
  assert.equal(elements['reset-form'].hidden,false);
  elements['new-password'].value='test-password';elements['repeat-password'].value='different';
  await elements['reset-form'].submit({preventDefault(){}});assert.equal(resetCalls,0);
  elements['repeat-password'].value='test-password';
  await elements['reset-form'].submit({preventDefault(){}});assert.equal(resetCalls,1);assert(cleared);assert.equal(elements['reset-form'].hidden,true);
  console.log('PASS: reset redirect, safe next URL, session expiry, verified-user gate, pending after SMTP only, SMTP failures, role validation, acceptance errors, reset mismatch and success. No real emails sent.');
}
main().catch(error=>{console.error(error);process.exitCode=1});

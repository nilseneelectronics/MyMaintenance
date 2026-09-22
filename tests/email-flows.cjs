const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
async function main() {
  const hostedLogoUrl='https://nrmhojdkoxnlvssdksvf.supabase.co/functions/v1/family-invitations/email-logo.png';
  for(const template of ['confirmation.html','recovery.html','invite.html','magic-link.html','email-change.html','reauthentication.html']) {
    const html=read('supabase/templates/'+template);
    assert(html.includes(hostedLogoUrl));
    assert(!html.includes('<svg'));
  }
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
  let handler, verified = true, smtpFails = false, neighborhoodScenario = false, existingNeighborhoodPending = false, outgoingFamilyPending = false, incomingFamilyPending = false, actingUserId = 'owner'; const operations = [], sentMail = [];
  const id='11111111-1111-4111-8111-111111111111';
  const recipientId='66666666-6666-4666-8666-666666666666';
  const row={id,inviter_id:'owner',name:'Recipient',email:'recipient@example.test',role:'Member',status:'sending',member_profile:{}};
  const neighborhoodRow={id:'77777777-7777-4777-8777-777777777777',neighborhood_id:'55555555-5555-4555-8555-555555555555',name:'Recipient',email:'recipient@example.test',address:'Example Street 2',status:'sending'};
  const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',SMTP_HOST:'mail.test.invalid',SMTP_USER:'noreply@example.test',SMTP_PASSWORD:'test-only',SMTP_FROM:'noreply@example.test'};
  const backend = { Request, Response, URL, Uint8Array, Set, Date, Number, String, Error, atob:data=>Buffer.from(data,'base64').toString('binary'),
    Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn}},
    nodemailer:{createTransport:()=>({close(){},sendMail:async mail=>{operations.push('smtp');sentMail.push(mail);assert(mail.text.includes('https://vedlikeholdt.no/pages/email-action.html?'));assert(mail.html.includes('Vedlikeholdt'));assert(mail.html.includes('Accept invitation'));assert(mail.html.includes('src="cid:vedlikeholdt-logo"'));assert(!mail.html.includes('\n+<tr'));assert.equal(mail.attachments?.[0]?.cid,'vedlikeholdt-logo');assert.equal(mail.attachments?.[0]?.encoding,'base64');assert.equal(mail.attachments?.[0]?.content,fs.readFileSync(path.join(root,'supabase/functions/family-invitations/assets/vedlikeholdt-email-logo.png')).toString('base64'));if(neighborhoodScenario)assert(mail.text.includes('?neighborhood-invitation='));if(smtpFails)throw Error('mock failure');return {accepted:[mail.to]}}})},
    fetch:async(url,options)=>{
      if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:actingUserId,email:actingUserId+'@example.test',email_confirmed_at:verified?'2026-01-01':null}));
      if(url.includes('family_members?')) {
        if(neighborhoodScenario && url.includes('user_id=eq.owner')) return new Response(JSON.stringify([{family_id:'family-test',user_id:'owner',role:'Owner'}]));
        if(neighborhoodScenario && url.includes('user_id=eq.member')) return new Response(JSON.stringify([{family_id:'member-family',user_id:'member',role:'Owner'}]));
        if(neighborhoodScenario && url.includes('family_id=eq.member-family')) return new Response(JSON.stringify([{user_id:'member'}]));
        if(neighborhoodScenario && url.includes('user_id=eq.'+recipientId)) return new Response(JSON.stringify([{user_id:recipientId,role:'Member'}]));
        return new Response(JSON.stringify([]));
      }
      if(url.endsWith('/rest/v1/families')) return new Response(JSON.stringify([{id:'44444444-4444-4444-8444-444444444444'}]));
      if(url.endsWith('/rest/v1/family_members')) return new Response(JSON.stringify([]));
      if(url.includes('/rest/v1/homes?') || url.includes('/rest/v1/vehicles?')) return new Response(JSON.stringify([]));
      if(url.includes('/rest/v1/profiles?')) return new Response(JSON.stringify(neighborhoodScenario && url.includes('id=eq.'+recipientId) ? [{display_name:'Recipient',details:{profile:{name:'Recipient',email:'recipient@example.test'}}}] : (url.includes('id=eq.') ? [{display_name:'Alex Inviter',details:{profile:{name:'Alex Inviter'}}}] : [])));
      if(url.includes('/rest/v1/neighborhood_members?')) return new Response(JSON.stringify(actingUserId==='member' ? [{user_id:'member'}] : []));
      if(url.endsWith('/rest/v1/neighborhood_members')) return new Response(JSON.stringify([{}]));
      if(url.includes('/rest/v1/neighborhoods?') && options.method==='GET') return new Response(JSON.stringify(neighborhoodScenario ? [{id:'55555555-5555-4555-8555-555555555555',owner_id:'owner',name:'Test Neighborhood',details:{addresses:[]}}] : []));
      if(url.includes('neighborhood_invitations?') && options.method==='GET') return new Response(JSON.stringify(existingNeighborhoodPending ? [{...neighborhoodRow,status:'pending'}] : []));
      if(url.includes('family_invitations?') && options.method==='GET') {
        operations.push('list');
        if(url.includes('family_id=eq.member-family')) return new Response(JSON.stringify([]));
        if(url.includes('family_id=eq.') && outgoingFamilyPending) return new Response(JSON.stringify([row]));
        if(url.includes('status=eq.pending') && url.includes('email=eq.') && url.includes('order=created_at.asc')) return new Response(JSON.stringify(incomingFamilyPending ? [row] : []));
        if(url.includes('email=eq.')) return new Response(JSON.stringify([{...row,id:'22222222-2222-4222-8222-222222222222',status:'pending'}]));
        if(url.includes('recipient_id=eq.')) return new Response(JSON.stringify([{...row,id:'33333333-3333-4333-8333-333333333333',status:'accepted'}]));
        return new Response(JSON.stringify([]));
      }
      if(url.includes('reserve_family_invitation')){operations.push('reserve');return new Response(JSON.stringify(row));}
      if(url.includes('reserve_neighborhood_invitation')){operations.push('reserve-neighborhood');return new Response(JSON.stringify(neighborhoodRow));}
      if(url.includes('accept_family_invitation'))return new Response(JSON.stringify({code:'P0001',message:'Invitation not found for your email address.'}),{status:400});
      if(options.method==='DELETE'){operations.push('delete');return new Response(JSON.stringify([]));}
      const body=JSON.parse(options.body);if(body.status==='cancelled'){assert(url.includes('neighborhood_id=eq.55555555-5555-4555-8555-555555555555'));assert(url.includes('inviter_id=eq.owner'));assert(url.includes('email=eq.resident%40example.test'));assert(url.includes('status=eq.pending'));}operations.push(body.status || 'family');return new Response(JSON.stringify([{...row,...body}]));
    }
  };
  vm.runInNewContext(require('node:module').stripTypeScriptTypes(read('supabase/functions/family-invitations/index.ts').replace(/^import[^\r\n]*\r?\n/,'')),backend);
  const logoResponse=await handler(new Request('https://test.invalid/functions/v1/family-invitations/email-logo.png'));
  assert.equal(logoResponse.status,200);assert.equal(logoResponse.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await logoResponse.arrayBuffer()),fs.readFileSync(path.join(root,'supabase/functions/family-invitations/assets/vedlikeholdt-email-logo.png')));
  const request = body=>new Request('https://test.invalid/functions/v1/family-invitations',{method:'POST',headers:{authorization:'Bearer test','Content-Type':'application/json',origin:'http://127.0.0.1:5500'},body:JSON.stringify(body)});
  const send={action:'send',name:'Recipient',email:'recipient@example.test',role:'Member'};
  verified=false;assert.equal((await handler(request(send))).status,401);assert.equal(operations.length,0);
  verified=true;const result=await (await handler(request(send))).json();assert.equal(result.member.status,'invited');assert(result.member.sentAt);assert.deepEqual(operations,['reserve','family','smtp','pending']);
  operations.length=0;existingNeighborhoodPending=true;const separate=await (await handler(request({...send,inviteNeighborhood:true}))).json();assert.equal(separate.member.status,'invited');assert(!operations.includes('reserve-neighborhood'));assert.deepEqual(operations,['reserve','family','smtp','pending']);existingNeighborhoodPending=false;
  operations.length=0;smtpFails=true;assert.equal((await handler(request(send))).status,400);assert.deepEqual(operations,['reserve','family','smtp','failed']);
  assert.equal((await handler(request({action:'send',...send,role:'Owner'}))).status,400);
  assert.equal((await handler(request({action:'accept',id}))).status,400);
  operations.length=0;const details=await (await handler(request({action:'details',id}))).json();assert.equal(details.invitation.inviterName,'Alex Inviter');
  operations.length=0;const listed=await (await handler(request({action:'list'}))).json();assert.deepEqual(listed.members,[]);assert.equal(listed.familyId,'44444444-4444-4444-8444-444444444444');
  outgoingFamilyPending=true;const outgoingList=await (await handler(request({action:'list'}))).json();assert.equal(outgoingList.members.length,1);assert.equal(outgoingList.members[0].status,'invited');assert.equal(outgoingList.members[0].incomingInvitation,false);outgoingFamilyPending=false;
  incomingFamilyPending=true;const incomingList=await (await handler(request({action:'list'}))).json();assert.equal(incomingList.members.length,1);assert.equal(incomingList.members[0].incomingInvitation,true);incomingFamilyPending=false;
  smtpFails=false;neighborhoodScenario=true;operations.length=0;const neighborhoodInvite=await (await handler(request({action:'invite-neighborhood',recipientId}))).json();assert.equal(neighborhoodInvite.invited,true);assert(operations.includes('reserve-neighborhood'));assert(operations.includes('smtp'));
  operations.length=0;const houseInvite=await (await handler(request({action:'invite-neighborhood-address',neighborhoodId:'55555555-5555-4555-8555-555555555555',address:'Example Street 2',email:'resident@example.test'}))).json();assert.equal(houseInvite.invited,true);assert(operations.includes('reserve-neighborhood'));assert(operations.includes('smtp'));assert.equal(sentMail.at(-1).to,'resident@example.test');assert.equal(sentMail.at(-1).envelope.from,'noreply@example.test');assert.equal(sentMail.at(-1).envelope.to[0],'resident@example.test');neighborhoodScenario=false;
  operations.length=0;const cancelled=await (await handler(request({action:'cancel-neighborhood',neighborhoodId:'55555555-5555-4555-8555-555555555555',email:'resident@example.test'}))).json();assert.equal(cancelled.cancelled,true);assert(operations.includes('cancelled'));
  neighborhoodScenario=true;actingUserId='member';operations.length=0;assert.equal((await handler(request({action:'invite-neighborhood-address',neighborhoodId:'55555555-5555-4555-8555-555555555555',address:'Example Street 2',email:'outsider@example.test'}))).status,400);assert(!operations.includes('smtp'));actingUserId='owner';neighborhoodScenario=false;

  // Test reset landing-page flow without a real session or password change.
  const elements={};
  for(const key of ['action-message','action-detail','action-title','reset-form','verify-link','accept-invite','sign-in','new-password','repeat-password'])elements[key]={textContent:'',hidden:true,value:'',addEventListener(type,fn){this[type]=fn},querySelector(){return this.button||(this.button={})},reset(){this.didReset=true}};
  let resetCalls=0, cleared=false;
  const page={window:{MyMaintenanceAuth:{_getSupabaseUser:async()=>({id:'test'}),_supabaseRequest:async()=>{resetCalls++;return {response:{ok:true},data:{}}},_clearSupabaseSession(){cleared=true}}},document:{getElementById:id=>elements[id]},URLSearchParams,
    location:{search:'',hash:'#type=recovery&access_token=test-only',pathname:'/pages/email-action.html'},history:{replaceState(_a,_b,url){assert(!url.includes('access_token'))}}};
  await vm.runInNewContext(read('script/pages/email-action.js'),page);
  assert.equal(elements['reset-form'].hidden,false);
  elements['new-password'].value='test-password';elements['repeat-password'].value='different';
  await elements['reset-form'].submit({preventDefault(){}});assert.equal(resetCalls,0);
  elements['repeat-password'].value='test-password';
  await elements['reset-form'].submit({preventDefault(){}});assert.equal(resetCalls,1);assert(cleared);assert.equal(elements['reset-form'].hidden,true);

  const invitationElements={};
  for(const key of ['action-message','action-detail','action-title','reset-form','verify-link','accept-invite','sign-in','new-password','repeat-password'])invitationElements[key]={textContent:'',hidden:true,value:'',addEventListener(type,fn){this[type]=fn},querySelector(){return this.button||(this.button={})},reset(){}};
  const invitationPage={window:{MyMaintenanceAuth:{_getSupabaseSession:async()=>({access_token:'test'}),_getSupabaseUser:async()=>({id:'recipient'}),familyRequest:async action=>{assert.equal(action,'details');return {invitation:{inviterName:'Alex Inviter'}}}}},document:{getElementById:id=>invitationElements[id]},URLSearchParams,
    location:{search:'?invitation='+id,hash:'',pathname:'/pages/email-action.html'},history:{replaceState(){}}};
  await vm.runInNewContext(read('script/pages/email-action.js'),invitationPage);
  assert.equal(invitationElements['action-message'].textContent,"You are invited to join Alex Inviter's family.");
  assert.equal(invitationElements['action-detail'].hidden,false);assert.equal(invitationElements['accept-invite'].hidden,false);

  const neighborhoodElements={};
  for(const key of ['action-message','action-detail','action-title','reset-form','verify-link','accept-invite','sign-in','new-password','repeat-password'])neighborhoodElements[key]={textContent:'',hidden:true,value:'',addEventListener(type,fn){this[type]=fn},querySelector(){return this.button||(this.button={})},reset(){}};
  const neighborhoodPage={window:{MyMaintenanceAuth:{_getSupabaseSession:async()=>({access_token:'test'}),_getSupabaseUser:async()=>({id:'recipient'}),familyRequest:async action=>{assert.equal(action,'details-neighborhood');return {invitation:{inviterName:'Alex Inviter',neighborhoodName:'Test Neighborhood',address:'Example Street 2'}}}}},document:{getElementById:id=>neighborhoodElements[id]},URLSearchParams,
    location:{search:'?neighborhood-invitation='+neighborhoodRow.id,hash:'',pathname:'/pages/email-action.html'},history:{replaceState(){}}};
  await vm.runInNewContext(read('script/pages/email-action.js'),neighborhoodPage);
  assert.equal(neighborhoodElements['action-message'].textContent,'Alex Inviter invited you to join Test Neighborhood.');
  assert(neighborhoodElements['action-detail'].textContent.includes('Example Street 2'));
  assert.equal(neighborhoodElements['accept-invite'].textContent,'Accept neighborhood invitation');
  console.log('PASS: reset redirect, safe next URL, session expiry, verified-user gate, invitation details, pending after SMTP only, SMTP failures, role validation, acceptance errors, reset mismatch and success. No real emails sent.');
}
main().catch(error=>{console.error(error);process.exitCode=1});

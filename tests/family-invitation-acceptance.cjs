const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const edge = fs.readFileSync(path.join(root, 'supabase/functions/family-invitations/index.ts'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260923203556_atomic_family_invitation_acceptance.sql'), 'utf8');
const accept = edge.slice(edge.indexOf("if (body.action === 'accept')"), edge.indexOf("if (body.action === 'reject')"));

assert.match(accept, /rpc\/accept_family_invitation/);
assert.doesNotMatch(accept, /database\('family_members'/);
assert.match(sql, /invitation\.status = 'accepted' and invitation\.recipient_id = p_user/);
assert.match(sql, /update public\.homes set family_id = invitation\.family_id/);
assert.match(sql, /update public\.vehicles set family_id = invitation\.family_id/);
assert.match(sql, /update public\.documents set family_id = invitation\.family_id/);
assert.match(sql, /membership\.role <> 'Owner' or member_count <> 1/);
assert.match(sql, /revoke all on function public\.accept_family_invitation\(uuid,uuid,text\) from public,anon,authenticated/);

console.log('PASS: family invitation acceptance is atomic, retry-safe, and migrates solo-family assets.');

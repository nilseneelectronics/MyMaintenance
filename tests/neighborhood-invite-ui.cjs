const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../script/pages/myneighborhood.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../css/neighborhood.css'), 'utf8');
const ownerRoleMigration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260922194929_fix_neighborhood_owner_role.sql'), 'utf8');
const adminMigration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260920210000_neighborhood_admin_members.sql'), 'utf8');

assert.match(source, /person\.invitationStatus !== 'cancelled'/);
assert.match(source, /person\.invitationStatus = 'cancelled'/);
assert.match(source, /!isAdmin && person\.invitationStatus === 'cancelled'/);
assert.match(source, /familyRequest\('cancel', \{/);
assert.match(source, /id: person\.invitationId \|\| ''/);
assert.match(source, /kind: 'neighborhood'/);
assert.match(source, /neighborhoodId: builderModel\.id/);
assert.match(source, /email: person\.email/);
assert.match(source, /person\.userId === ownerId/);
assert.doesNotMatch(source, /person\.userId === me\.id/);
assert.match(source, /!creator && !joined && !pending/);
assert.match(source, /pending \? \(isAdmin \? 'Cancel invite' : 'Pending'\)/);
assert.match(source, /invite\.disabled = joined \|\| \(pending && !isAdmin\)/);
assert.match(styles, /\.nb-popup-wide\s*\{[^}]*max-width: 820px/s);
assert.match(styles, /\.nb-invite-status\s*\{[^}]*text-overflow: ellipsis/s);
assert.match(ownerRoleMigration, /values \(new\.id, new\.owner_id, 'admin'\)/);
assert.doesNotMatch(ownerRoleMigration, /values \(new\.id, new\.owner_id, 'owner'\)/);
assert.match(source, /className = 'nb-kick-btn'/);
assert.match(source, /rpc\/admin_remove_neighborhood_member/);
assert.match(source, /rpc\/admin_move_neighborhood_member/);
assert.match(adminMigration, /function public\.admin_remove_neighborhood_member/);

console.log('PASS: cancelled neighborhood invite keeps recipient email available for re-send.');

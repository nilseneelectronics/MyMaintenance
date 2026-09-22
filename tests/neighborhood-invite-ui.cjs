const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../script/pages/myneighborhood.js'), 'utf8');

assert.match(source, /person\.invitationStatus !== 'cancelled'/);
assert.match(source, /person\.invitationStatus = 'cancelled'/);
assert.match(source, /!isAdmin && person\.invitationStatus === 'cancelled'/);
assert.match(source, /familyRequest\('cancel', \{/);
assert.match(source, /id: person\.invitationId/);
assert.match(source, /kind: 'neighborhood'/);

console.log('PASS: cancelled neighborhood invite keeps recipient email available for re-send.');

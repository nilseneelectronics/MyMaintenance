const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'pages/myprofile.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/profile.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'script/pages/myprofile.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'script/modules/profile-data.js'), 'utf8');

assert.equal((html.match(/class="profile-role-info-btn"/g) || []).length, 2);
assert.match(html, /<strong>Owner<\/strong> manages family members/);
assert.match(html, /MyNeighborhood requires a separate invitation/);
assert.match(css, /\.profile-role-label-row\s*{[^}]*justify-content: space-between/s);
assert.match(css, /\.profile-role-tooltip\s*{[^}]*right: 0/s);
assert.match(css, /#invite-popup \.profile-role-tooltip\s*{[^}]*width: 320px/s);
assert.match(css, /#invite-popup \.popup-content\s*{[^}]*max-width: 600px[^}]*max-height: none[^}]*overflow: visible/s);
assert.match(css, /#invite-popup \.popup-content \.done-fields\s*{[^}]*overflow: visible/s);
assert.match(css, /\.toggle-track\s*{[^}]*width: 52px/s);
assert.match(css, /\.profile-toggle\s*{[^}]*min-height: 54px/s);
assert.match(data, /\{ key: 'subscription', label: 'Subscription' \},\s*\{ key: 'neighborhood', label: 'MyNeighborhood', invitation: true \}/);
assert.match(js, /function wireRoleInfo\(\)/);
assert.match(js, /aria-expanded/);

console.log('PASS: both Role fields expose accessible right-aligned role information.');

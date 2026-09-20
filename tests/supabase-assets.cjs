const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
    return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

const migration = read('supabase/migrations/20260920180636_fix_floorplans_neighborhood_documents_photos.sql');
const assets = read('script/pages/asset-boxes.js');
const gallery = read('script/pages/gallery.js');
const documents = read('script/pages/mydocuments.js');
const neighborhood = read('script/pages/myneighborhood.js');

for (const table of ['projects', 'floorplans', 'asset_photos']) {
    assert.match(migration, new RegExp(`grant select, insert, update, delete on public\\.${table} to authenticated, service_role`));
}
assert.match(migration, /add column if not exists neighborhood_id uuid references public\.neighborhoods/);
assert.match(migration, /public\.is_current_neighborhood_member\(neighborhood_id\)/);
assert.match(migration, /public\.is_current_neighborhood_editor\(neighborhood_id\)/);
assert.match(migration, /coalesce\(extracted_data->>'privacy', 'neighborhood'\) = 'neighborhood'/);
assert.match(assets, /new CustomEvent\('asset:selected'/);
assert.match(assets, /url\.searchParams\.set\('id', id\)/);
assert.match(gallery, /let assetId = pageParams\.get\('id'\) \|\| ''/);
assert.match(gallery, /window\.addEventListener\('asset:selected'/);
assert.match(documents, /neighborhood_id: item\.neighborhoodId \|\| null/);
assert.match(documents, /neighborhoodId: row\.neighborhood_id \|\| ''/);
assert.match(neighborhood, /await persistNeighborhoodDocument\(doc\)/);
assert.match(neighborhood, /neighborhoodId: nb\.id/);

console.log('PASS: Supabase grants, asset photo selection, and neighborhood document persistence are wired.');

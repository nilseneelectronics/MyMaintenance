const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
    return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

const script = read('script/pages/mydocuments.js');
const styles = read('css/documents.css');

assert.match(script, /const fitScale = Math\.min\(1, availableWidth \/ image\.naturalWidth, availableHeight \/ image\.naturalHeight\)/);
assert.match(script, /const scale = fitScale \* zoom \/ 100/);
assert.match(script, /stage\.style\.width = stageWidth \+ 'px'/);
assert.match(script, /new ResizeObserver\(sizeImage\)/);
assert.doesNotMatch(styles, /zoom: var\(--doc-image-scale/);

function fitted(naturalWidth, naturalHeight, viewportWidth, viewportHeight, zoom) {
    const availableWidth = viewportWidth - 40;
    const availableHeight = viewportHeight - 40;
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight) * zoom / 100;
    return { width: naturalWidth * scale, height: naturalHeight * scale };
}

for (const dimensions of [[12000, 800], [800, 12000], [12000, 12000]]) {
    const full = fitted(dimensions[0], dimensions[1], 760, 480, 100);
    const half = fitted(dimensions[0], dimensions[1], 760, 480, 50);
    assert.ok(full.width <= 720 && full.height <= 440);
    assert.equal(half.width, full.width / 2);
    assert.equal(half.height, full.height / 2);
}

console.log('PASS: document image zoom is based on fitted viewport dimensions.');

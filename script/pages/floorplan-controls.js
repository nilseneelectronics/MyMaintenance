// Keep drawing content, annotations and interactive controls in predictable layers.
let floorplanControlsReady = false;

function floorplanPointerCoordinates(event, bounds, width, height, viewport, ignoreZoom = false) {
  const pointer = event.touches?.[0] || event.changedTouches?.[0] || event;
  if (!Number.isFinite(pointer.clientX) || !Number.isFinite(pointer.clientY) || !bounds.width || !bounds.height) return null;
  // Client pixels already include CSS zoom. Canvas width/height are logical
  // pixels, independent of the retina-scaled backing bitmap.
  const screen = { x: (pointer.clientX - bounds.left) * width / bounds.width,
    y: (pointer.clientY - bounds.top) * height / bounds.height };
  if (ignoreZoom) return screen;
  const [a, b, c, d, tx, ty] = viewport, determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return screen;
  const x = screen.x - tx, y = screen.y - ty;
  return { x: (d * x - c * y) / determinant, y: (-b * x + a * y) / determinant };
}

function installFloorplanPointerMapping(target) {
  const original = target.getPointer;
  target.getPointer = function(event, ignoreZoom = false) {
    const point = floorplanPointerCoordinates(event, this.upperCanvasEl.getBoundingClientRect(),
      this.width, this.height, this.viewportTransform, ignoreZoom);
    return point || original.call(this, event, ignoreZoom);
  };
}

function floorplanObjectLayer(object) {
  return { stair: 0, symbol: 1, wall: 2, window: 3, door: 3, room: 4 }[object.data?.kind] ?? 1;
}

function syncFloorplanObjectLayers() {
  if (!canvas || typeof canvas.moveTo !== 'function') return;
  const objects = canvas.getObjects().slice();
  const sorted = objects.slice().sort((a, b) => floorplanObjectLayer(a) - floorplanObjectLayer(b));
  if (sorted.every((object, index) => object === objects[index])) return;
  const renderOnAddRemove = canvas.renderOnAddRemove;
  canvas.renderOnAddRemove = false;
  try { sorted.forEach((object, index) => canvas.moveTo(object, index)); }
  finally { canvas.renderOnAddRemove = renderOnAddRemove; }
}

function renderFloorplanRotationControl(ctx, left, top) {
  const colors = typeof floorplanColors === 'function' ? floorplanColors() : { surface: '#fff', snap: '#008c85', border: '#bac9cd' };
  ctx.save(); ctx.translate(left, top);
  ctx.fillStyle = colors.surface; ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = colors.snap; ctx.fillStyle = colors.snap; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const start of [-Math.PI * .85, Math.PI * .15]) {
    const end = start + Math.PI * .72, radius = 7.5;
    ctx.beginPath(); ctx.arc(0, 0, radius, start, end); ctx.stroke();
    const x = Math.cos(end) * radius, y = Math.sin(end) * radius;
    const ux = -Math.sin(end), uy = Math.cos(end);
    ctx.beginPath(); ctx.moveTo(x + ux * 1.8, y + uy * 1.8);
    ctx.lineTo(x - ux * 3.5 - uy * 2.6, y - uy * 3.5 + ux * 2.6);
    ctx.lineTo(x - ux * 3.5 + uy * 2.6, y - uy * 3.5 - ux * 2.6);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function installFloorplanRotationControl(object) {
  if (!['symbol', 'stair', 'door', 'window'].includes(object.data?.kind) || object.data.hostWallId) return;
  const original = object.controls?.mtr;
  if (!original || original._floorplanRotation) return;
  // Each object receives its own control; Fabric's shared defaults stay intact.
  object.controls = { ...object.controls, mtr: Object.assign(Object.create(original), {
    render: renderFloorplanRotationControl, sizeX: 28, sizeY: 28, touchSizeX: 40, touchSizeY: 40,
    offsetY: -36, cursorStyleHandler: () => 'crosshair', _floorplanRotation: true
  }) };
  object.setCoords();
}

function setupFloorplanControls() {
  if (floorplanControlsReady) return;
  floorplanControlsReady = true;
  canvas.on('object:added', event => installFloorplanRotationControl(event.target));
  canvas.getObjects().forEach(installFloorplanRotationControl);
  canvas.on('before:render', syncFloorplanObjectLayers);
}

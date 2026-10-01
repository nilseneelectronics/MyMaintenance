// Follow the app's system light/dark preference, including changes while editing.
const floorplanLightPalette = Object.freeze({
  background: '#ffffff', text: '#263640', muted: '#637784',
  wallInner: '#adb8bf', wallOuter: '#687985', wallBearing: '#303d46',
  outline: '#253640', hatch: '#778d98', snap: '#00786e',
  gridMinor: '#edf1f3', gridMajor: '#d6dfe5', gridAxis: '#afbec8',
  surface: '#ffffff', panel: '#f6f9fa', border: '#d6e0e6', halo: '#ffffff'
});
const floorplanDarkPalette = Object.freeze({
  background: '#101b24', text: '#e4edf3', muted: '#a5b7c4',
  wallInner: '#526976', wallOuter: '#8ca5b3', wallBearing: '#becfd9',
  outline: '#dce9ef', hatch: '#839ba8', snap: '#78f2df',
  gridMinor: '#1e2b35', gridMajor: '#304451', gridAxis: '#587080',
  surface: '#172731', panel: '#1a2d38', border: '#3a5261', halo: '#101b24'
});
let floorplanThemeMedia = null;
let floorplanThemeReady = false;

function floorplanColors() {
  const media = floorplanThemeMedia || (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);
  return media?.matches ? floorplanDarkPalette : floorplanLightPalette;
}

function drawFloorplanSnapMarker(ctx, worldPoint) {
  if (!ctx || !worldPoint || !Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.y)) return;
  const zoom = typeof canvas !== 'undefined' && canvas ? Math.max(0.01, canvas.getZoom()) : 1;
  const palette = floorplanColors(), radius = 4 / zoom, arm = 11 / zoom, gap = 7 / zoom;
  const { x, y } = worldPoint;
  ctx.save();
  ctx.lineCap = 'round';
  const marker = () => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.moveTo(x - arm, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + arm);
    ctx.stroke();
  };
  // The halo separates the marker from wall fills and the foreground separates
  // it from the workspace, so neither a wall nor a grid line can hide it.
  ctx.strokeStyle = palette.halo; ctx.lineWidth = 5 / zoom; marker();
  ctx.strokeStyle = palette.snap; ctx.lineWidth = 1.75 / zoom; marker();
  ctx.fillStyle = palette.snap;
  ctx.beginPath(); ctx.arc(x, y, 1 / zoom, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function refreshFloorplanTheme() {
  if (typeof canvas === 'undefined' || !canvas) return;
  const palette = floorplanColors();
  canvas.getObjects().forEach(object => {
    object.dirty = true;
    if (object.data?.kind === 'room') object.set('fill', palette.text);
  });
  // Fabric stays transparent so the separately rendered grid remains visible.
  canvas.requestRenderAll();
}

function setupFloorplanTheme() {
  if (floorplanThemeReady) return;
  floorplanThemeReady = true;
  if (typeof window !== 'undefined' && window.matchMedia) {
    floorplanThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    if (floorplanThemeMedia.addEventListener) floorplanThemeMedia.addEventListener('change', refreshFloorplanTheme);
    else if (floorplanThemeMedia.addListener) floorplanThemeMedia.addListener(refreshFloorplanTheme);
  }
  refreshFloorplanTheme();
}

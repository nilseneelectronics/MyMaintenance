// Existing plans store centimetres. Display units never rescale saved geometry.
let floorplanUnit = 'mm';
function floorplanUnitLabel() { return floorplanUnit; }
function floorplanToDisplayLength(value) { return Number(value) * (floorplanUnit === 'mm' ? 10 : 1); }
function floorplanFromDisplayLength(value) { return Number(String(value).trim().replace(',', '.')) / (floorplanUnit === 'mm' ? 10 : 1); }
function floorplanFormatLength(value, decimals = 1) { return String(Number(floorplanToDisplayLength(value).toFixed(decimals))); }

function syncFloorplanUnitControls() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-fp-unit]').forEach(element => { element.textContent = floorplanUnit; });
  const selector = document.getElementById('floorplanUnit');
  if (selector) selector.value = floorplanUnit;
  const fields = [
    ['wallThickness', typeof wallThickness === 'undefined' ? 15 : wallThickness, 1, 100],
    ['innerWallThickness', typeof wallDefaultThickness === 'undefined' ? 15 : wallDefaultThickness.inner, 1, 100],
    ['outerWallThickness', typeof wallDefaultThickness === 'undefined' ? 25 : wallDefaultThickness.outer, 1, 100],
    ['gridStep', typeof floorplanGridStep === 'undefined' ? 10 : floorplanGridStep, 0.1, 100]
  ];
  fields.forEach(([id,value,min,max]) => {
    const input = document.getElementById(id); if (!input) return;
    input.value = floorplanFormatLength(value); input.min = floorplanToDisplayLength(min); input.max = floorplanToDisplayLength(max);
    input.step = floorplanUnit === 'mm' ? 1 : 0.1;
    input.setAttribute('aria-label', `${id === 'gridStep' ? 'Grid snap spacing' : id === 'wallThickness' ? 'Wall thickness' : id === 'innerWallThickness' ? 'Inner wall thickness' : 'Outer wall thickness'} (${floorplanUnit})`);
  });
  if (typeof syncFloorplanDropdowns === 'function') syncFloorplanDropdowns();
}

function setFloorplanUnit(unit) {
  if (!['mm', 'cm'].includes(unit) || unit === floorplanUnit) return;
  if (typeof finishCurrent === 'function') finishCurrent();
  floorplanUnit = unit;
  syncFloorplanUnitControls();
  if (typeof floorplanInspectorShape !== 'undefined') floorplanInspectorShape = null;
  if (typeof refreshFloorplanInspector === 'function') refreshFloorplanInspector();
  if (typeof canvas !== 'undefined' && canvas) canvas.requestRenderAll();
  if (typeof isDirty !== 'undefined') isDirty = true;
  if (typeof syncSaveButton === 'function') syncSaveButton();
}

function floorplanSettings() {
  return { unit: floorplanUnit,
    wallThickness: typeof wallDefaultThickness === 'undefined' ? {inner:15,outer:25} : {...wallDefaultThickness},
    symbolsVisible: typeof floorplanSymbolsVisible === 'undefined' ? true : floorplanSymbolsVisible };
}
function restoreFloorplanSettings(settings) {
  floorplanUnit = settings?.unit === 'cm' ? 'cm' : 'mm';
  if (typeof wallDefaultThickness !== 'undefined') for (const type of ['inner','outer']) {
    const thickness = Number(settings?.wallThickness?.[type]);
    wallDefaultThickness[type] = Number.isFinite(thickness) && thickness >= 1 && thickness <= 100 ? thickness : type === 'inner' ? 15 : 25;
  }
  if (typeof floorplanSymbolsVisible !== 'undefined') floorplanSymbolsVisible = settings?.symbolsVisible !== false;
  if (typeof document !== 'undefined') {
    const button = document.getElementById('symbolsVisibilityBtn');
    button?.classList.toggle('active', settings?.symbolsVisible !== false);
    button?.setAttribute('aria-pressed', String(settings?.symbolsVisible !== false));
  }
  syncFloorplanUnitControls();
  if (typeof floorplanInspectorShape !== 'undefined') floorplanInspectorShape = null;
}

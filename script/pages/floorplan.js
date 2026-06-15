// floorplan.js - Floor Plan Designer

// ====================== STATE ======================
let canvas, currentTool = 'select';
let showGrid = true, snapEnabled = true;
let currentZoom = 1;
let isPanning = false, panStartX, panStartY, panStartVpt;
let planFileName = '', isDirty = false;
const GRID_INTERVALS = [0.5, 1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000];

// ====================== INIT ======================
function initCanvas() {
  const wrapper = document.getElementById('canvasWrapper');
  canvas = new fabric.Canvas('canvas', {
    width: wrapper.clientWidth,
    height: wrapper.clientHeight - 4,
    selection: true,
    preserveObjectStacking: true,
    hoverCursor: 'pointer'
  });

  canvas.on('mouse:wheel', onMouseWheel);
  wrapper.addEventListener('wheel', e => e.preventDefault(), { passive: false });

  canvas.on('object:modified', () => isDirty = true);
  canvas.on('object:added', () => isDirty = true);
  canvas.on('object:removed', () => isDirty = true);

  // Center world origin at canvas center
  canvas.viewportTransform = [1, 0, 0, 1, canvas.width / 2, canvas.height / 2];

  setupPan();

  setupGridRenderer();
  createGrid();
  setupPlanTitle();
  updateZoomDisplay();

  window.addEventListener('resize', resizeCanvas);

  canvas.renderAll();
}

function resizeCanvas() {
  const wrapper = document.getElementById('canvasWrapper');
  canvas.setWidth(wrapper.clientWidth);
  canvas.setHeight(wrapper.clientHeight - 4);
  canvas.renderAll();
}

// ====================== TOOL MANAGEMENT ======================
function setTool(tool) {
  currentTool = tool;
  canvas.selection = (tool === 'select');
  canvas.defaultCursor = (tool === 'select') ? 'default' : 'crosshair';
  canvas.hoverCursor = (tool === 'select') ? 'move' : 'crosshair';
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-tool="${tool}"]`);
  if (btn) btn.classList.add('active');
}

// ====================== GRID ======================
function getGridInterval() {
  const targetPx = 80;
  const ideal = targetPx / (canvas?.viewportTransform?.[0] ?? 1);
  let best = GRID_INTERVALS[0];
  for (const v of GRID_INTERVALS) {
    if (Math.abs(v - ideal) < Math.abs(best - ideal)) best = v;
  }
  return best;
}

function setupGridRenderer() {
  const gc = document.getElementById('gridCanvas');
  if (!gc) return;
  const ctx = gc.getContext('2d');
  const wrapper = document.getElementById('canvasWrapper');

  function draw() {
    const w = wrapper.clientWidth, h = wrapper.clientHeight;
    gc.width = w;
    gc.height = h;
    if (!showGrid || !w || !h) return;

    const vpt = canvas.viewportTransform;
    const zoom = vpt[0];
    const step = getGridInterval();

    // Line widths that look the same at any zoom
    const thinW = 0.5 / zoom;
    const midW  = 1 / zoom;
    const thickW = 2 / zoom;

    // Visible world bounds
    const bx1 = -vpt[4] / zoom, by1 = -vpt[5] / zoom;
    const bx2 = (-vpt[4] + w) / zoom, by2 = (-vpt[5] + h) / zoom;

    // Compute a "major" multiple that stays > ~40px on screen
    let majorMult = 5;
    while (step * majorMult * zoom < 40) majorMult *= 2;
    const majorStep = step * majorMult;

    const startX = Math.floor(bx1 / step) * step;
    const startY = Math.floor(by1 / step) * step;

    ctx.save();
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

    // Determine how many decimal places to show
    const decimals = step < 1 ? 1 : 0;
    const fmt = v => v.toFixed(decimals) + 'cm';

    const fontSize = `${14 / zoom}px Poppins, sans-serif`;

    // ── Vertical lines ──
    for (let x = startX; x <= bx2; x += step) {
      const isCenter = Math.abs(x) < step * 0.01;
      const isMajor = isCenter || (majorStep > 0 && Math.abs(x % majorStep) < step * 0.01);
      ctx.strokeStyle = isCenter ? '#666' : isMajor ? '#aaa' : '#ddd';
      ctx.lineWidth = isCenter ? thickW : isMajor ? midW : thinW;
      ctx.beginPath(); ctx.moveTo(x, by1); ctx.lineTo(x, by2); ctx.stroke();

      // Label at y=0 crossing (horizontal center line)
      if (isMajor && by1 < 0 && by2 > 0) {
        ctx.fillStyle = isCenter ? '#444' : '#777';
        ctx.font = isCenter ? `${16 / zoom}px Poppins, sans-serif` : fontSize;
        ctx.textBaseline = 'bottom';
        ctx.fillText(isCenter ? '0' : fmt(x), x + 4 / zoom, -4 / zoom);
      }
    }

    // ── Horizontal lines ──
    for (let y = startY; y <= by2; y += step) {
      const isCenter = Math.abs(y) < step * 0.01;
      const isMajor = isCenter || (majorStep > 0 && Math.abs(y % majorStep) < step * 0.01);
      ctx.strokeStyle = isCenter ? '#666' : isMajor ? '#aaa' : '#ddd';
      ctx.lineWidth = isCenter ? thickW : isMajor ? midW : thinW;
      ctx.beginPath(); ctx.moveTo(bx1, y); ctx.lineTo(bx2, y); ctx.stroke();

      // Label at x=0 crossing (vertical center line)
      if (isMajor && bx1 < 0 && bx2 > 0) {
        ctx.fillStyle = isCenter ? '#444' : '#777';
        ctx.font = isCenter ? `${16 / zoom}px Poppins, sans-serif` : fontSize;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(isCenter ? '0' : fmt(y), -4 / zoom, y - 4 / zoom);
        ctx.textAlign = 'left';
      }
    }

    ctx.restore();
  }

  canvas.on('after:render', draw);
}

function createGrid() {
  canvas.renderAll();
}

function toggleGrid() {
  showGrid = !showGrid;
  document.getElementById('gridBtn').classList.toggle('active', showGrid);
  canvas.renderAll();
}

function toggleSnap() {
  snapEnabled = !snapEnabled;
  document.getElementById('snapBtn').classList.toggle('active', snapEnabled);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['confirmModal', 'inputModal', 'exportModal', 'fileManagerModal', 'shareModal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        el.style.display = 'none';
        if (id === 'confirmModal') { pendingAction = null; document.getElementById('confirmDiscardBtn').style.display = ''; }
        if (id === 'inputModal') pendingInput = null;
      }
    });
    setTool('select');
  }
});

// ====================== MOUSE WHEEL ZOOM ======================
function onMouseWheel(opt) {
  opt.e.preventDefault();
  const vpt = canvas.viewportTransform;
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  const screenX = opt.e.clientX - rect.left;
  const screenY = opt.e.clientY - rect.top;
  const worldX = (screenX - vpt[4]) / vpt[0];
  const worldY = (screenY - vpt[5]) / vpt[3];
  const step = 0.04;
  const newZ = Math.max(0.2, Math.min(currentZoom + (opt.e.deltaY > 0 ? -step : step), 8.0));
  vpt[0] = newZ; vpt[3] = newZ;
  vpt[4] = screenX - worldX * newZ;
  vpt[5] = screenY - worldY * newZ;
  canvas.renderAll();
  currentZoom = newZ;
  updateZoomDisplay();
  createGrid();
}

function zoomTo(zoom, point) {
  canvas.zoomToPoint(point || { x: canvas.width / 2, y: canvas.height / 2 }, zoom);
  currentZoom = zoom;
  updateZoomDisplay();
  createGrid();
}

function zoomIn() { zoomTo(Math.min(currentZoom * 1.25, 8)); }
function zoomOut() { zoomTo(Math.max(currentZoom / 1.25, 0.2)); }
function resetZoom() {
  canvas.setZoom(1); currentZoom = 1;
  canvas.viewportTransform = [1, 0, 0, 1, canvas.width / 2, canvas.height / 2];
  updateZoomDisplay();
  createGrid();
}

function updateZoomDisplay() {
  const el = document.getElementById('zoomLevel');
  if (el) el.textContent = Math.round(currentZoom * 100) + '%';
}

// ====================== MIDDLE-BUTTON PAN ======================
function setupPan() {
  const el = canvas.upperCanvasEl || canvas.lowerCanvasEl;

  el.addEventListener('mousedown', e => {
    if (e.button !== 1) return;
    e.preventDefault();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartVpt = canvas.viewportTransform.slice();
    canvas.selection = false;
    el.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    canvas.viewportTransform = panStartVpt.slice();
    canvas.viewportTransform[4] += e.clientX - panStartX;
    canvas.viewportTransform[5] += e.clientY - panStartY;
    canvas.renderAll();
  });

  document.addEventListener('mouseup', e => {
    if (e.button !== 1 || !isPanning) return;
    isPanning = false;
    canvas.selection = (currentTool === 'select');
    el.style.cursor = (currentTool === 'select') ? 'default' : 'crosshair';
    canvas.renderAll();
  });
}

// ====================== FILE STORE ======================
const STORE_KEY = 'floorplan_files';
const DATA_PREFIX = 'floorplan_data_';

function getFileList() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}

function saveFileList(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function loadPlanData(id) {
  try { return JSON.parse(localStorage.getItem(DATA_PREFIX + id)); } catch { return null; }
}

function savePlanData(id, data, preview) {
  localStorage.setItem(DATA_PREFIX + id, JSON.stringify(data));
  const list = getFileList();
  const idx = list.findIndex(f => f.id === id);
  if (idx >= 0) {
    list[idx].updatedAt = Date.now();
    if (preview) list[idx].preview = preview;
  } else {
    list.unshift({ id, name: id, preview: preview || '', updatedAt: Date.now() });
  }
  saveFileList(list);
}

function deletePlanData(id) {
  localStorage.removeItem(DATA_PREFIX + id);
  const list = getFileList().filter(f => f.id !== id);
  saveFileList(list);
}

function renamePlanData(oldId, newId) {
  const data = loadPlanData(oldId);
  if (data) {
    localStorage.setItem(DATA_PREFIX + newId, JSON.stringify(data));
    localStorage.removeItem(DATA_PREFIX + oldId);
  }
  const list = getFileList();
  const f = list.find(x => x.id === oldId);
  if (f) { f.id = newId; f.name = newId; }
  saveFileList(list);
}

// ====================== FILE MANAGER MODAL ======================
function showFileManager() {
  renderFileList();
  document.getElementById('fileManagerModal').style.display = 'flex';
}

function closeFileManager() {
  document.getElementById('fileManagerModal').style.display = 'none';
}

function newFromFileManager() {
  closeFileManager();
  doClear();
}

function openPlanFromList(id) {
  const data = loadPlanData(id);
  if (!data) return;
  closeFileManager();
  planFileName = id;
  document.getElementById('planTitle').textContent = id;
  canvas.loadFromJSON(data, () => { canvas.renderAll(); isDirty = false; });
}

function renderFileList() {
  const list = getFileList();
  const container = document.getElementById('fileList');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div class="fp-fileman-empty">No saved plans yet</div>';
    return;
  }
  container.innerHTML = list.map(f => `
    <div class="fp-fileman-item" data-id="${f.id}">
      <img class="fp-fileman-preview" src="${f.preview || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}" alt="">
      <span class="fp-fileman-name">${f.name}</span>
      <span class="fp-fileman-date">${formatDate(f.updatedAt)}</span>
      <button class="fp-fileman-dots" onclick="event.stopPropagation(); toggleDropdown(event, '${f.id}')">⋯</button>
    </div>
  `).join('');

  // Click to open
  container.querySelectorAll('.fp-fileman-item').forEach(el => {
    el.addEventListener('click', () => openPlanFromList(el.dataset.id));
  });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString();
}

function toggleDropdown(e, id) {
  e.stopPropagation();
  closeAllDropdowns();

  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();

  const dropdown = document.createElement('div');
  dropdown.className = 'fp-fileman-dropdown';
  dropdown.style.top = (rect.bottom + 100) + 'px';
  dropdown.style.right = (window.innerWidth - rect.right) + 'px';
  dropdown.innerHTML = `
    <button class="fp-fileman-dropdown-item" data-action="rename">Rename</button>
    <button class="fp-fileman-dropdown-item" data-action="share">Share</button>
    <button class="fp-fileman-dropdown-item" data-action="download">Download</button>
    <button class="fp-fileman-dropdown-item danger" data-action="delete">Delete</button>
  `;
  document.body.appendChild(dropdown);

  dropdown.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      const action = b.dataset.action;
      dropdown.remove();
      if (action === 'rename') renamePlan(id);
      else if (action === 'share') shareSavedPlan(id);
      else if (action === 'download') downloadSavedPlan(id);
      else if (action === 'delete') deleteSavedPlan(id);
    });
  });

  const close = ev => {
    if (!dropdown.contains(ev.target)) {
      dropdown.remove();
      document.removeEventListener('click', close, true);
    }
  };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}

function closeAllDropdowns() {
  document.querySelectorAll('.fp-fileman-dropdown').forEach(el => el.remove());
}

function renamePlan(id) {
  const items = document.querySelectorAll('.fp-fileman-item');
  let targetItem = null, targetName = null;
  items.forEach(el => {
    if (el.dataset.id === id) {
      targetItem = el;
      targetName = el.querySelector('.fp-fileman-name');
    }
  });
  if (!targetName) return;

  targetName.contentEditable = 'true';
  targetName.classList.add('editing');
  targetName.focus();

  const range = document.createRange();
  range.selectNodeContents(targetName);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = (save) => {
    targetName.contentEditable = 'false';
    targetName.classList.remove('editing');
    const newName = targetName.textContent.trim();
    if (save && newName && newName !== id) {
      renamePlanData(id, newName);
      targetItem.dataset.id = newName;
      if (planFileName === id) { planFileName = newName; document.getElementById('planTitle').textContent = newName; }
    } else {
      targetName.textContent = id;
    }
  };

  targetName.addEventListener('keydown', function handler(e) {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); targetName.removeEventListener('keydown', handler); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); targetName.removeEventListener('keydown', handler); }
  });

  targetName.addEventListener('blur', function handler() {
    finish(true);
    targetName.removeEventListener('blur', handler);
  }, { once: true });
}

function shareSavedPlan(id) {
  let data = loadPlanData(id);
  if (!data) {
    data = canvas.toJSON();
    const preview = canvas.toDataURL({ format: 'png', multiplier: 0.3 });
    savePlanData(id, data, preview);
  }
  document.getElementById('shareModalTitle').textContent = 'Share Plan';
  document.getElementById('shareModalName').textContent = id;
  document.getElementById('shareEmailBtn').onclick = () => {
    window.open('mailto:?subject=' + encodeURIComponent('Floor Plan: ' + id) + '&body=' + encodeURIComponent('Here is my floor plan "' + id + '". Open it in the Floor Plan Designer to view or edit.'), '_blank');
  };
  document.getElementById('sharePrintBtn').onclick = () => {
    const imgData = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write('<html><head><title>Print: ' + id + '</title></head><body style="margin:0;text-align:center"><img src="' + imgData + '" style="max-width:100%;height:auto"><script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}<\/script></body></html>');
      win.document.close();
    }
  };
  document.getElementById('shareModal').style.display = 'flex';
}

function closeShareModal() {
  document.getElementById('shareModal').style.display = 'none';
}

function downloadSavedPlan(id) {
  const data = loadPlanData(id);
  if (!data) return;
  downloadBlob(JSON.stringify(data, null, 2), id + '.json', 'application/json');
}

function deleteSavedPlan(id) {
  if (!confirm('Delete "' + id + '"?')) return;
  deletePlanData(id);
  if (planFileName === id) { planFileName = ''; document.getElementById('planTitle').textContent = 'Untitled Plan'; isDirty = false; doClear(); }
  renderFileList();
}

// ====================== INIT ======================
document.addEventListener('DOMContentLoaded', () => {
  let checkCount = 0;
  const checkLayout = setInterval(() => {
    if (document.querySelector('header.navbar') || ++checkCount > 20) {
      clearInterval(checkLayout);
      initCanvas();
      document.getElementById('gridBtn').classList.add('active');
      document.getElementById('snapBtn').classList.add('active');
    }
  }, 50);

  // Show file manager on load (after layout is ready)
  requestAnimationFrame(() => showFileManager());

  const style = document.createElement('style');
  style.textContent = `
    body.logged-in .navbar { position: fixed; }
  `;
  document.head.appendChild(style);
});

// ====================== UNSAVED CHANGES MODAL ======================
let pendingAction = null;

function showConfirmModal(msg, btn1, btn2, btn3) {
  pendingAction = { btn1: btn1.cb, btn2: btn2.cb, btn3: btn3.cb };
  document.getElementById('confirmMessage').textContent = msg;
  document.getElementById('confirmSaveBtn').textContent = btn1.label;
  document.getElementById('confirmDiscardBtn').textContent = btn2.label;
  document.getElementById('confirmDiscardBtn').style.display = btn2.label ? '' : 'none';
  document.getElementById('confirmModal').style.display = 'flex';
}

function confirmSave() {
  document.getElementById('confirmModal').style.display = 'none';
  if (pendingAction) { const cb = pendingAction.btn1; pendingAction = null; if (cb) cb(); }
}

function confirmDiscard() {
  document.getElementById('confirmModal').style.display = 'none';
  if (pendingAction) { const cb = pendingAction.btn2; pendingAction = null; if (cb) cb(); }
}

function confirmCancel() {
  document.getElementById('confirmModal').style.display = 'none';
  document.getElementById('confirmDiscardBtn').style.display = '';
  pendingAction = null;
}

function goBack() {
  if (!isDirty) { location.href = 'mytools.html'; return; }
  showConfirmModal(
    'You have unsaved changes. Would you like to save before leaving?',
    { label: 'Save', cb: () => { doSave(planFileName || 'floorplan'); isDirty = false; location.href = 'mytools.html'; } },
    { label: "Don't Save", cb: () => { isDirty = false; location.href = 'mytools.html'; } },
    { label: 'Cancel', cb: null }
  );
}

// ====================== INPUT MODAL ======================
let pendingInput = null;

function showInputModal(msg, placeholder, value, onConfirm) {
  pendingInput = onConfirm;
  document.getElementById('inputModalMessage').textContent = msg;
  document.getElementById('inputModalField').placeholder = placeholder;
  document.getElementById('inputModalField').value = value;
  document.getElementById('inputModal').style.display = 'flex';
  setTimeout(() => document.getElementById('inputModalField').focus(), 50);
}

function inputConfirm() {
  document.getElementById('inputModal').style.display = 'none';
  const val = document.getElementById('inputModalField').value.trim();
  if (pendingInput) { const cb = pendingInput; pendingInput = null; if (cb && val) cb(val); }
}

function inputCancel() {
  document.getElementById('inputModal').style.display = 'none';
  pendingInput = null;
}

// ====================== FILE OPERATIONS ======================
function doSave(name) {
  planFileName = name;
  document.getElementById('planTitle').textContent = name.replace(/\.json$/i, '');
  const data = canvas.toJSON();
  const preview = canvas.toDataURL({ format: 'png', multiplier: 0.3 });
  savePlanData(name, data, preview);
  isDirty = false;
}

function savePlan() {
  showInputModal('Save plan as:', 'Plan name', planFileName.replace(/\.json$/i, ''), doSave);
}

function sharePlan() {
  shareSavedPlan(planFileName || 'floorplan');
}

function exportPlan() {
  document.getElementById('exportModal').style.display = 'flex';
}

function closeExportModal() {
  document.getElementById('exportModal').style.display = 'none';
}

function doExport(format) {
  document.getElementById('exportModal').style.display = 'none';
  const baseName = (planFileName || 'floorplan').replace(/\.\w+$/i, '');
  const showGridEl = document.getElementById('expGrid');
  const showNameEl = document.getElementById('expName');
  const showTextEl = document.getElementById('expText');
  const showMeasEl = document.getElementById('expMeas');
  const showGridChecked = showGridEl && showGridEl.checked;
  const showNameChecked = showNameEl && showNameEl.checked;
  const showTextChecked = showTextEl && showTextEl.checked;
  const showMeasChecked = showMeasEl && showMeasEl.checked;

  // Toggle text objects
  const textObjects = canvas.getObjects().filter(o => o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');
  textObjects.forEach(o => o.visible = showTextChecked);

  // Toggle plan title
  const titleEl = document.getElementById('planTitle');
  if (titleEl) titleEl.style.display = showNameChecked ? '' : 'none';

  if (format === 'json') {
    const json = JSON.stringify(canvas.toJSON(), null, 2);
    downloadBlob(json, baseName + '.json', 'application/json');
    // Restore visibility that JSON doesn't need
    textObjects.forEach(o => o.visible = true);
    if (titleEl) titleEl.style.display = '';
    return;
  }

  // For image exports, render with options
  const origShowGrid = showGrid;
  showGrid = showGridChecked;
  canvas.renderAll();
  const gc = document.getElementById('gridCanvas');

  // Capture Fabric canvas
  const fabricDataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });

  // Composite grid canvas and Fabric canvas
  const composeCanvas = document.createElement('canvas');
  const w = canvas.width, h = canvas.height;
  composeCanvas.width = w * 2;
  composeCanvas.height = h * 2;
  const cctx = composeCanvas.getContext('2d');
  cctx.scale(2, 2);

  // Draw the Fabric canvas (with text visibility applied)
  const img = new Image();
  img.onload = () => {
    cctx.drawImage(img, 0, 0);

    // Overlay grid canvas if checked
    const gc = document.getElementById('gridCanvas');
    if (gc && showGridChecked) {
      cctx.drawImage(gc, 0, 0);
    }

    // Draw plan title if checked
    if (titleEl && showNameChecked && titleEl.style.display !== 'none') {
      cctx.fillStyle = '#666';
      cctx.font = 'bold 18px Poppins, sans-serif';
      cctx.textAlign = 'center';
      cctx.textBaseline = 'top';
      cctx.fillText(titleEl.textContent || 'Untitled Plan', w / 2, 12);
    }

    const compositeDataUrl = composeCanvas.toDataURL('image/png');

    if (format === 'png') {
      downloadDataUrl(compositeDataUrl, baseName + '.png');
    } else if (format === 'svg') {
      const svg = canvas.toSVG();
      // Inject grid as a foreignObject if checked
      let svgContent = svg;
      if (gc && showGridChecked) {
        const gridData = gc.toDataURL();
        svgContent = svg.replace('</svg>',
          `<image x="0" y="0" width="${w}" height="${h}" href="${gridData}"/></svg>`);
      }
      downloadBlob(svgContent, baseName + '.svg', 'image/svg+xml');
    } else if (format === 'pdf') {
      exportPDF(baseName, compositeDataUrl);
    }

    // Restore
    textObjects.forEach(o => o.visible = true);
    if (titleEl) titleEl.style.display = '';
    showGrid = origShowGrid;
    canvas.renderAll();
  };
  img.src = fabricDataUrl;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function exportPDF(filename, dataUrl) {
  const imgData = dataUrl || canvas.toDataURL({ format: 'png', multiplier: 2 });
  const imgW = canvas.width, imgH = canvas.height;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  script.onload = () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: imgW > imgH ? 'l' : 'p', unit: 'px', format: [imgW, imgH] });
    pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
    pdf.save(filename + '.pdf');
  };
  document.head.appendChild(script);
}

function importPlan(e) {
  if (!e || !e.target) { document.getElementById('importInput').click(); return; }
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    planFileName = file.name;
    document.getElementById('planTitle').textContent = file.name.replace(/\.json$/i, '');
    const reader = new FileReader();
    reader.onload = () => {
      const data = JSON.parse(reader.result);
      canvas.loadFromJSON(data, () => canvas.renderAll());
      savePlanData(planFileName, data, canvas.toDataURL({ format: 'png', multiplier: 0.3 }));
    };
    reader.readAsText(file);
    e.target.value = '';
    isDirty = false;
  }
}

function clearAll() {
  if (!canvas) return;
  if (!isDirty) {
    showConfirmModal(
      'Create a new floor plan?',
      { label: 'Create', cb: doClear },
      { label: '', cb: null },
      { label: 'Cancel', cb: null }
    );
    return;
  }
  showConfirmModal(
    'You have unsaved changes. Save before starting a new plan?',
    { label: 'Save & New', cb: () => { doSave(planFileName || 'floorplan'); doClear(); } },
    { label: 'Discard & New', cb: doClear },
    { label: 'Cancel', cb: null }
  );
}

function doClear() {
  canvas.clear();
  planFileName = '';
  document.getElementById('planTitle').textContent = 'Untitled Plan';
  isDirty = false;
  createGrid();
  canvas.renderAll();
}

// ====================== PLAN TITLE ======================
function setupPlanTitle() {
  const title = document.getElementById('planTitle');
  if (!title) return;
  title.addEventListener('dblclick', () => {
    title.contentEditable = 'true';
    title.classList.add('editing');
    title.focus();
    const range = document.createRange();
    range.selectNodeContents(title);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  title.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      title.contentEditable = 'false';
      title.classList.remove('editing');
    }
    if (e.key === 'Escape') {
      title.textContent = title.getAttribute('data-original') || 'Untitled Plan';
      title.contentEditable = 'false';
      title.classList.remove('editing');
    }
  });
  title.addEventListener('blur', () => {
    if (title.contentEditable === 'true') {
      title.contentEditable = 'false';
      title.classList.remove('editing');
    }
  });
  title.addEventListener('input', () => {
    if (!title.textContent.trim()) title.textContent = 'Untitled Plan';
  });
}
function addRoomFromWalls() { console.log('addRoomFromWalls'); }
function autoClassifyWalls() { console.log('autoClassifyWalls'); }
function showNewZoneDialog() { console.log('showNewZoneDialog'); }

// ====================== WINDOW EXPORTS ======================
Object.assign(window, {
  setTool,
  toggleGrid, toggleSnap,
  zoomIn, zoomOut, resetZoom,
  undo, finishCurrent, deleteSelected,
  savePlan, sharePlan, exportPlan, importPlan, clearAll,
  goBack, confirmSave, confirmDiscard, confirmCancel,
  inputConfirm, inputCancel,
  showFileManager, closeFileManager, newFromFileManager,
  addRoomFromWalls, autoClassifyWalls, showNewZoneDialog
});

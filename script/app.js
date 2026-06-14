const canvas = new fabric.Canvas('canvas', {
  selection: true,
  preserveObjectStacking: true,
  hoverCursor: 'pointer'
});

let currentMode = 'select';
let isDrawing = false;
let points = [];
let tempLine = null;
let tempDimText = null;
let gridGroup = null;
let gridSize = 20;
let showGrid = true;
let snapEnabled = true;
let snapThreshold = 22;
let scaleCmPerPx = 2;
let currentZoom = 1;

let history = [];
let rooms = [];
let allWalls = [];

// ====================== UTILITIES ======================
function saveHistory() {
  history.push(JSON.stringify(canvas.toJSON(['wallType','windowData','doorData','roomData','isSplit'])));
  if (history.length > 30) history.shift();
}

function undo() {
  if (history.length === 0) return;
  canvas.loadFromJSON(history.pop(), () => {
    canvas.renderAll();
    refreshAllDimensions();
  });
}

function updateScale() {
  scaleCmPerPx = parseFloat(document.getElementById('scaleInput').value) || 2;
  refreshAllDimensions();
}

// ====================== GRID ======================
function createGrid() {
  if (gridGroup) canvas.remove(gridGroup);
  gridGroup = new fabric.Group([], { selectable: false, evented: false });
  const w = canvas.width * 3, h = canvas.height * 3;
  for (let i = 0; i < w; i += gridSize) gridGroup.add(new fabric.Line([i, 0, i, h], { stroke: '#ddd', strokeWidth: 1 }));
  for (let i = 0; i < h; i += gridSize) gridGroup.add(new fabric.Line([0, i, w, i], { stroke: '#ddd', strokeWidth: 1 }));
  canvas.add(gridGroup);
  canvas.sendToBack(gridGroup);
}

function updateGrid() {
  gridSize = parseInt(document.getElementById('gridSize').value) || 20;
  if (showGrid) createGrid();
}

function toggleGrid() { 
  showGrid = !showGrid; 
  showGrid ? createGrid() : canvas.remove(gridGroup); 
}

function toggleSnap() { snapEnabled = !snapEnabled; }

// ====================== ZOOM ======================
function updateZoomDisplay() {
  const el = document.getElementById('zoomLevel');
  if (el) el.textContent = Math.round(currentZoom * 100) + '%';
}

function zoomToPoint(zoom, point) {
  canvas.zoomToPoint(point, zoom);
  currentZoom = zoom;
  updateZoomDisplay();
}

window.zoomIn = () => { const z = Math.min(currentZoom * 1.25, 8); zoomToPoint(z, {x: canvas.width/2, y: canvas.height/2}); };
window.zoomOut = () => { const z = Math.max(currentZoom / 1.25, 0.2); zoomToPoint(z, {x: canvas.width/2, y: canvas.height/2}); };
window.resetZoom = () => { 
  canvas.setZoom(1); currentZoom = 1; canvas.viewportTransform = [1,0,0,1,0,0]; 
  updateZoomDisplay(); canvas.renderAll(); 
};

canvas.on('mouse:wheel', function(opt) {
  if (!opt.e.ctrlKey) return;
  opt.e.preventDefault();
  const delta = opt.e.deltaY > 0 ? 0.9 : 1.1;
  let newZ = Math.max(0.2, Math.min(currentZoom * delta, 8));
  zoomToPoint(newZ, canvas.getPointer(opt.e));
});

// ====================== SNAP ======================
function snapPoint(point, lastPoint = null) {
  if (!snapEnabled) return point;
  const effThreshold = snapThreshold / currentZoom;
  let snapped = { x: Math.round(point.x / gridSize) * gridSize, y: Math.round(point.y / gridSize) * gridSize };
  let bestPoint = snapped;
  let bestDist = effThreshold;

  if (lastPoint) {
    const dx = Math.abs(snapped.x - lastPoint.x);
    const dy = Math.abs(snapped.y - lastPoint.y);
    if (dx > dy) snapped.y = lastPoint.y;
    else snapped.x = lastPoint.x;
  }

  canvas.getObjects().forEach(obj => {
    if (obj.type !== 'line' || !obj.wallType) return;
    const p1 = {x: obj.x1, y: obj.y1};
    const p2 = {x: obj.x2, y: obj.y2};
    const candidates = [p1, p2, {x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2}];
    candidates.forEach(p => {
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < bestDist) { 
        bestDist = d; 
        bestPoint = p; 
      }
    });
  });
  return bestPoint;
}

function setDrawingMode(active) {
  canvas.selection = !active;
  canvas.forEachObject(obj => {
    if (obj.type === 'line' || obj.type === 'polygon') obj.selectable = obj.evented = !active;
  });
}

// ====================== MOUSE ======================
canvas.on('mouse:down', function(opt) {
  const pointer = canvas.getPointer(opt.e);
  const last = points.length > 0 ? points[points.length-1] : null;
  const snapped = snapPoint(pointer, last);

  if (currentMode === 'draw' || currentMode === 'room') {
    if (!isDrawing) {
      setDrawingMode(true);
      points = [snapped];
      isDrawing = true;
    } else {
      const lastPt = points[points.length - 1];
      if (Math.hypot(snapped.x - lastPt.x, snapped.y - lastPt.y) > 12) {
        if (currentMode === 'draw') addWallSegment(lastPt, snapped);
        points.push(snapped);
      }
    }
  } else if (currentMode === 'window' || currentMode === 'door') {
    addFixture(currentMode, snapped);
  }
});

canvas.on('mouse:move', function(opt) {
  if (!isDrawing || points.length === 0) return;
  const pointer = canvas.getPointer(opt.e);
  const last = points[points.length - 1];
  const snapped = snapPoint(pointer, last);

  if (tempLine) canvas.remove(tempLine);
  tempLine = new fabric.Line([last.x, last.y, snapped.x, snapped.y], {
    stroke: currentMode === 'room' ? '#3498db' : '#222',
    strokeWidth: currentMode === 'room' ? 6 : 16,
    strokeDashArray: [6, 3],
    opacity: 0.75,
    selectable: false
  });
  canvas.add(tempLine);

  if (tempDimText) canvas.remove(tempDimText);
  const pxLen = Math.hypot(snapped.x - last.x, snapped.y - last.y);
  const cmLen = (pxLen * scaleCmPerPx).toFixed(0);
  tempDimText = new fabric.Text(cmLen + ' cm', {
    left: (last.x + snapped.x)/2, 
    top: (last.y + snapped.y)/2 - 30,
    fontSize: 15, fill: '#e74c3c', originX: 'center', originY: 'center', selectable: false
  });
  canvas.add(tempDimText);
  canvas.renderAll();
});

function finishCurrent() {
  [tempLine, tempDimText].forEach(o => { if (o) canvas.remove(o); });
  tempLine = tempDimText = null;

  if (currentMode === 'room' && points.length >= 3) {
    points.push(points[0]);
    const room = new fabric.Polygon(points, {
      fill: 'rgba(100,200,255,0.15)', 
      stroke: '#3498db', 
      strokeWidth: 4, 
      strokeDasharray: [8,4],
      roomData: { name: `Room ${rooms.length+1}` }
    });
    canvas.add(room);
    rooms.push(room);
  }

  setDrawingMode(false);
  isDrawing = false;
  points = [];
  saveHistory();
  refreshAllDimensions();
}

// ====================== DIMENSIONS ======================
function addDimensionsToWall(wall) {
  if (wall.dimensionGroups) wall.dimensionGroups.forEach(g => canvas.remove(g));
  wall.dimensionGroups = [];

  const x1 = wall.x1, y1 = wall.y1, x2 = wall.x2, y2 = wall.y2;
  const lenPx = Math.hypot(x2 - x1, y2 - y1);
  if (lenPx < 25) return;

  const lenCm = (lenPx * scaleCmPerPx).toFixed(0);
  const angleRad = Math.atan2(y2 - y1, x2 - x1);
  const angleDeg = angleRad * 180 / Math.PI;
  const perpX = -Math.sin(angleRad);
  const perpY = Math.cos(angleRad);

  [-1, 1].forEach(side => {
    const offset = 68 * side;
    const extOffset = 26;

    const dx1 = x1 + perpX * offset;
    const dy1 = y1 + perpY * offset;
    const dx2 = x2 + perpX * offset;
    const dy2 = y2 + perpY * offset;

    const ext1 = new fabric.Line([x1, y1, x1 + perpX * (offset - side * extOffset), y1 + perpY * (offset - side * extOffset)], { stroke: '#555', strokeWidth: 1.2 });
    const ext2 = new fabric.Line([x2, y2, x2 + perpX * (offset - side * extOffset), y2 + perpY * (offset - side * extOffset)], { stroke: '#555', strokeWidth: 1.2 });
    const dimLine = new fabric.Line([dx1, dy1, dx2, dy2], { stroke: '#e74c3c', strokeWidth: 1.2 });

    const arrowSize = 9;
    const arrow1 = new fabric.Path(`M ${dx1} ${dy1} L ${dx1-arrowSize} ${dy1-arrowSize*0.7} L ${dx1-arrowSize} ${dy1+arrowSize*0.7} Z`, { fill: '#e74c3c', angle: angleDeg + 180 });
    const arrow2 = new fabric.Path(`M ${dx2} ${dy2} L ${dx2-arrowSize} ${dy2-arrowSize*0.7} L ${dx2-arrowSize} ${dy2+arrowSize*0.7} Z`, { fill: '#e74c3c', angle: angleDeg });

    const midX = (dx1 + dx2) / 2;
    const midY = (dy1 + dy2) / 2;

    const bg = new fabric.Rect({
      left: midX, top: midY, width: 75, height: 26, rx: 4,
      fill: 'rgba(255,255,255,0.95)', 
      originX: 'center', originY: 'center', angle: angleDeg
    });

    const text = new fabric.Text(lenCm + ' cm', {
      left: midX, top: midY,
      fontSize: 13, fill: '#e74c3c', fontWeight: 'bold',
      originX: 'center', originY: 'center', angle: angleDeg,
      selectable: true
    });

    const group = new fabric.Group([ext1, ext2, dimLine, arrow1, arrow2, bg, text], {
      selectable: true, evented: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hasControls: false
    });

    group.isDimension = true;
    group.associatedWall = wall;
    wall.dimensionGroups.push(group);
    canvas.add(group);
  });
}

function refreshAllDimensions() {
  canvas.getObjects().forEach(obj => {
    if (obj.type === 'line' && obj.wallType) {
      addDimensionsToWall(obj);
    }
  });
  canvas.renderAll();
}

canvas.on('object:moving', function(e) {
  const target = e.target;
  if (target && target.isDimension && target.associatedWall) {
    const wall = target.associatedWall;
    const center = target.getCenterPoint();
    const wallMid = { x: (wall.x1 + wall.x2)/2, y: (wall.y1 + wall.y2)/2 };
    const dx = center.x - wallMid.x;
    const dy = center.y - wallMid.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetDist = 68;
    const newX = wallMid.x + (dx / dist) * targetDist;
    const newY = wallMid.y + (dy / dist) * targetDist;
    target.set({ left: newX, top: newY });
    canvas.renderAll();
  }
});

canvas.on('object:modified', function(e) {
  if (e.target && e.target.wallType) {
    refreshAllDimensions();
    saveHistory();
  }
});

canvas.on('object:removed', function(e) {
  if (e.target && e.target.dimensionGroups) {
    e.target.dimensionGroups.forEach(g => canvas.remove(g));
  }
});

// ====================== WALLS ======================
function addWallSegment(start, end) {
  if (Math.hypot(end.x - start.x, end.y - start.y) < 12) return;

  const newWall = new fabric.Line([start.x, start.y, end.x, end.y], {
    stroke: '#222',
    strokeWidth: 16,
    strokeLineCap: 'butt',     // Sharp rectangular ends
    selectable: true,
    hasControls: true,
    wallType: 'normal'
  });

  canvas.add(newWall);
  allWalls.push(newWall);

  handleWallIntersections(newWall);
  refreshAllDimensions();
  saveHistory();
  canvas.renderAll();
}

function handleWallIntersections(newWall) {
  const nwP1 = {x: newWall.x1, y: newWall.y1};
  const nwP2 = {x: newWall.x2, y: newWall.y2};

  const existing = canvas.getObjects().filter(obj => obj.type === 'line' && obj.wallType && obj !== newWall);

  existing.forEach(obj => {
    const p1 = {x: obj.x1, y: obj.y1};
    const p2 = {x: obj.x2, y: obj.y2};
    if (isPointOnLineInterior(nwP1, p1, p2) || isPointOnLineInterior(nwP2, p1, p2)) {
      const splitPt = isPointOnLineInterior(nwP1, p1, p2) ? nwP1 : nwP2;
      splitExistingWall(obj, splitPt);
    }
  });
}

function isPointOnLineInterior(point, a, b, tolerance = 10) {
  const cross = Math.abs((point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y));
  if (cross > tolerance) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < 0) return false;
  const lenSq = Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2);
  const proj = dot / lenSq;
  return proj > 0.08 && proj < 0.92;
}

function splitExistingWall(wall, splitPoint) {
  if (wall.dimensionGroups) wall.dimensionGroups.forEach(g => canvas.remove(g));

  const p1 = {x: wall.x1, y: wall.y1};
  const p2 = {x: wall.x2, y: wall.y2};

  const wallA = new fabric.Line([p1.x, p1.y, splitPoint.x, splitPoint.y], {
    stroke: '#222', strokeWidth: 16, strokeLineCap: 'butt', wallType: 'normal'
  });
  const wallB = new fabric.Line([splitPoint.x, splitPoint.y, p2.x, p2.y], {
    stroke: '#222', strokeWidth: 16, strokeLineCap: 'butt', wallType: 'normal'
  });

  canvas.remove(wall);
  canvas.add(wallA);
  canvas.add(wallB);

  const idx = allWalls.indexOf(wall);
  if (idx > -1) allWalls.splice(idx, 1);
  allWalls.push(wallA, wallB);

  refreshAllDimensions();
}

function addFixture(type, pos) {
  let obj;
  if (type === 'window') {
    obj = new fabric.Rect({left: pos.x-40, top: pos.y-10, width:80, height:20, fill:'#aaddff', stroke:'#000', strokeWidth:4});
  } else {
    obj = new fabric.Group([
      new fabric.Rect({width:22, height:80, fill:'#8B4513', left:-11, top:-40})
    ], {left: pos.x, top: pos.y});
  }
  canvas.add(obj);
  saveHistory();
}

function updateProperties() {
  const panel = document.getElementById('properties');
  const active = canvas.getActiveObject();
  if (!active) return panel.style.display = 'none';

  let html = `<h3>Properties</h3>`;
  if (active.type === 'line' && active.wallType) {
    const lenCm = (Math.hypot(active.x2-active.x1, active.y2-active.y1) * scaleCmPerPx).toFixed(1);
    html += `<p><strong>Length:</strong> ${lenCm} cm</p>`;
  }
  panel.innerHTML = html;
  panel.style.display = 'block';
}

canvas.on('selection:created', updateProperties);
canvas.on('selection:updated', updateProperties);
canvas.on('selection:cleared', () => document.getElementById('properties').style.display = 'none');

// ====================== KEYBOARD ======================
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (isDrawing) finishCurrent();
    else { 
      setMode('select'); 
      canvas.discardActiveObject(); 
      canvas.renderAll(); 
    }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && currentMode === 'select') {
    const active = canvas.getActiveObject();
    if (active) canvas.remove(active);
    saveHistory();
  }
});

function setMode(mode) {
  finishCurrent();
  currentMode = mode;
  setDrawingMode(false);
  canvas.selection = true;
  canvas.forEachObject(obj => { obj.selectable = obj.evented = true; });
}

function clearCanvas() {
  if (confirm('Clear entire canvas?')) {
    canvas.clear();
    allWalls = [];
    createGrid();
    saveHistory();
  }
}

function exportJSON() {
  const data = canvas.toJSON(['wallType','windowData','doorData','roomData','isSplit']);
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'floorplan.json';
  a.click();
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = ev => {
      canvas.loadFromJSON(ev.target.result, () => {
        refreshAllDimensions();
        saveHistory();
      });
    };
    reader.readAsText(file);
  };
  input.click();
}

// ====================== INIT ======================
createGrid();
saveHistory();
canvas.setBackgroundColor('#fafafa', canvas.renderAll.bind(canvas));
updateZoomDisplay();

Object.assign(window, {
  setMode, finishCurrent, updateGrid, toggleGrid, toggleSnap,
  updateScale, undo, clearCanvas, exportJSON, importJSON,
  zoomIn, zoomOut, resetZoom
});

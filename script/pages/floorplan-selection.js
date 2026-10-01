// Selections and groups reference top-level objects. Fabric ActiveSelection is
// deliberately avoided: hosted openings and wall endpoints stay in world space.
let floorplanSelection = new Set();
let floorplanSelectionGesture = null, floorplanSelectionMenu = null;
let floorplanSelectionReady = false, floorplanSelectionSyncing = false;
let floorplanLastDrawingTool = 'wall', floorplanGroupSequence = 0;
let floorplanSelectionError = '';

function floorplanEditableObject(object, visibleOnly = true) {
  return Boolean(object && ['wall', 'door', 'window', 'stair', 'symbol'].includes(object.data?.kind) && (!visibleOnly || object.visible !== false));
}

function expandFloorplanGroups(objects) {
  const groups = new Set(objects.map(object => object.data?.groupId).filter(Boolean));
  return canvas.getObjects().filter(object => floorplanEditableObject(object, false) && (objects.includes(object) || groups.has(object.data?.groupId)));
}

function floorplanSelectedObjects() {
  const live = canvas.getObjects();
  const selected = [...floorplanSelection].filter(object => live.includes(object) && floorplanEditableObject(object, false));
  if (selected.length) return selected;
  const active = canvas.getActiveObject();
  return floorplanEditableObject(active) ? expandFloorplanGroups([active]) : [];
}

function setFloorplanSelection(objects) {
  const previous = [...floorplanSelection];
  const selected = expandFloorplanGroups(objects.filter(object => canvas.getObjects().includes(object) && floorplanEditableObject(object, false)));
  floorplanSelectionSyncing = true;
  floorplanSelection = new Set(selected);
  canvas.discardActiveObject();
  if (selected.length === 1) canvas.setActiveObject(selected[0]);
  floorplanSelectionSyncing = false;
  const event = { selected, deselected: previous.filter(object => !floorplanSelection.has(object)), floorplanLogical: true };
  canvas.fire?.(selected.length ? 'selection:updated' : 'selection:cleared', event);
  if (typeof refreshFloorplanInspector === 'function') refreshFloorplanInspector();
  canvas.requestRenderAll();
  return selected;
}

function clearFloorplanSelection() { setFloorplanSelection([]); }

function floorplanSelectionPolygon(object, records = wallRecords()) {
  if (object.data?.kind === 'wall') {
    const record = records.find(item => item.wall === object);
    if (record && typeof wallFaceGeometry === 'function') {
      const geometry = wallFaceGeometry(record, records), { faces } = geometry;
      return geometry.polygon || [faces[0].points[0], faces[0].points[1], faces[1].points[1], faces[1].points[0]];
    }
  }
  if (object.data?.kind === 'stair' && typeof floorplanStairPolygon === 'function') return floorplanStairPolygon(object);
  if (typeof object.getCoords === 'function') return object.getCoords(true, true).map(point => ({ x: point.x, y: point.y }));
  const box = object.getBoundingRect?.(true, true) || { left: object.left - object.width / 2, top: object.top - object.height / 2, width: object.width, height: object.height };
  return [{ x: box.left, y: box.top }, { x: box.left + box.width, y: box.top },
    { x: box.left + box.width, y: box.top + box.height }, { x: box.left, y: box.top + box.height }];
}

function floorplanPolygonInBox(polygon, start, end, crossing = end.x < start.x) {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  const inside = point => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  if (!crossing) return polygon.every(inside);
  if (polygon.some(inside)) return true;
  const corners = [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  const inPolygon = point => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
    }
    return result;
  };
  if (corners.some(inPolygon)) return true;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const overlaps = (a, b, c, d) => Math.max(Math.min(a, b), Math.min(c, d)) <= Math.min(Math.max(a, b), Math.max(c, d)) + 0.00001;
  for (let i = 0; i < polygon.length; i++) for (let j = 0; j < 4; j++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], c = corners[j], d = corners[(j + 1) % 4];
    if (overlaps(a.x, b.x, c.x, d.x) && overlaps(a.y, b.y, c.y, d.y) &&
      cross(a, b, c) * cross(a, b, d) <= 0.00001 && cross(c, d, a) * cross(c, d, b) <= 0.00001) return true;
  }
  return false;
}

function floorplanObjectsInBox(start, end) {
  const records = wallRecords();
  return canvas.getObjects().filter(object => floorplanEditableObject(object) && floorplanPolygonInBox(floorplanSelectionPolygon(object, records), start, end));
}

function markFloorplanSelectionEdited() {
  isDirty = true;
  syncSaveButton();
  if (typeof refreshFloorplanGeometry === 'function') refreshFloorplanGeometry();
  canvas.requestRenderAll();
}

function groupFloorplanSelection() {
  const selected = floorplanSelectedObjects();
  if (selected.length < 2) return false;
  wallCheckpoint();
  const groupId = `group-${Date.now().toString(36)}-${++floorplanGroupSequence}`;
  selected.forEach(object => { object.data = { ...object.data, groupId }; });
  setFloorplanSelection(selected); markFloorplanSelectionEdited();
  return true;
}

function ungroupFloorplanSelection() {
  const selected = floorplanSelectedObjects(), groups = new Set(selected.map(object => object.data.groupId).filter(Boolean));
  if (!groups.size) return false;
  wallCheckpoint();
  canvas.getObjects().forEach(object => { if (groups.has(object.data?.groupId)) { object.data = { ...object.data }; delete object.data.groupId; } });
  setFloorplanSelection(selected); markFloorplanSelectionEdited();
  return true;
}

function selectAllFloorplanObjects() {
  if (currentTool !== 'select') setTool('select');
  setFloorplanSelection(canvas.getObjects().filter(object => floorplanEditableObject(object)));
}

function repeatFloorplanTool() { setTool(floorplanLastDrawingTool); }

function floorplanSelectionMoveState(objects, origin) {
  return { kind: 'move', objects: [...objects], origin: { ...origin }, changed: false,
    records: wallRecords().map(record => ({ ...record, points: record.points.map(point => ({ ...point })) })),
    snapshots: canvas.getObjects().map(object => ({ object, left: object.left, top: object.top, data: { ...object.data } })),
    historyBefore: [...wallHistory], dirtyBefore: isDirty,
    redoBefore: typeof wallRedoHistory === 'undefined' ? [] : [...wallRedoHistory] };
}

function floorplanSelectionMovePlan(state, delta) {
  floorplanSelectionError = '';
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return null;
  const selected = new Set(state.objects);
  const records = state.records.map(record => ({ ...record, points: record.points.map(point => selected.has(record.wall) ? { x: point.x + delta.x, y: point.y + delta.y } : { ...point }) }));
  if (records.some(record => wallDistance(...record.points) < 1 || wallFaceGeometry(record, records).faces.some(face => face.length <= 0))) {
    floorplanSelectionError = 'The selection would create an invalid wall junction.';
    return null;
  }
  const placements = [], openingData = new Map();
  for (const snapshot of state.snapshots) {
    const { object } = snapshot, data = { ...snapshot.data };
    const opening = data.kind === 'door' || data.kind === 'window';
    if (opening && selected.has(object)) {
      if (data.hostWallId) {
        const host = state.records.find(record => record.wall.data?.id === data.hostWallId);
        if (!host) { floorplanSelectionError = 'This opening is missing its wall.'; return null; }
        if (!selected.has(host.wall)) {
          const basis = openingBasis(host.points);
          if (Math.abs(delta.x * basis.n.x + delta.y * basis.n.y) > 0.001) {
            floorplanSelectionError = 'Move hosted openings along their wall, or include the wall in the selection.';
            return null;
          }
          data.offset += delta.x * basis.u.x + delta.y * basis.u.y;
        }
      } else { data.x += delta.x; data.y += delta.y; }
    }
    if (opening) openingData.set(object, data);
    if (selected.has(object) && data.kind !== 'wall') placements.push({ object, data,
      left: snapshot.left + delta.x, top: snapshot.top + delta.y });
  }
  if (typeof openingDataError === 'function') for (const [object, data] of openingData) {
    const host = data.hostWallId ? records.find(record => record.wall.data?.id === data.hostWallId) : null;
    if (data.hostWallId && !host) { floorplanSelectionError = 'An opening would lose its wall.'; return null; }
    const others = [...openingData].filter(([other, value]) => other !== object && value.hostWallId === data.hostWallId).map(([, value]) => value);
    const error = openingDataError(data, host ? wallDistance(...host.points) : undefined, others, host ? openingBranches(host, records) : []);
    if (error) { floorplanSelectionError = error; return null; }
  }
  return { records, placements };
}

function applyFloorplanSelectionMove(state, delta) {
  const plan = floorplanSelectionMovePlan(state, delta);
  if (!plan) return false;
  if (!state.changed && Math.hypot(delta.x, delta.y) < 0.001) return true;
  if (!state.changed) { wallCheckpoint(); state.changed = true; }
  plan.records.forEach(record => setWallEndpoints(record.wall, record.points));
  plan.placements.forEach(({ object, data, left, top }) => { object.data = data; object.set({ left, top }); object.setCoords(); object.dirty = true; });
  if (typeof syncFloorplanOpenings === 'function') syncFloorplanOpenings();
  canvas.requestRenderAll();
  return true;
}

function cancelFloorplanSelectionGesture() {
  const state = floorplanSelectionGesture;
  floorplanSelectionGesture = null;
  if (state?.kind === 'move' && state.changed) {
    state.records.forEach(record => setWallEndpoints(record.wall, record.points));
    state.snapshots.forEach(({ object, data, left, top }) => { object.data = { ...data }; if (object.data.kind !== 'wall') object.set({ left, top }); object.setCoords(); });
    wallHistory.splice(0, wallHistory.length, ...state.historyBefore);
    if (typeof wallRedoHistory !== 'undefined') wallRedoHistory.splice(0, wallRedoHistory.length, ...state.redoBefore);
    isDirty = state.dirtyBefore; syncSaveButton();
    if (typeof syncFloorplanOpenings === 'function') syncFloorplanOpenings();
  }
  canvas.requestRenderAll();
}

function finishFloorplanSelectionGesture() {
  const state = floorplanSelectionGesture;
  floorplanSelectionGesture = null;
  if (!state) return;
  if (state.kind === 'box') {
    const objects = wallDistance(state.origin, state.point) * canvas.getZoom() > 3 ? floorplanObjectsInBox(state.origin, state.point) : [];
    setFloorplanSelection(state.additive ? [...state.previous, ...objects] : objects);
  } else if (state.changed) markFloorplanSelectionEdited();
  canvas.requestRenderAll();
}

function hideFloorplanContextMenu() { if (floorplanSelectionMenu) floorplanSelectionMenu.hidden = true; }

function showFloorplanContextMenu(event) {
  event.preventDefault(); event.stopPropagation();
  if (!floorplanSelectionMenu) return;
  finishFloorplanSelectionGesture();
  const selected = floorplanSelectedObjects(), menu = floorplanSelectionMenu;
  menu.replaceChildren();
  const actions = [
    ['Undo', () => undo(), wallHistory.length > 0, 'Ctrl + Z'],
    ['Redo', () => redo(), typeof wallRedoHistory !== 'undefined' && wallRedoHistory.length > 0, 'Ctrl + Y'],
    [`Repeat ${floorplanLastDrawingTool.charAt(0).toUpperCase() + floorplanLastDrawingTool.slice(1)}`, repeatFloorplanTool, true, ''],
    null,
    ['Group', groupFloorplanSelection, selected.length > 1, 'Ctrl + G'],
    ['Ungroup', ungroupFloorplanSelection, selected.some(object => object.data.groupId), 'Ctrl + Shift + G'],
    ['Delete', () => deleteSelected(), selected.length > 0, 'Delete'],
    null,
    ['Select all', selectAllFloorplanObjects, canvas.getObjects().some(object => floorplanEditableObject(object)), 'Ctrl + A'],
    ['Clear selection', clearFloorplanSelection, selected.length > 0, 'Esc']
  ];
  actions.forEach(action => {
    if (!action) { const separator = document.createElement('hr'); separator.className = 'fp-context-separator'; menu.append(separator); return; }
    const [label, callback, enabled, shortcut] = action;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'fp-context-action'; button.setAttribute('role', 'menuitem'); button.disabled = !enabled;
    const text = document.createElement('span'); text.textContent = label; button.append(text);
    if (shortcut) { const hint = document.createElement('small'); hint.className = 'fp-context-shortcut'; hint.textContent = shortcut; button.append(hint); }
    button.addEventListener('click', () => { hideFloorplanContextMenu(); callback(); }); menu.append(button);
  });
  canvas.calcOffset?.();
  const point = canvas.getPointer(event, true);
  menu.hidden = false;
  menu.style.left = `${Math.max(4, Math.min(canvas.width - (menu.offsetWidth || 230) - 4, point.x))}px`;
  menu.style.top = `${Math.max(4, Math.min(canvas.height - (menu.offsetHeight || 330) - 4, point.y))}px`;
  menu.querySelector('button:not(:disabled)')?.focus();
}

function syncFloorplanSelectionTool(tool) {
  if (['wall', 'door', 'window', 'stair', 'symbol'].includes(tool)) floorplanLastDrawingTool = tool;
  cancelFloorplanSelectionGesture(); hideFloorplanContextMenu(); clearFloorplanSelection();
}

function setupFloorplanSelection() {
  if (floorplanSelectionReady || !canvas?.upperCanvasEl) return;
  floorplanSelectionReady = true;
  const wrapper = document.getElementById('canvasWrapper');
  floorplanSelectionMenu = document.createElement('div'); floorplanSelectionMenu.className = 'fp-context-menu'; floorplanSelectionMenu.hidden = true; floorplanSelectionMenu.setAttribute('role', 'menu'); floorplanSelectionMenu.setAttribute('aria-label', 'Floor plan actions');
  wrapper.append(floorplanSelectionMenu);
  floorplanSelectionMenu.addEventListener('mousedown', event => event.stopPropagation());
  floorplanSelectionMenu.addEventListener('wheel', event => event.stopPropagation());
  floorplanSelectionMenu.addEventListener('keydown', event => {
    const buttons = [...floorplanSelectionMenu.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') { hideFloorplanContextMenu(); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  });
  canvas.upperCanvasEl.addEventListener('contextmenu', showFloorplanContextMenu);
  const downEvent = canvas.enablePointerEvents ? 'pointerdown' : 'mousedown';
  const moveEvent = canvas.enablePointerEvents ? 'pointermove' : 'mousemove';
  const upEvent = canvas.enablePointerEvents ? 'pointerup' : 'mouseup';
  const intercept = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  canvas.upperCanvasEl.addEventListener(downEvent, event => {
    if (event.button === 2) { intercept(event); return; }
    hideFloorplanContextMenu();
    if (event.button !== 0 || currentTool !== 'select' || isPanning) return;
    canvas.calcOffset?.();
    const point = canvas.getPointer(event), target = canvas.findTarget(event), selected = floorplanSelectedObjects();
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    if (floorplanEditableObject(target)) {
      if (additive) {
        intercept(event);
        const group = expandFloorplanGroups([target]);
        setFloorplanSelection(group.every(object => selected.includes(object)) ? selected.filter(object => !group.includes(object)) : [...selected, ...group]);
      } else if (target.data.groupId || (selected.length > 1 && selected.includes(target))) {
        intercept(event);
        const moving = selected.includes(target) ? selected : setFloorplanSelection([target]);
        floorplanSelectionGesture = floorplanSelectionMoveState(moving, point);
      } else floorplanSelection = new Set([target]);
      return;
    }
    // Native rotation handles can lie outside an object's painted bounds.
    const active = canvas.getActiveObject();
    if (active?.hasControls && typeof active._findTargetCorner === 'function' && active._findTargetCorner(canvas.getPointer(event, true), false)) return;
    intercept(event);
    floorplanSelectionGesture = { kind: 'box', origin: point, point, additive, previous: selected };
  }, true);
  document.addEventListener(moveEvent, event => {
    const state = floorplanSelectionGesture;
    if (!state) return;
    intercept(event);
    const point = canvas.getPointer(event);
    if (state.kind === 'box') { state.point = point; canvas.requestRenderAll(); return; }
    if (wallDistance(point, state.origin) * canvas.getZoom() < 3) return;
    const step = snapEnabled ? getSnapInterval() : 0;
    const delta = { x: point.x - state.origin.x, y: point.y - state.origin.y };
    if (step) { delta.x = Math.round(delta.x / step) * step; delta.y = Math.round(delta.y / step) * step; }
    if (!applyFloorplanSelectionMove(state, delta)) {
      const status = document.getElementById('wallStatus'); if (status) status.textContent = floorplanSelectionError;
    }
  }, true);
  document.addEventListener(upEvent, event => { if (floorplanSelectionGesture && event.button === 0) { intercept(event); finishFloorplanSelectionGesture(); } }, true);
  document.addEventListener('pointerdown', event => { if (!floorplanSelectionMenu.contains(event.target)) hideFloorplanContextMenu(); });
  document.addEventListener('keydown', event => {
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') || [...document.querySelectorAll('.fp-modal-overlay')].some(element => element.style.display !== 'none')) return;
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === 'a' && currentTool === 'select') { intercept(event); selectAllFloorplanObjects(); }
    else if (command && event.key.toLowerCase() === 'g' && currentTool === 'select') { intercept(event); event.shiftKey ? ungroupFloorplanSelection() : groupFloorplanSelection(); }
    else if (event.key === 'Escape' && floorplanSelectionGesture) { intercept(event); cancelFloorplanSelectionGesture(); }
    else if (event.key === 'Escape' && !floorplanSelectionMenu.hidden) { intercept(event); hideFloorplanContextMenu(); }
    else if (event.key === 'Escape' && currentTool === 'select' && floorplanSelectedObjects().length) { intercept(event); clearFloorplanSelection(); }
  }, true);
  const changed = event => {
    if (floorplanSelectionSyncing || event?.floorplanLogical) return;
    const active = canvas.getActiveObject();
    if (floorplanEditableObject(active)) setFloorplanSelection([active]);
    else { floorplanSelection.clear(); canvas.requestRenderAll(); }
  };
  canvas.on('selection:created', changed); canvas.on('selection:updated', changed); canvas.on('selection:cleared', changed);
  canvas.on('object:removed', event => { floorplanSelection.delete(event.target); });
  canvas.on('after:render', event => {
    if (currentTool !== 'select' || !canvas.contextTop || (event?.ctx && event.ctx !== canvas.contextContainer)) return;
    const ctx = canvas.contextTop, zoom = canvas.getZoom(), palette = typeof floorplanColors === 'function' ? floorplanColors() : { snap: '#008c85' };
    ctx.save(); ctx.transform(...canvas.viewportTransform); ctx.strokeStyle = palette.snap; ctx.lineWidth = 1 / zoom;
    const selected = floorplanSelectedObjects(), records = wallRecords();
    if (selected.length > 1) {
      const points = selected.flatMap(object => floorplanSelectionPolygon(object, records));
      const left = Math.min(...points.map(point => point.x)), top = Math.min(...points.map(point => point.y));
      const right = Math.max(...points.map(point => point.x)), bottom = Math.max(...points.map(point => point.y));
      ctx.setLineDash([5 / zoom, 3 / zoom]); ctx.strokeRect(left - 3 / zoom, top - 3 / zoom, right - left + 6 / zoom, bottom - top + 6 / zoom);
    }
    const state = floorplanSelectionGesture;
    if (state?.kind === 'box') {
      const left = Math.min(state.origin.x, state.point.x), top = Math.min(state.origin.y, state.point.y);
      const width = Math.abs(state.point.x - state.origin.x), height = Math.abs(state.point.y - state.origin.y);
      ctx.setLineDash(state.point.x < state.origin.x ? [5 / zoom, 3 / zoom] : []);
      ctx.globalAlpha = 0.1; ctx.fillStyle = palette.snap; ctx.fillRect(left, top, width, height);
      ctx.globalAlpha = 1; ctx.strokeRect(left, top, width, height);
    }
    ctx.restore();
  });
}

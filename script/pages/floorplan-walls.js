// Canvas coordinates and wall thickness are measured in centimetres.
let wallStart = null, wallPointer = null, wallThickness = 15;
let wallHistory = [];
let wallRedoHistory = [];
let floorplanGridStep = 10, angleSnapEnabled = true;
const wallDefaultThickness = { inner: 15, outer: 25 };
let wallDrawingThicknessManual = false;
let wallDragState = null;
let wallDraftError = '';
let wallPlacementOrigin = null;

function setWallDefaultThickness(type, value) {
  const thickness = floorplanFromDisplayLength(value);
  if (!['inner','outer'].includes(type) || !Number.isFinite(thickness) || thickness < 1 || thickness > 100) return;
  wallDefaultThickness[type] = thickness;
  if (!wallDrawingThicknessManual) {
    wallThickness = wallDefaultThickness[wallStartReference ? 'inner' : 'outer'];
    document.getElementById('wallThickness').value = floorplanFormatLength(wallThickness);
  }
  canvas.requestRenderAll();
}

function getSnapInterval() { return floorplanGridStep; }
function setFloorplanGridStep(value) {
  const step = floorplanFromDisplayLength(value);
  if (!Number.isFinite(step) || step < 0.1 || step > 100) return;
  floorplanGridStep = step;
  canvas.requestRenderAll();
}
function toggleAngleSnap() {
  angleSnapEnabled = !angleSnapEnabled;
  document.getElementById('angleSnapBtn')?.classList.toggle('active', angleSnapEnabled);
  document.getElementById('angleSnapBtn')?.setAttribute('aria-pressed', String(angleSnapEnabled));
}

function wallDirectionConstraint(point, start, shift = false) {
  if (!start || (!angleSnapEnabled && !shift)) return {point,locked:false};
  const dx = point.x - start.x, dy = point.y - start.y;
  const increment = shift ? Math.PI / 2 : Math.PI / 4;
  const raw = Math.atan2(dy, dx), angle = Math.round(raw / increment) * increment;
  // Strong magnets near common house angles; other directions remain available.
  const cardinal = Math.abs(Math.sin(angle * 2)) < .000001;
  if (!shift && Math.abs(raw - angle) > (cardinal ? 8 : 6) * Math.PI / 180) return {point,locked:false};
  const u = { x: Math.round(Math.cos(angle) * 1e8) / 1e8, y: Math.round(Math.sin(angle) * 1e8) / 1e8 };
  const dominant = Math.abs(u.x) >= Math.abs(u.y) ? 'x' : 'y';
  const distance = (point[dominant] - start[dominant]) / u[dominant];
  return {point:{x:start.x+u.x*distance,y:start.y+u.y*distance},locked:true};
}
function constrainWallDirection(point, shift = false) {return wallDirectionConstraint(point,wallStart,shift).point;}

function snapPointOnWall(point, points) {
  const projected = wallProjection(point, points);
  if (!snapEnabled) return projected.point;
  const [a, b] = points;
  const axis = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'x' : 'y';
  const coordinate = Math.round(projected.point[axis] / getSnapInterval()) * getSnapInterval();
  const t = Math.max(0, Math.min(1, (coordinate - a[axis]) / (b[axis] - a[axis])));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function parallelWallAlignment(start, point, records, options = {}) {
  if (!start || !point) return null;
  const draftLength = wallDistance(start, point);
  if (draftLength < 0.1) return null;
  const tolerance = options.tolerance ?? 8;
  const step = options.gridStep || 0;
  const draft = { x: (point.x - start.x) / draftLength, y: (point.y - start.y) / draftLength };
  let best = null;
  for (const record of records) {
    const [a, b] = record.points, length = wallDistance(a, b);
    if (length < 0.1) continue;
    const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    // A small angular tolerance also helps when free-angle drawing is enabled.
    if (Math.abs(wallCross(draft, tangent)) > Math.sin(Math.PI / 180)) continue;
    const separation = Math.abs(wallCross({ x: start.x - a.x, y: start.y - a.y }, tangent));
    if (separation < 0.001) continue; // Collinear walls already join and merge.
    const forward = draft.x * tangent.x + draft.y * tangent.y >= 0;
    const u = forward ? tangent : { x: -tangent.x, y: -tangent.y };
    const dominant = Math.abs(u.x) >= Math.abs(u.y) ? 'x' : 'y';
    const consider = (distance, kind, source) => {
      if (distance < 0.1) return;
      const target = { x: start.x + u.x * distance, y: start.y + u.y * distance };
      const error = wallDistance(point, target);
      if (error > tolerance) return;
      // Alignment is a secondary aid; it must not pull a grid point off-grid.
      if (step && Math.abs(target[dominant] / step - Math.round(target[dominant] / step)) > 0.00001) return;
      const priority = kind === 'endpoint' ? 0 : 1;
      if (best && (error > best.error + 0.00001 ||
          (Math.abs(error - best.error) <= 0.00001 && (priority > best.priority ||
          (priority === best.priority && separation >= best.separation))))) return;
      const lines = kind === 'endpoint' ? [[source, target]] : [[forward ? a : b, start], [forward ? b : a, target]];
      best = { point: target, lines, kind, error, priority, separation, wall: record.wall };
    };
    [a, b].forEach(endpoint => consider((endpoint.x - start.x) * u.x + (endpoint.y - start.y) * u.y, 'endpoint', endpoint));
    consider(length, 'equal-length');
  }
  return best;
}

function drawParallelWallGuide(ctx, alignment, zoom) {
  if (!alignment) return;
  ctx.save();
  ctx.strokeStyle = typeof floorplanColors === 'function' ? floorplanColors().snap : '#008c85';
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  alignment.lines.forEach(([a, b]) => {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  ctx.restore();
}

function wallSnap(point, shift = false) {
  const step = getSnapInterval();
  const gridPoint = snapEnabled ? { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step } : point;
  const constraint = wallDirectionConstraint(point,wallStart,shift);
  const result = constraint.locked ? constrainWallDirection(gridPoint, shift) : gridPoint;
  if (!snapEnabled) return result;
  const records = wallRecords(), tolerance = 12 / canvas.getZoom();
  let nearest = null, distance = tolerance;
  // Visible face corners attach to the exact graph node, even when thickness
  // puts that node further than the screen snap radius from the mouse.
  for (const record of records) {
    const geometry=wallFaceGeometry(record,records);
    for (let index=0;index<2;index++) {
      const endpoint=record.points[index];
      if (wallStart && shift && wallDistance(constrainWallDirection(endpoint, true), endpoint) > .001) continue;
      const d=Math.min(wallDistance(point,endpoint),...geometry.faces.map(face=>wallDistance(point,face.points[index])));
      if(d<distance){nearest=endpoint;distance=d;}
    }
  }
  if (nearest) return firstWallIntersection(wallStart,{...nearest},records);
  distance = tolerance;
  for (const record of records) {
    const projection = wallProjection(point, record.points);
    if (projection.t <= 0 || projection.t >= 1) continue;
    const d = Math.max(0,wallDistance(point, projection.point)-record.thickness/2);
    if (d >= distance) continue;
    let candidate = snapPointOnWall(point, record.points);
    if (wallStart && constraint.locked) {
      const direction = { x: result.x - wallStart.x, y: result.y - wallStart.y };
      const [a, b] = record.points, tangent = { x: b.x - a.x, y: b.y - a.y };
      const cross = wallCross(direction, tangent);
      if (Math.abs(cross) > 0.00001) {
        const difference = { x: a.x - wallStart.x, y: a.y - wallStart.y };
        const t = wallCross(difference, tangent) / cross;
        const hit = { x: wallStart.x + direction.x * t, y: wallStart.y + direction.y * t };
        if (wallInteriorPoint(hit, record.points) && wallDistance(hit, point) < tolerance + step + record.thickness/2) candidate = hit;
        else continue;
      } else if (wallDistance(constrainWallDirection(candidate, shift), candidate) > 0.001) continue;
    }
    nearest = candidate; distance = d;
  }
  if (nearest) return firstWallIntersection(wallStart,nearest,records);
  const alignment = parallelWallAlignment(wallStart, result, records, { tolerance: 8 / canvas.getZoom(), gridStep: step });
  if (alignment && (!constraint.locked || wallDistance(constrainWallDirection(alignment.point, shift), alignment.point) < 0.001)) return firstWallIntersection(wallStart,alignment.point,records);
  return firstWallIntersection(wallStart,result,records);
}

function firstWallIntersection(start,end,records) {
  if(!start)return end;
  const direction={x:end.x-start.x,y:end.y-start.y};let first=1,point=end;
  for(const record of records){
    const [a,b]=record.points,tangent={x:b.x-a.x,y:b.y-a.y},cross=wallCross(direction,tangent);
    if(Math.abs(cross)<.000001)continue;
    const offset={x:a.x-start.x,y:a.y-start.y},t=wallCross(offset,tangent)/cross,s=wallCross(offset,direction)/cross;
    if(t>.00001&&t<first&&s>=-.00001&&s<=1.00001){first=t;point={x:start.x+direction.x*t,y:start.y+direction.y*t};}
  }
  return point;
}

function wallPointAttached(point,records=wallRecords()) {
  return records.some(record=>{const projection=wallProjection(point,record.points);return projection.t>=-.00001&&projection.t<=1.00001&&wallDistance(point,projection.point)<.001;});
}

function wallDraftType(start,end) {
  if(!start||!end)return 'outer';
  if(wallStartReference)return 'inner';
  const middle={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
  if(typeof floorplanRoomFaces!=='undefined'&&typeof roomPointInside==='function'&&floorplanRoomFaces.some(room=>roomPointInside(middle,room.polygon)&&!(room.holes||[]).some(hole=>roomPointInside(middle,hole))))return 'inner';
  return wallRecords().some(record=>wallInteriorPoint(start,record.points))?'inner':'outer';
}

function resolveWallDraft(point,shift=false) {
  wallDraftError='';
  if(wallStart&&wallPlacementOrigin&&!wallStartReference)wallStart={...wallPlacementOrigin};
  const startBefore=wallStart&&{...wallStart};
  let next=wallSnap(point,shift);
  if(wallStart){
    for(let iteration=0;iteration<8;iteration++){
      const shifted=alignWallClearance(next);
      // Clearance preserves the starting gap; then resolve the endpoint again
      // from that new anchor so its connection cannot drift away from a host.
      if(wallDistance(shifted,next)<.00001)break;
      next=wallSnap(point,shift);
    }
    const type=wallDraftType(wallStart,next);
    if(!wallDrawingThicknessManual){wallThickness=wallDefaultThickness[type];document.getElementById('wallThickness').value=floorplanFormatLength(wallThickness);}
  }
  const stairs=canvas.getObjects().filter(object=>object.data?.kind==='stair'&&object.visible!==false);
  if(stairs.length&&typeof getStairWallSnap==='function'){
    const attached=wallStart&&wallPointAttached(wallStart);
    const snap=snapEnabled?getStairWallSnap(next,wallStart,wallThickness,stairs,12/canvas.getZoom()):null;
    if(snap&&(!attached||!snap.start||wallDistance(snap.start,wallStart)<.001)){
      if(snap.start)wallStart=snap.start;next=snap.point;
    }
    if(wallStart){
      const fit=fitWallAgainstStairs(wallStart,next,wallThickness,stairs,{alignSides:!attached});
      if(fit.error){wallDraftError=fit.error;wallStart=startBefore;return null;}
      wallStart=fit.start;next=fit.end;
    }
  }
  return next;
}

function wallDraftRecord(start,end) {
  return {wall:{data:{kind:'wall',wallType:wallDraftType(start,end)}},points:[start,end],thickness:wallThickness,preview:true};
}

function wallPlacementError(start,end) {
  if(!start||!end||wallDistance(start,end)<.1)return '';
  if(wallDistance(firstWallIntersection(start,end,wallRecords()),end)>.001)return 'That length crosses an existing wall. End this wall at the connection.';
  if(typeof polygonIntersectsStairs==='function'){
    const stairs=canvas.getObjects().filter(object=>object.data?.kind==='stair');
    const record=wallDraftRecord(start,end),records=[...wallRecords(),record];
    if(polygonIntersectsStairs(wallFaceGeometry(record,records).polygon,stairs))return 'This wall would cover the stair. Shorten it or move it beside the stair edge.';
  }
  return '';
}

function showWallPlacementError(error) {
  wallDraftError=error;
  document.getElementById('wallStatus').textContent=error;
  if(wallLengthTyped&&wallLengthInput){wallLengthInput.setCustomValidity(error);wallLengthInput.reportValidity();}
}

function wallEndpoints(wall) {
  const points = wall.calcLinePoints();
  const matrix = wall.calcTransformMatrix();
  return [fabric.util.transformPoint(new fabric.Point(points.x1, points.y1), matrix),
    fabric.util.transformPoint(new fabric.Point(points.x2, points.y2), matrix)];
}

function wallCheckpoint() {
  wallHistory.push(JSON.stringify(typeof serializeFloorplan === 'function' ? serializeFloorplan() : canvas.toJSON(['data'])));
  if (wallHistory.length > 100) wallHistory.shift();
  wallRedoHistory = [];
}

function finishCurrent() {
  closeWallLengthEditor();
  if (typeof cancelFloorplanOpening === 'function') cancelFloorplanOpening();
  if (typeof cancelFloorplanStair === 'function') cancelFloorplanStair();
  if (typeof cancelFloorplanSymbol === 'function') cancelFloorplanSymbol();
  if (typeof closeWallStartOffset === 'function') closeWallStartOffset();
  wallStart = null;
  wallPointer = null;
  wallPlacementOrigin = null;wallDraftError='';
  if (typeof canvas !== 'undefined' && canvas) {
    canvas.clearContext(canvas.contextTop);
    canvas.requestRenderAll();
  }
  const status = document.getElementById('wallStatus');
  if (status) status.textContent = 'Type length · Enter places · Escape finishes · Shift locks direction';
}

function resetWallSession() {
  if (typeof cancelFloorplanSelectionGesture === 'function') cancelFloorplanSelectionGesture();
  finishCurrent(); wallHistory = []; wallRedoHistory = [];
  if (typeof clearFloorplanSelection === 'function') clearFloorplanSelection();
}

function undo() {
  if (typeof finishFloorplanSelectionGesture === 'function') finishFloorplanSelectionGesture();
  finishCurrent();
  const previous = wallHistory.pop();
  if (!previous) return;
  wallRedoHistory.push(JSON.stringify(typeof serializeFloorplan === 'function' ? serializeFloorplan() : canvas.toJSON(['data'])));
  if (wallRedoHistory.length > 100) wallRedoHistory.shift();
  restoreWallHistoryState(previous);
}

function redo() {
  if (typeof finishFloorplanSelectionGesture === 'function') finishFloorplanSelectionGesture();
  finishCurrent();
  const next = wallRedoHistory.pop();
  if (!next) return;
  wallHistory.push(JSON.stringify(typeof serializeFloorplan === 'function' ? serializeFloorplan() : canvas.toJSON(['data'])));
  if (wallHistory.length > 100) wallHistory.shift();
  restoreWallHistoryState(next);
}

function restoreWallHistoryState(serialized) {
  if (typeof clearFloorplanSelection === 'function') clearFloorplanSelection();
  const restored = JSON.parse(serialized);
  if (typeof restoreFloorplanSettings === 'function') restoreFloorplanSettings(restored._floorplanSettings);
  canvas.loadFromJSON(restored, () => {
    refreshFloorplanGeometry();
    isDirty = true;
    syncSaveButton();
    canvas.requestRenderAll();
  });
}

function deleteSelected() {
  if (typeof finishFloorplanSelectionGesture === 'function') finishFloorplanSelectionGesture();
  const selected = typeof floorplanSelectedObjects === 'function' ? floorplanSelectedObjects() : canvas.getActiveObjects();
  if (!selected.length) return;
  wallCheckpoint();
  canvas.discardActiveObject();
  if (typeof clearFloorplanSelection === 'function') clearFloorplanSelection();
  selected.forEach(object => canvas.remove(object));
  refreshFloorplanGeometry();
  isDirty = true; syncSaveButton();
  canvas.requestRenderAll();
}

function commitWallPoint(point) {
  if(!point)return false;
  let endedAtWall = false;
  if (wallStart && wallDistance(point, wallStart) >= 0.1) {
    const error=wallPlacementError(wallStart,point);
    if(error){showWallPlacementError(error);return false;}
    endedAtWall = wallRecords().some(record => {
      const projection = wallProjection(point, record.points);
      return projection.t >= -0.00001 && projection.t <= 1.00001 && wallDistance(point, projection.point) < 0.001;
    });
    wallCheckpoint();
    canvas.add(new fabric.Line([wallStart.x, wallStart.y, point.x, point.y], {
      originX: 'center', originY: 'center',
      left: (wallStart.x + point.x) / 2, top: (wallStart.y + point.y) / 2,
      stroke: '#354b50', strokeWidth: wallThickness, strokeLineCap: 'butt',
      data: { kind: 'wall', wallType: wallDraftType(wallStart,point), thicknessManual: wallDrawingThicknessManual }, hasControls: false,
      lockMovementX: true, lockMovementY: true, lockRotation: true,
      lockScalingX: true, lockScalingY: true
    }));
    mergeStraightWalls();
    refreshFloorplanGeometry();
  }
  closeWallLengthEditor();
  closeWallStartOffset();
  wallStart = endedAtWall ? null : point;
  wallPlacementOrigin=wallStart&&{...wallStart};
  wallPointer = point;
  if (!wallDrawingThicknessManual) {
    const existing = wallRecords();
    const isInterior = existing.some(r => wallInteriorPoint(point, r.points));
    wallThickness = wallDefaultThickness[isInterior ? 'inner' : 'outer'];
    document.getElementById('wallThickness').value = floorplanFormatLength(wallThickness);
  }
  document.getElementById('wallStatus').textContent = endedAtWall ? 'Wall connected. Click anywhere to start another wall.' : 'Aim the next wall, type its length, then Enter. Escape finishes.';
  canvas.requestRenderAll();
  return true;
}

function wallTranslateSolution(records, wall, delta) {
  const target = records.find(r => r.wall === wall);
  if (!target) return null;
  return records.map(record => ({ ...record, points: record.points.map(point => record.wall === wall ?
    { x: point.x + delta.x, y: point.y + delta.y } : { ...point }) }));
}

function wallEndpointSolution(records, wall, endpoint, next) {
  if (![0, 1].includes(endpoint) || !records.some(record => record.wall === wall)) return null;
  return records.map(record => ({ ...record, points: record.points.map((point, index) =>
    record.wall === wall && index === endpoint ? { ...next } : { ...point }) }));
}

function validWallDrag(records, solution) {
  if(!solution || solution.some(r=>wallDistance(...r.points)<1 || wallFaceGeometry(r,solution).faces.some(f=>f.length<=0)))return false;
  return typeof validateFloorplanOpenings!=='function'||validateFloorplanOpenings(solution);
}

function closestFloorplanWall(point, records = wallRecords(), zoom = canvas.getZoom()) {
  let closest = null, best = Infinity;
  records.forEach(record => {
    const projection = wallProjection(point, record.points), t = Math.max(0, Math.min(1, projection.t));
    const [a,b] = record.points, p = {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    const distance = Math.max(0,wallDistance(point,p)-record.thickness/2);
    if (distance <= 8/zoom && distance < best) { best = distance; closest = record.wall; }
  });
  return closest;
}

function setupWallDragging() {
  // Use the visible wall footprint. A diagonal line's bounding rectangle can
  // otherwise cover the entire room and steal clicks from other walls.
  if (typeof canvas.findTarget === 'function') {
    const findTarget = canvas.findTarget.bind(canvas);
    canvas.findTarget = function(event, skipGroup) {
      const target = findTarget(event, skipGroup);
      if (currentTool !== 'select' || (target && target.data?.kind !== 'wall')) return target;
      return closestFloorplanWall(canvas.getPointer(event)) || undefined;
    };
  }
  canvas.on('mouse:down', e=>{
    if(currentTool!=='select'||e.e.button>0||isPanning)return;
    const pointer=canvas.getPointer(e.e), active=canvas.getActiveObject();
    const wall=e.target?.data?.kind==='wall'?e.target:active?.data?.kind==='wall'?active:null;
    if(!wall)return;
    const records=wallRecords(), record=records.find(r=>r.wall===wall), tolerance=10/canvas.getZoom();
    const endpoint=record.points.findIndex(p=>wallDistance(p,pointer)<tolerance);
    if(endpoint<0&&e.target!==wall)return;
    wallDragState={wall,records,origin:pointer,mode:endpoint<0?'body':endpoint,changed:false};
    canvas.requestRenderAll();
  });
  canvas.on('mouse:move',e=>{
    if(!wallDragState||currentTool!=='select'||!(e.e.buttons&1))return;
    const state=wallDragState, record=state.records.find(r=>r.wall===state.wall);
    const pointer=canvas.getPointer(e.e), step=getSnapInterval();
    if(wallDistance(pointer,state.origin)*canvas.getZoom()<2)return;
    let solution;
    if(state.mode==='body') {
      let delta={x:pointer.x-state.origin.x,y:pointer.y-state.origin.y};
      if(snapEnabled) delta={x:Math.round(delta.x/step)*step,y:Math.round(delta.y/step)*step};
      solution=wallTranslateSolution(state.records,state.wall,delta);
    } else {
      let next=snapEnabled?{x:Math.round(pointer.x/step)*step,y:Math.round(pointer.y/step)*step}:pointer;
      const anchor=record.points[1-state.mode];
      next=wallDirectionConstraint(next,anchor,e.e.shiftKey).point;
      solution=wallEndpointSolution(state.records,state.wall,state.mode,next);
    }
    if(!validWallDrag(state.records,solution))return;
    if(!state.changed){wallCheckpoint();state.changed=true;}
    solution.forEach(r=>setWallEndpoints(r.wall,r.points));
    if(typeof syncFloorplanOpenings==='function')syncFloorplanOpenings();
    canvas.requestRenderAll();
  });
  canvas.on('mouse:up',()=>{
    if(!wallDragState)return;
    const changed=wallDragState.changed;wallDragState=null;
    if(changed){isDirty=true;syncSaveButton();refreshFloorplanGeometry();}
    canvas.requestRenderAll();
  });
  canvas.on('after:render',event=>{
    if ((event?.ctx && event.ctx !== canvas.contextContainer) || !canvas.contextTop) return;
    if(currentTool!=='select'||canvas._groupSelector)return;
    const ctx=canvas.contextTop;canvas.clearContext(ctx);
    const wall=canvas.getActiveObject();if(wall?.data?.kind!=='wall')return;
    ctx.save();ctx.transform(...canvas.viewportTransform);
    if(wallDragState?.changed){
      ctx.save();ctx.strokeStyle='#829c97';ctx.globalAlpha=.45;ctx.lineWidth=1/canvas.getZoom();ctx.setLineDash([5/canvas.getZoom(),4/canvas.getZoom()]);
      wallDragState.records.forEach(r=>{const [a,b]=r.points;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});ctx.restore();
    }
    wallEndpoints(wall).forEach(point=>{if(typeof drawFloorplanSnapMarker==='function')drawFloorplanSnapMarker(ctx,point);else{ctx.beginPath();ctx.arc(point.x,point.y,5/canvas.getZoom(),0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#14978f';ctx.lineWidth=2/canvas.getZoom();ctx.stroke();}});
    ctx.restore();
  });
}

function setupWalls() {
  setupWallDimensions();
  setupWallDragging();
  const input = document.getElementById('wallThickness');
  input.addEventListener('change', () => {
    const value = floorplanFromDisplayLength(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 100) { input.value = floorplanFormatLength(wallThickness); return; }
    wallThickness = value;
    wallDrawingThicknessManual = true;
    const selected = canvas.getActiveObjects().filter(o => o.data?.kind === 'wall');
    if (selected.length) {
      wallCheckpoint();
      selected.forEach(wall => {
        // Preserve centreline position when changing the stroke's bounding box.
        const center = wall.getCenterPoint();
        wall.set('strokeWidth', value);
        wall.data.thicknessManual = true;
        wall.setPositionByOrigin(center, 'center', 'center');
        wall.setCoords();
      });
      mergeStraightWalls();
      refreshFloorplanGeometry();
      isDirty = true;
      syncSaveButton();
    }
    canvas.requestRenderAll();
  });
  const selectionChanged = () => {
    const wall = canvas.getActiveObject();
    if (wall?.data?.kind === 'wall') { wallThickness = wall.strokeWidth; input.value = floorplanFormatLength(wallThickness); }
  };
  canvas.on('selection:created', selectionChanged);
  canvas.on('selection:updated', selectionChanged);
  canvas.on('mouse:down', opt => {
    if (currentTool !== 'wall' || isPanning || opt.e.button > 0) return;
    const point = wallLengthTyped ? typedWallPoint(wallPointer) : resolveWallDraft(canvas.getPointer(opt.e), opt.e.shiftKey);
    if (point) commitWallPoint(point);
    else if(wallDraftError)showWallPlacementError(wallDraftError);
  });
  canvas.on('mouse:move', opt => {
    if (currentTool !== 'wall' || isPanning) return;
    // Once typing starts, preserve the direction while the pointer crosses the editor.
    if (!wallLengthTyped) wallPointer = resolveWallDraft(canvas.getPointer(opt.e), opt.e.shiftKey);
    if (!wallStart) updateWallStartOffset(canvas.getPointer(opt.e));
    if (wallStart) document.getElementById('wallStatus').textContent = wallDraftError || 'Type a length and press Enter to place. Escape finishes. Shift locks 90°.';
    canvas.requestRenderAll();
  });
  // Draw the temporary segment on the interaction layer, outside saved objects.
  canvas.on('after:render', event => {
    if ((event?.ctx && event.ctx !== canvas.contextContainer) || !canvas.contextTop) return;
    const ctx = canvas.contextTop;
    if (currentTool !== 'wall') return;
    canvas.clearContext(ctx);
    if (!wallPointer) return;
    ctx.save();
    ctx.transform(...canvas.viewportTransform);
    if (wallStart) {
      // Only exact alignment is advertised after snapping or typed input. A
      // nearby manually typed length must never look like an equal measurement.
      const alignment = parallelWallAlignment(wallStart, wallPointer, wallRecords(), { tolerance: 0.6 / canvas.getZoom() });
      drawParallelWallGuide(ctx, alignment, canvas.getZoom());
      const record=wallDraftRecord(wallStart,wallPointer),records=[...wallRecords(),record];
      const geometry=wallFaceGeometry(record,records);
      const invalid=wallPlacementError(wallStart,wallPointer);
      ctx.fillStyle=invalid?'rgba(200,65,60,0.5)':'rgba(0,150,145,0.45)';
      ctx.beginPath();geometry.polygon.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();ctx.fill();
    }
    if(typeof drawFloorplanSnapMarker==='function') drawFloorplanSnapMarker(ctx,wallPointer);
    else { ctx.strokeStyle = '#008c85'; ctx.lineWidth = 2 / canvas.getZoom(); ctx.beginPath(); ctx.arc(wallPointer.x, wallPointer.y, 5 / canvas.getZoom(), 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable="true"]') ||
        [...document.querySelectorAll('.fp-modal-overlay')].some(el => el.style.display !== 'none')) return;
    if (e.key === 'Enter' && currentTool === 'wall') {
      e.preventDefault();
      if (wallLengthEdit?.drawing) submitWallLength(); else finishCurrent();
    }
    if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'w') { e.preventDefault(); setTool('wall'); }
    if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'v') { e.preventDefault(); setTool('select'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
  });
}

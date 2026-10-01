// Face dimensions use intersections of offset wall centrelines (centimetres).
const wallDistance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const wallSamePoint = (a, b) => wallDistance(a, b) < 0.001;
const wallCross = (a, b) => a.x * b.y - a.y * b.x;
let wallDimensionUI, wallLengthEditor, wallLengthInput, wallLengthCaption;
let wallLengthEdit = null, wallLengthTyped = false;
let wallTypedDirection = null;
let wallOffsetUI, wallOffsetA, wallOffsetB, wallOffsetContext = null, wallOffsetFrom = 'a';
let wallStartReference = null;
let floorplanDimensionsVisible = true;

function toggleFloorplanDimensions() {
  floorplanDimensionsVisible = !floorplanDimensionsVisible;
  const button = document.getElementById('dimensionsBtn');
  if (button) { button.classList.toggle('active', floorplanDimensionsVisible); button.setAttribute('aria-pressed', String(floorplanDimensionsVisible)); }
  canvas.requestRenderAll();
}

function wallClearanceBounds(record, records, side, point) {
  const face = wallFaceGeometry(record, records).faces.find(f => f.side === side);
  if (!point) return face.points;
  const t = wallProjection(point, record.points).t;
  const segment = face.segments.find(s => t >= wallProjection(s.points[0], record.points).t - 0.00001 && t <= wallProjection(s.points[1], record.points).t + 0.00001);
  return segment?.points || null;
}

function wallClearancePoint(record, records, from, clearance, thickness, direction, side, referencePoint) {
  const [a, b] = record.points, length = wallDistance(a, b);
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const magnitude = Math.hypot(direction.x, direction.y);
  if (!magnitude) return null;
  const v = { x: direction.x / magnitude, y: direction.y / magnitude };
  const sin = wallCross(u, v), cos = u.x * v.x + u.y * v.y;
  if (Math.abs(sin) < 0.001) return null;
  const bounds = wallClearanceBounds(record, records, side, referencePoint);
  if (!bounds) return null;
  const start = wallProjection(bounds[0], record.points).t * length;
  const end = wallProjection(bounds[1], record.points).t * length;
  const half = thickness / (2 * Math.abs(sin));
  const skew = side * record.thickness / 2 * cos / sin;
  const position = from === 'a' ? start + clearance + half - skew : end - clearance - half - skew;
  if (!Number.isFinite(position) || position <= 0 || position >= length || position + skew - half < start - 0.001 || position + skew + half > end + 0.001) return null;
  return { x: a.x + u.x * position, y: a.y + u.y * position };
}

function closeWallStartOffset() {
  wallOffsetContext = null;
  wallStartReference = null;
  if (wallOffsetUI) wallOffsetUI.hidden = true;
}

function updateWallStartOffset(point) {
  if (!wallOffsetUI || wallStart || currentTool !== 'wall') return;
  if (wallOffsetUI.contains(document.activeElement)) return;
  const records = wallRecords();
  let best = null, distance = 18 / canvas.getZoom();
  for (const record of records) {
    const projection = wallProjection(point, record.points);
    const d = wallDistance(point, projection.point);
    if (projection.t > 0.001 && projection.t < 0.999 && d < distance) { best = record; distance = d; }
  }
  if (!best) { wallOffsetUI.hidden = true; wallOffsetContext = null; return; }
  const [a, b] = best.points;
  const u = { x: b.x - a.x, y: b.y - a.y };
  const side = Math.sign(wallCross(u, { x: point.x - a.x, y: point.y - a.y })) || 1;
  const selected = snapPointOnWall(point, best.points);
  const geometry = wallFaceGeometry(best, records).faces.find(f => f.side === side);
  const axisLength = wallDistance(a, b);
  const distanceFromA = wallProjection(selected, best.points).t * axisLength;
  const start = wallProjection(geometry.points[0], best.points).t * axisLength;
  const end = wallProjection(geometry.points[1], best.points).t * axisLength;
  const bounds = wallClearanceBounds(best, records, side, selected);
  if (!bounds) { wallOffsetUI.hidden = true; wallOffsetContext = null; return; }
  const leftBound = wallProjection(bounds[0], best.points).t * axisLength;
  const rightBound = wallProjection(bounds[1], best.points).t * axisLength;
  const firstFrom = Math.abs(u.x) >= Math.abs(u.y) ? (u.x >= 0 ? 'a' : 'b') : (u.y <= 0 ? 'a' : 'b');
  wallOffsetContext = { wall: best.wall, point: selected, side, firstFrom };
  wallOffsetFrom = firstFrom;
  wallOffsetA.dataset.from = firstFrom;
  wallOffsetB.dataset.from = firstFrom === 'a' ? 'b' : 'a';
  const branchThickness = !wallDrawingThicknessManual ? wallDefaultThickness.inner : wallThickness;
  const gaps = { a: Math.max(0, distanceFromA - leftBound - branchThickness / 2), b: Math.max(0, rightBound - distanceFromA - branchThickness / 2) };
  wallOffsetA.value = floorplanFormatLength(gaps[wallOffsetA.dataset.from]);
  wallOffsetB.value = floorplanFormatLength(gaps[wallOffsetB.dataset.from]);
  wallOffsetUI.querySelector('.fp-offset-title').textContent = `Start point · clear gap (${floorplanUnitLabel()}) · Tab to type`;
  [wallOffsetA, wallOffsetB].forEach(input => input.setAttribute('aria-label', `${input === wallOffsetA ? 'Nearest left / down' : 'Nearest right / up'} clear gap (${floorplanUnitLabel()})`));
  // Keep the editor away from the snap point; the crosshair remains visible.
  wallOffsetUI.style.left = '12px';
  wallOffsetUI.style.top = '12px';
  const measurements = wallOffsetUI.querySelector('.fp-offset-measurements');
  const opposite = wallFaceGeometry(best, records).faces.find(f => f.side === -side);
  const inner = geometry.name === 'Inner' ? geometry : opposite;
  const outer = geometry.name === 'Outer' ? geometry : opposite;
  if (measurements) measurements.textContent = `Inner ${floorplanFormatLength(inner.length)} · Outer ${floorplanFormatLength(outer.length)} ${floorplanUnitLabel()}\nFrom end A ${floorplanFormatLength(Math.max(0,distanceFromA-start-branchThickness/2))} · end B ${floorplanFormatLength(Math.max(0,end-distanceFromA-branchThickness/2))} ${floorplanUnitLabel()}`;
  wallOffsetUI.hidden = false;
}

function setupWallStartOffset(wrapper) {
  wallOffsetUI = document.createElement('form');
  wallOffsetUI.className = 'fp-wall-offset-editor'; wallOffsetUI.hidden = true;
  const title = document.createElement('span'); title.textContent = 'Start point · clear gap (cm) · Tab to type'; title.className = 'fp-offset-title';
  wallOffsetUI.append(title);
  const makeInput = (name, id) => {
    const label = document.createElement('label'); label.textContent = name;
    const input = document.createElement('input'); input.type = 'text'; input.inputMode = 'decimal'; input.id = id; input.setAttribute('aria-label', name + ' clear gap in centimetres');
    input.addEventListener('focus', () => { wallOffsetFrom = input.dataset.from || 'a'; input.select(); });
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); closeWallStartOffset(); } });
    input.addEventListener('input', () => input.setCustomValidity(''));
    label.append(input); wallOffsetUI.append(label); return input;
  };
  wallOffsetA = makeInput('From nearest left / down', 'wallOffsetA'); wallOffsetB = makeInput('From nearest right / up', 'wallOffsetB');
  const measurements = document.createElement('p'); measurements.className = 'fp-offset-measurements'; wallOffsetUI.append(measurements);
  const start = document.createElement('button'); start.type = 'submit'; start.textContent = 'Start here'; wallOffsetUI.append(start);
  wallOffsetUI.addEventListener('submit', e => {
    e.preventDefault();
    if (!wallOffsetContext) return;
    const input = wallOffsetFrom === wallOffsetB.dataset.from ? wallOffsetB : wallOffsetA;
    wallOffsetFrom = input.dataset.from;
    const value = floorplanFromDisplayLength(input.value);
    const records = wallRecords(), record = records.find(r => r.wall === wallOffsetContext.wall);
    if (!record || !Number.isFinite(value) || value < 0) { input.setCustomValidity('Enter a positive clear gap.'); input.reportValidity(); return; }
    const [a, b] = record.points, side = wallOffsetContext.side;
    const direction = { x: -(b.y - a.y) * side, y: (b.x - a.x) * side };
    const branchThickness = !wallDrawingThicknessManual ? wallDefaultThickness.inner : wallThickness;
    const point = wallClearancePoint(record, records, wallOffsetFrom, value, branchThickness, direction, side, wallOffsetContext.point);
    if (!point) { input.setCustomValidity('That gap does not fit on this wall.'); input.reportValidity(); return; }
    const reference = { wall: record.wall, from: wallOffsetFrom, clearance: value, side, point: wallOffsetContext.point };
    commitWallPoint(point);
    wallStartReference = reference;
    wallOffsetUI.hidden = true;
    document.getElementById('wallStatus').textContent = 'Start point set. Aim the new wall and enter its length.';
  });
  wrapper.append(wallOffsetUI);
  document.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !wallOffsetUI.hidden && !e.target.closest('input,select,textarea')) { e.preventDefault(); wallOffsetA.focus(); }
  });
}

function alignWallClearance(point) {
  if (!wallStartReference || !wallStart) return point;
  const records = wallRecords(), reference = wallStartReference;
  const record = records.find(r => r.wall === reference.wall);
  if (!record) return point;
  const direction = { x: point.x - wallStart.x, y: point.y - wallStart.y };
  const side = Math.sign(wallCross({ x: record.points[1].x - record.points[0].x, y: record.points[1].y - record.points[0].y }, direction)) || reference.side;
  const start = wallClearancePoint(record, records, reference.from, reference.clearance, wallThickness, direction, side, reference.point);
  if (!start) return point;
  wallStart = start;
  return { x: start.x + direction.x, y: start.y + direction.y };
}

function wallProjection(point, [a, b]) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2 : 0;
  return { t, point: { x: a.x + t * dx, y: a.y + t * dy } };
}

function wallInteriorPoint(point, points) {
  const projected = wallProjection(point, points);
  return projected.t > 0.00001 && projected.t < 0.99999 && wallSamePoint(point, projected.point);
}

function mergedWallPoints(first, second) {
  if (Math.abs(first.thickness - second.thickness) > 0.001) return null;
  if (first.wall?.data && second.wall?.data && ['wallType', 'insulated', 'loadBearing'].some(key => first.wall.data[key] !== second.wall.data[key])) return null;
  const projected = second.points.map(p => wallProjection(p, first.points));
  if (projected.some((p, i) => !wallSamePoint(p.point, second.points[i]))) return null;
  const lo = Math.min(...projected.map(p => p.t)), hi = Math.max(...projected.map(p => p.t));
  if (lo > 1.000001 || hi < -0.000001) return null;
  const [a, b] = first.points;
  return [Math.min(0, lo), Math.max(1, hi)].map(t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
}

function mergeStraightWalls() {
  let changed = true;
  while (changed) {
    changed = false;
    const records = wallRecords();
    outer: for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const points = mergedWallPoints(records[i], records[j]);
        if (!points) continue;
        canvas.discardActiveObject();
        if (typeof rehostFloorplanOpenings === 'function') rehostFloorplanOpenings(records[j].wall, records[i].wall, points);
        setWallEndpoints(records[i].wall, points);
        canvas.remove(records[j].wall);
        changed = true;
        break outer;
      }
    }
  }
}

let floorplanWallSequence = 0;
let wallLastError = '';
function ensureFloorplanWallId(wall) {
  if (!wall.data) wall.data = {};
  if (!wall.data.id) wall.data.id = `wall-${Date.now().toString(36)}-${++floorplanWallSequence}`;
  if (!wall.data.wallType) wall.data.wallType = 'outer';
  for (const key of ['insulated', 'loadBearing']) {
    if (wall.data[key] === undefined) {
      wall.data[key] = wall.data.wallType === 'outer';
      wall.data[`${key}Auto`] = true;
    }
  }
  return wall.data.id;
}

function refreshFloorplanGeometry() {
  if (typeof classifyFloorplanWalls === 'function') {
    const records = wallRecords();
    const classification = classifyFloorplanWalls(records);
    records.forEach(record => {
      const type = classification.get(record.wall);
      if (!type || record.wall.data.wallTypeManual) return;
      if (record.wall.data.wallType !== type) {
        record.wall.data.wallType = type;
        for (const key of ['insulated', 'loadBearing']) {
          if (record.wall.data[`${key}Auto`]) record.wall.data[key] = type === 'outer';
        }
        if (!record.wall.data.thicknessManual && typeof wallDefaultThickness !== 'undefined') {
          const points = wallEndpoints(record.wall);
          record.wall.set('strokeWidth', wallDefaultThickness[type]);
          setWallEndpoints(record.wall, points);
        }
      }
    });
  }
  if (typeof refreshFloorplanRooms === 'function') refreshFloorplanRooms();
  if (typeof syncFloorplanOpenings === 'function') syncFloorplanOpenings();
  if (typeof refreshFloorplanInspector === 'function') refreshFloorplanInspector();
  canvas.requestRenderAll();
}

// Parallel walls stretch; every other connected wall translates as a whole.
// This maintains the existing 90/45 degree directions instead of rotating branches.
function wallMoveJunction(records, record, moving, next) {
  const delta = { x: next.x - moving.x, y: next.y - moving.y };
  const magnitude = Math.hypot(delta.x, delta.y);
  if (magnitude < 0.000001) return records.map(r => ({ ...r, points: r.points.map(p => ({ ...p })) }));
  const nodes = [moving];
  records.forEach(r => r.points.forEach(p => { if (!nodes.some(n => wallSamePoint(n, p))) nodes.push(p); }));
  const moved = new Set([0]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of records) {
      if (r.wall === record.wall) continue;
      const [a, b] = r.points;
      const tangent = { x: b.x - a.x, y: b.y - a.y };
      if (Math.abs(wallCross(tangent, delta)) < 0.00001 * wallDistance(a, b) * magnitude) continue;
      const onWall = nodes.map((p, index) => ({ p, index })).filter(({ p }) => wallSamePoint(p, a) || wallSamePoint(p, b) || wallInteriorPoint(p, r.points));
      if (!onWall.some(({ index }) => moved.has(index))) continue;
      onWall.forEach(({ index }) => { if (!moved.has(index)) { moved.add(index); changed = true; } });
    }
  }
  if (nodes.some((p, index) => moved.has(index) && wallSamePoint(p, record.points[0]))) return null;
  const shift = p => nodes.some((n, index) => moved.has(index) && wallSamePoint(n, p)) ? { x: p.x + delta.x, y: p.y + delta.y } : { ...p };
  const solution = records.map(r => ({ ...r, points: r.points.map(shift) }));
  // Do not silently detach a branch when shortening its host past the junction.
  for (let i = 0; i < records.length; i++) {
    for (let j = 0; j < records.length; j++) {
      if (i === j) continue;
      for (let k = 0; k < 2; k++) {
        if (wallInteriorPoint(records[i].points[k], records[j].points) && !wallInteriorPoint(solution[i].points[k], solution[j].points)) return null;
      }
    }
  }
  return solution;
}

function wallRecords() {
  return canvas.getObjects().filter(w => w.data?.kind === 'wall').map(w => ({
    wall: w, points: wallEndpoints(w), thickness: w.strokeWidth
  }));
}

function wallEndpointRays(record, records, index) {
  const point = record.points[index];
  return records.filter(other => other !== record).flatMap(other => {
    const connection = other.points.findIndex(p => wallSamePoint(p, point));
    if (connection < 0) return [];
    const end = other.points[1 - connection], length = wallDistance(point, end);
    return length < 0.001 ? [] : [{ record: other, direction: { x: (end.x - point.x) / length, y: (end.y - point.y) / length } }];
  });
}

function wallCornerShell(record, records, index) {
  const point = record.points[index];
  const incident = [record, ...wallEndpointRays(record, records, index).map(ray => ray.record)];
  const type = wall => wall.wall?.data?.wallType || wall.wallType;
  if (incident.some(wall => type(wall))) {
    const outer = incident.filter(wall => type(wall) === 'outer');
    return outer.length === 2 && incident.some(wall => type(wall) === 'inner') ? outer : null;
  }
  if (incident.length !== 3) return null;
  // Legacy plans have no construction metadata. A ray inside an exterior
  // angular enclosure is the partition; the two boundary rays form the shell.
  const rays = incident.map(wall => {
    const end = wall.points.find(p => !wallSamePoint(p, point));
    return { wall, angle: Math.atan2(end.y - point.y, end.x - point.x) };
  }).sort((a, b) => a.angle - b.angle);
  const gaps = rays.map((ray, i) => ({ i, angle: (rays[(i + 1) % rays.length].angle - ray.angle + Math.PI * 2) % (Math.PI * 2) }));
  const largest = gaps.reduce((best, gap) => gap.angle > best.angle ? gap : best);
  if (largest.angle > Math.PI + 0.00001) return [rays[largest.i].wall, rays[(largest.i + 1) % rays.length].wall];
  // An orthogonal step has a 90-degree shell corner and a partition approaching
  // its concave side. Keep this legacy inference narrow instead of guessing Y joins.
  const rightAngle = gaps.filter(gap => Math.abs(gap.angle - Math.PI / 2) < 0.00001);
  return rightAngle.length === 1 ? [rays[rightAngle[0].i].wall, rays[(rightAngle[0].i + 1) % rays.length].wall] : null;
}

function wallCornerConnection(record, records, index) {
  const shell = wallCornerShell(record, records, index);
  if (!shell || shell.includes(record)) return null;
  const point = record.points[index], end = record.points[1 - index], length = wallDistance(point, end);
  const away = { x: (end.x - point.x) / length, y: (end.y - point.y) / length };
  const planes = shell.map(host => {
    const other = host.points.find(p => !wallSamePoint(p, point)), size = wallDistance(point, other);
    const direction = { x: (other.x - point.x) / size, y: (other.y - point.y) / size };
    const sign = Math.sign(wallCross(direction, away));
    if (!sign) return null;
    const normal = { x: -direction.y * sign, y: direction.x * sign };
    return { direction, normal, sign, thickness: host.thickness, point: { x: point.x + normal.x * host.thickness / 2, y: point.y + normal.y * host.thickness / 2 } };
  });
  if (planes.some(plane => !plane)) return null;
  const [first, second] = planes, determinant = wallCross(first.direction, second.direction);
  if (Math.abs(determinant) < 0.00001) return null;
  planes.forEach((plane, i) => {
    const other = planes[1 - i];
    // The visible face begins at the shell's own miter, which may use the
    // opposite face of the other outer wall at a re-entrant corner.
    const otherOffset = { x: point.x + other.direction.y * plane.sign * other.thickness / 2,
      y: point.y - other.direction.x * plane.sign * other.thickness / 2 };
    const distance = wallCross({ x: otherOffset.x - plane.point.x, y: otherOffset.y - plane.point.y }, other.direction) / wallCross(plane.direction, other.direction);
    plane.boundaryStart = { x: plane.point.x + plane.direction.x * distance, y: plane.point.y + plane.direction.y * distance };
  });
  const corner = wallSamePoint(first.boundaryStart, second.boundaryStart) ? first.boundaryStart : null;
  const firstWeight = wallCross(away, second.direction) / determinant;
  const secondWeight = wallCross(first.direction, away) / determinant;
  return { planes, corner, away, convex: firstWeight >= -0.00001 && secondWeight >= -0.00001 };
}

function wallJunctionPolygon(record, records, faces) {
  const joint = index => {
    const connection = wallCornerConnection(record, records, index);
    if (connection?.corner) {
      const offset = { x: connection.corner.x - record.points[index].x, y: connection.corner.y - record.points[index].y };
      // Include the room's finished corner only when it lies inside the partition strip.
      return Math.abs(wallCross(connection.away, offset)) <= record.thickness / 2 + 0.001 ? connection.corner : null;
    }
    if (connection) return null;
    if (wallCornerShell(record, records, index)?.includes(record)) return null;
    const rays = wallEndpointRays(record, records, index);
    // Three or more endpoint walls partition the junction around the shared node.
    // A continuous host already owns that area, so branches stop at its face.
    return rays.length >= 2 && !records.some(other => other !== record && wallInteriorPoint(record.points[index], other.points))
      ? record.points[index] : null;
  };
  const start = joint(0), end = joint(1);
  return [faces[0].points[0], faces[0].points[1], ...(end ? [end] : []),
    faces[1].points[1], faces[1].points[0], ...(start ? [start] : [])];
}

function wallExposedCaps(record, records, faces) {
  return record.points.flatMap((point, index) => {
    if (records.some(other => other !== record && wallInteriorPoint(point, other.points))) return [];
    const rays = wallEndpointRays(record, records, index);
    const a = faces[0].points[index], b = faces[1].points[index];
    if (!rays.length) return [[a, b]];
    const own = record.points[1 - index], direction = { x: own.x - point.x, y: own.y - point.y };
    if (rays.some(ray => Math.abs(wallCross(direction, ray.direction)) > 0.00001 * wallDistance(point, own))) return [];
    // A change of thickness along a straight run exposes only its two small shoulders.
    const covered = Math.max(...rays.map(ray => ray.record.thickness));
    if (covered >= record.thickness - 0.001) return [];
    const fraction = (record.thickness - covered) / (2 * record.thickness);
    const at = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    return [[a, at(fraction)], [at(1 - fraction), b]];
  });
}

function wallFaceGeometry(record, records) {
  const [a, b] = record.points;
  const length = wallDistance(a, b);
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const normal = { x: -u.y, y: u.x };
  const faces = [-1, 1].map(side => {
    const ends = [a, b].map((point, index) => {
      const offset = { x: point.x + side * normal.x * record.thickness / 2,
        y: point.y + side * normal.y * record.thickness / 2 };
      const cornerConnection = wallCornerConnection(record, records, index);
      if (cornerConnection) {
        const intersections = cornerConnection.planes.map(plane => {
          const distance = ((plane.point.x - offset.x) * plane.normal.x + (plane.point.y - offset.y) * plane.normal.y) /
            (cornerConnection.away.x * plane.normal.x + cornerConnection.away.y * plane.normal.y);
          const hit = { x: offset.x + cornerConnection.away.x * distance, y: offset.y + cornerConnection.away.y * distance };
          const along = (hit.x - plane.boundaryStart.x) * plane.direction.x + (hit.y - plane.boundaryStart.y) * plane.direction.y;
          return { distance, visible: along >= -0.001 };
        });
        // A convex room corner is inside both faces; a re-entrant corner is
        // inside either face. This gives the actual V-shaped butt joint.
        const visible = intersections.filter(hit => hit.visible).map(hit => hit.distance);
        const distances = intersections.map(hit => hit.distance);
        const distance = visible.length ? Math.min(...visible) : cornerConnection.convex ? Math.max(...distances) : Math.min(...distances);
        return { x: offset.x + cornerConnection.away.x * distance, y: offset.y + cornerConnection.away.y * distance };
      }
      // A branch ends against the near face of a continuous host wall.
      for (const host of records) {
        if (host === record || !wallInteriorPoint(point, host.points)) continue;
        const [ha, hb] = host.points, hostLength = wallDistance(ha, hb);
        const h = { x: (hb.x - ha.x) / hostLength, y: (hb.y - ha.y) / hostLength };
        const away = index === 0 ? u : { x: -u.x, y: -u.y };
        const determinant = wallCross(u, h);
        if (Math.abs(determinant) < 0.00001) continue;
        const sign = Math.sign(wallCross(h, away));
        const q = { x: point.x - h.y * sign * host.thickness / 2,
          y: point.y + h.x * sign * host.thickness / 2 };
        const t = wallCross({ x: q.x - offset.x, y: q.y - offset.y }, h) / determinant;
        return { x: offset.x + u.x * t, y: offset.y + u.y * t };
      }
      const away = index === 0 ? u : { x: -u.x, y: -u.y }, awaySide = index === 0 ? side : -side;
      const shell = wallCornerShell(record, records, index);
      const adjacent = wallEndpointRays(record, records, index).filter(ray => !shell?.includes(record) || shell.includes(ray.record)).map(ray => {
        let angle = awaySide * Math.atan2(wallCross(away, ray.direction), away.x * ray.direction.x + away.y * ray.direction.y);
        if (angle <= 0.000001) angle += Math.PI * 2;
        return { ...ray, angle };
      }).sort((first, second) => first.angle - second.angle)[0];
      let t = 0;
      if (adjacent) {
        const v = adjacent.direction, determinant = wallCross(u, v);
        if (Math.abs(determinant) >= 0.00001) {
          // Faces bound angularly adjacent sectors. Picking the shortest miter
          // independently on each wall can pair different neighbors at a corner.
          const neighborSide = -awaySide;
          const q = { x: point.x - neighborSide * v.y * adjacent.record.thickness / 2,
            y: point.y + neighborSide * v.x * adjacent.record.thickness / 2 };
          const distance = wallCross({ x: q.x - offset.x, y: q.y - offset.y }, v) / determinant;
          if (Number.isFinite(distance)) t = distance;
        }
      }
      return { x: offset.x + u.x * t, y: offset.y + u.y * t };
    });
    const faceLength = (ends[1].x - ends[0].x) * u.x + (ends[1].y - ends[0].y) * u.y;
    const cuts = [];
    // Only the face touched by a branch is divided. The opposite face stays whole.
    for (const branch of records) {
      if (branch === record) continue;
      branch.points.forEach((joint, index) => {
        const endpoint = record.points.findIndex(point => wallSamePoint(point, joint));
        const cornerBranch = endpoint >= 0 && wallCornerShell(record, records, endpoint)?.includes(record) &&
          wallCornerConnection(branch, records, index);
        if (!wallInteriorPoint(joint, record.points) && !cornerBranch) return;
        const other = branch.points[1 - index], size = wallDistance(joint, other);
        const v = { x: (other.x - joint.x) / size, y: (other.y - joint.y) / size };
        const cross = wallCross(u, v);
        if (Math.abs(cross) < 0.00001 || Math.sign(cross) !== side) return;
        const offsets = [-1, 1].map(s => {
          const q = { x: joint.x - v.y * s * branch.thickness / 2, y: joint.y + v.x * s * branch.thickness / 2 };
          return wallCross({ x: q.x - ends[0].x, y: q.y - ends[0].y }, v) / cross;
        });
        const start = Math.max(0, Math.min(...offsets)), end = Math.min(faceLength, Math.max(...offsets));
        if (end > start + 0.001) cuts.push({ start, end, joint });
      });
    }
    cuts.sort((x, y) => x.start - y.start);
    const segments = [];
    let cursor = 0;
    const at = t => ({ x: ends[0].x + u.x * t, y: ends[0].y + u.y * t });
    for (const cut of cuts) {
      if (cut.start > cursor + 0.001) segments.push({ points: [at(cursor), at(cut.start)], length: cut.start - cursor, endNode: cut.joint });
      cursor = Math.max(cursor, cut.end);
    }
    if (faceLength > cursor + 0.001) segments.push({ points: [at(cursor), ends[1]], length: faceLength - cursor, endNode: b });
    return { side, points: ends, normal: { x: normal.x * side, y: normal.y * side },
      length: faceLength, segments, divided: cuts.length > 0 };
  });
  const connected = records.some(r => r !== record && r.points.some(p => record.points.some(q => wallSamePoint(p, q))));
  const inner = faces[0].length <= faces[1].length ? faces[0] : faces[1];
  faces.forEach(face => face.name = connected ? (face === inner ? 'Inner' : 'Outer') : (face.side === -1 ? 'Side A' : 'Side B'));
  if (faces.some(face => face.divided)) faces.forEach(face => face.name = face.divided ? 'Inner' : 'Outer');
  faces.forEach(face => face.segments.forEach((segment, index) => Object.assign(segment, { side: face.side, normal: face.normal, name: face.name, segmentIndex: index })));
  return { length, faces, polygon: wallJunctionPolygon(record, records, faces), caps: wallExposedCaps(record, records, faces) };
}

function wallResizeSolution(records, wall, side, requested, segmentIndex = null) {
  const record = records.find(r => r.wall === wall);
  if (!record || !Number.isFinite(requested) || Math.abs(requested) < 0.1 || Math.abs(requested) > 100000) return null;
  const [a, b] = record.points;
  const originalFace = side === 0 ? null : wallFaceGeometry(record, records).faces.find(f => f.side === side);
  const moving = segmentIndex === null ? b : originalFace.segments[segmentIndex]?.endNode;
  if (!moving || (requested < 0 && originalFace?.divided)) return null;
  const oldLength = wallDistance(a, b);
  const sign = Math.sign(requested);
  requested = Math.abs(requested);
  const direction = { x: sign * (b.x - a.x) / oldLength, y: sign * (b.y - a.y) / oldLength };
  const movingLength = wallDistance(a, moving);
  const candidate = length => {
    const next = { x: a.x + direction.x * length, y: a.y + direction.y * length };
    return wallMoveJunction(records, record, moving, next);
  };
  const measure = list => {
    if (!list) return NaN;
    if (side === 0) return wallDistance(...list.find(r => r.wall === wall).points);
    const face = wallFaceGeometry(list.find(r => r.wall === wall), list).faces.find(f => f.side === side);
    return segmentIndex === null ? face.length : face.segments[segmentIndex]?.length ?? NaN;
  };
  let length = movingLength;
  for (let i = 0; i < 30; i++) {
    const list = candidate(length);
    const error = measure(list) - requested;
    if (Math.abs(error) < 0.0001) {
      return list.every(r => wallDistance(...r.points) >= 0.1 && wallFaceGeometry(r, list).faces.every(f => f.length > 0)) ? list : null;
    }
    const delta = Math.max(0.001, length * 0.00001);
    const slope = (measure(candidate(length + delta)) - measure(list)) / delta;
    if (!Number.isFinite(slope) || Math.abs(slope) < 0.00001) return null;
    length -= error / slope;
    if (!Number.isFinite(length) || length < 0.1 || length > 100000) return null;
  }
  return null;
}

function applyWallDimension(wall, side, segmentIndex, value) {
  wallLastError = '';
  const solution = wallResizeSolution(wallRecords(), wall, side, Number(value), segmentIndex ?? null);
  if (!solution) { wallLastError = 'That length would collapse a wall or detach a junction. Choose a length that keeps the connections.'; return false; }
  if (typeof validateFloorplanOpenings === 'function' && !validateFloorplanOpenings(solution)) {
    wallLastError = 'That length leaves too little space for a door or window.'; return false;
  }
  wallCheckpoint();
  solution.forEach(r => setWallEndpoints(r.wall, r.points));
  refreshFloorplanGeometry();
  isDirty = true; syncSaveButton();
  return true;
}

function applyWallProperties(wall, changes) {
  wallLastError = '';
  const thickness = Number(changes.thickness ?? wall.strokeWidth);
  if (!Number.isFinite(thickness) || thickness < 1 || thickness > 100) { wallLastError = 'Thickness must be between 1 and 100 cm.'; return false; }
  const solution = changes.length !== undefined ? wallResizeSolution(wallRecords(), wall, 0, Number(changes.length)) : wallRecords();
  if (!solution) { wallLastError = 'That length would break an existing connection.'; return false; }
  solution.find(r => r.wall === wall).thickness = thickness;
  if (typeof validateFloorplanOpenings === 'function' && !validateFloorplanOpenings(solution)) { wallLastError = 'A door or window would no longer fit.'; return false; }
  wallCheckpoint();
  solution.forEach(r => setWallEndpoints(r.wall, r.points));
  const points = wallEndpoints(wall);
  wall.set('strokeWidth', thickness);
  if (changes.thickness !== undefined) wall.data.thicknessManual = true;
  if (changes.wallType !== undefined) wall.data.wallTypeManual = true;
  setWallEndpoints(wall, points);
  if (changes.wallType !== undefined) {
    wall.data.wallType = changes.wallType;
    for (const key of ['insulated', 'loadBearing']) if (wall.data[`${key}Auto`]) wall.data[key] = changes.wallType === 'outer';
  }
  for (const key of ['insulated', 'loadBearing']) {
    if (changes[key] !== undefined) { wall.data[key] = changes[key]; wall.data[`${key}Auto`] = false; }
  }
  refreshFloorplanGeometry();
  isDirty = true; syncSaveButton();
  return true;
}

function setWallEndpoints(wall, [a, b]) {
  wall.set({ x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    originX: 'center', originY: 'center', left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 });
  wall.setCoords();
  wall.dirty = true;
}

function wallHatchSegments(points, spacing = 18) {
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const height = maxY - minY, segments = [];
  for (let x = Math.floor((minX - height) / spacing) * spacing; x <= maxX; x += spacing) {
    segments.push([{ x, y: minY }, { x: x + height, y: maxY }]);
  }
  return segments;
}

function installWallFaceRenderer(wall) {
  if (wall.data?.kind !== 'wall') return;
  ensureFloorplanWallId(wall);
  wall.objectCaching = false;
  wall.set({ hasControls: false, hasBorders: false, lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true });
  wall._render = function(ctx) {
    const records = wallRecords();
    const record = records.find(r => r.wall === this);
    if (!record || wallDistance(...record.points) < 0.001) return;
    const { faces, polygon: points, caps } = wallFaceGeometry(record, records);
    const inverse = fabric.util.invertTransform(this.calcTransformMatrix());
    ctx.beginPath();
    points.forEach((p, i) => {
      const local = fabric.util.transformPoint(p, inverse);
      if (i === 0) ctx.moveTo(local.x, local.y); else ctx.lineTo(local.x, local.y);
    });
    ctx.closePath();
    const bearing = this.data.loadBearing, insulated = this.data.insulated, outer = this.data.wallType === 'outer';
    const colors = typeof floorplanColors === 'function' ? floorplanColors() : {wallBearing:'#41494f',wallOuter:'#9ca9ac',wallInner:'#d5dddd',hatch:'#a9c6bd',outline:'#283e3c'};
    ctx.fillStyle = bearing ? colors.wallBearing : outer ? colors.wallOuter : colors.wallInner; ctx.fill();
    ctx.save(); ctx.clip();
    if (insulated) {
      ctx.strokeStyle = colors.hatch; ctx.lineWidth = 0.65 / canvas.getZoom();
      const localPoints = points.map(p => fabric.util.transformPoint(p, inverse));
      for (const [a, b] of wallHatchSegments(localPoints)) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    if (outer) {
      ctx.strokeStyle = bearing ? '#778d88' : '#708780'; ctx.lineWidth = Math.max(1, this.strokeWidth * 0.08);
      const ends = this.calcLinePoints(); ctx.beginPath(); ctx.moveTo(ends.x1,ends.y1); ctx.lineTo(ends.x2,ends.y2); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    for (const [a, b] of [...faces.flatMap(face => face.segments.map(segment => segment.points)), ...caps]) {
      const start = fabric.util.transformPoint(a, inverse), end = fabric.util.transformPoint(b, inverse);
      ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
    }
    ctx.strokeStyle = colors.outline; ctx.lineWidth = (bearing ? 1.3 : 0.8) / canvas.getZoom(); ctx.stroke();
  };
}

function closeWallLengthEditor() {
  wallLengthEdit = null;
  wallLengthTyped = false;
  wallTypedDirection = null;
  if (wallLengthEditor) wallLengthEditor.hidden = true;
}

// Place the floating input beside the segment, keeping both placement points clear.
function floorplanEditorPosition(point, start, end, width, height, canvasWidth, canvasHeight) {
  const margin = 10, clearance = 26;
  const clamp = p => ({ x: Math.max(width / 2 + margin, Math.min(canvasWidth - width / 2 - margin, p.x)), y: Math.max(height / 2 + margin, Math.min(canvasHeight - height / 2 - margin, p.y)) });
  const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const offset = Math.abs(normal.x) * width / 2 + Math.abs(normal.y) * height / 2 + clearance;
  const candidates = [1, -1].map(sign => clamp({ x: point.x + sign * normal.x * offset, y: point.y + sign * normal.y * offset }));
  candidates.push(...[{ x: width / 2 + margin, y: height / 2 + margin }, { x: canvasWidth - width / 2 - margin, y: height / 2 + margin }, { x: width / 2 + margin, y: canvasHeight - height / 2 - margin }, { x: canvasWidth - width / 2 - margin, y: canvasHeight - height / 2 - margin }].map(clamp));
  const distance = (p, q) => Math.hypot(Math.max(0, Math.abs(p.x - q.x) - width / 2), Math.max(0, Math.abs(p.y - q.y) - height / 2));
  const clear = p => Math.min(distance(p, start), distance(p, end));
  return candidates.find(p => clear(p) >= clearance) || candidates.sort((a, b) => clear(b) - clear(a))[0];
}

// Existing values edit in place. Drawing inputs use the separate placement helper.
function floorplanMeasurementEditorPosition(anchor, width, height, canvasWidth, canvasHeight) {
  const margin = 8;
  return {
    x: Math.max(width / 2 + margin, Math.min(canvasWidth - width / 2 - margin, anchor.x)),
    y: Math.max(height / 2 + margin, Math.min(canvasHeight - height / 2 - margin, anchor.y))
  };
}

function bindFloorplanDimensionEditing(button, edit) {
  button.addEventListener('click', event => {
    event.stopPropagation();
    // Keyboard and assistive activation synthesize clicks without a mouse count.
    if (event.detail === 0) edit(event);
  });
  button.addEventListener('dblclick', event => { event.preventDefault(); event.stopPropagation(); edit(event); });
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); edit(event); }
  });
}

function positionWallLengthEditor(point) {
  const p = fabric.util.transformPoint(point, canvas.viewportTransform);
  const start = wallLengthEdit?.drawing && wallStart ? fabric.util.transformPoint(wallStart, canvas.viewportTransform) : p;
  const end = wallLengthEdit?.drawing && wallPointer ? fabric.util.transformPoint(wallPointer, canvas.viewportTransform) : p;
  const position = wallLengthEdit?.anchor
    ? floorplanMeasurementEditorPosition(wallLengthEdit.anchor, wallLengthEditor.offsetWidth || 186, wallLengthEditor.offsetHeight || 76, canvas.width, canvas.height)
    : floorplanEditorPosition(p, start, end, wallLengthEditor.offsetWidth || 186, wallLengthEditor.offsetHeight || 76, canvas.width, canvas.height);
  wallLengthEditor.style.left = `${position.x}px`;
  wallLengthEditor.style.top = `${position.y}px`;
}

function showDrawingWallLength() {
  if (!wallLengthEditor || !wallStart || !wallPointer || wallDistance(wallStart, wallPointer) < 0.1) return;
  if (wallLengthEdit?.wall) return;
  const fresh = !wallLengthEdit;
  if (fresh) {
    wallLengthEdit = { drawing: true };
    wallLengthInput.setCustomValidity('');
  }
  wallLengthEditor.hidden = false;
  wallLengthCaption.textContent = `Wall length · ${floorplanUnitLabel()}`;
  if (!wallLengthTyped) {
    wallLengthInput.value = floorplanFormatLength(wallDistance(wallStart, wallPointer));
    if (fresh) wallLengthInput.focus({ preventScroll: true });
    if (document.activeElement === wallLengthInput) wallLengthInput.select();
  }
  positionWallLengthEditor({ x: (wallStart.x + wallPointer.x) / 2, y: (wallStart.y + wallPointer.y) / 2 });
}

function typedWallPoint(point) {
  if (!wallLengthTyped || !wallStart) return point;
  const value = floorplanFromDisplayLength(wallLengthInput.value);
  const length = wallDistance(wallStart, point);
  if (!Number.isFinite(value) || Math.abs(value) < 0.1 || Math.abs(value) > 100000 || length < 0.001) return null;
  if (!wallTypedDirection) wallTypedDirection = { x: (point.x - wallStart.x) / length, y: (point.y - wallStart.y) / length };
  return { x: wallStart.x + wallTypedDirection.x * value,
    y: wallStart.y + wallTypedDirection.y * value };
}

function submitWallLength() {
  const value = floorplanFromDisplayLength(wallLengthInput.value);
  if (!Number.isFinite(value) || Math.abs(value) < 0.1 || Math.abs(value) > 100000) {
    wallLengthInput.setCustomValidity(`Enter ${floorplanFormatLength(0.1)} to ${floorplanFormatLength(100000)} ${floorplanUnitLabel()}. Use a minus sign to reverse direction.`);
    wallLengthInput.reportValidity(); return;
  }
  if (wallLengthEdit?.drawing) {
    wallLengthTyped = true;
    const next = typedWallPoint(wallPointer);
    if (next) commitWallPoint(next);
    return;
  }
  if (!wallLengthEdit?.wall) return;
  if (!applyWallDimension(wallLengthEdit.wall, wallLengthEdit.side, wallLengthEdit.segmentIndex, value)) {
    wallLengthInput.setCustomValidity(wallLastError);
    wallLengthInput.reportValidity(); return;
  }
  closeWallLengthEditor();
  isDirty = true; syncSaveButton(); canvas.requestRenderAll();
}

function renderWallDimensions(renderEvent) {
  if (renderEvent?.ctx && renderEvent.ctx !== canvas.contextContainer) return;
  if (!wallDimensionUI) return;
  // Keep a focused measurement stable during pan/zoom and redraw.
  wallDimensionUI.replaceChildren();
  if (!floorplanDimensionsVisible) { showDrawingWallLength(); return; }
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('aria-hidden','true');wallDimensionUI.append(svg);
  const dimensionLine=(a,b)=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);line.setAttribute('stroke','#8b9d9a');line.setAttribute('stroke-width','.65');svg.append(line);};
  const records = wallRecords();
  if (wallStart && wallPointer && wallDistance(wallStart, wallPointer) > 0.1) {
    records.push(typeof wallDraftRecord==='function'?wallDraftRecord(wallStart,wallPointer):{ points: [wallStart, wallPointer], thickness: wallThickness, preview: true });
  }
  for (const record of records) {
    const geometry = wallFaceGeometry(record, records);
    for (const face of geometry.faces.flatMap(face => face.segments)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fp-wall-dimension';
      button.textContent = floorplanFormatLength(face.length);
      button.setAttribute('aria-label', `${face.name} wall length ${floorplanFormatLength(face.length)} ${floorplanUnitLabel()}`);
      button.title = 'Double-click or press Enter to edit this face length';
      const midpoint = { x: (face.points[0].x + face.points[1].x) / 2,
        y: (face.points[0].y + face.points[1].y) / 2 };
      const p = fabric.util.transformPoint(midpoint, canvas.viewportTransform);
      const ends = face.points.map(q=>fabric.util.transformPoint(q,canvas.viewportTransform));
      const dimensionEnds=ends.map(q=>({x:q.x+face.normal.x*25,y:q.y+face.normal.y*25}));
      dimensionLine(...dimensionEnds);
      ends.forEach((q,i)=>{dimensionLine(q,{x:dimensionEnds[i].x+face.normal.x*4,y:dimensionEnds[i].y+face.normal.y*4});const d=dimensionEnds[i];dimensionLine({x:d.x-3,y:d.y+3},{x:d.x+3,y:d.y-3});});
      button.style.left = `${p.x + face.normal.x * 25}px`;
      button.style.top = `${p.y + face.normal.y * 25}px`;
      let angle = Math.atan2(record.points[1].y - record.points[0].y, record.points[1].x - record.points[0].x) * 180 / Math.PI;
      if (angle > 90 || angle < -90) angle += 180;
      button.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      if (record.preview || currentTool !== 'select') button.disabled = true;
      else bindFloorplanDimensionEditing(button, e => {
        e.stopPropagation();
        finishCurrent();
        wallLengthEdit = { wall: record.wall, side: face.side, segmentIndex: face.segmentIndex,
          anchor: { x: p.x + face.normal.x * 25, y: p.y + face.normal.y * 25 } };
        wallLengthCaption.textContent = `${face.name} length · ${floorplanUnitLabel()}`;
        // Recalculate without a temporary segment.
        const current = wallRecords();
        const length = wallFaceGeometry(current.find(r => r.wall === record.wall), current).faces.find(f => f.side === face.side).segments[face.segmentIndex]?.length;
        if (length === undefined) { closeWallLengthEditor(); return; }
        wallLengthInput.value = floorplanFormatLength(length);
        wallLengthInput.setCustomValidity('');
        wallLengthEditor.hidden = false;
        positionWallLengthEditor(midpoint);
        wallLengthInput.focus({ preventScroll: true }); wallLengthInput.select();
      });
      wallDimensionUI.append(button);
    }
  }
  showDrawingWallLength();
}

function setupWallDimensions() {
  const wrapper = document.getElementById('canvasWrapper');
  setupWallStartOffset(wrapper);
  wallDimensionUI = document.createElement('div');
  wallDimensionUI.className = 'fp-wall-dimensions';
  wallLengthEditor = document.createElement('form');
  wallLengthEditor.className = 'fp-wall-length-editor';
  wallLengthEditor.hidden = true;
  wallLengthCaption = document.createElement('label');
  wallLengthCaption.htmlFor = 'wallLengthInput';
  wallLengthInput = document.createElement('input');
  wallLengthInput.id = 'wallLengthInput';
  wallLengthInput.type = 'text';
  wallLengthInput.inputMode = 'decimal';
  wallLengthInput.autocomplete = 'off';
  const apply = document.createElement('button');
  apply.type = 'submit'; apply.textContent = 'Apply';
  wallLengthEditor.append(wallLengthCaption, wallLengthInput, apply);
  wrapper.append(wallDimensionUI, wallLengthEditor);
  wallLengthEditor.addEventListener('submit', e => { e.preventDefault(); submitWallLength(); });
  wallLengthEditor.addEventListener('pointerdown', e => e.stopPropagation());
  wallLengthInput.addEventListener('input', () => {
    wallLengthTyped = true;
    wallLengthInput.setCustomValidity('');
    if (wallLengthEdit?.drawing && wallPointer) {
      const point = typedWallPoint(wallPointer);
      if (point) wallPointer = point;
      canvas.requestRenderAll();
    }
  });
  wallLengthInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); finishCurrent(); }
  });
  canvas.on('object:added', e => installWallFaceRenderer(e.target));
  canvas.getObjects().forEach(installWallFaceRenderer);
  canvas.on('after:render', renderWallDimensions);
}

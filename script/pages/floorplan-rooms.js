// Rooms are faces of the wall centreline graph. Labels are saved with the plan;
// the geometry is derived again whenever walls change (doors/windows do not cut it).
let floorplanRoomsUpdating = false;
let floorplanRoomFaces = [], floorplanRoomFingerprint = '', floorplanRoomUI;
let floorplanRoomEditing = null, floorplanRoomDrag = null, floorplanRoomSequence = 0;
const ROOM_EPSILON = 0.001;

function roomArea(points) {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;
}

function roomPointInside(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function roomBoundaryDistance(point, polygon) {
  let distance = Infinity;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    distance = Math.min(distance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
  });
  return distance;
}

function roomLabelPoint(polygon, holes = []) {
  const area = roomArea(polygon);
  let x = 0, y = 0;
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length], cross = p.x * q.y - q.x * p.y;
    x += (p.x + q.x) * cross; y += (p.y + q.y) * cross;
  });
  const centroid = { x: x / (6 * area), y: y / (6 * area) };
  const isInside = point => roomPointInside(point, polygon) && !holes.some(hole => roomPointInside(point, hole));
  const clearance = point => Math.min(roomBoundaryDistance(point, polygon), ...holes.map(hole => roomBoundaryDistance(point, hole)));
  if (isInside(centroid) && clearance(centroid) > 10) return centroid;
  // A concave room's centroid can be outside its floor. Refine a search for an
  // interior point with clearance instead of putting its name inside a wall.
  let left = Math.min(...polygon.map(p => p.x)), right = Math.max(...polygon.map(p => p.x));
  let top = Math.min(...polygon.map(p => p.y)), bottom = Math.max(...polygon.map(p => p.y));
  let best = { ...centroid, distance: -Infinity };
  for (let pass = 0; pass < 5; pass++) {
    const dx = (right - left) / 12, dy = (bottom - top) / 12;
    for (let row = 0; row <= 12; row++) for (let col = 0; col <= 12; col++) {
      const point = { x: left + col * dx, y: top + row * dy };
      if (!isInside(point)) continue;
      const distance = clearance(point);
      if (distance > best.distance) best = { ...point, distance };
    }
    if (!Number.isFinite(best.distance)) return centroid;
    left = best.x - dx; right = best.x + dx; top = best.y - dy; bottom = best.y + dy;
  }
  return { x: best.x, y: best.y };
}

function roomInnerPolygon(points, edges, direction = 1) {
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const offsetLines = points.map((a, i) => {
    const b = points[(i + 1) % points.length], length = Math.hypot(b.x - a.x, b.y - a.y);
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const half = direction * edges[i].thickness / 2;
    return { a: { x: a.x - u.y * half, y: a.y + u.x * half }, u, half };
  });
  const inner = [];
  for (let i = 0; i < points.length; i++) {
    const current = offsetLines[i], previous = offsetLines[(i + points.length - 1) % points.length];
    const determinant = cross(previous.u, current.u);
    if (Math.abs(determinant) < 0.000001) {
      if (Math.abs(previous.half - current.half) > ROOM_EPSILON) return null;
      inner.push(current.a);
      continue;
    }
    const delta = { x: current.a.x - previous.a.x, y: current.a.y - previous.a.y };
    const t = cross(delta, current.u) / determinant;
    const point = { x: previous.a.x + previous.u.x * t, y: previous.a.y + previous.u.y * t };
    if (Math.hypot(point.x - points[i].x, point.y - points[i].y) > 10 * Math.max(Math.abs(current.half), Math.abs(previous.half))) return null;
    if (direction > 0 && !roomPointInside(point, points)) return null;
    inner.push(point);
  }
  const area = roomArea(inner);
  if (area <= ROOM_EPSILON || (direction > 0 ? area >= roomArea(points) : area <= roomArea(points))) return null;
  // Reject collapsed/overlapping offsets. Do not present a misleading area.
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i], b = inner[(i + 1) % inner.length];
    const original = offsetLines[i].u;
    if ((b.x - a.x) * original.x + (b.y - a.y) * original.y <= ROOM_EPSILON) return null;
    for (let j = i + 2; j < inner.length; j++) {
      if ((j + 1) % inner.length === i) continue;
      const c = inner[j], d = inner[(j + 1) % inner.length];
      const ab = { x: b.x - a.x, y: b.y - a.y }, cd = { x: d.x - c.x, y: d.y - c.y };
      const denominator = cross(ab, cd);
      if (Math.abs(denominator) < 0.000001) continue;
      const ac = { x: c.x - a.x, y: c.y - a.y };
      const t = cross(ac, cd) / denominator, u = cross(ac, ab) / denominator;
      if (t > 0 && t < 1 && u > 0 && u < 1) return null;
    }
  }
  return inner;
}

function roomWallFootprint(record, records) {
  if (typeof wallFaceGeometry === 'function') {
    const geometry = wallFaceGeometry(record, records), { faces } = geometry;
    return geometry.polygon || [faces[0].points[0], faces[0].points[1], faces[1].points[1], faces[1].points[0]];
  }
  const [a, b] = record.points, length = Math.hypot(b.x - a.x, b.y - a.y);
  const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length, half = record.thickness / 2;
  return [{ x: a.x - dy * half, y: a.y + dx * half }, { x: b.x - dy * half, y: b.y + dx * half },
    { x: b.x + dy * half, y: b.y - dx * half }, { x: a.x + dy * half, y: a.y - dx * half }];
}

// Integrate the room minus the union of solid polygons. Every vertex and edge
// intersection divides the shape into vertical slabs. Within each slab the
// union's boundaries are linear, so two interior samples integrate it exactly.
// This handles concave 45/90 degree walls and overlapping branches without
// counting the same wall intersection twice or depending on fragile insets.
function roomUsableArea(polygon, solidPolygons) {
  const minX = Math.min(...polygon.map(p => p.x)), maxX = Math.max(...polygon.map(p => p.x));
  const minY = Math.min(...polygon.map(p => p.y)), maxY = Math.max(...polygon.map(p => p.y));
  const solids = solidPolygons.filter(points => points.length >= 3 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
    Math.max(...points.map(p => p.x)) > minX && Math.min(...points.map(p => p.x)) < maxX &&
    Math.max(...points.map(p => p.y)) > minY && Math.min(...points.map(p => p.y)) < maxY);
  const polygons = [polygon, ...solids], cuts = [minX, maxX], segments = [];
  polygons.forEach(points => points.forEach((a, i) => {
    if (a.x > minX && a.x < maxX) cuts.push(a.x);
    const b = points[(i + 1) % points.length];
    segments.push({ a, b, dx: b.x - a.x, dy: b.y - a.y });
  }));
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i], b = segments[j], determinant = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(determinant) < 0.0000001) continue;
    const dx = b.a.x - a.a.x, dy = b.a.y - a.a.y;
    const t = (dx * b.dy - dy * b.dx) / determinant, u = (dx * a.dy - dy * a.dx) / determinant;
    if (t <= 0 || t >= 1 || u <= 0 || u >= 1) continue;
    const x = a.a.x + t * a.dx;
    if (x > minX && x < maxX) cuts.push(x);
  }
  cuts.sort((a, b) => a - b);
  const xs = cuts.filter((x, i) => i === 0 || x - cuts[i - 1] > 0.0000001);
  const intervals = (points, x) => {
    const ys = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) ys.push(a.y + (x - a.x) * (b.y - a.y) / (b.x - a.x));
    });
    ys.sort((a, b) => a - b);
    const spans = [];
    for (let i = 0; i + 1 < ys.length; i += 2) spans.push([ys[i], ys[i + 1]]);
    return spans;
  };
  const usableLength = x => {
    const floor = intervals(polygon, x), occupied = solids.flatMap(points => intervals(points, x)).sort((a, b) => a[0] - b[0]);
    const union = [];
    occupied.forEach(span => {
      const last = union[union.length - 1];
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else union.push([...span]);
    });
    return floor.reduce((sum, span) => sum + span[1] - span[0] - union.reduce((overlap, block) =>
      overlap + Math.max(0, Math.min(span[1], block[1]) - Math.max(span[0], block[0])), 0), 0);
  };
  let area = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const width = xs[i + 1] - xs[i];
    area += width * (usableLength(xs[i] + width / 4) + usableLength(xs[i] + width * 3 / 4)) / 2;
  }
  return Math.max(0, area / 10000);
}

function detectFloorplanRooms(records) {
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const segments = records.filter(record => record.points?.length === 2 && record.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
    Math.hypot(record.points[1].x - record.points[0].x, record.points[1].y - record.points[0].y) > ROOM_EPSILON).map((record, index) => ({
    ...record, id: String(record.wall?.data?.id ?? record.wall ?? index), cuts: [0, 1],
    thickness: Math.max(0.01, Number(record.thickness) || 15)
  }));
  const project = (point, segment) => {
    const [a, b] = segment.points, dx = b.x - a.x, dy = b.y - a.y;
    return ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
  };
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const first = segments[i], second = segments[j], [a, b] = first.points, [c, d] = second.points;
    const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: d.x - c.x, y: d.y - c.y };
    const delta = { x: c.x - a.x, y: c.y - a.y }, denominator = cross(u, v);
    if (Math.abs(denominator) < 0.000001) {
      if (Math.abs(cross(delta, u)) > ROOM_EPSILON * Math.hypot(u.x, u.y)) continue;
      for (const p of second.points) { const t = project(p, first); if (t > 0 && t < 1) first.cuts.push(t); }
      for (const p of first.points) { const t = project(p, second); if (t > 0 && t < 1) second.cuts.push(t); }
    } else {
      const t = cross(delta, v) / denominator, s = cross(delta, u) / denominator;
      if (t >= -0.000001 && t <= 1.000001 && s >= -0.000001 && s <= 1.000001) {
        first.cuts.push(Math.max(0, Math.min(1, t))); second.cuts.push(Math.max(0, Math.min(1, s)));
      }
    }
  }
  const nodes = new Map(), edges = new Map();
  const getNode = point => {
    const key = `${Math.round(point.x / ROOM_EPSILON)},${Math.round(point.y / ROOM_EPSILON)}`;
    if (!nodes.has(key)) nodes.set(key, { key, point, links: [] });
    return nodes.get(key);
  };
  segments.forEach(segment => {
    const [a, b] = segment.points, cuts = [...new Set(segment.cuts)].sort((x, y) => x - y);
    const at = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = getNode(at(cuts[i])), end = getNode(at(cuts[i + 1]));
      if (start === end) continue;
      const key = [start.key, end.key].sort().join('|');
      if (edges.has(key)) { edges.get(key).thickness = Math.max(edges.get(key).thickness, segment.thickness); continue; }
      const edge = { start, end, id: segment.id, thickness: segment.thickness, removed: false };
      edges.set(key, edge); start.links.push(edge); end.links.push(edge);
    }
  });
  // Remove dangling branches before walking faces. An unfinished partition is
  // still part of one room, even when its free endpoint is inside that room.
  const queue = [...nodes.values()].filter(node => node.links.length === 1);
  while (queue.length) {
    const node = queue.pop(), active = node.links.filter(edge => !edge.removed);
    if (active.length !== 1) continue;
    const edge = active[0]; edge.removed = true;
    const neighbor = edge.start === node ? edge.end : edge.start;
    if (neighbor.links.filter(link => !link.removed).length === 1) queue.push(neighbor);
  }
  const halves = [];
  edges.forEach(edge => {
    if (edge.removed) return;
    const first = { from: edge.start, to: edge.end, edge }, second = { from: edge.end, to: edge.start, edge };
    first.twin = second; second.twin = first; halves.push(first, second);
  });
  nodes.forEach(node => { node.outgoing = []; });
  halves.forEach(half => {
    half.angle = Math.atan2(half.to.point.y - half.from.point.y, half.to.point.x - half.from.point.x);
    half.from.outgoing.push(half);
  });
  nodes.forEach(node => node.outgoing.sort((a, b) => a.angle - b.angle));
  const faces = [];
  halves.forEach(start => {
    if (start.visited) return;
    const boundary = [];
    let current = start;
    do {
      if (current.visited) return;
      current.visited = true; boundary.push(current);
      const links = current.to.outgoing, incoming = links.indexOf(current.twin);
      current = links[(incoming + links.length - 1) % links.length];
    } while (current !== start && boundary.length <= halves.length);
    const points = boundary.map(half => half.from.point), area = roomArea(points);
    if (boundary.length < 3 || area < 1 || current !== start) return;
    const roomEdges = boundary.map(half => half.edge);
    const innerPolygon = roomInnerPolygon(points, roomEdges);
    const boundaryIds = [...new Set(roomEdges.map(edge => edge.id))].sort();
    const labelPoint = roomLabelPoint(innerPolygon || points);
    const boundarySides = boundary.map(half => {
      const original = segments.find(segment => segment.id === half.edge.id);
      const [a, b] = original.points;
      return { id: half.edge.id, side: Math.sign((b.x - a.x) * (half.to.point.x - half.from.point.x) +
        (b.y - a.y) * (half.to.point.y - half.from.point.y)) };
    });
    faces.push({ polygon: points, innerPolygon, outerPolygon: roomInnerPolygon(points, roomEdges, -1),
      labelPoint, boundaryIds, boundarySides, boundaryKey: boundaryIds.join('|'), centerlineArea: area / 10000 });
  });
  // A separate enclosed room can sit wholly inside another wall loop. Its
  // enclosure is a hole in the surrounding room. Deduct its outer wall faces
  // from the surrounding room's floor, and keep the names out of the holes.
  const footprints = segments.map(record => roomWallFootprint(record, segments));
  faces.forEach(face => {
    const contained = faces.filter(other => other !== face && other.polygon.every(point =>
      roomPointInside(point, face.polygon) && roomBoundaryDistance(point, face.polygon) > ROOM_EPSILON));
    const children = contained.filter(child => !contained.some(middle => middle !== child &&
      child.polygon.every(point => roomPointInside(point, middle.polygon))));
    face.holes = children.map(child => child.outerPolygon || child.polygon);
    face.holeBoundaryIds = [...new Set(children.flatMap(child => child.boundaryIds))];
    face.area = roomUsableArea(face.polygon, [...footprints, ...children.map(child => child.polygon)]);
    face.labelPoint = roomLabelPoint(face.innerPolygon || face.polygon, [...face.holes, ...footprints]);
  });
  return faces.sort((a, b) => a.labelPoint.y - b.labelPoint.y || a.labelPoint.x - b.labelPoint.x);
}

function classifyFloorplanWalls(records, faces = detectFloorplanRooms(records)) {
  const classes = new Map();
  records.forEach((record, index) => {
    const id = String(record.wall?.data?.id ?? record.wall ?? index), sides = new Set();
    faces.forEach(face => (face.boundarySides || []).filter(boundary => boundary.id === id).forEach(boundary => sides.add(boundary.side)));
    const insideEnclosure = faces.some(face => face.holeBoundaryIds?.includes(id));
    const midpoint = { x: (record.points[0].x + record.points[1].x) / 2, y: (record.points[0].y + record.points[1].y) / 2 };
    const interiorBranch = !sides.size && faces.some(face => roomPointInside(midpoint, face.polygon) &&
      !face.holes.some(hole => roomPointInside(midpoint, hole)));
    classes.set(record.wall, sides.size > 1 || insideEnclosure || interiorBranch ? 'inner' : 'outer');
  });
  return classes;
}

function roomDisplayText(face, name) {
  return face.area === null ? name : `${name}\n${face.area.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`;
}
function floorplanRoomLabelOffset(label) {
  const offset=label.data?.labelOffset;
  return {x:Number.isFinite(offset?.x)?offset.x:0,y:Number.isFinite(offset?.y)?offset.y:0};
}

function refreshFloorplanRooms(force = false) {
  if (typeof canvas === 'undefined' || !canvas || floorplanRoomsUpdating) return [];
  const records = wallRecords();
  const fingerprint = records.map(record => `${record.wall.data?.id || ''}:${record.points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(';')}:${record.thickness}`).sort().join('/');
  const existing = canvas.getObjects().filter(object => object.data?.kind === 'room');
  if (!force && fingerprint === floorplanRoomFingerprint && existing.length === floorplanRoomFaces.length &&
    floorplanRoomFaces.every(face => existing.includes(face.label))) return floorplanRoomFaces;
  const faces = detectFloorplanRooms(records), unused = new Set(existing);
  const exactMatches = new Map();
  faces.forEach(face => {
    const label = existing.find(object => unused.has(object) && object.data.boundaryKey === face.boundaryKey);
    if (label) { exactMatches.set(face, label); unused.delete(label); }
  });
  let nextNumber = existing.reduce((max, label) => Math.max(max, Number(label.data.roomNumber) || Number(/^Room (\d+)$/.exec(label.data.name)?.[1]) || 0), 0);
  const wasDirty = typeof isDirty !== 'undefined' && isDirty;
  floorplanRoomsUpdating = true;
  try {
    faces.forEach(face => {
      let label = exactMatches.get(face);
      if (!label) {
        // Geometry and wall IDs can change on split/merge. Retain the closest
        // room name that shares boundaries, giving containment first priority.
        const candidates = [...unused].map(object => {
          const offset=floorplanRoomLabelOffset(object),anchor={x:object.left-offset.x,y:object.top-offset.y};
          return {object,overlap:(object.data.boundaryIds||[]).filter(id=>face.boundaryIds.includes(id)).length,
            inside:roomPointInside(anchor,face.polygon),distance:Math.hypot(anchor.x-face.labelPoint.x,anchor.y-face.labelPoint.y)};
        }).filter(candidate => candidate.overlap > 0 || candidate.inside);
        candidates.sort((a, b) => Number(b.inside) - Number(a.inside) || b.overlap - a.overlap || a.distance - b.distance);
        label = candidates[0]?.object;
      }
      if (label) unused.delete(label);
      else {
        const roomNumber = ++nextNumber;
        label = new fabric.Text('', { originX: 'center', originY: 'center', fontFamily: 'Arial, sans-serif',
          fontSize: 18, fontWeight: '500', lineHeight: 1.35, textAlign: 'center', fill: typeof floorplanColors === 'function' ? floorplanColors().text : '#34404a',
          selectable: false, evented: false, hasControls: false, hasBorders: false, objectCaching: false,
          data: { kind: 'room', name: `Room ${roomNumber}`, roomNumber,
            roomId: `room-${Date.now().toString(36)}-${++floorplanRoomSequence}` } });
        canvas.add(label);
      }
      const name = String(label.data.name || 'Room').slice(0, 80);
      const labelOffset=floorplanRoomLabelOffset(label);
      label.set({ left: face.labelPoint.x+labelOffset.x, top: face.labelPoint.y+labelOffset.y, text: roomDisplayText(face, name), fontSize: 18,
        fill: typeof floorplanColors === 'function' ? floorplanColors().text : '#34404a',
        selectable: false, evented: false,
        data: { ...label.data, kind: 'room', name, labelOffset, boundaryKey: face.boundaryKey, boundaryIds: face.boundaryIds } });
      label.setCoords(); face.label = label;
    });
    unused.forEach(label => canvas.remove(label));
    floorplanRoomFaces = faces; floorplanRoomFingerprint = fingerprint;
    renderFloorplanRoomControls();
  } finally {
    floorplanRoomsUpdating = false;
    if (typeof isDirty !== 'undefined') isDirty = wasDirty;
    if (typeof syncSaveButton === 'function') syncSaveButton();
  }
  canvas.requestRenderAll();
  return floorplanRoomFaces;
}

function renameFloorplanRoom(label, name) {
  const cleanName = String(name).trim().slice(0, 80);
  if (!cleanName || cleanName === label.data.name) return;
  if (typeof wallCheckpoint === 'function') wallCheckpoint();
  label.data = { ...label.data, name: cleanName };
  const face = floorplanRoomFaces.find(item => item.label === label);
  if (face) label.set('text', roomDisplayText(face, cleanName));
  if (typeof isDirty !== 'undefined') isDirty = true;
  if (typeof syncSaveButton === 'function') syncSaveButton();
  renderFloorplanRoomControls(); canvas.requestRenderAll();
}

function moveFloorplanRoomLabel(label,point,checkpoint=true) {
  const face=floorplanRoomFaces.find(item=>item.label===label);
  if(!face||!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||Math.hypot(point.x-label.left,point.y-label.top)<.00001)return false;
  if(checkpoint&&typeof wallCheckpoint==='function')wallCheckpoint();
  const labelOffset={x:point.x-face.labelPoint.x,y:point.y-face.labelPoint.y};
  label.set({left:point.x,top:point.y,data:{...label.data,labelOffset},selectable:false,evented:false});
  label.setCoords();
  if(typeof isDirty!=='undefined')isDirty=true;
  if(typeof syncSaveButton==='function')syncSaveButton();
  positionFloorplanRoomControls();canvas.requestRenderAll();return true;
}

function setupFloorplanRoomDragging(button,label) {
  button.addEventListener('pointerdown',event=>{
    event.stopPropagation();
    if(event.button!==0||floorplanRoomEditing||!['select','room'].includes(currentTool))return;
    floorplanRoomDrag={button,label,pointerId:event.pointerId,x:event.clientX,y:event.clientY,
      point:{x:label.left,y:label.top},origin:canvas.getPointer(event),changed:false};
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointermove',event=>{
    const state=floorplanRoomDrag;
    if(!state||state.button!==button||state.pointerId!==event.pointerId)return;
    event.stopPropagation();
    const dx=event.clientX-state.x,dy=event.clientY-state.y;
    if(!state.changed&&Math.hypot(dx,dy)<3)return;
    // Use the same CSS-scale-aware world coordinates as drawing and selection.
    // Retain the initial grab offset rather than centring the label on the mouse.
    const pointer=canvas.getPointer(event);
    const point={x:state.point.x+pointer.x-state.origin.x,y:state.point.y+pointer.y-state.origin.y};
    if(moveFloorplanRoomLabel(label,point,!state.changed)){
      state.changed=true;button.classList.add('is-dragging');
    }
    event.preventDefault();
  });
  const finish=event=>{
    const state=floorplanRoomDrag;
    if(!state||state.button!==button||state.pointerId!==event.pointerId)return;
    event.stopPropagation();floorplanRoomDrag=null;
    if(state.changed){button.dataset.suppressRenameUntil=String(Date.now()+300);event.preventDefault();}
    button.classList.remove('is-dragging');
    if(button.hasPointerCapture?.(event.pointerId))button.releasePointerCapture(event.pointerId);
  };
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>button.addEventListener(name,finish));
}

function editFloorplanRoomName(label) {
  if (!floorplanRoomUI || floorplanRoomEditing) return;
  const input = document.createElement('input');
  input.type = 'text'; input.maxLength = 80; input.value = label.data.name;
  input.className = 'fp-room-name-input'; input.setAttribute('aria-label', 'Room name');
  floorplanRoomUI.appendChild(input);
  floorplanRoomEditing = { input, label };
  const finish = commit => {
    if (floorplanRoomEditing?.input !== input) return;
    floorplanRoomEditing = null; input.remove();
    if (commit) renameFloorplanRoom(label, input.value);
  };
  input.addEventListener('pointerdown', event => event.stopPropagation());
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  positionFloorplanRoomControls(); input.focus(); input.select();
}

function renderFloorplanRoomControls() {
  if (!floorplanRoomUI) return;
  floorplanRoomUI.querySelectorAll('.fp-room-target').forEach(button => button.remove());
  const list = document.getElementById('roomsList');
  if (list) list.replaceChildren();
  floorplanRoomFaces.forEach(face => {
    const label = face.label, button = document.createElement('button');
    button.type = 'button'; button.className = 'fp-room-target'; button.dataset.roomId = label.data.roomId;
    button.title = `Drag to move ${label.data.name}. Double-click to rename.`; button.setAttribute('aria-label', `Move or rename ${label.data.name}`);
    setupFloorplanRoomDragging(button,label);
    button.addEventListener('click', event => event.stopPropagation());
    button.addEventListener('dblclick', event => { event.stopPropagation();if(Date.now()>=Number(button.dataset.suppressRenameUntil||0))editFloorplanRoomName(label); });
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); event.stopPropagation(); editFloorplanRoomName(label); }
    });
    floorplanRoomUI.appendChild(button);
    if (list) {
      const entry = document.createElement('button'), name = document.createElement('span'), area = document.createElement('small');
      entry.type = 'button'; entry.className = 'fp-room-list-item'; entry.title = 'Double-click to rename room';
      name.textContent = label.data.name;
      area.textContent = face.area === null ? '' : `${face.area.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`;
      entry.append(name, area); entry.addEventListener('dblclick', () => editFloorplanRoomName(label));
      entry.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); event.stopPropagation(); editFloorplanRoomName(label); }
      });
      list.appendChild(entry);
    }
  });
  if (list && !floorplanRoomFaces.length) {
    const hint = document.createElement('p'); hint.className = 'fp-hint';
    hint.textContent = 'Close a wall loop to create a room automatically.'; list.appendChild(hint);
  }
  positionFloorplanRoomControls();
}

function positionFloorplanRoomControls(renderEvent) {
  if (!floorplanRoomUI || !canvas) return;
  if (renderEvent?.ctx && renderEvent.ctx !== canvas.contextContainer) return;
  floorplanRoomUI.querySelectorAll('.fp-room-target').forEach(button => {
    const label = floorplanRoomFaces.find(face => face.label.data.roomId === button.dataset.roomId)?.label;
    if (!label) return;
    const nameBounds=floorplanRoomNameBounds(label);
    button.style.left = `${nameBounds.x}px`;
    button.style.top = `${nameBounds.y}px`;
    button.style.width = `${Math.max(24,nameBounds.width+10)}px`;
    button.style.height = `${nameBounds.height+6}px`;
    button.style.pointerEvents = currentTool === 'select' || currentTool === 'room' ? 'auto' : 'none';
    button.tabIndex = currentTool === 'select' || currentTool === 'room' ? 0 : -1;
  });
  if (floorplanRoomEditing) {
    const { input, label } = floorplanRoomEditing;
    const nameBounds=floorplanRoomNameBounds(label);
    input.style.left = `${nameBounds.x}px`;
    input.style.top = `${nameBounds.y}px`;
    input.style.width = `${Math.min(300, Math.max(100,nameBounds.width+18))}px`;
  }
}

function floorplanRoomNameBounds(label) {
  const vpt=canvas.viewportTransform,zoom=canvas.getZoom();
  const scaleX=(label.scaleX||1)*zoom,scaleY=(label.scaleY||1)*zoom;
  const lineHeight=typeof label.getHeightOfLine==='function'?label.getHeightOfLine(0)/(label.lineHeight||1):label.fontSize*1.13;
  const width=typeof label.getLineWidth==='function'?label.getLineWidth(0):String(label.data.name).length*label.fontSize*.6;
  return {x:label.left*vpt[0]+label.top*vpt[2]+vpt[4],
    y:label.left*vpt[1]+label.top*vpt[3]+vpt[5]+(-label.height/2+lineHeight/2)*scaleY,
    width:width*scaleX,height:lineHeight*scaleY};
}

function resetFloorplanRooms() {
  floorplanRoomDrag=null;
  floorplanRoomEditing?.input.remove(); floorplanRoomEditing = null;
  floorplanRoomFingerprint = ''; floorplanRoomFaces = [];
  renderFloorplanRoomControls();
}

function scaleFloorplanRoomLabels(renderEvent) {
  // Fabric temporarily multiplies its viewport for thumbnails/PNG exports.
  // Keep the existing world scale there, so labels scale with the output image
  // rather than becoming 18px at every export resolution.
  if (renderEvent?.ctx && renderEvent.ctx !== canvas.contextContainer) return;
  const scale = 1 / Math.max(0.01, canvas.getZoom());
  canvas.getObjects().filter(object => object.data?.kind === 'room').forEach(label => label.set({ scaleX: scale, scaleY: scale }));
}

function setupFloorplanRooms() {
  if (floorplanRoomUI) return;
  floorplanRoomUI = document.createElement('div'); floorplanRoomUI.className = 'fp-room-ui';
  document.getElementById('canvasWrapper').appendChild(floorplanRoomUI);
  canvas.on('before:render', scaleFloorplanRoomLabels);
  canvas.on('after:render', positionFloorplanRoomControls);
  refreshFloorplanRooms(true);
}

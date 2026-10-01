// Hosted openings use centimetres along a wall's centreline. Their lengths never resize walls.
let openingDraft = null, openingHover = null, openingLengthEditor, openingLengthInput;
let openingLengthCaption, openingDimensionUI, openingLastError = '';
let openingEditObject = null;
let openingEditAnchor = null;
let openingTransformState = null;

function isFloorplanOpening(object) {
  return object?.data?.kind === 'window' || object?.data?.kind === 'door';
}

function openingWallId(wall) {
  if (!wall.data) wall.data = { kind: 'wall' };
  if (!wall.data.id) wall.data.id = 'wall-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  return wall.data.id;
}

function openingHost(object) {
  return canvas.getObjects().find(wall => wall.data?.kind === 'wall' && wall.data.id === object.data.hostWallId);
}

function openingBasis(points) {
  const [a, b] = points;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.001) return null;
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  return { a, b, length, u, n: { x: -u.y, y: u.x }, angle: Math.atan2(u.y, u.x) * 180 / Math.PI };
}

function openingPoint(basis, offset) {
  return { x: basis.a.x + basis.u.x * offset, y: basis.a.y + basis.u.y * offset };
}

function openingProject(point, points, step = 0) {
  const basis = openingBasis(points);
  if (!basis) return null;
  let offset = (point.x - basis.a.x) * basis.u.x + (point.y - basis.a.y) * basis.u.y;
  if (step > 0) {
    // Snap the dominant world coordinate, including on 45-degree walls.
    const axis = Math.abs(basis.u.x) >= Math.abs(basis.u.y) ? 'x' : 'y';
    const coordinate = basis.a[axis] + basis.u[axis] * offset;
    offset = (Math.round(coordinate / step) * step - basis.a[axis]) / basis.u[axis];
  }
  offset = Math.max(0, Math.min(basis.length, offset));
  return { offset, point: openingPoint(basis, offset), basis };
}

function openingDataError(data, hostLength, others = [], branches = []) {
  const measurement = data.kind === 'door' ? 'width' : 'length';
  if (!Number.isFinite(data.length) || data.length < 1 || data.length > 100000) return `Enter an opening ${measurement} of at least ${floorplanFormatLength(1)} ${floorplanUnitLabel()}.`;
  if (!Number.isFinite(data.depth) || data.depth < 1 || data.depth > 100) return `Enter a frame depth between ${floorplanFormatLength(1)} and ${floorplanFormatLength(100)} ${floorplanUnitLabel()}.`;
  if (!data.hostWallId) return [data.x, data.y, data.angle].every(Number.isFinite) ? '' : 'Enter a valid opening position and angle.';
  if (!Number.isFinite(data.offset) || data.offset < -0.001 || data.offset + data.length > hostLength + 0.001) return `The opening must fit inside its wall. Reduce its ${measurement} or move its starting point.`;
  if (others.some(other => data.offset < other.offset + other.length - 0.001 && data.offset + data.length > other.offset + 0.001)) return 'This position overlaps another door or window.';
  if (branches.some(branch => {
    const start = typeof branch === 'number' ? branch : branch.start;
    const end = typeof branch === 'number' ? branch : branch.end;
    return data.offset < end - 0.001 && data.offset + data.length > start + 0.001;
  })) return 'An opening cannot cross a connecting wall. Allow for its thickness and place the opening beside the junction.';
  const overlaps = (a, b) => a.start < b.end - 0.001 && a.end > b.start + 0.001;
  const cut = { start: data.offset, end: data.offset + data.length };
  const otherPockets = others.map(openingPocketRange).filter(Boolean);
  if (otherPockets.some(pocket => overlaps(cut, pocket))) return 'This position overlaps a sliding door wall pocket.';
  const pocket = openingPocketRange(data);
  if (pocket) {
    if (pocket.start < -0.001 || pocket.end > hostLength + 0.001) return 'The sliding door pocket extends past its wall. Choose the other direction or mount the door on Side A or Side B.';
    if (others.some(other => overlaps(pocket, { start: other.offset, end: other.offset + other.length })) || otherPockets.some(other => overlaps(pocket, other))) return 'The sliding door pocket overlaps another door or window. Choose the other direction or a side-mounted door.';
    if (branches.some(branch => overlaps(pocket, typeof branch === 'number' ? { start: branch, end: branch } : branch))) return 'The sliding door pocket crosses a connecting wall. Choose the other direction or a side-mounted door.';
  }
  return '';
}

function openingPocketRange(data) {
  if (!data.hostWallId || data.kind !== 'door' || floorplanDoorType(data) !== 'sliding' || openingSlidingPosition(data) !== 'pocket') return null;
  return data.hinge === 'end' ? { start: data.offset + data.length, end: data.offset + data.length * 2 } :
    { start: data.offset - data.length, end: data.offset };
}

function standaloneOpeningBasis(data) {
  const angle = (Number(data.angle) || 0) * Math.PI / 180;
  const half = data.length / 2, ux = Math.cos(angle), uy = Math.sin(angle);
  return openingBasis([{ x: data.x - ux * half, y: data.y - uy * half }, { x: data.x + ux * half, y: data.y + uy * half }]);
}

function openingObjectBasis(object) {
  const host = openingHost(object);
  return host ? openingBasis(wallEndpoints(host)) : !object.data.hostWallId ? standaloneOpeningBasis(object.data) : null;
}

function openingSnapPoint(point, start = null, shift = false) {
  const step = snapEnabled ? (typeof getSnapInterval === 'function' ? getSnapInterval() : 10) : 0;
  let next = step ? { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step } : { ...point };
  if (start && (shift || typeof angleSnapEnabled === 'undefined' || angleSnapEnabled)) {
    const dx = next.x - start.x, dy = next.y - start.y, increment = shift ? Math.PI / 2 : Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / increment) * increment;
    const distance = Math.hypot(dx, dy);
    next = { x: start.x + Math.cos(angle) * distance, y: start.y + Math.sin(angle) * distance };
    if (step) {
      const u = { x: Math.cos(angle), y: Math.sin(angle) }, axis = Math.abs(u.x) >= Math.abs(u.y) ? 'x' : 'y';
      const along = (Math.round(next[axis] / step) * step - start[axis]) / u[axis];
      next = { x: start.x + u.x * along, y: start.y + u.y * along };
    }
  }
  return next;
}

function openingBranches(host, records) {
  const basis = openingBasis(host.points);
  if (!basis) return [];
  return records.filter(record => record.wall !== host.wall).flatMap(record => record.points.flatMap((point, index) => {
    const projected = wallProjection(point, host.points);
    if (projected.t <= 0.00001 || projected.t >= 0.99999 || wallDistance(point, projected.point) >= 0.001) return [];
    const other = record.points[1 - index], size = wallDistance(point, other);
    if (size < 0.001) return [];
    const v = { x: (other.x - point.x) / size, y: (other.y - point.y) / size };
    const crossing = Math.abs(basis.u.x * v.y - basis.u.y * v.x);
    if (crossing < 0.00001) return [];
    // Reserve the branch's full footprint where its faces meet the host face.
    const offset = projected.t * basis.length;
    const shift = host.thickness / 2 * (basis.u.x * v.x + basis.u.y * v.y) / crossing;
    const half = record.thickness / (2 * crossing);
    return [{ start: offset + shift - half, end: offset + shift + half }];
  }));
}

function validateFloorplanOpenings(records = wallRecords(), updatedObject = null, updatedData = null) {
  openingLastError = '';
  const openings = canvas.getObjects().filter(isFloorplanOpening);
  for (const object of openings) {
    const data = object === updatedObject ? updatedData : object.data;
    if (!data.hostWallId) {
      openingLastError = openingDataError(data);
      if (openingLastError) return false;
      continue;
    }
    const host = records.find(record => record.wall.data?.id === data.hostWallId);
    if (!host) { openingLastError = 'This change would detach a door or window from its wall.'; return false; }
    const basis = openingBasis(host.points);
    const others = openings.filter(other => other !== object).map(other => other === updatedObject ? updatedData : other.data).filter(other => other.hostWallId === data.hostWallId);
    openingLastError = openingDataError({ ...data, depth: host.thickness }, basis?.length || 0, others, openingBranches(host, records));
    if (openingLastError) return false;
  }
  return true;
}

function floorplanDoorType(data) {
  return ['single', 'double', 'garage', 'sliding', 'opening'].includes(data.doorType) ? data.doorType : 'single';
}

function automaticFloorplanDoorType(width) {
  return width >= 190 ? 'garage' : width > 100 ? 'double' : 'single';
}

function openingInwardSide(data, host) {
  if (!host || typeof floorplanRoomFaces === 'undefined' || typeof roomPointInside !== 'function') return 1;
  const basis = openingBasis(wallEndpoints(host));
  if (!basis) return 1;
  const centre = openingPoint(basis, data.offset + data.length / 2), offset = host.strokeWidth / 2 + 1;
  const inside = side => {
    const point = { x: centre.x + basis.n.x * offset * side, y: centre.y + basis.n.y * offset * side };
    return floorplanRoomFaces.some(face => roomPointInside(point, face.polygon) &&
      !(face.holes || []).some(hole => roomPointInside(point, hole)));
  };
  const positive = inside(1), negative = inside(-1);
  // An unfinished outline (or a freestanding door) has no defined interior yet.
  return positive !== negative ? (positive ? 1 : -1) : 1;
}

function floorplanDoorInwardSide(opening) {
  return openingInwardSide(opening.data, openingHost(opening));
}

function openingResolvedData(data, host) {
  return data.kind === 'door' && floorplanDoorType(data) === 'garage'
    ? { ...data, swing: openingInwardSide(data, host) } : data;
}

function updateOpeningDraftSwing(point) {
  if (!openingDraft) return;
  openingDraft.pointer = { ...point };
  if (openingDraft.kind !== 'door') return;
  const basis = openingDraft.wall ? openingBasis(wallEndpoints(openingDraft.wall)) : openingBasis(openingDraftPoints());
  if (!basis) return;
  const distance = (point.x - basis.a.x) * basis.n.x + (point.y - basis.a.y) * basis.n.y;
  // A small dead zone stops the preview flickering while following the centreline.
  if (Math.abs(distance) > 2 / canvas.getZoom()) openingDraft.swing = distance < 0 ? -1 : 1;
}

function openingMeasurementName(data) {
  return data.kind === 'door' ? 'width' : 'length';
}

function openingSlidingPosition(data) {
  return ['pocket', 'side-a', 'side-b'].includes(data.slidingPosition) ? data.slidingPosition : 'pocket';
}

function openingTypeName(data) {
  if (data.kind === 'window') return 'Window';
  return { single: 'Door', double: 'Double door', garage: 'Garage door', sliding: 'Sliding door', opening: 'Open passage' }[floorplanDoorType(data)];
}

function openingSwingExtent(data) {
  if (data.kind !== 'door') return 0;
  const type = floorplanDoorType(data);
  if (type === 'opening') return 0;
  if (type === 'sliding') return openingSlidingPosition(data) === 'pocket' ? 0 : 10;
  if (type === 'garage') return Math.min(45, Math.max(15, data.length * 0.15));
  return type === 'double' ? data.length / 2 : data.length;
}

function openingDoorLeaves(data, hostThickness) {
  if (data.kind !== 'door') return [];
  const type = floorplanDoorType(data);
  if (['garage', 'opening', 'sliding'].includes(type)) return [];
  const hinges = type === 'double' ? ['start', 'end'] : [data.hinge === 'end' ? 'end' : 'start'];
  const swing = data.swing === -1 ? -1 : 1;
  const radius = type === 'double' ? data.length / 2 : data.length;
  return hinges.map(hinge => ({
    x: (hinge === 'start' ? -1 : 1) * data.length / 2, y: swing * hostThickness / 2,
    radius, swing, thickness: Math.max(1, Math.min(3, data.depth / 5)),
    startAngle: hinge === 'start' ? 0 : Math.PI, endAngle: swing * Math.PI / 2,
    anticlockwise: hinge === 'start' ? swing < 0 : swing > 0,
    closedX: type === 'double' ? 0 : (hinge === 'start' ? 1 : -1) * data.length / 2
  }));
}

function openingSlidingGeometry(data, hostThickness) {
  const position = openingSlidingPosition(data), direction = data.hinge === 'end' ? 1 : -1;
  const thickness = Math.max(2, Math.min(4, data.depth / 5));
  const y = position === 'pocket' ? 0 : (position === 'side-a' ? -1 : 1) * (hostThickness / 2 + 6);
  const x = direction === 1 ? data.length / 2 : -data.length * 1.5;
  return { x, y, thickness, direction, pocket: position === 'pocket',
    arrowStart: -direction * data.length * 0.3, arrowEnd: direction * data.length * 0.3 };
}

function openingPlacementError(data, ignored = null) {
  if (!data.hostWallId) return openingDataError(data);
  const records = wallRecords();
  const host = records.find(record => record.wall.data?.id === data.hostWallId);
  if (!host) return 'Choose an existing wall for the opening.';
  const others = canvas.getObjects().filter(object => isFloorplanOpening(object) && object !== ignored && object.data.hostWallId === data.hostWallId).map(object => object.data);
  return openingDataError(data, openingBasis(host.points)?.length || 0, others, openingBranches(host, records));
}

function renderOpeningSymbol(ctx, data, hostThickness, color) {
  const length = data.length, depth = data.depth;
  const palette = typeof floorplanColors === 'function' ? floorplanColors() : { background: '#ffffff', outline: '#253038' };
  // An opaque cut hides the host's fill and its two outlines without changing its geometry.
  ctx.fillStyle = palette.background;
  ctx.fillRect(-length / 2, -hostThickness / 2 - 0.7, length, hostThickness + 1.4);
  ctx.strokeStyle = color || palette.outline;
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(-length / 2, -hostThickness / 2); ctx.lineTo(-length / 2, hostThickness / 2);
  ctx.moveTo(length / 2, -hostThickness / 2); ctx.lineTo(length / 2, hostThickness / 2);
  ctx.stroke();
  if (data.kind === 'window') {
    ctx.strokeRect(-length / 2 + 1, -depth / 2, Math.max(0.1, length - 2), depth);
    const pane = Math.min(depth / 4, 2);
    ctx.beginPath();
    ctx.moveTo(-length / 2 + 1, -pane); ctx.lineTo(length / 2 - 1, -pane);
    ctx.moveTo(-length / 2 + 1, pane); ctx.lineTo(length / 2 - 1, pane);
    ctx.stroke();
  } else if (floorplanDoorType(data) === 'sliding') {
    const slider = openingSlidingGeometry(data, hostThickness);
    ctx.save();
    if (slider.pocket) ctx.setLineDash([5, 4]);
    else { ctx.fillStyle = palette.background; ctx.fillRect(slider.x, slider.y - slider.thickness / 2, length, slider.thickness); }
    ctx.strokeRect(slider.x, slider.y - slider.thickness / 2, length, slider.thickness);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(slider.arrowStart, slider.y); ctx.lineTo(slider.arrowEnd, slider.y);
    ctx.moveTo(slider.arrowEnd - slider.direction * 6, slider.y - 4); ctx.lineTo(slider.arrowEnd, slider.y);
    ctx.lineTo(slider.arrowEnd - slider.direction * 6, slider.y + 4);
    ctx.stroke();
  } else if (floorplanDoorType(data) === 'garage') {
    const swing = data.swing === -1 ? -1 : 1;
    const track = openingSwingExtent(data), y = swing * hostThickness / 2;
    // The segmented panel stays in the wall opening; only its two tracks extend out.
    ctx.strokeRect(-length / 2 + 1, -depth / 2, Math.max(0.1, length - 2), depth);
    ctx.beginPath();
    for (let x = -length / 2 + 25; x < length / 2 - 1; x += 25) {
      ctx.moveTo(x, -depth / 2); ctx.lineTo(x, depth / 2);
    }
    for (const x of [-length / 2, length / 2]) {
      ctx.moveTo(x, y); ctx.lineTo(x, y + swing * track);
      ctx.moveTo(x + (x < 0 ? 2 : -2), y); ctx.lineTo(x + (x < 0 ? 2 : -2), y + swing * track);
    }
    ctx.stroke();
  } else for (const leaf of openingDoorLeaves(data, hostThickness)) {
    // Swing sectors stay transparent. Only the narrow leaf itself is filled.
    ctx.fillStyle = palette.background;
    ctx.fillRect(leaf.x - leaf.thickness / 2, leaf.y + Math.min(0, leaf.swing * leaf.radius), leaf.thickness, leaf.radius);
    ctx.strokeRect(leaf.x - leaf.thickness / 2, leaf.y + Math.min(0, leaf.swing * leaf.radius), leaf.thickness, leaf.radius);
    ctx.beginPath();
    ctx.arc(leaf.x, leaf.y, leaf.radius, leaf.startAngle, leaf.endAngle, leaf.anticlockwise);
    ctx.stroke();
  }
}

function openingSvgSymbol(data, hostThickness) {
  const length = data.length, depth = data.depth;
  const palette = typeof floorplanColors === 'function' ? floorplanColors() : { background: '#ffffff', outline: '#253038' };
  let markup = `<g fill="none" stroke="${palette.outline}" stroke-width="1"><rect x="${-length / 2}" y="${-hostThickness / 2 - 0.7}" width="${length}" height="${hostThickness + 1.4}" fill="${palette.background}" stroke="none"/><path d="M ${-length / 2} ${-hostThickness / 2} v ${hostThickness} M ${length / 2} ${-hostThickness / 2} v ${hostThickness}"/>`;
  if (data.kind === 'window') {
    const pane = Math.min(depth / 4, 2);
    markup += `<rect x="${-length / 2 + 1}" y="${-depth / 2}" width="${Math.max(0.1, length - 2)}" height="${depth}"/><path d="M ${-length / 2 + 1} ${-pane} h ${length - 2} M ${-length / 2 + 1} ${pane} h ${length - 2}"/>`;
  } else if (floorplanDoorType(data) === 'sliding') {
    const slider = openingSlidingGeometry(data, hostThickness);
    markup += `<rect x="${slider.x}" y="${slider.y - slider.thickness / 2}" width="${length}" height="${slider.thickness}" ${slider.pocket ? 'stroke-dasharray="5 4"' : 'fill="white"'}/><path d="M ${slider.arrowStart} ${slider.y} H ${slider.arrowEnd} M ${slider.arrowEnd - slider.direction * 6} ${slider.y - 4} L ${slider.arrowEnd} ${slider.y} L ${slider.arrowEnd - slider.direction * 6} ${slider.y + 4}"/>`;
  } else if (floorplanDoorType(data) === 'garage') {
    const swing = data.swing === -1 ? -1 : 1, y = swing * hostThickness / 2;
    const track = openingSwingExtent(data);
    markup += `<rect x="${-length / 2 + 1}" y="${-depth / 2}" width="${Math.max(0.1, length - 2)}" height="${depth}"/><path d="`;
    for (let x = -length / 2 + 25; x < length / 2 - 1; x += 25) markup += `M ${x} ${-depth / 2} v ${depth} `;
    for (const x of [-length / 2, length / 2]) markup += `M ${x} ${y} v ${swing * track} M ${x + (x < 0 ? 2 : -2)} ${y} v ${swing * track} `;
    markup += '"/>';
  } else for (const leaf of openingDoorLeaves(data, hostThickness)) {
    markup += `<rect x="${leaf.x - leaf.thickness / 2}" y="${leaf.y + Math.min(0, leaf.swing * leaf.radius)}" width="${leaf.thickness}" height="${leaf.radius}" fill="white"/><path d="M ${leaf.closedX} ${leaf.y} A ${leaf.radius} ${leaf.radius} 0 0 ${leaf.anticlockwise ? 0 : 1} ${leaf.x} ${leaf.y + leaf.swing * leaf.radius}"/>`;
  }
  return markup.replaceAll('fill="white"', `fill="${palette.background}"`) + '</g>';
}

function installOpeningRenderer(object) {
  if (!isFloorplanOpening(object)) return;
  const hosted = Boolean(object.data.hostWallId);
  if (object.data.kind === 'door') object.data.doorType = floorplanDoorType(object.data);
  object.set({ objectCaching: false, hasControls: !hosted, lockMovementX: hosted, lockMovementY: hosted,
    lockScalingX: true, lockScalingY: true, lockRotation: hosted, strokeWidth: 0,
    borderColor: typeof floorplanColors === 'function' ? floorplanColors().snap : '#008c85', transparentCorners: false });
  if (typeof object.setControlsVisibility === 'function') object.setControlsVisibility({ tl: false, tr: false, bl: false, br: false, mt: false, mb: false, ml: false, mr: false, mtr: !hosted });
  object._render = function(ctx) {
    const host = openingHost(this);
    if (!host && this.data.hostWallId) return;
    ctx.save();
    ctx.translate(-(this._openingShiftX || 0), -(this._openingShift || 0));
    renderOpeningSymbol(ctx, openingResolvedData(this.data, host), Number(host?.strokeWidth) || this.data.depth);
    ctx.restore();
  };
  object._toSVG = function() {
    const host = openingHost(this);
    return ['<g ', 'COMMON_PARTS', `><g transform="translate(${-(this._openingShiftX || 0)} ${-(this._openingShift || 0)})">${openingSvgSymbol(openingResolvedData(this.data, host), Number(host?.strokeWidth) || this.data.depth)}</g></g>`];
  };
}

function positionFloorplanOpening(object, host) {
  object.data = openingResolvedData(object.data, host);
  const basis = host ? openingBasis(wallEndpoints(host)) : standaloneOpeningBasis(object.data);
  if (!basis) return;
  const data = object.data, hostDepth = Number(host?.strokeWidth) || data.depth;
  const depth = Math.max(hostDepth, data.depth), swing = data.swing === -1 ? -1 : 1;
  const extent = openingSwingExtent(data);
  const sliding = data.kind === 'door' && floorplanDoorType(data) === 'sliding';
  const slidingSide = openingSlidingPosition(data) === 'side-a' ? -1 : 1;
  const shift = (sliding ? slidingSide : swing) * extent / 2;
  const shiftX = sliding ? (data.hinge === 'end' ? 1 : -1) * data.length / 2 : 0;
  const midpoint = openingPoint(basis, (host ? data.offset : 0) + data.length / 2);
  object._openingShift = shift;
  object._openingShiftX = shiftX;
  object.set({ left: midpoint.x + basis.n.x * shift + basis.u.x * shiftX, top: midpoint.y + basis.n.y * shift + basis.u.y * shiftX,
    width: data.length * (sliding ? 2 : 1) + 3, height: extent + depth + 3,
    originX: 'center', originY: 'center', angle: basis.angle, scaleX: 1, scaleY: 1 });
  object.setCoords();
  object.dirty = true;
}

function syncFloorplanOpenings() {
  const objects = canvas.getObjects().filter(isFloorplanOpening);
  objects.forEach(object => {
    const host = openingHost(object);
    if (!host && object.data.hostWallId) { canvas.remove(object); return; }
    if (host) object.data.depth = Number(host.strokeWidth) || 15;
    installOpeningRenderer(object);
    positionFloorplanOpening(object, host);
    // Newly drawn walls must remain below the openings they host.
    if (typeof object.bringToFront === 'function') object.bringToFront();
  });
  canvas.requestRenderAll();
}

function rehostFloorplanOpenings(fromWall, toWall, newPoints) {
  const targetId = openingWallId(toWall), fromId = openingWallId(fromWall);
  const nextBasis = openingBasis(newPoints);
  if (!nextBasis) return;
  canvas.getObjects().filter(isFloorplanOpening).forEach(object => {
    const oldHost = object.data.hostWallId === fromId ? fromWall : object.data.hostWallId === targetId ? toWall : null;
    if (!oldHost) return;
    const oldBasis = openingBasis(wallEndpoints(oldHost));
    if (!oldBasis) return;
    const start = openingPoint(oldBasis, object.data.offset);
    const end = openingPoint(oldBasis, object.data.offset + object.data.length);
    const along = point => (point.x - nextBasis.a.x) * nextBasis.u.x + (point.y - nextBasis.a.y) * nextBasis.u.y;
    const startOffset = along(start), endOffset = along(end);
    const reversed = startOffset > endOffset;
    object.data = { ...object.data, hostWallId: targetId, offset: Math.min(startOffset, endOffset),
      hinge: reversed ? (object.data.hinge === 'end' ? 'start' : 'end') : object.data.hinge,
      swing: reversed ? -(object.data.swing || 1) : object.data.swing };
    if (reversed && object.data.slidingPosition && object.data.slidingPosition !== 'pocket') {
      object.data.slidingPosition = object.data.slidingPosition === 'side-a' ? 'side-b' : 'side-a';
    }
  });
}

function updateFloorplanOpening(object, values) {
  if (!isFloorplanOpening(object)) return false;
  let data = { ...object.data };
  for (const key of ['length', 'depth', 'offset', 'x', 'y', 'angle']) if (values[key] !== undefined) data[key] = Number(values[key]);
  if (!data.hostWallId && Number.isFinite(data.angle)) data.angle = (data.angle % 360 + 360) % 360;
  if (values.hinge !== undefined) data.hinge = values.hinge === 'end' ? 'end' : 'start';
  if (values.swing !== undefined) data.swing = Number(values.swing) === -1 ? -1 : 1;
  if (values.doorType !== undefined) {
    if (data.kind !== 'door' || !['single', 'double', 'garage', 'sliding', 'opening'].includes(values.doorType)) {
      openingLastError = 'Choose a single door, double door, garage door, sliding door or open passage.'; return false;
    }
    data.doorType = values.doorType;
  }
  if (values.slidingPosition !== undefined) {
    if (data.kind !== 'door' || !['pocket', 'side-a', 'side-b'].includes(values.slidingPosition)) {
      openingLastError = 'Choose inside the wall, Side A or Side B for the sliding door.'; return false;
    }
    data.slidingPosition = values.slidingPosition;
  }
  if (data.hostWallId && values.doorType === 'sliding' && object.data.doorType !== 'sliding' && values.hinge === undefined && values.slidingPosition === undefined && openingSlidingPosition(data) === 'pocket' && openingPlacementError(data, object)) {
    const opposite = { ...data, hinge: data.hinge === 'end' ? 'start' : 'end' };
    if (!openingPlacementError(opposite, object)) data.hinge = opposite.hinge;
    else data.slidingPosition = 'side-a';
  }
  data = openingResolvedData(data, openingHost(object));
  openingLastError = openingPlacementError(data, object);
  if (openingLastError) return false;
  const host = openingHost(object);
  const thicknessChanged = Boolean(host) && values.depth !== undefined && Math.abs(host.strokeWidth - data.depth) > 0.001;
  if (thicknessChanged) {
    // Validate the new wall faces against every opening before recording or applying anything.
    const records = wallRecords().map(record => record.wall === host ? { ...record, thickness: data.depth } : record);
    if (!validateFloorplanOpenings(records, object, data)) return false;
    if (typeof wallFaceGeometry === 'function' && records.some(record => wallFaceGeometry(record, records).faces.some(face => face.length <= 0))) {
      openingLastError = 'That thickness leaves too little room at a connected corner.'; return false;
    }
  }
  if (!thicknessChanged && JSON.stringify(data) === JSON.stringify(object.data)) return true;
  wallCheckpoint();
  object.data = data;
  if (thicknessChanged) {
    const endpoints = wallEndpoints(host).map(point => ({ x: point.x, y: point.y }));
    host.set('strokeWidth', data.depth);
    host.data.thicknessManual = true;
    setWallEndpoints(host, endpoints);
    if (typeof refreshFloorplanGeometry === 'function') refreshFloorplanGeometry();
    else syncFloorplanOpenings();
  } else positionFloorplanOpening(object, host);
  isDirty = true; syncSaveButton(); canvas.requestRenderAll();
  canvas.fire('opening:changed', { target: object });
  if (typeof refreshFloorplanInspector === 'function') refreshFloorplanInspector();
  return true;
}

function checkpointOpeningTransform(object) {
  const state = openingTransformState;
  if (!state || state.object !== object || state.recorded) return;
  const live = { left: object.left, top: object.top, angle: object.angle, data: object.data };
  object.set({ left: state.left, top: state.top, angle: state.angle }); object.data = state.data;
  wallCheckpoint();
  object.set({ left: live.left, top: live.top, angle: live.angle }); object.data = live.data;
  state.recorded = true;
}

function syncStandaloneOpeningTransform(object, rotating = false, shift = false) {
  if (!isFloorplanOpening(object) || object.data.hostWallId) return;
  let angle = Number(object.angle) || 0;
  if (rotating && (shift || typeof angleSnapEnabled === 'undefined' || angleSnapEnabled)) angle = Math.round(angle / (shift ? 90 : 45)) * (shift ? 90 : 45);
  if (!rotating) {
    const radians = angle * Math.PI / 180, ux = Math.cos(radians), uy = Math.sin(radians);
    const xShift = object._openingShiftX || 0, yShift = object._openingShift || 0;
    const point = openingSnapPoint({ x: object.left - ux * xShift + uy * yShift,
      y: object.top - uy * xShift - ux * yShift });
    object.data.x = point.x; object.data.y = point.y;
  }
  object.data.angle = (angle % 360 + 360) % 360;
  positionFloorplanOpening(object, null);
}

function cancelFloorplanOpening() {
  openingDraft = null;
  openingHover = null;
  openingEditObject = null;
  openingEditAnchor = null;
  if (openingLengthEditor) openingLengthEditor.hidden = true;
  if (typeof canvas !== 'undefined' && canvas) { canvas.clearContext(canvas.contextTop); canvas.requestRenderAll(); }
}

function findOpeningWall(point) {
  const zoom = canvas.getZoom();
  const step = snapEnabled ? (typeof getSnapInterval === 'function' ? getSnapInterval() : getGridInterval()) : 0;
  let closest = null, distance = Infinity;
  for (const wall of canvas.getObjects().filter(object => object.data?.kind === 'wall')) {
    const points = wallEndpoints(wall), raw = openingProject(point, points);
    if (!raw) continue;
    const gap = wallDistance(raw.point, point);
    if (gap <= Math.max(14 / zoom, wall.strokeWidth / 2 + 4 / zoom) && gap < distance) {
      const projected = openingProject(point, points, step);
      closest = { wall, ...projected }; distance = gap;
    }
  }
  return closest;
}

function openingDraftData() {
  if (!openingDraft) return null;
  if (!openingDraft.wall) {
    const basis = openingBasis([openingDraft.startPoint, openingDraft.endPoint]);
    if (!basis) return null;
    return openingResolvedData({ kind: openingDraft.kind, hostWallId: null, offset: 0,
      x: (basis.a.x + basis.b.x) / 2, y: (basis.a.y + basis.b.y) / 2, angle: basis.angle,
      length: basis.length, depth: openingDraft.depth || 15, hinge: 'start', swing: openingDraft.swing || 1,
      ...(openingDraft.kind === 'door' ? { doorType: openingDraft.doorType || automaticFloorplanDoorType(basis.length) } : {}) }, null);
  }
  const length = Math.abs(openingDraft.endOffset - openingDraft.startOffset);
  return openingResolvedData({ kind: openingDraft.kind, hostWallId: openingWallId(openingDraft.wall),
    offset: Math.min(openingDraft.startOffset, openingDraft.endOffset), length,
    depth: Number(openingDraft.wall.strokeWidth) || 15,
    hinge: openingDraft.endOffset >= openingDraft.startOffset ? 'start' : 'end', swing: openingDraft.swing || 1,
    ...(openingDraft.kind === 'door' ? { doorType: openingDraft.doorType || automaticFloorplanDoorType(length) } : {}) }, openingDraft.wall);
}

function openingDraftPoints() {
  if (!openingDraft) return null;
  if (!openingDraft.wall) return [openingDraft.startPoint, openingDraft.endPoint];
  const basis = openingBasis(wallEndpoints(openingDraft.wall));
  return [openingPoint(basis, openingDraft.startOffset), openingPoint(basis, openingDraft.endOffset)];
}

function setOpeningDraftLength(value) {
  if (!openingDraft || !Number.isFinite(value)) return;
  if (!openingDraft.typed) {
    if (openingDraft.wall) openingDraft.typedDirection = Math.sign(openingDraft.endOffset - openingDraft.startOffset) || 1;
    else openingDraft.typedVector = openingBasis(openingDraftPoints())?.u || { x: 1, y: 0 };
  }
  openingDraft.typed = true;
  if (openingDraft.wall) openingDraft.endOffset = openingDraft.startOffset + openingDraft.typedDirection * value;
  else openingDraft.endPoint = { x: openingDraft.startPoint.x + openingDraft.typedVector.x * value,
    y: openingDraft.startPoint.y + openingDraft.typedVector.y * value };
}

function openingSymbolBounds(data, hostDepth) {
  const depth = Math.max(data.depth, hostDepth), extent = openingSwingExtent(data);
  const bounds = { left: -data.length / 2, right: data.length / 2, top: -depth / 2, bottom: depth / 2 };
  const sliding = data.kind === 'door' && floorplanDoorType(data) === 'sliding';
  const side = sliding ? (openingSlidingPosition(data) === 'side-a' ? -1 : 1) : (data.swing === -1 ? -1 : 1);
  if (side < 0) bounds.top -= extent; else bounds.bottom += extent;
  if (sliding) {
    if (data.hinge === 'end') bounds.right += data.length; else bounds.left -= data.length;
  }
  return bounds;
}

// Keep the entire swing/track footprint clear, not only the two jamb points.
function openingEditorPosition(point, bounds, width, height, canvasWidth, canvasHeight, normal, pointer = null) {
  const margin = 10, gap = 24;
  const clamp = p => ({
    x: Math.max(width / 2 + margin, Math.min(canvasWidth - width / 2 - margin, p.x)),
    y: Math.max(height / 2 + margin, Math.min(canvasHeight - height / 2 - margin, p.y))
  });
  const middle = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  const offset = Math.abs(normal.x) * (bounds.right - bounds.left + width) / 2 +
    Math.abs(normal.y) * (bounds.bottom - bounds.top + height) / 2 + gap;
  const candidates = [1, -1].map(sign => ({ x: middle.x + sign * normal.x * offset, y: middle.y + sign * normal.y * offset }));
  candidates.push({ x: middle.x, y: bounds.top - gap - height / 2 },
    { x: middle.x, y: bounds.bottom + gap + height / 2 },
    { x: bounds.left - gap - width / 2, y: middle.y },
    { x: bounds.right + gap + width / 2, y: middle.y });
  for (const x of [width / 2 + margin, canvasWidth - width / 2 - margin]) {
    for (const y of [height / 2 + margin, canvasHeight - height / 2 - margin]) candidates.push({ x, y });
  }
  const obstacles = [{ left: bounds.left - 14, right: bounds.right + 14, top: bounds.top - 14, bottom: bounds.bottom + 14 }];
  if (pointer) obstacles.push({ left: pointer.x - 22, right: pointer.x + 22, top: pointer.y - 22, bottom: pointer.y + 22 });
  const overlap = p => obstacles.reduce((sum, rect) => sum +
    Math.max(0, Math.min(p.x + width / 2, rect.right) - Math.max(p.x - width / 2, rect.left)) *
    Math.max(0, Math.min(p.y + height / 2, rect.bottom) - Math.max(p.y - height / 2, rect.top)), 0);
  const options = candidates.map(clamp);
  return options.find(p => overlap(p) === 0) || options.sort((a, b) => overlap(a) - overlap(b) ||
    Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
}

function positionOpeningEditor(point, start = point, end = point) {
  const screen = fabric.util.transformPoint(point, canvas.viewportTransform);
  const screenStart = fabric.util.transformPoint(start, canvas.viewportTransform);
  const screenEnd = fabric.util.transformPoint(end, canvas.viewportTransform);
  const width = openingLengthEditor.offsetWidth || 184, height = openingLengthEditor.offsetHeight || 74;
  if (openingEditObject && openingEditAnchor) {
    const position = floorplanMeasurementEditorPosition(openingEditAnchor, width, height, canvas.width, canvas.height);
    openingLengthEditor.style.left = `${position.x}px`;
    openingLengthEditor.style.top = `${position.y}px`;
    return;
  }
  const data = openingDraft ? openingDraftData() : openingEditObject?.data;
  const host = openingDraft?.wall || (openingEditObject && openingHost(openingEditObject));
  const basis = host ? openingBasis(wallEndpoints(host)) : data ? standaloneOpeningBasis(data) : null;
  let position;
  if (basis && data) {
    const bounds = openingSymbolBounds(data, host?.strokeWidth || data.depth);
    const middle = openingPoint(basis, (host ? data.offset : 0) + data.length / 2);
    const corners = [bounds.left, bounds.right].flatMap(x => [bounds.top, bounds.bottom].map(y =>
      fabric.util.transformPoint({ x: middle.x + basis.u.x * x + basis.n.x * y, y: middle.y + basis.u.y * x + basis.n.y * y }, canvas.viewportTransform)));
    const screenBounds = { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
      top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
    const side = data.kind === 'door' ? -(data.swing || 1) : 1;
    const pointer = openingDraft?.pointer ? fabric.util.transformPoint(openingDraft.pointer, canvas.viewportTransform) : screenEnd;
    position = openingEditorPosition(screen, screenBounds, width, height, canvas.width, canvas.height,
      { x: basis.n.x * side, y: basis.n.y * side }, pointer);
  } else position = floorplanEditorPosition(screen, screenStart, screenEnd, width, height, canvas.width, canvas.height);
  openingLengthEditor.style.left = `${position.x}px`;
  openingLengthEditor.style.top = `${position.y}px`;
}

function showOpeningEditor() {
  if (!openingDraft) return;
  const data = openingDraftData(), points = openingDraftPoints();
  if (!data || !points) return;
  openingLengthCaption.textContent = `${openingTypeName(data)} ${openingMeasurementName(data)} · ${floorplanUnitLabel()}`;
  openingLengthEditor.hidden = false;
  if (!openingDraft.typed) {
    openingLengthInput.value = floorplanFormatLength(data.length);
    if (document.activeElement === openingLengthInput) openingLengthInput.select();
  }
  positionOpeningEditor({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, points[0], points[1]);
}

function focusNewOpeningDraft(draft) {
  // Fabric finishes its pointer-down handling after our listener. Focus on the
  // next frame so typing works immediately for both click and drag placement.
  requestAnimationFrame(() => {
    if (!draft || openingDraft !== draft || draft.initialFocusHandled || openingLengthEditor.hidden) return;
    draft.initialFocusHandled = true;
    const active = document.activeElement;
    if (active && active !== openingLengthInput && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(active.tagName)) return;
    openingLengthInput.focus({ preventScroll: true });
    openingLengthInput.select();
  });
}

function submitOpeningLength() {
  if (openingEditObject) {
    const length = floorplanFromDisplayLength(openingLengthInput.value);
    if (!updateFloorplanOpening(openingEditObject, { length })) {
      openingLengthInput.setCustomValidity(openingLastError); openingLengthInput.reportValidity(); return;
    }
    openingEditObject = null; openingLengthEditor.hidden = true; return;
  }
  if (!openingDraft) return;
  if (openingDraft.typed) {
    const value = floorplanFromDisplayLength(openingLengthInput.value);
    if (!Number.isFinite(value) || Math.abs(value) < 1) {
      openingLengthInput.setCustomValidity(`Enter a ${openingDraft.kind === 'door' ? 'width' : 'length'} of at least ${floorplanFormatLength(1)} ${floorplanUnitLabel()}. A minus sign reverses the direction.`);
      openingLengthInput.reportValidity(); return;
    }
    setOpeningDraftLength(value);
  }
  const data = openingDraftData();
  openingLastError = openingPlacementError(data);
  if (openingLastError) { openingLengthInput.setCustomValidity(openingLastError); openingLengthInput.reportValidity(); return; }
  data.id = 'opening-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  wallCheckpoint();
  const object = new fabric.Rect({ data, fill: 'transparent' });
  installOpeningRenderer(object);
  positionFloorplanOpening(object, openingDraft.wall);
  canvas.add(object);
  cancelFloorplanOpening();
  canvas.setActiveObject(object);
  isDirty = true; syncSaveButton(); canvas.requestRenderAll();
  if (typeof refreshFloorplanInspector === 'function') refreshFloorplanInspector();
  const status = document.getElementById('wallStatus');
  if (status) status.textContent = `${openingTypeName(data)} placed. Select it to edit, or click to place another.`;
}

function renderOpeningDimensions(event) {
  if (event?.ctx && event.ctx !== canvas.contextContainer) return;
  if (!openingDimensionUI) return;
  openingDimensionUI.replaceChildren();
  openingDimensionUI.hidden = typeof floorplanDimensionsVisible !== 'undefined' && !floorplanDimensionsVisible;
  if (openingDimensionUI.hidden) return;
  canvas.getObjects().filter(isFloorplanOpening).forEach(object => {
    const host = openingHost(object);
    const basis = openingObjectBasis(object);
    if (!basis) return;
    const data = object.data, middle = openingPoint(basis, (host ? data.offset : 0) + data.length / 2);
    const screen = fabric.util.transformPoint(middle, canvas.viewportTransform);
    const button = document.createElement('button');
    button.disabled = currentTool !== 'select';
    button.type = 'button'; button.className = 'fp-wall-dimension fp-opening-dimension';
    button.title = 'Double-click or press Enter to edit this measurement';
    const symbol = data.kind === 'window' ? 'W' : { single: 'D', double: 'DD', garage: 'G', sliding: 'SD', opening: 'O' }[floorplanDoorType(data)];
    button.textContent = `${symbol} ${floorplanFormatLength(data.length)} ${floorplanUnitLabel()}`;
    button.setAttribute('aria-label', `Edit ${openingTypeName(data).toLowerCase()} ${openingMeasurementName(data)} ${floorplanFormatLength(data.length)} ${floorplanUnitLabel()}`);
    const side = data.kind === 'door' ? -(data.swing || 1) : 1;
    const offset = ((host?.strokeWidth || data.depth) / 2) * canvas.getZoom() + 13;
    button.style.left = `${screen.x + basis.n.x * offset * side}px`;
    button.style.top = `${screen.y + basis.n.y * offset * side}px`;
    let angle = basis.angle;
    if (angle > 90 || angle < -90) angle += 180;
    button.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    bindFloorplanDimensionEditing(button, event => {
      event.stopPropagation();
      if (typeof setTool === 'function') setTool('select'); else cancelFloorplanOpening();
      canvas.setActiveObject(object);
      openingEditObject = object;
      openingEditAnchor = { x: screen.x + basis.n.x * offset * side, y: screen.y + basis.n.y * offset * side };
      openingLengthCaption.textContent = `${openingTypeName(data)} ${openingMeasurementName(data)} · ${floorplanUnitLabel()}`;
      openingLengthInput.value = floorplanFormatLength(data.length); openingLengthInput.setCustomValidity('');
      openingLengthEditor.hidden = false;
      positionOpeningEditor(middle, openingPoint(basis, host ? data.offset : 0), openingPoint(basis, (host ? data.offset : 0) + data.length));
      openingLengthInput.focus({ preventScroll: true }); openingLengthInput.select();
      canvas.requestRenderAll();
    });
    openingDimensionUI.append(button);
  });
}

function setupFloorplanOpenings() {
  const wrapper = document.getElementById('canvasWrapper');
  openingDimensionUI = document.createElement('div');
  openingDimensionUI.className = 'fp-wall-dimensions fp-opening-dimensions';
  openingLengthEditor = document.createElement('form');
  openingLengthEditor.className = 'fp-wall-length-editor fp-opening-length-editor';
  openingLengthEditor.hidden = true;
  openingLengthCaption = document.createElement('label'); openingLengthCaption.htmlFor = 'openingLengthInput';
  openingLengthInput = document.createElement('input');
  Object.assign(openingLengthInput, { id: 'openingLengthInput', type: 'text', inputMode: 'decimal', autocomplete: 'off' });
  const apply = document.createElement('button'); apply.type = 'submit'; apply.textContent = 'Apply';
  openingLengthEditor.append(openingLengthCaption, openingLengthInput, apply);
  wrapper.append(openingDimensionUI, openingLengthEditor);
  openingLengthEditor.addEventListener('submit', event => { event.preventDefault(); submitOpeningLength(); });
  openingLengthEditor.addEventListener('pointerdown', event => event.stopPropagation());
  openingLengthInput.addEventListener('input', () => {
    openingLengthInput.setCustomValidity('');
    if (!openingDraft) return;
    const value = floorplanFromDisplayLength(openingLengthInput.value);
    setOpeningDraftLength(value);
    canvas.requestRenderAll();
  });
  openingLengthInput.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); cancelFloorplanOpening(); }
  });
  canvas.on('object:added', event => installOpeningRenderer(event.target));
  canvas.on('before:transform', event => {
    const object = event.transform?.target;
    if (!isFloorplanOpening(object) || object.data.hostWallId) return;
    openingTransformState = { object, left: object.left, top: object.top, angle: object.angle, data: { ...object.data }, recorded: false };
  });
  canvas.on('object:moving', event => {
    if (!isFloorplanOpening(event.target) || event.target.data.hostWallId) return;
    checkpointOpeningTransform(event.target); syncStandaloneOpeningTransform(event.target);
  });
  canvas.on('object:rotating', event => {
    if (!isFloorplanOpening(event.target) || event.target.data.hostWallId) return;
    checkpointOpeningTransform(event.target); syncStandaloneOpeningTransform(event.target, true, event.e?.shiftKey);
  });
  canvas.on('object:modified', event => {
    if (!isFloorplanOpening(event.target) || event.target.data.hostWallId) return;
    if (openingTransformState?.object === event.target && openingTransformState.recorded) { isDirty = true; syncSaveButton(); }
    openingTransformState = null;
  });
  canvas.getObjects().forEach(installOpeningRenderer);
  canvas.on('mouse:down', event => {
    if (!['window', 'door'].includes(currentTool) || isPanning || event.e.button > 0) return;
    if (openingDraft) { updateOpeningDraftSwing(canvas.getPointer(event.e)); submitOpeningLength(); return; }
    const point = canvas.getPointer(event.e), hit = findOpeningWall(point);
    const length = currentTool === 'door' ? 90 : 120;
    if (hit) {
      const direction = hit.offset + length <= hit.basis.length ? 1 : -1;
      openingDraft = { kind: currentTool, wall: hit.wall, startOffset: hit.offset,
        endOffset: hit.offset + direction * Math.min(length, hit.basis.length), typed: false, typedDirection: direction };
    } else {
      const start = openingSnapPoint(point);
      openingDraft = { kind: currentTool, wall: null, startPoint: start, endPoint: { x: start.x + length, y: start.y }, depth: 15, typed: false };
    }
    updateOpeningDraftSwing(point);
    openingEditObject = null; openingLengthInput.setCustomValidity('');
    showOpeningEditor();
    focusNewOpeningDraft(openingDraft);
    const status = document.getElementById('wallStatus');
    if (status) status.textContent = currentTool === 'door' && hit
      ? 'Move along the wall for width, across it for swing. Type a width · Enter places · Escape cancels.'
      : `Aim ${hit ? 'along the wall' : 'to set the direction'}, or type the ${currentTool === 'door' ? 'door width' : 'window length'} and press Enter. Escape cancels.`;
    canvas.requestRenderAll();
  });
  canvas.on('mouse:move', event => {
    if (!['window', 'door'].includes(currentTool) || isPanning) return;
    const point = canvas.getPointer(event.e);
    if (openingDraft) {
      if (!openingDraft.typed) {
        if (openingDraft.wall) {
          const step = snapEnabled ? (typeof getSnapInterval === 'function' ? getSnapInterval() : getGridInterval()) : 0;
          const projected = openingProject(point, wallEndpoints(openingDraft.wall), step);
          if (projected && Math.abs(projected.offset - openingDraft.startOffset) >= 1) openingDraft.endOffset = projected.offset;
        } else {
          const next = openingSnapPoint(point, openingDraft.startPoint, event.e.shiftKey);
          if (wallDistance(next, openingDraft.startPoint) >= 1) openingDraft.endPoint = next;
        }
      }
      updateOpeningDraftSwing(point);
    } else openingHover = findOpeningWall(point) || { point: openingSnapPoint(point) };
    canvas.requestRenderAll();
  });
  canvas.on('after:render', event => {
    if ((event?.ctx && event.ctx !== canvas.contextContainer) || !canvas.contextTop) return;
    renderOpeningDimensions(event);
    if (!['window', 'door'].includes(currentTool)) return;
    const ctx = canvas.contextTop;
    canvas.clearContext(ctx);
    const data = openingDraftData();
    const points = openingDraftPoints(), basis = points ? openingBasis(points) : null;
    ctx.save(); ctx.transform(...canvas.viewportTransform);
    if (data && basis && data.length >= 1) {
      const middle = openingPoint(basis, data.length / 2);
      ctx.save();
      ctx.translate(middle.x, middle.y); ctx.rotate(basis.angle * Math.PI / 180);
      ctx.globalAlpha = 0.8;
      const invalid = openingPlacementError(data);
      const color = typeof floorplanColors === 'function' ? floorplanColors().snap : '#008c85';
      // Hosted symbols use the host's orientation even when placing towards its start.
      if (openingDraft.wall) ctx.rotate((openingBasis(wallEndpoints(openingDraft.wall)).angle - basis.angle) * Math.PI / 180);
      renderOpeningSymbol(ctx, data, openingDraft.wall?.strokeWidth || data.depth, invalid ? '#c53e3e' : color);
      ctx.restore();
      renderOpeningSnapMarker(ctx, points[0], color, false);
      renderOpeningSnapMarker(ctx, points[1], invalid ? '#c53e3e' : color, true);
    } else if (openingHover) {
      renderOpeningSnapMarker(ctx, openingHover.point, '#008c85', true);
    }
    ctx.restore();
    showOpeningEditor();
  });
}

function renderOpeningSnapMarker(ctx, point, color, active) {
  if (typeof drawFloorplanSnapMarker === 'function') { drawFloorplanSnapMarker(ctx, point); return; }
  const zoom = canvas.getZoom();
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.5 / zoom;
  ctx.beginPath(); ctx.arc(point.x, point.y, (active ? 6 : 4) / zoom, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  if (active) {
    ctx.beginPath(); ctx.moveTo(point.x - 9 / zoom, point.y); ctx.lineTo(point.x + 9 / zoom, point.y);
    ctx.moveTo(point.x, point.y - 9 / zoom); ctx.lineTo(point.x, point.y + 9 / zoom); ctx.stroke();
  }
  ctx.restore();
}

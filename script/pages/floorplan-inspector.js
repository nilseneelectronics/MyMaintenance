// Small, direct property editor. Geometry stays in the wall/opening modules.
let floorplanInspectorObject = null;
let floorplanInspectorShape = '';
let floorplanInspectorFields = [];
let floorplanInspectorReady = false;

function floorplanInspectorNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(Number(value).toFixed(2))) : '';
}

function floorplanInspectorWallGeometry(wall) {
  if (typeof wallRecords !== 'function' || typeof wallFaceGeometry !== 'function') return null;
  const records = wallRecords();
  const record = records.find(item => item.wall === wall);
  return record ? wallFaceGeometry(record, records) : null;
}

function floorplanInspectorMessage(message, error = false) {
  const output = document.getElementById('inspectorFeedback');
  if (!output) return;
  output.textContent = message;
  output.classList.toggle('is-error', error);
}

function floorplanInspectorField(parent, definition) {
  if (definition.options) return floorplanInspectorDropdown(parent, definition);
  const measurement = definition.measurement ?? definition.label.includes('· cm');
  const literal = definition.literal || definition.type === 'color';
  const row = document.createElement('label');
  row.className = definition.type === 'checkbox' ? 'fp-inspector-check' : 'fp-inspector-field';
  const label = document.createElement('span');
  label.textContent = definition.label.replace('· cm', `· ${floorplanUnitLabel()}`);
  const control = document.createElement(definition.options ? 'select' : 'input');
  control.id = 'fp-property-' + definition.key;
  control.dataset.property = definition.key;
  control.setAttribute('aria-label', label.textContent);
  if (definition.options) {
    definition.options.forEach(([value, name]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = name;
      control.appendChild(option);
    });
  } else {
    // Text allows decimal commas and a leading minus sign without browser coercion.
    control.type = definition.type || 'text';
    if (control.type === 'text') {
      control.inputMode = literal ? 'text' : 'decimal';
      control.autocomplete = 'off';
      control.spellcheck = false;
    }
  }
  control.setAttribute('aria-describedby', 'inspectorFeedback');
  const writeValue = () => {
    const value = definition.read();
    if (definition.type === 'checkbox') control.checked = Boolean(value);
    else control.value = literal ? String(value ?? '') : measurement ? floorplanFormatLength(value) : floorplanInspectorNumber(value);
  };
  const commit = () => {
    let value = definition.type === 'checkbox' ? control.checked : control.value;
    if (!literal && definition.type !== 'checkbox') {
      value = measurement ? floorplanFromDisplayLength(value) : Number(String(value).trim().replace(',', '.'));
      if (!String(control.value).trim() || !Number.isFinite(value) ||
          (definition.min !== undefined && value < definition.min) ||
          (definition.max !== undefined && value > definition.max) ||
          (definition.nonzero && Math.abs(value) < 0.1)) {
        control.setCustomValidity(measurement ? `Enter ${floorplanFormatLength(definition.min ?? 0)} to ${floorplanFormatLength(definition.max ?? 100000)} ${floorplanUnitLabel()}${definition.nonzero ? ', excluding zero' : ''}.` : definition.validation || 'Enter a valid value.');
        floorplanInspectorMessage(control.validationMessage, true);
        control.reportValidity();
        return false;
      }
    }
    if (String(value) === String(definition.read())) return true;
    const success = definition.apply(value);
    if (success === false) {
      const error = definition.error?.() || 'This change would overlap or disconnect the plan. Try another measurement.';
      control.setCustomValidity(error);
      floorplanInspectorMessage(error, true);
      control.reportValidity();
      return false;
    }
    control.setCustomValidity('');
    floorplanInspectorMessage('Updated. Ctrl + Z to undo.');
    writeValue();
    refreshFloorplanInspector();
    return true;
  };
  control.addEventListener('input', () => control.setCustomValidity(''));
  control.addEventListener('change', commit);
  control.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (commit() && control.select) control.select();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      control.setCustomValidity('');
      writeValue();
      control.blur();
    }
  });
  control.addEventListener('focus', () => { if (control.type === 'text') control.select(); });
  writeValue();
  if (definition.type === 'checkbox') row.append(control, label);
  else row.append(label, control);
  parent.appendChild(row);
  floorplanInspectorFields.push({ control, writeValue });
  return control;
}

function floorplanInspectorDropdown(parent, definition) {
  const row = document.createElement('div');
  row.className = 'fp-inspector-field fp-inspector-select';
  const label = document.createElement('span');
  label.id = 'fp-property-' + definition.key + '-label';
  label.textContent = definition.label;
  const dropdown = document.createElement('div');
  dropdown.className = 'fp-asset-dropdown fp-inspector-dropdown';
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'fp-asset-toggle';
  toggle.id = 'fp-property-' + definition.key;
  toggle.dataset.property = definition.key;
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-describedby', 'inspectorFeedback');
  const valueLabel = document.createElement('span');
  valueLabel.className = 'fp-asset-value'; valueLabel.id = toggle.id + '-value';
  toggle.setAttribute('aria-labelledby', `${label.id} ${valueLabel.id}`);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('width', '14'); icon.setAttribute('height', '14'); icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 6l5 5 5-5'); path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8');
  icon.append(path); toggle.append(valueLabel, icon);
  const menu = document.createElement('ul');
  menu.id = toggle.id + '-options'; menu.className = 'fp-asset-menu';
  menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', definition.label);
  toggle.setAttribute('aria-controls', menu.id); menu.hidden = true;
  const options = [];
  const close = () => {
    dropdown.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); menu.hidden = true;
  };
  dropdown.closeInspectorDropdown = close;
  const writeValue = () => {
    const value = String(definition.read());
    valueLabel.textContent = definition.options.find(([key]) => String(key) === value)?.[1] || '';
    options.forEach(option => {
      const selected = option.dataset.value === value;
      option.classList.toggle('selected', selected); option.setAttribute('aria-selected', String(selected));
    });
  };
  const open = () => {
    document.querySelectorAll('.fp-inspector-dropdown.open').forEach(other => other.closeInspectorDropdown?.());
    dropdown.classList.add('open'); toggle.setAttribute('aria-expanded', 'true'); menu.hidden = false;
    (options.find(option => option.dataset.value === String(definition.read())) || options[0])?.focus();
  };
  definition.options.forEach(([value, name]) => {
    const item = document.createElement('li'); item.setAttribute('role', 'presentation');
    const option = document.createElement('button');
    option.type = 'button'; option.className = 'fp-asset-option'; option.dataset.value = String(value);
    option.textContent = name; option.setAttribute('role', 'option'); option.tabIndex = -1;
    option.addEventListener('click', () => {
      if (String(definition.read()) !== String(value) && definition.apply(value) === false) {
        floorplanInspectorMessage(definition.error?.() || 'This change cannot be applied.', true);
        return;
      }
      close(); writeValue(); refreshFloorplanInspector();
      floorplanInspectorMessage('Updated. Ctrl + Z to undo.');
      document.getElementById(toggle.id)?.focus();
    });
    option.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Escape') { close(); toggle.focus(); return; }
        const index = options.indexOf(option);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
          (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
      }
    });
    options.push(option); item.append(option); menu.append(item);
  });
  toggle.addEventListener('click', () => dropdown.classList.contains('open') ? close() : open());
  toggle.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); open(); }
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
  });
  dropdown.addEventListener('focusout', event => { if (!dropdown.contains(event.relatedTarget)) close(); });
  dropdown.append(toggle, menu); row.append(label, dropdown); parent.append(row);
  writeValue(); floorplanInspectorFields.push({ control: toggle, writeValue });
  return toggle;
}

function floorplanInspectorSection(parent, name, help) {
  const group = document.createElement('fieldset');
  group.className = 'fp-inspector-group';
  const legend = document.createElement('legend');
  legend.textContent = name;
  group.appendChild(legend);
  if (help) {
    const hint = document.createElement('p');
    hint.className = 'fp-inspector-note';
    hint.textContent = help.replace(/in cm\b/g, `in ${floorplanUnitLabel()}`);
    group.appendChild(hint);
  }
  parent.appendChild(group);
  return group;
}

function buildFloorplanWallInspector(parent, wall) {
  const geometry = floorplanInspectorWallGeometry(wall);
  if (!geometry) return;
  const wallChange = changes => typeof applyWallProperties === 'function' && applyWallProperties(wall, changes);
  const wallError = () => typeof wallLastError !== 'undefined' ? wallLastError : '';
  const dimensions = floorplanInspectorSection(parent, 'Wall measurements', 'All values in cm. The start stays fixed when you change the whole wall.');
  floorplanInspectorField(dimensions, {
    key: 'length', label: 'Centreline length · cm', nonzero: true, min: -100000, max: 100000,
    read: () => floorplanInspectorWallGeometry(wall)?.length,
    apply: length => wallChange({ length }), error: wallError,
    validation: 'Enter 0.1–100000 cm. A negative length reverses the wall.'
  });
  floorplanInspectorField(dimensions, {
    key: 'thickness', label: 'Wall thickness · cm', min: 1, max: 100,
    read: () => wall.strokeWidth, apply: thickness => wallChange({ thickness }), error: wallError,
    validation: 'Enter a wall thickness from 1 to 100 cm.'
  });
  geometry.faces.forEach(face => {
    const sideName = face.side === -1 ? 'Side A' : 'Side B';
    const side = floorplanInspectorSection(parent, face.name === sideName ? sideName : `${sideName} · ${face.name.toLowerCase()}`,
      face.divided ? 'Clear lengths between wall faces. Editing a section moves the connected wall.' : 'Measured along the finished wall face.');
    const segments = face.divided ? face.segments : [face];
    segments.forEach((segment, index) => floorplanInspectorField(side, {
      key: `side-${face.side === -1 ? 'a' : 'b'}-${index}`,
      label: face.divided ? `Section ${index + 1} · cm` : `${face.name === sideName ? 'Face length' : face.name + ' length'} · cm`,
      min: 0.1, max: 100000,
      read: () => {
        const updated = floorplanInspectorWallGeometry(wall)?.faces.find(item => item.side === face.side);
        return face.divided ? updated?.segments[index]?.length : updated?.length;
      },
      apply: value => typeof applyWallDimension === 'function' && applyWallDimension(wall, face.side, face.divided ? index : null, value),
      error: wallError, validation: 'Enter a clear face length from 0.1 to 100000 cm.'
    }));
  });
  const construction = floorplanInspectorSection(parent, 'Construction');
  floorplanInspectorField(construction, {
    key: 'wall-type', label: 'Wall type', options: [['inner', 'Inner wall'], ['outer', 'Outer wall']],
    read: () => wall.data.wallType || 'inner', apply: wallType => wallChange({ wallType }), error: wallError
  });
  floorplanInspectorField(construction, {
    key: 'insulated', label: 'Insulated', type: 'checkbox',
    read: () => wall.data.insulated === true, apply: insulated => wallChange({ insulated }), error: wallError
  });
  floorplanInspectorField(construction, {
    key: 'load-bearing', label: 'Load-bearing wall', type: 'checkbox',
    read: () => wall.data.loadBearing === true, apply: loadBearing => wallChange({ loadBearing }), error: wallError
  });
}

function buildFloorplanOpeningInspector(parent, opening) {
  const update = changes => typeof updateFloorplanOpening === 'function' && updateFloorplanOpening(opening, changes);
  const error = () => typeof openingLastError !== 'undefined' ? openingLastError : '';
  const isDoor = opening.data.kind === 'door';
  const hosted = Boolean(opening.data.hostWallId);
  const dimensions = floorplanInspectorSection(parent, 'Opening measurements', `${isDoor ? 'Width' : 'Length'} only changes this opening. ${hosted ? 'Wall / frame thickness is shared with its wall.' : 'This opening is freestanding. Drag it to move; use the rotation handle or angle field to rotate.'}`);
  [
    ['length', isDoor ? 'Door width · cm' : 'Window length · cm', 1],
    ['depth', 'Wall / frame thickness · cm', 1],
    ['offset', 'From wall start · cm', 0]
  ].filter(([key]) => hosted || key !== 'offset').forEach(([key, label, min]) => floorplanInspectorField(dimensions, {
    key, label, min, max: key === 'depth' ? 100 : 100000,
    read: () => opening.data[key], apply: value => update({ [key]: value }), error,
    validation: `Enter a measurement of at least ${min} cm that fits inside the wall.`
  }));
  if (!hosted) floorplanInspectorField(dimensions, {
    key:'angle',label:'Rotation · °',min:-36000,max:36000,read:()=>opening.angle||0,
    apply:angle=>update({angle}),error,validation:'Enter an angle in degrees.'
  });
  if (opening.data.kind === 'door') {
    const swing = floorplanInspectorSection(parent, 'Door opening');
    const inward = floorplanDoorInwardSide(opening);
    floorplanInspectorField(swing, {
      key: 'door-type', label: 'Door type',
      options: [['single', 'Single door'], ['double', 'Double door'], ['garage', 'Garage door'], ['sliding', 'Sliding door'], ['opening', 'Open passage']],
      read: () => opening.data.doorType || 'single', apply: doorType => update({ doorType }), error
    });
    if (opening.data.doorType === 'sliding') {
      floorplanInspectorField(swing, {
        key: 'sliding-position', label: 'Sliding position',
        options: [...(hosted ? [['pocket', 'Inside wall']] : []), [inward === -1 ? 'side-a' : 'side-b', 'Inwards'], [inward === -1 ? 'side-b' : 'side-a', 'Outwards']],
        read: () => opening.data.slidingPosition || 'pocket', apply: slidingPosition => update({ slidingPosition }), error
      });
      floorplanInspectorField(swing, {
        key: 'hinge', label: 'Slides towards', options: [['start', 'Start of opening'], ['end', 'End of opening']],
        read: () => opening.data.hinge || 'start', apply: hinge => update({ hinge }), error
      });
      return;
    }
    if (['garage', 'opening'].includes(opening.data.doorType)) return;
    if (opening.data.doorType !== 'double') floorplanInspectorField(swing, {
      key: 'hinge', label: 'Hinge position', options: [['start', 'Start of opening'], ['end', 'End of opening']],
      read: () => opening.data.hinge || 'start', apply: hinge => update({ hinge }), error
    });
    floorplanInspectorField(swing, {
      key: 'swing', label: 'Opens towards', options: [[String(inward), 'Inwards'], [String(-inward), 'Outwards']],
      read: () => opening.data.swing === -1 ? -1 : 1, apply: value => update({ swing: Number(value) }), error
    });
  }
}

function buildFloorplanStairInspector(parent, stair) {
  const update = changes => typeof updateFloorplanStair === 'function' && updateFloorplanStair(stair, changes);
  const error = () => typeof stairLastError !== 'undefined' ? stairLastError : '';
  const measurements = floorplanInspectorSection(parent, 'Stair measurements', 'All measurements in cm. The arrow shows the direction up.');
  [['width', 'Width · cm'], ['length', 'Length · cm']].forEach(([key, label]) => floorplanInspectorField(measurements, {
    key, label, min: 1, max: 100000,
    read: () => stair.data[key], apply: value => update({ [key]: value }), error,
    validation: 'Enter a stair measurement from 1 to 100000 cm.'
  }));
  const layout = floorplanInspectorSection(parent, 'Stair layout');
  floorplanInspectorField(layout, {
    key:'angle',label:'Rotation · °',min:-36000,max:36000,
    read:()=>stair.angle||0,apply:angle=>update({angle}),error,validation:'Enter an angle in degrees.'
  });
  floorplanInspectorField(layout, {
    key: 'stair-type', label: 'Stair type',
    options: [['straight', 'Straight'], ['quarter', 'Quarter turn'], ['half', 'Half turn']],
    read: () => stair.data.stairType || 'straight', apply: stairType => update({ stairType }), error
  });
  floorplanInspectorField(layout, {
    key: 'direction', label: 'Direction up', options: [['forward', 'Forward'], ['reverse', 'Reverse']],
    read: () => stair.data.direction || 'forward', apply: direction => update({ direction }), error
  });
}

function buildFloorplanSymbolInspector(parent, object) {
  const update = values => updateFloorplanSymbol(object,values);
  const error = () => symbolLastError;
  const group = floorplanInspectorSection(parent,'Symbol properties','Drag to move, or use the rotation handle. Sizes are editable.');
  floorplanInspectorField(group,{key:'name',label:'Name',literal:true,read:()=>object.data.name,apply:name=>update({name}),error});
  for(const [key,label] of [['width','Width · cm'],['depth','Depth · cm']]) floorplanInspectorField(group,{
    key,label,min:1,max:10000,read:()=>object.data[key],apply:value=>update({[key]:value}),error
  });
  floorplanInspectorField(group,{key:'angle',label:'Rotation · °',min:-36000,max:36000,read:()=>object.angle||0,apply:angle=>update({angle}),error});
  floorplanInspectorField(group,{key:'color',label:'Fill colour',type:'color',read:()=>object.data.color||floorplanColors().surface,apply:color=>update({color}),error});
}

function refreshFloorplanInspector() {
  if (!floorplanInspectorReady || typeof canvas === 'undefined' || !canvas) return;
  const parent = document.getElementById('propertiesContent');
  if (!parent) return;
  const selection = typeof floorplanSelectedObjects === 'function' ? floorplanSelectedObjects() : canvas.getActiveObjects?.() || [];
  const multiple = selection.length > 1;
  const selected = multiple ? null : canvas.getActiveObject();
  const kind = selected?.data?.kind;
  const geometry = kind === 'wall' ? floorplanInspectorWallGeometry(selected) : null;
  const shape = floorplanUnitLabel() + ':' + (multiple ? selection.map(object => object.data?.kind).sort().join(',') : kind === 'wall' ? geometry?.faces.map(face => `${face.side}:${face.divided}:${face.segments.length}:${face.name}`).join('|') :
    kind === 'door' ? `${kind}:${selected.data.doorType || 'single'}:${Boolean(selected.data.hostWallId)}:${floorplanDoorInwardSide(selected)}` : kind);
  if (selected === floorplanInspectorObject && shape === floorplanInspectorShape) {
    floorplanInspectorFields.forEach(({ control, writeValue }) => {
      if (control !== document.activeElement) writeValue();
    });
    return;
  }
  // Do not discard a half-typed measurement while the render loop updates geometry.
  if (selected === floorplanInspectorObject && parent.contains(document.activeElement) && document.activeElement.type === 'text') return;
  floorplanInspectorObject = selected;
  floorplanInspectorShape = shape;
  floorplanInspectorFields = [];
  parent.replaceChildren();
  const title = document.getElementById('inspectorTitle');
  if (title) title.textContent = multiple ? `${selection.length} elements selected` : kind ? `${kind.charAt(0).toUpperCase()}${kind.slice(1)} properties` : 'Properties';
  if (kind === 'wall') buildFloorplanWallInspector(parent, selected);
  else if (kind === 'window' || kind === 'door') buildFloorplanOpeningInspector(parent, selected);
  else if (kind === 'stair') buildFloorplanStairInspector(parent, selected);
  else if (kind === 'symbol') buildFloorplanSymbolInspector(parent, selected);
  else {
    const empty = document.createElement('div');
    empty.className = 'fp-inspector-empty';
    const prompt = document.createElement('strong');
    prompt.textContent = multiple ? 'Move or organise this selection' : selected ? 'Select one wall, window, door or stair' : 'Select an element to edit';
    const hint = document.createElement('p');
    hint.textContent = multiple ? 'Drag the selected elements to move them together. Right-click to group, ungroup or delete. Ctrl-click or Shift-click adds or removes an element.' :
      'Click an element or drag a selection box. Double-click a dimension to edit it. Right-click for more actions.';
    empty.append(prompt, hint);
    parent.appendChild(empty);
  }
  const feedback = document.createElement('p');
  feedback.id = 'inspectorFeedback';
  feedback.className = 'fp-inspector-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  parent.appendChild(feedback);
}

function setupFloorplanInspector() {
  if (floorplanInspectorReady || typeof canvas === 'undefined' || !canvas) return;
  floorplanInspectorReady = true;
  ['selection:created', 'selection:updated', 'selection:cleared', 'object:modified', 'after:render'].forEach(event => {
    canvas.on(event, refreshFloorplanInspector);
  });
  document.getElementById('propertiesContent')?.addEventListener('focusout', () => {
    requestAnimationFrame(refreshFloorplanInspector);
  });
  refreshFloorplanInspector();
}

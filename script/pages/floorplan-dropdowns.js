// Keep the select values/events used by the editor behind the same menus as assets.
const floorplanDropdowns = new Map();
let floorplanDropdownDocumentReady = false;

function enhanceFloorplanDropdown(select) {
  if (!select || floorplanDropdowns.has(select.id)) return;
  const name = select.getAttribute('aria-label') || select.name || 'Choose an option';
  const dropdown = document.createElement('div');
  dropdown.className = 'fp-asset-dropdown fp-control-dropdown';
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.id = select.id + 'Toggle'; toggle.className = 'fp-asset-toggle';
  toggle.setAttribute('aria-haspopup', 'listbox'); toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', name);
  const value = document.createElement('span'); value.className = 'fp-asset-value';
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('width', '16'); icon.setAttribute('height', '16'); icon.setAttribute('viewBox', '0 0 16 16'); icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 6l5 5 5-5'); path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8');
  icon.append(path); toggle.append(value, icon);
  const menu = document.createElement('ul');
  menu.id = select.id + 'Options'; menu.className = 'fp-asset-menu'; menu.hidden = true;
  menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', name);
  toggle.setAttribute('aria-controls', menu.id);
  const labels = Array.from(select.labels || []);
  select.parentNode.insertBefore(dropdown, select);
  dropdown.append(select, toggle, menu);
  select.hidden = true; select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
  labels.forEach(label => { label.htmlFor = toggle.id; });
  const state = { select, dropdown, toggle, menu, value, buttons: [], optionsKey: '' };
  floorplanDropdowns.set(select.id, state);

  const close = (returnFocus = false) => {
    dropdown.classList.remove('open'); menu.hidden = true; toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus();
  };
  state.close = close;
  const enabledButtons = () => state.buttons.filter(button => !button.disabled);
  const focusOption = preferred => {
    const buttons = enabledButtons();
    const index = buttons.findIndex(button => button.dataset.value === preferred);
    (buttons[index < 0 ? 0 : index])?.focus();
  };
  const open = () => {
    if (select.disabled) return;
    syncFloorplanDropdown(state);
    floorplanDropdowns.forEach(other => { if (other !== state) other.close(); });
    dropdown.classList.add('open'); menu.hidden = false; toggle.setAttribute('aria-expanded', 'true');
    focusOption(select.value);
  };
  state.choose = selected => {
    const previous = select.value;
    select.value = selected;
    if (select.value !== previous) {
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncFloorplanDropdown(state);
    close(true);
  };
  toggle.addEventListener('click', () => menu.hidden ? open() : close());
  toggle.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); open();
    } else if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault(); event.stopPropagation(); close(true);
    }
  });
  menu.addEventListener('keydown', event => {
    const buttons = enabledButtons();
    if (!buttons.length) return;
    let index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopPropagation();
      index = (Math.max(0, index) + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); event.stopPropagation(); buttons[event.key === 'Home' ? 0 : buttons.length - 1].focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation();
      if (index >= 0) state.choose(buttons[index].dataset.value);
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(true);
    } else if (event.key === 'Tab') {
      close(true);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const ordered = buttons.slice(index + 1).concat(buttons.slice(0, index + 1));
      const match = ordered.find(button => button.textContent.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (match) { event.preventDefault(); event.stopPropagation(); match.focus(); }
    }
  });
  dropdown.addEventListener('focusout', event => {
    if (event.relatedTarget && !dropdown.contains(event.relatedTarget)) close();
  });
  select.addEventListener('change', () => syncFloorplanDropdown(state));
  syncFloorplanDropdown(state);
}

function syncFloorplanDropdown(state) {
  const options = Array.from(state.select.options);
  const key = JSON.stringify(options.map(option => [option.value, option.textContent, option.disabled]));
  if (key !== state.optionsKey) {
    state.menu.replaceChildren(); state.buttons = []; state.optionsKey = key;
    options.forEach(option => {
      const item = document.createElement('li'); item.setAttribute('role', 'presentation');
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role', 'option'); button.tabIndex = -1;
      button.dataset.value = option.value; button.textContent = option.textContent; button.disabled = option.disabled;
      button.addEventListener('click', () => state.choose(option.value));
      item.append(button); state.menu.append(item); state.buttons.push(button);
    });
  }
  const selected = options.find(option => option.value === state.select.value);
  state.value.textContent = selected?.textContent || '';
  state.toggle.disabled = state.select.disabled;
  state.toggle.setAttribute('aria-label', `${state.select.getAttribute('aria-label') || 'Choose an option'}: ${selected?.textContent || ''}`);
  state.buttons.forEach(button => {
    const active = button.dataset.value === state.select.value;
    button.classList.toggle('selected', active); button.setAttribute('aria-selected', String(active));
  });
}

function syncFloorplanDropdowns() {
  floorplanDropdowns.forEach(syncFloorplanDropdown);
}

function setupFloorplanDropdowns() {
  ['floorplanUnit', 'floorplanSymbolCategory'].forEach(id => enhanceFloorplanDropdown(document.getElementById(id)));
  if (floorplanDropdownDocumentReady) return;
  floorplanDropdownDocumentReady = true;
  document.addEventListener('pointerdown', event => {
    floorplanDropdowns.forEach(state => { if (!state.dropdown.contains(event.target)) state.close(); });
  });
}

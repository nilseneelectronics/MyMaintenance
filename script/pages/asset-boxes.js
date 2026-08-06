(function () {
    'use strict';

    const REGISTER_LABELS = ['Register new address', 'Register new vehicle'];
    const HOUSE_TYPE_OPTIONS = ['House', 'Apartment', 'Cabin', 'Other'];
    const VEHICLE_TYPE_OPTIONS = ['Car', 'Boat', 'Other'];

    let currentAssetName = '';
    let currentAssetId = null;
    let infoEditMode = false;
    let editDropdowns = {};

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function pageAssetType() {
        const sel = document.querySelector('.address-selector');
        return sel && sel.getAttribute('data-assets') === 'homes' ? 'homes' : 'vehicles';
    }

    function currentAsset() {
        if (currentAssetName) return currentAssetName;
        const sel = document.querySelector('.address-selector .dropdown-toggle span');
        if (sel && sel.textContent && sel.textContent.trim()) {
            const t = sel.textContent.trim();
            if (t && REGISTER_LABELS.indexOf(t) === -1) return t;
        }
        const el = document.querySelector('[data-current-asset]');
        return el ? el.getAttribute('data-current-asset') : '';
    }

    function renderPlanned() {
        const box = document.getElementById('asset-planned-list');
        if (!box) return;
        const asset = currentAsset();
        let events = [];
        if (window.MyMaintenanceEvents) {
            events = window.MyMaintenanceEvents.plannedMaintenance(3, asset);
        }
        if (!events.length) {
            box.innerHTML = '<div class="asset-list-empty">No planned maintenance yet.</div>';
            return;
        }
        box.innerHTML = window.MyMaintenanceEvents.eventHeaderRowHtml({ name: 'Maintenance', asset: 'Asset', date: 'Date' })
            + events.map(function (item) {
                return window.MyMaintenanceEvents.eventRowHtml(item.key, item.ev);
            }).join('');
        box.querySelectorAll('.ev-row-open').forEach(function (el, idx) {
            el.addEventListener('click', function () {
                openEditEvent(events[idx]);
            });
        });
    }

    function openEditEvent(item) {
        if (!window.MyMaintenanceEventModal || !window.MyMaintenanceEvents || !item) return;
        const events = window.MyMaintenanceEvents.load();
        const arr = events[item.key] || [];
        const index = arr.indexOf(item.ev);
        window.MyMaintenanceEventModal.open(item.key, {
            event: item.ev,
            index: index >= 0 ? index : 0
        });
    }

    function renderDocs() {
        const box = document.getElementById('asset-docs-list');
        if (!box) return;
        const asset = currentAsset();
        let docs = [];
        if (window.MyMaintenanceDocs) docs = window.MyMaintenanceDocs.getItems();
        if (asset) docs = docs.filter(function (d) { return d.asset === asset; });
        const recent = docs.slice().sort(function (a, b) {
            return String(b.uploaded || '').localeCompare(String(a.uploaded || ''));
        }).slice(0, 3);
        if (!recent.length) {
            box.innerHTML = '<div class="asset-list-empty">No registered documents yet.</div>';
            return;
        }
        box.innerHTML = window.MyMaintenanceDocs.headerRowHtml()
            + recent.map(function (d) { return window.MyMaintenanceDocs.rowHtml(d); }).join('');
        box.querySelectorAll('.doc-row-open[data-doc-id]').forEach(function (el) {
            el.addEventListener('click', function () {
                if (!window.MyMaintenanceDocs) return;
                const id = el.getAttribute('data-doc-id');
                const doc = window.MyMaintenanceDocs.getItems().filter(function (d) { return d.id === id; })[0];
                if (doc) window.MyMaintenanceDocs.openPreview(doc);
            });
        });
    }

    function meterField(rec) {
        const boat = rec && rec.type === 'Boat';
        return { key: boat ? 'Engine Hours' : 'Odometer', id: 'aie-meter', prop: 'distance', type: 'number', unit: boat ? 'h' : 'km' };
    }

    function assetConfig(rec) {
        const type = pageAssetType();
        if (type === 'homes') {
            return {
                kind: 'home',
                title: 'Home Information',
                emptyMsg: 'No home selected.',
                sections: [
                    {
                        title: 'Address Information',
                        fields: [
                            { key: 'Name', id: 'aie-name', prop: 'name', required: true },
                            { key: 'Country', id: 'aie-country', prop: 'country' },
                            { key: 'Address', id: 'aie-address', prop: 'address', required: true },
                            { key: 'Zip', id: 'aie-zip', prop: 'zip' },
                            { key: 'City', id: 'aie-city', prop: 'city' }
                        ]
                    },
                    {
                        title: 'Technical Information',
                        fields: [
                            { key: 'Build Year', id: 'aie-build-year', prop: 'buildYear', type: 'number' },
                            { key: 'House Type', id: 'aie-house-type', kind: 'dropdown', options: HOUSE_TYPE_OPTIONS, prop: 'houseType', comment: 'houseTypeComment' },
                            { key: 'Floors', id: 'aie-floors', prop: 'floors', type: 'number' },
                            { key: 'Internal Size', id: 'aie-internal', prop: 'internalSize', type: 'number', unit: 'm&sup2;' },
                            { key: 'External Size', id: 'aie-external', prop: 'externalSize', type: 'number', unit: 'm&sup2;' }
                        ]
                    }
                ]
            };
        }
        const vehicleFields = [
            { key: 'Name', id: 'aie-name', prop: 'name', required: true },
            { key: 'Type', id: 'aie-type', kind: 'dropdown', options: VEHICLE_TYPE_OPTIONS, prop: 'type', comment: 'typeComment' },
            { key: 'Registration', id: 'aie-registration', prop: 'registration', required: function (rec, sel) { return sel.type !== 'Boat'; } }
        ];
        if (rec && rec.type === 'Car') {
            vehicleFields.push({ key: 'VIN', id: 'aie-vin', prop: 'vin' });
        }
        vehicleFields.push(
            { key: 'Make', id: 'aie-make', prop: 'make' },
            { key: 'Model', id: 'aie-model', prop: 'model' },
            { key: 'Year', id: 'aie-year', prop: 'year', type: 'number' }
        );
        return {
            kind: 'vehicle',
            title: 'Vehicle Information',
            emptyMsg: 'No vehicle selected.',
            sections: [
                {
                    title: 'Vehicle Information',
                    fields: vehicleFields
                },
                {
                    title: 'Additional Information',
                    fields: [
                        meterField(rec),
                        { key: 'Fuel Type', id: 'aie-fuel', prop: 'fuel' }
                    ]
                }
            ]
        };
    }

    function assetList() {
        if (!window.MyMaintenanceAssets) return [];
        return pageAssetType() === 'homes'
            ? window.MyMaintenanceAssets.getHomes()
            : window.MyMaintenanceAssets.getVehicles();
    }

    function assetLabel(rec) {
        if (!window.MyMaintenanceAssets || !rec) return '';
        return pageAssetType() === 'homes'
            ? window.MyMaintenanceAssets.homeLabel(rec)
            : window.MyMaintenanceAssets.vehicleLabel(rec);
    }

    function currentRecord() {
        const list = assetList();
        if (!list.length) return null;
        if (currentAssetId) {
            const found = list.filter(function (r) { return r.id === currentAssetId; })[0];
            if (found) return found;
        }
        const label = currentAsset();
        if (!label) return null;
        return list.filter(function (r) { return assetLabel(r) === label; })[0] || null;
    }

    function buildAssetMenu() {
        const menu = document.querySelector('.address-selector .dropdown-menu');
        if (!menu) return;
        const type = pageAssetType();
        const items = assetList().map(function (r) {
            return { id: r.id, label: assetLabel(r) };
        });
        const registerLabel = type === 'homes' ? 'Register new address' : 'Register new vehicle';
        menu.innerHTML = items.map(function (it) {
            return '<li><button data-id="' + esc(it.id || '') + '">' + esc(it.label) + '</button></li>';
        }).join('') + '<li><button>' + esc(registerLabel) + '</button></li>';

        const toggle = document.querySelector('.address-selector .dropdown-toggle span');
        const initial = toggle ? toggle.textContent.trim() : '';
        menu.querySelectorAll('button').forEach(function (b) {
            if (b.textContent.trim() === initial) b.classList.add('selected');
        });
    }

    function selectAssetLabel(label, id) {
        currentAssetName = label;
        currentAssetId = id || null;
        const toggle = document.querySelector('.address-selector .dropdown-toggle span');
        if (toggle) toggle.textContent = label;
        const dd = document.querySelector('.address-selector');
        if (dd) dd.classList.remove('open');
        const menu = document.querySelector('.address-selector .dropdown-menu');
        if (menu) {
            menu.style.maxHeight = '0px';
            menu.querySelectorAll('button').forEach(function (b) {
                b.classList.toggle('selected', b.textContent.trim() === label);
            });
        }
        renderPlanned();
        renderDocs();
        infoEditMode = false;
        renderAssetInfo();
    }

    function selectAssetById(id) {
        const list = assetList();
        const rec = list.filter(function (r) { return r.id === id; })[0];
        if (!rec) return;
        const label = assetLabel(rec);
        currentAssetName = label;
        currentAssetId = id;
        const toggle = document.querySelector('.address-selector .dropdown-toggle span');
        if (toggle) toggle.textContent = label;
        const menu = document.querySelector('.address-selector .dropdown-menu');
        if (menu) {
            menu.querySelectorAll('button').forEach(function (b) {
                b.classList.toggle('selected', b.textContent.trim() === label);
            });
        }
        renderPlanned();
        renderDocs();
        infoEditMode = false;
        renderAssetInfo();
    }

    function fieldDisplay(field, rec) {
        if (field.kind === 'dropdown') {
            const v = rec[field.prop] || '';
            const comment = field.comment ? rec[field.comment] : '';
            return comment ? esc(v + ' (' + comment + ')') : esc(v);
        }
        const v = rec[field.prop];
        if (v == null || v === '') return '';
        return esc(String(v)) + (field.unit ? ' <span class="asset-info-unit">' + field.unit + '</span>' : '');
    }

    function renderAssetInfo() {
        const grid = document.getElementById('asset-info-grid');
        const titleEl = document.getElementById('asset-info-title');
        if (!grid) return;
        const rec = currentRecord();
        const cfg = assetConfig(rec);
        const editBtn = document.getElementById('asset-edit-home');
        if (editBtn) editBtn.textContent = infoEditMode ? 'Cancel' : 'Edit';
        if (titleEl) titleEl.textContent = rec && rec.name ? rec.name : cfg.title;
        if (!rec) {
            grid.innerHTML = '<div class="asset-list-empty">' + esc(cfg.emptyMsg) + '</div>';
            renderInfoActions('none');
            return;
        }
        if (infoEditMode) {
            renderAssetInfoEdit(rec, cfg);
            return;
        }
        grid.innerHTML = cfg.sections.map(function (section) {
            return '<div class="asset-info-section">'
                + '<div class="asset-info-section-title">' + esc(section.title) + '</div>'
                + section.fields.map(function (field) {
                    const val = fieldDisplay(field, rec);
                    return '<div class="asset-info-row">'
                        + '<span class="asset-info-key">' + esc(field.key) + '</span>'
                        + '<span class="asset-info-val">' + (val ? val : '<span class="info-empty">Not registered</span>') + '</span>'
                        + '</div>';
                }).join('')
                + '</div>';
        }).join('');
        renderInfoActions('none');
    }

    function renderAssetInfoEdit(rec, cfg) {
        const grid = document.getElementById('asset-info-grid');
        if (!grid || !rec) return;
        const f = function (v) { return esc(v == null ? '' : v); };
        const dropdowns = [];

        function inputField(field) {
            const unit = field.unit
                ? '<span class="asset-info-unit">' + field.unit + '</span>'
                : '';
            const input = '<input class="asset-info-input" id="' + field.id + '" type="' + (field.type || 'text') + '" value="' + f(rec[field.prop]) + '">';
            return unit
                ? '<span class="asset-info-field-row">' + input + unit + '</span>'
                : input;
        }

        function dropdownField(field) {
            const value = rec[field.prop] || '';
            const comment = field.comment ? rec[field.comment] || '' : '';
            const options = field.options.slice();
            if (value && options.indexOf(value) === -1) options.unshift(value);
            let html = '<div class="asset-dropdown asset-info-dropdown" id="' + field.id + '-dd">'
                + '<button type="button" class="asset-toggle" id="' + field.id + '-toggle">'
                + '<span class="asset-value" id="' + field.id + '-value">' + f(value || '-- Select --') + '</span>'
                + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                + '</button>'
                + '<ul class="asset-menu" id="' + field.id + '-menu">'
                + options.map(function (o) {
                    return '<li><button type="button" data-value="' + f(o) + '"' + (o === value ? ' class="selected"' : '') + '>' + f(o) + '</button></li>';
                }).join('')
                + '</ul>'
                + '</div>';
            if (field.comment) {
                html += '<input class="asset-info-input asset-info-other" id="' + field.id + '-other" type="text" placeholder="Specify..." value="' + f(comment) + '"' + (value === 'Other' ? '' : ' style="display:none"') + '>';
            }
            dropdowns.push(field);
            return html;
        }

        function row(key, ctrl) {
            return '<div class="asset-info-row">'
                + '<span class="asset-info-key">' + esc(key) + '</span>'
                + '<span class="asset-info-val asset-info-val-edit">' + ctrl + '</span>'
                + '</div>';
        }

        function handleTypeChange(newType) {
            const rec2 = currentRecord();
            if (!rec2) return;
            const out = {};
            cfg.sections.forEach(function (section) {
                section.fields.forEach(function (field) {
                    if (field.kind === 'dropdown') {
                        const selected = field.prop === 'type'
                            ? newType
                            : (editDropdowns[field.prop] != null ? editDropdowns[field.prop] : (rec2[field.prop] || ''));
                        out[field.prop] = selected;
                        if (field.comment) {
                            const el = document.getElementById(field.id + '-other');
                            out[field.comment] = selected === 'Other' ? (el ? el.value : '') : '';
                        }
                    } else {
                        const el = document.getElementById(field.id);
                        out[field.prop] = el ? el.value : (rec2[field.prop] || '');
                    }
                });
            });
            editDropdowns.type = newType;
            renderAssetInfoEdit(Object.assign({}, rec2, out), assetConfig(Object.assign({}, rec2, out)));
        }

        editDropdowns = {};
        grid.innerHTML = cfg.sections.map(function (section) {
            return '<div class="asset-info-section">'
                + '<div class="asset-info-section-title">' + esc(section.title) + '</div>'
                + section.fields.map(function (field) {
                    if (field.kind === 'dropdown') return row(field.key, dropdownField(field));
                    return row(field.key, inputField(field));
                }).join('')
                + '</div>';
        }).join('');

        cfg.sections.forEach(function (section) {
            section.fields.forEach(function (field) {
                if (field.kind === 'dropdown') editDropdowns[field.prop] = rec[field.prop] || '';
            });
        });

        wireInfoEditControls(cfg, dropdowns, handleTypeChange);
        renderInfoActions('edit');
    }

    function renderInfoActions(mode) {
        const wrap = document.getElementById('asset-info-actions');
        if (!wrap) return;
        if (mode === 'edit') {
            wrap.innerHTML = '<button type="button" class="asset-action ghost" id="aie-cancel">Cancel</button>'
                + '<button type="button" class="asset-action primary" id="aie-save">Save</button>';
            wireInfoActions();
        } else {
            wrap.innerHTML = '';
        }
    }

    function wireInfoEditControls(cfg, dropdowns, onTypeChange) {
        dropdowns.forEach(function (field) {
            const dd = document.getElementById(field.id + '-dd');
            const toggle = document.getElementById(field.id + '-toggle');
            const valueEl = document.getElementById(field.id + '-value');
            const menu = document.getElementById(field.id + '-menu');
            const other = document.getElementById(field.id + '-other');
            if (toggle) {
                toggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (dd) dd.classList.toggle('open');
                });
            }
            if (menu) {
                menu.addEventListener('click', function (e) {
                    const btn = e.target.closest('button[data-value]');
                    if (!btn) return;
                    const v = btn.getAttribute('data-value');
                    editDropdowns[field.prop] = v;
                    if (valueEl) valueEl.textContent = v;
                    menu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
                    btn.classList.add('selected');
                    if (dd) dd.classList.remove('open');
                    if (other) {
                        other.style.display = v === 'Other' ? '' : 'none';
                        if (v === 'Other') other.focus();
                    }
                    if (field.prop === 'type' && typeof onTypeChange === 'function') {
                        onTypeChange(v);
                    }
                });
            }
            document.addEventListener('click', function (e) {
                if (dd && !dd.contains(e.target)) dd.classList.remove('open');
            });
        });
        cfg.sections.forEach(function (section) {
            section.fields.forEach(function (field) {
                if (field.required) {
                    const el = document.getElementById(field.id);
                    if (el) el.addEventListener('input', function () { el.classList.remove('invalid'); });
                }
            });
        });
    }

    function wireInfoActions() {
        const cancel = document.getElementById('aie-cancel');
        const save = document.getElementById('aie-save');
        if (cancel) {
            cancel.addEventListener('click', function () {
                infoEditMode = false;
                renderAssetInfo();
            });
        }
        if (save) {
            save.addEventListener('click', saveAssetInfo);
        }
    }

    function saveAssetInfo() {
        const rec = currentRecord();
        if (!rec) return;
        const cfg = assetConfig(rec);
        const val = function (id) {
            const el = document.getElementById(id);
            return el ? String(el.value || '').trim() : '';
        };
        const fields = {};
        let ok = true;
        let firstInvalid = null;
        const sel = { type: editDropdowns.type != null ? editDropdowns.type : (rec.type || '') };
        cfg.sections.forEach(function (section) {
            section.fields.forEach(function (field) {
                if (field.kind === 'dropdown') {
                    const v = editDropdowns[field.prop] != null ? editDropdowns[field.prop] : (rec[field.prop] || '');
                    fields[field.prop] = v;
                    if (field.comment) fields[field.comment] = v === 'Other' ? val(field.id + '-other') : '';
                    return;
                }
                const v = val(field.id);
                fields[field.prop] = v;
                const required = typeof field.required === 'function' ? field.required(rec, sel) : field.required;
                if (required) {
                    const el = document.getElementById(field.id);
                    const good = !!v;
                    if (el) el.classList.toggle('invalid', !good);
                    if (!good) {
                        ok = false;
                        if (!firstInvalid) firstInvalid = el;
                    }
                }
            });
        });
        if (!ok) {
            if (firstInvalid) firstInvalid.focus();
            return;
        }
        const fn = cfg.kind === 'home' ? 'updateHome' : 'updateVehicle';
        if (window.MyMaintenanceAssets) window.MyMaintenanceAssets[fn](rec.id, fields);
        infoEditMode = false;
        renderAssetInfo();
    }

    function confirmCancel() {
        infoEditMode = false;
        renderAssetInfo();
    }

    function wireInfoKeyboard() {
        document.addEventListener('keydown', function (e) {
            if (!infoEditMode) return;
            const openDd = document.querySelector('.asset-info-dropdown.open');
            if (e.key === 'Escape') {
                if (openDd) {
                    openDd.classList.remove('open');
                } else {
                    confirmCancel();
                }
                return;
            }
            if (e.key === 'Enter' && !openDd) {
                e.preventDefault();
                saveAssetInfo();
            }
        });
    }

    function wireEditHome() {
        const btn = document.getElementById('asset-edit-home');
        if (!btn) return;
        btn.addEventListener('click', function () {
            if (!currentRecord()) return;
            infoEditMode = !infoEditMode;
            renderAssetInfo();
            if (infoEditMode) {
                const nameInput = document.getElementById('aie-name');
                if (nameInput) nameInput.focus();
            }
        });
    }

    function wireAddressMenu() {
        const menu = document.querySelector('.address-selector .dropdown-menu');
        if (!menu) return;
        menu.addEventListener('click', function (e) {
            const btn = e.target.closest('button');
            if (!btn) return;
            const t = btn.textContent.trim();
            if (t === 'Register new address' || t === 'Register new vehicle') {
                if (currentAssetName) {
                    const toggle = document.querySelector('.address-selector .dropdown-toggle span');
                    if (toggle) toggle.textContent = currentAssetName;
                }
                if (t === 'Register new address' && window.MyMaintenanceHomeRegister) {
                    window.MyMaintenanceHomeRegister.open();
                } else if (t === 'Register new vehicle' && window.MyMaintenanceVehicleRegister) {
                    window.MyMaintenanceVehicleRegister.open();
                }
                return;
            }
            selectAssetLabel(t, btn.getAttribute('data-id') || null);
        });
    }

    function wireAddMaintenance() {
        const btn = document.getElementById('asset-add-maintenance');
        if (!btn) return;
        btn.addEventListener('click', function () {
            if (!window.MyMaintenanceEventModal || !window.MyMaintenanceEvents) return;
            const now = new Date();
            const pad = function (n) { return String(n).padStart(2, '0'); };
            const key = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
            window.MyMaintenanceEventModal.open(key, { plannedMaintenance: true, asset: currentAsset() });
        });
    }

    function wireShowAllDocs() {
        const btn = document.getElementById('asset-show-all-docs');
        if (!btn) return;
        btn.addEventListener('click', function () {
            window.location.href = '../pages/mydocuments.html';
        });
    }

    function wireAddDocument() {
        const btn = document.getElementById('asset-add-document');
        if (!btn) return;
        btn.addEventListener('click', function () {
            const trigger = document.getElementById('doc-add-btn');
            if (trigger) {
                trigger.click();
            } else {
                window.location.href = '../pages/mydocuments.html?add=1';
            }
        });
    }

    function wireViewAllMaintenance() {
        const btn = document.getElementById('asset-view-all-maintenance');
        if (!btn) return;
        btn.addEventListener('click', function () {
            window.location.href = '../pages/myplanning-events.html';
        });
    }

    function registerAssetHandler() {
        return function (e) {
            const rec = e.detail && e.detail.record;
            if (!rec || !window.MyMaintenanceAssets) return;
            currentAssetName = assetLabel(rec);
            currentAssetId = rec.id || null;
            const toggle = document.querySelector('.address-selector .dropdown-toggle span');
            if (toggle) toggle.textContent = currentAssetName;
            buildAssetMenu();
            renderPlanned();
            renderDocs();
            infoEditMode = false;
            renderAssetInfo();
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        const toggle = document.querySelector('.address-selector .dropdown-toggle span');
        const initial = toggle ? toggle.textContent.trim() : '';
        if (initial && REGISTER_LABELS.indexOf(initial) === -1) {
            currentAssetName = initial;
        }
        buildAssetMenu();
        wireAddressMenu();
        wireAddMaintenance();
        wireShowAllDocs();
        wireAddDocument();
        wireViewAllMaintenance();
        wireEditHome();
        wireInfoKeyboard();
        renderPlanned();
        renderDocs();
        renderAssetInfo();
        const params = new URLSearchParams(window.location.search);
        const assetId = params.get('id');
        if (assetId) selectAssetById(assetId);
        window.addEventListener('myevents:changed', renderPlanned);
        window.addEventListener('mydocs:changed', renderDocs);
        window.addEventListener('assets:changed', function () {
            infoEditMode = false;
            buildAssetMenu();
            renderPlanned();
            renderDocs();
            renderAssetInfo();
        });
        window.addEventListener('home:registered', registerAssetHandler());
        window.addEventListener('vehicle:registered', registerAssetHandler());
    });
})();

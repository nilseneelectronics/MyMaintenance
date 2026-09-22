document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const asset = params.get('asset') || '';
    const project = params.get('project') || '';
    if (!asset || !project) {
        window.location.href = 'mydocuments.html';
        return;
    }

    const titleEl = document.getElementById('project-title');
    if (titleEl) titleEl.textContent = project;

    const addDocBtn = document.getElementById('project-add-doc-btn');
    const editBtn = document.getElementById('project-edit-btn');
    const searchInput = document.getElementById('project-doc-search');
    const listEl = document.getElementById('project-doc-list');
    let projectSort = 'uploaded';
    let projectSortReverse = false;
    let selectedEditAsset = asset;

    const PROJECTS_KEY = 'mymaintenance_doc_projects';

    function loadProjects() {
        try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || {}; } catch (_) { return {}; }
    }
    function saveProjects(map) {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(map));
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function projectDocs() {
        if (!window.MyMaintenanceDocs) return [];
        return window.MyMaintenanceDocs.getItems().filter(function (d) {
            return (d.asset || '') === asset && (d.project || '') === project;
        });
    }

    function availableAssetGroups() {
        const assets = window.MyMaintenanceAssets;
        if (!assets) return [];
        return [
            { label: 'Addresses', values: assets.getHomes().map(assets.homeLabel) },
            { label: 'Vehicles', values: assets.getVehicles().map(assets.vehicleLabel) }
        ].map(function (group) {
            group.values = group.values.filter(Boolean).filter(function (value, index, values) {
                return values.indexOf(value) === index;
            });
            return group;
        }).filter(function (group) { return group.values.length; });
    }

    function renderEditAssetMenu(selected) {
        const menu = document.getElementById('project-edit-asset-menu');
        const label = document.querySelector('#project-edit-asset-dropdown .asset-value');
        if (!menu || !label) return;
        const groups = availableAssetGroups();
        const values = groups.reduce(function (all, group) { return all.concat(group.values); }, []);
        if (selected && values.indexOf(selected) === -1) {
            groups.unshift({ label: 'Current asset', values: [selected] });
        }
        menu.innerHTML = groups.map(function (group) {
            return '<li class="asset-optgroup">' + escapeHtml(group.label) + '</li>'
                + group.values.map(function (value) {
                    return '<li><button type="button" data-value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</button></li>';
                }).join('');
        }).join('');
        label.textContent = selected || '-- Select an asset --';
        menu.querySelectorAll('button').forEach(function (button) {
            button.classList.toggle('selected', button.dataset.value === selected);
            button.addEventListener('click', function () {
                selectedEditAsset = button.dataset.value;
                label.textContent = button.textContent;
                menu.style.maxHeight = '0px';
                menu.closest('.custom-dropdown').classList.remove('open');
            });
        });
    }

    function sortBefore(a, b) {
        switch (projectSort) {
            case 'alpha':
                return String(a.name || '').toLowerCase() < String(b.name || '').toLowerCase();
            case 'size':
                return (a.size || 0) < (b.size || 0);
            case 'type':
                return String(a.docType || '').toLowerCase() < String(b.docType || '').toLowerCase();
            case 'asset':
                return String(a.asset || '').toLowerCase() < String(b.asset || '').toLowerCase();
            case 'project':
                return String(a.project || '').toLowerCase() < String(b.project || '').toLowerCase();
            case 'performed':
                return String(a.performed || '') > String(b.performed || '');
            default:
                return String(a.uploaded || '') > String(b.uploaded || '');
        }
    }

    function sortComparator() {
        return function (a, b) {
            const result = sortBefore(a, b) ? -1 : (sortBefore(b, a) ? 1 : 0);
            return projectSortReverse ? -result : result;
        };
    }

    function renderOverview() {
        const overviewEl = document.getElementById('project-overview');
        if (!overviewEl) return;
        const docs = projectDocs();
        const count = docs.length;
        let cost = 0;
        docs.forEach(function (d) {
            if (d.receiptTotal != null && !isNaN(Number(d.receiptTotal))) {
                cost += Number(d.receiptTotal);
                return;
            }
            if (!Array.isArray(d.receiptItems)) return;
            d.receiptItems.forEach(function (item) {
                const price = parseFloat(String(item.price || '0').replace(/\s/g, '').replace(',', '.'));
                const qty = parseFloat(String(item.quantity || '1').replace(/\s/g, '').replace(',', '.'));
                if (!isNaN(price)) cost += price * (isNaN(qty) ? 1 : qty);
            });
        });
        overviewEl.innerHTML = '<div class="project-overview-row">'
            + '<div class="project-overview-cell"><span class="project-overview-label">Documents</span><span class="project-overview-value">' + count + '</span></div>'
             + '<div class="project-overview-cell"><span class="project-overview-label">Cost</span><span class="project-overview-value">' + (cost ? 'kr ' + cost.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'kr 0') + '</span></div>'
            + '</div>';
    }

    function renderList(query) {
        if (!listEl) return;
        renderOverview();
        const docs = projectDocs().slice().sort(sortComparator());
        const q = query ? query.trim().toLowerCase() : '';
        const filtered = q ? docs.filter(function (d) {
            return String(d.name || '').toLowerCase().indexOf(q) !== -1
                || String(d.docType || '').toLowerCase().indexOf(q) !== -1;
        }) : docs;

        if (!filtered.length) {
            listEl.innerHTML = '<p class="doc-empty">' + (q ? 'No matching documents.' : 'No documents in this project yet.') + '</p>';
            return;
        }
        const head = window.MyMaintenanceDocs.headerRowHtml();
        const rows = filtered.map(function (it) { return window.MyMaintenanceDocs.rowHtml(it); }).join('');
        listEl.innerHTML = head + rows;
        listEl.querySelectorAll('.doc-row-open[data-doc-id]').forEach(function (el) {
            const id = el.getAttribute('data-doc-id');
            el.addEventListener('click', function (e) {
                if (e.target.closest('.doc-edit-btn')) return;
                const doc = window.MyMaintenanceDocs.getItems().filter(function (d) { return d.id === id; })[0];
                if (doc) window.MyMaintenanceDocs.openPreview(doc);
            });
            const eb = el.querySelector('.doc-edit-btn');
            if (eb) {
                eb.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const doc = window.MyMaintenanceDocs.getItems().filter(function (d) { return d.id === id; })[0];
                    if (doc) window.MyMaintenanceDocs.openEdit(doc);
                });
            }
        });
    }

    // Open the shared add-document popup pre-filled with this asset + project.
    if (addDocBtn) {
        addDocBtn.addEventListener('click', function () {
            window.MyMaintenanceDocumentContext = { asset: asset, project: project };
            const trigger = document.getElementById('doc-add-btn');
            if (trigger) trigger.click();
        });
    }
    const scanDocBtn = document.getElementById('project-scan-doc-btn');
    if (scanDocBtn) {
        scanDocBtn.addEventListener('click', function () {
            window.MyMaintenanceDocumentContext = { asset: asset, project: project };
            const trigger = document.getElementById('doc-scan-btn');
            if (trigger) trigger.click();
        });
    }

    // Edit project: rename, move to another asset, or delete it.
    if (editBtn) {
        editBtn.addEventListener('click', function () {
            const nameInput = document.getElementById('project-edit-name');
            const delBtn = document.getElementById('project-edit-delete');
            const popupEl = document.getElementById('project-edit-popup');
            if (nameInput) nameInput.value = project;
            selectedEditAsset = asset;
            renderEditAssetMenu(selectedEditAsset);
            if (delBtn) delBtn.style.display = '';
            if (popupEl) popupEl.style.display = 'flex';
        });
    }
    window.addEventListener('assets:changed', function () {
        if (document.getElementById('project-edit-popup')?.style.display === 'flex') {
            renderEditAssetMenu(selectedEditAsset);
        }
    });
    const editCancel = document.getElementById('project-edit-cancel');
    if (editCancel) editCancel.addEventListener('click', function () {
        const popupEl = document.getElementById('project-edit-popup');
        if (popupEl) popupEl.style.display = 'none';
    });
    const editSave = document.getElementById('project-edit-save');
    if (editSave) editSave.addEventListener('click', async function () {
        const nameInput = document.getElementById('project-edit-name');
        const newName = nameInput ? nameInput.value.trim() : '';
        const newAsset = selectedEditAsset || asset;
        if (!newName || !newAsset) {
            if (window.MyMaintenanceCommonUi) window.MyMaintenanceCommonUi.alert('Enter a project name.');
            return;
        }
        const existingDestination = (loadProjects()[newAsset] || []).some(function (name) {
            return name === newName && !(newAsset === asset && newName === project);
        });
        if (existingDestination) {
            if (window.MyMaintenanceCommonUi) window.MyMaintenanceCommonUi.alert('A project with that name already exists for this asset.');
            return;
        }
        const saveButton = editSave;
        saveButton.disabled = true;
        try {
            const map = loadProjects();
            const oldList = map[asset] || [];
            const oldIndex = oldList.indexOf(project);
            if (oldIndex !== -1) oldList.splice(oldIndex, 1);
            map[asset] = oldList;
            if (!map[newAsset]) map[newAsset] = [];
            if (map[newAsset].indexOf(newName) === -1) map[newAsset].unshift(newName);
            saveProjects(map);
            if (window.MyMaintenanceProjects) await window.MyMaintenanceProjects.rename(asset, project, newName, newAsset);
            // Update every linked document when the project is renamed or moved.
            window.MyMaintenanceDocs.getItems().forEach(function (d) {
                if ((d.asset || '') === asset && (d.project || '') === project) {
                    d.asset = newAsset;
                    d.project = newName;
                    if (window.MyMaintenanceDocs.persistItem) window.MyMaintenanceDocs.persistItem(d);
                }
            });
            const popupEl = document.getElementById('project-edit-popup');
            if (popupEl) popupEl.style.display = 'none';
            window.location.href = 'myproject.html?asset=' + encodeURIComponent(newAsset) + '&project=' + encodeURIComponent(newName);
        } finally {
            saveButton.disabled = false;
        }
    });
    const editDelete = document.getElementById('project-edit-delete');
    if (editDelete) editDelete.addEventListener('click', function () {
        const doDelete = async function () {
            const map = loadProjects();
            const list = map[asset] || [];
            const idx = list.indexOf(project);
            if (idx !== -1) list.splice(idx, 1);
            map[asset] = list;
            saveProjects(map);
            if (window.MyMaintenanceProjects) await window.MyMaintenanceProjects.remove(asset, project);
            window.MyMaintenanceDocs.getItems().forEach(function (d) {
                if ((d.asset || '') === asset && (d.project || '') === project) {
                    d.project = '';
                    if (window.MyMaintenanceDocs.persistItem) window.MyMaintenanceDocs.persistItem(d);
                }
            });
            window.location.href = 'mydocuments.html';
        };
        const popupEl = document.getElementById('project-edit-popup');
        if (popupEl) popupEl.style.display = 'none';
        if (window.MyMaintenanceCommonUi) {
            window.MyMaintenanceCommonUi.confirm('Delete project "' + project + '"? Documents stay, but lose their project link.', {
                title: 'Delete project',
                confirmLabel: 'Delete',
                destructive: true
            }).then(function (ok) { if (ok) doDelete(); });
        } else {
            doDelete();
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        const popupEl = document.getElementById('project-edit-popup');
        if (popupEl && popupEl.style.display === 'flex') popupEl.style.display = 'none';
    });

    if (searchInput) searchInput.addEventListener('input', function () { renderList(searchInput.value); });

    const sortDropdown = document.getElementById('project-sort-dropdown');
    const sortInvert = document.getElementById('project-sort-invert');
    if (sortDropdown) {
        sortDropdown.querySelectorAll('.dropdown-menu button').forEach(function (button) {
            button.addEventListener('click', function () {
                projectSort = button.getAttribute('data-sort') || 'uploaded';
                sortDropdown.querySelector('.dropdown-toggle span').textContent = button.textContent;
                sortDropdown.classList.remove('open');
                renderList(searchInput ? searchInput.value : '');
            });
        });
    }
    if (sortInvert) {
        sortInvert.addEventListener('click', function () {
            projectSortReverse = !projectSortReverse;
            sortInvert.classList.toggle('active', projectSortReverse);
            if (sortDropdown) sortDropdown.classList.toggle('inverted', projectSortReverse);
            renderList(searchInput ? searchInput.value : '');
        });
    }
    window.addEventListener('mydocs:changed', function () { renderList(searchInput ? searchInput.value : ''); });

    // The shared document page hydrate may still be loading; re-render when ready.
    if (window.MyMaintenanceDocs && window.MyMaintenanceDocs.refresh) {
        window.MyMaintenanceDocs.refresh().then(function () { renderList(''); });
    }
    if (window.MyMaintenanceProjects) {
        window.MyMaintenanceProjects.hydrate().then(function () { renderList(searchInput ? searchInput.value : ''); });
    }
    window.addEventListener('projects:changed', function () { renderList(searchInput ? searchInput.value : ''); });
    setTimeout(function () { renderList(''); }, 300);
});

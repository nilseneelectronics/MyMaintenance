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

    const PROJECTS_KEY = 'mymaintenance_doc_projects';

    function loadProjects() {
        try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || {}; } catch (_) { return {}; }
    }
    function saveProjects(map) {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(map));
    }
    function projectDocs() {
        if (!window.MyMaintenanceDocs) return [];
        return window.MyMaintenanceDocs.getItems().filter(function (d) {
            return (d.asset || '') === asset && (d.project || '') === project;
        });
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
            + '<div class="project-overview-cell"><span class="project-overview-label">Price</span><span class="project-overview-value">' + (cost ? 'kr ' + cost.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'kr 0') + '</span></div>'
            + '</div>';
    }

    function renderList(query) {
        if (!listEl) return;
        renderOverview();
        const docs = projectDocs().slice().sort(function (a, b) {
            return String(b.uploaded || '').localeCompare(String(a.uploaded || ''));
        });
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

    // Edit project: rename or delete it.
    if (editBtn) {
        editBtn.addEventListener('click', function () {
            const nameInput = document.getElementById('project-edit-name');
            const delBtn = document.getElementById('project-edit-delete');
            const popupEl = document.getElementById('project-edit-popup');
            if (nameInput) nameInput.value = project;
            if (delBtn) delBtn.style.display = '';
            if (popupEl) popupEl.style.display = 'flex';
        });
    }
    const editCancel = document.getElementById('project-edit-cancel');
    if (editCancel) editCancel.addEventListener('click', function () {
        const popupEl = document.getElementById('project-edit-popup');
        if (popupEl) popupEl.style.display = 'none';
    });
    const editSave = document.getElementById('project-edit-save');
    if (editSave) editSave.addEventListener('click', async function () {
        const nameInput = document.getElementById('project-edit-name');
        const newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) {
            if (window.MyMaintenanceCommonUi) window.MyMaintenanceCommonUi.alert('Enter a project name.');
            return;
        }
        const map = loadProjects();
        const list = map[asset] || [];
        const idx = list.indexOf(project);
        if (idx !== -1) list.splice(idx, 1);
        if (list.indexOf(newName) === -1) list.unshift(newName);
        map[asset] = list;
        saveProjects(map);
        if (window.MyMaintenanceProjects) await window.MyMaintenanceProjects.rename(asset, project, newName);
        // Rename the project on all its documents and persist the change.
        window.MyMaintenanceDocs.getItems().forEach(function (d) {
            if ((d.asset || '') === asset && (d.project || '') === project) {
                d.project = newName;
                if (window.MyMaintenanceDocs.persistItem) window.MyMaintenanceDocs.persistItem(d);
            }
        });
        const popupEl = document.getElementById('project-edit-popup');
        if (popupEl) popupEl.style.display = 'none';
        window.location.href = 'myproject.html?asset=' + encodeURIComponent(asset) + '&project=' + encodeURIComponent(newName);
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
        if (window.MyMaintenanceCommonUi) {
            window.MyMaintenanceCommonUi.confirm('Delete project "' + project + '"? Documents stay, but lose their project link.', {
                title: 'Delete project',
                confirmLabel: 'Delete'
            }).then(function (ok) { if (ok) doDelete(); });
        } else {
            doDelete();
        }
    });

    if (searchInput) searchInput.addEventListener('input', function () { renderList(searchInput.value); });
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

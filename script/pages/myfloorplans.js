document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('fp-create-btn');
    const groupsEl = document.getElementById('fp-groups');
    if (!groupsEl) return;

    const STORE_KEY = 'floorplan_files';
    let preselectedAsset = '';

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function loadPlans() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (_) { return []; }
    }

    function formatDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const pad = function (n) { return String(n).padStart(2, '0'); };
        return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
    }

    function allAssets() {
        if (!window.MyMaintenanceAssets) return { homes: [], vehicles: [] };
        return {
            homes: window.MyMaintenanceAssets.getHomes(),
            vehicles: window.MyMaintenanceAssets.getVehicles()
        };
    }

    function assetLabel(rec, kind) {
        if (!window.MyMaintenanceAssets || !rec) return '';
        return kind === 'homes'
            ? window.MyMaintenanceAssets.homeLabel(rec)
            : window.MyMaintenanceAssets.vehicleLabel(rec);
    }

    function noPreviewSvg() {
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#1A1A1A"/><text x="150" y="105" text-anchor="middle" fill="#20B2AA" font-family="Arial" font-size="16">No preview</text></svg>'
        );
    }

    function planCard(p) {
        return '<div class="fp-grid-card" data-id="' + esc(p.id) + '">'
            + '<button type="button" class="fp-grid-preview fp-grid-open" aria-label="Edit ' + esc(p.name || 'floor plan') + '"><img src="' + (p.preview || noPreviewSvg()) + '" alt="' + esc(p.name || 'Floor plan') + '"></button>'
            + '<button type="button" class="fp-grid-name fp-grid-open" aria-label="Edit ' + esc(p.name || 'floor plan') + '">' + esc(p.name || p.id) + '</button>'
            + '<span class="fp-grid-date">' + formatDate(p.updatedAt) + '</span>'
            + '<span class="fp-grid-actions">'
            + '<button type="button" class="fp-grid-edit fp-grid-open" aria-label="Edit floor plan"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg> Edit</button>'
            + '<button type="button" class="fp-grid-del" data-id="' + esc(p.id) + '" aria-label="Delete floor plan"><svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M256-200q-23.53 0-40.26-16.74Q199-233.47 199-257v-483h-13v-60h188v-30h212v30h188v60h-13v483q0 23.53-16.74 40.26Q716.53-200 693-200H256Zm103-100h60v-336h-60v336Zm182 0h60v-336h-60v336Z"/></svg></button>'
            + '</span>'
            + '</div>';
    }

    function deletePlan(id) {
        const list = loadPlans().filter(function (p) { return p.id !== id; });
        localStorage.setItem(STORE_KEY, JSON.stringify(list));
        try { localStorage.removeItem('floorplan_data_' + id); } catch (_) {}
        if (window.MyMaintenanceFloorplans) window.MyMaintenanceFloorplans.remove(id);
        render();
    }

    function bindGroupToggle(grp) {
        const head = grp.querySelector('.doc-group-header');
        const content = grp.querySelector('.subgroup-content');
        if (!head || !content) return;
        // The whole header row (arrow + asset name) toggles show/hide, like the
        // document groups on mydocuments. The Create button stops propagation so
        // it keeps its own action.
        head.addEventListener('click', function (e) {
            if (e.target.closest('.fp-group-create')) return;
            const closing = !grp.classList.contains('collapsed');
            if (closing) {
                content.style.maxHeight = content.scrollHeight + 'px';
                void content.offsetHeight;
                grp.classList.add('collapsed');
                content.style.maxHeight = '0px';
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                grp.classList.remove('collapsed');
                setTimeout(function () { content.style.maxHeight = 'none'; }, 320);
            }
        });
    }

    function render() {
        const plans = loadPlans();
        const { homes, vehicles } = allAssets();
        const assets = [];
        homes.forEach(function (h) { assets.push({ label: assetLabel(h, 'homes'), planCount: 0 }); });
        vehicles.forEach(function (v) { assets.push({ label: assetLabel(v, 'vehicles'), planCount: 0 }); });

        plans.forEach(function (p) {
            const a = assets.find(function (x) { return x.label === p.asset; });
            if (a) a.planCount += 1;
        });

        if (!assets.length) {
            groupsEl.innerHTML = '<div class="fp-grid-hint">Register a home or vehicle to start adding floor plans.</div>';
            return;
        }

        groupsEl.innerHTML = '';
        if (!plans.length) {
            const hint = document.createElement('div');
            hint.className = 'fp-grid-hint';
            hint.textContent = 'No floorplan created yet';
            groupsEl.appendChild(hint);
        }
        assets.forEach(function (asset) {
            const assetPlans = plans.filter(function (p) { return p.asset === asset.label; });
            const grp = document.createElement('div');
            grp.className = 'subgroup doc-group';
            grp.dataset.asset = asset.label;

            const head = document.createElement('div');
            head.className = 'doc-group-header';
            head.innerHTML = '<button class="collapse-toggle"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
                + '<h4>' + esc(asset.label) + '</h4>'
                + '<button type="button" class="view-button fp-group-create" data-asset="' + esc(asset.label) + '">Create Floorplan</button>';

            const content = document.createElement('div');
            content.className = 'subgroup-content';
            content.innerHTML = assetPlans.length
                ? '<div class="fp-grid">' + assetPlans.map(planCard).join('') + '</div>'
                : '<div class="fp-grid-empty">No floor plans for this asset yet.</div>';

            grp.appendChild(head);
            grp.appendChild(content);
            groupsEl.appendChild(grp);
            bindGroupToggle(grp);

            if (preselectedAsset && asset.label === preselectedAsset) {
                // expand the matching group so its plans are visible on arrival
                content.style.maxHeight = content.scrollHeight + 'px';
                grp.classList.remove('collapsed');
                setTimeout(function () { content.style.maxHeight = 'none'; }, 320);
            }
        });

        // Group create buttons
        groupsEl.querySelectorAll('.fp-group-create').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                window.location.href = 'tool-floorplan.html?asset=' + encodeURIComponent(btn.dataset.asset);
            });
        });

        // Card click / Edit -> open that plan in the tool
        groupsEl.querySelectorAll('.fp-grid-card').forEach(function (card) {
            const open = function () {
                const grp = card.closest('.doc-group');
                const asset = grp ? grp.dataset.asset : '';
                window.location.href = 'tool-floorplan.html?open=' + encodeURIComponent(card.dataset.id) + '&asset=' + encodeURIComponent(asset);
            };
            card.querySelectorAll('.fp-grid-open').forEach(function (el) {
                el.addEventListener('click', open);
            });
            card.querySelectorAll('.fp-grid-del').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const plan = loadPlans().filter(function (p) { return p.id === id; })[0];
                    const name = plan && plan.name ? plan.name : 'this floor plan';
                    const doDelete = function () {
                        deletePlan(id);
                        if (window.MyMaintenanceCommonUi) {
                            window.MyMaintenanceCommonUi.alert('"' + name + '" was deleted.');
                        }
                    };
                    if (window.MyMaintenanceCommonUi) {
                        window.MyMaintenanceCommonUi.confirm('Delete "' + name + '"? This cannot be undone.', {
                            title: 'Delete floor plan',
                            confirmLabel: 'Delete'
                        }).then(function (ok) { if (ok) doDelete(); });
                    } else {
                        doDelete();
                    }
                });
            });
        });
    }

    // Preselect an asset when navigated from myhomes/myvehicles (?asset=<label>)
    const params = new URLSearchParams(window.location.search);
    preselectedAsset = params.get('asset') || '';

    // Top-level create button: use the preselected asset if given, otherwise the first asset
    if (createBtn) {
        createBtn.addEventListener('click', function () {
            let target = preselectedAsset;
            if (!target) {
                const { homes, vehicles } = allAssets();
                if (homes.length) target = assetLabel(homes[0], 'homes');
                else if (vehicles.length) target = assetLabel(vehicles[0], 'vehicles');
            }
            if (!target) {
                if (window.MyMaintenanceCommonUi) {
                    window.MyMaintenanceCommonUi.alert('Register a home or vehicle first so the floor plan is linked to it.');
                }
                return;
            }
            window.location.href = 'tool-floorplan.html?asset=' + encodeURIComponent(target);
        });
    }

    render();
    window.addEventListener('floorplans:changed', render);
    // Assets are loaded asynchronously from the database; re-render when they
    // arrive so every registered home/vehicle shows as a group.
    window.addEventListener('assets:changed', render);
    const assetsReady = window.MyMaintenanceAssets && window.MyMaintenanceAssets.hydrate
        ? window.MyMaintenanceAssets.hydrate()
        : Promise.resolve();
    const plansReady = window.MyMaintenanceFloorplans
        ? window.MyMaintenanceFloorplans.hydrate()
        : Promise.resolve();
    Promise.all([assetsReady, plansReady]).then(render);
});

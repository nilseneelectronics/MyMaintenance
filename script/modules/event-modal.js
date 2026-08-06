/* event-modal.js - Shared "Add event" modal with Planned Maintenance support */

(function () {
    function init() {
        const modal = document.getElementById('event-modal');
        if (!modal) return;

        const evName = document.getElementById('ev-name');
        const evStartDate = document.getElementById('ev-start-date');
        const evFinishDate = document.getElementById('ev-finish-date');
        const evStartTime = document.getElementById('ev-start-time');
        const evFinishTime = document.getElementById('ev-finish-time');
        const evLocation = document.getElementById('ev-location');
        const evDesc = document.getElementById('ev-desc');
        const evCancel = document.getElementById('ev-cancel');
        const evAdd = document.getElementById('ev-add');
        const evPlanned = document.getElementById('ev-planned');
        const evAssetWrap = document.getElementById('ev-asset-wrap');
        const evAssetDropdown = document.getElementById('ev-asset-dropdown');
        const evAssetToggle = document.getElementById('ev-asset-toggle');
        const evAssetMenu = document.getElementById('ev-asset-menu');
        const evAssetValueEl = document.querySelector('#ev-asset-toggle .asset-value');
        const evAssetOther = document.getElementById('ev-asset-other');
        const evModalTitle = document.getElementById('ev-modal-title');

        let state = { planned: false, asset: '', editingKey: null, editingIndex: -1 };

        function buildAssetMenu() {
            if (!evAssetMenu || !window.MyMaintenanceEvents) return;
            evAssetMenu.innerHTML = '';
            const groups = window.MyMaintenanceEvents.getAssetGroups();
            groups.forEach(function (grp) {
                const g = document.createElement('li');
                g.className = 'asset-optgroup';
                g.textContent = grp.group;
                evAssetMenu.appendChild(g);
                grp.options.forEach(function (opt) {
                    const li = document.createElement('li');
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.dataset.value = opt;
                    b.textContent = opt;
                    li.appendChild(b);
                    evAssetMenu.appendChild(li);
                });
            });
            const otherLi = document.createElement('li');
            const otherBtn = document.createElement('button');
            otherBtn.type = 'button';
            otherBtn.dataset.value = '__other__';
            otherBtn.textContent = 'Other';
            otherLi.appendChild(otherBtn);
            evAssetMenu.appendChild(otherLi);
        }

        function selectAsset(value) {
            state.asset = value;
            if (evAssetValueEl) evAssetValueEl.textContent = value;
            if (evAssetMenu) {
                evAssetMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
                const btn = evAssetMenu.querySelector('button[data-value="' + value + '"]');
                if (btn) btn.classList.add('selected');
            }
            if (evAssetDropdown) evAssetDropdown.classList.remove('open');
            if (evAssetOther) {
                evAssetOther.style.display = value === '__other__' ? '' : 'none';
                if (value === '__other__') evAssetOther.focus();
            }
        }

        function resetFields() {
            if (evName) evName.value = '';
            if (evLocation) evLocation.value = '';
            if (evDesc) evDesc.value = '';
            state.planned = false;
            state.asset = '';
            if (evPlanned) evPlanned.checked = false;
            if (evAssetWrap) evAssetWrap.style.display = 'none';
            if (evAssetValueEl) evAssetValueEl.textContent = '-- Select an asset --';
            if (evAssetMenu) evAssetMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
            if (evAssetOther) {
                evAssetOther.value = '';
                evAssetOther.style.display = 'none';
            }
            if (evAssetDropdown) evAssetDropdown.classList.remove('open');
        }

        function open(key, opts) {
            if (!modal) return;
            modal.classList.add('open');
            resetFields();
            state.editingKey = null;
            state.editingIndex = -1;
            const editing = !!(opts && opts.event && opts.key);
            if (evModalTitle) evModalTitle.textContent = editing ? 'Edit event' : 'Add event';
            if (evAdd) evAdd.textContent = editing ? 'Save' : 'Add';

            if (editing) {
                const e = opts.event;
                if (evName) evName.value = e.name || '';
                if (evStartDate) evStartDate.value = e.startDate || key;
                if (evFinishDate) evFinishDate.value = e.finishDate || key;
                if (evStartTime) evStartTime.value = e.startTime || '';
                if (evFinishTime) evFinishTime.value = e.finishTime || '';
                if (evLocation) evLocation.value = e.location || '';
                if (evDesc) evDesc.value = e.description || '';
                state.editingKey = opts.key;
                state.editingIndex = opts.index != null ? opts.index : -1;
                if (e.isPlannedMaintenance) {
                    state.planned = true;
                    if (evPlanned) evPlanned.checked = true;
                    if (evAssetWrap) evAssetWrap.style.display = '';
                    if (e.asset) selectAsset(e.asset);
                }
            } else {
                if (evStartDate) evStartDate.value = key;
                if (evFinishDate) evFinishDate.value = key;
                const now = new Date();
                const mins = now.getMinutes();
                const rounded = new Date(now);
                rounded.setMinutes(Math.ceil(mins / 15) * 15, 0, 0);
                const h = String(rounded.getHours()).padStart(2, '0');
                const m = String(rounded.getMinutes()).padStart(2, '0');
                const later = new Date(rounded.getTime() + 60 * 60 * 1000);
                const h2 = String(later.getHours()).padStart(2, '0');
                const m2 = String(later.getMinutes()).padStart(2, '0');
                if (evStartTime) evStartTime.value = h + ':' + m;
                if (evFinishTime) evFinishTime.value = h2 + ':' + m2;
                if (opts && opts.plannedMaintenance && evPlanned) {
                    evPlanned.checked = true;
                    state.planned = true;
                    if (evAssetWrap) evAssetWrap.style.display = '';
                    if (opts.asset) selectAsset(opts.asset);
                }
            }
            if (evName) evName.focus();
        }

        function close() {
            if (modal) modal.classList.remove('open');
            state.editingKey = null;
            state.editingIndex = -1;
        }

        if (evCancel) evCancel.addEventListener('click', close);
        if (evAdd) evAdd.addEventListener('click', function () {
            if (!window.MyMaintenanceEvents) return;
            const name = evName ? evName.value.trim() : '';
            const startDate = evStartDate ? evStartDate.value : '';
            if (!name || !startDate) return;
            const isPlanned = !!(evPlanned && evPlanned.checked);
            const asset = isPlanned ? state.asset : '';
            const events = window.MyMaintenanceEvents.load();
            const ev = {
                name: name,
                startDate: startDate,
                finishDate: evFinishDate ? evFinishDate.value : startDate,
                startTime: evStartTime ? evStartTime.value : '',
                finishTime: evFinishTime ? evFinishTime.value : '',
                location: evLocation ? evLocation.value.trim() : '',
                description: evDesc ? evDesc.value.trim() : '',
                isPlannedMaintenance: isPlanned,
                asset: asset
            };
            if (state.editingKey && state.editingIndex >= 0) {
                if (state.editingKey === startDate) {
                    if (events[state.editingKey] && events[state.editingKey][state.editingIndex]) {
                        events[state.editingKey][state.editingIndex] = ev;
                    }
                } else {
                    if (events[state.editingKey]) events[state.editingKey].splice(state.editingIndex, 1);
                    if (events[state.editingKey] && events[state.editingKey].length === 0) delete events[state.editingKey];
                    if (!events[startDate]) events[startDate] = [];
                    events[startDate].push(ev);
                }
            } else {
                if (!events[startDate]) events[startDate] = [];
                events[startDate].push(ev);
            }
            window.MyMaintenanceEvents.save(events);
            close();
        });
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        if (evName) evName.addEventListener('keydown', function (e) { if (e.key === 'Enter' && evAdd) evAdd.click(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

        if (evPlanned) {
            evPlanned.addEventListener('change', function () {
                state.planned = evPlanned.checked;
                if (evAssetWrap) evAssetWrap.style.display = state.planned ? '' : 'none';
                if (!state.planned) {
                    state.asset = '';
                    if (evAssetValueEl) evAssetValueEl.textContent = '-- Select an asset --';
                    if (evAssetOther) { evAssetOther.value = ''; evAssetOther.style.display = 'none'; }
                }
            });
        }
        if (evAssetToggle) {
            evAssetToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                if (evAssetDropdown) evAssetDropdown.classList.toggle('open');
            });
        }
        if (evAssetMenu) {
            evAssetMenu.addEventListener('click', function (e) {
                const btn = e.target.closest('button[data-value]');
                if (!btn) return;
                selectAsset(btn.dataset.value);
                if (evAssetValueEl) evAssetValueEl.textContent = btn.textContent;
            });
        }
        document.addEventListener('click', function (e) {
            if (evAssetDropdown && !evAssetDropdown.contains(e.target)) evAssetDropdown.classList.remove('open');
        });

        buildAssetMenu();

        window.MyMaintenanceEventModal = { open: open, close: close };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* events.js - Shared calendar / planned maintenance helpers */

(function () {
    const STORAGE_KEY = 'floorplan_calendar_events';

    const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const ASSET_GROUPS = [
        { group: 'Addresses', options: ['Address 1, Street 123, 5000 City', 'Address 2 - Cabin, Mountain Road 45, 6000 City'] },
        { group: 'Vehicles', options: ['Car 1 - Tesla Model Y', 'Car 2 - Volvo XC90', 'Boat - Bayliner 255'] }
    ];

    function getAssetGroups() {
        const groups = [];
        if (window.MyMaintenanceAssets) {
            const homes = window.MyMaintenanceAssets.getHomes();
            if (homes && homes.length) {
                groups.push({
                    group: 'Addresses',
                    options: homes.map(function (h) { return window.MyMaintenanceAssets.homeLabel(h); })
                });
            }
            const vehicles = window.MyMaintenanceAssets.getVehicles();
            if (vehicles && vehicles.length) {
                groups.push({
                    group: 'Vehicles',
                    options: vehicles.map(function (v) { return window.MyMaintenanceAssets.vehicleLabel(v); })
                });
            }
        }
        if (!groups.length) {
            groups.push(ASSET_GROUPS[0]);
            groups.push(ASSET_GROUPS[1]);
        }
        return groups;
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function todayKey() {
        const n = new Date();
        return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
    }

    function defaultData() {
        return {
            '2026-08-17': [{ name: 'Going home', startDate: '2026-08-17', finishDate: '2026-08-17', startTime: '14:00', finishTime: '16:00', location: 'Cabin', description: 'Pack up and head back to the city' }],
            '2026-08-20': [{ name: 'Oil change', startDate: '2026-08-20', finishDate: '2026-08-20', startTime: '09:00', finishTime: '10:00', location: 'City Auto', description: '', isPlannedMaintenance: true, asset: 'Car 1 - Tesla Model Y' }],
            '2026-09-15': [{ name: 'Roof inspection', startDate: '2026-09-15', finishDate: '2026-09-15', startTime: '10:00', finishTime: '12:00', location: 'Address 1, Street 123, 5000 City', description: '', isPlannedMaintenance: true, asset: 'Address 1, Street 123, 5000 City' }],
            '2026-10-02': [{ name: 'HVAC filter change', startDate: '2026-10-02', finishDate: '2026-10-02', startTime: '08:00', finishTime: '09:00', location: 'Address 1, Street 123, 5000 City', description: '', isPlannedMaintenance: true, asset: 'Address 1, Street 123, 5000 City' }],
            '2026-10-30': [{ name: 'Winterize boat', startDate: '2026-10-30', finishDate: '2026-10-30', startTime: '10:00', finishTime: '14:00', location: 'Harbour', description: '', isPlannedMaintenance: true, asset: 'Boat - Bayliner 255' }],
            '2026-11-10': [{ name: 'Tire rotation', startDate: '2026-11-10', finishDate: '2026-11-10', startTime: '14:00', finishTime: '15:00', location: 'City Auto', description: '', isPlannedMaintenance: true, asset: 'Car 1 - Tesla Model Y' }]
        };
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw !== null) return JSON.parse(raw);
        } catch (_) {}
        const seed = defaultData();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seed)); } catch (_) {}
        return seed;
    }

    function save(events) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        window.dispatchEvent(new CustomEvent('myevents:changed'));
    }

    function getAll() {
        const events = load();
        const out = [];
        for (const key of Object.keys(events)) {
            const arr = events[key];
            if (!Array.isArray(arr)) continue;
            for (const ev of arr) out.push({ key: key, ev: ev });
        }
        return out;
    }

    function upcoming(limit) {
        const tk = todayKey();
        const list = getAll()
            .filter(function (item) { return item.key >= tk; })
            .sort(function (a, b) {
                return (a.key + (a.ev.startTime || '')) < (b.key + (b.ev.startTime || '')) ? -1 : 1;
            });
        return limit ? list.slice(0, limit) : list;
    }

    function plannedMaintenance(limit, asset) {
        const list = upcoming(null).filter(function (item) {
            if (!item.ev.isPlannedMaintenance) return false;
            if (!asset) return true;
            return String(item.ev.asset || '').trim() === String(asset).trim();
        });
        return limit ? list.slice(0, limit) : list;
    }

    function formatDateLabel(key) {
        const parts = String(key).split('-');
        if (parts.length !== 3) return key;
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        const dt = new Date(y, m, d);
        return DAYS_SHORT[(dt.getDay() + 6) % 7] + ' ' + d + ' ' + MONTHS_SHORT[m];
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function calendarIcon() {
        return '<svg class="ev-calendar-icon" xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#20b2aa" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z"/></svg>';
    }

    function eventHeaderRowHtml(cols) {
        cols = cols || {};
        const nameLabel = cols.name || 'Name';
        const assetLabel = cols.asset || 'Asset';
        const dateLabel = cols.date || 'Date';
        const timeLabel = cols.time || 'Time';
        return '<div class="ev-row ev-header-row">'
            + '<div class="ev-row-left">'
            + '<span class="ev-cell ev-cell-icon"></span>'
            + '<span class="ev-cell ev-cell-name ev-col-label">' + escapeHtml(nameLabel) + '</span>'
            + '<span class="ev-cell ev-cell-asset ev-col-label">' + escapeHtml(assetLabel) + '</span>'
            + '</div>'
            + '<div class="ev-row-right">'
            + '<span class="ev-cell ev-cell-date ev-col-label">' + escapeHtml(dateLabel) + '</span>'
            + '<span class="ev-cell ev-cell-time ev-col-label">' + escapeHtml(timeLabel) + '</span>'
            + '</div>'
            + '</div>';
    }

    function eventRowHtml(key, ev) {
        const asset = String(ev.asset || ev.location || '').trim();
        const label = formatDateLabel(key);
        const time = ev.startTime ? escapeHtml(ev.startTime) : '';
        return '<div class="ev-row ev-row-open" data-key="' + escapeHtml(key) + '">'
            + '<div class="ev-row-left">'
            + calendarIcon()
            + '<span class="ev-cell ev-cell-name">' + escapeHtml(ev.name) + '</span>'
            + '<span class="ev-cell ev-cell-asset">' + escapeHtml(asset) + '</span>'
            + '</div>'
            + '<div class="ev-row-right">'
            + '<span class="ev-cell ev-cell-date">' + escapeHtml(label) + '</span>'
            + '<span class="ev-cell ev-cell-time">' + time + '</span>'
            + '</div>'
            + '</div>';
    }

    window.MyMaintenanceEvents = {
        STORAGE_KEY: STORAGE_KEY,
        ASSET_GROUPS: ASSET_GROUPS,
        getAssetGroups: getAssetGroups,
        load: load,
        save: save,
        getAll: getAll,
        upcoming: upcoming,
        plannedMaintenance: plannedMaintenance,
        formatDateLabel: formatDateLabel,
        todayKey: todayKey,
        eventHeaderRowHtml: eventHeaderRowHtml,
        eventRowHtml: eventRowHtml
    };
})();

/* events.js - Shared calendar / planned maintenance helpers */

(function () {
    const STORAGE_KEY = 'floorplan_calendar_events';

    const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const ASSET_GROUPS = [];
    let eventsCache = {};
    let knownEventIds = new Set();

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
        return groups;
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function todayKey() {
        const n = new Date();
        return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
    }

    function defaultData() {
        return {};
    }

    function load() {
        return eventsCache;
    }

    function save(events) {
        eventsCache = events || {};
        persist(eventsCache);
        window.dispatchEvent(new CustomEvent('myevents:changed'));
    }

    function newId() { return crypto.randomUUID(); }

    function eventRow(key, event) {
        const startDate = event.startDate || key;
        const finishDate = event.finishDate || startDate;
        const startTime = event.startTime || '00:00';
        const finishTime = event.finishTime || startTime;
        const details = Object.assign({}, event, { startDate: startDate, finishDate: finishDate, startTime: startTime, finishTime: finishTime });
        delete details._dbId;
        return {
            id: event._dbId || (event._dbId = newId()),
            title: event.name || 'Untitled event',
            description: JSON.stringify(details),
            starts_at: `${startDate}T${startTime}:00`,
            ends_at: `${finishDate}T${finishTime}:00`
        };
    }

    function eventFromRow(row) {
        let details = {};
        try { details = JSON.parse(row.description || '{}'); } catch (_) { details = { description: row.description || '' }; }
        const start = String(row.starts_at || '').slice(0, 10);
        const end = String(row.ends_at || row.starts_at || '').slice(0, 10);
        const startTime = String(row.starts_at || '').slice(11, 16);
        const endTime = String(row.ends_at || row.starts_at || '').slice(11, 16);
        return Object.assign(details, {
            _dbId: row.id,
            name: row.title,
            startDate: details.startDate || start,
            finishDate: details.finishDate || end,
            startTime: details.startTime || startTime,
            finishTime: details.finishTime || endTime
        });
    }

    async function persist(events) {
        const db = window.MyMaintenanceData;
        if (!db) return;
        const rows = [];
        Object.keys(events || {}).forEach(function (key) {
            (events[key] || []).forEach(function (event) { rows.push(eventRow(key, event)); });
        });
        const currentIds = new Set(rows.map(function (row) { return row.id; }));
        try {
            if (rows.length) {
                await db.request('planning_events', {
                    method: 'POST',
                    query: { on_conflict: 'id' },
                    body: rows,
                    prefer: 'resolution=merge-duplicates,return=representation'
                });
            }
            await Promise.all(Array.from(knownEventIds).filter(function (id) { return !currentIds.has(id); })
                .map(function (id) { return db.request('planning_events', { method: 'DELETE', query: { id: `eq.${id}` } }); }));
            knownEventIds = currentIds;
        } catch (error) {
            console.error('Could not save events:', error);
        }
    }

    async function hydrate() {
        const db = window.MyMaintenanceData;
        if (!db) return;
        try {
            const rows = await db.request('planning_events', { query: { select: '*', order: 'starts_at.asc' } });
            const result = {};
            (rows || []).forEach(function (row) {
                const event = eventFromRow(row);
                const key = event.startDate || String(row.starts_at).slice(0, 10);
                if (!result[key]) result[key] = [];
                result[key].push(event);
            });
            eventsCache = result;
            knownEventIds = new Set((rows || []).map(function (row) { return row.id; }));
            window.dispatchEvent(new CustomEvent('myevents:changed'));
        } catch (error) {
            console.error('Could not load events:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', hydrate);

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

    function assetIcon(symbol) {
        const paths = {
            home: 'M220-180h150v-220q0-12.75 8.63-21.38Q387.25-430 400-430h160q12.75 0 21.38 8.62Q590-412.75 590-400v220h150v-390L480-765 220-570v390Zm-60 0v-390q0-14.25 6.38-27 6.37-12.75 17.62-21l260-195q15.68-12 35.84-12Q500-825 516-813l260 195q11.25 8.25 17.63 21 6.37 12.75 6.37 27v390q0 24.75-17.62 42.37Q764.75-120 740-120H560q-12.75 0-21.37-8.63Q530-137.25 530-150v-220H430v220q0 12.75-8.62 21.37Q412.75-120 400-120H220q-24.75 0-42.37-17.63Q160-155.25 160-180Zm320-293Z',
            apartment: 'M180-120q-24.75 0-42.37-17.63Q120-155.25 120-180v-435q0-24.75 17.63-42.38Q155.25-675 180-675h105v-105q0-24.75 17.63-42.38Q320.25-840 345-840h270q24.75 0 42.38 17.62Q675-804.75 675-780v270h105q24.75 0 42.38 17.62Q840-474.75 840-450v270q0 24.75-17.62 42.37Q804.75-120 780-120H533v-165H427v165H180Zm0-60h105v-105H180v105Zm0-165h105v-105H180v105Zm0-165h105v-105H180v105Zm165 165h105v-105H345v105Zm0-165h105v-105H345v105Zm0-165h105v-105H345v105Zm165 330h105v-105H510v105Zm0-165h105v-105H510v105Zm0-165h105v-105H510v105Zm165 495h105v-105H675v105Zm0-165h105v-105H675v105Z',
            cabin: 'M160-180v-341l-60 46q-10.35 8-22.17 6Q66-471 58-481q-8-10-6-22t12-20l96-73v-84q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v38l224-170q16.21-12 36.11-12Q500-824 516-812l381 290q9.94 7.62 11.47 19.81Q910-490 902-479.63q-8 9.63-19.5 11.13T861-475l-61-46v341q0 24.75-17.62 42.37Q764.75-120 740-120H220q-24.75 0-42.37-17.63Q160-155.25 160-180Zm60 0h230v-130q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v130h230v-387L480-765 220-567v387Zm0 0h520-520Zm-25-580q-15 0-24.5-11t-4.5-24q11-34 40.06-54.5Q235.13-870 270-870q14 0 26-7.07T314-897q5-9 12.5-16t18.5-7q15 0 24.5 11t4.5 24q-12 34-40.75 54.5T270-810q-14 0-25.5 7.5T226-783q-5 9-12.7 16-7.71 7-18.3 7Z',
            car: 'M200-204v44q0 16.67-11.74 28.33Q176.53-120 159.76-120q-16.76 0-28.26-11.67Q120-143.33 120-160v-304q0-4.67.5-9.33.5-4.67 2.5-9.67l78-236q6-19 21.75-30T258-760h444q19.5 0 35.25 11T759-719l78 236q2 5 2.5 9.67.5 4.66.5 9.33v304q0 16.67-11.74 28.33Q816.53-120 799.76-120q-16.76 0-28.26-11.67Q760-143.33 760-160v-44H200Zm3-330h554l-55-166H258l-55 166Zm-23 60v210-210Zm105.76 160q23.24 0 38.74-15.75Q340-345.5 340-368q0-23.33-15.75-39.67Q308.5-424 286-424q-23.33 0-39.67 16.26Q230-391.47 230-368.24q0 23.24 16.26 38.74 16.27 15.5 39.5 15.5ZM675-314q23.33 0 39.67-15.75Q731-345.5 731-368q0-23.33-16.26-39.67Q698.47-424 675.24-424q-23.24 0-38.74 16.26-15.5 16.27-15.5 39.5 0 23.24 15.75 38.74Q652.5-314 675-314Zm-495 50h600v-210H180v210Z',
            boat: 'M407-89.5Q370-99 333-117q-53 25-92.5 31T150-80q-12 0-21-8.63-9-8.62-9-21.37 0-12 9-21t21-9q25.11-.4 46.55-1.2Q218-142 239-146.5q21-4.5 42-12.5t45-22q3.5-2 7-2t7 2q34 20 69 29.5t71 9.5q36 0 71-9.5t69-29.5q3.5-2 7-2t7 2q24 12.5 45 21.25T721-147q21 4 42.5 5.5T810-140q13 0 21.5 8.62 8.5 8.63 8.5 21.38 0 12.75-9 21.37Q822-80 810-80q-51 0-91-6t-91-31q-38 19-75 28t-73 9q-36 0-73-9.5ZM480.5-229q-35.5 0-75-20.5T331-307q-26 26-54.5 43T219-238q-15 5-28-3.5T173-265l-62-210q-4-12 1.82-22.61 5.82-10.6 18.18-14.39l55-16v-190q0-24.75 17.63-42.38Q221.25-778 246-778h132v-73q0-12.75 8.63-21.38Q395.25-881 408-881h144q12.75 0 21.38 8.62Q582-863.75 582-851v73h132q24.75 0 42.38 17.62Q774-742.75 774-718v190l55 16q12.36 3.79 18.18 14.39Q853-487 849-475l-61 210q-5 15-18 23.5t-28 4.5q-30-9-58-26.5T630-307q-35 37-74.5 57.5t-75 20.5ZM246-718v171l216-66q8-2 18-2.5t18 2.5l216 67v-172H246Zm234 163-304 92 48 159q27-15 45.5-31.5T309-374q9-10 22.5-10t22.5 11q25 29 55 56.5t72 27.5q42 0 71-27.5t54-56.5q9-11 22.5-11t22.5 10q20 21 39.5 38.5T736-304l48-159-304-92Zm0 133Z',
            calendar: 'M180-80q-24 0-42-18t-18-42v-620q0-24 18-42t42-18h65v-28q0-13.6 9-22.8 9-9.2 23.02-9.2t23.5 9.2Q310-861.6 310-848v28h340v-28q0-13.6 9-22.8 9-9.2 23.02-9.2t23.5 9.2Q715-861.6 715-848v28h65q24 0 42 18t18 42v620q0 24-18 42t-42 18H180Zm0-60h600v-430H180v430Zm0-490h600v-130H180v130Zm0 0v-130 130Zm300 230q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z'
        };
        const p = paths[symbol] || paths.calendar;
        return '<svg class="ev-calendar-icon" xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#20b2aa" aria-hidden="true"><path d="' + p + '"/></svg>';
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

    function eventRowHtml(key, ev, symbol) {
        const asset = String(ev.asset || ev.location || '').trim();
        const label = formatDateLabel(key);
        const time = ev.startTime ? escapeHtml(ev.startTime) : '';
        return '<div class="ev-row ev-row-open" data-key="' + escapeHtml(key) + '">'
            + '<div class="ev-row-left">'
            + assetIcon(symbol)
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

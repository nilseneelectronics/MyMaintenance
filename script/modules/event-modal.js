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
        const evToolsMaterialsWrap = document.getElementById('ev-tools-materials-wrap');
        const evModalTitle = document.getElementById('ev-modal-title');
        const cardEl = modal.querySelector('.event-modal-card');

        let state = { planned: false, asset: '', editingKey: null, editingIndex: -1 };
        let eventCalendar = null;
        let eventCalendarTarget = null;
        let eventTimePicker = null;
        let eventTimeTarget = null;
        let eventTimeWheels = null;
        const eventCalState = { year: new Date().getFullYear(), month: new Date().getMonth(), selected: null, showYears: false };
        const eventCalMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const timeWheelItemHeight = 32;

        function pad(n) { return String(n).padStart(2, '0'); }
        function eventIso(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
        function eventDateValue(field) { return field ? (field.dataset.iso || '') : ''; }
        function setEventDate(field, value) {
            if (!field) return;
            const p = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
            field.dataset.iso = p ? value : '';
            field.value = p ? p[3] + '/' + p[2] + '/' + p[1] : '';
        }

        function closeEventCalendar() {
            if (eventCalendar) eventCalendar.classList.remove('open');
            eventCalendarTarget = null;
        }

        function timeParts(value) {
            const parts = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
            return parts ? { hour: Math.min(23, Number(parts[1])), minute: Math.min(59, Number(parts[2])) } : { hour: 0, minute: 0 };
        }

        function timeLabel(hour, minute) {
            return pad(hour) + ':' + pad(minute);
        }

        function closeEventTimePicker() {
            if (eventTimePicker) eventTimePicker.classList.remove('open');
            eventTimeTarget = null;
        }

        function updateTimeWheel(kind, writeValue) {
            if (!eventTimeWheels || !eventTimeWheels[kind]) return 0;
            const wheel = eventTimeWheels[kind];
            const index = Math.round(wheel.scrollTop / timeWheelItemHeight);
            const value = Number(wheel.children[index + 1] && wheel.children[index + 1].dataset.value);
            const length = kind === 'hour' ? 24 : 60;
            wheel.querySelectorAll('.event-time-wheel-item').forEach(function (item) {
                const distance = Math.abs(Number(item.dataset.index) - index);
                item.classList.toggle('selected', distance === 0);
                item.style.setProperty('--wheel-distance', Math.min(distance, 4));
                item.style.opacity = String(Math.max(0.28, 1 - (Math.min(distance, 4) * 0.18)));
                item.style.transform = 'scale(' + (1 - (Math.min(distance, 4) * 0.09)) + ')';
            });
            if (writeValue && eventTimeTarget) {
                const current = timeParts(eventTimeTarget.value);
                eventTimeTarget.value = timeLabel(kind === 'hour' ? value : current.hour, kind === 'minute' ? value : current.minute);
            }
            return Number.isFinite(value) ? value : 0;
        }

        function scrollTimeWheel(kind, value, smooth) {
            if (!eventTimeWheels || !eventTimeWheels[kind]) return;
            const wheel = eventTimeWheels[kind];
            wheel.scrollTo({ top: value * timeWheelItemHeight, behavior: smooth ? 'smooth' : 'auto' });
            window.requestAnimationFrame(function () { updateTimeWheel(kind, false); });
        }

        function createTimeWheel(kind) {
            const length = kind === 'hour' ? 24 : 60;
            const wheel = document.createElement('div');
            wheel.className = 'event-time-wheel-scroll';
            wheel.dataset.kind = kind;
            wheel.innerHTML = '<div class="event-time-wheel-spacer"></div>';
            for (let value = 0; value < length; value++) {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'event-time-wheel-item';
                item.dataset.value = value;
                item.dataset.index = value;
                item.textContent = pad(value);
                wheel.appendChild(item);
            }
            wheel.insertAdjacentHTML('beforeend', '<div class="event-time-wheel-spacer"></div>');
            wheel.addEventListener('scroll', function () {
                window.requestAnimationFrame(function () { updateTimeWheel(kind, true); });
            }, { passive: true });
            wheel.addEventListener('click', function (e) {
                const item = e.target.closest('.event-time-wheel-item');
                if (!item) return;
                scrollTimeWheel(kind, Number(item.dataset.value), true);
            });
            return wheel;
        }

        function openEventTimePicker(field) {
            closeEventCalendar();
            if (!eventTimePicker) {
                eventTimePicker = document.createElement('div');
                eventTimePicker.className = 'event-time-picker';
                eventTimePicker.setAttribute('role', 'dialog');
                eventTimePicker.setAttribute('aria-label', 'Choose time');
                const hours = createTimeWheel('hour');
                const minutes = createTimeWheel('minute');
                eventTimePicker.innerHTML = '<div class="event-time-wheels"><div class="event-time-wheel"></div><span class="event-time-divider">:</span><div class="event-time-wheel"></div></div>';
                const wheelHolders = eventTimePicker.querySelectorAll('.event-time-wheel');
                wheelHolders[0].appendChild(hours);
                wheelHolders[1].appendChild(minutes);
                eventTimePicker.addEventListener('click', function (e) { e.stopPropagation(); });
                eventTimeWheels = { hour: hours, minute: minutes };
            }
            eventTimeTarget = field;
            modal.appendChild(eventTimePicker);
            const current = timeParts(field.value);
            scrollTimeWheel('hour', current.hour, false);
            scrollTimeWheel('minute', current.minute, false);
            const rect = field.getBoundingClientRect();
            const pageZoom = Number(window.getComputedStyle(document.documentElement).zoom) || 1;
            const viewportWidth = (window.visualViewport ? window.visualViewport.width : window.innerWidth) / pageZoom;
            const viewportHeight = (window.visualViewport ? window.visualViewport.height : window.innerHeight) / pageZoom;
            const fieldLeft = rect.left / pageZoom;
            const fieldTop = rect.top / pageZoom;
            const fieldBottom = rect.bottom / pageZoom;
            const pickerWidth = Math.min(rect.width / pageZoom, viewportWidth - 24);
            eventTimePicker.style.width = pickerWidth + 'px';
            eventTimePicker.style.left = Math.max(12, Math.min(fieldLeft, viewportWidth - pickerWidth - 12)) + 'px';
            eventTimePicker.style.top = '-9999px';
            eventTimePicker.style.bottom = 'auto';
            eventTimePicker.classList.add('open');
            const pickerHeight = eventTimePicker.offsetHeight;
            const below = fieldBottom + 2;
            const top = below + pickerHeight <= viewportHeight - 12
                ? below
                : Math.max(12, fieldTop - pickerHeight + 2);
            eventTimePicker.style.top = top + 'px';
        }

        function buildEventCalendar() {
            if (!eventCalendar) return;
            const first = new Date(eventCalState.year, eventCalState.month, 1);
            const startDay = (first.getDay() + 6) % 7;
            const daysInMonth = new Date(eventCalState.year, eventCalState.month + 1, 0).getDate();
            const todayKey = eventIso(new Date());
            const selectedKey = eventCalState.selected ? eventIso(eventCalState.selected) : '';
            let html = '<div class="doc-cal-header"><button type="button" class="doc-cal-nav" data-event-cal-nav="-1">‹</button><button type="button" class="doc-cal-year-toggle">' + eventCalMonths[eventCalState.month] + ' ' + eventCalState.year + '</button><button type="button" class="doc-cal-nav" data-event-cal-nav="1">›</button></div>';
            if (eventCalState.showYears) {
                html += '<div class="doc-cal-year-panel">';
                for (let year = 1700; year <= 2110; year++) html += '<button type="button" class="doc-cal-year-btn' + (year === eventCalState.year ? ' current' : '') + '" data-event-cal-year="' + year + '">' + year + '</button>';
                html += '</div>';
            } else {
                html += '<div class="doc-cal-grid"><span class="doc-cal-dow">Mo</span><span class="doc-cal-dow">Tu</span><span class="doc-cal-dow">We</span><span class="doc-cal-dow">Th</span><span class="doc-cal-dow">Fr</span><span class="doc-cal-dow">Sa</span><span class="doc-cal-dow">Su</span>';
                for (let i = 0; i < startDay; i++) html += '<span class="doc-cal-day blank"></span>';
                for (let day = 1; day <= daysInMonth; day++) {
                    const key = eventIso(new Date(eventCalState.year, eventCalState.month, day));
                    let cls = 'doc-cal-day';
                    if (key === todayKey) cls += ' today';
                    if (key === selectedKey) cls += ' selected';
                    html += '<button type="button" class="' + cls + '" data-event-cal-day="' + day + '">' + day + '</button>';
                }
                html += '</div>';
            }
            eventCalendar.innerHTML = html;
        }

        function openEventCalendar(field) {
            closeEventTimePicker();
            if (!eventCalendar) {
                eventCalendar = document.createElement('div');
                eventCalendar.className = 'doc-calendar event-date-calendar';
                eventCalendar.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const nav = e.target.closest('[data-event-cal-nav]');
                    const year = e.target.closest('[data-event-cal-year]');
                    const day = e.target.closest('[data-event-cal-day]');
                    if (nav) {
                        eventCalState.month += Number(nav.dataset.eventCalNav);
                        if (eventCalState.month < 0) { eventCalState.month = 11; eventCalState.year--; }
                        if (eventCalState.month > 11) { eventCalState.month = 0; eventCalState.year++; }
                        eventCalState.showYears = false;
                        return buildEventCalendar();
                    }
                    if (year) {
                        eventCalState.year = Number(year.dataset.eventCalYear);
                        eventCalState.showYears = false;
                        return buildEventCalendar();
                    }
                    if (e.target.closest('.doc-cal-year-toggle')) {
                        eventCalState.showYears = !eventCalState.showYears;
                        return buildEventCalendar();
                    }
                    if (day && eventCalendarTarget) {
                        const dt = new Date(eventCalState.year, eventCalState.month, Number(day.dataset.eventCalDay));
                        setEventDate(eventCalendarTarget, eventIso(dt));
                        eventCalState.selected = dt;
                        closeEventCalendar();
                    }
                });
            }
            eventCalendarTarget = field;
            field.parentElement.appendChild(eventCalendar);
            eventCalendar.classList.toggle('event-date-calendar-finish', field === evFinishDate);
            const existing = eventDateValue(field).match(/^(\d{4})-(\d{2})-(\d{2})$/);
            const dt = existing ? new Date(Number(existing[1]), Number(existing[2]) - 1, Number(existing[3])) : new Date();
            eventCalState.year = dt.getFullYear();
            eventCalState.month = dt.getMonth();
            eventCalState.selected = dt;
            eventCalState.showYears = false;
            const rect = field.getBoundingClientRect();
            const opensAbove = window.innerHeight - rect.bottom < 80;
            eventCalendar.classList.toggle('opens-above', opensAbove);
            eventCalendar.style.top = opensAbove ? 'auto' : 'calc(100% + 8px)';
            eventCalendar.style.bottom = opensAbove ? 'calc(100% + 8px)' : 'auto';
            buildEventCalendar();
            eventCalendar.classList.add('open');
        }

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
            if (evToolsMaterialsWrap) evToolsMaterialsWrap.style.display = 'none';
            if (evAssetValueEl) evAssetValueEl.textContent = '-- Select an asset --';
            if (evAssetMenu) evAssetMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
            if (evAssetOther) {
                evAssetOther.value = '';
                evAssetOther.style.display = 'none';
            }
            if (evAssetDropdown) evAssetDropdown.classList.remove('open');
        }

        // Lock the card to the "Planned Maintenance checked" height so the
        // buttons stay in the exact same place whether or not that box is ticked.
        function lockTallHeight() {
            if (!cardEl) return;
            const aw = evAssetWrap, tw = evToolsMaterialsWrap;
            const awPrev = aw ? aw.style.display : '';
            const twPrev = tw ? tw.style.display : '';
            if (aw) aw.style.display = '';
            if (tw) tw.style.display = '';
            cardEl.style.height = 'auto';
            const h = cardEl.offsetHeight;
            cardEl.style.height = h + 'px';
            if (aw) aw.style.display = awPrev;
            if (tw) tw.style.display = twPrev;
        }

        function open(key, opts) {
            if (!modal) return;
            modal.classList.add('open');
            resetFields();
            if (window.MyMaintenanceEventTools) window.MyMaintenanceEventTools.reset();
            lockTallHeight();
            state.editingKey = null;
            state.editingIndex = -1;
            const editing = !!(opts && opts.event && opts.key);
            if (evModalTitle) evModalTitle.textContent = editing ? 'Edit event' : 'Add event';
            if (evAdd) evAdd.textContent = editing ? 'Save' : 'Add';

            if (editing) {
                const e = opts.event;
                if (evName) evName.value = e.name || '';
                setEventDate(evStartDate, e.startDate || key);
                setEventDate(evFinishDate, e.finishDate || key);
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
                    if (evToolsMaterialsWrap) evToolsMaterialsWrap.style.display = '';
                    if (e.asset) selectAsset(e.asset);
                } else {
                    if (evToolsMaterialsWrap) evToolsMaterialsWrap.style.display = 'none';
                }
                if (window.MyMaintenanceEventTools) window.MyMaintenanceEventTools.setItems(e.tools, e.materials);
            } else {
                setEventDate(evStartDate, key);
                setEventDate(evFinishDate, key);
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
                    if (evToolsMaterialsWrap) evToolsMaterialsWrap.style.display = '';
                    if (opts.asset) selectAsset(opts.asset);
                }
            }
            if (evName) evName.focus();
        }

        function close() {
            if (modal) modal.classList.remove('open');
            closeEventCalendar();
            closeEventTimePicker();
            state.editingKey = null;
            state.editingIndex = -1;
        }

        [evStartDate, evFinishDate].forEach(function (field) {
            if (!field) return;
            field.addEventListener('click', function (e) {
                e.stopPropagation();
                openEventCalendar(field);
            });
        });
        [evStartTime, evFinishTime].forEach(function (field) {
            if (!field) return;
            field.addEventListener('click', function (e) {
                e.stopPropagation();
                openEventTimePicker(field);
            });
        });
        if (evCancel) evCancel.addEventListener('click', close);
        if (evAdd) evAdd.addEventListener('click', function () {
            if (!window.MyMaintenanceEvents) return;
            const name = evName ? evName.value.trim() : '';
            const startDate = eventDateValue(evStartDate);
            if (!name || !startDate) return;
            const isPlanned = !!(evPlanned && evPlanned.checked);
            const asset = isPlanned ? state.asset : '';
            const events = window.MyMaintenanceEvents.load();
            const ev = {
                name: name,
                startDate: startDate,
                finishDate: eventDateValue(evFinishDate) || startDate,
                startTime: evStartTime ? evStartTime.value : '',
                finishTime: evFinishTime ? evFinishTime.value : '',
                location: evLocation ? evLocation.value.trim() : '',
                description: evDesc ? evDesc.value.trim() : '',
                isPlannedMaintenance: isPlanned,
                asset: asset,
                tools: (isPlanned && window.MyMaintenanceEventTools) ? window.MyMaintenanceEventTools.getItems().tools : [],
                materials: (isPlanned && window.MyMaintenanceEventTools) ? window.MyMaintenanceEventTools.getItems().materials : []
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
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && modal.classList.contains('open')) close(); });

        if (evPlanned) {
            evPlanned.addEventListener('change', function () {
                state.planned = evPlanned.checked;
                if (evAssetWrap) evAssetWrap.style.display = state.planned ? '' : 'none';
                if (evToolsMaterialsWrap) evToolsMaterialsWrap.style.display = state.planned ? '' : 'none';
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
            if (eventCalendar && !eventCalendar.contains(e.target) && e.target !== evStartDate && e.target !== evFinishDate) closeEventCalendar();
            if (eventTimePicker && !eventTimePicker.contains(e.target) && e.target !== evStartTime && e.target !== evFinishTime) closeEventTimePicker();
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

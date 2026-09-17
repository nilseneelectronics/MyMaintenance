/* event-pickers.js - Shared custom date calendar + time wheel pickers.
   Used by the planning event modal and the neighborhood event modal. */

window.MyMaintenanceEventPickers = (function () {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const timeWheelItemHeight = 32;

    let calendar = null;
    let calendarTarget = null;
    let calendarFinish = null;
    let timePicker = null;
    let timeTarget = null;
    let timeWheels = null;
    const calState = { year: new Date().getFullYear(), month: new Date().getMonth(), selected: null, showYears: false };
    const dateFields = [];
    const timeFields = [];

    function pad(n) { return String(n).padStart(2, '0'); }
    function eventIso(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
    function dateValue(field) { return field ? (field.dataset.iso || '') : ''; }
    function setDate(field, value) {
        if (!field) return;
        const p = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        field.dataset.iso = p ? value : '';
        field.value = p ? p[3] + '.' + p[2] + '.' + p[1] : '';
    }

    function timeParts(value) {
        const parts = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
        return parts ? { hour: Math.min(23, Number(parts[1])), minute: Math.min(59, Number(parts[2])) } : { hour: 0, minute: 0 };
    }
    function timeLabel(hour, minute) { return pad(hour) + ':' + pad(minute); }

    function closeCalendar() {
        if (calendar) calendar.classList.remove('open');
        calendarTarget = null;
    }
    function closeTimePicker() {
        if (timePicker) timePicker.classList.remove('open');
        timeTarget = null;
    }
    function closeAll() { closeCalendar(); closeTimePicker(); }

    function updateTimeWheel(kind, writeValue) {
        if (!timeWheels || !timeWheels[kind]) return 0;
        const wheel = timeWheels[kind];
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
        if (writeValue && timeTarget) {
            const current = timeParts(timeTarget.value);
            timeTarget.value = timeLabel(kind === 'hour' ? value : current.hour, kind === 'minute' ? value : current.minute);
        }
        return Number.isFinite(value) ? value : 0;
    }

    function scrollTimeWheel(kind, value, smooth) {
        if (!timeWheels || !timeWheels[kind]) return;
        const wheel = timeWheels[kind];
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

    function openTimePicker(field) {
        closeCalendar();
        if (!timePicker) {
            timePicker = document.createElement('div');
            timePicker.className = 'event-time-picker';
            timePicker.setAttribute('role', 'dialog');
            timePicker.setAttribute('aria-label', 'Choose time');
            const hours = createTimeWheel('hour');
            const minutes = createTimeWheel('minute');
            timePicker.innerHTML = '<div class="event-time-wheels"><div class="event-time-wheel"></div><span class="event-time-divider">:</span><div class="event-time-wheel"></div></div>';
            const wheelHolders = timePicker.querySelectorAll('.event-time-wheel');
            wheelHolders[0].appendChild(hours);
            wheelHolders[1].appendChild(minutes);
            timePicker.addEventListener('click', function (e) { e.stopPropagation(); });
            timeWheels = { hour: hours, minute: minutes };
        }
        timeTarget = field;
        document.body.appendChild(timePicker);
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
        timePicker.style.width = pickerWidth + 'px';
        timePicker.style.left = Math.max(12, Math.min(fieldLeft, viewportWidth - pickerWidth - 12)) + 'px';
        timePicker.style.top = '-9999px';
        timePicker.style.bottom = 'auto';
        timePicker.classList.add('open');
        const pickerHeight = timePicker.offsetHeight;
        const below = fieldBottom + 2;
        const top = below + pickerHeight <= viewportHeight - 12
            ? below
            : Math.max(12, fieldTop - pickerHeight + 2);
        timePicker.style.top = top + 'px';
    }

    function buildCalendar() {
        if (!calendar) return;
        const first = new Date(calState.year, calState.month, 1);
        const startDay = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();
        const todayKey = eventIso(new Date());
        const selectedKey = calState.selected ? eventIso(calState.selected) : '';
        let html = '<div class="doc-cal-header"><button type="button" class="doc-cal-nav" data-event-cal-nav="-1">‹</button><button type="button" class="doc-cal-year-toggle">' + MONTHS[calState.month] + ' ' + calState.year + '</button><button type="button" class="doc-cal-nav" data-event-cal-nav="1">›</button></div>';
        if (calState.showYears) {
            html += '<div class="doc-cal-year-panel">';
            for (let year = 1700; year <= 2110; year++) html += '<button type="button" class="doc-cal-year-btn' + (year === calState.year ? ' current' : '') + '" data-event-cal-year="' + year + '">' + year + '</button>';
            html += '</div>';
        } else {
            html += '<div class="doc-cal-grid"><span class="doc-cal-dow">Mo</span><span class="doc-cal-dow">Tu</span><span class="doc-cal-dow">We</span><span class="doc-cal-dow">Th</span><span class="doc-cal-dow">Fr</span><span class="doc-cal-dow">Sa</span><span class="doc-cal-dow">Su</span>';
            for (let i = 0; i < startDay; i++) html += '<span class="doc-cal-day blank"></span>';
            for (let day = 1; day <= daysInMonth; day++) {
                const key = eventIso(new Date(calState.year, calState.month, day));
                let cls = 'doc-cal-day';
                if (key === todayKey) cls += ' today';
                if (key === selectedKey) cls += ' selected';
                html += '<button type="button" class="' + cls + '" data-event-cal-day="' + day + '">' + day + '</button>';
            }
            html += '</div>';
        }
        calendar.innerHTML = html;
    }

    function openCalendar(field) {
        closeTimePicker();
        if (!calendar) {
            calendar = document.createElement('div');
            calendar.className = 'doc-calendar event-date-calendar';
            calendar.addEventListener('click', function (e) {
                e.stopPropagation();
                const nav = e.target.closest('[data-event-cal-nav]');
                const year = e.target.closest('[data-event-cal-year]');
                const day = e.target.closest('[data-event-cal-day]');
                if (nav) {
                    calState.month += Number(nav.dataset.eventCalNav);
                    if (calState.month < 0) { calState.month = 11; calState.year--; }
                    if (calState.month > 11) { calState.month = 0; calState.year++; }
                    calState.showYears = false;
                    return buildCalendar();
                }
                if (year) {
                    calState.year = Number(year.dataset.eventCalYear);
                    calState.showYears = false;
                    return buildCalendar();
                }
                if (e.target.closest('.doc-cal-year-toggle')) {
                    calState.showYears = !calState.showYears;
                    return buildCalendar();
                }
                if (day && calendarTarget) {
                    const dt = new Date(calState.year, calState.month, Number(day.dataset.eventCalDay));
                    setDate(calendarTarget, eventIso(dt));
                    calState.selected = dt;
                    closeCalendar();
                }
            });
        }
        calendarTarget = field;
        field.parentElement.appendChild(calendar);
        calendar.classList.toggle('event-date-calendar-finish', field === calendarFinish);
        const existing = dateValue(field).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const dt = existing ? new Date(Number(existing[1]), Number(existing[2]) - 1, Number(existing[3])) : new Date();
        calState.year = dt.getFullYear();
        calState.month = dt.getMonth();
        calState.selected = dt;
        calState.showYears = false;
        const rect = field.getBoundingClientRect();
        const opensAbove = window.innerHeight - rect.bottom < 80;
        calendar.classList.toggle('opens-above', opensAbove);
        calendar.style.top = opensAbove ? 'auto' : 'calc(100% + 8px)';
        calendar.style.bottom = opensAbove ? 'calc(100% + 8px)' : 'auto';
        buildCalendar();
        calendar.classList.add('open');
    }

    function attachDateField(field, opts) {
        if (!field) return;
        dateFields.push(field);
        if (opts && opts.finishDate) calendarFinish = field;
        field.addEventListener('click', function (e) {
            e.stopPropagation();
            openCalendar(field);
        });
    }

    function attachTimeField(field) {
        if (!field) return;
        timeFields.push(field);
        field.addEventListener('click', function (e) {
            e.stopPropagation();
            openTimePicker(field);
        });
    }

    document.addEventListener('click', function (e) {
        if (calendar && !calendar.contains(e.target) && dateFields.indexOf(e.target) === -1) closeCalendar();
        if (timePicker && !timePicker.contains(e.target) && timeFields.indexOf(e.target) === -1) closeTimePicker();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (calendar && calendar.classList.contains('open')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeCalendar();
            return;
        }
        if (timePicker && timePicker.classList.contains('open')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeTimePicker();
        }
    });

    return {
        attachDateField: attachDateField,
        attachTimeField: attachTimeField,
        setDate: setDate,
        dateValue: dateValue,
        eventIso: eventIso,
        pad: pad,
        closeAll: closeAll
    };
})();
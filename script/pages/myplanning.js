document.addEventListener('DOMContentLoaded', () => {
    const todoList = document.getElementById('todo-list');
    const newInput = document.getElementById('new-todo-input');
    const addBtn = document.getElementById('add-todo-btn');

    if (!todoList || !newInput || !addBtn) return;

    function createTodoItem(text) {
        const li = document.createElement('li');
        li.innerHTML = `
            <button class="delete-btn" data-task="${text}" aria-label="Delete task">
                <svg xmlns="http://www.w3.org/2000/svg" height="26" viewBox="0 -960 960 960" width="26" fill="currentColor"><path d="M261-120q-24.75 0-42.37-17.63Q201-155.25 201-180v-570h-11q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h158q0-13 8.63-21.5 8.62-8.5 21.37-8.5h204q12.75 0 21.38 8.62Q612-822.75 612-810h158q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5h-11v570q0 24.75-17.62 42.37Q723.75-120 699-120H261Zm438-630H261v570h438v-570ZM418.5-274.63q8.5-8.62 8.5-21.37v-339q0-12.75-8.68-21.38-8.67-8.62-21.5-8.62-12.82 0-21.32 8.62-8.5 8.63-8.5 21.38v339q0 12.75 8.68 21.37 8.67 8.63 21.5 8.63 12.82 0 21.32-8.63Zm166 0q8.5-8.62 8.5-21.37v-339q0-12.75-8.68-21.38-8.67-8.62-21.5-8.62-12.82 0-21.32 8.62-8.5 8.63-8.5 21.38v339q0 12.75 8.68 21.37 8.67 8.63 21.5 8.63 12.82 0 21.32-8.63ZM261-750v570-570Z"/></svg>
            </button>
            <span>${text}</span>
            <label class="switch">
                <input type="checkbox">
                <span class="slider"></span>
            </label>
        `;
        return li;
    }

    function addTodoFromInput() {
        const text = newInput.value.trim();
        if (!text) return;
        todoList.appendChild(createTodoItem(text));
        newInput.value = '';
    }

    addBtn.addEventListener('click', addTodoFromInput);

    todoList.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const deleteBtn = target.closest('.delete-btn');
        if (!deleteBtn) return;

        const taskText = deleteBtn.getAttribute('data-task') || '';
        const liToDelete = deleteBtn.parentElement;
        if (!liToDelete) return;

        const popupTaskText = document.getElementById('popup-task-text');
        const deletePopup = document.getElementById('delete-popup');
        const popupYes = document.getElementById('popup-yes');
        const popupNo = document.getElementById('popup-no');

        if (!popupTaskText || !deletePopup || !popupYes || !popupNo) return;

        popupTaskText.textContent = `"${taskText}"?`;
        deletePopup.style.display = 'flex';

        popupYes.onclick = () => {
            liToDelete.remove();
            deletePopup.style.display = 'none';
        };

        popupNo.onclick = () => {
            deletePopup.style.display = 'none';
        };
    });

    function loadExampleTasks() {
        const examples = [
            'Build fence around garden',
            'Change oil in Tesla Model Y',
            'Inspect boat hull before summer'
        ];

        examples.forEach((text) => {
            todoList.appendChild(createTodoItem(text));
        });
    }

    loadExampleTasks();

    // === EVENTS ===
    const STORAGE_KEY = 'floorplan_calendar_events';
    function loadEvents() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return { "2026-08-17": [{ name:"Going home", startDate:"2026-08-17", finishDate:"2026-08-17", startTime:"14:00", finishTime:"16:00", location:"Cabin", description:"Pack up and head back to the city" }] };
    }
    function saveEvents() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(EVENTS));
    }
    let EVENTS = loadEvents();

    // === UPCOMING EVENTS ===
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    function renderUpcoming() {
        const box = document.getElementById('upcoming-events');
        if (!box) return;
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        const upcoming = [];
        for (const key of Object.keys(EVENTS)) {
            if (key < todayKey) continue;
            for (const ev of EVENTS[key]) upcoming.push({ key, ev });
        }
        upcoming.sort((a, b) => (a.key + (a.ev.startTime||'')) < (b.key + (b.ev.startTime||'')) ? -1 : 1);
        if (upcoming.length === 0) {
            box.innerHTML = '<p class="dash-upcoming-empty">No plans yet</p>';
            return;
        }
        box.innerHTML = upcoming.map(({ key, ev }) => {
            const [y, m, d] = key.split('-');
            const dt = new Date(y, m-1, d);
            const label = `${DAYS_SHORT[(dt.getDay()+6)%7]} ${d} ${MONTHS_SHORT[m-1]}`;
            const time = ev.startTime ? `<span class="dash-upcoming-time">${ev.startTime}</span>` : '';
            const locName = ev.location || 'No location specified';
            const loc = `<span class="dash-upcoming-loc"><svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#20b2aa"><path d="M480-301q99-80 149.5-154T680-594q0-90-56-148t-144-58q-88 0-144 58t-56 148q0 65 50.5 139T480-301Zm-24 78q-12-4-22-12-118-94-176-183.5T200-594q0-125 78-205.5T480-880q124 0 202 80.5T760-594q0 86-58 175.5T526-235q-10 8-22 12t-24 4q-12 0-24-4Zm24-297q33 0 56.5-23.5T560-600q0-33-23.5-56.5T480-680q-33 0-56.5 23.5T400-600q0 33 23.5 56.5T480-520ZM240-80q-17 0-28.5-11.5T200-120q0-17 11.5-28.5T240-160h480q17 0 28.5 11.5T760-120q0 17-11.5 28.5T720-80H240Zm240-520Z"/></svg>${locName}</span>`;
            return `<div class="dash-upcoming-item" data-key="${key}"><strong class="dash-upcoming-name">${ev.name}</strong>${loc}<span class="dash-upcoming-meta">${time}<span class="dash-upcoming-date">${label}</span></span></div>`;
        }).join('');
    }

    const upcomingBox = document.getElementById('upcoming-events');
    if (upcomingBox) {
        upcomingBox.addEventListener('click', (e) => {
            const item = e.target.closest('.dash-upcoming-item[data-key]');
            if (item) window.location.href = 'myplanning-calendar.html?date=' + item.dataset.key;
        });
    }

    // === MODAL ===
    const modal = document.getElementById('event-modal');
    const evName = document.getElementById('ev-name');
    const evStartDate = document.getElementById('ev-start-date');
    const evFinishDate = document.getElementById('ev-finish-date');
    const evStartTime = document.getElementById('ev-start-time');
    const evFinishTime = document.getElementById('ev-finish-time');
    const evLocation = document.getElementById('ev-location');
    const evDesc = document.getElementById('ev-desc');
    const evCancel = document.getElementById('ev-cancel');
    const evAdd = document.getElementById('ev-add');

    function openModal(key) {
        if (!modal) return;
        modal.classList.add('open');
        evName.value = '';
        evStartDate.value = key;
        evFinishDate.value = key;
        const now = new Date();
        const mins = now.getMinutes();
        const rounded = new Date(now);
        rounded.setMinutes(Math.ceil(mins / 15) * 15, 0, 0);
        const h = String(rounded.getHours()).padStart(2,'0');
        const m = String(rounded.getMinutes()).padStart(2,'0');
        const later = new Date(rounded.getTime() + 60*60*1000);
        const h2 = String(later.getHours()).padStart(2,'0');
        const m2 = String(later.getMinutes()).padStart(2,'0');
        evStartTime.value = `${h}:${m}`;
        evFinishTime.value = `${h2}:${m2}`;
        evLocation.value = '';
        evDesc.value = '';
        evName.focus();
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
    }

    if (evCancel) evCancel.addEventListener('click', closeModal);
    if (evAdd) evAdd.addEventListener('click', () => {
        const name = evName.value.trim();
        const startDate = evStartDate.value;
        const finishDate = evFinishDate.value;
        const startTime = evStartTime.value;
        const finishTime = evFinishTime.value;
        const location = evLocation.value.trim();
        const description = evDesc.value.trim();
        if (!name || !startDate) return;
        if (!EVENTS[startDate]) EVENTS[startDate] = [];
        EVENTS[startDate].push({ name, startDate, finishDate, startTime, finishTime, location, description });
        saveEvents();
        closeModal();
        renderCalendar();
        renderUpcoming();
    });
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    if (evName) evName.addEventListener('keydown', (e) => { if (e.key === 'Enter' && evAdd) evAdd.click(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // === CALENDAR ===
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    let calOffset = 0;
    const container = document.getElementById('calendar-container');
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    if (!container || !prevBtn || !nextBtn) return;

    function pad(n) { return String(n).padStart(2,'0'); }
    function dateKey(year, month, day) { return `${year}-${pad(month+1)}-${pad(day)}`; }
    function hasEvents(year, month, day) { return EVENTS[dateKey(year, month, day)] && EVENTS[dateKey(year, month, day)].length > 0; }

    function getMonthData(year, month) {
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const startDay = (first.getDay() + 6) % 7;
        const daysInMonth = last.getDate();
        return { startDay, daysInMonth };
    }

    function renderCalendar() {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

        const months = [
            new Date(now.getFullYear(), now.getMonth() + calOffset, 1),
            new Date(now.getFullYear(), now.getMonth() + calOffset + 1, 1)
        ];

        container.innerHTML = '';

        months.forEach((date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const { startDay, daysInMonth } = getMonthData(year, month);

            const box = document.createElement('div');
            box.className = 'month-box';

            let html = `<table class="month">`;
            html += `<thead><tr><th colspan="7">${MONTHS[month]} ${year}</th></tr><tr>`;
            DAYS.forEach(d => html += `<th>${d}</th>`);
            html += `</tr></thead><tbody><tr>`;

            for (let i = 0; i < startDay; i++) {
                html += `<td class="noday">&nbsp;</td>`;
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const cellDate = new Date(year, month, d);
                const cellStr = `${year}-${month}-${d}`;
                const isToday = cellStr === todayStr;
                const isPast = cellDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const classes = ['date-circle'];
                if (isToday) classes.push('today');
                if (isPast) classes.push('past');
                if (hasEvents(year, month, d)) classes.push('has-event');
                const key = dateKey(year, month, d);
                html += `<td><a href="#" class="${classes.join(' ')}" data-key="${key}">${d}</a></td>`;
                const pos = (startDay + d - 1) % 7;
                if (pos === 6 && d < daysInMonth) {
                    html += `</tr><tr>`;
                }
            }

            const lastCell = (startDay + daysInMonth) % 7;
            if (lastCell !== 0) {
                for (let i = lastCell; i < 7; i++) {
                    html += `<td class="noday">&nbsp;</td>`;
                }
            }

            html += `</tr></tbody></table>`;
            box.innerHTML = html;
            container.appendChild(box);
        });
    }

    container.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-key]');
        if (link) {
            e.preventDefault();
            window.location.href = 'myplanning-calendar.html?date=' + link.dataset.key;
        }
    });

    const planAddBtn = document.getElementById('plan-add-event');
    if (planAddBtn) {
        planAddBtn.addEventListener('click', () => {
            const now = new Date();
            const key = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
            openModal(key);
        });
    }

    renderCalendar();
    renderUpcoming();
    prevBtn.addEventListener('click', () => { calOffset--; renderCalendar(); });
    nextBtn.addEventListener('click', () => { calOffset++; renderCalendar(); });
});

document.addEventListener('DOMContentLoaded', () => {
    const todoList = document.getElementById('todo-list');
    const newInput = document.getElementById('new-todo-input');
    const addBtn = document.getElementById('add-todo-btn');

    if (!todoList || !newInput || !addBtn) return;

    function createTodoItem(text) {
        const li = document.createElement('li');
        li.innerHTML = `
            <button class="delete-btn" data-task="${text}">🗑</button>
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
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains('delete-btn')) return;

        const taskText = target.getAttribute('data-task') || '';
        const liToDelete = target.parentElement;
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
    prevBtn.addEventListener('click', () => { calOffset--; renderCalendar(); });
    nextBtn.addEventListener('click', () => { calOffset++; renderCalendar(); });
});

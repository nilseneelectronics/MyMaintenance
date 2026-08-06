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
            <button class="done-btn" data-task="${text}" aria-label="Mark as done">
                <svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22" fill="currentColor"><path d="m382-308 350-350q11-11 27.5-11t28.5 11q12 12 12 28.5T788-601L410-222q-12 12-28 12t-28-12L182-394q-12-12-12-28.5t12-28.5q11-11 27.5-11t28.5 11l154 142Z"/></svg>
                Mark as done
            </button>
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

    // === MARK AS DONE ===
    const DONE_STORAGE_KEY = 'floorplan_done_tasks';
    function loadDoneTasks() {
        try {
            const saved = localStorage.getItem(DONE_STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return [];
    }
    function saveDoneTasks() {
        localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(doneTasks));
    }
    let doneTasks = loadDoneTasks();

    function todayKey() {
        const n = new Date();
        return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
    }

    const donePopup = document.getElementById('done-popup');
    const doneTaskText = document.getElementById('done-task-text');
    const assetDropdown = document.getElementById('done-asset-dropdown');
    const assetToggle = document.getElementById('done-asset-toggle');
    const assetMenu = document.getElementById('done-asset-menu');
    const assetValueEl = assetDropdown ? assetDropdown.querySelector('.asset-value') : null;
    const doneAssetOther = document.getElementById('done-asset-other');
    let selectedAssetValue = '';
    const donePictureBtn = document.getElementById('done-picture-btn');
    const donePhotoOptions = document.getElementById('done-photo-options');
    const doneNoPhotos = document.getElementById('done-no-photos');
    const donePhotoGrid = document.getElementById('done-photo-grid');
    const doneEquipment = document.getElementById('done-equipment');
    const doneComments = document.getElementById('done-comments');
    const doneTime = document.getElementById('done-time');
    const doneCost = document.getElementById('done-cost');
    const doneCancel = document.getElementById('done-cancel');
    const doneConfirm = document.getElementById('done-confirm');
    const viewDoneBtn = document.getElementById('view-done-btn');

    let pendingDoneTask = null;
    let pendingPhotos = [];

    function renderPendingPhotos() {
        if (donePhotoGrid) donePhotoGrid.innerHTML = '';
        if (doneNoPhotos) doneNoPhotos.style.display = pendingPhotos.length ? 'none' : 'block';
        pendingPhotos.forEach((src, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'done-photo-thumb';
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Picture ${i + 1}`;
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'photo-remove';
            rm.setAttribute('aria-label', 'Remove picture');
            rm.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M256-200q-23.53 0-40.26-16.74Q199-233.47 199-257v-483h-13v-60h188v-30h212v30h188v60h-13v483q0 23.53-16.74 40.26Q716.53-200 693-200H256Zm103-100h60v-336h-60v336Zm182 0h60v-336h-60v336Z"/></svg>';
            rm.addEventListener('click', () => {
                pendingPhotos.splice(i, 1);
                renderPendingPhotos();
            });
            wrap.appendChild(img);
            wrap.appendChild(rm);
            if (donePhotoGrid) donePhotoGrid.appendChild(wrap);
        });
    }

    function openDonePopup(taskText) {
        if (!donePopup) return;
        pendingDoneTask = taskText;
        pendingPhotos = [];
        doneTaskText.textContent = `"${taskText}"?`;
        donePhotoOptions.style.display = 'none';
        selectedAssetValue = '';
        if (assetValueEl) assetValueEl.textContent = '-- Select an asset --';
        if (assetDropdown) assetDropdown.classList.remove('open');
        if (assetMenu) assetMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
        if (doneAssetOther) {
            doneAssetOther.value = '';
            doneAssetOther.style.display = 'none';
        }
        doneEquipment.value = '';
        doneComments.value = '';
        doneTime.value = '';
        doneCost.value = '';
        renderPendingPhotos();
        donePopup.style.display = 'flex';
    }

    function closeDonePopup() {
        if (donePopup) donePopup.style.display = 'none';
        pendingDoneTask = null;
        pendingPhotos = [];
    }

    if (assetToggle) {
        assetToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (assetDropdown) assetDropdown.classList.toggle('open');
        });
    }

    if (assetMenu) {
        assetMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-value]');
            if (!btn) return;
            selectedAssetValue = btn.dataset.value;
            if (assetValueEl) assetValueEl.textContent = btn.textContent;
            assetMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (assetDropdown) assetDropdown.classList.remove('open');
            if (doneAssetOther) {
                doneAssetOther.style.display = selectedAssetValue === '__other__' ? '' : 'none';
                if (selectedAssetValue === '__other__') doneAssetOther.focus();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (assetDropdown && !assetDropdown.contains(e.target)) {
            assetDropdown.classList.remove('open');
        }
    });

    if (donePictureBtn) {
        donePictureBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            donePhotoOptions.style.display = donePhotoOptions.style.display === 'grid' ? 'none' : 'grid';
        });
    }
    if (donePhotoOptions) {
        donePhotoOptions.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-source]');
            if (!btn) return;
            donePhotoOptions.style.display = 'none';
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            if (btn.dataset.source === 'camera') {
                fileInput.accept = 'image/*';
                fileInput.setAttribute('capture', 'environment');
            } else if (btn.dataset.source === 'library') {
                fileInput.accept = 'image/*';
            }
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            fileInput.addEventListener('change', () => {
                const files = fileInput.files ? Array.from(fileInput.files) : [];
                fileInput.remove();
                if (files.length === 0) return;
                const readers = files.map((file) => new Promise((resolve) => {
                    const r = new FileReader();
                    r.onload = () => resolve(r.result);
                    r.readAsDataURL(file);
                }));
                Promise.all(readers).then((results) => {
                    pendingPhotos = pendingPhotos.concat(results);
                    renderPendingPhotos();
                });
            });
            fileInput.click();
        });
    }

    todoList.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const doneBtn = target.closest('.done-btn');
        if (!doneBtn) return;
        const taskText = doneBtn.getAttribute('data-task') || '';
        openDonePopup(taskText);
    });

    if (doneCancel) doneCancel.addEventListener('click', closeDonePopup);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && donePopup && donePopup.style.display === 'flex') {
            closeDonePopup();
        }
    });
    if (doneConfirm) doneConfirm.addEventListener('click', () => {
        if (!pendingDoneTask) return;
        doneTasks.push({
            id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            text: pendingDoneTask,
            doneAt: todayKey(),
            asset: selectedAssetValue === '__other__'
                ? (doneAssetOther ? doneAssetOther.value.trim() : '')
                : selectedAssetValue,
            equipment: doneEquipment.value.trim(),
            comments: doneComments.value.trim(),
            time: doneTime.value.trim(),
            cost: doneCost.value.trim(),
            photos: pendingPhotos
        });
        saveDoneTasks();
        const doneBtn = todoList.querySelector(`.done-btn[data-task="${pendingDoneTask}"]`);
        if (doneBtn) {
            const item = doneBtn.closest('li');
            if (item) item.remove();
        }
        closeDonePopup();
    });

    if (viewDoneBtn) {
        viewDoneBtn.addEventListener('click', () => {
            window.location.href = 'myplanning-done.html';
        });
    }

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
    let EVENTS = window.MyMaintenanceEvents.load();

    // === UPCOMING EVENTS ===

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
        box.innerHTML = window.MyMaintenanceEvents.eventHeaderRowHtml({ name: 'Event', asset: 'Location', date: 'Date' })
            + upcoming.map(({ key, ev }) => window.MyMaintenanceEvents.eventRowHtml(key, ev)).join('');
    }

    const upcomingBox = document.getElementById('upcoming-events');
    if (upcomingBox) {
        upcomingBox.addEventListener('click', (e) => {
            const item = e.target.closest('.ev-row-open[data-key]');
            if (item) window.location.href = 'myplanning-calendar.html?date=' + item.dataset.key;
        });
    }

    // === PLANNED MAINTENANCE ===
    function renderPlanned() {
        const box = document.getElementById('plan-planned');
        if (!box) return;
        const next = window.MyMaintenanceEvents.plannedMaintenance(3);
        if (next.length === 0) {
            box.innerHTML = '<p class="dash-upcoming-empty">No maintenance planned</p>';
            return;
        }
        box.innerHTML = window.MyMaintenanceEvents.eventHeaderRowHtml({ name: 'Maintenance', asset: 'Asset', date: 'Date' })
            + next.map(({ key, ev }) => window.MyMaintenanceEvents.eventRowHtml(key, ev)).join('');
    }

    const planPlannedBox = document.getElementById('plan-planned');
    if (planPlannedBox) {
        planPlannedBox.addEventListener('click', (e) => {
            const item = e.target.closest('.ev-row-open[data-key]');
            if (item) window.location.href = 'myplanning-calendar.html?date=' + item.dataset.key;
        });
    }

    const planPlannedAdd = document.getElementById('plan-planned-add');
    if (planPlannedAdd) {
        planPlannedAdd.addEventListener('click', () => {
            if (window.MyMaintenanceEventModal) {
                window.MyMaintenanceEventModal.open(window.MyMaintenanceEvents.todayKey(), { plannedMaintenance: true });
            }
        });
    }

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
    const upcomingAddBtn = document.getElementById('upcoming-add-event');
    [planAddBtn, upcomingAddBtn].forEach(function (btn) {
        if (!btn) return;
        btn.addEventListener('click', () => {
            const now = new Date();
            const key = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
            if (window.MyMaintenanceEventModal) window.MyMaintenanceEventModal.open(key);
        });
    });

    window.addEventListener('myevents:changed', () => {
        EVENTS = window.MyMaintenanceEvents.load();
        renderCalendar();
        renderUpcoming();
        renderPlanned();
    });

    renderCalendar();
    renderUpcoming();
    renderPlanned();
    prevBtn.addEventListener('click', () => { calOffset--; renderCalendar(); });
    nextBtn.addEventListener('click', () => { calOffset++; renderCalendar(); });
});

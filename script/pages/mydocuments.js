document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('doc-add-btn');
    const popup = document.getElementById('doc-add-popup');
    const fileInput = document.getElementById('doc-file');
    const pickBtn = document.getElementById('doc-pick-btn');
    const fileNameLabel = document.getElementById('doc-file-name');
    const nameInput = document.getElementById('doc-name');
    const performedInput = document.getElementById('doc-performed');
    const uploadedInput = document.getElementById('doc-uploaded');
    const sizeInput = document.getElementById('doc-size');
    const cancelBtn = document.getElementById('doc-cancel');
    const saveBtn = document.getElementById('doc-save');
    const assetDropdown = document.getElementById('doc-asset-dropdown');
    const assetToggle = document.getElementById('doc-asset-toggle');
    const assetMenu = document.getElementById('doc-asset-menu');
    const assetValueEl = document.querySelector('#doc-asset-toggle .asset-value');
    const docAssetOther = document.getElementById('doc-asset-other');
    const cal = document.getElementById('doc-cal-performed');
    const oldDatePopup = document.getElementById('doc-old-date-popup');
    const oldDateText = document.getElementById('doc-old-date-text');
    const oldDateConfirm = document.getElementById('doc-old-confirm');
    const oldDateCancel = document.getElementById('doc-old-cancel');
    const privacyRadios = document.querySelectorAll('input[name="doc-privacy"]');
    const privacyInfo = document.getElementById('doc-privacy-info');
    const privacyWrap = document.querySelector('.doc-info-wrap');

    if (!addBtn || !popup) return;

    const KEY = 'floorplan_user_docs';
    let selectedAssetValue = '';
    let docSort = 'uploaded';
    let docReverse = false;

    function seedDocs() {
        return [
            { id: 'd_seed_1', name: 'Example', asset: 'Address 1, Street 123, 5000 City', performed: '2026-01-01', uploaded: '2026-01-01', size: null, sizeLabel: '', data: '', type: 'application/pdf', fileName: 'example.pdf', privacy: 'private' }
        ];
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw !== null) return JSON.parse(raw);
        } catch (e) {}
        return seedDocs();
    }

    let items = load().map(function (it) {
        if (!it.privacy) it.privacy = 'private';
        return it;
    });

    function store() {
        const meta = items.map(function (it) {
            const copy = Object.assign({}, it);
            if (it.payloadInDB) {
                delete copy.data;
                delete copy.payloadInDB;
            }
            return copy;
        });
        localStorage.setItem(KEY, JSON.stringify(meta));
        window.dispatchEvent(new CustomEvent('mydocs:changed'));
    }

    const DB_NAME = 'floorplan_user_doc_payloads';
    const DB_STORE = 'payloads';
    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve, reject) {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function () {
                if (!req.result.objectStoreNames.contains(DB_STORE)) {
                    req.result.createObjectStore(DB_STORE);
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
        return dbPromise;
    }

    function payloadSet(id, dataUrl) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).put(dataUrl, id);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function payloadGet(id) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(DB_STORE, 'readonly');
                const req = tx.objectStore(DB_STORE).get(id);
                req.onsuccess = function () { resolve(req.result || null); };
                req.onerror = function () { reject(req.error); };
            });
        });
    }

    function getPayload(it) {
        if (it.data) return Promise.resolve(it.data);
        return payloadGet(it.id).then(function (data) { return data || ''; });
    }

    function payloadDelete(id) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).delete(id);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        }).catch(function () {});
    }

    (function migratePayloads() {
        const jobs = [];
        items.forEach(function (it) {
            if (it.data) jobs.push(
                payloadSet(it.id, it.data)
                    .then(function () { it.payloadInDB = true; })
                    .catch(function () {})
            );
        });
        if (jobs.length) Promise.all(jobs).then(function () { store(); });
    })();

    const searchInput = document.getElementById('doc-search');
    const docListHead = document.getElementById('doc-list-head');
    let searchQuery = '';
    let searchTimer = null;

    function normalizeForSearch(s) {
        return String(s || '').toLowerCase().replace(/\s+/g, ' ');
    }

    function normalizeSizeForSearch(s) {
        return String(s || '').toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');
    }

    function searchFields(it) {
        const info = fileTypeInfo(it);
        return [
            { key: 'name', text: normalizeForSearch(it.name), weight: 100 },
            { key: 'asset', text: normalizeForSearch(it.asset || 'Other'), weight: 90 },
            { key: 'fileName', text: normalizeForSearch(it.fileName), weight: 40 },
            { key: 'type', text: normalizeForSearch(info.label), weight: 20 },
            { key: 'performed', text: normalizeForSearch(formatDateLabel(it.performed)), weight: 15 },
            { key: 'uploaded', text: normalizeForSearch(formatDateLabel(it.uploaded)), weight: 15 },
            { key: 'datesD', text: dateDigits(it), weight: 120 },
            { key: 'size', text: normalizeSizeForSearch(formatSize(it.size)), weight: 10, norm: normalizeSizeForSearch },
            { key: 'privacy', text: normalizeForSearch(it.privacy), weight: 10 }
        ];
    }

    function dateInfo(it) {
        const out = [];
        ['performed', 'uploaded'].forEach(function (k) {
            const iso = it[k];
            if (!iso) return;
            const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!m) return;
            out.push({ d: +m[3], m: +m[2], y: +m[1], iso: iso });
        });
        return out;
    }

    function dateDigits(it) {
        return dateInfo(it).map(function (d) {
            return String(d.d).padStart(2, '0') + String(d.m).padStart(2, '0') + String(d.y);
        }).join(' ');
    }

    function fieldTermScore(text, term) {
        if (!text) return 0;
        const idx = text.indexOf(term);
        if (idx === -1) return 0;
        let s = 1;
        if (text === term) s += 2;
        else if (idx === 0) s += 1;
        const before = text[idx - 1];
        if (!before || before === ' ' || before === '/' || before === '.' || before === ',' || before === '-') s += 0.5;
        return s;
    }

    function docScore(it, terms) {
        const fields = searchFields(it);
        let total = 0;
        let matched = 0;
        for (let t = 0; t < terms.length; t++) {
            let best = 0;
            for (let f = 0; f < fields.length; f++) {
                const term = fields[f].norm ? fields[f].norm(terms[t]) : terms[t];
                const sc = fieldTermScore(fields[f].text, term);
                if (sc > 0 && sc * fields[f].weight > best) best = sc * fields[f].weight;
            }
            total += best;
            if (best > 0) matched++;
        }
        if (terms.length && matched === terms.length) total += 60;
        return total;
    }

    function searchResults(query) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) return [];
        const scored = [];
        for (let i = 0; i < items.length; i++) {
            const s = docScore(items[i], terms);
            if (s > 0) scored.push({ it: items[i], s: s });
        }
        scored.sort((a, b) => {
            if (b.s !== a.s) return b.s - a.s;
            return sortBefore(a.it, b.it) ? -1 : (sortBefore(b.it, a.it) ? 1 : 0);
        });
        return scored;
    }

    function highlight(text, terms) {
        const s = String(text || '');
        if (!terms.length) return escapeHtml(s);
        const lower = s.toLowerCase();
        const pats = terms.slice().sort((a, b) => b.length - a.length)
            .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const re = new RegExp(pats.join('|'), 'g');
        let out = '';
        let last = 0;
        let m;
        while ((m = re.exec(lower)) !== null) {
            out += escapeHtml(s.slice(last, m.index));
            out += '<mark class="doc-mark">' + escapeHtml(m[0]) + '</mark>';
            last = m.index + m[0].length;
            if (m.index === re.lastIndex) re.lastIndex++;
        }
        out += escapeHtml(s.slice(last));
        return out;
    }

    function renderSearch() {
        const groupsEl = document.getElementById('doc-groups');
        if (!groupsEl) return;
        const results = searchResults(searchQuery);
        const q = searchQuery.trim();
        if (docListHead) docListHead.style.display = 'none';
        if (!results.length) {
            groupsEl.innerHTML = '<p class="doc-empty">No documents match &ldquo;' + escapeHtml(q) + '&rdquo;.</p>';
            return;
        }
        groupsEl.innerHTML = '<div class="doc-search-header">' + results.length + ' result' + (results.length === 1 ? '' : 's')
            + ' for &ldquo;' + escapeHtml(q) + '&rdquo;</div>';
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        for (let i = 0; i < results.length; i++) {
            groupsEl.appendChild(renderRow(results[i].it, terms));
        }
    }

    function resetSearch() {
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        if (docListHead) docListHead.style.display = 'flex';
        render();
    }

    function updateView() {
        if (searchQuery && searchQuery.trim()) renderSearch();
        else render();
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            clearTimeout(searchTimer);
            if (searchQuery && searchQuery.trim()) {
                searchTimer = setTimeout(renderSearch, 90);
            } else {
                resetSearch();
            }
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                searchInput.value = '';
                searchQuery = '';
                clearTimeout(searchTimer);
                resetSearch();
            } else if (e.key === 'Enter') {
                searchInput.blur();
            }
        });
    }

    function formatSize(bytes) {
        if (bytes == null) return '';
        const KB = 1024;
        const MB = 1024 * 1024;
        if (bytes >= MB) return (bytes / MB).toFixed(1) + ' MB';
        if (bytes >= KB) return (bytes / KB).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function toInputDate(dt) {
        return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
    }

    function toISO(dt) {
        return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    }

    function parseDateStr(str) {
        const s = String(str || '').trim();
        if (!s) return null;
        let parts;
        if (s.includes('/')) parts = s.split('/');
        else if (s.includes('.')) parts = s.split('.');
        else if (s.includes('-')) parts = s.split('-');
        else parts = s.match(/\d{1,2}|\d{4}/g);
        if (!parts || parts.length !== 3) return null;
        let [a, b, c] = parts.map(Number);
        if ([a, b, c].some((n) => isNaN(n))) return null;
        let day = a, month = b, year = c;
        if (year < 100) year += 2000;
        if (year < 1000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;
        const dt = new Date(year, month - 1, day);
        if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
        return dt;
    }

    function isClearlyInvalid(str) {
        const s = String(str || '').trim();
        if (!s) return false;
        const digits = s.replace(/\D/g, '');
        if (!digits.length) return false;
        const parts = s.split(/[/.\-]/);

        const dayStr = parts[0].replace(/\D/g, '');
        if (dayStr.length === 1) {
            if (dayStr !== '0' && parseInt(dayStr, 10) > 3) return true;
        } else if (dayStr.length === 2) {
            const day = parseInt(dayStr, 10);
            if (day < 1 || day > 31) return true;
        }
        let dayNum = dayStr.length ? parseInt(dayStr, 10) : NaN;

        let monNum = NaN;
        if (parts.length >= 2) {
            const monStr = parts[1].replace(/\D/g, '');
            if (monStr.length === 1) {
                if (parseInt(monStr, 10) > 1) return true;
            } else if (monStr.length === 2) {
                const mon = parseInt(monStr, 10);
                if (mon < 1 || mon > 12) return true;
            }
            if (monStr.length) monNum = parseInt(monStr, 10);
        }

        if (parts.length >= 3) {
            const yDigits = String(parts[2]).replace(/\D/g, '');
            if (yDigits.length) {
                const maxYear = new Date().getFullYear();
                const prefix = yDigits.slice(0, 4);
                const minY = parseInt(prefix + '0'.repeat(4 - prefix.length), 10);
                const maxY = parseInt(prefix + '9'.repeat(4 - prefix.length), 10);
                if (minY > maxYear || maxY < 1000) return true;
            }
        }

        if (dayNum >= 1 && dayNum <= 31 && monNum >= 1 && monNum <= 12) {
            const yearPart = parts.length >= 3 ? Number(parts[2]) : NaN;
            const y = !isNaN(yearPart) && yearPart > 0 ? (yearPart < 100 ? yearPart + 2000 : yearPart) : 2024;
            if (dayNum > new Date(y, monNum, 0).getDate()) return true;
        }

        if (digits.length === 8) {
            const dt = parseDateStr(s);
            if (!dt || dt.getTime() > Date.now()) return true;
        }
        return false;
    }

        let editingId = null;

    function ensureDeleteBtn() {
        if (popup.querySelector('.doc-delete-btn')) return;
        const wrap = document.createElement('div');
        wrap.style.marginTop = '18px';
        wrap.innerHTML = '<button type="button" class="popup-btn delete doc-delete-btn" style="width:100%;display:none;">Delete document</button>';
        const content = popup.querySelector('.popup-content');
        if (content) content.appendChild(wrap);
        wrap.querySelector('.doc-delete-btn').addEventListener('click', confirmDelete);
    }

    function ensureDeleteOverlay() {
        if (document.getElementById('doc-confirm-overlay')) return;
        const ov = document.createElement('div');
        ov.id = 'doc-confirm-overlay';
        ov.className = 'popup-overlay';
        ov.innerHTML = '<div class="popup-content">'
            + '<h3>Delete document</h3>'
            + '<p class="doc-confirm-msg"></p>'
            + '<div class="popup-buttons">'
            + '<button type="button" class="popup-btn cancel doc-del-cancel">Cancel</button>'
            + '<button type="button" class="popup-btn delete doc-del-confirm">Delete</button>'
            + '</div></div>';
        document.body.appendChild(ov);
        ov.querySelector('.doc-del-cancel').addEventListener('click', function () { ov.style.display = 'none'; });
        ov.querySelector('.doc-del-confirm').addEventListener('click', doDelete);
        ov.addEventListener('click', function (e) { if (e.target === ov) ov.style.display = 'none'; });
    }

    function confirmDelete() {
        ensureDeleteOverlay();
        const ov = document.getElementById('doc-confirm-overlay');
        if (!ov) return;
        ov.querySelector('.doc-confirm-msg').textContent = 'Delete this document permanently?';
        ov.style.display = 'flex';
    }

    function doDelete() {
        if (!editingId) return;
        payloadDelete(editingId);
        items = items.filter(function (i) { return i.id !== editingId; });
        store();
        updateView();
        const ol = document.getElementById('doc-confirm-overlay');
        if (ol) ol.style.display = 'none';
        closePopup();
        previewClose();
    }

    function openPopup() {
        editingId = null;
        ensureDeleteBtn();
        const d = popup.querySelector('.doc-delete-btn');
        if (d) d.style.display = 'none';
        fileInput.value = '';
        clearFileError();
        if (oldDatePopup) oldDatePopup.style.display = 'none';
        nameInput.value = '';
        performedInput.value = '';
        performedInput.classList.remove('invalid');
        uploadedInput.value = toInputDate(new Date());
        sizeInput.value = '';
        if (fileNameLabel) fileNameLabel.textContent = 'No file selected';
        selectedAssetValue = '';
        if (assetValueEl) assetValueEl.textContent = '-- Select an asset --';
        if (assetDropdown) assetDropdown.classList.remove('open');
        if (assetMenu) assetMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
        if (docAssetOther) {
            docAssetOther.value = '';
            docAssetOther.style.display = 'none';
        }
        if (cal) cal.classList.remove('open');
        setPrivacy('private');
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Add document';
        popup.style.display = 'flex';
    }

    function openEditPopup(it) {
        editingId = it.id;
        fileInput.value = '';
        clearFileError();
        if (oldDatePopup) oldDatePopup.style.display = 'none';
        nameInput.value = it.name || '';
        performedInput.value = formatDateLabel(it.performed) || '';
        performedInput.classList.remove('invalid');
        uploadedInput.value = formatDateLabel(it.uploaded) || '';
        sizeInput.value = formatSize(it.size);
        if (fileNameLabel) fileNameLabel.textContent = it.fileName || 'No file selected';
        if (assetMenu) {
            const known = Array.prototype.slice.call(assetMenu.querySelectorAll('button[data-value]'));
            known.forEach((b) => b.classList.remove('selected'));
            const a = it.asset ? String(it.asset).trim() : '';
            const match = known.find((b) => b.dataset.value === a);
            if (match) {
                selectedAssetValue = a;
                if (assetValueEl) assetValueEl.textContent = match.textContent;
                match.classList.add('selected');
                if (docAssetOther) {
                    docAssetOther.value = '';
                    docAssetOther.style.display = 'none';
                }
            } else if (a) {
                selectedAssetValue = '__other__';
                if (assetValueEl) assetValueEl.textContent = a;
                const otherBtn = known.find((b) => b.dataset.value === '__other__');
                if (otherBtn) otherBtn.classList.add('selected');
                if (docAssetOther) {
                    docAssetOther.style.display = '';
                    docAssetOther.value = a;
                }
            } else {
                selectedAssetValue = '';
                if (assetValueEl) assetValueEl.textContent = '-- Select an asset --';
            }
        }
        if (assetDropdown) assetDropdown.classList.remove('open');
        if (cal) cal.classList.remove('open');
        ensureDeleteBtn();
        const d = popup.querySelector('.doc-delete-btn');
        if (d) d.style.display = '';
        setPrivacy(it.privacy);
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Edit document';
        popup.style.display = 'flex';
    }

    function closePopup() {
        popup.style.display = 'none';
    }

    addBtn.addEventListener('click', openPopup);
    cancelBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) closePopup();
    });

    function setPrivacy(value) {
        const v = value === 'house' ? 'house' : 'private';
        privacyRadios.forEach(function (r) { r.checked = r.value === v; });
    }

    function privacyValue() {
        const sel = document.querySelector('input[name="doc-privacy"]:checked');
        return sel ? sel.value : 'private';
    }

    if (privacyInfo) {
        privacyInfo.addEventListener('click', function (e) {
            e.stopPropagation();
            if (privacyWrap) privacyWrap.classList.toggle('show');
        });
    }

    privacyRadios.forEach(function (r) {
        r.addEventListener('change', function () {
            if (r.checked) {
                privacyRadios.forEach(function (o) { o.checked = o === r; });
            } else if (!privacyValue()) {
                r.checked = true;
            }
        });
    });

    if (pickBtn) {
        pickBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });
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
            if (docAssetOther) {
                docAssetOther.style.display = selectedAssetValue === '__other__' ? '' : 'none';
                if (selectedAssetValue === '__other__') docAssetOther.focus();
            }
        });
    }
    document.addEventListener('click', (e) => {
        if (assetDropdown && !assetDropdown.contains(e.target)) {
            assetDropdown.classList.remove('open');
        }
        if (cal && !cal.contains(e.target) && e.target !== performedInput) {
            cal.classList.remove('open');
        }
    });

    function markFileError() {
        if (!pickBtn) return;
        pickBtn.classList.remove('shake', 'error');
        void pickBtn.offsetWidth;
        pickBtn.classList.add('shake');
        pickBtn.classList.add('error');
        if (fileNameLabel) fileNameLabel.classList.add('error');
    }

    function clearFileError() {
        if (pickBtn) pickBtn.classList.remove('shake', 'error');
        if (fileNameLabel) fileNameLabel.classList.remove('error');
    }

    fileInput.addEventListener('change', () => {
        clearFileError();
        const file = fileInput.files[0];
        if (!file) {
            if (fileNameLabel) fileNameLabel.textContent = 'No file selected';
            sizeInput.value = '';
            return;
        }
        sizeInput.value = formatSize(file.size);
        if (fileNameLabel) fileNameLabel.textContent = file.name;
        if (!nameInput.value.trim()) {
            const base = file.name.replace(/\.[^.]+$/, '');
            nameInput.value = base;
        }
    });

    const calState = { year: new Date().getFullYear(), month: new Date().getMonth(), selected: null, showYears: false };

    function buildCalendar() {
        if (!cal) return;
        const typed = parseDateStr(performedInput.value);
        if (typed) {
            calState.year = typed.getFullYear();
            calState.month = typed.getMonth();
        }
        const first = new Date(calState.year, calState.month, 1);
        const startDay = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();
        const now = new Date();
        const todayKey = toISO(now);
        const selKey = calState.selected ? toISO(calState.selected) : null;
        const selectedKey = typed ? toISO(typed) : selKey;

        let html = '<div class="doc-cal-header">'
            + '<button type="button" class="doc-cal-nav" data-cal-nav="-1"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>'
            + '<button type="button" class="doc-cal-year-toggle">' + MONTHS[calState.month] + ' ' + calState.year
            + '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>'
            + '<button type="button" class="doc-cal-nav" data-cal-nav="1"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>'
            + '</div>';

        if (calState.showYears) {
            html += '<div class="doc-cal-year-panel">';
            for (let y = 1700; y <= 2110; y++) {
                html += '<button type="button" class="doc-cal-year-btn' + (y === calState.year ? ' current' : '') + '" data-cal-year="' + y + '">' + y + '</button>';
            }
            html += '</div>';
        } else {
            html += '<div class="doc-cal-grid">'
                + '<span class="doc-cal-dow">Mo</span><span class="doc-cal-dow">Tu</span><span class="doc-cal-dow">We</span><span class="doc-cal-dow">Th</span><span class="doc-cal-dow">Fr</span><span class="doc-cal-dow">Sa</span><span class="doc-cal-dow">Su</span>';

            for (let i = 0; i < startDay; i++) {
                html += '<span class="doc-cal-day blank"></span>';
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const key = toISO(new Date(calState.year, calState.month, d));
                let cls = 'doc-cal-day';
                if (key === todayKey) cls += ' today';
                if (key === selectedKey) cls += ' selected';
                if (key > todayKey) cls += ' future';
                html += '<button type="button" class="' + cls + '" data-day="' + d + '"' + (key > todayKey ? ' disabled' : '') + '>' + d + '</button>';
            }
            html += '</div>';
        }
        cal.innerHTML = html;
    }

    buildCalendar();

    function positionCalendar() {
        if (!cal) return;
        const rect = performedInput.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 80) {
            cal.style.top = 'auto';
            cal.style.bottom = 'calc(100% + 8px)';
        } else {
            cal.style.top = 'calc(100% + 8px)';
            cal.style.bottom = 'auto';
        }
    }

    if (performedInput) {
        performedInput.addEventListener('click', (e) => {
            e.stopPropagation();
            positionCalendar();
            cal.classList.toggle('open');
            buildCalendar();
        });
        performedInput.addEventListener('input', () => {
            const raw = performedInput.value;
            const caret = performedInput.selectionStart || 0;
            const digitsBefore = (raw.slice(0, caret).match(/\d/g) || []).length;
            const digits = raw.replace(/\D/g, '').slice(0, 8);
            let formatted = '';
            for (let i = 0; i < digits.length; i++) {
                if (i === 2 || i === 4) formatted += '/';
                formatted += digits[i];
            }
            if (formatted !== raw) {
                performedInput.value = formatted;
                let newCaret = digitsBefore;
                if (digitsBefore > 2) newCaret += 1;
                if (digitsBefore > 4) newCaret += 1;
                newCaret = Math.min(newCaret, formatted.length);
                performedInput.setSelectionRange(newCaret, newCaret);
            }
            const dt = parseDateStr(formatted);
            performedInput.classList.toggle('invalid', isClearlyInvalid(formatted));
            if (dt) buildCalendar();
        });
    }

    if (cal) {
        cal.addEventListener('click', (e) => {
            const nav = e.target.closest('[data-cal-nav]');
            if (nav) {
                e.stopPropagation();
                calState.month += parseInt(nav.dataset.calNav, 10);
                if (calState.month < 0) { calState.month = 11; calState.year--; }
                if (calState.month > 11) { calState.month = 0; calState.year++; }
                calState.showYears = false;
                buildCalendar();
                return;
            }
            const yearBtn = e.target.closest('[data-cal-year]');
            if (yearBtn) {
                e.stopPropagation();
                calState.year = parseInt(yearBtn.dataset.calYear, 10);
                calState.showYears = false;
                buildCalendar();
                return;
            }
            const yearToggle = e.target.closest('.doc-cal-year-toggle');
            if (yearToggle) {
                e.stopPropagation();
                calState.showYears = !calState.showYears;
                buildCalendar();
                return;
            }
            const day = e.target.closest('[data-day]');
            if (!day) return;
            e.stopPropagation();
            const dt = new Date(calState.year, calState.month, parseInt(day.dataset.day, 10));
            performedInput.value = toInputDate(dt);
            performedInput.classList.remove('invalid');
            calState.selected = dt;
            cal.classList.remove('open');
            buildCalendar();
        });
    }

        function commitSave() {
        const file = fileInput.files[0];
        if (!file && !editingId) {
            markFileError();
            return;
        }
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please give the document a name.');
            return;
        }
        const asset = selectedAssetValue === '__other__'
                ? (docAssetOther ? docAssetOther.value.trim() : '')
                : selectedAssetValue;
        const performedDt = parseDateStr(performedInput.value);
        const privacy = privacyValue();
        const apply = (dataUrl) => {
            let rec = null;
            if (editingId) {
                rec = items.find((i) => i.id === editingId);
                if (rec) {
                    rec.name = name;
                    rec.asset = asset;
                    rec.privacy = privacy;
                    rec.performed = performedDt ? toISO(performedDt) : '';
                    if (dataUrl) {
                        rec.type = file.type;
                        rec.fileName = file.name;
                        rec.size = file.size;
                        rec.sizeLabel = formatSize(file.size);
                        rec.uploaded = toISO(new Date());
                        rec.created = Date.now();
                    }
                }
            } else {
                rec = {
                    id: 'd_' + Date.now(),
                    name: name,
                    asset: asset,
                    privacy: privacy,
                    performed: performedDt ? toISO(performedDt) : '',
                    uploaded: toISO(new Date()),
                    created: Date.now(),
                    size: file.size,
                    sizeLabel: formatSize(file.size),
                    type: file.type,
                    fileName: file.name
                };
                items.push(rec);
            }
            const finish = () => { store(); updateView(); closePopup(); };
            if (dataUrl && rec) {
                payloadSet(rec.id, dataUrl).then(function () {
                    rec.payloadInDB = true;
                    delete rec.data;
                    finish();
                }).catch(function () {
                    rec.data = dataUrl;
                    finish();
                });
            } else {
                finish();
            }
        };
        if (file) {
            const reader = new FileReader();
            reader.onload = () => apply(reader.result);
            reader.readAsDataURL(file);
        } else {
            apply(null);
        }
    }

    saveBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file && !editingId) {
            markFileError();
            return;
        }
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please give the document a name.');
            return;
        }
        const hasDateText = performedInput.value.trim() !== '';
        const dateIsFull = performedInput.value.replace(/\D/g, '').length === 8;
        const performedDt = parseDateStr(performedInput.value);
        if (hasDateText) {
            const bad = dateIsFull && (!performedDt || performedDt.getTime() > Date.now());
            performedInput.classList.toggle('invalid', bad);
            if (!dateIsFull) return;
            if (bad) return;
            if (performedDt && performedDt.getFullYear() < 1900) {
                if (oldDateText) oldDateText.textContent = performedInput.value;
                if (oldDatePopup) oldDatePopup.style.display = 'flex';
                return;
            }
        }
        commitSave();
    });

    if (oldDateConfirm) {
        oldDateConfirm.addEventListener('click', () => {
            if (oldDatePopup) oldDatePopup.style.display = 'none';
            commitSave();
        });
    }
    if (oldDateCancel) {
        oldDateCancel.addEventListener('click', () => {
            if (oldDatePopup) oldDatePopup.style.display = 'none';
        });
    }

    function fileTypeInfo(it) {
        const fn = String(it.fileName || it.name || '');
        const ext = ((fn.match(/\.([^.]+)$/) || [])[1] || '').toLowerCase();
        const mime = String(it.type || '').toLowerCase();
        const map = {
            pdf: ['PDF', 'file-pdf'],
            png: ['IMG', 'file-image'], jpg: ['IMG', 'file-image'], jpeg: ['IMG', 'file-image'],
            gif: ['IMG', 'file-image'], webp: ['IMG', 'file-image'], bmp: ['IMG', 'file-image'],
            svg: ['SVG', 'file-image'],
            doc: ['DOC', 'file-doc'], docx: ['DOC', 'file-doc'], odt: ['DOC', 'file-doc'],
            xls: ['XLS', 'file-xls'], xlsx: ['XLS', 'file-xls'], csv: ['CSV', 'file-xls'],
            ppt: ['PPT', 'file-ppt'], pptx: ['PPT', 'file-ppt'],
            txt: ['TXT', 'file-text'], md: ['TXT', 'file-text'], log: ['TXT', 'file-text'],
            zip: ['ZIP', 'file-zip'], '7z': ['ZIP', 'file-zip'], rar: ['ZIP', 'file-zip'],
            mp3: ['MP3', 'file-audio'], wav: ['AUD', 'file-audio'], flac: ['AUD', 'file-audio'],
            mp4: ['MKV', 'file-video'], mkv: ['MKV', 'file-video'], mov: ['MOV', 'file-video'],
            webm: ['VID', 'file-video'], avi: ['AVI', 'file-video'],
            '3mf': ['3MF', 'file-3d'], stl: ['STL', 'file-3d'], obj: ['OBJ', 'file-3d'], step: ['STEP', 'file-3d']
        };
        if (map[ext]) return { label: map[ext][0], cls: map[ext][1], ext: ext, mime: mime };
        if (mime.indexOf('image') === 0) return { label: 'IMG', cls: 'file-image', ext: ext, mime: mime };
        if (mime.indexOf('pdf') !== -1) return { label: 'PDF', cls: 'file-pdf', ext: ext, mime: mime };
        const short = ((ext || 'FILE').toUpperCase().slice(0, 4) || 'FILE');
        return { label: short, cls: 'file-blank', ext: ext, mime: mime };
    }

    function formatDateLabel(iso) {
        if (!iso) return '';
        const parts = String(iso).split('-');
        if (parts.length !== 3) return iso;
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    }

    function assetLabel(it) {
        const a = it.asset ? String(it.asset).trim() : '';
        return a || 'Other';
    }

    function docIcon(info) {
        info = info || {};
        if (info.cls === 'file-image') {
            return '<svg class="doc-symbol" xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="#20b2aa"><path d="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Zm0-60h600v-600H180v600Zm0 0v-600 600Zm86-97h429q8.5 0 12.75-8t-.75-16L590-457q-5-6-12-6t-12 6L446-302l-81-111q-5-6-12-6t-12 6l-86 112q-6 8-1.75 16t12.75 8Z"/></svg>';
        }
        if (info.cls === 'file-3d') {
            return '<svg class="doc-symbol" xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="#20b2aa"><path d="M450-154v-309L180-619v309l270 156Zm60 0 270-156v-310L510-463.16V-154Zm-30-360 266-155-266-154-267 154 267 155ZM150-258q-14.25-8.43-22.12-22.21Q120-294 120-310v-340q0-16 7.88-29.79Q135.75-693.57 150-702l300-173q14.33-8 30.16-8 15.84 0 29.84 8l300 173q14.25 8.43 22.13 22.21Q840-666 840-650v340q0 16-7.87 29.79Q824.25-266.43 810-258L510-85q-14.33 8-30.16 8Q464-77 450-85L150-258Zm330-222Z"/></svg>';
        }
        return '<svg class="doc-symbol" xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="#20b2aa"><path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>';
    }

    function privacyTagHtml(it) {
        const isHouse = it.privacy === 'house';
        return '<span class="doc-privacy-tag ' + (isHouse ? 'house' : 'private') + '">' + (isHouse ? 'House' : 'Private') + '</span>';
    }

    function renderHeaderRow() {
        const row = document.createElement('div');
        row.className = 'doc-row doc-header-row';
        const left = document.createElement('div');
        left.className = 'doc-row-left';
        left.innerHTML = '<span class="doc-cell doc-cell-icon"></span>'
            + '<span class="doc-cell doc-cell-asset doc-col-label">Asset</span>'
            + '<span class="doc-cell doc-cell-name doc-col-label">Document</span>';
        const right = document.createElement('div');
        right.className = 'doc-row-right';
        right.innerHTML = '<span class="doc-cell doc-cell-performed doc-col-label">Date Performed</span>'
            + '<span class="doc-cell doc-cell-uploaded doc-col-label">Date Uploaded</span>'
            + '<span class="doc-cell doc-cell-type doc-col-label">Doc Type</span>'
            + '<span class="doc-cell doc-cell-size doc-col-label">Size</span>'
            + '<span class="doc-cell doc-cell-privacy doc-col-label">Privacy</span>'
            + '<span class="doc-cell doc-cell-edit doc-col-label">Edit</span>';
        row.appendChild(left);
        row.appendChild(right);
        return row;
    }

    function renderRow(it, terms) {
        const row = document.createElement('div');
        row.className = 'doc-row doc-row-open';
        row.dataset.id = it.id;
        const info = fileTypeInfo(it);
        const useMark = !!(terms && terms.length);
        const left = document.createElement('div');
        left.className = 'doc-row-left';
        left.innerHTML = docIcon(info)
            + '<span class="doc-cell doc-cell-asset">' + (useMark ? highlight(assetLabel(it), terms) : escapeHtml(assetLabel(it))) + '</span>'
            + '<span class="doc-cell doc-cell-name">' + (useMark ? highlight(it.name, terms) : escapeHtml(it.name)) + '</span>';
        const right = document.createElement('div');
        right.className = 'doc-row-right';
        right.innerHTML = '<span class="doc-cell doc-cell-performed">' + escapeHtml(formatDateLabel(it.performed)) + '</span>'
            + '<span class="doc-cell doc-cell-uploaded">' + escapeHtml(formatDateLabel(it.uploaded)) + '</span>'
            + '<span class="doc-cell doc-cell-type">' + escapeHtml(info.label) + '</span>'
            + '<span class="doc-cell doc-cell-size">' + escapeHtml(formatSize(it.size)) + '</span>'
            + '<span class="doc-cell doc-cell-privacy">' + privacyTagHtml(it) + '</span>'
            + '<span class="doc-cell doc-cell-edit"><button type="button" class="doc-edit-btn" title="Edit document"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button></span>';
        row.appendChild(left);
        row.appendChild(right);
        const eb = row.querySelector('.doc-edit-btn');
        if (eb) eb.addEventListener('click', function (e) { e.stopPropagation(); openEditPopup(it); });
        return row;
    }

    function headerRowHtml() {
        return '<div class="doc-row doc-header-row">'
            + '<div class="doc-row-left">'
            + '<span class="doc-cell doc-cell-icon"></span>'
            + '<span class="doc-cell doc-cell-name doc-col-label">Document</span>'
            + '</div>'
            + '<div class="doc-row-right">'
            + '<span class="doc-cell doc-cell-performed doc-col-label">Performed</span>'
            + '<span class="doc-cell doc-cell-uploaded doc-col-label">Uploaded</span>'
            + '<span class="doc-cell doc-cell-size doc-col-label">Size</span>'
            + '<span class="doc-cell doc-cell-privacy doc-col-label">Privacy</span>'
            + '</div>'
            + '</div>';
    }

    function rowHtml(it) {
        const info = fileTypeInfo(it);
        return '<div class="doc-row doc-row-open" data-doc-id="' + escapeHtml(it.id) + '">'
            + '<div class="doc-row-left">'
            + docIcon(info)
            + '<span class="doc-cell doc-cell-name">' + escapeHtml(it.name) + '</span>'
            + '</div>'
            + '<div class="doc-row-right">'
            + '<span class="doc-cell doc-cell-performed">' + escapeHtml(formatDateLabel(it.performed)) + '</span>'
            + '<span class="doc-cell doc-cell-uploaded">' + escapeHtml(formatDateLabel(it.uploaded)) + '</span>'
            + '<span class="doc-cell doc-cell-size">' + escapeHtml(formatSize(it.size)) + '</span>'
            + '<span class="doc-cell doc-cell-privacy">' + privacyTagHtml(it) + '</span>'
            + '</div>'
            + '</div>';
    }

    function recTime(it) {
        if (it.created) return it.created;
        const p = String(it.uploaded || '').split('-').map(Number);
        if (p.length === 3 && !isNaN(p[0] + p[1] + p[2])) return new Date(p[0], p[1] - 1, p[2]).getTime();
        return 0;
    }

    function sortBefore(a, b) {
        switch (docSort) {
            case 'alpha':
                return String(a.name || '').toLowerCase() < String(b.name || '').toLowerCase();
            case 'size':
                return (a.size || 0) < (b.size || 0);
            case 'type':
                return fileTypeInfo(a).label < fileTypeInfo(b).label;
            case 'asset':
                return String(a.asset || '').toLowerCase() < String(b.asset || '').toLowerCase();
            case 'performed':
                return String(a.performed || '') > String(b.performed || '');
            default:
                return recTime(a) > recTime(b);
        }
    }

    function sortComparator() {
        return function (a, b) {
            const r = sortBefore(a, b) ? -1 : (sortBefore(b, a) ? 1 : 0);
            return docReverse ? -r : r;
        };
    }

    function initDocSort() {
        const dd = document.getElementById('doc-sort-dropdown');
        if (dd) {
            dd.querySelectorAll('.dropdown-menu button').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    docSort = btn.getAttribute('data-sort') || 'uploaded';
                    updateView();
                });
            });
        }
        const inv = document.getElementById('doc-sort-invert');
        if (inv) {
            inv.addEventListener('click', function () {
                docReverse = !docReverse;
                inv.classList.toggle('active', docReverse);
                if (dd) dd.classList.toggle('inverted', docReverse);
                updateView();
            });
        }
        const groupsEl = document.getElementById('doc-groups');
        if (groupsEl) {
            groupsEl.addEventListener('click', function (e) {
                const toggle = e.target.closest('.collapse-toggle');
                if (!toggle) return;
                const grp = toggle.closest('.doc-group');
                const content = grp && grp.querySelector('.subgroup-content');
                if (!grp || !content) return;
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
    }

    function render() {
        if (!items.length) {
            const groupsEl = document.getElementById('doc-groups');
            if (groupsEl) groupsEl.innerHTML = '<p class="doc-empty">No documents yet.</p>';
            const recentEl = document.getElementById('doc-recent');
            if (recentEl) recentEl.innerHTML = '<p class="doc-empty">No documents yet.</p>';
            return;
        }

        const groupsEl = document.getElementById('doc-groups');
        if (groupsEl) {
            groupsEl.innerHTML = '';
            const byAsset = new Map();
            items.forEach(function (it) {
                const key = it.asset && String(it.asset).trim() ? String(it.asset).trim() : '__other__';
                if (!byAsset.has(key)) byAsset.set(key, []);
                byAsset.get(key).push(it);
            });
            byAsset.forEach(function (arr, key) {
                const sortedArr = arr.slice().sort(sortComparator());
                const grp = document.createElement('div');
                grp.className = 'subgroup doc-group';
                const title = key === '__other__' ? 'Other' : key;
                const head = document.createElement('div');
                head.className = 'doc-group-header';
                head.innerHTML = '<button class="collapse-toggle"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h4>' + escapeHtml(title) + '</h4>';
                const content = document.createElement('div');
                content.className = 'subgroup-content';
                content.appendChild(renderHeaderRow());
                sortedArr.forEach(function (it) { content.appendChild(renderRow(it)); });
                grp.appendChild(head);
                grp.appendChild(content);
                groupsEl.appendChild(grp);
            });
        }

        const recentEl = document.getElementById('doc-recent');
        if (recentEl) {
            recentEl.innerHTML = '';
            recentEl.appendChild(renderHeaderRow());
            items.slice().sort(function (x, y) {
                return recTime(y) - recTime(x);
            }).slice(0, 3).forEach(function (it) { recentEl.appendChild(renderRow(it)); });
        }
    }

    function ensurePreview() {
        if (document.getElementById('doc-preview-overlay')) return;
        const ov = document.createElement('div');
        ov.id = 'doc-preview-overlay';
        ov.className = 'popup-overlay';
        ov.innerHTML = '<div class="preview-card">'
            + '<div class="preview-head"><span class="preview-title"></span><button type="button" class="preview-close" aria-label="Close">&#10005;</button></div>'
            + '<div class="preview-body"></div>'
            + '<div class="popup-buttons preview-actions"></div>'
            + '</div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) previewClose(); });
        ov.querySelector('.preview-close').addEventListener('click', previewClose);
    }

    function previewClose() {
        if (window.MyPdfViewer) window.MyPdfViewer.close();
        if (window.My3dViewer) window.My3dViewer.close();
        const ov = document.getElementById('doc-preview-overlay');
        if (ov) ov.style.display = 'none';
        document.body.style.overflow = '';
    }

    async function openPreview(it) {
        ensurePreview();
        const ov = document.getElementById('doc-preview-overlay');
        if (!ov) return;
        const info = fileTypeInfo(it);
        const body = ov.querySelector('.preview-body');
        const actions = ov.querySelector('.preview-actions');
        const title = ov.querySelector('.preview-title');
        title.textContent = it.name + (it.asset ? ' - ' + it.asset : '');
        ov.classList.remove('preview-max');
        let data = '';
        try {
            data = await getPayload(it) || '';
        } catch (err) {
            data = '';
        }
        if (info.cls === 'file-image' && data) {
            body.innerHTML = '<div class="preview-img-wrap"><img class="preview-media" src="' + data + '" alt="' + escapeHtml(it.name) + '"></div>';
        } else if (info.cls === 'file-pdf' && data) {
            body.innerHTML = '';
            if (window.MyPdfViewer) {
                window.MyPdfViewer.open(data, it.fileName || (it.name + '.pdf'), body);
            } else {
                body.innerHTML = '<div class="preview-note">PDF viewer not available. Use Open or Download below.</div>';
            }
        } else if (info.cls === 'file-3d' && data) {
            body.innerHTML = '';
            if (window.My3dViewer) {
                window.My3dViewer.open(data, it.fileName || (it.name + '.' + info.ext), body, info.ext);
            } else {
                body.innerHTML = '<div class="preview-note">3D viewer not available. Use Open or Download below.</div>';
            }
        } else {
            body.innerHTML = '<div class="preview-note">This file type cannot be previewed here. Use Open or Download below.</div>';
        }
        actions.innerHTML = '';
        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'popup-btn confirm';
        dl.textContent = 'Download';
        dl.addEventListener('click', function () { downloadDoc(it); });
        actions.appendChild(dl);
        if (data) {
            const fs = document.createElement('button');
            fs.type = 'button';
            fs.id = 'doc-preview-fullscreen';
            fs.className = 'popup-btn';
            fs.textContent = 'Full screen';
            fs.addEventListener('click', togglePreviewFullscreen);
            actions.appendChild(fs);
            const op = document.createElement('button');
            op.type = 'button';
            op.className = 'popup-btn';
            op.textContent = 'Open in new tab';
            op.addEventListener('click', function () {
                window.open(dataUrlToBlobUrl(data), '_blank');
            });
            actions.appendChild(op);
        }
        ov.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function dataUrlToBlobUrl(dataUrl) {
        try {
            const parts = dataUrl.split(',');
            const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
            const bin = atob(parts[1]);
            const out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return URL.createObjectURL(new Blob([out], { type: mime }));
        } catch (err) {
            return dataUrl;
        }
    }

    function togglePreviewFullscreen() {
        const ov = document.getElementById('doc-preview-overlay');
        if (!ov) return;
        const btn = ov.querySelector('#doc-preview-fullscreen');
        const isMax = ov.classList.toggle('preview-max');
        if (btn) btn.textContent = isMax ? 'Exit full screen' : 'Full screen';
    }

    async function downloadDoc(it) {
        const data = await getPayload(it);
        if (!data) return;
        const a = document.createElement('a');
        a.href = data;
        a.download = it.fileName || (it.name || 'document');
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    document.addEventListener('click', function (e) {
        const row = e.target.closest('.doc-row-open');
        if (!row) return;
        const rec = items.find(function (i) { return i.id === (row.dataset.docId || row.dataset.id); });
        if (rec) openPreview(rec);
    });

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const pv = document.getElementById('doc-preview-overlay');
            if (pv && pv.style.display === 'flex') {
                if (pv.classList.contains('preview-max')) {
                    pv.classList.remove('preview-max');
                    const fsBtn = pv.querySelector('#doc-preview-fullscreen');
                    if (fsBtn) fsBtn.textContent = 'Full screen';
                    return;
                }
                previewClose();
                return;
            }
            const cf = document.getElementById('doc-confirm-overlay');
            if (cf && cf.style.display === 'flex') {
                cf.style.display = 'none';
                return;
            }
            if (searchQuery && searchQuery.trim()) {
                resetSearch();
                return;
            }
        }
        if (popup.style.display !== 'flex') return;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (oldDatePopup && oldDatePopup.style.display === 'flex') {
                oldDatePopup.style.display = 'none';
                return;
            }
            closePopup();
        } else if (e.key === 'Enter') {
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'BUTTON') return;
            e.preventDefault();
            if (cal && cal.classList.contains('open')) {
                cal.classList.remove('open');
                return;
            }
            saveBtn.click();
        }
    });

    initDocSort();
    updateView();

    window.MyMaintenanceDocs = {
        getItems: function () { return items.slice(); },
        openPreview: openPreview,
        render: render,
        headerRowHtml: headerRowHtml,
        rowHtml: rowHtml
    };
});
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
    const docTypeDropdown = document.getElementById('doc-type-dropdown');
    const docTypeToggle = document.getElementById('doc-type-toggle');
    const docTypeMenu = document.getElementById('doc-type-menu');
    const docTypeValueEl = document.querySelector('#doc-type-toggle .asset-value');

    if (!addBtn || !popup) return;

    const KEY = 'floorplan_user_docs';
    let selectedAssetValue = '';
    let selectedDocType = '';
    let docSort = 'uploaded';
    let docReverse = false;
    let scanMode = false;
    let currentOcrText = '';
    let currentOcrItems = [];
    let currentOcrExpanded = '';
    let currentOcrEmbedding = null;
    let ocrWorkerPromise = null;
    const EMBED_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
    const SEMANTIC_WEIGHT = 100;
    const SEMANTIC_MIN = 0.3;
    let embedModelPromise = null;
    let semanticModel = null;
    let semanticReady = false;

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
        return String(s || '').toLowerCase().replace(/\s+/g, ' ')
            .replace(/å/g, 'a').replace(/ä/g, 'a')
            .replace(/ø/g, 'o').replace(/ö/g, 'o')
            .replace(/æ/g, 'a');
    }

    function normalizeSizeForSearch(s) {
        return String(s || '').toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');
    }

    function normalizeOcrForSearch(s) {
        return normalizeForSearch(String(s || '')).replace(/[.,]/g, '.');
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
            { key: 'privacy', text: normalizeForSearch(it.privacy), weight: 10 },
            { key: 'docType', text: normalizeForSearch(it.docType), weight: 40 },
            { key: 'ocr', text: normalizeOcrForSearch(it.ocrText), weight: 60, norm: normalizeOcrForSearch },
            { key: 'ocrItems', text: ocrItemsSearchText(it), weight: 70, norm: normalizeOcrForSearch }
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

    function semanticSearch(query, keywordResults) {
        if (!semanticReady) return Promise.resolve(keywordResults);
        const q = String(query || '').trim().toLowerCase();
        if (!q) return Promise.resolve(keywordResults);
        return embedText(q).then(function (qv) {
            const byId = {};
            keywordResults.forEach(function (r) { byId[r.it.id] = r.s; });
            const scored = [];
            const included = {};
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                const v = it.ocrEmbedding;
                if (!v || !v.length) continue;
                const sim = cosineSim(qv, v);
                if (sim < SEMANTIC_MIN) continue;
                const base = byId[it.id] || 0;
                scored.push({ it: it, s: base + sim * SEMANTIC_WEIGHT, sim: sim });
                included[it.id] = true;
            }
            keywordResults.forEach(function (r) {
                if (!included[r.it.id]) scored.push(r);
            });
            scored.sort(function (a, b) {
                if (b.s !== a.s) return b.s - a.s;
                return sortBefore(a.it, b.it) ? -1 : (sortBefore(b.it, a.it) ? 1 : 0);
            });
            return scored;
        });
    }

    function renderSearch() {
        const groupsEl = document.getElementById('doc-groups');
        if (!groupsEl) return;
        const q = searchQuery.trim();
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) { resetSearch(); return; }
        if (docListHead) docListHead.style.display = 'none';
        if (!semanticReady && !embedModelPromise && window.__fpEmbed) {
            getEmbedder().catch(function () {});
        }
        const keywordResults = searchResults(searchQuery);
        const render = function (results) {
            groupsEl.innerHTML = '';
            if (!results.length) {
                groupsEl.innerHTML = '<p class="doc-empty">No documents match &ldquo;' + escapeHtml(q) + '&rdquo;.</p>';
                return;
            }
            const extra = semanticReady ? ' &middot; AI search' : '';
            groupsEl.innerHTML = '<div class="doc-search-header">' + results.length + ' result' + (results.length === 1 ? '' : 's')
                + ' for &ldquo;' + escapeHtml(q) + '&rdquo;' + extra + '</div>';
            for (let i = 0; i < results.length; i++) {
                groupsEl.appendChild(renderRow(results[i].it, terms));
            }
        };
        render(keywordResults);
        if (semanticReady) {
            semanticSearch(searchQuery, keywordResults).then(function (results) {
                if (searchQuery.trim() !== q) return;
                render(results);
            }).catch(function () {});
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

    function resetPopupFields() {
        editingId = null;
        ensureDeleteBtn();
        const d = popup.querySelector('.doc-delete-btn');
        if (d) d.style.display = 'none';
        fileInput.value = '';
        clearFileError();
        if (oldDatePopup) oldDatePopup.style.display = 'none';
        nameInput.value = '';
        clearNameError();
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
        selectedDocType = '';
        if (docTypeValueEl) docTypeValueEl.textContent = '-- Select type --';
        if (docTypeMenu) docTypeMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
        if (docTypeDropdown) docTypeDropdown.classList.remove('open');
        currentOcrText = '';
        currentOcrItems = [];
        currentOcrExpanded = '';
        currentOcrEmbedding = null;
        hideScanStatus();
    }

    function openPopup() {
        resetPopupFields();
        scanMode = false;
        fileInput.accept = '';
        fileInput.removeAttribute('capture');
        setPickLabel('Add document');
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Add document';
        popup.style.display = 'flex';
    }

    function openScanPopup() {
        resetPopupFields();
        scanMode = true;
        fileInput.accept = 'image/*';
        fileInput.setAttribute('capture', 'environment');
        setPickLabel('Scan document');
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Scan document';
        popup.style.display = 'flex';
    }

    function openEditPopup(it) {
        editingId = it.id;
        scanMode = false;
        currentOcrText = '';
        currentOcrItems = [];
        currentOcrExpanded = '';
        currentOcrEmbedding = null;
        fileInput.accept = '';
        fileInput.removeAttribute('capture');
        setPickLabel('Add document');
        hideScanStatus();
        fileInput.value = '';
        clearFileError();
        if (oldDatePopup) oldDatePopup.style.display = 'none';
        nameInput.value = it.name || '';
        clearNameError();
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
        const docTypeVal = it.docType || '';
        selectedDocType = docTypeVal;
        if (docTypeMenu) {
            const typeBtns = Array.prototype.slice.call(docTypeMenu.querySelectorAll('button[data-value]'));
            typeBtns.forEach((b) => b.classList.remove('selected'));
            if (docTypeVal) {
                const typeMatch = typeBtns.find((b) => b.dataset.value === docTypeVal);
                if (typeMatch) typeMatch.classList.add('selected');
                if (docTypeValueEl) docTypeValueEl.textContent = docTypeVal;
            } else {
                if (docTypeValueEl) docTypeValueEl.textContent = '-- Select type --';
            }
        }
        if (docTypeDropdown) docTypeDropdown.classList.remove('open');
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Edit document';
        popup.style.display = 'flex';
    }

    function closePopup() {
        popup.style.display = 'none';
    }

    addBtn.addEventListener('click', openPopup);
    const scanBtn = document.getElementById('doc-scan-btn');
    if (scanBtn) scanBtn.addEventListener('click', openScanPopup);
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
    if (docTypeToggle) {
        docTypeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (docTypeDropdown) docTypeDropdown.classList.toggle('open');
        });
    }
    if (docTypeMenu) {
        docTypeMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-value]');
            if (!btn) return;
            selectedDocType = btn.dataset.value;
            if (docTypeValueEl) docTypeValueEl.textContent = btn.textContent;
            docTypeMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (docTypeDropdown) docTypeDropdown.classList.remove('open');
        });
    }
    document.addEventListener('click', (e) => {
        if (assetDropdown && !assetDropdown.contains(e.target)) {
            assetDropdown.classList.remove('open');
        }
        if (docTypeDropdown && !docTypeDropdown.contains(e.target)) {
            docTypeDropdown.classList.remove('open');
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

    function markNameError() {
        if (!nameInput) return;
        nameInput.classList.remove('shake', 'invalid');
        void nameInput.offsetWidth;
        nameInput.classList.add('shake', 'invalid');
        nameInput.focus();
    }

    function clearNameError() {
        if (nameInput) nameInput.classList.remove('shake', 'invalid');
    }

    function clearFileError() {
        if (pickBtn) pickBtn.classList.remove('shake', 'error');
        if (fileNameLabel) fileNameLabel.classList.remove('error');
    }

    function getScanStatusEl() {
        return document.getElementById('doc-scan-status');
    }

    function showScanStatus(msg, cls) {
        const el = getScanStatusEl();
        if (!el) return;
        el.textContent = msg;
        el.className = 'doc-scan-status ' + (cls || 'scanning');
        el.style.display = '';
    }

    function hideScanStatus() {
        const el = getScanStatusEl();
        if (el) {
            el.style.display = 'none';
            el.className = 'doc-scan-status';
        }
    }

    function setPickLabel(text) {
        const el = document.getElementById('doc-pick-label');
        if (el) el.textContent = text;
    }

    function isImageFile(file) {
        return !!file && (/^image\//i.test(file.type) || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(file.name || ''));
    }

    function getOcrWorker() {
        if (!window.Tesseract) return Promise.reject(new Error('OCR not available'));
        if (ocrWorkerPromise) return ocrWorkerPromise;
        ocrWorkerPromise = window.Tesseract.createWorker('nor+eng', 1, {
            logger: function (m) {
                if (m && m.status === 'recognizing text') {
                    showScanStatus('Scanning document... ' + Math.round(m.progress * 100) + '%');
                }
            }
        });
        return ocrWorkerPromise;
    }

    function preprocessImage(src) {
        return new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () {
                try {
                    const MAX = 2000;
                    const maxDim = Math.max(img.width, img.height);
                    let scale = 2;
                    if (maxDim * scale > MAX) scale = MAX / maxDim;
                    scale = Math.max(scale, 0.5);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imageData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                        const v = g < 128 ? Math.max(0, g - 40) : Math.min(255, g + 40);
                        d[i] = d[i + 1] = d[i + 2] = v;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas);
                } catch (e) { reject(e); }
            };
            img.onerror = function () { reject(new Error('Could not load image')); };
            img.src = src;
        });
    }

    function runScan(file) {
        showScanStatus('Preparing scanner...');
        const reader = new FileReader();
        reader.onload = function () {
            showScanStatus('Preparing image...');
            preprocessImage(reader.result).then(function (processed) {
                return getOcrWorker().then(function (worker) {
                    showScanStatus('Scanning document...');
                    return worker.recognize(processed);
                });
            }).then(function (result) {
                const text = String((result && result.data && result.data.text) || '').trim();
                currentOcrText = text;
                currentOcrItems = extractProductLines(text);
                if (!text) {
                    showScanStatus('Could not read any text. Try a clearer picture, or save the document as-is.', 'error');
                    return;
                }
                applyOcrResult(text);
                showScanStatus('Content recognized and searchable. You can adjust the name and date before saving.', 'ok');
                enrichProductText(currentOcrItems).then(function (expanded) {
                    currentOcrExpanded = expanded;
                    return embedProducts(expanded);
                }).then(function (vec) {
                    currentOcrEmbedding = vec;
                }).catch(function () {});
            }).catch(function () {
                showScanStatus('Scanning failed. You can still save the document, but its content will not be searchable.', 'error');
            });
        };
        reader.onerror = function () {
            showScanStatus('Could not read the file.', 'error');
        };
        reader.readAsDataURL(file);
    }

    const STORE_PATTERNS = [
        [/lampe[\s\-]?magasin(?:et)?/i, 'Lampemagasinet'],
        [/jern[1il]?a/i, 'Jernia'],
        [/byggmak(?:k)?er/i, 'Byggmakker'],
        [/byggmax/i, 'Byggmax'],
        [/gausdal/i, 'Gausdal'],
        [/optimera/i, 'Optimera'],
        [/hellesens?/i, 'Hellesen'],
        [/fl[üu]gger/i, 'Flügger'],
        [/tretorget/i, 'Tretorget'],
        [/hagemagasinet/i, 'Hagemagasinet'],
        [/megaflis/i, 'Megaflis'],
        [/jula/i, 'Jula'],
        [/maxbo/i, 'Maxbo'],
        [/xl[ -]?bygg/i, 'XL Bygg'],
        [/mont[e\u00e9]r/i, 'Mont\u00e9r'],
        [/bauhaus/i, 'Bauhaus'],
        [/biltema/i, 'Biltema'],
        [/plantasjen/i, 'Plantasjen'],
        [/clas ohlson/i, 'Clas Ohlson'],
        [/europris/i, 'Europris'],
        [/fargerike/i, 'Fargerike'],
        [/elkj[\u00f8o]p/i, 'Elkj\u00f8p'],
        [/mekonomen/i, 'Mekonomen'],
        [/thansen/i, 'Thansen'],
        [/jysk/i, 'Jysk'],
        [/ikea/i, 'IKEA'],
        [/granng[\u00e5a]rden/i, 'Granng\u00e5rden'],
        [/coop[ -]?obs|obs[ -]?hyper/i, 'OBS'],
        [/obs[ -]?mega/i, 'OBS'],
        [/kiwi/i, 'Kiwi'],
        [/rema[ -]?1000/i, 'Rema 1000'],
        [/bunnpris/i, 'Bunnpris'],
        [/extra/i, 'Extra'],
        [/meny/i, 'Meny'],
        [/spar/i, 'Spar'],
        [/matkroken/i, 'Matkroken'],
        [/joker/i, 'Joker'],
        [/lidl/i, 'Lidl'],
        [/coop/i, 'Coop'],
        [/rusta/i, 'Rusta'],
        [/normal/i, 'Normal'],
        [/tiger/i, 'Tiger'],
        [/s[\u00f8o]strene grene|sostrene grene/i, 'S\u00f8strene Grene'],
        [/nille/i, 'Nille'],
        [/cubus/i, 'Cubus'],
        [/kappahl/i, 'KappAhl'],
        [/xxl/i, 'XXL'],
        [/sport ?1/i, 'Sport 1'],
        [/g[ -]?sport/i, 'G-Sport'],
        [/intersport/i, 'Intersport'],
        [/sportsmann/i, 'Sportsmann'],
        [/fjellsport/i, 'Fjellsport'],
        [/power/i, 'Power'],
        [/komplett/i, 'Komplett'],
        [/netonnet/i, 'NetOnNet'],
        [/gigaboks/i, 'Gigaboks'],
        [/epleh(?:uset|uset)/i, 'Eplehuset'],
        [/humac/i, 'Humac'],
        [/apotek ?1/i, 'Apotek 1'],
        [/vitusapotek/i, 'Vitusapotek'],
        [/boots/i, 'Boots'],
        [/apotek/i, 'Apotek'],
        [/vinmonopolet/i, 'Vinmonopolet'],
        [/systembolaget/i, 'Systembolaget'],
        [/brilleland/i, 'Brilleland'],
        [/synsam/i, 'Synsam'],
        [/specsavers/i, 'Specsavers']

    ];

    function detectStore(text) {
        const t = String(text || '');
        // OBS Bygg: the logo has an exclamation mark inside the "O", so OCR often
        // mangles it (e.g. "ÖBS", "ØBS", "O!BS", "0BS"), or reads only "BYGG"
        // alongside the parent Coop brand. Catch all of those variants first.
        if (/[o\u00f8\u00f6\u00f3\u00f2\u00f4\u00f5\u00d8\u00d6\u00d3\u00d2\u00d4\u00d50][!|]?bs[ !.\-]?bygg/i.test(t)) return 'OBS Bygg';
        if (/coop/i.test(t) && /bygg/i.test(t)) return 'OBS Bygg';
        if (/[o\u00f8\u00f6\u00f3\u00f2\u00f4\u00f5\u00d8\u00d6\u00d3\u00d2\u00d4\u00d50][!|]?bs(?![a-z\u00e6\u00f8\u00e5])/i.test(t)) return 'OBS Bygg';
        // Lampemagasinet: the logo is often mangled by OCR into fragments
        // (e.g. "npelagasinet", "smagasinet", "emagasinet", "lamp"), so match on
        // co-occurrence of a lamp fragment and a magasin fragment anywhere.
        if (/lamp/i.test(t) && /magasin/i.test(t)) return 'Lampemagasinet';
        for (let i = 0; i < STORE_PATTERNS.length; i++) {
            if (STORE_PATTERNS[i][0].test(t)) return STORE_PATTERNS[i][1];
        }
        return '';
    }

    const DOC_TYPE_PATTERNS = [
        [/\b(receipt|re\u00e7u|recu|kassasjekk|kvitto|quittung|kassenbon|recibo|ricevuta|kassabon)\b|(?:salgs?|kassa|kj\u00f8ps|kj\u00f8pe)?kvit{1,2}ering\b/i, 'Receipt'],
        [/\b(warranty|guarantee|garantie|garanzia|garant\u00eda|garantia)\b|garanti(?:bevis|periode|sak|e|en|er)?\b/i, 'Warranty']
    ];

    function detectDocType(text) {
        const t = String(text || '');
        for (let i = 0; i < DOC_TYPE_PATTERNS.length; i++) {
            if (DOC_TYPE_PATTERNS[i][0].test(t)) return DOC_TYPE_PATTERNS[i][1];
        }
        return '';
    }

    function setDocType(value) {
        if (!value) return;
        selectedDocType = value;
        if (docTypeMenu) {
            docTypeMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
            const match = docTypeMenu.querySelector('button[data-value="' + value + '"]');
            if (match) match.classList.add('selected');
        }
        if (docTypeValueEl) docTypeValueEl.textContent = value;
        if (docTypeDropdown) docTypeDropdown.classList.remove('open');
    }

    function detectSpelledDate(text) {
        const t = String(text || '');
        const MONTHS = {
            januar: 1, january: 1, jan: 1,
            februar: 2, february: 2, feb: 2,
            mars: 3, march: 3, mar: 3,
            april: 4, apr: 4,
            mai: 5, may: 5,
            juni: 6, june: 6,
            juli: 7, july: 7,
            august: 8, aug: 8,
            september: 9, sept: 9, sep: 9,
            oktober: 10, october: 10, oct: 10,
            november: 11, nov: 11,
            desember: 12, december: 12, dec: 12
        };
        const months = Object.keys(MONTHS);
        const re = new RegExp('(^|[^\\d])' + '(\\d{1,2})\\.?\\s*(' + months.join('|') + ')\\s+((?:19|20)\\d{2})' + '([^\\d]|$)', 'gi');
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(t)) !== null) {
            const day = +m[2];
            const month = MONTHS[String(m[3]).toLowerCase()];
            const year = +m[4];
            if (month && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
                const dt = new Date(year, month - 1, day);
                if (dt.getMonth() === month - 1 && dt.getDate() === day) {
                    return { day: day, month: month, year: year };
                }
            }
        }
        return null;
    }

    function detectDate(text) {
        const t = String(text || '');
        const sep = '[.\\/-]';
        const dmy4 = new RegExp('(^|[^\\d])' + '(\\d{1,2})' + sep + '(\\d{1,2})' + sep + '((?:19|20)\\d{2})' + '([^\\d]|$)', 'g');
        const ymd = new RegExp('(^|[^\\d])' + '((?:19|20)\\d{2})' + sep + '(\\d{1,2})' + sep + '(\\d{1,2})' + '([^\\d]|$)', 'g');
        const dmy2 = new RegExp('(^|[^\\d])' + '(\\d{2})' + sep + '(\\d{2})' + sep + '(\\d{2})' + '([^\\d]|$)', 'g');
        const run = function (re, order) {
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(t)) !== null) {
                let day, month, year;
                if (order === 'ymd') { year = +m[2]; month = +m[3]; day = +m[4]; }
                else { day = +m[2]; month = +m[3]; year = +m[4]; }
                if (year < 100) year = year >= 90 ? 1900 + year : 2000 + year;
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
                    const dt = new Date(year, month - 1, day);
                    if (dt.getMonth() === month - 1 && dt.getDate() === day) {
                        return { day: day, month: month, year: year };
                    }
                }
            }
            return null;
        };
        return run(dmy4, 'dmy') || detectSpelledDate(t) || run(ymd, 'ymd') || run(dmy2, 'dmy');
    }

    function applyOcrResult(text) {
        const store = detectStore(text);
        const date = detectDate(text);
        const docType = detectDocType(text);
        if (!nameInput.value.trim()) {
            const parts = [];
            if (store) parts.push(store);
            if (date) parts.push(pad2(date.day) + '.' + pad2(date.month) + '.' + date.year);
            if (parts.length) nameInput.value = parts.join(' ');
        }
        if (nameInput.value.trim()) clearNameError();
        if (date && !performedInput.value.trim()) {
            performedInput.value = pad2(date.day) + '/' + pad2(date.month) + '/' + date.year;
            performedInput.classList.remove('invalid');
        }
        if (!selectedDocType && docType) setDocType(docType);
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    const PRODUCT_CATEGORIES = [
        { key: 'avløp', terms: ['avløp', 'drainage', 'vannlås', 'vannlaas', 'sluk', 'slukrist', 'drenering', 'kloakk', 'drain', 'kum', 'stakestål', 'avløpsrør', 'pumpekum'] },
        { key: 'vann', terms: ['vann', 'kran', 'armatur', 'slange', 'pumpe', 'vanntank', 'kobling', 'water', 'faucet', 'hose', 'pump', 'rør'] },
        { key: 'elektrisk', terms: ['elektrisk', 'ledning', 'kabel', 'sikring', 'bryter', 'stikkontakt', 'støpsel', 'lampe', 'pære', 'electric', 'wiring', 'socket', 'switch', 'cable', 'bulb', 'spenning'] },
        { key: 'maling', terms: ['maling', 'lakk', 'grunning', 'sparkel', 'paint', 'primer', 'lacquer', 'beis', 'fortynner'] },
        { key: 'verktøy', terms: ['verktøy', 'drill', 'skrutrekker', 'hammer', 'sag', 'tang', 'tool', 'screwdriver', 'saw', 'plier', 'vinkelsliper', 'stikksag', 'bormaskin', 'skrumaskin'] },
        { key: 'trevirke', terms: ['trevirke', 'plank', 'lekte', 'furu', 'gran', 'sponplate', 'kryssfiner', 'k-virke', 'konstruksjonsvirke', 'virke', 'tømmer', 'stender', 'bjelke', 'wood', 'lumber', 'plywood', 'stud', 'timber', 'møbelfront'] },
        { key: 'feste', terms: ['skrue', 'spiker', 'bolt', 'mutter', 'dyvel', 'anker', 'brakett', 'screw', 'nail', 'nut', 'dowel', 'anchor', 'feste', 'kile'] },
        { key: 'hage', terms: ['hage', 'plante', 'gjødsel', 'jord', 'gress', 'garden', 'plant', 'fertilizer', 'soil', 'lawn', 'blomst', 'frø'] },
        { key: 'buntebånd', terms: ['buntebånd', 'bunteband', 'strips', 'kabelbinder', 'kabelstrips', 'tilbinder', 'buntningsklamme', 'cable tie', 'tie wrap', 'zip tie', 'bånd'] },
        { key: 'grill', terms: ['grill', 'barbecue', 'bbq', 'weber', 'gass', 'gas', 'regulator', 'propangass', 'grillrist', 'kull', 'charcoal', 'grillkull', 'sausage', 'pølse', 'grillmat'] },
        { key: 'rengjøring', terms: ['rengjøring', 'vaskemiddel', 'såpe', 'klor', 'børste', 'svamp', 'cleaning', 'detergent', 'soap', 'brush', 'sponge', 'mopp', 'oppvaskmiddel'] },
        { key: 'bil', terms: ['bil', 'auto', 'olje', 'vindusvisker', 'dekkskift', 'car', 'auto', 'oil', 'wiper', 'tire', 'batteri', 'dekkskift'] },
        { key: 'dør', terms: ['dør', 'håndtak', 'vrider', 'lås', 'hengsel', 'terskel', 'door', 'handle', 'lock', 'hinge', 'karm'] },
        { key: 'mat', terms: ['mat', 'melk', 'brød', 'ost', 'kjøtt', 'fisk', 'grønnsaker', 'frukt', 'kaffe', 'pålegg', 'middag', 'frokost', 'lunsj', 'matvarer', 'food', 'milk', 'bread', 'cheese', 'meat', 'fish', 'vegetable', 'fruit', 'coffee', 'egg'] },
        { key: 'drikke', terms: ['drikke', 'brus', 'juice', 'saft', 'vannflaske', 'drink', 'beverage', 'cola', 'øl', 'vin', 'cider', 'smoothie'] },
        { key: 'bygg', terms: ['betong', 'murstein', 'sement', 'puss', 'gips', 'mørtel', 'leca', 'concrete', 'brick', 'cement', 'plaster', 'mortar', 'mur'] },
        { key: 'tak', terms: ['takstein', 'takpapp', 'takplater', 'møne', 'takrenne', 'nedløp', 'tak', 'roofing', 'gutter', 'shingles'] },
        { key: 'isolasjon', terms: ['isolasjon', 'glava', 'mineralull', 'isopor', 'isoler', 'insulation', 'fiber'] },
        { key: 'gulv', terms: ['gulv', 'parkett', 'laminat', 'vinyl', 'flis', 'belegg', 'floor', 'flooring', 'laminate', 'vinyl', 'tile', 'laminatgulv'] },
        { key: 'terrasse', terms: ['terrasse', 'terrassebord', 'impregnert', 'utedekke', 'deck', 'terrace', 'platting'] },
        { key: 'beslag', terms: ['beslag', 'vinkel', 'jern', 'metall', 'bracket', 'mounting', 'profil'] },
        { key: 'klær', terms: ['klær', 'bukse', 'skjorte', 'jakke', 'genser', 'sko', 'støvler', 'sokker', 't-skjorte', 'tights', 'clothing', 'clothes', 'shirt', 'pants', 'jacket', 'shoes', 'boots', 'dress', 'sko'] },
        { key: 'sport', terms: ['sport', 'fotball', 'sykkel', 'ski', 'stav', 'sportsutstyr', 'hjelm', 'sport', 'bicycle', 'bike', 'helmet', 'racket'] },
        { key: 'medisin', terms: ['paracet', 'ibuprofen', 'plaster', 'vitamin', 'medisin', 'bandasje', 'salve', 'medicine', 'vitamin', 'bandage', 'smertestillende'] },
        { key: 'dyr', terms: ['hundefor', 'kattefor', 'dyrefôr', 'kattesand', 'dyrefor', 'pet', 'dog food', 'cat food', 'godbit'] },
        { key: 'møbler', terms: ['møbler', 'stol', 'seng', 'sofa', 'skap', 'hylle', 'møbel', 'furniture', 'chair', 'table', 'bed', 'sofa', 'cabinet', 'shelf'] },
        { key: 'smøremiddel', terms: ['smøremiddel', 'smørefett', 'wd40', 'rustløser', 'lubricant', 'smøring', 'spray'] }
    ];

    function isReceiptNoiseLine(line) {
        const t = String(line || '').toLowerCase();
        if (/^(sum|total|totalt|beløp|belop|mva|med vennlig hilsen|vennligst|takk|kvittering|receipt|sale|return|refund|refusjon|betaling|betalt|kontant|kort|cash|card|saldo|avgift|org\.?nr|organisasjonsnr|forfallsdato|bankkort|viser|visa|mastercard|dankort|jeg godtar|vil du handle|operatør|operator|ordre|order|bong|ticket|butikk|store|kjede)\b/.test(t)) return true;
        if (/^(www\.|https?:|e-?post|tlf\.?|telefon|@)/.test(t)) return true;
        if (/\b(orgnr|mva\b|totalt|sum\b|saldo\b|change\b|tilbake|betalt\b|kontant\b|dankort\b|visa\b|mastercard\b|refusjon|refund|swish|vipps)\b/.test(t)) return true;
        if (/^[^a-z\u00e6\u00f8\u00e5]*\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}/i.test(t)) return true;
        return false;
    }

    function extractProductLines(text) {
        const lines = String(text || '').split(/\r?\n/);
        const out = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].replace(/\s+/g, ' ').trim();
            if (!line) continue;
            if (!/[a-z\u00e6\u00f8\u00e5]/i.test(line)) continue;
            if (isReceiptNoiseLine(line)) continue;
            const cleaned = line.replace(/\s*(kr\.?)?\s*\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?\s*$/i, '').trim();
            if (cleaned.length >= 2) out.push(cleaned);
        }
        return out;
    }

    function termInText(norm, term) {
        const idx = norm.indexOf(term);
        if (idx === -1) return false;
        if (term.length <= 3) {
            const before = idx > 0 ? norm[idx - 1] : '';
            const after = norm[idx + term.length] || '';
            if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) return false;
        }
        return true;
    }

    function productCategoryText(line) {
        const norm = normalizeForSearch(line);
        const out = [];
        for (let i = 0; i < PRODUCT_CATEGORIES.length; i++) {
            const cat = PRODUCT_CATEGORIES[i];
            for (let j = 0; j < cat.terms.length; j++) {
                if (termInText(norm, normalizeForSearch(cat.terms[j]))) {
                    out.push(cat.terms.join(' '));
                    break;
                }
            }
        }
        return out.join(' ');
    }

    let categoryProtosPromise = null;
    let categoryProtos = null;
    const CAT_INFER_MIN = 0.34;

    function getCategoryProtos() {
        if (categoryProtos) return Promise.resolve(categoryProtos);
        if (categoryProtosPromise) return categoryProtosPromise;
        categoryProtosPromise = Promise.all(PRODUCT_CATEGORIES.map(function (cat) {
            return embedText(cat.terms.join(' ')).then(function (v) {
                return { key: cat.key, terms: cat.terms, vec: v };
            });
        })).then(function (protos) {
            categoryProtos = protos;
            return protos;
        }).catch(function (err) {
            categoryProtosPromise = null;
            throw err;
        });
        return categoryProtosPromise;
    }

    function inferCategorySynonyms(line) {
        if (!semanticReady) return Promise.resolve('');
        return getCategoryProtos().then(function (protos) {
            return embedText(line).then(function (pv) {
                let best = null;
                let bestSim = 0;
                for (let i = 0; i < protos.length; i++) {
                    const sim = cosineSim(pv, protos[i].vec);
                    if (sim > bestSim) { bestSim = sim; best = protos[i]; }
                }
                if (best && bestSim >= CAT_INFER_MIN) return best.key + ' ' + best.terms.join(' ');
                return '';
            });
        }).catch(function () { return ''; });
    }

    function enrichProductText(items) {
        const results = [];
        const jobs = [];
        for (let i = 0; i < items.length; i++) {
            (function (idx, item) {
                const literal = productCategoryText(item);
                if (literal) {
                    results[idx] = item + ' ' + literal;
                } else {
                    jobs.push(inferCategorySynonyms(item).then(function (syns) {
                        results[idx] = item + (syns ? ' ' + syns : '');
                    }).catch(function () {
                        results[idx] = item;
                    }));
                }
            })(i, items[i]);
        }
        return Promise.all(jobs).then(function () { return results.join(' '); });
    }

    function getOcrItems(it) {
        if (it && Array.isArray(it.ocrItems) && it.ocrItems.length) return it.ocrItems;
        if (it && it.ocrText) return extractProductLines(it.ocrText);
        return [];
    }

    function expandedItemsText(items) {
        const parts = [];
        for (let i = 0; i < items.length; i++) {
            const cats = productCategoryText(items[i]);
            parts.push(items[i] + (cats ? ' ' + cats : ''));
        }
        return parts.join(' ');
    }

    function ocrItemsSearchText(it) {
        if (it && it.ocrExpanded) return normalizeForSearch(it.ocrExpanded);
        return normalizeForSearch(expandedItemsText(getOcrItems(it)));
    }

    function getEmbedder() {
        if (semanticModel) return Promise.resolve(semanticModel);
        if (embedModelPromise) return embedModelPromise;
        const lib = window.__fpEmbed;
        if (!lib || typeof lib.pipeline !== 'function') {
            return Promise.reject(new Error('Embedding model not available'));
        }
        embedModelPromise = lib.pipeline('feature-extraction', EMBED_MODEL).then(function (p) {
            semanticModel = p;
            semanticReady = true;
            backfillEmbeddings();
            if (searchQuery && searchQuery.trim()) renderSearch();
            return p;
        }).catch(function (err) {
            embedModelPromise = null;
            throw err;
        });
        return embedModelPromise;
    }

    function embedText(text) {
        return getEmbedder().then(function (p) {
            return p(String(text || ''), { pooling: 'mean', normalize: true });
        }).then(function (out) {
            const data = Array.isArray(out.data) ? out.data : Array.from(out.data || []);
            return data.map(function (v) { return Math.round(v * 1e6) / 1e6; });
        });
    }

    function cosineSim(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += a[i] * b[i];
        return s;
    }

    function embedProducts(text) {
        if (!text) return Promise.resolve(null);
        return embedText(text).catch(function () { return null; });
    }

    function backfillEmbeddings() {
        if (!semanticReady) return;
        const jobs = [];
        items.forEach(function (it) {
            if (it.ocrEmbedding && it.ocrEmbedding.length) return;
            const raw = getOcrItems(it);
            if (!raw.length) return;
            if (it.ocrExpanded) {
                jobs.push(embedText(it.ocrExpanded).then(function (vec) {
                    it.ocrEmbedding = vec;
                }).catch(function () {}));
                return;
            }
            jobs.push(enrichProductText(raw).then(function (expanded) {
                it.ocrExpanded = expanded;
                return embedText(expanded);
            }).then(function (vec) {
                it.ocrEmbedding = vec;
            }).catch(function () {}));
        });
        if (jobs.length) {
            Promise.all(jobs).then(function () {
                store();
                if (searchQuery && searchQuery.trim()) renderSearch();
            });
        }
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
        if (!scanMode && !nameInput.value.trim()) {
            const base = file.name.replace(/\.[^.]+$/, '');
            nameInput.value = base;
        }
        if (scanMode) {
            if (isImageFile(file)) {
                runScan(file);
            } else {
                showScanStatus('This file type cannot be scanned. It will be saved without scanned content.', 'error');
            }
        }
    });

    nameInput.addEventListener('input', () => {
        if (nameInput.value.trim()) clearNameError();
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
            markNameError();
            return;
        }
        const asset = selectedAssetValue === '__other__'
                ? (docAssetOther ? docAssetOther.value.trim() : '')
                : selectedAssetValue;
        const performedDt = parseDateStr(performedInput.value);
        const privacy = privacyValue();
        const apply = (dataUrl) => {
            let rec = null;
            const docTypeVal = selectedDocType;
            if (editingId) {
                rec = items.find((i) => i.id === editingId);
                if (rec) {
                    rec.name = name;
                    rec.asset = asset;
                    rec.privacy = privacy;
                    rec.docType = docTypeVal;
                    rec.performed = performedDt ? toISO(performedDt) : '';
                    if (dataUrl) {
                        rec.type = file.type;
                        rec.fileName = file.name;
                        rec.size = file.size;
                        rec.sizeLabel = formatSize(file.size);
                        rec.uploaded = toISO(new Date());
                        rec.created = Date.now();
                        rec.ocrText = currentOcrText || '';
                        rec.ocrItems = currentOcrItems;
                        rec.ocrExpanded = currentOcrExpanded;
                        rec.ocrEmbedding = currentOcrEmbedding;
                    }
                }
            } else {
                rec = {
                    id: 'd_' + Date.now(),
                    name: name,
                    asset: asset,
                    privacy: privacy,
                    docType: docTypeVal,
                    performed: performedDt ? toISO(performedDt) : '',
                    uploaded: toISO(new Date()),
                    created: Date.now(),
                    size: file.size,
                    sizeLabel: formatSize(file.size),
                    type: file.type,
                    fileName: file.name,
                    ocrText: currentOcrText || '',
                    ocrItems: currentOcrItems,
                    ocrExpanded: currentOcrExpanded,
                    ocrEmbedding: currentOcrEmbedding
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
            markNameError();
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
            doc: ['DOC', 'file-doc'], docx: ['DOC', 'file-docx'], odt: ['DOC', 'file-doc'],
            xls: ['XLS', 'file-xls'], xlsx: ['XLS', 'file-xls'], csv: ['CSV', 'file-csv'],
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
            + '<span class="doc-cell doc-cell-type">' + escapeHtml(it.docType || info.label) + '</span>'
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
        if (window.MyOfficeViewer) window.MyOfficeViewer.close();
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
        } else if ((info.cls === 'file-xls' || info.cls === 'file-csv' || info.cls === 'file-docx') && data) {
            body.innerHTML = '';
            if (window.MyOfficeViewer) {
                window.MyOfficeViewer.open(data, it.fileName || (it.name + '.' + info.ext), body, info.ext);
            } else {
                body.innerHTML = '<div class="preview-note">Document viewer not available. Use Open or Download below.</div>';
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
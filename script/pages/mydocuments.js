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
    const receiptTotalInput = document.getElementById('doc-receipt-total');
    const formatInput = document.getElementById('doc-format');
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
    const docTypeDropdown = document.getElementById('doc-type-dropdown');
    const docTypeToggle = document.getElementById('doc-type-toggle');
    const docTypeMenu = document.getElementById('doc-type-menu');
    const docTypeValueEl = document.querySelector('#doc-type-toggle .asset-value');
    const projectDropdown = document.getElementById('doc-project-dropdown');
    const projectToggle = document.getElementById('doc-project-toggle');
    const projectMenu = document.getElementById('doc-project-menu');
    const projectValueEl = document.querySelector('#doc-project-toggle .asset-value');
    const projectOther = document.getElementById('doc-project-other');

    if (!addBtn || !popup) return;

    const KEY = 'floorplan_user_docs';
    let selectedAssetValue = '';
    let selectedAssetId = '';
    let selectedAssetKind = '';
    let selectedDocType = '';
    let selectedProject = '';
    let lockedAsset = '';
    let docSort = 'uploaded';
    let docReverse = false;
    let scanMode = false;
    let currentOcrText = '';
    let currentOcrItems = [];
    let currentOcrExpanded = '';
    let currentOcrEmbedding = null;
    let currentReceiptItems = [];
    const viewerLoadPromises = {};
    let selectedFile = null;
    let initialDocState = '';
    let ocrWorkerPromise = null;
    let tesseractLoadPromise = null;
    let embedLibraryPromise = null;
    const EMBED_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
    const SEMANTIC_WEIGHT = 100;
    const SEMANTIC_MIN = 0.3;
    let embedModelPromise = null;
    let semanticModel = null;
    let semanticReady = false;

    function seedDocs() {
        return [];
    }

    function load() {
        return seedDocs();
    }

    let items = load().map(function (it) {
        if (!it.privacy) it.privacy = 'private';
        return it;
    });

    // If we were sent here from a neighborhood ("Show all documents"), render
    // that neighborhood's docs with a dedicated header instead of the main list.
    const docContext = window.MyMaintenanceDocumentContext || null;
    window.MyMaintenanceDocumentContext = null;
    let neighborhoodOnly = false;
    if (docContext && Array.isArray(docContext.neighborhoodDocs)) {
        neighborhoodOnly = true;
        items = docContext.neighborhoodDocs.map(function (d) {
            const id = d.id || d.filePath || ('nb_' + (d.name || 'doc'));
            return {
                id: id,
                name: d.name || d.fileName || 'Document',
                docType: d.docType || '',
                performed: d.performed || '',
                uploaded: String(d.uploaded || '').slice(0, 10),
                filePath: d.filePath || '',
                size: d.size,
                asset: d.asset || docContext.asset || 'Neighborhood',
                privacy: d.privacy || 'private',
                type: d.type || ''
            };
        });
        const ctxHead = document.getElementById('doc-context-header');
        const ctxTitle = document.getElementById('doc-context-title');
        const mainH1 = document.querySelector('main.main h1');
        if (ctxHead) ctxHead.style.display = '';
        if (ctxTitle) ctxTitle.textContent = (docContext.asset || 'Neighborhood') + ' · Documents';
        if (mainH1) mainH1.style.display = 'none';
        ['doc-add-btn', 'doc-scan-btn', 'doc-search'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function store() {
        items.forEach(persistDocument);
        window.dispatchEvent(new CustomEvent('mydocs:changed'));
    }

    function documentRow(item) {
        const extra = Object.assign({}, item);
        delete extra.id;
        delete extra.name;
        delete extra.performed;
        delete extra.filePath;
        delete extra.data;
        delete extra.payloadInDB;
        delete extra.homeId;
        delete extra.vehicleId;
        return {
            id: item.id,
            title: item.name,
            document_type: item.docType || null,
            document_date: item.performed || null,
            file_path: item.filePath || null,
            home_id: item.homeId || null,
            vehicle_id: item.vehicleId || null,
            extracted_data: extra
        };
    }

    function persistDocument(item) {
        const db = window.MyMaintenanceData;
        if (!db || !item?.id) return;
        db.request('documents', {
            method: 'POST',
            query: { on_conflict: 'id' },
            body: documentRow(item),
            prefer: 'resolution=merge-duplicates,return=representation'
        }).catch(function (error) { console.error('Could not save document:', error); });
    }

    function documentFromRow(row) {
        const extra = row.extracted_data || {};
        return Object.assign({}, extra, {
            id: row.id,
            name: row.title,
            docType: row.document_type || extra.docType || '',
            project: extra.project || '',
            performed: row.document_date || '',
            filePath: row.file_path || '',
            homeId: row.home_id || '',
            vehicleId: row.vehicle_id || '',
            uploaded: String(extra.uploaded || row.created_at || '').slice(0, 10),
            created: extra.created || new Date(row.created_at || Date.now()).getTime()
        });
    }

    async function hydrateDocuments() {
        const db = window.MyMaintenanceData;
        if (!db) return;
        try {
            const rows = await db.request('documents', { query: { select: '*', order: 'created_at.desc' } });
            items = (rows || []).map(documentFromRow);
            updateView();
        } catch (error) {
            console.error('Could not load documents:', error);
        }
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
        if (it.filePath && window.MyMaintenanceData) {
            return window.MyMaintenanceData.downloadDataUrl(it.filePath, it.type).catch(function () { return ''; });
        }
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
            { key: 'ocrItems', text: ocrItemsSearchText(it), weight: 70, norm: normalizeOcrForSearch },
            { key: 'receiptItems', text: receiptItemsSearchText(it.receiptItems), weight: 80, norm: normalizeOcrForSearch }
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
        if (!semanticReady && !embedModelPromise) {
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
    let saveInProgress = false;

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

    async function doDelete() {
        if (!editingId) return;
        const deleted = items.find(function (item) { return item.id === editingId; });
        try {
            if (window.MyMaintenanceData && deleted) {
                if (deleted.filePath) await window.MyMaintenanceData.removeFile(deleted.filePath);
                await window.MyMaintenanceData.request('documents', { method: 'DELETE', query: { id: `eq.${editingId}` } });
            }
        } catch (error) {
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not delete document.');
            return;
        }
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
        delete nameInput.dataset.userEdited;
        clearNameError();
        performedInput.value = '';
        performedInput.classList.remove('invalid');
        uploadedInput.value = toInputDate(new Date());
        sizeInput.value = '';
        if (receiptTotalInput) receiptTotalInput.value = '';
        if (formatInput) formatInput.value = '';
        if (fileNameLabel) fileNameLabel.textContent = 'No file selected';
        selectedAssetValue = '';
        selectedAssetId = ''; selectedAssetKind = '';
        lockedAsset = '';
        const assetLabelEl = document.getElementById('doc-asset-label');
        if (assetLabelEl) assetLabelEl.textContent = 'Connected Asset';
        if (assetValueEl) assetValueEl.textContent = '-- Select an asset --';
        if (assetDropdown) {
            assetDropdown.classList.remove('open');
            assetDropdown.style.display = '';
            const t = assetDropdown.querySelector('.asset-toggle');
            if (t) t.disabled = false;
        }
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
        selectedProject = '';
        if (projectValueEl) projectValueEl.textContent = 'Other';
        if (projectMenu) {
            projectMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
            const otherBtn = projectMenu.querySelector('button[data-value="__other__"]');
            if (otherBtn) otherBtn.classList.add('selected');
        }
        if (projectOther) { projectOther.value = ''; projectOther.style.display = 'none'; }
        if (projectDropdown) projectDropdown.classList.remove('open');
        currentOcrText = '';
        currentOcrItems = [];
        currentOcrExpanded = '';
        currentOcrEmbedding = null;
        currentReceiptItems = [];
        selectedFile = null;
        hideScanStatus();
    }

    function selectAsset(value) {
        const asset = String(value || '').trim();
        if (!asset || !assetMenu) return;
        const buttons = Array.prototype.slice.call(assetMenu.querySelectorAll('button[data-value]'));
        const match = buttons.find(function (button) { return button.dataset.value === asset; });
        selectedAssetValue = match ? asset : '__other__';
        if (assetValueEl) assetValueEl.textContent = asset;
        buttons.forEach(function (button) { button.classList.remove('selected'); });
        const selectedButton = match || buttons.find(function (button) { return button.dataset.value === '__other__'; });
        if (selectedButton) selectedButton.classList.add('selected');
        if (docAssetOther) {
            docAssetOther.style.display = match ? 'none' : '';
            docAssetOther.value = match ? '' : asset;
        }
        populateProjectMenu(asset);
    }

    // Projects are stored per asset so they reappear for that asset later.
    const PROJECTS_KEY = 'mymaintenance_doc_projects';
    function loadProjects() {
        try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || {}; } catch (_) { return {}; }
    }
    function saveProjects(map) {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(map));
    }
    function projectsForAsset(asset) {
        const map = loadProjects();
        return (map[asset] || []).slice();
    }
    function addProjectForAsset(asset, name) {
        if (!asset || !name) return;
        const map = loadProjects();
        const list = map[asset] || [];
        if (list.indexOf(name) === -1) list.unshift(name);
        map[asset] = list;
        saveProjects(map);
        if (window.MyMaintenanceProjects) window.MyMaintenanceProjects.add(asset, name);
    }

    function populateProjectMenu(asset) {
        if (!projectMenu) return;
        const projects = projectsForAsset(asset || selectedAssetValue);
        // Projects first; "Other" sits at the bottom behind a divider, like the
        // split between Addresses and Vehicles in the asset dropdown.
        let html = projects.map(function (name) {
            return '<li><button type="button" data-value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button></li>';
        }).join('');
        html += '<li class="asset-optgroup"></li>';
        html += '<li><button type="button" data-value="__other__">Other</button></li>';
        projectMenu.innerHTML = html;
    }

    function openPopup() {
        resetPopupFields();
        const context = window.MyMaintenanceDocumentContext;
        window.MyMaintenanceDocumentContext = null;
        if (context && context.asset) selectAsset(context.asset);
        if (context && context.project) {
            selectedProject = context.project;
            if (projectValueEl) projectValueEl.textContent = context.project;
            if (projectMenu) {
                projectMenu.querySelectorAll('button').forEach(function (b) {
                    b.classList.toggle('selected', b.dataset.value === context.project);
                });
            }
        }
        scanMode = false;
        fileInput.accept = '';
        fileInput.removeAttribute('capture');
        setPickLabel('Add document');
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Add document';
        popup.style.display = 'flex';
        initialDocState = documentStateSnapshot();
    }

    function openScanPopup() {
        resetPopupFields();
        scanMode = true;
        fileInput.accept = 'image/*,application/pdf';
        fileInput.removeAttribute('capture');
        setPickLabel('Scan document');
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Scan document';
        popup.style.display = 'flex';
        initialDocState = documentStateSnapshot();
    }

    function openEditPopup(it) {
        editingId = it.id;
        selectedFile = null;
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
        if (receiptTotalInput) receiptTotalInput.value = it.receiptTotal != null ? String(it.receiptTotal).replace('.', ',') : receiptItemsTotal(it.receiptItems);
        if (formatInput) formatInput.value = fileTypeInfo(it).label;
        if (fileNameLabel) fileNameLabel.textContent = it.fileName || 'No file selected';
        if (assetMenu) {
            const known = Array.prototype.slice.call(assetMenu.querySelectorAll('button[data-value]'));
            known.forEach((b) => b.classList.remove('selected'));
            const a = it.asset ? String(it.asset).trim() : '';
            lockedAsset = /^Neighborhood:/i.test(a) ? a : '';
            if (lockedAsset) {
                // Neighborhood documents are fixed to their neighborhood; hide
                // the asset picker and show the locked value instead.
                const neighborhoodLabel = document.getElementById('doc-asset-label');
                if (neighborhoodLabel) neighborhoodLabel.textContent = 'Connected neighborhood:';
                selectedAssetValue = a;
                const displayName = a.replace(/^Neighborhood:\s*/i, '');
                if (assetValueEl) assetValueEl.textContent = displayName;
                if (assetDropdown) {
                    assetDropdown.classList.remove('open');
                    assetDropdown.style.display = 'none';
                    const t = assetDropdown.querySelector('.asset-toggle');
                    if (t) t.disabled = true;
                }
                if (docAssetOther) {
                    docAssetOther.style.display = '';
                    docAssetOther.value = displayName;
                    docAssetOther.readOnly = true;
                }
            } else {
                const neighborhoodLabel = document.getElementById('doc-asset-label');
                if (neighborhoodLabel) neighborhoodLabel.textContent = 'Connected Asset';
                const match = known.find((b) => b.dataset.value === a);
                if (match) {
                    selectedAssetValue = a;
                    if (assetValueEl) assetValueEl.textContent = match.textContent;
                    match.classList.add('selected');
                    if (docAssetOther) {
                        docAssetOther.value = '';
                        docAssetOther.style.display = 'none';
                        docAssetOther.readOnly = false;
                    }
                } else if (a) {
                    selectedAssetValue = '__other__';
                    if (assetValueEl) assetValueEl.textContent = a;
                    const otherBtn = known.find((b) => b.dataset.value === '__other__');
                    if (otherBtn) otherBtn.classList.add('selected');
                    if (docAssetOther) {
                        docAssetOther.style.display = '';
                        docAssetOther.value = a;
                        docAssetOther.readOnly = false;
                    }
                } else {
                    selectedAssetValue = '';
                    if (assetValueEl) assetValueEl.textContent = '-- Select an asset --';
                }
            }
        }
        if (assetDropdown) assetDropdown.classList.remove('open');
        if (cal) cal.classList.remove('open');
        if (selectedAssetValue && selectedAssetValue !== '__other__' && !lockedAsset) {
            populateProjectMenu(selectedAssetValue);
        } else {
            populateProjectMenu('');
        }
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
        const projectVal = it.project || '';
        selectedProject = projectVal;
        if (projectMenu) {
            const projBtns = Array.prototype.slice.call(projectMenu.querySelectorAll('button[data-value]'));
            projBtns.forEach((b) => b.classList.remove('selected'));
            if (projectVal) {
                const projMatch = projBtns.find((b) => b.dataset.value === projectVal);
                if (projMatch) {
                    projMatch.classList.add('selected');
                    if (projectValueEl) projectValueEl.textContent = projectVal;
                    if (projectOther) { projectOther.style.display = 'none'; projectOther.value = ''; }
                } else {
                    if (projectValueEl) projectValueEl.textContent = projectVal;
                    if (projectOther) { projectOther.style.display = ''; projectOther.value = projectVal; }
                }
            } else {
                if (projectValueEl) projectValueEl.textContent = 'Other';
                const otherProj = projBtns.find((b) => b.dataset.value === '__other__');
                if (otherProj) otherProj.classList.add('selected');
                if (projectOther) { projectOther.style.display = 'none'; projectOther.value = ''; }
            }
        }
        if (projectDropdown) projectDropdown.classList.remove('open');
        const h = popup.querySelector('h3');
        if (h) h.textContent = 'Edit document';
        popup.style.display = 'flex';
        initialDocState = documentStateSnapshot();
    }

    function closePopup() {
        popup.style.display = 'none';
    }

    function documentStateSnapshot() {
        return JSON.stringify({
            name: nameInput.value, performed: performedInput.value,
            otherAsset: docAssetOther ? docAssetOther.value : ''
        });
    }

    function hasDocumentText() {
        return [nameInput, performedInput, docAssetOther].some(function (el) {
            return el && String(el.value || '').trim() !== '';
        });
    }

    function requestClosePopup() {
        if (!hasDocumentText() || documentStateSnapshot() === initialDocState) return closePopup();
        window.MyMaintenanceCommonUi.confirmDiscard(closePopup);
    }

    addBtn.addEventListener('click', openPopup);
    const scanBtn = document.getElementById('doc-scan-btn');
    if (scanBtn) scanBtn.addEventListener('click', openScanPopup);
    cancelBtn.addEventListener('click', requestClosePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) requestClosePopup();
    });

    function setPrivacy(value) {
        const v = value === 'house' ? 'house' : 'private';
        privacyRadios.forEach(function (r) { r.checked = r.value === v; });
    }

    function privacyValue() {
        const sel = document.querySelector('input[name="doc-privacy"]:checked');
        return sel ? sel.value : 'private';
    }

    function closeInfoTips(except) {
        document.querySelectorAll('.doc-info-wrap.show').forEach(function (wrap) {
            if (wrap !== except) {
                wrap.classList.remove('show');
                const button = wrap.querySelector('.doc-info-btn');
                if (button) button.setAttribute('aria-expanded', 'false');
            }
        });
    }

    document.querySelectorAll('.doc-info-btn').forEach(function (button) {
        const wrap = button.closest('.doc-info-wrap');
        if (!wrap) return;
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const opening = !wrap.classList.contains('show');
            closeInfoTips(wrap);
            wrap.classList.toggle('show', opening);
            button.setAttribute('aria-expanded', String(opening));
        });
    });

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.doc-info-wrap')) closeInfoTips();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeInfoTips();
    });

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
            selectedAssetId = btn.dataset.assetId || '';
            selectedAssetKind = btn.dataset.assetKind || '';
            if (assetValueEl) assetValueEl.textContent = btn.textContent;
            assetMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (assetDropdown) assetDropdown.classList.remove('open');
            if (docAssetOther) {
                docAssetOther.style.display = selectedAssetValue === '__other__' ? '' : 'none';
                if (selectedAssetValue === '__other__') docAssetOther.focus();
            }
            // Projects are tied to the selected asset.
            if (selectedAssetValue && selectedAssetValue !== '__other__') {
                populateProjectMenu(selectedAssetValue);
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
    if (projectToggle) {
        projectToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (projectDropdown) projectDropdown.classList.toggle('open');
        });
    }
    if (projectMenu) {
        projectMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-value]');
            if (!btn) return;
            selectedProject = btn.dataset.value === '__other__' ? '' : btn.dataset.value;
            if (projectValueEl) projectValueEl.textContent = btn.textContent;
            projectMenu.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (projectDropdown) projectDropdown.classList.remove('open');
            if (projectOther) {
                const showInput = btn.dataset.value === '__other__';
                projectOther.style.display = showInput ? '' : 'none';
                if (showInput) projectOther.focus();
            }
        });
    }
    document.addEventListener('click', (e) => {
        if (assetDropdown && !assetDropdown.contains(e.target)) {
            assetDropdown.classList.remove('open');
        }
        if (docTypeDropdown && !docTypeDropdown.contains(e.target)) {
            docTypeDropdown.classList.remove('open');
        }
        if (projectDropdown && !projectDropdown.contains(e.target)) {
            projectDropdown.classList.remove('open');
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
        if (ocrWorkerPromise) return ocrWorkerPromise;
        const loadTesseract = window.Tesseract
            ? Promise.resolve()
            : (tesseractLoadPromise || (tesseractLoadPromise = new Promise(function (resolve, reject) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                script.onload = resolve;
                script.onerror = function () { reject(new Error('OCR not available')); };
                document.head.appendChild(script);
            })));
        ocrWorkerPromise = loadTesseract.then(function () {
            if (!window.Tesseract) throw new Error('OCR not available');
            return window.Tesseract.createWorker('nor+eng', 1, {
            logger: function (m) {
                if (m && m.status === 'recognizing text') {
                    showScanStatus('Scanning document... ' + Math.round(m.progress * 100) + '%');
                }
            }
            });
        });
        return ocrWorkerPromise;
    }

    function preprocessImage(src) {
        return new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () {
                try {
                    const MAX = 3000;
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
                        // Preserve thin logo lettering; the former hard split erased
                        // pale/coloured characters on many printed receipts.
                        const v = Math.max(0, Math.min(255, (g - 128) * 1.45 + 128));
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
                currentReceiptItems = extractReceiptItems(text);
                if (!text) {
                    showScanStatus('Could not read any text. Try a clearer picture, or save the document as-is.', 'error');
                    return;
                }
                applyOcrResult(text);
                verifyStoreName(detectStore(text), text).then(function (store) {
                    if (store) applyVerifiedStore(store);
                }).catch(function () {});
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
        [/hageland/i, 'Hageland'],
        [/clas ohlson/i, 'Clas Ohlson'],
        [/europris/i, 'Europris'],
        [/fargerike/i, 'Fargerike'],
        [/flisekompaniet/i, 'Flisekompaniet'],
        [/malia/i, 'Malia'],
        [/bohus/i, 'Bohus'],
        [/skeidar/i, 'Skeidar'],
        [/m[øo]belringen/i, 'Møbelringen'],
        [/kid interi[øo]r/i, 'Kid Interiør'],
        [/princess interi[øo]r/i, 'Princess Interiør'],
        [/s[øo]strene grene/i, 'Søstrene Grene'],
        [/elkj[\u00f8o]p/i, 'Elkj\u00f8p'],
        [/kjell\s*(?:&|and)\s*company/i, 'Kjell & Company'],
        [/dustin/i, 'Dustin'],
        [/proshop/i, 'Proshop'],
        [/phonehouse/i, 'Phonehouse'],
        [/mekonomen/i, 'Mekonomen'],
        [/thansen/i, 'Thansen'],
        [/jysk/i, 'Jysk'],
        [/ikea/i, 'IKEA'],
        [/granng[\u00e5a]rden/i, 'Granng\u00e5rden'],
        [/coop[ -]?obs|obs[ -]?hyper/i, 'OBS'],
        [/obs[ -]?mega/i, 'OBS'],
        [/kiwi/i, 'Kiwi'],
        [/rema[ -]?1000/i, 'Rema 1000'],
        [/rema/i, 'Rema 1000'],
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
        [/fretex/i, 'Fretex'],
        [/vinmonopolet/i, 'Vinmonopolet'],
        [/cubus/i, 'Cubus'],
        [/kappahl/i, 'KappAhl'],
        [/xxl/i, 'XXL'],
        [/sport ?1/i, 'Sport 1'],
        [/g[ -]?sport/i, 'G-Sport'],
        [/intersport/i, 'Intersport'],
        [/sportsmann/i, 'Sportsmann'],
        [/fjellsport/i, 'Fjellsport'],
        [/intersport/i, 'Intersport'],
        [/sport outlet/i, 'Sport Outlet'],
        [/m[øo]ller bil/i, 'Møller Bil'],
        [/naf/i, 'NAF'],
        [/power/i, 'Power'],
        [/komplett/i, 'Komplett'],
        [/bildeler(?:\.no)?/i, 'Bildeler'],
        [/netonnet/i, 'NetOnNet'],
        [/gigaboks/i, 'Gigaboks'],
        [/epleh(?:uset|uset)/i, 'Eplehuset'],
        [/humac/i, 'Humac'],
        [/norli/i, 'Norli'],
        [/ark\s+bokhandel/i, 'ARK'],
        [/obs bygg/i, 'OBS Bygg'],
        [/coop bygg/i, 'Coop Bygg'],
        [/foer/i, 'Føtex'],
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
        const allText = String(text || '');
        const lines = allText.split(/\r?\n/).filter(Boolean);
        // Store marks are normally in the first receipt lines. Prioritising them
        // avoids mistaking a product brand later in the receipt for the shop.
        const t = lines.slice(0, 12).join('\n') || allText;
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
            if (STORE_PATTERNS[i][0].test(t) || STORE_PATTERNS[i][0].test(allText)) return STORE_PATTERNS[i][1];
        }
        const fuzzy = detectFuzzyKnownStore(lines);
        if (fuzzy) return fuzzy;
        return detectStoreHeader(lines);
    }

    function compactStoreText(value) {
        return String(value || '').toLocaleLowerCase('nb-NO').normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    }

    function editDistance(a, b) {
        const row = Array.from({ length: b.length + 1 }, function (_, i) { return i; });
        for (let i = 1; i <= a.length; i++) {
            let previous = row[0];
            row[0] = i;
            for (let j = 1; j <= b.length; j++) {
                const saved = row[j];
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
                previous = saved;
            }
        }
        return row[b.length];
    }

    function detectFuzzyKnownStore(lines) {
        const base = (lines || []).slice(0, 20).map(cleanStoreTitle).filter(Boolean);
        const candidates = base.slice();
        for (let i = 0; i < base.length - 1; i++) {
            candidates.push(base[i] + ' ' + base[i + 1]);
        }
        for (let i = 0; i < STORE_PATTERNS.length; i++) {
            const name = STORE_PATTERNS[i][1];
            const target = compactStoreText(name);
            if (target.length < 4) continue;
            const allowed = target.length <= 5 ? 1 : Math.max(1, Math.floor(target.length * 0.2));
            for (let j = 0; j < candidates.length; j++) {
                const seen = compactStoreText(candidates[j]);
                if (seen === target || (Math.abs(seen.length - target.length) <= allowed && editDistance(seen, target) <= allowed)) return name;
            }
        }
        return '';
    }

    function cleanStoreTitle(value) {
        return String(value || '')
            .replace(/\b(a\.?s\.?|asa|nuf|org\.?\s*nr\.?)\b.*$/i, '')
            .replace(/[^a-zæøåäöü'&.\-\s]/gi, ' ')
            .replace(/\s+/g, ' ').trim();
    }

    function isStoreHeaderNoise(value) {
        const line = String(value || '').trim();
        if (!line || line.length < 3 || line.length > 52) return true;
        if (/\d/.test(line)) return true;
        return /\b(kvittering|receipt|faktura|invoice|dato|date|tid|time|org\.?\s*nr|mva|vat|www|http|e-?post|epost|telefon|tlf|kunde|customer|terminal|kasse|cash|card|visa|mastercard|vipps|takk|velkommen|handelen|betaling|betalt|total|sum)\b/i.test(line);
    }

    function titleCaseStore(value) {
        const keepUpper = new Set(['IKEA', 'XXL', 'OBS', 'XL', 'AS']);
        return cleanStoreTitle(value).split(' ').map(function (word) {
            if (keepUpper.has(word.toUpperCase())) return word.toUpperCase();
            const lower = word.toLocaleLowerCase('nb-NO');
            return lower.charAt(0).toLocaleUpperCase('nb-NO') + lower.slice(1);
        }).join(' ');
    }

    function detectStoreHeader(lines) {
        const candidates = [];
        const header = (lines || []).slice(0, 20).map(function (line) { return cleanStoreTitle(line); });
        for (let i = 0; i < header.length; i++) {
            const options = [header[i]];
            // Logos are often split across two OCR lines, e.g. "TØNSBERG" + "UR".
            if (header[i + 1]) options.push(header[i] + ' ' + header[i + 1]);
            options.forEach(function (candidate) {
                if (isStoreHeaderNoise(candidate)) return;
                const words = candidate.split(' ').filter(Boolean);
                if (words.length > 5) return;
                if (words.length >= 3 && words.filter(function (word) { return word.length <= 2; }).length >= 2) return;
                const upper = (candidate.match(/[A-ZÆØÅÄÖÜ]/g) || []).length;
                const letters = (candidate.match(/[A-Za-zÆØÅÄÖÜæøåäöü]/g) || []).length || 1;
                let score = 40 - (i * 4);
                if (words.length >= 2) score += 16;
                if (upper / letters > 0.55) score += 12;
                if (/\b(ur|gull|optikk|bygg|elektro|apotek|interiør|møbler|sport|jernvare|blomster|klær|sko)\b/i.test(candidate)) score += 8;
                candidates.push({ value: titleCaseStore(candidate), score: score });
            });
        }
        candidates.sort(function (a, b) { return b.score - a.score; });
        return candidates.length ? candidates[0].value : '';
    }

    function applyVerifiedStore(store) {
        if (!store || !nameInput || nameInput.dataset.userEdited === 'true') return;
        const date = detectReceiptDate(currentOcrText);
        nameInput.value = store + (date ? ' ' + pad2(date.day) + '.' + pad2(date.month) + '.' + date.year : '');
        clearNameError();
    }

    function verifyStoreName(candidate, text) {
        const config = window.MyMaintenanceConfig || {};
        const endpoint = config.receiptStoreVerificationUrl;
        if (!candidate || !endpoint) return Promise.resolve(candidate);
        const context = String(text || '').split(/\r?\n/).slice(0, 12).join('\n').slice(0, 1200);
        return fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate: candidate, receiptHeader: context })
        }).then(function (response) {
            if (!response.ok) throw new Error('Store verification failed');
            return response.json();
        }).then(function (data) {
            return data && data.verified && typeof data.storeName === 'string' ? data.storeName.trim() : candidate;
        });
    }

    const DOC_TYPE_PATTERNS = [
        [/\b(receipt|re\u00e7u|recu|kassasjekk|kvitto|quittung|kassenbon|recibo|ricevuta|kassabon)\b|(?:salgs?|kassa|kj\u00f8ps|kj\u00f8pe)?kvit{1,2}ering\b/i, 'Receipt'],
        [/\b(warranty|guarantee|garantie|garanzia|garant\u00eda|garantia)\b|garanti(?:bevis|periode|sak|e|en|er)?\b/i, 'Warranty'],
        [/\b(invoice|faktura|fakturanr|invoice\s*no|regning|forfallsdato|due\s*date)\b/i, 'Invoice'],
        [/\b(contract|agreement|kontrakt|avtale|leieavtale|terms\s+and\s+conditions)\b/i, 'Contract'],
        [/\b(manual|user\s+guide|bruksanvisning|instruksjon|documentation|dokumentasjon|installasjon)\b/i, 'Manual']
    ];

    function detectDocType(text) {
        const t = String(text || '');
        const lines = t.split(/\r?\n/);
        const pricedLines = lines.filter(function (line) {
            return /[a-zæøå]/i.test(line) && /\b\d{1,5}(?:[,.]\d{2})\b/.test(line);
        }).length;
        if (pricedLines >= 2 && /\b(sum|total|totalt|mva|vat|kort|card|kontant|cash|betaling|betalt)\b/i.test(t)) return 'Receipt';
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
        const sep = '[.\\/\\-\\s]';
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
        const compact = t.match(/\b((?:19|20)\d{2})(\d{2})(\d{2})\b/);
        if (compact) {
            const year = +compact[1], month = +compact[2], day = +compact[3];
            const dt = new Date(year, month - 1, day);
            if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
                return { day: day, month: month, year: year };
            }
        }
        return run(dmy4, 'dmy') || detectSpelledDate(t) || run(ymd, 'ymd') || run(dmy2, 'dmy');
    }

    function detectReceiptDate(text) {
        const lines = String(text || '').split(/\r?\n/);
        const currentYear = new Date().getFullYear();
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const candidates = [];
        let bestScore = -1;
        lines.slice(0, 50).forEach(function (line, index) {
            const date = detectDate(line);
            if (!date) return;
            const dateValue = new Date(date.year, date.month - 1, date.day);
            if (dateValue > today) return;
            let score = 30 - index;
            if (/\b(date|dato|kjøpsdato|kjopsdato|purchase|purchased|transaction|transaksjon|sale|salgsdato|tid|time)\b/i.test(line)) score += 60;
            if (/\b(receipt|kvittering|kasse|terminal|betalt|betaling)\b/i.test(line)) score += 20;
            if (/\b(due|forfall|expiry|utløp|utlop|valid until|gyldig til)\b/i.test(line)) score -= 70;
            // Receipts often contain several dates. Prefer the current year when
            // context is otherwise equal, without overriding an explicit label.
            if (date.year === currentYear) score += 25;
            if (date.year > currentYear + 1) score -= 25;
            candidates.push({ date: date, score: score });
        });
        candidates.sort(function (a, b) { return b.score - a.score; });
        if (candidates.length) return candidates[0].date;
        const fallback = detectDate(text);
        if (!fallback) return null;
        const fallbackValue = new Date(fallback.year, fallback.month - 1, fallback.day);
        return fallbackValue <= today ? fallback : null;
    }

    function ensureViewer(info) {
        let globalName = '';
        let source = '';
        if (info.cls === 'file-pdf') { globalName = 'MyPdfViewer'; source = '../script/modules/pdfviewer.js'; }
        else if (info.cls === 'file-3d') { globalName = 'My3dViewer'; source = '../script/modules/stlviewer.js'; }
        else if (info.cls === 'file-xls' || info.cls === 'file-csv' || info.cls === 'file-docx') { globalName = 'MyOfficeViewer'; source = '../script/modules/officeviewer.js'; }
        if (!source || window[globalName]) return Promise.resolve();
        if (viewerLoadPromises[source]) return viewerLoadPromises[source];
        viewerLoadPromises[source] = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = source;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return viewerLoadPromises[source];
    }

    function applyOcrResult(text) {
        const store = detectStore(text);
        const date = detectReceiptDate(text);
        const docType = detectDocType(text);
        if (!nameInput.value.trim()) {
            const parts = [];
            if (store) parts.push(store);
            if (date) parts.push(pad2(date.day) + '.' + pad2(date.month) + '.' + date.year);
            if (!parts.length) parts.push('Scanned document');
            if (parts.length) nameInput.value = parts.join(' ');
        }
        if (nameInput.value.trim()) clearNameError();
        if (date && !performedInput.value.trim()) {
            performedInput.value = pad2(date.day) + '/' + pad2(date.month) + '/' + date.year;
            performedInput.classList.remove('invalid');
        }
        if (receiptTotalInput && !receiptTotalInput.value.trim()) {
            const total = detectReceiptTotal(text);
            const itemTotal = receiptItemsTotal(currentReceiptItems);
            if (total != null) receiptTotalInput.value = total.toFixed(2).replace('.', ',');
            else if (itemTotal) receiptTotalInput.value = itemTotal;
        }
        if (!selectedDocType && docType) setDocType(docType);
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function receiptItemsTotal(items) {
        if (!Array.isArray(items)) return '';
        const total = items.reduce(function (sum, item) {
            const price = parseFloat(String(item.price || '').replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(String(item.quantity || '1').replace(/\s/g, '').replace(',', '.'));
            return !isNaN(price) ? sum + price * (isNaN(quantity) ? 1 : quantity) : sum;
        }, 0);
        return total ? total.toFixed(2).replace('.', ',') : '';
    }

    function detectReceiptTotal(text) {
        let best = null;
        String(text || '').split(/\r?\n/).forEach(function (line) {
            if (!/\b(total|totalt|sum|beløp|belop|å betale|a betale|amount due|grand total)\b/i.test(line)) return;
            const matches = line.match(/\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})/g);
            if (!matches || !matches.length) return;
            const value = parseFloat(matches[matches.length - 1].replace(/\s/g, '').replace('.', '').replace(',', '.'));
            if (!isNaN(value)) best = value;
        });
        return best;
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

    function extractReceiptItems(text) {
        return String(text || '').split(/\r?\n/).map(function (raw) {
            const line = raw.replace(/\s+/g, ' ').trim();
            if (!line || isReceiptNoiseLine(line) || !/[a-zæøå]/i.test(line)) return null;
            const price = line.match(/(?:kr\.?\s*)?(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})?)\s*$/i);
            if (!price) return null;
            const quantity = line.match(/^\s*(\d+(?:[,.]\d+)?)\s*[x×]\s*/i);
            const description = line.slice(0, price.index).replace(/^\s*\d+(?:[,.]\d+)?\s*[x×]\s*/i, '').trim();
            if (description.length < 2) return null;
            return { description: description, price: price[1].replace(/\s/g, '').replace(',', '.'), quantity: quantity ? quantity[1].replace(',', '.') : '1', raw: line };
        }).filter(Boolean);
    }

    function receiptItemsSearchText(receiptItems) {
        return (Array.isArray(receiptItems) ? receiptItems : []).map(function (item) {
            const description = item.description || item.raw || '';
            return description + ' ' + (item.price || '') + ' ' + (item.quantity || '') + ' ' + productCategoryText(description);
        }).join(' ');
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
        const library = embedLibraryPromise || (embedLibraryPromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js').then(function (lib) {
            try { lib.env.allowLocalModels = false; } catch (_) {}
            return lib;
        }));
        embedModelPromise = library.then(function (lib) {
            if (!lib || typeof lib.pipeline !== 'function') throw new Error('Embedding model not available');
            return lib.pipeline('feature-extraction', EMBED_MODEL);
        }).then(function (p) {
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

    function handleFileSelection(file) {
        clearFileError();
        if (!file) {
            selectedFile = null;
            if (fileNameLabel) fileNameLabel.textContent = 'No file selected';
            sizeInput.value = '';
            return;
        }
        selectedFile = file;
        sizeInput.value = formatSize(file.size);
        if (formatInput) formatInput.value = fileTypeInfo({ fileName: file.name, type: file.type }).label;
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
    }

    fileInput.addEventListener('change', function () { handleFileSelection(fileInput.files[0]); });

    nameInput.addEventListener('input', () => {
        nameInput.dataset.userEdited = 'true';
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

    function closeCalendar() {
        if (cal) cal.classList.remove('open');
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
        performedInput.addEventListener('blur', function () {
            // Let a calendar button receive focus before deciding whether to close.
            window.setTimeout(function () {
                if (!cal || !cal.contains(document.activeElement)) closeCalendar();
            }, 0);
        });

        // iOS may hide its keyboard while keeping the input focused. Its visual
        // viewport grows again when that happens, so close the companion calendar.
        if (window.visualViewport) {
            let previousViewportHeight = window.visualViewport.height;
            window.visualViewport.addEventListener('resize', function () {
                const currentViewportHeight = window.visualViewport.height;
                if (currentViewportHeight > previousViewportHeight + 60) closeCalendar();
                previousViewportHeight = currentViewportHeight;
            });
        }
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

    async function commitSave() {
        const file = selectedFile;
        if (!file && !editingId) {
            markFileError();
            return;
        }
        const name = nameInput.value.trim();
        if (!name) {
            markNameError();
            return;
        }
        const asset = lockedAsset
                ? lockedAsset
                : (selectedAssetValue === '__other__'
                        ? (docAssetOther ? docAssetOther.value.trim() : '')
                        : selectedAssetValue);
        const performedDt = parseDateStr(performedInput.value);
        const privacy = privacyValue();
        let rec = editingId ? items.find(function (item) { return item.id === editingId; }) : null;
        const isNewRecord = !rec;
        if (!rec) {
            rec = { id: crypto.randomUUID() };
            items.push(rec);
        }
        rec.name = name;
        rec.asset = asset;
        rec.homeId = selectedAssetKind === 'home' ? selectedAssetId : '';
        rec.vehicleId = selectedAssetKind === 'vehicle' ? selectedAssetId : '';
        rec.privacy = privacy;
        rec.docType = selectedDocType;
        const receiptTotal = receiptTotalInput ? parseFloat(String(receiptTotalInput.value || '').replace(/\s/g, '').replace(',', '.')) : NaN;
        if (!isNaN(receiptTotal)) rec.receiptTotal = receiptTotal;
        else delete rec.receiptTotal;
        rec.project = selectedProject
            ? selectedProject
            : (projectOther ? projectOther.value.trim() : '');
        if (rec.project && asset && asset !== '__other__') addProjectForAsset(asset, rec.project);
        rec.performed = performedDt ? toISO(performedDt) : '';

        if (file) {
            try {
                const db = window.MyMaintenanceData;
                const userId = db && await db.userId();
                if (!db || !userId) throw new Error('Please sign in again.');
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                rec.filePath = `${userId}/${rec.id}/${safeName}`;
                await db.upload(rec.filePath, file);
                rec.type = db.fileMime ? db.fileMime(file) : file.type;
                rec.fileName = file.name;
                rec.size = file.size;
                rec.sizeLabel = formatSize(file.size);
                rec.uploaded = toISO(new Date());
                rec.created = Date.now();
                rec.ocrText = currentOcrText || '';
                rec.ocrItems = currentOcrItems;
                rec.ocrExpanded = currentOcrExpanded;
                rec.ocrEmbedding = currentOcrEmbedding;
                rec.receiptItems = currentReceiptItems;
            } catch (error) {
                if (isNewRecord) items = items.filter(function (item) { return item !== rec; });
                window.MyMaintenanceCommonUi.alert(error.message || 'Could not upload document.');
                return;
            }
        }

        store();
        updateView();
        closePopup();
    }

    async function startCommitSave() {
        if (saveInProgress) return;
        saveInProgress = true;
        if (saveBtn) saveBtn.disabled = true;
        try {
            await commitSave();
        } finally {
            saveInProgress = false;
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    saveBtn.addEventListener('click', () => {
        const file = selectedFile;
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
        startCommitSave();
    });

    if (oldDateConfirm) {
        oldDateConfirm.addEventListener('click', () => {
            if (oldDatePopup) oldDatePopup.style.display = 'none';
            startCommitSave();
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
        right.innerHTML = '<span class="doc-cell doc-cell-performed doc-col-label">Performed</span>'
            + '<span class="doc-cell doc-cell-uploaded doc-col-label">Uploaded</span>'
            + '<span class="doc-cell doc-cell-type doc-col-label">Doc Type</span>'
            + '<span class="doc-cell doc-cell-project doc-col-label">Project</span>'
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
            + '<span class="doc-cell doc-cell-project">' + escapeHtml(it.project || '') + '</span>'
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
            + '<span class="doc-cell doc-cell-project doc-col-label">Project</span>'
             + '<span class="doc-cell doc-cell-size doc-col-label">Size</span>'
             + '<span class="doc-cell doc-cell-privacy doc-col-label">Privacy</span>'
             + '<span class="doc-cell doc-cell-edit doc-col-label">Edit</span>'
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
            + '<span class="doc-cell doc-cell-project">' + escapeHtml(it.project || '') + '</span>'
             + '<span class="doc-cell doc-cell-size">' + escapeHtml(formatSize(it.size)) + '</span>'
             + '<span class="doc-cell doc-cell-privacy">' + privacyTagHtml(it) + '</span>'
             + '<span class="doc-cell doc-cell-edit"><button type="button" class="doc-edit-btn" title="Edit document" aria-label="Edit document"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c-.39-.39 0-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button></span>'
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
            case 'project':
                return String(a.project || '').toLowerCase() < String(b.project || '').toLowerCase();
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

    function docCost(it) {
        if (!it) return 0;
        if (it.receiptTotal != null && !isNaN(Number(it.receiptTotal))) return Number(it.receiptTotal);
        if (!Array.isArray(it.receiptItems)) return 0;
        let total = 0;
        it.receiptItems.forEach(function (item) {
            const price = parseFloat(String(item.price || '0').replace(/\s/g, '').replace(',', '.'));
            const qty = parseFloat(String(item.quantity || '1').replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(price)) total += price * (isNaN(qty) ? 1 : qty);
        });
        return total;
    }

    function formatCost(n) {
        if (!n) return 'kr 0';
        return 'kr ' + n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

function openAddDocPopup() {
        openPopup();
    }

    function renderProjectFolders(assetKey, assetDocs) {
        const wrap = document.createElement('div');
        wrap.className = 'doc-projects';
        const projects = projectsForAsset(assetKey);
        // Only show folders that still have documents, or keep all saved projects.
        const projectSet = new Set((assetDocs || []).map(function (d) { return d.project || ''; }).filter(Boolean));
        projects.forEach(function (name) { projectSet.add(name); });
        const projectNames = Array.from(projectSet);

        function folderHtml(name) {
            const docs = (assetDocs || []).filter(function (d) { return (d.project || '') === name; });
            const count = docs.length;
            const cost = docs.reduce(function (sum, d) { return sum + docCost(d); }, 0);
            return '<div class="doc-project-folder" data-project="' + escapeHtml(name) + '">'
                + '<div class="doc-project-folder-name">' + escapeHtml(name) + '</div>'
                + '<div class="doc-project-folder-meta">' + count + ' document' + (count === 1 ? '' : 's') + '</div>'
                + '<div class="doc-project-folder-cost"><span class="doc-project-folder-cost-label">Price</span>' + formatCost(cost) + '</div>'
                + '</div>';
        }

        projectNames.forEach(function (name) {
            wrap.insertAdjacentHTML('beforeend', folderHtml(name));
        });

        // Always offer an "Add project" folder; clicking it turns into an input
        // field to type a project name.
        const add = document.createElement('div');
        add.className = 'doc-project-folder doc-project-add';
        add.innerHTML = '<div class="doc-project-folder-name">+ Add project</div>';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'doc-project-input';
        input.placeholder = 'Project name...';
        input.style.display = 'none';
        add.appendChild(input);
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'doc-project-confirm';
        confirm.setAttribute('aria-label', 'Confirm project name');
        confirm.title = 'Confirm project name';
        confirm.innerHTML = '&#10003;';
        confirm.style.display = 'none';
        add.appendChild(confirm);

        const showInput = function () {
            add.classList.add('adding');
            add.querySelector('.doc-project-folder-name').style.display = 'none';
            input.style.display = '';
            confirm.style.display = '';
            input.focus();
        };
        const commit = function () {
            const name = input.value.trim();
            add.classList.remove('adding');
            add.querySelector('.doc-project-folder-name').style.display = '';
            input.style.display = 'none';
            confirm.style.display = 'none';
            input.value = '';
            if (name && assetKey && assetKey !== '__other__') {
                addProjectForAsset(assetKey, name);
                render();
            }
        };
        add.addEventListener('click', function (e) {
            if (e.target === input) return;
            showInput();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') {
                add.classList.remove('adding');
                add.querySelector('.doc-project-folder-name').style.display = '';
                input.style.display = 'none';
                confirm.style.display = 'none';
                input.value = '';
            }
        });
        confirm.addEventListener('mousedown', function (e) { e.preventDefault(); });
        confirm.addEventListener('click', function (e) {
            e.stopPropagation();
            commit();
        });
        input.addEventListener('blur', commit);
        wrap.appendChild(add);

        // Fill columns first, capped at six per row. The columns adapt to the
        // number of boxes so every row fills the full width (e.g. 3 boxes use
        // 3 columns; 8 boxes use 6 columns and wrap to a second row).
        const vw = window.innerWidth;
        let maxCols = 6;
        if (vw <= 460) maxCols = 2;
        else if (vw <= 640) maxCols = 3;
        else if (vw <= 900) maxCols = 4;
        const cols = Math.max(1, Math.min(maxCols, wrap.children.length));
        wrap.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

        // When the Add-project box is the only box on its row (e.g. exactly six
        // projects already fill the previous row), it spans the whole row.
        const boxCount = wrap.children.length;
        if (boxCount % cols === 1) {
            add.style.gridColumn = '1 / -1';
        }

        // Clicking a project folder opens that project's own page.
        wrap.querySelectorAll('.doc-project-folder[data-project]').forEach(function (el) {
            el.addEventListener('click', function () {
                window.location.href = 'myproject.html?asset=' + encodeURIComponent(assetKey) + '&project=' + encodeURIComponent(el.dataset.project);
            });
        });

        return wrap;
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
            const groupKeys = Array.from(byAsset.keys()).sort(function (a, b) {
                const aOther = a === '__other__';
                const bOther = b === '__other__';
                const aNb = /^Neighborhood:/i.test(a);
                const bNb = /^Neighborhood:/i.test(b);
                const aRank = aOther ? 1 : (aNb ? 2 : 0);
                const bRank = bOther ? 1 : (bNb ? 2 : 0);
                if (aRank !== bRank) return aRank - bRank;
                return a < b ? -1 : 1;
            });
            groupKeys.forEach(function (key) {
                const arr = byAsset.get(key);
                const sortedArr = arr.slice().sort(sortComparator());
                const grp = document.createElement('div');
                grp.className = 'subgroup doc-group';
                const title = key === '__other__' ? 'Other' : key;
                const head = document.createElement('div');
                head.className = 'doc-group-header';
                head.innerHTML = '<button class="collapse-toggle"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h4>' + escapeHtml(title) + '</h4>';
                const content = document.createElement('div');
                content.className = 'subgroup-content';
                content.appendChild(renderProjectFolders(key, byAsset.get(key)));
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
        try { await ensureViewer(info); } catch (_) {}
        let data = '';
        try {
            data = await getPayload(it) || '';
        } catch (err) {
            data = '';
        }
        if (info.cls === 'file-image' && data) {
            body.innerHTML = '<div class="preview-image-viewer">'
                + '<div class="pdfv-toolbar doc-image-toolbar" aria-label="Image zoom">'
                + '<button type="button" class="pdfv-btn" title="Previous image" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>'
                + '<input type="number" class="pdfv-page-input" min="1" max="1" value="1" aria-label="Image" readonly>'
                + '<span class="pdfv-page-total">/ 1</span>'
                + '<button type="button" class="pdfv-btn" title="Next image" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg></button>'
                + '<span class="pdfv-divider"></span>'
                + '<button type="button" class="pdfv-btn" data-image-zoom="out" title="Zoom out" aria-label="Zoom out"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg></button>'
                + '<output class="pdfv-zoom-label" title="Reset zoom">100%</output>'
                + '<button type="button" class="pdfv-btn" data-image-zoom="in" title="Zoom in" aria-label="Zoom in"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>'
                + '<button type="button" class="pdfv-btn" data-image-action="fit" title="Fit image"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 4h16v2H4V4zm0 14h16v2H4v-2zm2-8h12v4H6v-4z"/></svg></button>'
                + '<span class="pdfv-divider"></span>'
                + '<button type="button" class="pdfv-btn" data-image-action="print" title="Print"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg></button>'
                + '<button type="button" class="pdfv-btn" data-image-action="share" title="Open / share"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM5 5h6v2H5v12h12v-6h2v8H3V5h2z"/></svg></button>'
                + '</div>'
                + '<div class="preview-img-wrap"><div class="preview-image-stage"><img class="preview-media" src="' + data + '" alt="' + escapeHtml(it.name) + '"></div></div>'
                + '</div>';
            initImageZoom(body, data, it.fileName || it.name || 'image');
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

    function initImageZoom(body, data, name) {
        const ZOOM_STEP = 15;
        const WHEEL_STEP = 8;
        const MIN_ZOOM = 50;
        const MAX_ZOOM = 325;
        const NOTCH = 15;
        const image = body.querySelector('.preview-media');
        const wrap = body.querySelector('.preview-img-wrap');
        const output = body.querySelector('.doc-image-toolbar output');
        const zoomOut = body.querySelector('[data-image-zoom="out"]');
        const zoomIn = body.querySelector('[data-image-zoom="in"]');
        const fit = body.querySelector('[data-image-action="fit"]');
        const print = body.querySelector('[data-image-action="print"]');
        const share = body.querySelector('[data-image-action="share"]');
        let zoom = 100;
        let wheelAccum = 0;

        function setZoom(next) {
            zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(next)));
            image.style.setProperty('--doc-image-scale', zoom / 100);
            wrap.classList.toggle('is-zoomed', zoom > 100);
            output.textContent = zoom + '%';
            zoomOut.disabled = zoom === MIN_ZOOM;
            zoomIn.disabled = zoom === MAX_ZOOM;
        }

        function changeZoom(delta) {
            const next = zoom + delta;
            setZoom((zoom < 100 && next > 100) || (zoom > 100 && next < 100) ? 100 : next);
        }

        zoomOut.addEventListener('click', function () { changeZoom(-ZOOM_STEP); });
        zoomIn.addEventListener('click', function () { changeZoom(ZOOM_STEP); });
        output.addEventListener('click', function () { setZoom(100); });
        fit.addEventListener('click', function () { setZoom(100); });
        print.addEventListener('click', function () { printImage(data, name); });
        share.addEventListener('click', function () { shareImage(data, name); });
        wrap.addEventListener('wheel', function (event) {
            if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
            event.preventDefault();
            wheelAccum += event.deltaY;
            while (Math.abs(wheelAccum) >= NOTCH) {
                changeZoom(wheelAccum > 0 ? -WHEEL_STEP : WHEEL_STEP);
                wheelAccum -= wheelAccum > 0 ? NOTCH : -NOTCH;
            }
        }, { passive: false });
        setZoom(100);
    }

    function printImage(data, name) {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;border:0';
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        doc.open();
        doc.write('<!doctype html><html><head><title>' + escapeHtml(name) + '</title><style>html,body{margin:0}img{display:block;max-width:100%;max-height:100vh;margin:auto;object-fit:contain}</style></head><body><img src="' + data + '"></body></html>');
        doc.close();
        frame.onload = function () {
            frame.contentWindow.focus();
            frame.contentWindow.print();
            setTimeout(function () { frame.remove(); }, 100);
        };
    }

    function shareImage(data, name) {
        const blob = dataUrlToBlob(data);
        const file = new File([blob], name, { type: blob.type });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
            navigator.share({ files: [file], title: name }).catch(function () {
                window.open(dataUrlToBlobUrl(data), '_blank');
            });
            return;
        }
        window.open(dataUrlToBlobUrl(data), '_blank');
    }

    function dataUrlToBlob(dataUrl) {
        const parts = dataUrl.split(',');
        const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
        const bin = atob(parts[1]);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return new Blob([out], { type: mime });
    }

    function dataUrlToBlobUrl(dataUrl) {
        try {
            return URL.createObjectURL(dataUrlToBlob(dataUrl));
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
    if (window.MyMaintenanceProjects) {
        window.MyMaintenanceProjects.hydrate().then(function () { updateView(); });
        window.addEventListener('projects:changed', updateView);
    }
    if (!neighborhoodOnly) hydrateDocuments();

    window.MyMaintenanceDocs = {
        getItems: function () { return items.slice(); },
        openPreview: openPreview,
        openEdit: function (it) {
            const doc = items.filter(function (d) { return d.id === (it && it.id); })[0] || it;
            if (doc) openEditPopup(doc);
        },
        refresh: function () { return hydrateDocuments(); },
        render: render,
        persistItem: function (it) {
            persistDocument(it);
            window.dispatchEvent(new CustomEvent('mydocs:changed'));
        },
        headerRowHtml: headerRowHtml,
        rowHtml: rowHtml
    };
});

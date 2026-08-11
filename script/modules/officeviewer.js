/* MyOfficeViewer - built-in preview for Office documents.
   - Word (.docx) rendered to HTML via mammoth
   - Excel (.xls / .xlsx / .csv) rendered to tables via SheetJS (XLSX)
   Lazy-loads classic scripts from script/vendor/ on first use, following the
   same pattern as MyPdfViewer / My3dViewer so it also works over file://. */
window.MyOfficeViewer = (function () {
    'use strict';

    var VENDOR = (function () {
        var src = '';
        try {
            if (document.currentScript) src = document.currentScript.src;
        } catch (e) {}
        return src ? new URL('../vendor/', src).href : '../script/vendor/';
    })();

    var libPromise = null;

    function ensureUlImageMetadata() {
        if (!Array.prototype.__proto__ || !Object.getOwnPropertyDescriptor || !Object.defineProperty) return;
        try {
            var needs = {};
            if (!Object.getOwnPropertyDescriptor(Array.prototype, 'includes')) needs.includes = true;
            if (needs.includes) {
                Object.defineProperty(Array.prototype, 'includes', {
                    value: function (x, n) {
                        for (var i = n || 0; i < this.length; i++) if (this[i] === x) return true;
                        return false;
                    }
                });
            }
        } catch (e) {}
    }

    function loadLibs() {
        if (libPromise) return libPromise;
        ensureUlImageMetadata();
        libPromise = new Promise(function (resolve, reject) {
            var items = [
                { name: 'mammoth', prop: 'mammoth', file: 'mammoth.browser.js' },
                { name: 'XLSX', prop: 'XLSX', file: 'xlsx.full.min.js' }
            ];
            var pending = items.slice();
            var failed = false;

            function checkAll() {
                var missing = pending.filter(function (it) {
                    return typeof window[it.prop] === 'undefined';
                });
                pending = missing;
                if (failed || pending.length === 0) {
                    if (failed) reject(new Error('Could not load the document viewer'));
                    else resolve();
                }
            }

            function loadOne(it) {
                if (typeof window[it.prop] !== 'undefined') { checkAll(); return; }
                var s = document.createElement('script');
                s.src = VENDOR + it.file;
                s.onload = function () {
                    if (typeof window[it.prop] === 'undefined') { failed = true; checkAll(); }
                    else checkAll();
                };
                s.onerror = function () { failed = true; reject(new Error('Could not load the document viewer')); };
                document.head.appendChild(s);
            }

            items.forEach(loadOne);
        });
        return libPromise;
    }

    function dataUrlToArrayBuffer(dataUrl) {
        var parts = String(dataUrl).split(',');
        if (parts.length < 2) throw new Error('Unsupported data format');
        var bin = atob(parts[1]);
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out.buffer;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function renderSpreadsheet(xls, parent) {
        var wb = XLSX.read(xls, { type: 'array', cellDates: true });
        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error('No sheets found in file');
        }
        var names = wb.SheetNames;
        var wrap = document.createElement('div');
        wrap.className = 'office-spreadsheet';

        var tabs = document.createElement('div');
        tabs.className = 'office-tabs';
        var pages = document.createElement('div');
        pages.className = 'office-sheets';

        names.forEach(function (name, idx) {
            var tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'office-tab' + (idx === 0 ? ' active' : '');
            tab.textContent = name;
            (function (t, n) {
                t.addEventListener('click', function () {
                    var all = pages.querySelectorAll('.office-sheet');
                    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
                    var btns = tabs.querySelectorAll('.office-tab');
                    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
                    t.classList.add('active');
                    pages.querySelector('[data-sheet="' + n + '"]').classList.add('active');
                });
            })(tab, name);
            tabs.appendChild(tab);

            var sheet = document.createElement('div');
            sheet.className = 'office-sheet' + (idx === 0 ? ' active' : '');
            sheet.dataset.sheet = name;
            try {
                var html = XLSX.utils.sheet_to_html(wb.Sheets[name], { id: 'offx-' + idx });
                sheet.innerHTML = html;
            } catch (e) {
                sheet.innerHTML = '<div class="preview-note">Could not render sheet "' + escapeHtml(name) + '". Use Open or Download below.</div>';
            }
            pages.appendChild(sheet);
        });

        wrap.appendChild(tabs);
        wrap.appendChild(pages);
        parent.appendChild(wrap);
    }

    function renderWordDoc(arrayBuffer, parent) {
        var wrap = document.createElement('div');
        wrap.className = 'office-word';
        parent.appendChild(wrap);
        return mammoth.convertToHtml({ arrayBuffer: arrayBuffer }).then(function (result) {
            var messages = result && result.messages ? result.messages : [];
            var warn = messages.filter(function (m) { return m && m.type === 'warning'; }).length;
            var errors = messages.filter(function (m) { return m && m.type === 'error'; }).length;
            wrap.innerHTML = result.value || '<p class="preview-note">(empty document)</p>';
            if (errors && window.console) window.console.warn('mammoth errors:', errors);
            if (warn && window.console) window.console.warn('mammoth warnings:', warn);
        }, function (err) {
            throw new Error('Could not read Word document' + ((err && err.message) ? ': ' + err.message : ''));
        });
    }

    function open(dataUrl, fileName, parent, ext) {
        if (!parent) return Promise.reject(new Error('No container'));
        close();
        return loadLibs().then(function () {
            var buffer = dataUrlToArrayBuffer(dataUrl);
            var e = String(ext || '').toLowerCase();
            if (e === 'docx') {
                return renderWordDoc(buffer, parent);
            }
            renderSpreadsheet(buffer, parent);
            return undefined;
        }).catch(function (err) {
            close();
            var msg = (err && err.message) ? err.message : String(err);
            if (window.console && window.console.error) window.console.error('MyOfficeViewer: ' + msg);
            if (parent) {
                parent.innerHTML = '<div class="preview-note">Could not preview this document (' + escapeHtml(msg) + '). Use Open or Download below.</div>';
            }
            throw err;
        });
    }

    function close() {
        // office previews are plain DOM; nothing to dispose
    }

    return { open: open, close: close, load: loadLibs };
})();
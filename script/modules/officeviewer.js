/* MyOfficeViewer - built-in preview for Office documents.
   - Word (.docx) rendered as real pages (A4 / Letter / custom page size as
     defined in the file) via docx-preview
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

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('Could not load the document viewer')); };
            document.head.appendChild(s);
        });
    }

    function loadStyle(src) {
        if (document.querySelector('link[data-office-css="1"]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = src;
        l.setAttribute('data-office-css', '1');
        document.head.appendChild(l);
    }

    function loadLibs() {
        if (libPromise) return libPromise;
        ensureUlImageMetadata();
        // Sequential: docx-preview reads window.JSZip at execution time and
        // only exposes window.docx if jszip is already present.
        libPromise = loadScript(VENDOR + 'jszip.min.js')
            .then(function () {
                return Promise.all([
                    loadScript(VENDOR + 'docx-preview.min.js'),
                    loadScript(VENDOR + 'xlsx.full.min.js')
                ]);
            })
            .then(function () {
                if (!window.docx) throw new Error('Could not load the document viewer');
                if (!window.XLSX) throw new Error('Could not load the document viewer');
                loadStyle(VENDOR + 'docx-preview.css');
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
        return docx.renderAsync(arrayBuffer, wrap, null, {
            inWrapper: true,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            useBase64URL: true
        }).then(function () {
            var pages = wrap.querySelectorAll('.docx-wrapper > section.docx');
            if (pages.length === 0) {
                throw new Error('Could not read Word document');
            }
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
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

    function renderWordDoc(arrayBuffer, parent, dataUrl, name) {
        var wrap = document.createElement('div');
        wrap.className = 'office-word';
        wrap.dataset.dataUrl = dataUrl;
        wrap.dataset.name = name;
        parent.appendChild(wrap);
        docContainer = wrap;
        buildWordToolbar(wrap);
        var scroll = document.createElement('div');
        scroll.className = 'office-doc-scroll';
        wrap.appendChild(scroll);
        wireWheelZoom(scroll);
        return docx.renderAsync(arrayBuffer, scroll, null, {
            inWrapper: true,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            useBase64URL: true
        }).then(function () {
            var sections = scroll.querySelectorAll('.docx-wrapper > section.docx');
            if (sections.length === 0) {
                throw new Error('Could not read Word document');
            }
            docPageCount = sections.length;
            docCurrentPage = 1;
            docWrap = scroll.querySelector('.docx-wrapper');
            docFitMode = 'none';
            docScale = 1;
            docBaseW = 0;
            docBaseH = 0;
            try {
                var first = sections[0].getBoundingClientRect();
                if (first) { docBaseW = first.width; docBaseH = first.height; }
            } catch (e) {}
            docApply();
            docUpdateUi();
        }, function (err) {
            throw new Error('Could not read Word document' + ((err && err.message) ? ': ' + err.message : ''));
        });
    }

    function wireWheelZoom(scroll) {
        var accum = 0;
        scroll.addEventListener('wheel', function (e) {
            if (!(e.ctrlKey || e.metaKey || e.altKey)) return;
            e.preventDefault();
            accum += e.deltaY;
            var changed = false;
            while (Math.abs(accum) >= 15) {
                docZoomBy(accum > 0 ? 1 / 1.08 : 1.08);
                accum -= (accum > 0 ? 15 : -15);
                changed = true;
            }
            if (changed) {
                docFitMode = 'none';
                docApply();
                docUpdateUi();
            }
        }, { passive: false });
    }

    /* ---- word toolbar: page nav, zoom, fit, print, share (mirrors MyPdfViewer) ---- */
    var ZOOM_STEP = 0.15;
    var MIN_ZOOM = 0.5;
    var MAX_ZOOM = 3.25;
    var docWrap = null;
    var docContainer = null;
    var docPageCount = 0;
    var docCurrentPage = 1;
    var docScale = 1;
    var docFitMode = 'none';
    var docBaseW = 0;
    var docBaseH = 0;

    function buildWordToolbar(wrap) {
        var tb = document.createElement('div');
        tb.className = 'office-toolbar';
        tb.innerHTML =
            '<button type="button" class="pdfv-btn" data-act="prev" title="Previous page"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>'
            + '<input type="number" class="office-page-input" data-act="page" min="1" value="1" aria-label="Page">'
            + '<span class="office-page-total" data-total="1">/ 1</span>'
            + '<button type="button" class="pdfv-btn" data-act="next" title="Next page"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg></button>'
            + '<span class="pdfv-divider"></span>'
            + '<button type="button" class="pdfv-btn" data-act="zoom-out" title="Zoom out"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg></button>'
            + '<span class="office-zoom-label" data-zoom="1">100%</span>'
            + '<button type="button" class="pdfv-btn" data-act="zoom-in" title="Zoom in"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>'
            + '<button type="button" class="pdfv-btn" data-act="fit" title="Fit width"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 4h16v2H4V4zm0 14h16v2H4v-2zm2-8h12v4H6v-4z"/></svg></button>'
            + '<span class="pdfv-divider"></span>'
            + '<button type="button" class="pdfv-btn" data-act="print" title="Print"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg></button>'
            + '<button type="button" class="pdfv-btn" data-act="share" title="Open / share"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM5 5h6v2H5v12h12v-6h2v8H3V5h2z"/></svg></button>';
        tb.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-act]');
            if (!btn) return;
            var act = btn.getAttribute('data-act');
            if (act === 'prev') docGoToPage(docCurrentPage - 1);
            else if (act === 'next') docGoToPage(docCurrentPage + 1);
            else if (act === 'zoom-in') docZoomStep(1);
            else if (act === 'zoom-out') docZoomStep(-1);
            else if (act === 'fit') docToggleFit();
            else if (act === 'print') docPrint();
            else if (act === 'share') docShare();
        });
        tb.querySelector('[data-act="page"]').addEventListener('change', function () {
            var n = parseInt(this.value, 10);
            docGoToPage(isNaN(n) ? 1 : n);
        });
        wrap.appendChild(tb);
    }

    function docApply() {
        if (!docWrap) return;
        docWrap.style.zoom = docScale;
    }

    function docSetScale(s) {
        docFitMode = 'none';
        docScale = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s)) * 100) / 100;
        docApply();
        docUpdateUi();
    }

    function docZoomStep(dir) {
        if (docFitMode !== 'none') { docScale = 1; docFitMode = 'none'; }
        docSetScale(docScale + dir * ZOOM_STEP);
    }

    function docZoomBy(mult) {
        docFitMode = 'none';
        docSetScale(docScale * mult);
    }

    function docScrollInner() {
        var sc = docContainer ? docContainer.querySelector('.office-doc-scroll') : null;
        if (!sc) return { w: 100, h: 100 };
        return { w: Math.max(50, sc.clientWidth), h: Math.max(50, sc.clientHeight) };
    }

    function docToggleFit() {
        if (!docBaseW || !docBaseH) return;
        var dims = docScrollInner();
        if (docFitMode === 'none' || docFitMode === 'height') docFitMode = 'width';
        else docFitMode = 'height';
        var s = docFitMode === 'width' ? (dims.w / docBaseW) : (dims.h / docBaseH);
        docScale = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s)) * 100) / 100;
        docApply();
        docUpdateUi();
    }

    function docGoToPage(n) {
        var sc = docContainer ? docContainer.querySelector('.office-doc-scroll') : null;
        if (!sc) return;
        var sections = sc.querySelectorAll('.docx-wrapper > section.docx');
        if (!sections.length) return;
        if (n < 1) n = 1;
        if (n > sections.length) n = sections.length;
        docCurrentPage = n;
        sections[n - 1].scrollIntoView({ block: 'start', behavior: 'smooth' });
        docUpdateUi();
    }

    function docUpdateUi() {
        var sc = docContainer ? docContainer.querySelector('.office-doc-scroll') : null;
        if (!sc) return;
        (function (root) {
            var inEl = root.querySelector('[data-act="page"]');
            var total = root.querySelector('[data-total]');
            var zoom = root.querySelector('[data-zoom]');
            if (inEl) { inEl.value = docCurrentPage; inEl.style.width = (String(docCurrentPage).length + 1) + 'ch'; }
            if (total) total.textContent = '/ ' + docPageCount;
            if (zoom) zoom.textContent = Math.round(docScale * 100) + '%';
            var fit = root.querySelector('[data-act="fit"]');
            if (fit) {
                fit.title = docFitMode === 'none' ? 'Fit width' : (docFitMode === 'width' ? 'Fit height (click to switch)' : 'Fit width (click to switch)');
            }
        })(sc && sc.parentNode);
    }

    function docPrint() {
        var sc = docContainer ? docContainer.querySelector('.office-doc-scroll') : null;
        if (!sc) return;
        var clone = sc.cloneNode(true);
        var w = clone.querySelector('.docx-wrapper');
        if (w) w.style.zoom = '100%';
        var styles = sc.querySelectorAll('style');
        var css = '';
        styles.forEach(function (st) { css += st.textContent + '\n'; });
        var win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { docShareOpen(); return; }
        win.document.open();
        win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + currentWordName() + '</title>'
            + '<style>body{margin:0;background:#e4e4e4;font-size:0}'
            + 'section.docx{page-break-after:always;box-shadow:none;margin:0 auto}'
            + 'section.docx:last-child{page-break-after:auto}</style>'
            + css + '</head><body>');
        var inner = clone.querySelector('.docx-wrapper');
        if (inner) win.document.write(inner.outerHTML);
        win.document.write('</body></html>');
        win.document.close();
        setTimeout(function () { win.focus(); win.print(); }, 400);
    }

    function currentWordName() {
        return (docContainer && docContainer.dataset && docContainer.dataset.name) || 'document.docx';
    }

    function docBlob() {
        var dataUrl = docContainer && docContainer.dataset ? docContainer.dataset.dataUrl : null;
        if (!dataUrl) return null;
        var parts = String(dataUrl).split(',');
        if (parts.length < 2) return null;
        var mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        var bin = atob(parts[1]);
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return new Blob([out], { type: mime });
    }

    function docShareOpen() {
        var dataUrl = docContainer && docContainer.dataset ? docContainer.dataset.dataUrl : null;
        if (!dataUrl) return;
        window.open(dataUrl, '_blank');
    }

    function docShare() {
        var blob = docBlob();
        if (!blob) { docShareOpen(); return; }
        if (navigator.share) {
            var name = currentWordName();
            navigator.share({ files: [new File([blob], name, { type: blob.type })], title: name }).catch(function () {
                docShareOpen();
            });
        } else {
            docShareOpen();
        }
    }

    function open(dataUrl, fileName, parent, ext) {
        if (!parent) return Promise.reject(new Error('No container'));
        close();
        return loadLibs().then(function () {
            var buffer = dataUrlToArrayBuffer(dataUrl);
            var e = String(ext || '').toLowerCase();
            if (e === 'docx') {
                return renderWordDoc(buffer, parent, dataUrl, fileName || 'document.docx');
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
        docWrap = null;
        docContainer = null;
        docPageCount = 0;
        docCurrentPage = 1;
        docScale = 1;
        docFitMode = 'none';
        docBaseW = 0;
        docBaseH = 0;
    }

    return { open: open, close: close, load: loadLibs };
})();
/* MyPdfViewer - custom PDF viewer built on PDF.js
   Renders each page to canvas, so scrolling, zoom, pages,
   print and share are fully under our control. */
window.MyPdfViewer = (function () {
    let pdfjsPromise = null;
    let pdfDoc = null;
    let pageCount = 0;
    let scale = 1;
    let baseScale = 1;
    let currentPage = 1;
    let fileName = '';
    let container = null;
    let pagesWrap = null;
    let renderTokens = [];
    let fitMode = 'none';
    let wheelAccum = 0;
    let wheelRaf = false;
    const NOTCH = 15;
    const WHEEL_STEP = 0.08;

    function loadPdfJs() {
        if (pdfjsPromise) return pdfjsPromise;
        pdfjsPromise = new Promise(function (resolve, reject) {
            if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
            const s = document.createElement('script');
            s.src = '../script/vendor/pdf.min.js';
            s.onload = function () {
                if (!window.pdfjsLib) { reject(new Error('PDF.js failed to load')); return; }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../script/vendor/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            };
            s.onerror = function () { reject(new Error('Could not load PDF.js')); };
            document.head.appendChild(s);
        });
        return pdfjsPromise;
    }

    function cancelRenders() {
        renderTokens.forEach(function (t) { if (t && t.cancel) t.cancel(); });
        renderTokens = [];
    }

    function base64ToUint8(b64) {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function currentFileName() {
        return fileName || 'document.pdf';
    }

    function buildMarkup() {
        container.innerHTML =
            '<div class="pdfv-toolbar">'
            + '<button type="button" class="pdfv-btn" id="pdfv-prev" title="Previous page"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>'
            + '<input type="number" id="pdfv-page-input" class="pdfv-page-input" min="1" value="1" aria-label="Page">'
            + '<span class="pdfv-page-total" id="pdfv-page-total">/ 1</span>'
            + '<button type="button" class="pdfv-btn" id="pdfv-next" title="Next page"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg></button>'
            + '<span class="pdfv-divider"></span>'
            + '<button type="button" class="pdfv-btn" id="pdfv-zoom-out" title="Zoom out"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg></button>'
            + '<span class="pdfv-zoom-label" id="pdfv-zoom-label">150%</span>'
            + '<button type="button" class="pdfv-btn" id="pdfv-zoom-in" title="Zoom in"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>'
            + '<button type="button" class="pdfv-btn" id="pdfv-fit" title="Fit width"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 4h16v2H4V4zm0 14h16v2H4v-2zm2-8h12v4H6v-4z"/></svg></button>'
            + '<span class="pdfv-divider"></span>'
            + '<button type="button" class="pdfv-btn" id="pdfv-print" title="Print"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg></button>'
            + '<button type="button" class="pdfv-btn" id="pdfv-share" title="Open / share"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM5 5h6v2H5v12h12v-6h2v8H3V5h2z"/></svg></button>'
            + '</div>'
            + '<div class="pdfv-pages"></div>';
        pagesWrap = container.querySelector('.pdfv-pages');
        pagesWrap.addEventListener('wheel', function (e) {
            if (e.ctrlKey || e.metaKey || e.altKey) {
                e.preventDefault();
                if (fitMode !== 'none') { scale = 1; fitMode = 'none'; }
                wheelAccum += e.deltaY;
                let changed = false;
                while (Math.abs(wheelAccum) >= NOTCH) {
                    scale += (wheelAccum > 0 ? -1 : 1) * WHEEL_STEP;
                    wheelAccum -= (wheelAccum > 0 ? NOTCH : -NOTCH);
                    changed = true;
                }
                scale = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale)) * 100) / 100;
                if (changed && !wheelRaf) {
                    wheelRaf = true;
                    requestAnimationFrame(function () {
                        wheelRaf = false;
                        renderAllPages(true);
                        updateUi();
                    });
                }
            }
        }, { passive: false });
        wireToolbar();
    }

    function wireToolbar() {
        const q = container.querySelector.bind(container);
        q('#pdfv-prev').addEventListener('click', function () { goToPage(currentPage - 1); });
        q('#pdfv-next').addEventListener('click', function () { goToPage(currentPage + 1); });
        q('#pdfv-page-input').addEventListener('change', function () {
            const n = parseInt(this.value, 10);
            goToPage(isNaN(n) ? 1 : n);
        });
        q('#pdfv-zoom-in').addEventListener('click', function () { zoomStep(1); });
        q('#pdfv-zoom-out').addEventListener('click', function () { zoomStep(-1); });
        q('#pdfv-fit').addEventListener('click', toggleFit);
        q('#pdfv-print').addEventListener('click', printDoc);
        q('#pdfv-share').addEventListener('click', shareDoc);
        const label = container.querySelector('#pdfv-zoom-label');
        if (label) label.addEventListener('click', function () { setScale(1); });
    }

    const ZOOM_STEP = 0.15;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 3.25;

    function setScale(s) {
        fitMode = 'none';
        scale = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s)) * 100) / 100;
        renderAllPages(true);
        updateUi();
    }

    function zoomStep(dir) {
        if (fitMode !== 'none') {
            scale = 1;
            fitMode = 'none';
        }
        setScale(scale + dir * ZOOM_STEP);
    }

    function zoomBy(mult) {
        fitMode = 'none';
        setScale(scale * mult);
    }

    function innerSize() {
        const cs = getComputedStyle(pagesWrap);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        return {
            w: Math.max(50, pagesWrap.clientWidth - padX),
            h: Math.max(50, pagesWrap.clientHeight - padY)
        };
    }

function visibleDims() {
        const cs = getComputedStyle(pagesWrap);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        return {
            w: Math.max(50, pagesWrap.clientWidth - padX),
            h: Math.max(50, pagesWrap.clientHeight - padY)
        };
    }

    async function toggleFit() {
        const page = await pdfDoc.getPage(1);
        const v1 = page.getViewport({ scale: 1 });
        const dims = visibleDims();
        if (fitMode === 'none' || fitMode === 'height') fitMode = 'width';
        else fitMode = 'height';
        scale = fitMode === 'width'
            ? (v1.width > 0 ? dims.w / v1.width : 1)
            : (v1.height > 0 ? dims.h / v1.height : 1);
        scale = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale)) * 100) / 100;
        renderAllPages(true);
        updateUi();
    }

    function renderAllPages(keepPosition) {
        cancelRenders();
        pagesWrap.innerHTML = '';
        for (let p = 1; p <= pageCount; p++) {
            const holder = document.createElement('div');
            holder.className = 'pdfv-page';
            holder.dataset.page = p;
            const canvas = document.createElement('canvas');
            holder.appendChild(canvas);
            pagesWrap.appendChild(holder);
            renderPage(p, canvas);
        }
        if (keepPosition) {
            const target = pagesWrap.querySelector('[data-page="' + currentPage + '"]');
            if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
    }

    function renderPage(pageNum, canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        pdfDoc.getPage(pageNum).then(function (page) {
            const vp = page.getViewport({ scale: scale });
            const dprVp = page.getViewport({ scale: scale * dpr });
            canvas.width = Math.floor(dprVp.width);
            canvas.height = Math.floor(dprVp.height);
            canvas.style.width = vp.width + 'px';
            canvas.style.height = vp.height + 'px';
            const token = page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: dprVp
            });
            renderTokens.push(token);
            return token.promise;
        }).catch(function () { /* page render cancelled or failed */ });
    }

    function goToPage(n) {
        if (!pdfDoc) return;
        n = Math.max(1, Math.min(pageCount, n));
        currentPage = n;
        updateUi();
        const target = pagesWrap.querySelector('[data-page="' + n + '"]');
        if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function updateUi() {
        const total = container.querySelector('#pdfv-page-total');
        if (total) total.textContent = '/ ' + pageCount;
        const input = container.querySelector('#pdfv-page-input');
        if (input) {
            input.value = currentPage;
            input.style.width = (String(currentPage).length + 1) + 'ch';
        }
        const label = container.querySelector('#pdfv-zoom-label');
        if (label) label.textContent = Math.round(scale * 100) + '%';
        const fit = container.querySelector('#pdfv-fit');
        if (fit) {
            fit.title = fitMode === 'none' ? 'Fit width' : (fitMode === 'width' ? 'Fit height (click to switch)' : 'Fit width (click to switch)');
        }
    }

    function printDoc() {
        if (!pdfDoc) return;
        const canvases = pagesWrap.querySelectorAll('canvas');
        if (!canvases.length) return;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { window.open(container.dataset.dataUrl, '_blank'); return; }
        win.document.open();
        win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + currentFileName() + '</title>'
            + '<style>body{margin:0;background:#fff}'
            + 'img{display:block;width:100%;height:auto;box-sizing:border-box;padding:10px;page-break-after:always;}'
            + 'img:last-child{page-break-after:auto;}</style></head><body>');
        canvases.forEach(function (c) {
            win.document.write('<img src="' + c.toDataURL('image/jpeg', 0.92) + '">');
        });
        win.document.write('</body></html>');
        win.document.close();
        setTimeout(function () { win.focus(); win.print(); }, 400);
    }

    function dataUrlToBlob(dataUrl) {
        const parts = dataUrl.split(',');
        const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/pdf';
        const bin = atob(parts[1]);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return new Blob([out], { type: mime });
    }

    function shareDoc() {
        const dataUrl = container.dataset.dataUrl;
        if (!dataUrl) return;
        if (navigator.share) {
            const file = new File([dataUrlToBlob(dataUrl)], currentFileName(), { type: 'application/pdf' });
            navigator.share({ files: [file], title: currentFileName() }).catch(function () {
                window.open(dataUrl, '_blank');
            });
        } else {
            window.open(dataUrl, '_blank');
        }
    }

    async function open(dataUrl, name, target) {
        container = target;
        container.dataset.dataUrl = dataUrl;
        fileName = name;
        buildMarkup();
        updateUi();
        try {
            const pdfjs = await loadPdfJs();
            const data = await pdfjs.getDocument({ data: base64ToUint8(dataUrl.split(',')[1]) }).promise;
            pdfDoc = data;
            pageCount = data.numPages;
            scale = 1;
            baseScale = 1;
            fitMode = 'none';
            updateUi();
            renderAllPages(true);
        } catch (e) {
            container.innerHTML = '<div class="preview-note">This PDF could not be opened. Use Download or Open in the buttons below.</div>';
        }
    }

    function close() {
        cancelRenders();
        pdfDoc = null;
        container = null;
        pagesWrap = null;
    }

    return { open: open, close: close };
})();

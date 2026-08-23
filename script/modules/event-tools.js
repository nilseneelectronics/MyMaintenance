/* event-tools.js - Tools & Materials lists for the event modal */

(function () {
    const state = { tools: [], materials: [] };

    function els(kind) {
        return {
            input: document.getElementById('ev-' + kind + '-input'),
            add: document.getElementById('ev-' + kind + '-add'),
            list: document.getElementById('ev-' + kind + '-list')
        };
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function rowHtml(text, kind, index) {
        return '<div class="ev-row ev-tool-row" data-kind="' + kind + '" data-index="' + index + '">'
            + '<div class="ev-row-left">'
            + '<span class="ev-cell ev-tool-name">' + escapeHtml(text) + '</span>'
            + '</div>'
            + '<div class="ev-row-right">'
            + '<button type="button" class="ev-tool-remove" title="Remove" aria-label="Remove">'
            + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="16" height="16" fill="currentColor"><path d="M480-424.5 284.19-228.69q-8.92 8.92-21.19 8.61-12.27-.31-21.19-9.23-8.92-8.92-8.92-21.19t8.92-21.19L437.5-480 241.69-675.81q-8.92-8.92-8.61-21.19.31-12.27 9.23-21.19 8.92-8.92 21.19-8.92t21.19 8.92L480-535.5l195.81-195.81q8.92-8.92 21.19-8.92t21.19 8.92q8.92 8.92 8.92 21.19t-8.92 21.19L522.5-480l195.81 195.81q8.92 8.92 8.92 21.19t-8.92 21.19q-8.92 8.92-21.19 8.92t-21.19-8.92L480-424.5Z"/></svg>'
            + '</button>'
            + '</div>'
            + '</div>';
    }

    function render(kind) {
        const el = els(kind);
        if (!el.list) return;
        const items = state[kind];
        if (!items.length) {
            el.list.innerHTML = '<div class="asset-list-empty">No ' + kind + ' added yet.</div>';
            return;
        }
        el.list.innerHTML = items.map(function (t, i) { return rowHtml(t, kind, i); }).join('');
        el.list.querySelectorAll('.ev-tool-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const row = btn.closest('.ev-tool-row');
                if (row) remove(row.dataset.kind, parseInt(row.dataset.index, 10));
            });
        });
    }

    function add(kind) {
        const el = els(kind);
        const value = el.input ? el.input.value.trim() : '';
        if (!value) return;
        state[kind].push(value);
        if (el.input) el.input.value = '';
        render(kind);
        if (el.input) el.input.focus();
    }

    function remove(kind, index) {
        if (index >= 0 && index < state[kind].length) state[kind].splice(index, 1);
        render(kind);
    }

    function reset() {
        state.tools = [];
        state.materials = [];
        render('tools');
        render('materials');
    }

    function setItems(tools, materials) {
        state.tools = Array.isArray(tools) ? tools.slice() : [];
        state.materials = Array.isArray(materials) ? materials.slice() : [];
        render('tools');
        render('materials');
    }

    function getItems() {
        return { tools: state.tools.slice(), materials: state.materials.slice() };
    }

    function init() {
        ['tools', 'materials'].forEach(function (kind) {
            const el = els(kind);
            if (el.input) {
                el.input.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        add(kind);
                    }
                });
            }
            if (el.add) el.add.addEventListener('click', function () { add(kind); });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.MyMaintenanceEventTools = {
        reset: reset,
        setItems: setItems,
        getItems: getItems,
        add: add,
        remove: remove,
        render: render
    };
})();

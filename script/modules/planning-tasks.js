/* planning-tasks.js - open to-do list and completed tasks per signed-in Supabase user */

(function () {
    const TODOS_KEY = 'floorplan_todo_tasks';
    const DONE_KEY = 'floorplan_done_tasks';

    let todosCache = [];
    let doneCache = [];
    let knownTodoIds = new Set();
    let knownDoneIds = new Set();

    function database() { return window.MyMaintenanceData; }
    function pad(n) { return String(n).padStart(2, '0'); }
    function todayKey() {
        const n = new Date();
        return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
    }
    function newId() { return crypto.randomUUID(); }

    function loadTodos() { return todosCache.slice(); }
    function loadDoneTasks() { return doneCache.slice(); }

    function todoRow(t) {
        return { id: t.id || newId(), text: t.text, sort_order: t.sortOrder || 0 };
    }

    function doneRow(t) {
        return {
            id: t.id || newId(),
            text: t.text,
            done_at: t.doneAt || todayKey(),
            asset: t.asset || '',
            equipment: t.equipment || '',
            comments: t.comments || '',
            time: t.time || '',
            cost: t.cost || '',
            photos: Array.isArray(t.photos) ? t.photos : []
        };
    }

    function parsePhotos(value) {
        if (Array.isArray(value)) return value;
        try {
            const parsed = JSON.parse(value || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function saveTodos(todos) {
        todosCache = Array.isArray(todos) ? todos.slice() : [];
        localStorage.setItem(TODOS_KEY, JSON.stringify(todosCache));
        persistTodos(todosCache);
        window.dispatchEvent(new CustomEvent('planningtasks:changed'));
    }

    function saveDoneTasks(done) {
        doneCache = Array.isArray(done) ? done.slice() : [];
        localStorage.setItem(DONE_KEY, JSON.stringify(doneCache));
        persistDoneTasks(doneCache);
        window.dispatchEvent(new CustomEvent('planningdone:changed'));
    }

    async function persistTodos(todos) {
        const db = database();
        if (!db) return;
        const rows = todos.map(todoRow);
        const currentIds = new Set(rows.map(r => r.id));
        try {
            if (rows.length) {
                await db.request('planning_todos', {
                    method: 'POST',
                    query: { on_conflict: 'id' },
                    body: rows,
                    prefer: 'resolution=merge-duplicates,return=representation'
                });
            }
            await Promise.all(Array.from(knownTodoIds).filter(id => !currentIds.has(id))
                .map(id => db.request('planning_todos', { method: 'DELETE', query: { id: `eq.${id}` } })));
            knownTodoIds = currentIds;
        } catch (error) {
            console.error('Could not save to-do list:', error);
        }
    }

    async function persistDoneTasks(done) {
        const db = database();
        if (!db) return;
        const rows = done.map(doneRow);
        const currentIds = new Set(rows.map(r => r.id));
        try {
            if (rows.length) {
                await db.request('planning_done_tasks', {
                    method: 'POST',
                    query: { on_conflict: 'id' },
                    body: rows,
                    prefer: 'resolution=merge-duplicates,return=representation'
                });
            }
            await Promise.all(Array.from(knownDoneIds).filter(id => !currentIds.has(id))
                .map(id => db.request('planning_done_tasks', { method: 'DELETE', query: { id: `eq.${id}` } })));
            knownDoneIds = currentIds;
        } catch (error) {
            console.error('Could not save done tasks:', error);
        }
    }

    async function hydrate() {
        const db = database();
        if (!db) return;
        try {
            const [todoRows, doneRows] = await Promise.all([
                db.request('planning_todos', { query: { select: '*', order: 'created_at.asc' } }),
                db.request('planning_done_tasks', { query: { select: '*', order: 'created_at.asc' } })
            ]);
            todosCache = (todoRows || []).map(r => ({ id: r.id, text: r.text, sortOrder: r.sort_order || 0 }));
            doneCache = (doneRows || []).map(r => ({
                id: r.id,
                text: r.text,
                doneAt: String(r.done_at || '').slice(0, 10),
                asset: r.asset || '',
                equipment: r.equipment || '',
                comments: r.comments || '',
                time: r.time || '',
                cost: r.cost || '',
                photos: parsePhotos(r.photos)
            }));
            knownTodoIds = new Set((todoRows || []).map(r => r.id));
            knownDoneIds = new Set((doneRows || []).map(r => r.id));
            window.dispatchEvent(new CustomEvent('planningtasks:changed'));
            window.dispatchEvent(new CustomEvent('planningdone:changed'));
        } catch (error) {
            console.error('Could not load planning tasks:', error);
            loadLocalFallback();
        }
    }

    function loadLocalFallback() {
        try { todosCache = JSON.parse(localStorage.getItem(TODOS_KEY)) || []; } catch (_) { todosCache = []; }
        try { doneCache = JSON.parse(localStorage.getItem(DONE_KEY)) || []; } catch (_) { doneCache = []; }
        window.dispatchEvent(new CustomEvent('planningtasks:changed'));
        window.dispatchEvent(new CustomEvent('planningdone:changed'));
    }

    document.addEventListener('DOMContentLoaded', hydrate);

    window.MyMaintenancePlanningTasks = {
        TODOS_KEY: TODOS_KEY,
        DONE_KEY: DONE_KEY,
        loadTodos: loadTodos,
        loadDoneTasks: loadDoneTasks,
        saveTodos: saveTodos,
        saveDoneTasks: saveDoneTasks,
        todayKey: todayKey,
        newId: newId,
        hydrate: hydrate
    };
})();
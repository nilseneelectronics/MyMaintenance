(function () {
    const LOCAL_KEY = 'mymaintenance_doc_projects';
    const MIGRATION_PREFIX = 'mymaintenance.projects.migrated.';
    const LOCAL_OWNER_KEY = 'mymaintenance.projects.local-owner';

    function localMap() {
        try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch (_) { return {}; }
    }

    function saveLocalMap(map) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
    }

    function rowsToMap(rows) {
        const map = {};
        (rows || []).forEach(function (row) {
            if (!row.asset || !row.name) return;
            if (!map[row.asset]) map[row.asset] = [];
            if (map[row.asset].indexOf(row.name) === -1) map[row.asset].push(row.name);
        });
        return map;
    }

    async function userKey() {
        return window.MyMaintenanceData && window.MyMaintenanceData.userId
            ? await window.MyMaintenanceData.userId()
            : null;
    }

    async function addLocalProjects(map) {
        const rows = [];
        Object.keys(map).forEach(function (asset) {
            (map[asset] || []).forEach(function (name) {
                if (asset && name) rows.push({ asset: asset, name: name });
            });
        });
        if (!rows.length) return;
        await Promise.all(rows.map(function (row) {
            return window.MyMaintenanceData.request('projects', {
                method: 'POST',
                query: { on_conflict: 'user_id,asset,name' },
                body: row,
                prefer: 'resolution=merge-duplicates,return=minimal'
            });
        }));
    }

    async function hydrate() {
        if (!window.MyMaintenanceData) return localMap();
        try {
            const uid = await userKey();
            if (!uid) return localMap();
            const rows = await window.MyMaintenanceData.request('projects', {
                query: { select: 'asset,name', order: 'created_at.asc' }
            });
            const marker = MIGRATION_PREFIX + uid;
            if (!localStorage.getItem(marker)) {
                const localOwner = localStorage.getItem(LOCAL_OWNER_KEY);
                if (!localOwner || localOwner === uid) await addLocalProjects(localMap());
                localStorage.setItem(marker, '1');
                localStorage.setItem(LOCAL_OWNER_KEY, uid);
                if (Object.keys(localMap()).length) {
                    const merged = await window.MyMaintenanceData.request('projects', {
                        query: { select: 'asset,name', order: 'created_at.asc' }
                    });
                    saveLocalMap(rowsToMap(merged));
                    window.dispatchEvent(new CustomEvent('projects:changed'));
                    return rowsToMap(merged);
                }
            }
            const map = rowsToMap(rows);
            saveLocalMap(map);
            window.dispatchEvent(new CustomEvent('projects:changed'));
            return map;
        } catch (error) {
            console.warn('Could not sync projects:', error);
            return localMap();
        }
    }

    async function add(asset, name) {
        if (!asset || !name || !window.MyMaintenanceData) return;
        try {
            await window.MyMaintenanceData.request('projects', {
                method: 'POST',
                query: { on_conflict: 'user_id,asset,name' },
                body: { asset: asset, name: name },
                prefer: 'resolution=merge-duplicates,return=minimal'
            });
        } catch (error) { console.warn('Could not save project:', error); }
    }

    async function rename(asset, oldName, newName) {
        if (!window.MyMaintenanceData) return;
        try {
            await window.MyMaintenanceData.request('projects', {
                method: 'PATCH',
                query: { asset: 'eq.' + asset, name: 'eq.' + oldName },
                body: { name: newName, updated_at: new Date().toISOString() },
                prefer: 'return=minimal'
            });
        } catch (error) { console.warn('Could not rename project:', error); }
    }

    async function remove(asset, name) {
        if (!window.MyMaintenanceData) return;
        try {
            await window.MyMaintenanceData.request('projects', {
                method: 'DELETE',
                query: { asset: 'eq.' + asset, name: 'eq.' + name }
            });
        } catch (error) { console.warn('Could not delete project:', error); }
    }

    window.MyMaintenanceProjects = { hydrate: hydrate, add: add, rename: rename, remove: remove };
})();

(function () {
    const STORE_KEY = 'floorplan_files';
    const DATA_PREFIX = 'floorplan_data_';
    const MIGRATION_PREFIX = 'mymaintenance.floorplans.migrated.';
    const LOCAL_OWNER_KEY = 'mymaintenance.floorplans.local-owner';

    function localList() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (_) { return []; }
    }

    function saveLocalList(list) {
        localStorage.setItem(STORE_KEY, JSON.stringify(list));
    }

    function localData(id) {
        try { return JSON.parse(localStorage.getItem(DATA_PREFIX + id)); } catch (_) { return null; }
    }

    function writeLocalPlan(plan) {
        localStorage.setItem(DATA_PREFIX + plan.id, JSON.stringify(plan.data || {}));
        const list = localList().filter(function (item) { return item.id !== plan.id; });
        list.unshift({ id: plan.id, name: plan.name || plan.id, preview: plan.preview || '', updatedAt: plan.updatedAt || Date.now(), asset: plan.asset || '' });
        saveLocalList(list);
    }

    function clearLocalPlan(id) {
        localStorage.removeItem(DATA_PREFIX + id);
        saveLocalList(localList().filter(function (item) { return item.id !== id; }));
    }

    function remoteToLocal(row) {
        return { id: row.id, name: row.name || row.id, preview: row.preview || '', updatedAt: row.updated_at || Date.now(), asset: row.asset || '' };
    }

    async function userKey() {
        return window.MyMaintenanceData && window.MyMaintenanceData.userId
            ? await window.MyMaintenanceData.userId()
            : null;
    }

    async function saveRemote(plan) {
        await window.MyMaintenanceData.request('floorplans', {
            method: 'POST',
            query: { on_conflict: 'user_id,id' },
            body: {
                id: plan.id,
                name: plan.name || plan.id,
                asset: plan.asset || '',
                data: plan.data || {},
                preview: plan.preview || '',
                updated_at: new Date(plan.updatedAt || Date.now()).toISOString()
            },
            prefer: 'resolution=merge-duplicates,return=minimal'
        });
    }

    async function hydrate() {
        if (!window.MyMaintenanceData) return localList();
        try {
            const uid = await userKey();
            if (!uid) return localList();
            const rows = await window.MyMaintenanceData.request('floorplans', {
                query: { select: 'id,name,asset,data,preview,updated_at', order: 'updated_at.desc' }
            });
            const marker = MIGRATION_PREFIX + uid;
            if (!localStorage.getItem(marker)) {
                const localOwner = localStorage.getItem(LOCAL_OWNER_KEY);
                if (!localOwner || localOwner === uid) {
                    await Promise.all(localList().map(function (item) {
                        return saveRemote({
                            id: item.id,
                            name: item.name || item.id,
                            asset: item.asset || '',
                            preview: item.preview || '',
                            data: localData(item.id) || {},
                            updatedAt: item.updatedAt
                        });
                    }));
                }
                localStorage.setItem(marker, '1');
                localStorage.setItem(LOCAL_OWNER_KEY, uid);
                if (localList().length) {
                    const merged = await window.MyMaintenanceData.request('floorplans', {
                        query: { select: 'id,name,asset,data,preview,updated_at', order: 'updated_at.desc' }
                    });
                    merged.forEach(function (row) { writeLocalPlan(Object.assign(remoteToLocal(row), { data: row.data || {} })); });
                    saveLocalList(merged.map(remoteToLocal));
                    window.dispatchEvent(new CustomEvent('floorplans:changed'));
                    return merged.map(remoteToLocal);
                }
            }
            rows.forEach(function (row) { writeLocalPlan(Object.assign(remoteToLocal(row), { data: row.data || {} })); });
            saveLocalList(rows.map(remoteToLocal));
            window.dispatchEvent(new CustomEvent('floorplans:changed'));
            return rows.map(remoteToLocal);
        } catch (error) {
            console.warn('Could not sync floor plans:', error);
            return localList();
        }
    }

    async function save(plan) {
        writeLocalPlan(plan);
        if (!window.MyMaintenanceData) return;
        try { await saveRemote(plan); } catch (error) { console.warn('Could not save floor plan:', error); }
        window.dispatchEvent(new CustomEvent('floorplans:changed'));
    }

    async function remove(id) {
        clearLocalPlan(id);
        if (window.MyMaintenanceData) {
            try {
                await window.MyMaintenanceData.request('floorplans', { method: 'DELETE', query: { id: 'eq.' + id } });
            } catch (error) { console.warn('Could not delete floor plan:', error); }
        }
        window.dispatchEvent(new CustomEvent('floorplans:changed'));
    }

    window.MyMaintenanceFloorplans = { hydrate: hydrate, save: save, remove: remove };
})();

(function () {
    function database() { return window.MyMaintenanceData; }

    async function list(assetId, assetType) {
        const rows = await database().request('asset_photos', {
            query: {
                select: 'id,storage_path,caption,created_at',
                asset_id: 'eq.' + assetId,
                asset_type: 'eq.' + assetType,
                order: 'created_at.asc'
            }
        });
        return Promise.all((rows || []).map(async function (row) {
            return {
                id: row.id,
                path: row.storage_path,
                text: row.caption || '',
                src: await database().downloadDataUrl(row.storage_path, 'image/jpeg')
            };
        }));
    }

    async function upload(assetId, assetType, file, caption) {
        const id = crypto.randomUUID();
        const extension = String(file.name || 'jpg').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = (await database().userId()) + '/photos/' + assetType + '/' + assetId + '/' + id + '.' + extension;
        await database().upload(path, file);
        try {
            const rows = await database().request('asset_photos', {
                method: 'POST',
                body: { id: id, asset_id: assetId, asset_type: assetType, storage_path: path, caption: caption || '' },
                prefer: 'return=representation'
            });
            return {
                id: id,
                path: path,
                text: caption || '',
                src: await database().downloadDataUrl(path, file.type || 'image/jpeg'),
                created_at: rows && rows[0] ? rows[0].created_at : new Date().toISOString()
            };
        } catch (error) {
            await database().removeFile(path).catch(function () {});
            throw error;
        }
    }

    async function update(id, caption) {
        await database().request('asset_photos', {
            method: 'PATCH',
            query: { id: 'eq.' + id },
            body: { caption: caption || '' },
            prefer: 'return=minimal'
        });
    }

    async function remove(photo) {
        await database().request('asset_photos', { method: 'DELETE', query: { id: 'eq.' + photo.id } });
        if (photo.path) await database().removeFile(photo.path);
    }

    window.MyMaintenancePhotos = { list: list, upload: upload, update: update, remove: remove };
})();

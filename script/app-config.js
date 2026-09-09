window.MyMaintenanceConfig = {
    authTokenKey: 'mymaintenance.authToken',
    authSessionKey: 'mymaintenance.supabaseSession',
    apiBaseUrl: 'http://localhost:3000',
    // This is intentionally the browser-safe Publishable key. Never place a
    // service_role key or database password in client-side code.
    supabaseUrl: 'https://nrmhojdkoxnlvssdksvf.supabase.co',
    supabasePublishableKey: 'sb_publishable_5MQGhiCb86mGfZkIhVriDw_DiPsFbUP',
    // Optional same-origin backend route. When set, the receipt scanner sends only
    // its proposed store name and the first receipt lines for verification.
    receiptStoreVerificationUrl: '',
    loggedInPages: [
        'dashboard.html',
        'myhomes.html',
        'myneighborhood.html',
        'myvehicles.html',
        'mydocuments.html',
        'myplanning.html',
        'myplanning-calendar.html',
        'myplanning-events.html',
        'myplanning-done.html',
        'mytools.html',
        'mytools 2.html',
        'myprofile.html'
    ],
    publicOnlyPages: ['login.html'],
    knownPageFiles: [
        'index.html',
        'about.html',
        'login.html',
        'dashboard.html',
        'homeowners.html',
        'landlords.html',
        'contractors.html',
        'tools.html',
        'myhomes.html',
        'myneighborhood.html',
        'myvehicles.html',
        'mydocuments.html',
        'myplanning.html',
        'myplanning-calendar.html',
        'myplanning-events.html',
        'myplanning-done.html',
        'mytools.html',
        'mytools 2.html',
        'myprofile.html',
        'tool-floorplan.html',
        'coming-soon.html'
    ]
};

// Small browser client for the protected Supabase REST and Storage APIs.
// It deliberately uses the signed-in user's token: RLS remains the authority.
window.MyMaintenanceData = (function () {
    function config() { return window.MyMaintenanceConfig || {}; }

    async function token() {
        const auth = window.MyMaintenanceAuth;
        if (auth && typeof auth._getSupabaseSession === 'function') {
            const session = await auth._getSupabaseSession();
            if (session?.access_token) return session.access_token;
        }
        return localStorage.getItem(config().authTokenKey || 'mymaintenance.authToken');
    }

    async function headers(extra) {
        const accessToken = await token();
        if (!accessToken) throw new Error('Please sign in again.');
        return Object.assign({
            apikey: config().supabasePublishableKey,
            Authorization: `Bearer ${accessToken}`
        }, extra || {});
    }

    async function request(table, options) {
        options = options || {};
        const params = new URLSearchParams(options.query || {});
        const url = `${config().supabaseUrl}/rest/v1/${table}${params.toString() ? `?${params}` : ''}`;
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: await headers(Object.assign(
                options.body ? { 'Content-Type': 'application/json' } : {},
                options.prefer ? { Prefer: options.prefer } : {},
                options.headers || {}
            )),
            body: options.body == null ? undefined : JSON.stringify(options.body)
        });
        const data = await response.json().catch(function () { return null; });
        if (!response.ok) throw new Error(data?.message || data?.hint || 'Could not save data.');
        return data;
    }

    async function userId() {
        const accessToken = await token();
        try {
            const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return payload.sub || null;
        } catch (_) {
            return null;
        }
    }

    function fileMime(file) {
        const browserType = String(file && file.type || '').toLowerCase();
        if (browserType && browserType !== 'application/octet-stream') return browserType;
        const extension = String(file && file.name || '').split('.').pop().toLowerCase();
        const types = { stl: 'model/stl', '3mf': 'model/3mf', sla: 'application/sla' };
        return types[extension] || browserType || 'application/octet-stream';
    }

    async function upload(path, file) {
        const response = await fetch(`${config().supabaseUrl}/storage/v1/object/documents/${path}`, {
            method: 'POST',
            headers: await headers({
                'Content-Type': fileMime(file),
                'x-upsert': 'false'
            }),
            body: file
        });
        const data = await response.json().catch(function () { return null; });
        if (!response.ok) throw new Error(data?.message || data?.error || `Could not upload file (${response.status}).`);
        return data;
    }

    async function downloadDataUrl(path, fallbackType) {
        const response = await fetch(`${config().supabaseUrl}/storage/v1/object/documents/${path}`, {
            headers: await headers()
        });
        if (!response.ok) throw new Error('Could not download file.');
        const blob = await response.blob();
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(new Blob([blob], { type: blob.type || fallbackType || 'application/octet-stream' }));
        });
    }

    async function removeFile(path) {
        return requestStorageDelete(path);
    }

    async function requestStorageDelete(path) {
        const response = await fetch(`${config().supabaseUrl}/storage/v1/object/documents`, {
            method: 'DELETE',
            headers: await headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ prefixes: [path] })
        });
        if (!response.ok) throw new Error('Could not delete file.');
    }

    return { request: request, userId: userId, fileMime: fileMime, upload: upload, downloadDataUrl: downloadDataUrl, removeFile: removeFile };
})();

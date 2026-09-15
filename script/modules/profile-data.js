/* profile-data.js - Profile, family, access, notifications and password storage */

window.MyMaintenanceProfileData = (function () {
    var PROFILE_KEY = 'mymaintenance_profile';
    var FAMILY_KEY = 'mymaintenance_family';
    var NOTIF_KEY = 'mymaintenance_notifications';
    var USER_KEY = 'mymaintenance_user';
    var PASSWORD_KEY = 'mymaintenance_password';
    var syncTimer = null;
    var familyLoadError = '';

    var ACCESS_AREAS = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'homes', label: 'My Homes' },
        { key: 'neighborhood', label: 'MyNeighborhood', invitation: true },
        { key: 'vehicles', label: 'My Vehicles' },
        { key: 'documents', label: 'My Documents' },
        { key: 'planning', label: 'My Planning' },
        { key: 'tools', label: 'My Tools' },
        { key: 'subscription', label: 'Subscription' }
    ];

    var NOTIF_CHANNELS = [
        { key: 'push', label: 'Push notifications' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone (SMS)' }
    ];

    var NOTIF_TYPES = [
        { key: 'calendar', label: 'Calendar' },
        { key: 'maintenance', label: 'Maintenance' },
        { key: 'documents', label: 'Document changes' },
        { key: 'invitations', label: 'Invitations' },
        { key: 'todo', label: 'To-do list' }
    ];

    function defaultProfile() {
        return { name: '', email: '', phone: '', address: '', zip: '', city: '', avatar: '' };
    }

    function presetAccess(role) {
        var member = { dashboard: true, homes: true, neighborhood: false, vehicles: true, documents: true, planning: true, tools: false, subscription: false };
        if (role === 'Owner') return { dashboard: true, homes: true, neighborhood: true, vehicles: true, documents: true, planning: true, tools: true, subscription: true };
        if (role === 'Viewer') return { dashboard: true, homes: true, neighborhood: false, vehicles: true, documents: true, planning: false, tools: false, subscription: false };
        return member;
    }

    function defaultFamily() {
        return [];
    }

    function defaultNotifications() {
        return {
            channels: { push: true, email: true, phone: false },
            types: { calendar: true, maintenance: true, documents: true, invitations: true, todo: true }
        };
    }

    function load(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw !== null && raw !== '') return JSON.parse(raw);
        } catch (_) {}
        var seed = fallback();
        try { localStorage.setItem(key, JSON.stringify(seed)); } catch (_) {}
        return seed;
    }

    function getProfile() {
        var profile = load(PROFILE_KEY, defaultProfile);
        if (profile && profile.email === 'john.doe@example.com') {
            profile = defaultProfile();
            saveProfile(profile);
        }
        return profile;
    }

    function saveProfile(profile, waitForCloud) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile || {}));
        if (waitForCloud) {
            clearTimeout(syncTimer);
            return syncCloud();
        }
        queueCloudSync();
    }

    function getFamily() {
        var family = load(FAMILY_KEY, defaultFamily);
        return Array.isArray(family) ? family : [];
    }

    function saveFamily(family) {
        localStorage.setItem(FAMILY_KEY, JSON.stringify(family || []));
    }

    function getNotifications() {
        var raw = null;
        try { raw = localStorage.getItem(NOTIF_KEY); } catch (_) {}
        if (raw === null || raw === '') {
            var seed = defaultNotifications();
            try { localStorage.setItem(NOTIF_KEY, JSON.stringify(seed)); } catch (_) {}
            return seed;
        }
        try {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.channels && parsed.types) return parsed;
        } catch (_) {}
        var fresh = defaultNotifications();
        try { localStorage.setItem(NOTIF_KEY, JSON.stringify(fresh)); } catch (_) {}
        return fresh;
    }

    function saveNotifications(notifications) {
        localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications || {}));
        queueCloudSync();
    }

    function sessionEmail() {
        try {
            var session = JSON.parse(localStorage.getItem('mymaintenance.supabaseSession') || 'null');
            return session && session.user && session.user.email ? session.user.email : '';
        } catch (_) { return ''; }
    }

    function sameEmail(left, right) {
        return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
    }

    async function syncCloud() {
        var db = window.MyMaintenanceData;
        if (!db) throw new Error('Profile database is unavailable.');
        try {
            var userId = await db.userId();
            if (!userId) throw new Error('Please sign in again.');
            var profile = getProfile();
            var notifications = getNotifications();
            await db.request('profiles', {
                method: 'POST',
                body: {
                    id: userId,
                    display_name: profile.name || null,
                    details: { profile: profile, notifications: notifications }
                },
                prefer: 'resolution=merge-duplicates,return=minimal'
            });
        } catch (error) {
            console.error('Could not save profile:', error);
            throw error;
        }
    }

    function queueCloudSync() {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () { syncCloud().catch(function () {}); }, 80);
    }

    async function hydrateFamily() {
        try {
            var result = await window.MyMaintenanceAuth.familyRequest('list');
            if (!Array.isArray(result.members)) throw new Error('Invalid family list response.');
            // Memberships in the database replace obsolete cached invitations.
            saveFamily(result.members);
            familyLoadError = '';
            window.dispatchEvent(new CustomEvent('profile:changed'));
            return true;
        } catch (error) {
            familyLoadError = 'Could not load family members. ' +
                (error.message || 'Close and reopen to retry.');
            console.warn('Could not refresh family members:', error.message);
            window.dispatchEvent(new CustomEvent('profile:changed'));
            return false;
        }
    }

    async function hydrate() {
        var db = window.MyMaintenanceData;
        if (!db) return;
        try {
            var userId = await db.userId();
            if (!userId) return;
            var rows = await db.request('profiles', {
                query: { select: 'id,display_name,details', id: 'eq.' + userId }
            });
            var row = rows && rows[0];
            var localProfile = getProfile();
            var cloudProfile = row && row.details && row.details.profile;
            var authenticatedEmail = sessionEmail();
            var belongsToUser = localProfile.id === userId ||
                (!localProfile.id && authenticatedEmail && sameEmail(localProfile.email, authenticatedEmail));
            var nextProfile = Object.assign(defaultProfile(), belongsToUser ? localProfile : {}, cloudProfile || {});
            nextProfile.id = userId;
            nextProfile.name = (row && row.display_name) || nextProfile.name || '';
            // Auth owns account identity. Never copy an email cached by another
            // account in the same browser into this user's profile row.
            nextProfile.email = authenticatedEmail || nextProfile.email || '';
            localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
            if (row && authenticatedEmail && !sameEmail(cloudProfile && cloudProfile.email, authenticatedEmail)) {
                queueCloudSync();
            }

            var cloudNotifications = row && row.details && row.details.notifications;
            if (cloudNotifications && cloudNotifications.channels && cloudNotifications.types) {
                localStorage.setItem(NOTIF_KEY, JSON.stringify(cloudNotifications));
            }
            window.dispatchEvent(new CustomEvent('profile:changed'));
            await hydrateFamily();
            if (!row) queueCloudSync();
        } catch (error) {
            console.error('Could not load profile:', error);
        }
    }

    function getUser() {
        var p = getProfile();
        return load(USER_KEY, function () { return { name: p.name, email: p.email, role: 'Owner' }; });
    }

    function saveUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    }

    function hasPassword() {
        return !!localStorage.getItem(PASSWORD_KEY);
    }

    function encode(realm, value) {
        return btoa(unescape(encodeURIComponent(realm + ':' + value)));
    }

    function setPassword(value) {
        localStorage.setItem(PASSWORD_KEY, encode('mymaintenance', value));
    }

    function verifyPassword(value) {
        return hasPassword() && localStorage.getItem(PASSWORD_KEY) === encode('mymaintenance', value);
    }

    return {
        PROFILE_KEY: PROFILE_KEY,
        FAMILY_KEY: FAMILY_KEY,
        NOTIF_KEY: NOTIF_KEY,
        USER_KEY: USER_KEY,
        PASSWORD_KEY: PASSWORD_KEY,
        ACCESS_AREAS: ACCESS_AREAS,
        NOTIF_CHANNELS: NOTIF_CHANNELS,
        NOTIF_TYPES: NOTIF_TYPES,
        presetAccess: presetAccess,
        getProfile: getProfile,
        saveProfile: saveProfile,
        getFamily: getFamily,
        saveFamily: saveFamily,
        getNotifications: getNotifications,
        saveNotifications: saveNotifications,
        hydrate: hydrate,
        hydrateFamily: hydrateFamily,
        getFamilyLoadError: function () { return familyLoadError; },
        getUser: getUser,
        saveUser: saveUser,
        hasPassword: hasPassword,
        setPassword: setPassword,
        verifyPassword: verifyPassword
    };
})();

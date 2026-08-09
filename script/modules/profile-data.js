/* profile-data.js - Profile, family, access, notifications and password storage */

window.MyMaintenanceProfileData = (function () {
    var PROFILE_KEY = 'mymaintenance_profile';
    var FAMILY_KEY = 'mymaintenance_family';
    var NOTIF_KEY = 'mymaintenance_notifications';
    var USER_KEY = 'mymaintenance_user';
    var PASSWORD_KEY = 'mymaintenance_password';

    var ACCESS_AREAS = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'homes', label: 'My Homes' },
        { key: 'vehicles', label: 'My Vehicles' },
        { key: 'documents', label: 'My Documents' },
        { key: 'planning', label: 'My Planning' },
        { key: 'tools', label: 'My Tools' },
        { key: 'subscription', label: 'Subscription' }
    ];

    var NOTIF_TYPES = [
        { key: 'plannedMaintenance', label: 'Planned maintenance events' },
        { key: 'maintenanceAlerts', label: 'Maintenance alerts and deadlines' },
        { key: 'documents', label: 'Document changes' },
        { key: 'familyInvites', label: 'Family invitations' },
        { key: 'messages', label: 'Messages from your family' },
        { key: 'reminders', label: 'Seasonal reminders' }
    ];

    function defaultProfile() {
        return {
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '+47 123 45 678',
            address: 'Street 123',
            zip: '5000',
            city: 'City',
            avatar: ''
        };
    }

    function presetAccess(role) {
        var member = { dashboard: true, homes: true, vehicles: true, documents: true, planning: true, tools: false, subscription: false };
        if (role === 'Owner') return { dashboard: true, homes: true, vehicles: true, documents: true, planning: true, tools: true, subscription: true };
        if (role === 'Viewer') return { dashboard: true, homes: true, vehicles: true, documents: true, planning: false, tools: false, subscription: false };
        return member;
    }

    function defaultFamily() {
        var p = defaultProfile();
        return [
            { id: 'fam_owner', name: p.name, email: p.email, role: 'Owner', status: 'active', access: presetAccess('Owner') },
            { id: 'fam_1', name: 'Jane Doe', email: 'jane.doe@example.com', role: 'Member', status: 'active', access: presetAccess('Member') },
            { id: 'fam_2', name: 'Alex Doe', email: 'alex.doe@example.com', role: 'Viewer', status: 'invited', access: presetAccess('Viewer') }
        ];
    }

    function defaultNotifications() {
        return {
            plannedMaintenance: true,
            maintenanceAlerts: true,
            documents: true,
            familyInvites: true,
            messages: false,
            reminders: true
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
        return load(PROFILE_KEY, defaultProfile);
    }

    function saveProfile(profile) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile || {}));
    }

    function getFamily() {
        return load(FAMILY_KEY, defaultFamily);
    }

    function saveFamily(family) {
        localStorage.setItem(FAMILY_KEY, JSON.stringify(family || []));
    }

    function getNotifications() {
        return load(NOTIF_KEY, defaultNotifications);
    }

    function saveNotifications(notifications) {
        localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications || {}));
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
        NOTIF_TYPES: NOTIF_TYPES,
        presetAccess: presetAccess,
        getProfile: getProfile,
        saveProfile: saveProfile,
        getFamily: getFamily,
        saveFamily: saveFamily,
        getNotifications: getNotifications,
        saveNotifications: saveNotifications,
        getUser: getUser,
        saveUser: saveUser,
        hasPassword: hasPassword,
        setPassword: setPassword,
        verifyPassword: verifyPassword
    };
})();
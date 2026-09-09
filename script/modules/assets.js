/* assets.js - homes and vehicles stored per signed-in Supabase user */

(function () {
    const HOMES_KEY = 'mymaintenance_homes';
    const VEHICLES_KEY = 'mymaintenance_vehicles';
    let homesCache = [];
    let vehiclesCache = [];

    function loadHomes() { return homesCache.slice(); }

    function loadVehicles() {
        return vehiclesCache.slice().map(function (v) {
            if (v.distance == null && v.engineHours != null) v.distance = v.engineHours;
            delete v.engineHours;
            return v;
        });
    }

    function saveHomes(homes) {
        homesCache = Array.isArray(homes) ? homes.slice() : [];
        refreshAssetMenus();
        window.dispatchEvent(new CustomEvent('assets:changed'));
    }

    function saveVehicles(vehicles) {
        vehiclesCache = Array.isArray(vehicles) ? vehicles.slice() : [];
        refreshAssetMenus();
        window.dispatchEvent(new CustomEvent('assets:changed'));
    }

    function getHomes() { return loadHomes(); }
    function getVehicles() { return loadVehicles(); }

    function homeLabel(h) {
        const parts = [];
        if (h.name) parts.push(h.name);
        if (h.address) parts.push(h.address);
        const city = [];
        if (h.zip) city.push(h.zip);
        if (h.city) city.push(h.city);
        if (city.length) parts.push(city.join(' '));
        return parts.join(', ');
    }

    function vehicleLabel(v) {
        const parts = [];
        if (v.name) parts.push(v.name);
        if (v.make && v.model) parts.push(v.make + ' ' + v.model);
        else if (v.make) parts.push(v.make);
        else if (v.model) parts.push(v.model);
        return parts.join(' - ');
    }

    function newId() { return crypto.randomUUID(); }
    function database() { return window.MyMaintenanceData; }

    function asHome(row) {
        return Object.assign({ id: row.id, name: row.name, address: row.address || '' }, row.details || {});
    }

    function asVehicle(row) {
        return Object.assign({ id: row.id, name: row.name, registration: row.registration_number || '' }, row.details || {});
    }

    function persistHome(home, updating) {
        const db = database();
        if (!db) return;
        const details = Object.assign({}, home);
        delete details.id;
        db.request('homes', {
            method: updating ? 'PATCH' : 'POST',
            query: updating ? { id: `eq.${home.id}` } : undefined,
            body: { id: home.id, name: home.name, address: home.address || '', details: details },
            prefer: 'return=representation'
        }).catch(function (error) { console.error('Could not save home:', error); });
    }

    function persistVehicle(vehicle, updating) {
        const db = database();
        if (!db) return;
        const details = Object.assign({}, vehicle);
        delete details.id;
        db.request('vehicles', {
            method: updating ? 'PATCH' : 'POST',
            query: updating ? { id: `eq.${vehicle.id}` } : undefined,
            body: { id: vehicle.id, name: vehicle.name, registration_number: vehicle.registration || '', details: details },
            prefer: 'return=representation'
        }).catch(function (error) { console.error('Could not save vehicle:', error); });
    }

    function persistDelete(table, id) {
        const db = database();
        if (!db) return;
        db.request(table, { method: 'DELETE', query: { id: `eq.${id}` } })
            .catch(function (error) { console.error(`Could not delete ${table}:`, error); });
    }

    function refreshAssetMenus() {
        document.querySelectorAll('#doc-asset-menu, #done-asset-menu, #ev-asset-menu').forEach(function (menu) {
            const fragment = document.createDocumentFragment();
            function addGroup(label, records, labelFor) {
                if (!records.length) return;
                const group = document.createElement('li');
                group.className = 'asset-optgroup';
                group.textContent = label;
                fragment.appendChild(group);
                records.forEach(function (record) {
                    const item = document.createElement('li');
                    const button = document.createElement('button');
                    const value = labelFor(record);
                    button.type = 'button';
                    button.dataset.value = value;
                    button.textContent = value;
                    item.appendChild(button);
                    fragment.appendChild(item);
                });
            }
            addGroup('Addresses', homesCache, homeLabel);
            addGroup('Vehicles', vehiclesCache, vehicleLabel);
            const divider = document.createElement('li');
            divider.className = 'asset-optgroup';
            fragment.appendChild(divider);
            const other = document.createElement('li');
            other.innerHTML = '<button type="button" data-value="__other__">Other</button>';
            fragment.appendChild(other);
            menu.replaceChildren(fragment);
        });
    }

    function addHome(home) {
        const h = Object.assign({ id: newId() }, home);
        saveHomes(loadHomes().concat(h));
        persistHome(h, false);
        return h;
    }

    function updateHome(id, fields) {
        const homes = loadHomes();
        const idx = homes.findIndex(function (h) { return h.id === id; });
        if (idx === -1) return null;
        homes[idx] = Object.assign({}, homes[idx], fields);
        saveHomes(homes);
        persistHome(homes[idx], true);
        return homes[idx];
    }

    function deleteHome(id) {
        saveHomes(loadHomes().filter(function (h) { return h.id !== id; }));
        persistDelete('homes', id);
    }

    function addVehicle(vehicle) {
        const v = Object.assign({ id: newId() }, vehicle);
        saveVehicles(loadVehicles().concat(v));
        persistVehicle(v, false);
        return v;
    }

    function updateVehicle(id, fields) {
        const vehicles = loadVehicles();
        const idx = vehicles.findIndex(function (v) { return v.id === id; });
        if (idx === -1) return null;
        vehicles[idx] = Object.assign({}, vehicles[idx], fields);
        saveVehicles(vehicles);
        persistVehicle(vehicles[idx], true);
        return vehicles[idx];
    }

    function deleteVehicle(id) {
        saveVehicles(loadVehicles().filter(function (v) { return v.id !== id; }));
        persistDelete('vehicles', id);
    }

    async function hydrate() {
        const db = database();
        if (!db) return;
        refreshAssetMenus();
        try {
            const rows = await Promise.all([
                db.request('homes', { query: { select: '*', order: 'created_at.asc' } }),
                db.request('vehicles', { query: { select: '*', order: 'created_at.asc' } })
            ]);
            homesCache = (rows[0] || []).map(asHome);
            vehiclesCache = (rows[1] || []).map(asVehicle);
            refreshAssetMenus();
            window.dispatchEvent(new CustomEvent('assets:changed'));
        } catch (error) {
            console.error('Could not load saved assets:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', hydrate);

    window.MyMaintenanceAssets = {
        HOMES_KEY: HOMES_KEY,
        VEHICLES_KEY: VEHICLES_KEY,
        loadHomes: loadHomes,
        loadVehicles: loadVehicles,
        saveHomes: saveHomes,
        saveVehicles: saveVehicles,
        getHomes: getHomes,
        getVehicles: getVehicles,
        homeLabel: homeLabel,
        vehicleLabel: vehicleLabel,
        addHome: addHome,
        updateHome: updateHome,
        deleteHome: deleteHome,
        addVehicle: addVehicle,
        updateVehicle: updateVehicle,
        deleteVehicle: deleteVehicle,
        refreshAssetMenus: refreshAssetMenus,
        hydrate: hydrate
    };
})();

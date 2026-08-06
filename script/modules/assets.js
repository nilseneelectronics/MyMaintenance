/* assets.js - Registered homes / vehicles storage */

(function () {
    const HOMES_KEY = 'mymaintenance_homes';
    const VEHICLES_KEY = 'mymaintenance_vehicles';

    function defaultHomes() {
        return [
            {
                id: 'home_1',
                name: 'Address 1',
                country: 'Norway',
                address: 'Street 123',
                zip: '5000',
                city: 'City',
                buildYear: '1998',
                houseType: 'House',
                houseTypeComment: '',
                floors: '2',
                internalSize: '180',
                externalSize: '220'
            },
            {
                id: 'home_2',
                name: 'Address 2 - Cabin',
                country: 'Norway',
                address: 'Mountain Road 45',
                zip: '6000',
                city: 'City',
                buildYear: '2005',
                houseType: 'Cabin',
                houseTypeComment: '',
                floors: '1',
                internalSize: '60',
                externalSize: '90'
            }
        ];
    }

    function defaultVehicles() {
        return [
            { id: 'vehicle_1', name: 'Car 1', type: 'Car', typeComment: '', registration: 'AB12345', make: 'Tesla', model: 'Model Y', year: '2021', distance: '15000', vin: '5YJY3EEB7MF123456', fuel: 'Electric' },
            { id: 'vehicle_2', name: 'Car 2', type: 'Car', typeComment: '', registration: 'CD67890', make: 'Volvo', model: 'XC90', year: '2019', distance: '185000', vin: 'YV4A22PK3K1234567', fuel: 'Diesel' },
            { id: 'vehicle_3', name: 'Boat', type: 'Boat', typeComment: '', registration: '', make: 'Bayliner', model: '255', year: '2015', distance: '450', fuel: 'Petrol' }
        ];
    }

    function load(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null) return JSON.parse(raw);
        } catch (_) {}
        const seed = fallback();
        try { localStorage.setItem(key, JSON.stringify(seed)); } catch (_) {}
        return seed;
    }

    function loadHomes() {
        return load(HOMES_KEY, defaultHomes);
    }

    function loadVehicles() {
        return load(VEHICLES_KEY, defaultVehicles).map(function (v) {
            if (v.distance == null && v.engineHours != null) {
                v.distance = v.engineHours;
            }
            delete v.engineHours;
            return v;
        });
    }

    function saveHomes(homes) {
        localStorage.setItem(HOMES_KEY, JSON.stringify(homes));
        window.dispatchEvent(new CustomEvent('assets:changed'));
    }

    function saveVehicles(vehicles) {
        localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
        window.dispatchEvent(new CustomEvent('assets:changed'));
    }

    function getHomes() {
        return loadHomes();
    }

    function getVehicles() {
        return loadVehicles();
    }

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

    function addHome(home) {
        const homes = loadHomes();
        const h = Object.assign({ id: 'home_' + Date.now() }, home);
        homes.push(h);
        saveHomes(homes);
        return h;
    }

    function updateHome(id, fields) {
        const homes = loadHomes();
        const idx = homes.findIndex(function (h) { return h.id === id; });
        if (idx === -1) return null;
        homes[idx] = Object.assign({}, homes[idx], fields);
        saveHomes(homes);
        return homes[idx];
    }

    function deleteHome(id) {
        const homes = loadHomes().filter(function (h) { return h.id !== id; });
        saveHomes(homes);
    }

    function addVehicle(vehicle) {
        const vehicles = loadVehicles();
        const v = Object.assign({ id: 'vehicle_' + Date.now() }, vehicle);
        vehicles.push(v);
        saveVehicles(vehicles);
        return v;
    }

    function updateVehicle(id, fields) {
        const vehicles = loadVehicles();
        const idx = vehicles.findIndex(function (v) { return v.id === id; });
        if (idx === -1) return null;
        vehicles[idx] = Object.assign({}, vehicles[idx], fields);
        saveVehicles(vehicles);
        return vehicles[idx];
    }

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
        updateVehicle: updateVehicle
    };
})();

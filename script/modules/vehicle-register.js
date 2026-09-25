/* vehicle-register.js - Shared "Register a vehicle" popup */

(function () {
    const TYPE_EXAMPLES = {
        Car: { name: 'e.g. My Car', registration: 'e.g. AB12345', make: 'e.g. Tesla', model: 'e.g. Model Y', meter: 'e.g. 15000', fuel: 'e.g. Electric' },
        Truck: { name: 'e.g. My Truck', registration: 'e.g. AB12345', make: 'e.g. Scania', model: 'e.g. R 500', meter: 'e.g. 85000', fuel: 'e.g. Diesel' },
        Trailer: { name: 'e.g. My Trailer', registration: 'e.g. AB1234', make: 'e.g. Brenderup', model: 'e.g. 1205S', meter: 'e.g. 5000', fuel: 'Not applicable' },
        Scooter: { name: 'e.g. My Scooter', registration: 'e.g. AB12345', make: 'e.g. Vespa', model: 'e.g. Primavera', meter: 'e.g. 3200', fuel: 'e.g. Petrol' },
        Bike: { name: 'e.g. My Bike', registration: 'Optional', make: 'e.g. Trek', model: 'e.g. Domane', meter: 'e.g. 1200', fuel: 'e.g. Human powered' },
        Boat: { name: 'e.g. My Boat', registration: 'e.g. NOR-123', make: 'e.g. Bayliner', model: 'e.g. VR5', meter: 'e.g. 250', fuel: 'e.g. Petrol' },
        Other: { name: 'e.g. My Vehicle', registration: 'Registration number', make: 'Manufacturer', model: 'Model', meter: 'Distance or hours', fuel: 'Fuel or power type' }
    };
    const PLATE_COUNTRIES = {
        NO: { placeholder: 'AB 12345', format: 'AB 12345 or AB 1234', pattern: /^[A-Z]{2}\s?\d{4,5}$/ },
        SE: { placeholder: 'ABC 123', format: 'ABC 123 or ABC 12A', pattern: /^[A-Z]{3}\s?(?:\d{3}|\d{2}[A-Z])$/ },
        DK: { placeholder: 'AB 12 345', format: 'AB 12 345', pattern: /^[A-Z]{2}\s?\d{2}\s?\d{3}$/ },
        FI: { placeholder: 'ABC-123', format: 'AB-1 to ABC-123', pattern: /^[A-Z]{2,3}[- ]?\d{1,3}$/ },
        IS: { placeholder: 'AB 123', format: 'AB 123 or ABC 12', pattern: /^[A-Z]{2,3}\s?\d{2,3}$/ },
        DE: { placeholder: 'B AB 1234', format: 'B AB 1234, optional E/H suffix', pattern: /^[A-ZÄÖÜ]{1,3}[- ]?[A-Z]{1,2}[- ]?\d{1,4}[EH]?$/ },
        GB: { placeholder: 'AB12 CDE', format: 'AB12 CDE', pattern: /^[A-Z]{2}\d{2}\s?[A-Z]{3}$/ },
        OTHER: { placeholder: 'Registration plate', format: '2–12 letters, numbers, spaces or hyphens', pattern: /^[A-Z0-9][A-Z0-9 -]{0,10}[A-Z0-9]$/ }
    };

    function plateValid(country, plate, type) {
        if (!plate || type === 'Boat') return true;
        const config = PLATE_COUNTRIES[country] || PLATE_COUNTRIES.OTHER;
        return config.pattern.test(String(plate).trim().toUpperCase());
    }

    window.MyMaintenanceVehiclePlates = { countries: PLATE_COUNTRIES, isValid: plateValid };

    function flagSvg(country) {
        const flags = {
            NO: '<rect width="28" height="18" fill="#ba0c2f"/><path d="M0 7h28v4H0zM8 0h4v18H8z" fill="#fff"/><path d="M0 8h28v2H0zM9 0h2v18H9z" fill="#00205b"/>',
            SE: '<rect width="28" height="18" fill="#006aa7"/><path d="M0 7h28v4H0zM8 0h4v18H8z" fill="#fecc00"/>',
            DK: '<rect width="28" height="18" fill="#c8102e"/><path d="M0 7h28v3H0zM9 0h3v18H9z" fill="#fff"/>',
            FI: '<rect width="28" height="18" fill="#fff"/><path d="M0 7h28v4H0zM8 0h4v18H8z" fill="#003580"/>',
            IS: '<rect width="28" height="18" fill="#02529c"/><path d="M0 6h28v6H0zM7 0h6v18H7z" fill="#fff"/><path d="M0 8h28v2H0zM9 0h2v18H9z" fill="#dc1e35"/>',
            DE: '<rect width="28" height="6" fill="#000"/><rect y="6" width="28" height="6" fill="#dd0000"/><rect y="12" width="28" height="6" fill="#ffce00"/>',
            GB: '<rect width="28" height="18" fill="#012169"/><path d="M0 0l28 18M28 0L0 18" stroke="#fff" stroke-width="5"/><path d="M0 0l28 18M28 0L0 18" stroke="#c8102e" stroke-width="2"/><path d="M14 0v18M0 9h28" stroke="#fff" stroke-width="6"/><path d="M14 0v18M0 9h28" stroke="#c8102e" stroke-width="3"/>',
            OTHER: '<rect width="28" height="18" fill="#20b2aa"/><circle cx="14" cy="9" r="6" fill="none" stroke="#fff"/><path d="M8 9h12M14 3c3 3 3 9 0 12M14 3c-3 3-3 9 0 12" stroke="#fff" fill="none"/>'
        };
        return '<span class="vehicle-country-flag"><svg viewBox="0 0 28 18" aria-hidden="true">' + flags[country] + '</svg></span>';
    }

    function countryHtml(country) {
        return flagSvg(country) + '<span>' + (country === 'OTHER' ? 'Other' : country) + '</span>';
    }

    function init() {
        const popup = document.getElementById('register-vehicle-popup');
        if (!popup) return;

        const inputs = {
            name: document.getElementById('rv-name'),
            registration: document.getElementById('rv-registration'),
            vin: document.getElementById('rv-vin'),
            make: document.getElementById('rv-make'),
            model: document.getElementById('rv-model'),
            year: document.getElementById('rv-year'),
            meter: document.getElementById('rv-meter'),
            fuel: document.getElementById('rv-fuel'),
            otherType: document.getElementById('rv-type-other')
        };
        const registrationCountry = document.getElementById('rv-registration-country');
        const registrationCountryToggle = document.getElementById('rv-registration-country-toggle');
        const registrationCountryValue = document.getElementById('rv-registration-country-value');
        const registrationCountryMenu = document.getElementById('rv-registration-country-menu');
        const registrationFormat = document.getElementById('rv-registration-format');
        const typeDropdown = document.getElementById('rv-type-dropdown');
        const typeToggle = document.getElementById('rv-type-toggle');
        const typeValue = document.getElementById('rv-type-value');
        const typeMenu = document.getElementById('rv-type-menu');
        const cancel = document.getElementById('rv-cancel');
        const confirmBtn = document.getElementById('rv-confirm');
        const titleEl = document.getElementById('rv-title');

        let vehicleType = '';
        let selectedRegistrationCountry = 'NO';
        let editingId = null;
        let initialState = '';

        function stateSnapshot() {
            return JSON.stringify({
                values: Object.keys(inputs).map(function (key) { return inputs[key] ? inputs[key].value : ''; }),
                country: selectedRegistrationCountry,
                type: vehicleType
            });
        }

        function hasText() {
            return Object.keys(inputs).some(function (key) {
                return inputs[key] && String(inputs[key].value || '').trim() !== '';
            });
        }

        function setInvalid(el, invalid) {
            if (!el) return;
            el.classList.toggle('invalid', invalid);
        }

        function valueOf(id) {
            const el = document.getElementById(id);
            return el ? String(el.value || '').trim() : '';
        }

        function reset() {
            ['rv-name', 'rv-registration', 'rv-vin', 'rv-make', 'rv-model', 'rv-year', 'rv-meter', 'rv-fuel', 'rv-type-other'].forEach(function (id) {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                    el.classList.remove('invalid');
                }
            });
            vehicleType = '';
            editingId = null;
            setRegistrationCountry('NO');
            if (titleEl) titleEl.textContent = 'Register a vehicle';
            if (confirmBtn) confirmBtn.textContent = 'Confirm';
            if (typeValue) typeValue.textContent = '-- Select --';
            if (typeMenu) typeMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
            if (inputs.otherType) inputs.otherType.style.display = 'none';
            if (typeDropdown) typeDropdown.classList.remove('open');
            updateTypeFields();
        }

        function updateTypeFields() {
            updateRegistrationLabel();
            updateMeterLabel();
            updateVinVisibility();
            updateExamples();
            updateRegistrationGuide();
        }

        function updateExamples() {
            const examples = TYPE_EXAMPLES[vehicleType] || TYPE_EXAMPLES.Other;
            Object.keys(examples).forEach(function (key) {
                if (inputs[key]) inputs[key].placeholder = examples[key];
            });
        }

        function updateRegistrationGuide() {
            const country = selectedRegistrationCountry;
            const config = PLATE_COUNTRIES[country] || PLATE_COUNTRIES.OTHER;
            if (inputs.registration) inputs.registration.placeholder = vehicleType === 'Boat' ? 'e.g. NOR-123' : config.placeholder;
            if (registrationFormat) {
                registrationFormat.textContent = vehicleType === 'Boat' ? 'Boat registration, e.g. NOR-123' : 'Accepted: ' + config.format;
                registrationFormat.classList.remove('invalid');
            }
        }

        function setRegistrationCountry(country) {
            selectedRegistrationCountry = PLATE_COUNTRIES[country] ? country : 'OTHER';
            if (registrationCountryValue) registrationCountryValue.innerHTML = countryHtml(selectedRegistrationCountry);
            if (registrationCountryMenu) registrationCountryMenu.querySelectorAll('button').forEach(function (button) {
                button.classList.toggle('selected', button.dataset.value === selectedRegistrationCountry);
            });
            updateRegistrationGuide();
        }

        function updateRegistrationLabel() {
            const label = document.getElementById('rv-registration-label');
            if (label) label.textContent = vehicleType === 'Boat' || vehicleType === 'Bike' ? 'Registration' : 'Registration *';
        }

        function updateMeterLabel() {
            const label = document.getElementById('rv-meter-label');
            if (label) label.textContent = vehicleType === 'Boat' ? 'Engine Hours (h)' : (vehicleType === 'Bike' || vehicleType === 'Trailer' ? 'Distance (km)' : 'Odometer (km)');
        }

        function updateVinVisibility() {
            const vin = document.getElementById('rv-vin');
            const vinLabel = document.getElementById('rv-vin-label');
            const show = vehicleType === 'Car';
            if (vin) vin.style.display = show ? '' : 'none';
            if (vinLabel) vinLabel.style.display = show ? '' : 'none';
        }

        function setType(value) {
            vehicleType = value;
            if (typeMenu) {
                typeMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
                const btn = typeMenu.querySelector('button[data-value="' + value + '"]');
                if (btn) btn.classList.add('selected');
            }
            if (inputs.otherType) {
                inputs.otherType.style.display = value === 'Other' ? '' : 'none';
            }
            updateTypeFields();
        }

        function open(vehicle) {
            reset();
            if (vehicle) {
                editingId = vehicle.id || null;
                if (titleEl) titleEl.textContent = 'Edit vehicle';
                if (confirmBtn) confirmBtn.textContent = 'Save';
                if (inputs.name) inputs.name.value = vehicle.name || '';
                if (inputs.registration) inputs.registration.value = vehicle.registration || '';
                setRegistrationCountry(vehicle.registrationCountry || 'NO');
                if (inputs.vin) inputs.vin.value = vehicle.vin || '';
                if (inputs.make) inputs.make.value = vehicle.make || '';
                if (inputs.model) inputs.model.value = vehicle.model || '';
                if (inputs.year) inputs.year.value = vehicle.year || '';
                if (inputs.meter) inputs.meter.value = vehicle.distance || '';
                if (inputs.fuel) inputs.fuel.value = vehicle.fuel || '';
                const type = vehicle.type || '';
                setType(type);
                if (type) {
                    if (typeValue) typeValue.textContent = type;
                    if (type === 'Other' && vehicle.typeComment) {
                        if (inputs.otherType) {
                            inputs.otherType.value = vehicle.typeComment;
                            inputs.otherType.style.display = '';
                        }
                    }
                }
            }
            popup.style.display = 'flex';
            initialState = stateSnapshot();
            if (inputs.name) inputs.name.focus();
        }

        function close() {
            popup.style.display = 'none';
        }

        function requestClose() {
            if (!hasText() || stateSnapshot() === initialState) return close();
            window.MyMaintenanceCommonUi.confirmDiscard(close);
        }

        function selectType(value, label) {
            vehicleType = value;
            if (typeValue) typeValue.textContent = label;
            if (typeMenu) {
                typeMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
                const btn = typeMenu.querySelector('button[data-value="' + value + '"]');
                if (btn) btn.classList.add('selected');
            }
            if (typeDropdown) typeDropdown.classList.remove('open');
            if (inputs.otherType) {
                inputs.otherType.style.display = value === 'Other' ? '' : 'none';
                if (value === 'Other') inputs.otherType.focus();
            }
            updateTypeFields();
        }

        function save() {
            if (!window.MyMaintenanceAssets) return;
            const name = inputs.name ? inputs.name.value.trim() : '';
            const registration = inputs.registration ? inputs.registration.value.trim() : '';
            const country = selectedRegistrationCountry;
            const registrationRequired = vehicleType !== 'Boat' && vehicleType !== 'Bike';
            const nameOk = !!name;
            const registrationOk = (!registrationRequired || !!registration) && plateValid(country, registration, vehicleType);
            setInvalid(inputs.name, !nameOk);
            setInvalid(inputs.registration, !registrationOk);
            if (registrationFormat) registrationFormat.classList.toggle('invalid', !registrationOk);
            if (!nameOk || !registrationOk) {
                if (!nameOk && inputs.name) inputs.name.focus();
                else if (!registrationOk && inputs.registration) inputs.registration.focus();
                return;
            }
            const vehicle = {
                name: name,
                type: vehicleType,
                typeComment: vehicleType === 'Other' ? valueOf('rv-type-other') : '',
                registration: registration,
                registrationCountry: country,
                vin: valueOf('rv-vin'),
                make: valueOf('rv-make'),
                model: valueOf('rv-model'),
                year: valueOf('rv-year'),
                distance: valueOf('rv-meter'),
                fuel: valueOf('rv-fuel')
            };
            let saved;
            if (editingId) {
                saved = window.MyMaintenanceAssets.updateVehicle(editingId, vehicle);
            } else {
                saved = window.MyMaintenanceAssets.addVehicle(vehicle);
            }
            close();
            window.dispatchEvent(new CustomEvent('vehicle:registered', { detail: { vehicle: saved, record: saved } }));
        }

        if (cancel) cancel.addEventListener('click', requestClose);
        if (confirmBtn) confirmBtn.addEventListener('click', save);
        popup.addEventListener('click', function (e) { if (e.target === popup) requestClose(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && popup.style.display === 'flex') requestClose(); });

        if (typeToggle) {
            typeToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                if (typeDropdown) typeDropdown.classList.toggle('open');
            });
        }
        if (typeMenu) {
            typeMenu.addEventListener('click', function (e) {
                const btn = e.target.closest('button[data-value]');
                if (!btn) return;
                selectType(btn.getAttribute('data-value'), btn.textContent.trim());
            });
        }
        if (registrationCountryMenu) {
            registrationCountryMenu.innerHTML = Object.keys(PLATE_COUNTRIES).map(function (country) {
                return '<li><button type="button" data-value="' + country + '">' + countryHtml(country) + '</button></li>';
            }).join('');
            registrationCountryMenu.addEventListener('click', function (event) {
                const button = event.target.closest('button[data-value]');
                if (!button) return;
                setRegistrationCountry(button.dataset.value);
                if (registrationCountry) registrationCountry.classList.remove('open');
            });
        }
        if (registrationCountryToggle) registrationCountryToggle.addEventListener('click', function (event) {
            event.stopPropagation();
            if (registrationCountry) registrationCountry.classList.toggle('open');
        });
        document.addEventListener('click', function (e) {
            if (typeDropdown && !typeDropdown.contains(e.target)) typeDropdown.classList.remove('open');
            if (registrationCountry && !registrationCountry.contains(e.target)) registrationCountry.classList.remove('open');
        });

        if (inputs.name) inputs.name.addEventListener('input', function () { setInvalid(inputs.name, false); });
        if (inputs.registration) inputs.registration.addEventListener('input', function () { setInvalid(inputs.registration, false); });
        if (inputs.registration) inputs.registration.addEventListener('input', function () {
            inputs.registration.value = inputs.registration.value.toUpperCase().replace(/[^A-Z0-9ÄÖÜ -]/g, '');
            if (registrationFormat) registrationFormat.classList.remove('invalid');
        });

        window.MyMaintenanceVehicleRegister = { open: open, close: close };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

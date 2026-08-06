/* vehicle-register.js - Shared "Register a vehicle" popup */

(function () {
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
        const typeDropdown = document.getElementById('rv-type-dropdown');
        const typeToggle = document.getElementById('rv-type-toggle');
        const typeValue = document.getElementById('rv-type-value');
        const typeMenu = document.getElementById('rv-type-menu');
        const cancel = document.getElementById('rv-cancel');
        const confirmBtn = document.getElementById('rv-confirm');
        const titleEl = document.getElementById('rv-title');

        let vehicleType = '';
        let editingId = null;

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
        }

        function updateRegistrationLabel() {
            const label = document.getElementById('rv-registration-label');
            if (label) label.textContent = vehicleType === 'Boat' ? 'Registration' : 'Registration *';
        }

        function updateMeterLabel() {
            const label = document.getElementById('rv-meter-label');
            if (label) label.textContent = vehicleType === 'Boat' ? 'Engine Hours (h)' : 'Odometer (km)';
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
            if (inputs.name) inputs.name.focus();
        }

        function close() {
            popup.style.display = 'none';
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
            const registrationRequired = vehicleType !== 'Boat';
            const nameOk = !!name;
            const registrationOk = !registrationRequired || !!registration;
            setInvalid(inputs.name, !nameOk);
            setInvalid(inputs.registration, !registrationOk);
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

        if (cancel) cancel.addEventListener('click', close);
        if (confirmBtn) confirmBtn.addEventListener('click', save);
        popup.addEventListener('click', function (e) { if (e.target === popup) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && popup.style.display === 'flex') close(); });

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
        document.addEventListener('click', function (e) {
            if (typeDropdown && !typeDropdown.contains(e.target)) typeDropdown.classList.remove('open');
        });

        if (inputs.name) inputs.name.addEventListener('input', function () { setInvalid(inputs.name, false); });
        if (inputs.registration) inputs.registration.addEventListener('input', function () { setInvalid(inputs.registration, false); });

        window.MyMaintenanceVehicleRegister = { open: open, close: close };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

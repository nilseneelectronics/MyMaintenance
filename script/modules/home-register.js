/* home-register.js - Shared "Register a home" popup */

(function () {
    function init() {
        const popup = document.getElementById('register-home-popup');
        if (!popup) return;

        const inputs = {
            name: document.getElementById('rh-name'),
            country: document.getElementById('rh-country'),
            address: document.getElementById('rh-address'),
            zip: document.getElementById('rh-zip'),
            city: document.getElementById('rh-city'),
            buildYear: document.getElementById('rh-build-year'),
            floors: document.getElementById('rh-floors'),
            internalSize: document.getElementById('rh-internal'),
            externalSize: document.getElementById('rh-external'),
            otherType: document.getElementById('rh-house-type-other')
        };
        const typeDropdown = document.getElementById('rh-house-type-dropdown');
        const typeToggle = document.getElementById('rh-house-type-toggle');
        const typeValue = document.getElementById('rh-house-type-value');
        const typeMenu = document.getElementById('rh-house-type-menu');
        const cancel = document.getElementById('rh-cancel');
        const confirmBtn = document.getElementById('rh-confirm');
        const titleEl = document.getElementById('rh-title');

        let houseType = '';
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
            ['rh-name', 'rh-country', 'rh-address', 'rh-zip', 'rh-city', 'rh-build-year', 'rh-floors', 'rh-internal', 'rh-external', 'rh-house-type-other'].forEach(function (id) {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                    el.classList.remove('invalid');
                }
            });
            houseType = '';
            editingId = null;
            if (titleEl) titleEl.textContent = 'Register a home';
            if (confirmBtn) confirmBtn.textContent = 'Confirm';
            if (typeValue) typeValue.textContent = '-- Select --';
            if (typeMenu) typeMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
            if (inputs.otherType) inputs.otherType.style.display = 'none';
            if (typeDropdown) typeDropdown.classList.remove('open');
        }

        function setHouseType(value) {
            houseType = value;
            if (typeMenu) {
                typeMenu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
                const btn = typeMenu.querySelector('button[data-value="' + value + '"]');
                if (btn) btn.classList.add('selected');
            }
            if (inputs.otherType) {
                inputs.otherType.style.display = value === 'Other' ? '' : 'none';
            }
        }

        function open(home) {
            reset();
            if (home) {
                editingId = home.id || null;
                if (titleEl) titleEl.textContent = 'Edit home';
                if (confirmBtn) confirmBtn.textContent = 'Save';
                if (inputs.name) inputs.name.value = home.name || '';
                if (inputs.country) inputs.country.value = home.country || '';
                if (inputs.address) inputs.address.value = home.address || '';
                if (inputs.zip) inputs.zip.value = home.zip || '';
                if (inputs.city) inputs.city.value = home.city || '';
                if (inputs.buildYear) inputs.buildYear.value = home.buildYear || '';
                if (inputs.floors) inputs.floors.value = home.floors || '';
                if (inputs.internalSize) inputs.internalSize.value = home.internalSize || '';
                if (inputs.externalSize) inputs.externalSize.value = home.externalSize || '';
                const type = home.houseType || '';
                setHouseType(type);
                if (type) {
                    if (typeValue) typeValue.textContent = type;
                    if (type === 'Other' && home.houseTypeComment) {
                        if (inputs.otherType) {
                            inputs.otherType.value = home.houseTypeComment;
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

        function selectHouseType(value, label) {
            houseType = value;
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
        }

        function save() {
            if (!window.MyMaintenanceAssets) return;
            const name = inputs.name ? inputs.name.value.trim() : '';
            const address = inputs.address ? inputs.address.value.trim() : '';
            const nameOk = !!name;
            const addressOk = !!address;
            setInvalid(inputs.name, !nameOk);
            setInvalid(inputs.address, !addressOk);
            if (!nameOk || !addressOk) {
                if (!nameOk && inputs.name) inputs.name.focus();
                else if (inputs.address) inputs.address.focus();
                return;
            }
            const home = {
                name: name,
                country: valueOf('rh-country'),
                address: address,
                zip: valueOf('rh-zip'),
                city: valueOf('rh-city'),
                buildYear: valueOf('rh-build-year'),
                houseType: houseType,
                houseTypeComment: houseType === 'Other' ? valueOf('rh-house-type-other') : '',
                floors: valueOf('rh-floors'),
                internalSize: valueOf('rh-internal'),
                externalSize: valueOf('rh-external')
            };
            let saved;
            if (editingId) {
                saved = window.MyMaintenanceAssets.updateHome(editingId, home);
            } else {
                saved = window.MyMaintenanceAssets.addHome(home);
            }
            close();
            window.dispatchEvent(new CustomEvent('home:registered', { detail: { home: saved, record: saved } }));
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
                selectHouseType(btn.getAttribute('data-value'), btn.textContent.trim());
            });
        }
        document.addEventListener('click', function (e) {
            if (typeDropdown && !typeDropdown.contains(e.target)) typeDropdown.classList.remove('open');
        });

        if (inputs.name) inputs.name.addEventListener('input', function () { setInvalid(inputs.name, false); });
        if (inputs.address) inputs.address.addEventListener('input', function () { setInvalid(inputs.address, false); });

        window.MyMaintenanceHomeRegister = { open: open, close: close };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

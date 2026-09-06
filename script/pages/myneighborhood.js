document.addEventListener('DOMContentLoaded', () => {
    const NB_KEY = 'floorplan_user_neighborhoods';
    const NB_PHOTO_KEY = 'floorplan_neighborhood_photos';

    let neighborhoods = loadNeighborhoods();
    let currentId = getParam('id') || (neighborhoods[0] ? neighborhoods[0].id : null);
    let photoCache = loadPhotos();

    /* current logged-in user (creator becomes admin) */
    const me = {
        email: (function () {
            try {
                const prof = localStorage.getItem('floorplan_user_profile');
                if (prof) { const p = JSON.parse(prof); if (p && p.email) return p.email; }
            } catch (e) {}
            return '';
        })(),
        name: (function () {
            try {
                const prof = localStorage.getItem('floorplan_user_profile');
                if (prof) { const p = JSON.parse(prof); if (p && p.name) return p.name; }
            } catch (e) {}
            return 'Me';
        })()
    };

    function getParam(name) {
        const p = new URLSearchParams(location.search);
        return p.get(name);
    }

    function loadNeighborhoods() {
        try {
            const raw = localStorage.getItem(NB_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }
    function saveNeighborhoods() { localStorage.setItem(NB_KEY, JSON.stringify(neighborhoods)); }
    function loadPhotos() {
        try { const raw = localStorage.getItem(NB_PHOTO_KEY); return raw ? JSON.parse(raw) : {}; }
        catch (e) { return {}; }
    }
    function savePhotos() { localStorage.setItem(NB_PHOTO_KEY, JSON.stringify(photoCache)); }
    function current() { return neighborhoods.find(n => n.id === currentId) || null; }

    /* ---- Neighborhood selector ---- */
    const selectorMenu = document.getElementById('nb-selector-menu');
    const selectorLabel = document.getElementById('nb-selector-label');
    function renderSelector() {
        selectorMenu.innerHTML = '';
        neighborhoods.forEach(n => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = n.name || 'Unnamed neighborhood';
            b.addEventListener('click', () => {
                currentId = n.id;
                history.replaceState(null, '', 'myneighborhood.html?id=' + encodeURIComponent(n.id));
                render();
                const dd = document.querySelector('.address-selector');
                if (dd) dd.classList.remove('open');
            });
            li.appendChild(b);
            selectorMenu.appendChild(li);
        });
        const liAdd = document.createElement('li');
        const bAdd = document.createElement('button');
        bAdd.type = 'button';
        bAdd.textContent = 'Register new neighborhood';
        bAdd.addEventListener('click', () => { openInfoPopup(null); });
        liAdd.appendChild(bAdd);
        selectorMenu.appendChild(liAdd);
    }

    /* ---- Address / people builder ---- */
    function removePerson(addr) {
        const people = addr.people || [];
        if (!people.length) return;
        // remove an unfilled person first, otherwise the last one
        let target = -1;
        for (let i = 0; i < people.length; i++) {
            if (!(people[i].name || people[i].phone || people[i].email)) { target = i; break; }
        }
        if (target >= 0) people.splice(target, 1);
        else people.splice(people.length - 1, 1);
    }

    function addPerson(addr) {
        addr.people = addr.people || [];
        addr.people.push({ name: '', phone: '', email: '' });
    }

    function makePeopleControl(addr, idx) {
        const wrap = document.createElement('div');
        wrap.className = 'nb-people-control';
        const count = (addr.people || []).length;
        if (count === 0) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nb-add-people-btn';
            btn.textContent = 'Add people';
            btn.addEventListener('click', () => { readBuilderIntoModel(builderModel); addPerson(addr); renderBuilder(); });
            wrap.appendChild(btn);
        } else {
            const stepper = document.createElement('div');
            stepper.className = 'nb-stepper';
            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'minus';
            minus.textContent = '−';
            minus.addEventListener('click', () => { readBuilderIntoModel(builderModel); removePerson(addr); renderBuilder(); });
            const num = document.createElement('span');
            num.className = 'nb-people-count';
            num.textContent = String(count);
            const plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'plus';
            plus.textContent = '+';
            plus.addEventListener('click', () => { readBuilderIntoModel(builderModel); addPerson(addr); renderBuilder(); });
            stepper.appendChild(minus);
            stepper.appendChild(num);
            stepper.appendChild(plus);
            wrap.appendChild(stepper);
        }
        return wrap;
    }

    const ROLE_LABELS = {
        admin: 'Admin',
        edit: 'Editor',
        view: 'View'
    };
    function roleLabel(role) { return ROLE_LABELS[role] || 'View'; }

    /* Whether the current user can administer (edit roles / delete). */
    let isAdmin = false;
    function isMeAdmin(nb) {
        return true; // current user is a superuser with admin rights
    }

    function makeRoleDropdown(p) {
        const row = document.createElement('div');
        row.className = 'nb-role-row';
        const title = document.createElement('span');
        title.className = 'nb-role-title';
        title.textContent = 'Members access';
        if (!isAdmin) {
            const value = document.createElement('span');
            value.className = 'nb-role-static';
            value.textContent = roleLabel(p.role);
            row.appendChild(title);
            row.appendChild(value);
            return row;
        }
        const dd = document.createElement('div');
        dd.className = 'custom-dropdown nb-person-role';
        const toggle = document.createElement('div');
        toggle.className = 'dropdown-toggle';
        const span = document.createElement('span');
        span.textContent = roleLabel(p.role);
        const chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chev.setAttribute('width', '14');
        chev.setAttribute('height', '14');
        chev.setAttribute('viewBox', '0 0 24 24');
        chev.setAttribute('fill', 'none');
        chev.innerHTML = '<path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        toggle.appendChild(span);
        toggle.appendChild(chev);
        const menu = document.createElement('ul');
        menu.className = 'dropdown-menu';
        ROLE_OPTIONS.forEach(opt => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = roleLabel(opt);
            b.dataset.roleValue = opt;
            b.addEventListener('click', () => { p.role = opt; span.textContent = roleLabel(opt); dd.classList.remove('open'); });
            li.appendChild(b);
            menu.appendChild(li);
        });
        dd.appendChild(toggle);
        dd.appendChild(menu);
        toggle.addEventListener('click', (e) => { e.stopPropagation(); dd.classList.toggle('open'); });
        row.appendChild(title);
        row.appendChild(dd);
        return row;
    }

    function buildAddressBlock(addr, idx) {
        const block = document.createElement('div');
        block.className = 'nb-address-block';
        block.dataset.addrIdx = String(idx);
        const head = document.createElement('div');
        head.className = 'nb-address-head';
        const lbl = document.createElement('span');
        lbl.className = 'nb-address-label';
        lbl.textContent = 'Address ' + (idx + 1);
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Street and number';
        input.value = addr.address || '';
        input.dataset.field = 'address';
        head.appendChild(lbl);
        head.appendChild(input);
        head.appendChild(makePeopleControl(addr, idx));
        block.appendChild(head);

        const peopleWrap = document.createElement('div');
        peopleWrap.className = 'nb-people-wrap';
        (addr.people || []).forEach((p, pi) => {
            const grp = document.createElement('div');
            grp.className = 'nb-person-group';
            const lbl2 = document.createElement('div');
            lbl2.className = 'nb-person-label';
            lbl2.textContent = 'Person ' + (pi + 1);
            const fields = document.createElement('div');
            fields.className = 'nb-person-fields';
            ['name', 'phone', 'email'].forEach(field => {
                const f = document.createElement('input');
                f.type = field === 'phone' ? 'tel' : (field === 'email' ? 'email' : 'text');
                f.placeholder = field.charAt(0).toUpperCase() + field.slice(1);
                f.value = p[field] || '';
                f.dataset.field = field;
                f.dataset.person = String(pi);
                fields.appendChild(f);
            });
            grp.appendChild(lbl2);
            grp.appendChild(fields);
            // Role dropdown right of the email field (under the person).
            grp.appendChild(makeRoleDropdown(p));
            peopleWrap.appendChild(grp);
        });
        block.appendChild(peopleWrap);
        return block;
    }

    /* Collect input values from the builder back into the model */
    function readBuilderIntoModel(model) {
        const blocks = document.querySelectorAll('#nb-addr-builder .nb-address-block');
        blocks.forEach((block, idx) => {
            if (!model.addresses[idx]) return;
            const a = model.addresses[idx];
            const addrInput = block.querySelector('input[data-field="address"]');
            if (addrInput) a.address = addrInput.value;
            const personEls = block.querySelectorAll('.nb-person-group');
            personEls.forEach((pgrp, pi) => {
                if (!a.people[pi]) a.people[pi] = { name: '', phone: '', email: '' };
                ['name', 'phone', 'email'].forEach(field => {
                    const f = pgrp.querySelector('input[data-field="' + field + '"][data-person="' + pi + '"]');
                    if (f) a.people[pi][field] = f.value;
                });
            });
        });
    }

    // Remove fully-empty people and addresses (called only when saving).
    function cleanupBuilderModel(model) {
        model.addresses.forEach(a => {
            a.people = (a.people || []).filter(p => p && (p.name || p.phone || p.email));
        });
        model.addresses = model.addresses.filter(a => a.address || (a.people && a.people.length));
    }

    function renderBuilder() {
        const nb = builderModel;
        const container = document.getElementById('nb-addr-builder');
        container.innerHTML = '';
        if (!nb.addresses || !nb.addresses.length) {
            container.innerHTML = '<div class="nb-empty">Enter the amount of houses above to add addresses.</div>';
            return;
        }
        nb.addresses.forEach((addr, idx) => {
            container.appendChild(buildAddressBlock(addr, idx));
        });
    }

    let builderModel = null;

    function syncAddressCount(n) {
        n = Math.max(0, parseInt(n, 10) || 0);
        if (!builderModel) return;
        // Capture any text typed into the DOM before rebuilding so it is kept.
        readBuilderIntoModel(builderModel);
        if (!builderModel._deletedAddresses) builderModel._deletedAddresses = [];
        let cur = (builderModel.addresses || []).slice();
        // Reduce: remove unfilled addresses first, otherwise the last. Remember
        // any removed filled addresses so they can be restored when increasing.
        while (cur.length > n) {
            const emptyIdx = cur.findIndex(a => !a.address && (!a.people || !a.people.some(p => p && (p.name || p.phone || p.email))));
            let removed;
            if (emptyIdx >= 0) removed = cur.splice(emptyIdx, 1)[0];
            else removed = cur.pop();
            if (removed && (removed.address || (removed.people && removed.people.some(p => p && (p.name || p.phone || p.email))))) {
                builderModel._deletedAddresses.unshift(removed);
            }
        }
        // Increase: reuse current addresses, then restore remembered ones, then blanks.
        const next = [];
        for (let i = 0; i < n; i++) {
            if (cur[i]) next.push(cur[i]);
            else if (builderModel._deletedAddresses.length) next.push(builderModel._deletedAddresses.shift());
            else next.push({ id: 'a' + Date.now() + '_' + i, address: '', people: [] });
        }
        builderModel.addresses = next;
        renderBuilder();
    }

    /* ---- Info / register popup ---- */
    function openInfoPopup(nb) {
        document.getElementById('nb-info-popup-title').textContent = nb ? 'Edit Neighborhood' : 'Register a neighborhood';
        isAdmin = isMeAdmin(nb);
        builderModel = nb ? JSON.parse(JSON.stringify(nb)) : {
            id: 'nb_' + Date.now(),
            name: '',
            country: '',
            zip: '',
            city: '',
            other: '',
            addresses: []
        };
        if (!builderModel.addresses) builderModel.addresses = [];
        const delBtn = document.getElementById('nb-info-delete');
        if (delBtn) delBtn.style.display = (nb && isAdmin) ? '' : 'none';
        document.getElementById('nb-name').value = builderModel.name || '';
        clearRequiredInvalid(document.getElementById('nb-name'));
        document.getElementById('nb-houses').value = builderModel.addresses.length ? builderModel.addresses.length : '';
        document.getElementById('nb-country').value = builderModel.country || '';
        document.getElementById('nb-zip').value = builderModel.zip || '';
        document.getElementById('nb-city').value = builderModel.city || '';
        document.getElementById('nb-other').value = builderModel.other || '';
        syncAddressCount(builderModel.addresses.length || (document.getElementById('nb-houses').value || 0));
        document.getElementById('nb-info-popup').style.display = 'flex';
        const nameEl = document.getElementById('nb-name');
        if (nameEl && typeof nameEl.focus === 'function') nameEl.focus({ preventScroll: true });
    }

    let housesTimer = null;
    let roleTimer = null;
    document.getElementById('nb-houses').addEventListener('input', (e) => {
        // Debounce so typing a new number doesn't immediately remove addresses,
        // giving the user time to enter the full value.
        clearTimeout(housesTimer);
        housesTimer = setTimeout(() => { syncAddressCount(e.target.value); }, 700);
    });
    document.getElementById('nb-houses-plus').addEventListener('click', () => {
        clearTimeout(housesTimer);
        const input = document.getElementById('nb-houses');
        const v = (parseInt(input.value, 10) || 0) + 1;
        input.value = v;
        syncAddressCount(v);
    });
    document.getElementById('nb-houses-minus').addEventListener('click', () => {
        clearTimeout(housesTimer);
        const input = document.getElementById('nb-houses');
        const v = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
        input.value = v;
        syncAddressCount(v);
    });

    /* ---- Roles (per person) ---- */
    const ROLE_OPTIONS = ['admin', 'edit', 'view'];

    // Close person-role dropdowns when clicking elsewhere.
    document.addEventListener('click', () => {
        document.querySelectorAll('.nb-person-role.open').forEach(dd => dd.classList.remove('open'));
    });

    /* ---- Save ---- */
    function closeInfoPopup() {
        document.getElementById('nb-info-popup').style.display = 'none';
        builderModel = null;
    }

    function markRequiredInvalid(input) {
        input.classList.remove('invalid', 'shake');
        void input.offsetWidth;
        input.classList.add('invalid');
        input.classList.add('shake');
    }
    function clearRequiredInvalid(input) {
        input.classList.remove('invalid', 'shake');
    }

    document.getElementById('nb-info-cancel').addEventListener('click', closeInfoPopup);

    function saveNeighborhoodForm() {
        readBuilderIntoModel(builderModel);
        cleanupBuilderModel(builderModel);
        // Validate all required fields at once so they all turn red together.
        let invalid = false;
        let firstInvalid = null;
        // Neighborhood name.
        const nameInput = document.getElementById('nb-name');
        const name = nameInput.value.trim();
        if (!name) {
            markRequiredInvalid(nameInput);
            invalid = true;
            firstInvalid = firstInvalid || nameInput;
        } else {
            clearRequiredInvalid(nameInput);
        }
        // Address required for every added house that has been opened.
        const addrInputs = document.querySelectorAll('#nb-addr-builder input[data-field="address"]');
        addrInputs.forEach(ai => {
            if (!ai.value.trim()) {
                markRequiredInvalid(ai);
                invalid = true;
                firstInvalid = firstInvalid || ai;
            } else {
                clearRequiredInvalid(ai);
            }
        });
        if (invalid) {
            if (firstInvalid) firstInvalid.focus();
            return;
        }
        builderModel.name = name;
        builderModel.country = document.getElementById('nb-country').value.trim();
        builderModel.zip = document.getElementById('nb-zip').value.trim();
        builderModel.city = document.getElementById('nb-city').value.trim();
        builderModel.other = document.getElementById('nb-other').value.trim();
        // Roles are stored per person; also expose a combined roles list.
        const roles = [];
        (builderModel.addresses || []).forEach(a => {
            (a.people || []).forEach(p => {
                if (p && (p.email || p.name)) roles.push({ email: p.email || '', name: p.name || '', role: p.role || 'view' });
            });
        });
        // Creator is automatically administrator (superuser).
        const meAlreadyInRoles = roles.some(r => (me.email ? r.email === me.email : r.name === me.name));
        if (!meAlreadyInRoles) {
            roles.unshift({ email: me.email, name: me.name, role: 'admin' });
        }
        builderModel.roles = roles;
        builderModel.houses = parseInt(document.getElementById('nb-houses').value, 10) || (builderModel.addresses || []).length;
        const existing = current();
        if (existing && existing.id === builderModel.id) {
            Object.assign(existing, builderModel);
            currentId = existing.id;
        } else {
            neighborhoods.push(builderModel);
            currentId = builderModel.id;
        }
        saveNeighborhoods();
        document.getElementById('nb-info-popup').style.display = 'none';
        builderModel = null;
        history.replaceState(null, '', 'myneighborhood.html?id=' + encodeURIComponent(currentId));
        render();
    }

    document.getElementById('nb-info-save').addEventListener('click', saveNeighborhoodForm);

    /* Delete neighborhood (admin only, edit mode) */
    document.getElementById('nb-info-delete').addEventListener('click', () => {
        if (!builderModel) return;
        const id = builderModel.id;
        if (!confirm('Delete this neighborhood? This cannot be undone.')) return;
        neighborhoods = neighborhoods.filter(n => n.id !== id);
        saveNeighborhoods();
        if (currentId === id) currentId = neighborhoods.length ? neighborhoods[0].id : null;
        document.getElementById('nb-info-popup').style.display = 'none';
        builderModel = null;
        history.replaceState(null, '', 'myneighborhood.html' + (currentId ? '?id=' + encodeURIComponent(currentId) : ''));
        render();
    });

    /* Escape closes, Enter saves (both when editing and adding) */
    document.addEventListener('keydown', (e) => {
        const popup = document.getElementById('nb-info-popup');
        if (!popup || popup.style.display !== 'flex') return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeInfoPopup();
        } else if (e.key === 'Enter' && !e.shiftKey) {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'textarea') return; // allow newlines in textarea
            e.preventDefault();
            saveNeighborhoodForm();
        }
    });

    document.getElementById('nb-name').addEventListener('input', () => clearRequiredInvalid(document.getElementById('nb-name')));
    document.getElementById('nb-addr-builder').addEventListener('input', (e) => {
        if (e.target && e.target.matches && e.target.matches('input[data-field="address"]')) {
            clearRequiredInvalid(e.target);
        }
    });

    /* ---- Neighbors (compact, grouped by address) ---- */
    function renderNeighbors() {
        const nb = current();
        const list = document.getElementById('nb-neighbor-list');
        if (!nb || !nb.addresses || !nb.addresses.length) {
            list.innerHTML = '<div class="nb-empty">No neighbors added yet.</div>';
            return;
        }
        list.innerHTML = '';
        nb.addresses.forEach((addr, idx) => {
            const people = (addr.people || []).filter(p => p && (p.name || p.phone || p.email));
            if (!people.length && !addr.address) return;

            const block = document.createElement('div');
            block.className = 'nb-address-block nb-address-block-display';

            const head = document.createElement('div');
            head.className = 'nb-address-head';
            const addrVal = document.createElement('span');
            addrVal.className = 'nb-address-value';
            addrVal.textContent = addr.address || ('Address ' + (idx + 1));
            head.appendChild(addrVal);
            block.appendChild(head);

            const headerRow = document.createElement('div');
            headerRow.className = 'nb-person-header';
            ['Access', 'Name', 'Phone', 'Email'].forEach(h => {
                const hd = document.createElement('div');
                hd.className = 'nb-person-col-head';
                hd.textContent = h;
                headerRow.appendChild(hd);
            });
            block.appendChild(headerRow);

            people.forEach(p => {
                const row = document.createElement('div');
                row.className = 'nb-person-row';

                const access = document.createElement('div');
                access.className = 'nb-person-cell nb-access-cell';
                const tag = document.createElement('span');
                tag.className = 'nb-access-tag ' + (p.role || 'view');
                tag.textContent = roleLabel(p.role);
                access.appendChild(tag);

                const name = document.createElement('div');
                name.className = 'nb-person-cell';
                name.textContent = p.name || '';

                const phone = document.createElement('div');
                phone.className = 'nb-person-cell';
                if (p.phone) phone.innerHTML = '<a href="tel:' + escapeHtml(String(p.phone).replace(/[^+\d]/g, '')) + '">' + escapeHtml(p.phone) + '</a>';

                const email = document.createElement('div');
                email.className = 'nb-person-cell';
                if (p.email) email.innerHTML = '<a href="mailto:' + escapeHtml(p.email) + '">' + escapeHtml(p.email) + '</a>';

                row.appendChild(access);
                row.appendChild(name);
                row.appendChild(phone);
                row.appendChild(email);
                block.appendChild(row);
            });

            list.appendChild(block);
        });
    }

    /* ---- Events ---- */
    function renderEvents() {
        const nb = current();
        const list = document.getElementById('nb-events-list');
        if (!nb || !nb.events || !nb.events.length) {
            list.innerHTML = '<div class="nb-empty">No upcoming events.</div>';
            return;
        }
        list.innerHTML = '';
        const sorted = nb.events.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        sorted.forEach((ev, idx) => {
            const item = document.createElement('div');
            item.className = 'asset-planned-item';
            const name = document.createElement('strong');
            name.textContent = ev.name || 'Event';
            const info = document.createElement('div');
            info.className = 'planned-item-info';
            info.textContent = (ev.date || '') + (ev.time ? ' ' + ev.time : '') + (ev.location ? ' · ' + ev.location : '');
            const desc = document.createElement('div');
            desc.className = 'planned-item-desc';
            desc.textContent = ev.desc || '';
            const del = document.createElement('button');
            del.className = 'view-button';
            del.textContent = 'Remove';
            del.addEventListener('click', () => { nb.events.splice(idx, 1); saveNeighborhoods(); renderEvents(); });
            item.appendChild(name);
            item.appendChild(info);
            item.appendChild(desc);
            item.appendChild(del);
            list.appendChild(item);
        });
    }

    /* ---- Photos ---- */
    function photosFor(nb) { const key = nb ? nb.id : ''; return photoCache[key] || []; }
    const NB_DEFAULT_PHOTOS = [
        { dataUrl: 'https://picsum.photos/id/1036/1200/675' },
        { dataUrl: 'https://picsum.photos/id/1039/1200/675' },
        { dataUrl: 'https://picsum.photos/id/1011/1200/675' }
    ];
    function displayPhotosFor(nb) {
        const stored = photosFor(nb);
        return stored.length ? stored : NB_DEFAULT_PHOTOS;
    }
    function setMainPhoto() {
        const imgs = displayPhotosFor(current());
        const main = document.getElementById('nb-main-photo');
        if (imgs.length) main.src = imgs[0].dataUrl;
        renderNbThumbs();
    }
    function renderPhotoThumbs() {
        const nb = current();
        const grid = document.getElementById('nbp-photo-grid');
        const noPhotos = document.getElementById('nbp-no-photos');
        const imgs = photosFor(nb);
        grid.innerHTML = '';
        if (noPhotos) noPhotos.style.display = imgs.length ? 'none' : 'block';
        imgs.forEach((p, i) => {
            const w = document.createElement('div');
            w.className = 'done-photo-thumb';
            const img = document.createElement('img');
            img.src = p.dataUrl;
            w.appendChild(img);
            const del = document.createElement('button');
            del.className = 'done-photo-del';
            del.textContent = '×';
            del.addEventListener('click', () => { imgs.splice(i, 1); savePhotos(); renderPhotoThumbs(); setMainPhoto(); });
            w.appendChild(del);
            grid.appendChild(w);
        });
    }
    function renderGallery() {
        const grid = document.getElementById('nb-gallery-grid');
        const imgs = displayPhotosFor(current());
        grid.innerHTML = '';
        imgs.forEach((p, i) => {
            const w = document.createElement('div');
            w.className = 'gallery-thumb';
            const img = document.createElement('img');
            img.src = p.dataUrl;
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => setMainPhotoTo(i));
            w.appendChild(img);
            grid.appendChild(w);
        });
    }
    function setMainPhotoTo(idx) {
        const imgs = displayPhotosFor(current());
        if (!imgs.length) return;
        photoNavIndex = idx % imgs.length;
        document.getElementById('nb-main-photo').src = imgs[photoNavIndex].dataUrl;
        document.getElementById('nb-gallery-modal').style.display = 'none';
        renderNbThumbs();
    }
    let photoNavIndex = 0;
    function nextPhoto(dir) {
        const imgs = displayPhotosFor(current());
        if (!imgs.length) return;
        photoNavIndex = (photoNavIndex + dir + imgs.length) % imgs.length;
        document.getElementById('nb-main-photo').src = imgs[photoNavIndex].dataUrl;
        renderNbThumbs();
    }
    /* Show the next 2 photos as preview thumbnails in narrow mode */
    function renderNbThumbs() {
        const t1 = document.getElementById('nb-thumb-1');
        const t2 = document.getElementById('nb-thumb-2');
        const wrap = document.getElementById('nb-photo-thumbs');
        if (!t1 && !t2) return;
        const imgs = displayPhotosFor(current());
        const thumbs = [t1, t2];
        thumbs.forEach((img, i) => {
            if (!img) return;
            const has = imgs.length > i + 1;
            img.style.display = has ? '' : 'none';
            if (has) img.src = imgs[(photoNavIndex + 1 + i) % imgs.length].dataUrl;
        });
        if (wrap) wrap.style.display = imgs.length > 1 ? '' : 'none';
    }
    const nbThumbsWrap = document.getElementById('nb-photo-thumbs');
    if (nbThumbsWrap) {
        nbThumbsWrap.addEventListener('click', (e) => {
            const t = e.target.closest('img');
            if (!t) return;
            const imgs = displayPhotosFor(current());
            if (!imgs.length) return;
            const off = t === document.getElementById('nb-thumb-2') ? 2 : 1;
            photoNavIndex = (photoNavIndex + off) % imgs.length;
            document.getElementById('nb-main-photo').src = imgs[photoNavIndex].dataUrl;
            renderNbThumbs();
        });
    }

    /* ---- Documents ---- */
    function renderDocs() {
        const nb = current();
        const list = document.getElementById('nb-docs-list');
        if (!nb || !nb.docs || !nb.docs.length) {
            list.innerHTML = '<div class="nb-empty">No documents registered.</div>';
            return;
        }
        list.innerHTML = '';
        nb.docs.forEach((d, idx) => {
            const row = document.createElement('div');
            row.className = 'doc-row doc-row-open';
            row.style.cursor = 'pointer';
            const name = document.createElement('span');
            name.textContent = d.name || d.fileName || 'Document';
            const meta = document.createElement('span');
            meta.className = 'planned-item-info';
            meta.textContent = (d.performed || '') + (d.sizeLabel ? ' · ' + d.sizeLabel : '');
            const del = document.createElement('button');
            del.className = 'view-button';
            del.textContent = 'Remove';
            del.addEventListener('click', (e) => { e.stopPropagation(); nb.docs.splice(idx, 1); saveNeighborhoods(); renderDocs(); });
            row.appendChild(name);
            row.appendChild(meta);
            row.appendChild(del);
            row.addEventListener('click', () => previewDoc(d));
            list.appendChild(row);
        });
    }
    function previewDoc(d) {
        const ov = document.getElementById('nb-doc-preview');
        if (!ov) return;
        const body = ov.querySelector('.preview-body');
        body.innerHTML = '';
        const info = fileTypeInfo(d);
        if (info.cls === 'file-image') {
            body.innerHTML = '<div class="preview-img-wrap"><img class="preview-media" src="' + d.data + '"></div>';
        } else if (info.cls === 'file-pdf' && window.MyPdfViewer) {
            window.MyPdfViewer.open(d.data, d.fileName || 'document.pdf', body);
        } else if ((info.cls === 'file-xls' || info.cls === 'file-csv' || info.cls === 'file-docx' || info.ext === 'pptx' || info.ext === 'numbers' || info.ext === 'pages' || info.ext === 'key') && window.MyOfficeViewer) {
            window.MyOfficeViewer.open(d.data, d.fileName || ('document.' + info.ext), body, info.ext);
        } else {
            body.innerHTML = '<div class="preview-note">This file type cannot be previewed here.</div>';
        }
        ov.style.display = 'flex';
    }
    function fileTypeInfo(d) {
        const fn = String(d.fileName || d.name || '');
        const ext = ((fn.match(/\.([^.]+)$/) || [])[1] || '').toLowerCase();
        const map = { pdf: 'file-pdf', png: 'file-image', jpg: 'file-image', jpeg: 'file-image', gif: 'file-image', webp: 'file-image', bmp: 'file-image', svg: 'file-image', docx: 'file-docx', pptx: 'file-ppt', xls: 'file-xls', xlsx: 'file-xls', csv: 'file-csv', numbers: 'file-xls', pages: 'file-doc', key: 'file-ppt', '3mf': 'file-3d', stl: 'file-3d' };
        return { cls: map[ext] || 'file-blank', ext: ext };
    }

    /* ---- Master render ---- */
    function render() {
        renderSelector();
        if (!currentId && neighborhoods.length) currentId = neighborhoods[0].id;
        selectorLabel.textContent = current() ? (current().name || 'Neighborhood') : '-- Select neighborhood --';
        renderNeighbors();
        renderEvents();
        renderDocs();
        setMainPhoto();
        renderNbThumbs();
    }

    /* ---- Wire events ---- */
    document.getElementById('nb-add-event').addEventListener('click', () => {
        if (!current()) return openInfoPopup(null);
        document.getElementById('nb-event-modal').style.display = 'flex';
        document.getElementById('nbe-name').value = '';
        document.getElementById('nbe-date').value = '';
        document.getElementById('nbe-time').value = '';
        document.getElementById('nbe-location').value = '';
        document.getElementById('nbe-desc').value = '';
    });
    document.getElementById('nbe-cancel').addEventListener('click', () => { document.getElementById('nb-event-modal').style.display = 'none'; });
    document.getElementById('nbe-add').addEventListener('click', () => {
        const nb = current();
        const name = document.getElementById('nbe-name').value.trim();
        if (!name) return;
        if (!nb.events) nb.events = [];
        nb.events.push({ name, date: document.getElementById('nbe-date').value, time: document.getElementById('nbe-time').value, location: document.getElementById('nbe-location').value, desc: document.getElementById('nbe-desc').value });
        saveNeighborhoods();
        document.getElementById('nb-event-modal').style.display = 'none';
        renderEvents();
    });

    document.getElementById('nb-add-neighbor').addEventListener('click', () => {
        if (!current()) return openInfoPopup(null);
        // Add an empty address or ensure people can be added; open the info popup to edit people
        openInfoPopup(current());
    });

    /* Photos */
    document.getElementById('nb-add-photo-btn').addEventListener('click', () => {
        if (!current()) return openInfoPopup(null);
        renderPhotoThumbs();
        document.getElementById('nb-add-photos-popup').style.display = 'flex';
    });
    document.getElementById('nb-gallery-add-photo').addEventListener('click', () => {
        renderPhotoThumbs();
        document.getElementById('nb-gallery-modal').style.display = 'none';
        document.getElementById('nb-add-photos-popup').style.display = 'flex';
    });
    document.getElementById('nbp-cancel').addEventListener('click', () => { document.getElementById('nb-add-photos-popup').style.display = 'none'; });
    document.getElementById('nbp-save').addEventListener('click', () => { document.getElementById('nb-add-photos-popup').style.display = 'none'; render(); });
    document.getElementById('nb-view-all-photos').addEventListener('click', () => { renderGallery(); document.getElementById('nb-gallery-modal').style.display = 'flex'; });
    document.getElementById('nb-gallery-close').addEventListener('click', () => { document.getElementById('nb-gallery-modal').style.display = 'none'; });
    document.getElementById('nb-prev-arrow').addEventListener('click', () => nextPhoto(-1));
    document.getElementById('nb-next-arrow').addEventListener('click', () => nextPhoto(1));

    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.multiple = true;
    photoInput.style.display = 'none';
    document.body.appendChild(photoInput);
    document.getElementById('nbp-picture-btn').addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
        const nb = current();
        const files = Array.prototype.slice.call(photoInput.files || []);
        const key = nb.id;
        if (!photoCache[key]) photoCache[key] = [];
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => { photoCache[key].push({ dataUrl: reader.result, text: '' }); savePhotos(); renderPhotoThumbs(); setMainPhoto(); };
            reader.readAsDataURL(file);
        });
        photoInput.value = '';
    });

    /* Documents */
    document.getElementById('nb-add-document').addEventListener('click', () => {
        if (!current()) return openInfoPopup(null);
        document.getElementById('nb-doc-file-name').textContent = 'No file selected';
        document.getElementById('nb-doc-name').value = '';
        document.getElementById('nb-doc-performed').value = '';
        document.getElementById('nb-doc-file').value = '';
        document.getElementById('nb-doc-add-popup').style.display = 'flex';
    });
    document.getElementById('nb-doc-cancel').addEventListener('click', () => { document.getElementById('nb-doc-add-popup').style.display = 'none'; });
    document.getElementById('nb-doc-pick-btn').addEventListener('click', () => document.getElementById('nb-doc-file').click());
    document.getElementById('nb-doc-file').addEventListener('change', () => {
        const file = document.getElementById('nb-doc-file').files[0];
        if (file) {
            document.getElementById('nb-doc-file-name').textContent = file.name;
            if (!document.getElementById('nb-doc-name').value.trim()) document.getElementById('nb-doc-name').value = file.name.replace(/\.[^.]+$/, '');
        }
    });
    document.getElementById('nb-doc-save').addEventListener('click', () => {
        const nb = current();
        const file = document.getElementById('nb-doc-file').files[0];
        if (!file) return;
        const name = document.getElementById('nb-doc-name').value.trim() || file.name;
        const performed = document.getElementById('nb-doc-performed').value;
        const reader = new FileReader();
        reader.onload = () => {
            if (!nb.docs) nb.docs = [];
            nb.docs.push({ name, fileName: file.name, size: file.size, sizeLabel: formatBytes(file.size), performed, data: reader.result, type: file.type, uploaded: new Date().toISOString() });
            saveNeighborhoods();
            document.getElementById('nb-doc-add-popup').style.display = 'none';
            renderDocs();
        };
        reader.readAsDataURL(file);
    });
    document.getElementById('nb-show-all-docs').addEventListener('click', () => {
        const nb = current();
        if (!nb || !nb.docs || !nb.docs.length) return;
        if (nb.docs[0]) previewDoc(nb.docs[0]);
    });

    function formatBytes(bytes) {
        if (!bytes) return '';
        const KB = 1024, MB = 1024 * 1024;
        if (bytes >= MB) return (bytes / MB).toFixed(1) + ' MB';
        if (bytes >= KB) return (bytes / KB).toFixed(1) + ' KB';
        return bytes + ' B';
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /* Document preview popup (injected) */
    function ensurePreview() {
        if (document.getElementById('nb-doc-preview')) return;
        const ov = document.createElement('div');
        ov.id = 'nb-doc-preview';
        ov.className = 'popup-overlay';
        ov.innerHTML = '<div class="preview-card"><div class="preview-head"><span class="preview-title">Document</span><button type="button" class="preview-close">&#10005;</button></div><div class="preview-body"></div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.style.display = 'none'; });
        ov.querySelector('.preview-close').addEventListener('click', () => { ov.style.display = 'none'; });
    }
    ensurePreview();

    /* "Add people" via roles - a small add-role button is useful */
    render();
});

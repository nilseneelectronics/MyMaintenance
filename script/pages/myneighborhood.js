document.addEventListener('DOMContentLoaded', () => {
    let neighborhoods = [];
    let currentId = getParam('id');

    /* current logged-in user (creator becomes admin) */
    const me = Object.assign({ name: '', email: '', phone: '' }, window.MyMaintenanceProfileData.getProfile());

    function getParam(name) {
        const p = new URLSearchParams(location.search);
        return p.get(name);
    }

    function current() { return neighborhoods.find(n => n.id === currentId) || null; }

    function todayLabel() {
        const date = new Date();
        return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + date.getFullYear();
    }

    function fileFormat(file) {
        if (!file) return '';
        const extension = (file.name.split('.').pop() || '').toUpperCase();
        return extension || file.type || 'File';
    }

    function rowToNeighborhood(row) {
        const details = row && row.details && typeof row.details === 'object' ? row.details : {};
        return Object.assign({}, details, { id: row.id, _dbId: row.id, _ownerId: row.owner_id, name: row.name || details.name || '' });
    }

    function neighborhoodDetails(nb) {
        const copy = JSON.parse(JSON.stringify(nb || {}));
        delete copy.id;
        delete copy._dbId;
        delete copy._ownerId;
        delete copy.name;
        delete copy._deletedAddresses;
        ['photos', 'docs'].forEach(function (key) {
            if (Array.isArray(copy[key])) copy[key].forEach(function (item) {
                delete item.dataUrl;
                delete item.data;
                delete item.loading;
                delete item.loadError;
            });
        });
        return copy;
    }

    async function persistNeighborhood(nb) {
        const db = window.MyMaintenanceData;
        if (!db) throw new Error('Please sign in again.');
        const body = { name: nb.name, details: neighborhoodDetails(nb) };
        let saved;
        if (nb._dbId) {
            saved = await db.request('neighborhoods', {
                method: 'PATCH', query: { id: 'eq.' + nb._dbId }, body: body, prefer: 'return=representation'
            });
        } else {
            const ownerId = await db.userId();
            if (!ownerId) throw new Error('Please sign in again.');
            body.owner_id = ownerId;
            saved = await db.request('neighborhoods', {
                method: 'POST', body: body, prefer: 'return=representation'
            });
        }
        const cloud = rowToNeighborhood(Array.isArray(saved) ? saved[0] : saved);
        Object.assign(nb, cloud);
        return nb;
    }

    function saveNeighborhoods() {
        const nb = current();
        if (!nb) return Promise.resolve();
        return persistNeighborhood(nb).catch(function (error) {
            console.error(error);
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not save neighborhood.');
            return null;
        });
    }

    async function loadNeighborhoods() {
        const db = window.MyMaintenanceData;
        if (!db) return;
        try {
            const rows = await db.request('neighborhoods', {
                query: { select: 'id,owner_id,name,details', order: 'name.asc' }
            });
            neighborhoods = (rows || []).map(rowToNeighborhood);
            if (!currentId || !current()) currentId = neighborhoods[0] ? neighborhoods[0].id : null;
            render();
        } catch (error) {
            console.error(error);
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not load neighborhoods.');
        }
    }

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
    function isCreatorPerson(person) {
        if (!person) return false;
        return Boolean((me.id && person.userId === me.id) ||
            (me.email && String(person.email || '').toLowerCase() === String(me.email).toLowerCase()) ||
            (me.name && String(person.name || '').trim().toLowerCase() === String(me.name).trim().toLowerCase()));
    }

    function ensureAddressPeople(addr, idx) {
        addr.people = Array.isArray(addr.people) ? addr.people : [];
        if (addr.inviteEmail) {
            addr.people.push({ name: '', phone: '', email: addr.inviteEmail, role: 'edit', invitationStatus: addr.invitationStatus || '' });
            delete addr.inviteEmail;
            delete addr.invitationStatus;
        }
        if (idx === 0 && isAdmin && !addr.people.some(isCreatorPerson)) {
            addr.people.unshift({ userId: me.id || '', name: me.name || '', phone: me.phone || '', email: me.email || '', role: 'admin' });
        }
        if (!addr.people.length) addr.people.push({ name: '', phone: '', email: '', role: 'edit' });
    }

    function removePerson(addr) {
        const people = addr.people || [];
        if (people.length <= 1) return;
        let target = people.findIndex(person => !isCreatorPerson(person) && !(person.name || person.phone || person.email));
        if (target < 0) {
            for (let i = people.length - 1; i >= 0; i--) {
                if (!isCreatorPerson(people[i])) { target = i; break; }
            }
        }
        if (target >= 0) people.splice(target, 1);
    }

    function addPerson(addr) {
        addr.people = addr.people || [];
        addr.people.push({ name: '', phone: '', email: '', role: 'edit' });
    }

    function makePeopleControl(addr, idx) {
        const wrap = document.createElement('div');
        wrap.className = 'nb-people-control';
        const count = (addr.people || []).length;
        const stepper = document.createElement('div');
        stepper.className = 'nb-stepper';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.className = 'minus';
        minus.textContent = '−';
        minus.disabled = count <= 1 || !addr.people.some(person => !isCreatorPerson(person));
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
        return Boolean(nb && nb._ownerId && me.id && nb._ownerId === me.id);
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
        ensureAddressPeople(addr, idx);
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
        input.disabled = !isAdmin;
        head.appendChild(lbl);
        head.appendChild(input);
        head.appendChild(makePeopleControl(addr, idx));
        block.appendChild(head);

        const peopleWrap = document.createElement('div');
        peopleWrap.className = 'nb-people-wrap';
        addr.people.forEach((person, personIndex) => {
            const creator = isCreatorPerson(person);
            const joined = Boolean(person.userId && !creator);
            const line = document.createElement('div');
            line.className = 'nb-house-invite-row nb-person-invite-line';
            const personLabel = document.createElement('span');
            personLabel.textContent = creator ? 'Creator' : ('Person ' + (personIndex + 1));
            let emailControl;
            if (!isAdmin && !creator && !joined) {
                emailControl = document.createElement('select');
                const empty = document.createElement('option');
                empty.value = '';
                empty.textContent = 'Select family member';
                emailControl.appendChild(empty);
                window.MyMaintenanceProfileData.getFamily().filter(member =>
                    member.id !== me.id && !['invited', 'pending', 'draft'].includes(member.status)
                ).forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.email || '';
                    option.textContent = member.name + (member.email ? ' (' + member.email + ')' : '');
                    option.selected = option.value === (person.email || '');
                    if (option.value) emailControl.appendChild(option);
                });
            } else {
                emailControl = document.createElement('input');
                emailControl.type = 'email';
                emailControl.placeholder = 'resident@example.com';
                emailControl.value = person.email || '';
                emailControl.readOnly = creator || joined;
            }
            emailControl.dataset.field = 'personEmail';
            emailControl.dataset.person = String(personIndex);
            const status = document.createElement('span');
            status.className = 'nb-invite-status';
            status.textContent = creator ? (person.name || me.name || 'Neighborhood creator') :
                (joined ? (person.name || 'Joined') : (person.invitationStatus === 'invited' ? 'Invite pending' : ''));
            line.appendChild(personLabel);
            line.appendChild(emailControl);
            line.appendChild(status);
            if (!creator) {
                const invite = document.createElement('button');
                invite.type = 'button';
                invite.className = 'nb-send-invite-btn' + (person.invitationStatus === 'invited' ? ' pending' : '');
                invite.textContent = joined ? 'Joined' : (person.invitationStatus === 'invited' ? 'Invite sent' : 'Send invite');
                invite.disabled = joined || person.invitationStatus === 'invited';
                invite.addEventListener('click', async () => {
                    readBuilderIntoModel(builderModel);
                    await saveNeighborhoodForm({ addressIndex: idx, personIndex });
                });
                line.appendChild(invite);
            } else {
                const marker = document.createElement('span');
                marker.className = 'nb-creator-marker';
                marker.textContent = 'Added automatically';
                line.appendChild(marker);
            }
            peopleWrap.appendChild(line);
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
            block.querySelectorAll('[data-field="personEmail"]').forEach(emailControl => {
                const personIndex = Number(emailControl.dataset.person);
                if (!a.people[personIndex]) a.people[personIndex] = { name: '', phone: '', role: 'edit' };
                a.people[personIndex].email = emailControl.value.trim().toLowerCase();
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
        n = Math.max(1, parseInt(n, 10) || 1);
        if (!builderModel) return;
        document.getElementById('nb-houses').value = n;
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
            else next.push({ id: 'a' + Date.now() + '_' + i, address: '', people: [{ name: '', phone: '', email: '', role: 'edit' }] });
        }
        builderModel.addresses = next;
        renderBuilder();
    }

    /* ---- Info / register popup ---- */
    let openingInfo = false;
    async function openInfoPopup(nb) {
        if (openingInfo) return;
        let defaults;
        openingInfo = true;
        try {
            const loads = [window.MyMaintenanceProfileData.hydrate()];
            if (!nb) loads.push(window.MyMaintenanceAssets.hydrate());
            await Promise.all(loads);
            const profile = window.MyMaintenanceProfileData.getProfile();
            Object.assign(me, { id: profile.id || '', name: profile.name || '', email: profile.email || '', phone: profile.phone || '' });
            if (!nb) {
                defaults = window.MyMaintenanceNeighborhoodDefaults.create(profile,
                    window.MyMaintenanceAssets.getHomes(), window.MyMaintenanceProfileData.getFamily());
                if (!defaults) {
                    window.MyMaintenanceCommonUi.alert('Register a home with an address in My Homes before creating a neighborhood.');
                    return;
                }
            }
        } finally {
            openingInfo = false;
        }
        clearTimeout(housesTimer);
        document.getElementById('nb-addr-builder').innerHTML = '';
        document.getElementById('nb-info-popup-title').textContent = nb ? 'Edit Neighborhood' : 'Register a neighborhood';
        isAdmin = !nb || isMeAdmin(nb);
        builderModel = nb ? JSON.parse(JSON.stringify(nb)) : defaults;
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
        ['nb-name', 'nb-houses', 'nb-houses-minus', 'nb-houses-plus', 'nb-country', 'nb-zip', 'nb-city', 'nb-other'].forEach(id => {
            document.getElementById(id).disabled = Boolean(nb && !isAdmin);
        });
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
        const v = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
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
        clearTimeout(housesTimer);
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

    async function saveNeighborhoodForm(inviteTarget) {
        if (!builderModel) return;
        const onlyInviteTarget = inviteTarget && Number.isInteger(inviteTarget.addressIndex) && Number.isInteger(inviteTarget.personIndex)
            ? inviteTarget : null;
        clearTimeout(housesTimer);
        syncAddressCount(document.getElementById('nb-houses').value);
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
        document.querySelectorAll('#nb-addr-builder [data-field="personEmail"]').forEach(emailInput => {
            const email = emailInput.value.trim();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                markRequiredInvalid(emailInput);
                invalid = true;
                firstInvalid = firstInvalid || emailInput;
            } else {
                clearRequiredInvalid(emailInput);
            }
        });
        if (onlyInviteTarget) {
            const targetBlock = document.querySelector('#nb-addr-builder .nb-address-block[data-addr-idx="' + onlyInviteTarget.addressIndex + '"]');
            const targetEmail = targetBlock && targetBlock.querySelector('[data-field="personEmail"][data-person="' + onlyInviteTarget.personIndex + '"]');
            if (targetEmail && !targetEmail.value.trim()) {
                markRequiredInvalid(targetEmail);
                invalid = true;
                firstInvalid = firstInvalid || targetEmail;
            }
        }
        if (invalid) {
            if (firstInvalid) firstInvalid.focus();
            return;
        }
        cleanupBuilderModel(builderModel);
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
        try {
            await persistNeighborhood(builderModel);
        } catch (error) {
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not save neighborhood.');
            return;
        }
        const inviteTargets = [];
        (builderModel.addresses || []).forEach((address, addressIndex) => {
            (address.people || []).forEach((person, personIndex) => {
                if (onlyInviteTarget && (onlyInviteTarget.addressIndex !== addressIndex || onlyInviteTarget.personIndex !== personIndex)) return;
                if (!person.email || person.userId || isCreatorPerson(person) || person.invitationStatus === 'invited') return;
                inviteTargets.push({ address, person });
            });
        });
        try {
            for (const target of inviteTargets) {
                await window.MyMaintenanceAuth.familyRequest('invite-neighborhood-address', {
                    neighborhoodId: builderModel.id,
                    address: target.address.address,
                    email: target.person.email
                });
                target.person.invitationStatus = 'invited';
            }
            if (inviteTargets.length) await persistNeighborhood(builderModel);
        } catch (error) {
            const savedNeighborhood = current();
            if (savedNeighborhood && savedNeighborhood.id === builderModel.id) Object.assign(savedNeighborhood, builderModel);
            else if (!neighborhoods.some(item => item.id === builderModel.id)) neighborhoods.push(builderModel);
            currentId = builderModel.id;
            renderBuilder();
            window.MyMaintenanceCommonUi.alert(error.message || 'The neighborhood was saved, but the invitation could not be sent.');
            return;
        }
        if (existing && existing.id === builderModel.id) Object.assign(existing, builderModel);
        else neighborhoods.push(builderModel);
        currentId = builderModel.id;
        history.replaceState(null, '', 'myneighborhood.html?id=' + encodeURIComponent(currentId));
        if (onlyInviteTarget) {
            document.getElementById('nb-info-popup-title').textContent = 'Edit Neighborhood';
            renderBuilder();
            render();
            return;
        }
        document.getElementById('nb-info-popup').style.display = 'none';
        builderModel = null;
        render();
    }

    document.getElementById('nb-info-save').addEventListener('click', () => saveNeighborhoodForm());

    /* Delete neighborhood (admin only, edit mode) */
    document.getElementById('nb-info-delete').addEventListener('click', async () => {
        if (!builderModel) return;
        const id = builderModel.id;
        if (!await window.MyMaintenanceCommonUi.confirm('Delete this neighborhood? This cannot be undone.', { title: 'Delete neighborhood?', confirmLabel: 'Delete' })) return;
        try {
            await window.MyMaintenanceData.request('neighborhoods', {
                method: 'DELETE', query: { id: 'eq.' + id }
            });
        } catch (error) {
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not delete neighborhood.');
            return;
        }
        neighborhoods = neighborhoods.filter(n => n.id !== id);
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
                const pending = p.invitationStatus === 'invited';
                tag.className = 'nb-access-tag ' + (pending ? 'pending' : (p.role || 'view'));
                tag.textContent = pending ? 'Invite pending' : roleLabel(p.role);
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
        if (!nb) return;
        const today = window.MyMaintenanceEvents ? window.MyMaintenanceEvents.todayKey() : '';
        const sorted = (nb.events || []).slice()
            .filter(function (ev) { return !today || (ev.startDate || ev.date || '') >= today; })
            .sort((a, b) => (a.startDate || a.date || '').localeCompare(b.startDate || b.date || ''))
            .slice(0, 3);
        if (!sorted.length) {
            list.innerHTML = '<div class="nb-empty">No upcoming events.</div>';
            return;
        }
        list.innerHTML = '';
        sorted.forEach((ev, idx) => {
            const item = document.createElement('div');
            item.className = 'asset-planned-item';
            const name = document.createElement('strong');
            name.textContent = ev.name || 'Event';
            const info = document.createElement('div');
            info.className = 'planned-item-info';
            const start = ev.startDate || ev.date || '';
            const finish = ev.finishDate || ev.startDate || '';
            const startT = ev.startTime || ev.time || '';
            const finishT = ev.finishTime || '';
            const dateLabel = (start && finish && start !== finish)
                ? start + ' – ' + finish
                : (start || '');
            const timeLabel = (startT && finishT && startT !== finishT)
                ? startT + ' – ' + finishT
                : (startT || '');
            info.textContent = [dateLabel, timeLabel, ev.location ? ev.location : ''].filter(Boolean).join(' · ');
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
    let pendingPhotoUploads = [];
    function photosFor(nb) {
        if (!nb) return [];
        if (!Array.isArray(nb.photos)) nb.photos = [];
        return nb.photos;
    }
    function loadPrivateFile(item, onReady) {
        if (!item || item.dataUrl || item.loading || item.loadError || !item.filePath) return;
        const db = window.MyMaintenanceData;
        if (!db) return;
        item.loading = true;
        db.downloadDataUrl(item.filePath, item.type).then(function (dataUrl) {
            item.dataUrl = dataUrl;
            item.loading = false;
            item.loadError = false;
            if (typeof onReady === 'function') onReady();
        }).catch(function () {
            item.loading = false;
            item.loadError = true;
            if (typeof onReady === 'function') onReady();
        });
    }
    function photoPlaceholder(label) {
        const failed = label === 'Picture could not be loaded';
        const errorMark = failed
            ? '<path d="M354 132l34 34m0-34-34 34" fill="none" stroke="#AFEEEE" stroke-width="7" stroke-linecap="round"/>'
            : '';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
            <rect width="640" height="360" fill="#05141c"/>
            <g transform="translate(0 2)">
                <rect x="270" y="105" width="100" height="78" rx="10" fill="none" stroke="#20B2AA" stroke-width="7"/>
                <circle cx="300" cy="132" r="9" fill="#20B2AA"/>
                <path d="M280 169l27-25 19 18 13-12 21 19" fill="none" stroke="#20B2AA" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
                ${errorMark}
                <text x="320" y="224" text-anchor="middle" fill="#AFEEEE" font-family="Arial" font-size="18">${label}</text>
            </g>
        </svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }
    function photoSource(photo) {
        loadPrivateFile(photo, function () { render(); });
        if (photo && photo.dataUrl) return photo.dataUrl;
        return photoPlaceholder(photo && photo.loadError ? 'Picture could not be loaded' : 'Loading picture…');
    }
    function displayPhotosFor(nb) {
        return photosFor(nb);
    }
    function setMainPhoto() {
        const imgs = displayPhotosFor(current());
        const main = document.getElementById('nb-main-photo');
        const container = document.getElementById('nb-big-photo-container');
        const empty = !imgs.length;
        if (container) container.classList.toggle('is-empty', empty);
        if (container) container.classList.toggle('has-multiple-photos', imgs.length > 1);
        if (main) {
            main.hidden = empty;
            if (empty) main.removeAttribute('src');
            else main.src = photoSource(imgs[0]);
        }
        ['nb-prev-arrow', 'nb-next-arrow'].forEach(function (id) {
            const control = document.getElementById(id);
            if (control) control.hidden = imgs.length < 2;
        });
        const viewAll = document.getElementById('nb-view-all-photos');
        if (viewAll) viewAll.hidden = empty;
        renderNbThumbs();
    }
    function renderPhotoThumbs() {
        const nb = current();
        const grid = document.getElementById('nbp-photo-grid');
        const noPhotos = document.getElementById('nbp-no-photos');
        const imgs = pendingPhotoUploads;
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
            del.addEventListener('click', () => {
                imgs.splice(i, 1);
                renderPhotoThumbs();
            });
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
            img.src = photoSource(p);
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
        document.getElementById('nb-main-photo').src = photoSource(imgs[photoNavIndex]);
        document.getElementById('nb-gallery-modal').style.display = 'none';
        renderNbThumbs();
    }
    let photoNavIndex = 0;
    function nextPhoto(dir) {
        const imgs = displayPhotosFor(current());
        if (!imgs.length) return;
        photoNavIndex = (photoNavIndex + dir + imgs.length) % imgs.length;
        document.getElementById('nb-main-photo').src = photoSource(imgs[photoNavIndex]);
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
            img.style.display = '';
            if (has) {
                delete img.dataset.photoPlaceholder;
                img.src = photoSource(imgs[(photoNavIndex + 1 + i) % imgs.length]);
                img.alt = 'More photo';
            } else {
                const label = imgs.length ? 'Not enough pictures added' : 'No pictures added yet';
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><svg x="60" y="24" width="60" height="60" viewBox="0 -960 960 960"><path fill="#20B2AA" d="M480-480ZM180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h335q13 0 21.5 8.5T545-810q0 13-8.5 21.5T515-780H180v600h600v-335q0-13 8.5-21.5T810-545q13 0 21.5 8.5T840-515v335q0 24-18 42t-42 18H180Zm60-162h480L576-474 449-307l-94-124-115 149Zm453-410h-58q-13 0-21.5-8.5T605-722q0-13 8.5-21.5T635-752h58v-58q0-13 8.5-21.5T723-840q13 0 21.5 8.5T753-810v58h57q13 0 21.5 8.5T840-722q0 13-8.5 21.5T810-692h-57v57q0 13-8.5 21.5T723-605q-13 0-21.5-8.5T693-635v-57Z"/></svg><text x="90" y="137" text-anchor="middle" fill="#20B2AA" font-family="Arial" font-size="13">${label}</text></svg>`;
                img.dataset.photoPlaceholder = 'true';
                img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
                img.alt = 'Add photo';
            }
        });
        if (wrap) wrap.style.display = '';
    }
    const nbThumbsWrap = document.getElementById('nb-photo-thumbs');
    if (nbThumbsWrap) {
        nbThumbsWrap.addEventListener('click', (e) => {
            const t = e.target.closest('img');
            if (!t) return;
            if (t.dataset.photoPlaceholder === 'true') {
                document.getElementById('nb-add-photo-btn').click();
                return;
            }
            const imgs = displayPhotosFor(current());
            if (!imgs.length) return;
            const off = t === document.getElementById('nb-thumb-2') ? 2 : 1;
            photoNavIndex = (photoNavIndex + off) % imgs.length;
            document.getElementById('nb-main-photo').src = photoSource(imgs[photoNavIndex]);
            renderNbThumbs();
        });
    }

    /* ---- Documents ---- */
    function documentDateLabel(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? match[3] + '/' + match[2] + '/' + match[1] : String(value || '');
    }

    function neighborhoodDocumentIcon() {
        return '<svg class="doc-symbol" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M450-154v-309L180-619v309l270 156Zm60 0 270-156v-310L510-463.16V-154Zm-30-360 266-155-266-154-267 154 267 155ZM150-258q-14.25-8.43-22.12-22.21Q120-294 120-310v-340q0-16 7.88-29.79Q135.75-693.57 150-702l300-173q14.33-8 30.16-8 15.84 0 29.84 8l300 173q14.25 8.43 22.13 22.21Q840-666 840-650v340q0 16-7.87 29.79Q824.25-266.43 810-258L510-85q-14.33 8-30.16 8Q464-77 450-85L150-258Zm330-222Z"/></svg>';
    }
    function neighborhoodDocumentRow(item) {
        const extra = Object.assign({}, item);
        delete extra.id;
        delete extra.name;
        delete extra.performed;
        delete extra.filePath;
        delete extra.data;
        delete extra.payloadInDB;
        delete extra.homeId;
        delete extra.vehicleId;
        return {
            id: item.id,
            title: item.name,
            document_type: item.docType || null,
            document_date: item.performed || null,
            file_path: item.filePath || null,
            home_id: null,
            vehicle_id: null,
            extracted_data: extra
        };
    }

    function persistNeighborhoodDocument(item) {
        const db = window.MyMaintenanceData;
        if (!db || !item || !item.id) return;
        db.request('documents', {
            method: 'POST',
            query: { on_conflict: 'id' },
            body: neighborhoodDocumentRow(item),
            prefer: 'resolution=merge-duplicates,return=representation'
        }).catch(function (error) { console.error('Could not save neighborhood document:', error); });
    }

    function renderDocs() {
        const nb = current();
        const list = document.getElementById('nb-docs-list');
        if (!list) return;
        const asset = 'Neighborhood: ' + (nb ? nb.name || 'Neighborhood' : 'Neighborhood');
        let docs = [];
        if (window.MyMaintenanceDocs) docs = window.MyMaintenanceDocs.getItems().filter(function (d) {
            return String(d.asset || '').trim() === asset;
        });
        const recent = docs.slice().sort(function (a, b) {
            return String(b.uploaded || '').localeCompare(String(a.uploaded || ''));
        }).slice(0, 3);
        if (!recent.length) {
            list.innerHTML = '<div class="nb-empty">No documents registered.</div>';
            return;
        }
        list.innerHTML = '<div class="doc-row doc-header-row"><div class="doc-row-left"><span class="doc-cell doc-cell-icon"></span><span class="doc-cell doc-cell-name doc-col-label">Document</span></div><div class="doc-row-right"><span class="doc-cell doc-cell-performed doc-col-label">Performed</span><span class="doc-cell doc-cell-uploaded doc-col-label">Uploaded</span><span class="doc-cell doc-cell-size doc-col-label">Size</span><span class="doc-cell doc-cell-privacy doc-col-label">Privacy</span></div></div>';
        recent.forEach((d, idx) => {
            const row = document.createElement('div');
            row.className = 'doc-row doc-row-open';
            row.style.cursor = 'pointer';
            row.setAttribute('data-doc-id', d.id);
            const left = document.createElement('div');
            left.className = 'doc-row-left';
            left.innerHTML = neighborhoodDocumentIcon();
            const name = document.createElement('span');
            name.className = 'doc-cell doc-cell-name';
            name.textContent = d.name || d.fileName || 'Document';
            left.appendChild(name);
            const right = document.createElement('div');
            right.className = 'doc-row-right';
            [['doc-cell-performed', documentDateLabel(d.performed)], ['doc-cell-uploaded', documentDateLabel(d.uploaded)], ['doc-cell-size', d.sizeLabel || formatBytes(d.size)]].forEach((item) => {
                const cell = document.createElement('span');
                cell.className = 'doc-cell ' + item[0];
                cell.textContent = item[1];
                right.appendChild(cell);
            });
            const privacy = document.createElement('span');
            privacy.className = 'doc-cell doc-cell-privacy';
            const tag = document.createElement('span');
            const isNeighborhood = d.privacy === 'neighborhood';
            tag.className = 'doc-privacy-tag ' + (isNeighborhood ? 'neighborhood' : 'private');
            tag.textContent = isNeighborhood ? 'Neighborhood' : 'Private';
            privacy.appendChild(tag);
            right.appendChild(privacy);
            const editCell = document.createElement('span');
            editCell.className = 'doc-cell doc-cell-edit';
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'doc-edit-btn';
            editBtn.setAttribute('title', 'Edit document');
            editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
            editBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (window.MyMaintenanceDocs) window.MyMaintenanceDocs.openEdit(d);
            });
            editCell.appendChild(editBtn);
            right.appendChild(editCell);
            row.appendChild(left);
            row.appendChild(right);
            row.addEventListener('click', () => previewDoc(d));
            list.appendChild(row);
        });
    }
    async function previewDoc(d) {
        const ov = document.getElementById('nb-doc-preview');
        if (!ov) return;
        const body = ov.querySelector('.preview-body');
        body.innerHTML = '<div class="preview-note">Loading document…</div>';
        ov.style.display = 'flex';
        try {
            if (!d.data && d.filePath) d.data = await window.MyMaintenanceData.downloadDataUrl(d.filePath, d.type);
        } catch (error) {
            body.innerHTML = '<div class="preview-note">Could not load document.</div>';
            return;
        }
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
        const sharedReadOnly = false;
        ['nb-add-photo-btn', 'nb-add-event', 'nb-add-document', 'nb-add-neighbor'].forEach(function (id) {
            const control = document.getElementById(id);
            if (control) control.hidden = sharedReadOnly;
        });
        const neighborAction = document.getElementById('nb-add-neighbor');
        if (neighborAction) neighborAction.textContent = 'Edit neighborhood';
        renderNeighbors();
        renderEvents();
        renderDocs();
        setMainPhoto();
        renderNbThumbs();
    }

    window.addEventListener('mydocs:changed', function () {
        if (window.MyMaintenanceDocs && window.MyMaintenanceDocs.render) window.MyMaintenanceDocs.render();
        renderDocs();
    });

    /* ---- Wire events ---- */
    document.getElementById('nb-add-event').addEventListener('click', () => {
        if (!current()) return openInfoPopup(null);
        const pickers = window.MyMaintenanceEventPickers;
        const pad2 = function (n) { return String(n).padStart(2, '0'); };
        const now = new Date();
        const today = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
        const rounded = new Date(now);
        rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15, 0, 0);
        const h = pad2(rounded.getHours());
        const m = pad2(rounded.getMinutes());
        const later = new Date(rounded.getTime() + 60 * 60 * 1000);
        const h2 = pad2(later.getHours());
        const m2 = pad2(later.getMinutes());
        document.getElementById('nb-event-modal').style.display = 'flex';
        document.getElementById('nbe-name').value = '';
        if (pickers) {
            pickers.setDate(document.getElementById('nbe-start-date'), today);
            pickers.setDate(document.getElementById('nbe-finish-date'), today);
        }
        document.getElementById('nbe-start-time').value = h + ':' + m;
        document.getElementById('nbe-finish-time').value = h2 + ':' + m2;
        document.getElementById('nbe-location').value = '';
        document.getElementById('nbe-desc').value = '';
        document.getElementById('nbe-invite').checked = false;
        if (document.getElementById('nbe-name')) document.getElementById('nbe-name').focus();
    });
    document.getElementById('nbe-cancel').addEventListener('click', () => { document.getElementById('nb-event-modal').style.display = 'none'; });
    document.getElementById('nbe-save').addEventListener('click', () => {
        const nb = current();
        const name = document.getElementById('nbe-name').value.trim();
        if (!name) return;
        if (!nb.events) nb.events = [];
        const pickers = window.MyMaintenanceEventPickers;
        const startDate = pickers ? pickers.dateValue(document.getElementById('nbe-start-date')) : '';
        const finishDate = pickers ? pickers.dateValue(document.getElementById('nbe-finish-date')) : '';
        nb.events.push({
            name,
            startDate: startDate,
            finishDate: finishDate || startDate,
            startTime: document.getElementById('nbe-start-time').value,
            finishTime: document.getElementById('nbe-finish-time').value,
            location: document.getElementById('nbe-location').value,
            desc: document.getElementById('nbe-desc').value,
            inviteNeighborhood: document.getElementById('nbe-invite').checked
        });
        saveNeighborhoods();
        document.getElementById('nb-event-modal').style.display = 'none';
        renderEvents();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const modal = document.getElementById('nb-event-modal');
        if (modal && modal.style.display === 'flex') {
            e.preventDefault();
            modal.style.display = 'none';
        }
    });

    const nbEventModal = document.getElementById('nb-event-modal');
    if (nbEventModal) {
        nbEventModal.addEventListener('click', function (e) {
            if (e.target === nbEventModal) nbEventModal.style.display = 'none';
        });
    }

    const nbPickers = window.MyMaintenanceEventPickers;
    if (nbPickers) {
        nbPickers.attachDateField(document.getElementById('nbe-start-date'));
        nbPickers.attachDateField(document.getElementById('nbe-finish-date'), { finishDate: true });
        nbPickers.attachTimeField(document.getElementById('nbe-start-time'));
        nbPickers.attachTimeField(document.getElementById('nbe-finish-time'));
    }

    document.getElementById('nb-add-neighbor').addEventListener('click', () => {
        if (!current()) return openInfoPopup(null);
        // Add an empty address or ensure people can be added; open the info popup to edit people
        openInfoPopup(current());
    });

    /* Photos */
    document.getElementById('nb-add-photo-btn').addEventListener('click', () => {
        if (!current()) return openInfoPopup(null);
        pendingPhotoUploads = [];
        renderPhotoThumbs();
        document.getElementById('nb-add-photos-popup').style.display = 'flex';
    });
    const nbEmptyPhotoState = document.querySelector('#nb-big-photo-container .photo-empty-state');
    if (nbEmptyPhotoState) {
        const addFromEmptyState = () => document.getElementById('nb-add-photo-btn').click();
        nbEmptyPhotoState.addEventListener('click', addFromEmptyState);
        nbEmptyPhotoState.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                addFromEmptyState();
            }
        });
    }
    document.getElementById('nb-gallery-add-photo').addEventListener('click', () => {
        pendingPhotoUploads = [];
        renderPhotoThumbs();
        document.getElementById('nb-gallery-modal').style.display = 'none';
        document.getElementById('nb-add-photos-popup').style.display = 'flex';
    });
    const nbPhotoPopup = document.getElementById('nb-add-photos-popup');
    function closePhotoUploadPopup() {
        pendingPhotoUploads = [];
        nbPhotoPopup.style.display = 'none';
    }
    document.getElementById('nbp-cancel').addEventListener('click', closePhotoUploadPopup);
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || nbPhotoPopup.style.display !== 'flex') return;
        event.preventDefault();
        closePhotoUploadPopup();
    });
    document.addEventListener('click', (event) => {
        if (!event.target.closest('#nbp-cancel')) return;
        event.preventDefault();
        closePhotoUploadPopup();
    }, true);
    nbPhotoPopup.addEventListener('click', (event) => {
        if (event.target === nbPhotoPopup) closePhotoUploadPopup();
    });
    document.getElementById('nbp-save').addEventListener('click', async () => {
        const nb = current();
        if (!nb || !pendingPhotoUploads.length) {
            document.getElementById('nb-add-photos-popup').style.display = 'none';
            return;
        }
        const db = window.MyMaintenanceData;
        const userId = db && await db.userId();
        if (!db || !userId) return window.MyMaintenanceCommonUi.alert('Please sign in again.');
        try {
            const photos = photosFor(nb);
            for (const pending of pendingPhotoUploads) {
                const safeName = pending.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const photo = {
                    filePath: `${userId}/neighborhoods/${nb.id}/photos/${crypto.randomUUID()}-${safeName}`,
                    fileName: pending.file.name,
                    type: db.fileMime ? db.fileMime(pending.file) : pending.file.type,
                    dataUrl: pending.dataUrl
                };
                await db.upload(photo.filePath, pending.file);
                photos.push(photo);
            }
            await saveNeighborhoods();
            pendingPhotoUploads = [];
            document.getElementById('nb-add-photos-popup').style.display = 'none';
            render();
        } catch (error) {
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not upload picture.');
        }
    });
    nbPhotoPopup.addEventListener('keyup', (event) => {
        if (event.key !== 'Enter' || event.target.id === 'nbp-save') return;
        event.preventDefault();
        document.getElementById('nbp-save').click();
    });
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
    // Cancelling the native file picker leaves this popup and pending photos intact.
    document.getElementById('nbp-picture-btn').addEventListener('click', () => {
        photoInput.value = '';
        photoInput.click();
    });
    photoInput.addEventListener('change', async () => {
        const nb = current();
        const files = Array.prototype.slice.call(photoInput.files || []);
        photoInput.value = '';
        if (!nb || !files.length) return;
        try {
            await Promise.all(files.map(async function (file) {
                const reader = new FileReader();
                const dataUrl = await new Promise(function (resolve, reject) {
                    reader.onload = function () { resolve(reader.result); };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                pendingPhotoUploads.push({ file: file, dataUrl: dataUrl });
            }));
            renderPhotoThumbs();
        } catch (error) {
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not upload picture.');
        }
    });

    /* Documents */
    document.getElementById('nb-add-document').addEventListener('click', () => {
        const nb = current();
        if (!nb) return openInfoPopup(null);
        document.getElementById('nb-doc-file-name').textContent = 'No file selected';
        document.getElementById('nb-doc-name').value = '';
        document.getElementById('nb-doc-asset').value = nb.name || 'Neighborhood';
        document.getElementById('nb-doc-performed').value = '';
        document.getElementById('nb-doc-uploaded').value = todayLabel();
        document.getElementById('nb-doc-size').value = '';
        document.getElementById('nb-doc-format').value = '';
        document.getElementById('nb-doc-file').value = '';
        document.querySelectorAll('input[name="nb-doc-privacy"]').forEach((input) => {
            input.checked = input.value === 'neighborhood';
        });
        document.getElementById('nb-doc-add-popup').style.display = 'flex';
    });
    document.querySelectorAll('input[name="nb-doc-privacy"]').forEach((input) => {
        input.addEventListener('change', () => {
            if (!input.checked) return;
            document.querySelectorAll('input[name="nb-doc-privacy"]').forEach((other) => { other.checked = other === input; });
        });
    });
    document.getElementById('nb-doc-cancel').addEventListener('click', () => { document.getElementById('nb-doc-add-popup').style.display = 'none'; });
    const nbDocPopup = document.getElementById('nb-doc-add-popup');
    function closeDocAddPopup() {
        if (nbDocPopup) nbDocPopup.style.display = 'none';
    }
    nbDocPopup.addEventListener('click', (event) => {
        if (event.target === nbDocPopup) closeDocAddPopup();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !nbDocPopup || nbDocPopup.style.display !== 'flex') return;
        e.preventDefault();
        closeDocAddPopup();
    });
    document.getElementById('nb-doc-pick-btn').addEventListener('click', () => document.getElementById('nb-doc-file').click());
    document.getElementById('nb-doc-file').addEventListener('change', () => {
        const file = document.getElementById('nb-doc-file').files[0];
        if (file) {
            document.getElementById('nb-doc-file-name').textContent = file.name;
            if (!document.getElementById('nb-doc-name').value.trim()) document.getElementById('nb-doc-name').value = file.name.replace(/\.[^.]+$/, '');
            document.getElementById('nb-doc-size').value = formatBytes(file.size);
            document.getElementById('nb-doc-format').value = fileFormat(file);
        }
    });
    document.getElementById('nb-doc-save').addEventListener('click', async () => {
        const nb = current();
        const file = document.getElementById('nb-doc-file').files[0];
        if (!file) return;
        const name = document.getElementById('nb-doc-name').value.trim() || file.name;
        const performed = document.getElementById('nb-doc-performed').value;
        const privacy = (document.querySelector('input[name="nb-doc-privacy"]:checked') || {}).value || 'private';
        const db = window.MyMaintenanceData;
        const userId = db && await db.userId();
        if (!db || !userId) return window.MyMaintenanceCommonUi.alert('Please sign in again.');
        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const docType = fileFormat(file);
            const doc = {
                id: crypto.randomUUID(),
                name: name, fileName: file.name, size: file.size, sizeLabel: formatBytes(file.size), performed: performed,
                asset: 'Neighborhood: ' + (nb.name || 'Neighborhood'), privacy: privacy, docType: docType,
                type: db.fileMime ? db.fileMime(file) : file.type, uploaded: new Date().toISOString(),
                filePath: `${userId}/neighborhoods/${nb.id}/documents/${crypto.randomUUID()}-${safeName}`
            };
            await db.upload(doc.filePath, file);
            if (!nb.docs) nb.docs = [];
            nb.docs.push(doc);
            await saveNeighborhoods();
            persistNeighborhoodDocument(doc);
            document.getElementById('nb-doc-add-popup').style.display = 'none';
            if (window.MyMaintenanceDocs && window.MyMaintenanceDocs.refresh) {
                await window.MyMaintenanceDocs.refresh();
            }
            renderDocs();
        } catch (error) {
            window.MyMaintenanceCommonUi.alert(error.message || 'Could not upload document.');
        }
    });
    document.getElementById('nb-show-all-docs').addEventListener('click', () => {
        const nb = current();
        if (!nb) return openInfoPopup(null);
        window.MyMaintenanceDocumentContext = {
            asset: 'Neighborhood: ' + (nb.name || 'Neighborhood'),
            neighborhoodDocs: (nb.docs || []).slice()
        };
        window.location.href = '../pages/mydocuments.html';
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
    loadNeighborhoods();
});

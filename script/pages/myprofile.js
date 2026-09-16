/* myprofile.js - Profile page interactions */

(function () {
    var PD = window.MyMaintenanceProfileData;
    if (!PD) return;

    var profile, family, notifs;
    var peAvatar = '';
    var pendingAvatar = null;
    var pendingAvatarSource = null;
    var maMemberId = null;
    var transferContext = null;
    var transferRecipientId = null;
    var invRole = 'Member';

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function $(id) { return document.getElementById(id); }

    function loadAll() {
        profile = PD.getProfile();
        family = PD.getFamily();
        notifs = PD.getNotifications();
    }

    function ownerMember() {
        return family.find(function (m) { return m.role === 'Owner'; });
    }

    function currentFamilyMember() {
        return family.find(function (m) {
            return profile.id ? m.id === profile.id :
                profile.email && String(m.email || '').toLowerCase() === profile.email.toLowerCase();
        });
    }

    function canManageFamily() {
        var current = currentFamilyMember();
        return !!current && current.role === 'Owner' && !isPendingInvite(current);
    }

    function renderFamilyManagementControls() {
        var display = canManageFamily() ? '' : 'none';
        if ($('fam-invite')) $('fam-invite').style.display = display;
        if ($('access-invite')) $('access-invite').style.display = display;
    }

    /* ===================== TOAST ===================== */
    var toastEl = null;
    function toast(message, isError) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.toggle('error', !!isError);
        toastEl.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
    }

    /* ===================== OVERLAYS ===================== */
    var overlayCount = 0;
    function lockScroll() {
        overlayCount++;
        if (overlayCount === 1) document.body.style.overflow = 'hidden';
    }
    function unlockScroll() {
        overlayCount = Math.max(0, overlayCount - 1);
        if (overlayCount === 0) document.body.style.overflow = '';
    }
    function openOverlay(el) {
        if (el) {
            el.style.display = 'flex';
            lockScroll();
        }
    }
    function closeOverlay(el) {
        if (el && el.style.display === 'flex') {
            el.style.display = 'none';
            unlockScroll();
        }
    }

    /* ===================== SUB-HELPERS ===================== */
    function initials(name) {
        var parts = String(name || '?').trim().split(/\s+/);
        return ((parts[0] && parts[0][0]) || '') + ((parts[1] && parts[1][0]) || '');
    }

    function readFileAsDataURL(file, cb) {
        var reader = new FileReader();
        reader.onload = function () { cb(reader.result); };
        reader.readAsDataURL(file);
    }

    function splitPhone(value) {
        value = String(value || '').trim();
        var m = value.match(/^(\+\d{1,3})\s*(.*)$/);
        if (m) return { code: m[1], number: m[2] || '' };
        return { code: '+47', number: value };
    }

    function joinPhone(code, number) {
        code = String(code || '').trim().replace(/^0+/, '');
        if (!code) code = '+47';
        if (code.charAt(0) !== '+') code = '+' + code;
        number = String(number || '').trim();
        return number ? code + ' ' + number : '';
    }

    function setDropdownValue(dropdown, value) {
        if (!dropdown) return;
        var menu = dropdown.querySelector('.asset-menu');
        var valueEl = dropdown.querySelector('.asset-value');
        var btn = menu ? menu.querySelector('button[data-value="' + value + '"]') : null;
        if (menu) {
            menu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
            if (btn) btn.classList.add('selected');
        }
        if (valueEl) valueEl.textContent = btn ? btn.textContent.trim() : value;
    }

    function wireAssetDropdown(dropdown) {
        if (!dropdown) return;
        var toggle = dropdown.querySelector('.asset-toggle');
        var menu = dropdown.querySelector('.asset-menu');
        if (!toggle || !menu) return;

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            document.querySelectorAll('.asset-dropdown.open').forEach(function (d) {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });

        menu.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-value]');
            if (!btn) return;
            var value = btn.getAttribute('data-value');
            var label = btn.textContent.trim();
            menu.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            var valueEl = dropdown.querySelector('.asset-value');
            if (valueEl) valueEl.textContent = label;
            dropdown.classList.remove('open');
            if (typeof dropdown.__onChange === 'function') dropdown.__onChange(value, label);
        });
    }

    document.addEventListener('click', function () {
        document.querySelectorAll('.asset-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
    });

    /* ===================== HEADER ===================== */
    function addressText(p) {
        var parts = [];
        if (p.address) parts.push(p.address);
        var city = [];
        if (p.zip) city.push(p.zip);
        if (p.city) city.push(p.city);
        if (city.length) parts.push(city.join(' '));
        return parts.join(', ');
    }

    function renderHeader() {
        var avatarImg = $('profile-avatar');
        var avatarIcon = $('profile-avatar-icon');
        if (profile.avatar) {
            avatarImg.src = profile.avatar;
            avatarImg.style.display = '';
            avatarIcon.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarIcon.style.display = '';
        }
        $('pf-name').textContent = profile.name || '[Your Name]';
        $('pf-email').textContent = profile.email || '[Your Email]';
        $('pf-phone').textContent = profile.phone || '-';
        $('pf-address').textContent = addressText(profile) || '-';
    }

    /* ===================== EDIT PERSONAL INFORMATION ===================== */
    function updateEditAvatarPreview() {
        var preview = $('pe-avatar-preview');
        preview.innerHTML = '';
        if (peAvatar) {
            var img = document.createElement('img');
            img.src = peAvatar;
            preview.appendChild(img);
        } else {
            preview.textContent = initials(profile.name);
        }
        var has = !!peAvatar;
        $('pe-avatar-delete').style.display = has ? '' : 'none';
        $('pe-avatar-btn').textContent = has ? 'Change picture' : 'Add picture';
    }

    function openEditProfile() {
        $('pe-name').value = profile.name || '';
        $('pe-email').value = profile.email || '';
        var phone = splitPhone(profile.phone);
        $('pe-phone-code').value = phone.code;
        $('pe-phone').value = phone.number;
        $('pe-address').value = profile.address || '';
        $('pe-zip').value = profile.zip || '';
        $('pe-city').value = profile.city || '';
        peAvatar = profile.avatar || '';
        updateEditAvatarPreview();
        openOverlay($('profile-edit-popup'));
    }

    async function saveEditProfile() {
        if ($('pe-save').disabled) return;
        var name = $('pe-name').value.trim();
        var email = $('pe-email').value.trim();
        if (!name) { toast('Please enter your name.', true); return; }
        if (!EMAIL_RE.test(email)) { toast('Please enter a valid email address.', true); return; }

        profile = {
            id: profile.id,
            name: name,
            email: email,
            phone: joinPhone($('pe-phone-code').value, $('pe-phone').value),
            address: $('pe-address').value.trim(),
            zip: $('pe-zip').value.trim(),
            city: $('pe-city').value.trim(),
            avatar: peAvatar
        };
        $('pe-save').disabled = true;
        try {
            await PD.saveProfile(profile, true);
        } catch (error) {
            toast('Could not save your name to your account. Please try again.', true);
            return;
        } finally {
            $('pe-save').disabled = false;
        }

        var owner = family.find(function (m) { return m.id === profile.id; });
        if (owner) {
            owner.name = name;
            owner.email = email;
            PD.saveFamily(family);
        }
        var user = PD.getUser();
        user.name = name;
        user.email = email;
        PD.saveUser(user);

        renderHeader();
        renderMembers('family-list');
        renderMembers('access-list');
        renderAssets('home');
        renderAssets('vehicle');
        closeOverlay($('profile-edit-popup'));
        toast('Profile updated');
    }

    /* ===================== FAMILY / ACCESS ===================== */
    function isPendingInvite(member) {
        return ['invited', 'pending', 'draft'].includes(member.status);
    }

    function isIncomingInvite(member) {
        return !!member.incomingInvitation;
    }

    function renderMembers(listId) {
        var listEl = $(listId);
        if (!listEl) return;
        listEl.innerHTML = '';
        renderFamilyManagementControls();

        var error = PD.getFamilyLoadError();
        if (error || !family.length) {
            var hint = document.createElement('p');
            hint.className = 'profile-popup-hint';
            hint.textContent = error || 'No family members to display.';
            listEl.appendChild(hint);
        }

        var currentMember = currentFamilyMember();
        var mayManage = canManageFamily();
        var members = currentMember
            ? [currentMember].concat(family.filter(function (m) { return m !== currentMember; }))
            : family;
        members.forEach(function (m) {
            var pending = isPendingInvite(m);
            var incoming = isIncomingInvite(m);
            if ((pending || incoming) && listId === 'access-list') return;
            var row = document.createElement('div');
            row.className = 'profile-list-row';
            row.setAttribute('role', 'button');

            var avatar = document.createElement('span');
            avatar.className = 'profile-avatar-mini';
            avatar.textContent = initials(m.name);
            if (m.avatar) {
                var img = document.createElement('img');
                img.src = m.avatar;
                avatar.innerHTML = '';
                avatar.appendChild(img);
            }

            var main = document.createElement('div');
            main.className = 'profile-row-main';

            var title = document.createElement('div');
            title.className = 'profile-row-title';
            title.textContent = incoming ? (pending ? 'Family invitation' : 'Your family membership') : (m.name || 'Unnamed');
            var badge = document.createElement('span');
            badge.className = 'role-badge ' + (pending ? 'pending' : String(m.role || 'Member').toLowerCase());
            badge.textContent = pending ? 'Invite pending' : (m.role || 'Member');
            title.appendChild(badge);

            var sub = document.createElement('div');
            sub.className = 'profile-row-sub';
            sub.textContent = incoming
                ? (pending ? 'Accept this invitation to join the family.' : 'You are an active member of this family.')
                : m.email + (pending ? (m.sentAt ? ' — Awaiting acceptance' : ' — Email not sent') : '');

            main.appendChild(title);
            main.appendChild(sub);

            var actions = document.createElement('div');
            actions.className = 'profile-row-actions';
            if (incoming && pending) {
                var acceptInvite = document.createElement('button');
                acceptInvite.type = 'button'; acceptInvite.className = 'profile-row-btn'; acceptInvite.textContent = 'Accept invite';
                acceptInvite.onclick = async function (event) {
                    event.stopPropagation(); acceptInvite.disabled = true;
                    try {
                        await window.MyMaintenanceAuth.familyRequest('accept', { id: m.id });
                        await PD.hydrateFamily();
                        toast('Invitation accepted. You are now a family member.');
                    } catch (error) { toast(error.message, true); }
                    finally { acceptInvite.disabled = false; }
                };
                actions.appendChild(acceptInvite);
            } else if (pending && mayManage) {
                var cancelInvite = document.createElement('button');
                cancelInvite.type = 'button'; cancelInvite.className = 'profile-row-btn cancel-invite'; cancelInvite.textContent = 'Cancel invite';
                cancelInvite.onclick = async function (event) {
                    event.stopPropagation(); cancelInvite.disabled = true;
                    try {
                        if (m.serverInvitation) await window.MyMaintenanceAuth.familyRequest('cancel', { id: m.id });
                        family = family.filter(x => x.id !== m.id); PD.saveFamily(family); renderMembers('family-list');
                    } catch (error) { toast(error.message, true); }
                    finally { cancelInvite.disabled = false; }
                };
                actions.appendChild(cancelInvite);
            }
            if (mayManage && !pending && (m.role || 'Member') !== 'Owner') {
                var manage = document.createElement('button');
                manage.type = 'button';
                manage.className = 'profile-row-btn';
                manage.textContent = 'Manage access';
                manage.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openMemberAccess(m.id);
                });
                actions.appendChild(manage);
            }
            row.appendChild(avatar);
            row.appendChild(main);
            row.appendChild(actions);

            if (incoming && pending) {
                row.addEventListener('click', function () { toast('Use Accept invite to join this family.'); });
            } else if (pending) {
                row.addEventListener('click', function () {
                    toast(m.sentAt ? 'Waiting for this person to accept the invitation.' : 'This invitation has not been emailed. Email sending must be configured first.', !m.sentAt);
                });
            } else if ((m.role || 'Member') === 'Owner') {
                row.addEventListener('click', function () { toast(m.name + ' is the family owner.'); });
            } else if (mayManage) {
                row.addEventListener('click', function () { openMemberAccess(m.id); });
            }
            listEl.appendChild(row);
        });
    }

    async function inviteMemberToNeighborhood(member, button) {
        if (!member || button.disabled) return;
        button.disabled = true;
        button.textContent = 'Sending…';
        try {
            await window.MyMaintenanceAuth.familyRequest('invite-neighborhood', { recipientId: member.id });
            member.neighborhoodStatus = 'invited';
            PD.saveFamily(family);
            button.textContent = 'Invited';
            toast('Neighborhood invitation sent to ' + member.email);
        } catch (error) {
            button.disabled = false;
            button.textContent = 'Invite';
            toast(error.message || 'Could not send neighborhood invitation.', true);
        }
    }

    function buildToggleRows(container, items, values, locked, member) {
        container.innerHTML = '';
        items.forEach(function (item) {
            var label = document.createElement('label');
            label.className = 'profile-toggle' + (locked ? ' disabled' : '');
            var text = document.createElement('span');
            text.textContent = item.label;
            if (item.invitation) {
                var invite = document.createElement('button');
                invite.type = 'button';
                invite.className = 'profile-access-invite';
                var status = member && member.neighborhoodStatus;
                invite.textContent = locked ? 'Owner' : (status === 'active' ? 'Shared' : (status === 'invited' ? 'Invited' : 'Invite'));
                invite.disabled = locked || status === 'active' || status === 'invited';
                invite.addEventListener('click', function (event) {
                    event.preventDefault();
                    inviteMemberToNeighborhood(member, invite);
                });
                label.appendChild(text);
                label.appendChild(invite);
                container.appendChild(label);
                return;
            }
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!values[item.key];
            input.disabled = !!locked;
            var track = document.createElement('span');
            track.className = 'toggle-track';
            label.appendChild(text);
            label.appendChild(input);
            label.appendChild(track);
            input.addEventListener('change', function () { values[item.key] = input.checked; });
            container.appendChild(label);
        });
    }

    function openMemberAccess(id) {
        if (!canManageFamily()) {
            toast('Only the family owner can manage access.', true);
            return;
        }
        var m = family.find(function (x) { return x.id === id; });
        if (!m) return;
        if (isPendingInvite(m)) { toast('This person must accept their invitation before receiving access.', true); return; }
        maMemberId = id;
        var isOwner = (m.role || 'Member') === 'Owner';
        m.role = isOwner ? 'Owner' : (m.role || 'Member');
        if (!m.access) m.access = PD.presetAccess(m.role);

        $('ma-name').textContent = m.name + ' - ' + m.email;
        $('ma-remove').style.display = isOwner ? 'none' : '';
        $('ma-role-toggle').disabled = isOwner;
        setDropdownValue($('ma-role-dropdown'), m.role);

        if (isOwner) {
            $('ma-role-dropdown').__onChange = function () {};
        } else {
            $('ma-role-dropdown').__onChange = function (value) {
                if (value === 'Owner') return;
                m.role = value;
                var preset = PD.presetAccess(value);
                PD.ACCESS_AREAS.forEach(function (a) { m.access[a.key] = preset[a.key]; });
                buildToggleRows($('ma-toggles'), PD.ACCESS_AREAS, m.access, false, m);
            };
        }

        buildToggleRows($('ma-toggles'), PD.ACCESS_AREAS, m.access, isOwner, m);
        openOverlay($('member-access-popup'));
    }

    function saveMemberAccess() {
        var m = family.find(function (x) { return x.id === maMemberId; });
        if (!m) return;
        PD.saveFamily(family);
        renderMembers('family-list');
        renderMembers('access-list');
        renderAssets('home');
        renderAssets('vehicle');
        closeOverlay($('member-access-popup'));
        toast('Access saved for ' + m.name);
    }

    function removeMember() {
        var m = family.find(function (x) { return x.id === maMemberId; });
        if (!m) return;
        askConfirm('Remove "' + m.name + '" from your family?', async function () {
            if (m.serverInvitation) {
                try { await window.MyMaintenanceAuth.familyRequest('cancel', { id: m.id }); }
                catch (error) { toast(error.message, true); return; }
            }
            family = family.filter(function (x) { return x.id !== m.id; });
            PD.saveFamily(family);
            renderMembers('family-list');
            renderMembers('access-list');
            renderAssets('home');
            renderAssets('vehicle');
            closeOverlay($('member-access-popup'));
            toast(m.name + ' removed');
        });
    }

    /* ===================== INVITE ===================== */
    function openInvite() {
        $('inv-email').value = '';
        $('inv-neighborhood').checked = false;
        invRole = 'Member';
        setDropdownValue($('inv-role-dropdown'), 'Member');
        openOverlay($('invite-popup'));
    }

    async function sendInvite() {
        if ($('inv-send').disabled) return;
        var email = $('inv-email').value.trim();
        if (!EMAIL_RE.test(email)) { toast('Please enter a valid email address.', true); return; }
        var name = email.split('@')[0];
        if (family.some(function (x) { return x.email.toLowerCase() === email.toLowerCase() && (!isPendingInvite(x) || x.sentAt); })) {
            toast('This email is already part of your family.', true);
            return;
        }

        $('inv-send').disabled = true;
        $('inv-send').textContent = 'Sending…';
        try {
            const inviteNeighborhood = $('inv-neighborhood').checked;
            const result = await window.MyMaintenanceAuth.familyRequest('send', { name, email, role: invRole === 'Viewer' ? 'Viewer' : 'Member', inviteNeighborhood });
            if (inviteNeighborhood) result.member.neighborhoodStatus = 'invited';
            family = family.filter(x => x.email.toLowerCase() !== email.toLowerCase());
            family.push(result.member); PD.saveFamily(family);
            renderMembers('family-list'); renderMembers('access-list'); closeOverlay($('invite-popup'));
            toast(inviteNeighborhood ? 'Family and neighborhood invitation sent.' : 'Invitation sent. Waiting for acceptance.');
        } catch (error) { toast(error.message, true); }
        finally { $('inv-send').disabled = false; $('inv-send').textContent = 'Send invite'; }
    }

    /* ===================== CONNECTED ASSETS ===================== */
    function ownerLine(asset) {
        var me = family.find(function (m) {
            return profile.email && String(m.email || '').toLowerCase() === profile.email.toLowerCase();
        });
        var myId = profile.id || (me && me.id);
        var found = family.find(function (m) { return m.id === asset.ownerId; });
        var names = (!asset.ownerId || asset.ownerId === myId)
            ? [profile.name, found && found.name, asset.ownerName]
            : [asset.ownerName, found && found.name];
        var name = names.find(function (value) {
            return typeof value === 'string' && value.trim() && !/^(family member|you)$/i.test(value.trim());
        });
        return 'Owner: ' + (name ? name.trim() : 'Name unavailable');
    }

    function labelOf(kind, asset) {
        return kind === 'home'
            ? window.MyMaintenanceAssets.homeLabel(asset)
            : window.MyMaintenanceAssets.vehicleLabel(asset);
    }

    function renderAssets(kind) {
        var listEl = kind === 'home' ? $('homes-list') : $('vehicles-list');
        if (!listEl || !window.MyMaintenanceAssets) return;
        listEl.innerHTML = '';

        var assets = kind === 'home'
            ? window.MyMaintenanceAssets.getHomes()
            : window.MyMaintenanceAssets.getVehicles();

        if (!assets.length) {
            var empty = document.createElement('p');
            empty.className = 'profile-popup-hint';
            empty.textContent = kind === 'home'
                ? 'No homes registered yet.'
                : 'No vehicles registered yet.';
            listEl.appendChild(empty);
            return;
        }

        assets.forEach(function (asset) {
            var row = document.createElement('div');
            row.className = 'profile-list-row';
            row.setAttribute('role', 'button');

            var avatar = document.createElement('span');
            avatar.className = 'profile-avatar-mini';
            avatar.textContent = initials(asset.name);

            var main = document.createElement('div');
            main.className = 'profile-row-main';

            var title = document.createElement('div');
            title.className = 'profile-row-title';
            title.textContent = labelOf(kind, asset);

            var sub = document.createElement('div');
            sub.className = 'profile-row-sub';
            var typeAttr = kind === 'home' ? asset.houseType : asset.type;
            sub.textContent = ownerLine(asset) + (typeAttr ? ' - ' + typeAttr : '');

            main.appendChild(title);
            main.appendChild(sub);

            var actions = document.createElement('div');
            actions.className = 'profile-row-actions';

            var editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'profile-row-btn';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (kind === 'home') window.MyMaintenanceHomeRegister.open(asset);
                else window.MyMaintenanceVehicleRegister.open(asset);
            });

            var transferBtn = document.createElement('button');
            transferBtn.type = 'button';
            transferBtn.className = 'profile-row-btn';
            transferBtn.textContent = 'Transfer';
            transferBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                openTransfer(kind, asset);
            });

            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'profile-row-btn delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                askConfirm('Remove "' + labelOf(kind, asset) + '" from your account?', function () {
                    if (kind === 'home') window.MyMaintenanceAssets.deleteHome(asset.id);
                    else window.MyMaintenanceAssets.deleteVehicle(asset.id);
                    renderAssets('home');
                    renderAssets('vehicle');
                    toast('Removed ' + labelOf(kind, asset));
                });
            });

            actions.appendChild(editBtn);
            actions.appendChild(transferBtn);
            actions.appendChild(deleteBtn);

            row.appendChild(avatar);
            row.appendChild(main);
            row.appendChild(actions);
            listEl.appendChild(row);
        });
    }

    /* ===================== TRANSFER OWNERSHIP ===================== */
    function openTransfer(kind, asset) {
        transferContext = { kind: kind, id: asset.id };
        transferRecipientId = null;
        $('transfer-email').value = '';
        $('transfer-item-name').textContent = '"' + labelOf(kind, asset) + '" will be moved to a new owner.';

        var owner = ownerMember();
        var recipients = family.filter(function (m) {
            return !isPendingInvite(m) && (m.role || 'Member') !== 'Owner' && m.id !== (owner && owner.id);
        });

        var menu = $('transfer-recipient-menu');
        menu.innerHTML = '';
        $('transfer-recipient-value').textContent = recipients.length ? '-- Select a family member --' : 'No available members';

        recipients.forEach(function (m) {
            var li = document.createElement('li');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('data-value', m.id);
            btn.textContent = m.name + ' (' + m.email + ')';
            li.appendChild(btn);
            menu.appendChild(li);
        });

        openOverlay($('transfer-popup'));
    }

    async function transferTo(m) {
        var result = await window.MyMaintenanceAuth.familyRequest('transfer', {
            kind: transferContext.kind, assetId: transferContext.id, recipientId: m.id
        });
        await window.MyMaintenanceAssets.hydrate();
        renderAssets('home');
        renderAssets('vehicle');
        closeOverlay($('transfer-popup'));
        transferContext = null;
        toast('Ownership transferred to ' + m.name + (result.notified ? '. Email sent.' : '. Email could not be sent.'));
    }

    async function confirmTransfer() {
        if (!transferContext || $('transfer-save').disabled) return;
        var m = null;
        if (transferRecipientId) {
            m = family.find(function (x) { return x.id === transferRecipientId; });
            if (!m || isPendingInvite(m)) {
                toast('Recipient no longer exists as a member.', true);
                return;
            }
        } else {
            var email = $('transfer-email').value.trim().toLowerCase();
            if (!email) { toast('Please select a recipient or enter an email address.', true); return; }
            if (!EMAIL_RE.test(email)) { toast('Please enter a valid email address.', true); return; }
            var existing = family.find(function (x) { return x.email.toLowerCase() === email.toLowerCase(); });
            if (existing) { toast('Someone with that email is already part of your family.', true); return; }
            toast('Invite this person first. Ownership can be transferred after they accept.', true);
            return;
        }
        $('transfer-save').disabled = true;
        try { await transferTo(m); }
        catch (error) { toast(error.message || 'Could not transfer ownership.', true); }
        finally { $('transfer-save').disabled = false; }
    }

    /* ===================== CONFIRM ===================== */
    function askConfirm(message, onOk) {
        $('confirm-message').textContent = message;
        $('confirm-ok').onclick = function () {
            closeOverlay($('confirm-popup'));
            if (onOk) onOk();
        };
        openOverlay($('confirm-popup'));
    }

    /* ===================== PASSWORD ===================== */
    function openPassword() {
        $('pw-current').value = '';
        $('pw-new').value = '';
        $('pw-confirm').value = '';
        openOverlay($('password-popup'));
    }

    async function savePassword() {
        if ($('pw-save').disabled) return;
        var current = $('pw-current').value;
        var next = $('pw-new').value;
        var confirm = $('pw-confirm').value;
        if (next.length < 8) { toast('New password must be at least 8 characters.', true); return; }
        if (next !== confirm) { toast('The new passwords do not match.', true); return; }
        $('pw-save').disabled = true;
        try {
            const auth = window.MyMaintenanceAuth;
            const user = await auth._getSupabaseUser(await auth._getSupabaseSession());
            if (!user) throw new Error('Please sign in again.');
            const reauth = await auth._supabaseRequest('token?grant_type=password', { method: 'POST', body: { email: user.email, password: current } });
            if (!reauth.response.ok) throw new Error('Current password is incorrect.');
            const result = await auth._supabaseRequest('user', { method: 'PUT', accessToken: reauth.data.access_token, body: { password: next } });
            if (!result.response.ok) throw new Error(result.data.msg || 'Could not update password.');
            auth._storeSupabaseSession(reauth.data);
        } catch (error) { toast(error.message, true); return; }
        finally { $('pw-save').disabled = false; }
        $('pw-current').value = '';
        $('pw-new').value = '';
        $('pw-confirm').value = '';
        closeOverlay($('password-popup'));
        toast('Password updated');
    }

    async function sendResetLink() {
        if ($('fp-send').disabled) return;
        var email = $('fp-email').value.trim();
        if (!email) { toast('Please enter your email address first.', true); return; }
        if (!EMAIL_RE.test(email)) { toast('Please enter a valid email address.', true); return; }
        $('fp-send').disabled = true;
        try { await window.MyMaintenanceAuth.sendRecovery(email); }
        catch (error) { toast(error.message, true); return; }
        finally { $('fp-send').disabled = false; }
        $('fp-email').value = '';
        closeOverlay($('forgot-password-popup'));
        toast('If an account exists for ' + email + ', a reset link has been sent.');
    }

    /* ===================== NOTIFICATIONS ===================== */
    function openNotifications() {
        notifs = PD.getNotifications();
        buildToggleRows($('ntf-channels'), PD.NOTIF_CHANNELS, notifs.channels || {}, false);
        buildToggleRows($('ntf-types'), PD.NOTIF_TYPES, notifs.types || {}, false);
        openOverlay($('notification-popup'));
    }

    function saveNotifications() {
        PD.saveNotifications(notifs);
        closeOverlay($('notification-popup'));
        toast('Notification settings saved');
    }

    /* ===================== TERMS / DELETE ACCOUNT ===================== */
    function openDeleteAccount() {
        $('da-confirm').checked = false;
        openOverlay($('delete-account-popup'));
    }

    function deleteAccount() {
        if (!$('da-confirm').checked) {
            toast('Please confirm that you understand before deleting.', true);
            return;
        }
        var keys = [
            PD.PROFILE_KEY,
            PD.FAMILY_KEY,
            PD.NOTIF_KEY,
            PD.USER_KEY,
            PD.PASSWORD_KEY,
            'mymaintenance.authToken'
        ];
        keys.forEach(function (k) { localStorage.removeItem(k); });
        if (window.MyMaintenanceAuth) {
            window.location.href = window.MyMaintenanceAuth.resolvePageUrl('index.html');
        } else {
            window.location.href = '../index.html';
        }
    }

    /* ===================== INIT ===================== */
    document.addEventListener('DOMContentLoaded', function () {
        loadAll();

        toastEl = document.createElement('div');
        toastEl.className = 'profile-toast';
        toastEl.id = 'profile-toast';
        document.body.appendChild(toastEl);

        var myPopups = [
            'profile-edit-popup', 'avatar-confirm-popup', 'family-popup', 'access-popup', 'invite-popup',
            'member-access-popup', 'homes-popup', 'vehicles-popup', 'transfer-popup',
            'confirm-popup', 'password-popup', 'forgot-password-popup', 'notification-popup', 'terms-popup',
            'delete-account-popup'
        ];
        myPopups.forEach(function (id) {
            var el = $(id);
            if (el) el.addEventListener('click', function (e) { if (e.target === el) closeOverlay(el); });
        });

        wireAssetDropdown($('inv-role-dropdown'));
        wireAssetDropdown($('ma-role-dropdown'));
        wireAssetDropdown($('transfer-recipient-dropdown'));

        $('inv-role-dropdown').__onChange = function (value) { invRole = value; };
        $('transfer-recipient-dropdown').__onChange = function (value) {
            transferRecipientId = value;
            $('transfer-email').value = '';
        };
        $('transfer-email').addEventListener('input', function () {
            if (this.value.trim()) transferRecipientId = null;
        });

        $('btn-change-personal').addEventListener('click', openEditProfile);
        $('btn-family-settings').addEventListener('click', function () {
            renderMembers('family-list');
            openOverlay($('family-popup'));
            PD.hydrateFamily();
        });
        $('btn-connected-homes').addEventListener('click', function () {
            renderAssets('home');
            openOverlay($('homes-popup'));
        });
        $('btn-connected-vehicles').addEventListener('click', function () {
            renderAssets('vehicle');
            openOverlay($('vehicles-popup'));
        });
        $('btn-access-control').addEventListener('click', function () {
            renderMembers('access-list');
            openOverlay($('access-popup'));
            PD.hydrateFamily();
        });
        $('btn-view-terms').addEventListener('click', function () { openOverlay($('terms-popup')); });
        $('btn-change-password').addEventListener('click', openPassword);
        $('btn-notification-settings').addEventListener('click', openNotifications);
        $('btn-delete-account').addEventListener('click', openDeleteAccount);

        /* edit personal popup */
        $('pe-cancel').addEventListener('click', function () { closeOverlay($('profile-edit-popup')); });
        $('pe-save').addEventListener('click', saveEditProfile);
        $('pe-avatar-btn').addEventListener('click', function () { $('pe-avatar-file').click(); });
        $('pe-avatar-delete').addEventListener('click', function () {
            askConfirm('Remove your profile picture?', function () {
                peAvatar = '';
                updateEditAvatarPreview();
                toast('Picture removed');
            });
        });
        $('pe-avatar-file').addEventListener('change', function () {
            var file = this.files && this.files[0];
            if (!file) return;
            this.value = '';
            readFileAsDataURL(file, function (dataUrl) {
                pendingAvatar = dataUrl;
                pendingAvatarSource = 'edit';
                $('avatar-confirm-img').src = dataUrl;
                openOverlay($('avatar-confirm-popup'));
            });
        });

        /* header avatar upload → confirm before saving */
        $('profile-upload').addEventListener('change', function () {
            var file = this.files && this.files[0];
            if (!file) return;
            this.value = '';
            readFileAsDataURL(file, function (dataUrl) {
                pendingAvatar = dataUrl;
                pendingAvatarSource = 'header';
                $('avatar-confirm-img').src = dataUrl;
                openOverlay($('avatar-confirm-popup'));
            });
        });
        $('avatar-confirm-cancel').addEventListener('click', function () {
            pendingAvatar = null;
            pendingAvatarSource = null;
            closeOverlay($('avatar-confirm-popup'));
        });
        $('avatar-confirm-ok').addEventListener('click', function () {
            if (pendingAvatar) {
                if (pendingAvatarSource === 'header') {
                    profile.avatar = pendingAvatar;
                    PD.saveProfile(profile);
                    renderHeader();
                    toast('Profile picture updated');
                } else {
                    peAvatar = pendingAvatar;
                    updateEditAvatarPreview();
                }
            }
            pendingAvatar = null;
            pendingAvatarSource = null;
            closeOverlay($('avatar-confirm-popup'));
        });

        /* family popup */
        $('fam-invite').addEventListener('click', openInvite);
        $('fam-close').addEventListener('click', function () { closeOverlay($('family-popup')); });

        /* access popup */
        $('access-invite').addEventListener('click', openInvite);
        $('access-close').addEventListener('click', function () { closeOverlay($('access-popup')); });

        /* invite popup */
        $('inv-cancel').addEventListener('click', function () { closeOverlay($('invite-popup')); });
        $('inv-send').addEventListener('click', sendInvite);

        /* member access popup */
        $('ma-cancel').addEventListener('click', function () { closeOverlay($('member-access-popup')); });
        $('ma-save').addEventListener('click', saveMemberAccess);
        $('ma-remove').addEventListener('click', removeMember);

        /* connected lists */
        $('homes-close').addEventListener('click', function () { closeOverlay($('homes-popup')); });
        $('vehicles-close').addEventListener('click', function () { closeOverlay($('vehicles-popup')); });

        /* transfer popup */
        $('transfer-cancel').addEventListener('click', function () { closeOverlay($('transfer-popup')); });
        $('transfer-save').addEventListener('click', confirmTransfer);

        /* confirm popup */
        $('confirm-cancel').addEventListener('click', function () { closeOverlay($('confirm-popup')); });

        /* password popup */
        $('pw-cancel').addEventListener('click', function () { closeOverlay($('password-popup')); });
        $('pw-save').addEventListener('click', savePassword);
        $('pw-forgot').addEventListener('click', function (e) {
            e.preventDefault();
            $('fp-email').value = '';
            openOverlay($('forgot-password-popup'));
        });

        /* forgot password popup */
        $('fp-cancel').addEventListener('click', function () { closeOverlay($('forgot-password-popup')); });
        $('fp-send').addEventListener('click', sendResetLink);

        /* notification popup */
        $('ntf-cancel').addEventListener('click', function () { closeOverlay($('notification-popup')); });
        $('ntf-save').addEventListener('click', saveNotifications);

        /* terms popup */
        $('terms-close').addEventListener('click', function () { closeOverlay($('terms-popup')); });

        /* delete account popup */
        $('da-cancel').addEventListener('click', function () { closeOverlay($('delete-account-popup')); });
        $('da-delete').addEventListener('click', deleteAccount);

        /* asset edit events refresh the lists */
        window.addEventListener('home:registered', function () { renderAssets('home'); });
        window.addEventListener('vehicle:registered', function () { renderAssets('vehicle'); });
        window.addEventListener('assets:changed', function () {
            renderAssets('home'); renderAssets('vehicle');
        });

        /* Escape cancels, Enter saves (edit popup, picture confirm, manage access, confirm dialogs) */
        function isOpen(id) {
            var el = $(id);
            return !!el && el.style.display === 'flex';
        }
        function cancelTopmost() {
            if (isOpen('register-home-popup') || isOpen('register-vehicle-popup')) { return; }
            if (isOpen('avatar-confirm-popup')) { $('avatar-confirm-cancel').click(); return; }
            if (isOpen('confirm-popup')) { $('confirm-cancel').click(); return; }
            if (isOpen('profile-edit-popup')) { $('pe-cancel').click(); return; }
            if (isOpen('member-access-popup')) { $('ma-cancel').click(); return; }
            if (isOpen('invite-popup')) { $('inv-cancel').click(); return; }
            if (isOpen('family-popup')) { $('fam-close').click(); return; }
            if (isOpen('access-popup')) { $('access-close').click(); return; }
            if (isOpen('transfer-popup')) { $('transfer-cancel').click(); return; }
            if (isOpen('homes-popup')) { $('homes-close').click(); return; }
            if (isOpen('vehicles-popup')) { $('vehicles-close').click(); return; }
            if (isOpen('terms-popup')) { $('terms-close').click(); return; }
            if (isOpen('forgot-password-popup')) { $('fp-cancel').click(); return; }
            if (isOpen('password-popup')) { $('pw-cancel').click(); return; }
            if (isOpen('notification-popup')) { $('ntf-cancel').click(); return; }
            if (isOpen('delete-account-popup')) { $('da-cancel').click(); return; }
        }
        function confirmTopmost() {
            var t = document.activeElement;
            var isButton = t && (t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA');
            if (isButton) return;
            if (isOpen('avatar-confirm-popup')) { $('avatar-confirm-ok').click(); return; }
            if (isOpen('confirm-popup')) { $('confirm-ok').click(); return; }
            if (isOpen('profile-edit-popup')) { saveEditProfile(); return; }
            if (isOpen('member-access-popup')) { $('ma-save').click(); return; }
            if (isOpen('forgot-password-popup')) { sendResetLink(); return; }
            if (isOpen('password-popup')) { savePassword(); return; }
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelTopmost();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmTopmost();
            }
        });

        renderHeader();
        renderMembers('family-list');
        renderMembers('access-list');
        renderAssets('home');
        renderAssets('vehicle');
        window.addEventListener('profile:changed', function () {
            loadAll();
            renderHeader();
            renderMembers('family-list'); renderMembers('access-list');
            renderAssets('home'); renderAssets('vehicle');
        });
        window.addEventListener('focus', function () { PD.hydrateFamily(); });
        PD.hydrate();
    });
})();

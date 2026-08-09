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
        $('pe-phone').value = profile.phone || '';
        $('pe-address').value = profile.address || '';
        $('pe-zip').value = profile.zip || '';
        $('pe-city').value = profile.city || '';
        peAvatar = profile.avatar || '';
        updateEditAvatarPreview();
        openOverlay($('profile-edit-popup'));
    }

    function saveEditProfile() {
        var name = $('pe-name').value.trim();
        var email = $('pe-email').value.trim();
        if (!name) { toast('Please enter your name.', true); return; }
        if (!EMAIL_RE.test(email)) { toast('Please enter a valid email address.', true); return; }

        profile = {
            name: name,
            email: email,
            phone: $('pe-phone').value.trim(),
            address: $('pe-address').value.trim(),
            zip: $('pe-zip').value.trim(),
            city: $('pe-city').value.trim(),
            avatar: peAvatar
        };
        PD.saveProfile(profile);

        var owner = ownerMember();
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
    function renderMembers(listId) {
        var listEl = $(listId);
        if (!listEl) return;
        listEl.innerHTML = '';

        family.forEach(function (m) {
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
            title.textContent = m.name || 'Unnamed';
            var badge = document.createElement('span');
            badge.className = 'role-badge ' + String(m.role || 'Member').toLowerCase();
            badge.textContent = m.role || 'Member';
            title.appendChild(badge);

            var sub = document.createElement('div');
            sub.className = 'profile-row-sub';
            sub.textContent = m.email + (m.status === 'invited' ? ' - Invitation pending' : '');

            main.appendChild(title);
            main.appendChild(sub);

            var actions = document.createElement('div');
            actions.className = 'profile-row-actions';
            if ((m.role || 'Member') !== 'Owner') {
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

            if ((m.role || 'Member') === 'Owner') {
                row.addEventListener('click', function () { toast('You are the account owner.'); });
            } else {
                row.addEventListener('click', function () { openMemberAccess(m.id); });
            }
            listEl.appendChild(row);
        });
    }

    function buildToggleRows(container, items, values, locked) {
        container.innerHTML = '';
        items.forEach(function (item) {
            var label = document.createElement('label');
            label.className = 'profile-toggle' + (locked ? ' disabled' : '');
            var text = document.createElement('span');
            text.textContent = item.label;
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
        var m = family.find(function (x) { return x.id === id; });
        if (!m) return;
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
                buildToggleRows($('ma-toggles'), PD.ACCESS_AREAS, m.access, false);
            };
        }

        buildToggleRows($('ma-toggles'), PD.ACCESS_AREAS, m.access, isOwner);
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
        askConfirm('Remove "' + m.name + '" from your family? They will lose access immediately.', function () {
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
        $('inv-name').value = '';
        $('inv-email').value = '';
        invRole = 'Member';
        setDropdownValue($('inv-role-dropdown'), 'Member');
        openOverlay($('invite-popup'));
    }

    function sendInvite() {
        var name = $('inv-name').value.trim();
        var email = $('inv-email').value.trim();
        if (!name) { toast('Please enter the name.', true); return; }
        if (!EMAIL_RE.test(email)) { toast('Please enter a valid email address.', true); return; }
        if (family.some(function (x) { return x.email.toLowerCase() === email.toLowerCase(); })) {
            toast('This email is already part of your family.', true);
            return;
        }

        var role = invRole === 'Owner' ? 'Member' : invRole;
        family.push({
            id: 'fam_' + Date.now(),
            name: name,
            email: email,
            role: role,
            status: 'invited',
            access: PD.presetAccess(role)
        });
        PD.saveFamily(family);
        renderMembers('family-list');
        renderMembers('access-list');
        closeOverlay($('invite-popup'));
        toast('Invitation sent to ' + email);
    }

    /* ===================== CONNECTED ASSETS ===================== */
    function ownerLine(asset) {
        var owner = ownerMember();
        if (!asset.ownerId || asset.ownerId === (owner && owner.id)) return 'Owner: You';
        var found = family.find(function (m) { return m.id === asset.ownerId; });
        if (found) return 'Owner: ' + found.name;
        return asset.ownerName ? 'Owner: ' + asset.ownerName : 'Owner: Someone else';
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
            return m.status !== 'invited' && (m.role || 'Member') !== 'Owner' && m.id !== (owner && owner.id);
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

    function transferTo(m, note) {
        if (transferContext.kind === 'home') {
            window.MyMaintenanceAssets.updateHome(transferContext.id, { ownerId: m.id, ownerName: m.name });
        } else {
            window.MyMaintenanceAssets.updateVehicle(transferContext.id, { ownerId: m.id, ownerName: m.name });
        }
        renderAssets('home');
        renderAssets('vehicle');
        closeOverlay($('transfer-popup'));
        transferContext = null;
        toast('Ownership transferred to ' + m.name + note);
    }

    function confirmTransfer() {
        if (!transferContext) return;
        var m = null;
        var note = '';
        if (transferRecipientId) {
            m = family.find(function (x) { return x.id === transferRecipientId; });
            if (!m) {
                toast('Recipient no longer exists as a member.', true);
                return;
            }
        } else {
            var email = $('transfer-email').value.trim().toLowerCase();
            if (!email) { toast('Please select a recipient or enter an email address.', true); return; }
            if (!EMAIL_RE.test(email)) { toast('Please enter a valid email address.', true); return; }
            var existing = family.find(function (x) { return x.email.toLowerCase() === email.toLowerCase(); });
            if (existing) { toast('Someone with that email is already part of your family.', true); return; }
            var name = email.split('@')[0].replace(/[._\-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
            m = {
                id: 'fam_' + Date.now(),
                name: name || email,
                email: email,
                role: 'Member',
                status: 'invited',
                access: PD.presetAccess('Member')
            };
            family.push(m);
            PD.saveFamily(family);
            renderMembers('family-list');
            renderMembers('access-list');
            note = ' (invite sent)';
        }
        transferTo(m, note);
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

    function savePassword() {
        var current = $('pw-current').value;
        var next = $('pw-new').value;
        var confirm = $('pw-confirm').value;
        if (next.length < 8) { toast('New password must be at least 8 characters.', true); return; }
        if (next !== confirm) { toast('The new passwords do not match.', true); return; }
        if (PD.hasPassword() && !PD.verifyPassword(current)) { toast('Current password is incorrect.', true); return; }
        PD.setPassword(next);
        $('pw-current').value = '';
        $('pw-new').value = '';
        $('pw-confirm').value = '';
        closeOverlay($('password-popup'));
        toast('Password updated');
    }

    /* ===================== NOTIFICATIONS ===================== */
    function openNotifications() {
        notifs = PD.getNotifications();
        buildToggleRows($('ntf-toggles'), PD.NOTIF_TYPES, notifs, false);
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
            'confirm-popup', 'password-popup', 'notification-popup', 'terms-popup',
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
        }
        function confirmTopmost() {
            var t = document.activeElement;
            var isButton = t && (t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA');
            if (isButton) return;
            if (isOpen('avatar-confirm-popup')) { $('avatar-confirm-ok').click(); return; }
            if (isOpen('confirm-popup')) { $('confirm-ok').click(); return; }
            if (isOpen('profile-edit-popup')) { saveEditProfile(); return; }
            if (isOpen('member-access-popup')) { $('ma-save').click(); return; }
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
    });
})();
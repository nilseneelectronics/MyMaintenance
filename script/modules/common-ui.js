const commonDialogs = (function () {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('../../css/dialogs.css', document.currentScript.src).href;
    document.head.appendChild(stylesheet);
    const queue = [];
    let active = null;
    function next() {
        if (active || !queue.length) return;
        const request = queue.shift();
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        dialog.className = 'mm-message-dialog';
        dialog.setAttribute('aria-labelledby', 'mm-message-title');
        dialog.setAttribute('aria-describedby', 'mm-message-body');
        dialog.innerHTML = '<h3 id="mm-message-title"></h3><p id="mm-message-body"></p><div class="mm-message-actions"><button type="button" class="mm-message-cancel"></button><button type="button" class="mm-message-confirm"></button></div>';
        dialog.querySelector('h3').textContent = request.title || (request.confirm ? 'Please confirm' : 'MyMaintenance');
        dialog.querySelector('p').textContent = String(request.message);
        const cancel = dialog.querySelector('.mm-message-cancel');
        const confirm = dialog.querySelector('.mm-message-confirm');
        cancel.textContent = request.cancelLabel || 'Cancel';
        confirm.textContent = request.confirmLabel || (request.confirm ? 'Confirm' : 'OK');
        cancel.hidden = !request.confirm;
        function finish(value) {
            if (!active || active.dialog !== dialog) return;
            active = null;
            dialog.close();
            dialog.remove();
            if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
            request.resolve(value);
            next();
        }
        active = { dialog, finish, escapeResult: !!request.escapeResult };
        cancel.onclick = () => finish(false);
        confirm.onclick = () => finish(true);
        // Ignore the native Escape "cancel" that belongs to the same keydown
        // that opened this dialog; only handle cancels from later presses.
        let cancelReady = false;
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            if (!cancelReady) return;
            finish(active.escapeResult);
        });
        document.body.appendChild(dialog);
        dialog.showModal();
        setTimeout(function () { cancelReady = true; }, 0);
        (request.confirm ? cancel : confirm).focus();
    }
    // Keep keyboard events from reaching popups underneath this dialog.
    let suppressKeyUp = null;
    window.addEventListener('keydown', event => {
        if (!active) return;
        if (event.key === 'Escape' || event.key === 'Enter') {
            event.preventDefault();
            suppressKeyUp = event.key;
            if (!event.repeat) {
                if (event.key === 'Escape') active.finish(active.escapeResult);
                else active.finish(document.activeElement === active.dialog.querySelector('.mm-message-confirm'));
            }
        }
        event.stopImmediatePropagation();
    }, true);
    window.addEventListener('keyup', event => {
        if (active || event.key === suppressKeyUp) {
            event.stopImmediatePropagation();
            if (event.key === suppressKeyUp) { event.preventDefault(); suppressKeyUp = null; }
        }
    }, true);
    return function (message, options) {
        return new Promise(resolve => { queue.push(Object.assign({}, options, { message, resolve })); next(); });
    };
})();

window.MyMaintenanceCommonUi = {
    alert: function (message, options) { return commonDialogs(message, Object.assign({}, options, { confirm: false })); },
    confirm: function (message, options) { return commonDialogs(message, Object.assign({}, options, { confirm: true })); },
    confirmDiscard: function (onDiscard) {
        return this.confirm('Your unsaved changes will be lost.', {
            title: 'Discard changes?', cancelLabel: 'Keep editing', confirmLabel: 'Discard', escapeResult: true
        }).then(discard => { if (discard) onDiscard(); });
    },
    initCommonUiInteractions() {
        // Browsers change focused number fields when the user scrolls. Blur first
        // so the scroll keeps moving the page/modal instead of changing a value.
        document.addEventListener('wheel', function (event) {
            const input = event.target.closest('input[type="number"]');
            if (input && document.activeElement === input) input.blur();
        }, { passive: true });

        document.addEventListener('click', function (event) {
            const active = event.target.closest('.asset-dropdown');
            document.querySelectorAll('.asset-dropdown.open').forEach(function (dropdown) {
                if (dropdown !== active) dropdown.classList.remove('open');
            });
        }, true);

        document.querySelectorAll('.collapse-toggle').forEach((toggle) => {
            if (toggle.closest('#doc-groups')) return;
            const subgroup = toggle.closest('.subgroup');
            const content = subgroup ? subgroup.querySelector('.subgroup-content') : null;
            const icon = toggle.querySelector('svg');
            if (!content || !icon) return;

            if (content.style.display !== 'none') {
                icon.style.transform = 'rotate(180deg)';
            }

            toggle.addEventListener('click', () => {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        });

        document.querySelectorAll('.custom-dropdown').forEach((dropdown) => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const menu = dropdown.querySelector('.dropdown-menu');
            const span = toggle ? toggle.querySelector('span') : null;
            if (!toggle || !menu || !span) return;

            toggle.addEventListener('click', () => {
                const isOpen = menu.style.maxHeight !== '0px' && menu.style.maxHeight !== '';
                menu.style.maxHeight = isOpen ? '0px' : '300px';
                dropdown.classList.toggle('open', !isOpen);
            });

            menu.querySelectorAll('button').forEach((item) => {
                item.addEventListener('click', () => {
                    menu.querySelectorAll('button').forEach((btn) => btn.classList.remove('selected'));
                    item.classList.add('selected');
                    span.textContent = item.textContent;
                    menu.style.maxHeight = '0px';
                    dropdown.classList.remove('open');
                });
            });

            const initialText = span.textContent;
            menu.querySelectorAll('button').forEach((btn) => {
                if (btn.textContent === initialText) {
                    btn.classList.add('selected');
                }
            });

            document.addEventListener('click', (event) => {
                if (!dropdown.contains(event.target)) {
                    menu.style.maxHeight = '0px';
                    dropdown.classList.remove('open');
                }
            });
        });
    }
};

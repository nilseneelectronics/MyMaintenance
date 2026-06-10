window.MyMaintenanceCommonUi = {
    initCommonUiInteractions() {
        document.querySelectorAll('.collapse-toggle').forEach((toggle) => {
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

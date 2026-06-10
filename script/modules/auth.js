window.MyMaintenanceAuth = {
    _config: null,

    _getConfig() {
        if (this._config) return this._config;

        const defaults = {
            authTokenKey: 'mymaintenance.authToken',
            apiBaseUrl: 'http://localhost:3000',
            loggedInPages: [
                'dashboard.html',
                'myhomes.html',
                'myvehicles.html',
                'mydocuments.html',
                'myplanning.html',
                'mytools.html',
                'myprofile.html'
            ],
            publicOnlyPages: ['login.html']
        };

        this._config = Object.assign({}, defaults, window.MyMaintenanceConfig || {});
        return this._config;
    },

    _getTokenKey() {
        return this._getConfig().authTokenKey;
    },

    _getLoggedInPages() {
        return new Set(this._getConfig().loggedInPages || []);
    },

    _getPublicOnlyPages() {
        return new Set(this._getConfig().publicOnlyPages || []);
    },

    apiUrl(path) {
        const config = this._getConfig();
        const isBackendHost = window.location.port === '3000';
        return isBackendHost ? path : `${config.apiBaseUrl}${path}`;
    },

    async postJson(url, payload, token) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload || {})
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
    },

    async getJson(url, token) {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(url, { method: 'GET', headers });
        const data = await response.json().catch(() => ({}));
        return { response, data };
    },

    getCurrentPageName() {
        return location.pathname.split('/').pop() || 'index.html';
    },

    resolvePageUrl(page) {
        if (!page || page.startsWith('/') || page.startsWith('http') || page.startsWith('#') || page.startsWith('mailto:') || page.startsWith('tel:')) {
            return page;
        }

        const [pathname, query] = page.split('?');
        const queryPart = query ? `?${query}` : '';
        const isInPagesFolder = window.location.pathname.includes('/pages/');

        if (pathname === 'index.html') {
            return isInPagesFolder ? `../index.html${queryPart}` : `index.html${queryPart}`;
        }

        if (pathname.startsWith('..') || pathname.startsWith('pages/')) {
            return `${pathname}${queryPart}`;
        }

        return isInPagesFolder ? `${pathname}${queryPart}` : `pages/${pathname}${queryPart}`;
    },

    routeToLogin() {
        const currentPage = this.getCurrentPageName();
        const next = encodeURIComponent(currentPage);
        window.location.href = this.resolvePageUrl(`login.html?mode=signin&next=${next}`);
    },

    async enforceAuthRouting() {
        const page = this.getCurrentPageName();
        const loggedInPages = this._getLoggedInPages();
        const publicOnlyPages = this._getPublicOnlyPages();
        const tokenKey = this._getTokenKey();
        const isProtectedByPath = loggedInPages.has(page);
        const isProtectedByBody = document.body.classList.contains('logged-in');
        const requiresAuth = isProtectedByPath || isProtectedByBody;
        const token = localStorage.getItem(tokenKey);

        if (!requiresAuth) {
            if (publicOnlyPages.has(page) && token) {
                try {
                    const { response } = await this.getJson(this.apiUrl('/api/auth/session'), token);
                    if (response.ok) {
                        document.body.classList.add('logged-in');
                        window.location.href = 'dashboard.html';
                    }
                } catch (_) {
                    // Keep public pages accessible if backend is unavailable.
                }
            }
            return;
        }

        if (!token) {
            this.routeToLogin();
            return;
        }

        try {
            const { response } = await this.getJson(this.apiUrl('/api/auth/session'), token);
            if (!response.ok) {
                localStorage.removeItem(tokenKey);
                this.routeToLogin();
                return;
            }
            // valid session → mark page as logged-in so shared layout is inserted
            document.body.classList.add('logged-in');
        } catch (_) {
            // If backend is down, allow local preview but keep stored session token.
            // Mark as logged-in to allow navigation and layout when offline.
            document.body.classList.add('logged-in');
        }
    },

    initAuthInteractions() {
        const tokenKey = this._getTokenKey();
        const signinButton = document.getElementById('signin');
        const signupButton = document.getElementById('signup');
        const gobackButton = document.getElementById('goback');
        const signoutButton = document.getElementById('signout');
        const ctaSignupButton = document.getElementById('cta-signup');
        const ctaLearnButton = document.getElementById('cta-learn');
        const finalCtaButton = document.getElementById('final-cta');

        if (signinButton && signupButton) {
            signinButton.addEventListener('click', () => {
                window.location.href = this.resolvePageUrl('login.html?mode=signin');
            });
            signupButton.addEventListener('click', () => {
                window.location.href = this.resolvePageUrl('login.html?mode=signup');
            });
        }

        if (ctaSignupButton) {
            ctaSignupButton.addEventListener('click', () => {
                window.location.href = this.resolvePageUrl('login.html?mode=signup');
            });
        }

        if (ctaLearnButton) {
            ctaLearnButton.addEventListener('click', () => {
                document.querySelector('.content-section').scrollIntoView({ behavior: 'smooth' });
            });
        }

        if (finalCtaButton) {
            finalCtaButton.addEventListener('click', () => {
                window.location.href = this.resolvePageUrl('login.html?mode=signup');
            });
        }

        if (gobackButton) {
            gobackButton.addEventListener('click', () => {
                window.location.href = this.resolvePageUrl('index.html');
            });
        }

        if (signoutButton) {
            signoutButton.addEventListener('click', async () => {
                const token = localStorage.getItem(tokenKey);
                try {
                    await this.postJson(this.apiUrl('/api/auth/logout'), {}, token);
                } catch (_) {
                    // Keep UX working even when backend is unavailable.
                }
                localStorage.removeItem(tokenKey);
                alert('Signed out!');
                window.location.href = this.resolvePageUrl('index.html');
            });
        }

        const container = document.getElementById('auth-container');
        if (!container) return;

        const switchToSignup = document.getElementById('switch-to-signup');
        const switchToSignin = document.getElementById('switch-to-signin');
        const signinForm = document.getElementById('signin-form');
        const signupForm = document.getElementById('signup-form');
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get('mode') === 'signup') {
            container.classList.add('signup-mode');
        }

        if (switchToSignup) {
            switchToSignup.addEventListener('click', () => container.classList.add('signup-mode'));
        }

        if (switchToSignin) {
            switchToSignin.addEventListener('click', () => container.classList.remove('signup-mode'));
        }

        if (signinForm) {
            signinForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const inputs = signinForm.querySelectorAll('input');
                const email = (inputs[0]?.value || '').trim();
                const password = inputs[1]?.value || '';

                try {
                    const { response, data } = await this.postJson(
                        this.apiUrl('/api/auth/login'),
                        { email, password }
                    );
                    if (!response.ok || !data?.token) {
                        alert(data?.message || 'Invalid credentials.');
                        return;
                    }
                    localStorage.setItem(tokenKey, data.token);
                    const params = new URLSearchParams(window.location.search);
                    const next = params.get('next') || 'dashboard.html';
                    window.location.href = this.resolvePageUrl(next);
                } catch (_) {
                    localStorage.setItem(tokenKey, 'offline-token');
                    const params = new URLSearchParams(window.location.search);
                    const next = params.get('next') || 'dashboard.html';
                    window.location.href = this.resolvePageUrl(next);
                }
            });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', (event) => {
                event.preventDefault();
                alert('Sign Up submitted!');
            });
        }
    }
};


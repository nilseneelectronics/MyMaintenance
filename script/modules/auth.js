window.MyMaintenanceAuth = {
    _config: null,
    emailActionUrl() { return this._getConfig().emailActionUrl; },

    async sendRecovery(email) {
        const { response } = await this._supabaseRequest('recover?redirect_to=' + encodeURIComponent(this.emailActionUrl()), {
            method: 'POST', body: { email }
        });
        if (!response.ok) throw new Error(response.status === 429 ? 'Too many emails requested. Please try again later.' : 'Could not send reset email. Please try again.');
    },

    async familyRequest(action, payload = {}) {
        const session = await this._getSupabaseSession();
        if (!session) throw new Error('Please sign in first.');
        const config = this._getConfig();
        const response = await fetch(config.supabaseUrl + '/functions/v1/family-invitations', {
            method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.supabasePublishableKey, Authorization: 'Bearer ' + session.access_token },
            body: JSON.stringify({ ...payload, action })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Invitation service unavailable. Please try again later.');
        return data;
    },

    async supportRequest(message) {
        const session = await this._getSupabaseSession();
        if (!session) throw new Error('Please sign in first.');
        const config = this._getConfig();
        const response = await fetch(config.supabaseUrl + '/functions/v1/support-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: config.supabasePublishableKey, Authorization: 'Bearer ' + session.access_token },
            body: JSON.stringify({ message })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not send your request. Please try again later.');
        return data;
    },

    safeNext() {
        const next = new URLSearchParams(location.search).get('next') || 'dashboard.html';
        const file = next.split('?')[0];
        return [...this._getLoggedInPages(), 'email-action.html'].includes(file) ? next : 'dashboard.html';
    },

    _getConfig() {
        if (this._config) return this._config;

        const defaults = {
            authTokenKey: 'mymaintenance.authToken',
            authSessionKey: 'mymaintenance.supabaseSession',
            apiBaseUrl: 'http://localhost:3000',
            loggedInPages: [
                'dashboard.html',
                'myhomes.html',
                'myvehicles.html',
                'mydocuments.html',
                'myplanning.html',
                'mytools.html',
                'mytools 2.html',
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

    _getSessionKey() {
        return this._getConfig().authSessionKey;
    },

    hasSupabase() {
        const config = this._getConfig();
        return Boolean(config.supabaseUrl && config.supabasePublishableKey);
    },

    _clearSupabaseSession() {
        localStorage.removeItem(this._getTokenKey());
        localStorage.removeItem(this._getSessionKey());
    },

    _storeSupabaseSession(session) {
        if (!session?.access_token) return;
        if (!session.expires_at && session.expires_in) session = { ...session, expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in) };
        localStorage.setItem(this._getTokenKey(), session.access_token);
        localStorage.setItem(this._getSessionKey(), JSON.stringify(session));
    },

    _readSupabaseSession() {
        try {
            return JSON.parse(localStorage.getItem(this._getSessionKey()) || 'null');
        } catch (_) {
            this._clearSupabaseSession();
            return null;
        }
    },

    async _supabaseRequest(path, { method = 'GET', body, accessToken } = {}) {
        const config = this._getConfig();
        const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
            method,
            headers: {
                apikey: config.supabasePublishableKey,
                Authorization: `Bearer ${accessToken || config.supabasePublishableKey}`,
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
    },

    async _getSupabaseSession() {
        let session = this._readSupabaseSession();
        if (!session?.access_token) return null;

        if (!session.expires_at || session.expires_at * 1000 > Date.now() + 60_000) {
            return session;
        }
        if (!session.refresh_token) {
            this._clearSupabaseSession();
            return null;
        }

        try {
            const { response, data } = await this._supabaseRequest('token?grant_type=refresh_token', {
                method: 'POST',
                body: { refresh_token: session.refresh_token }
            });
            if (!response.ok || !data?.access_token) throw new Error('Session expired');
            session = data;
            this._storeSupabaseSession(session);
            return session;
        } catch (_) {
            this._clearSupabaseSession();
            return null;
        }
    },

    async _getSupabaseUser(session) {
        if (!session?.access_token) return null;
        try {
            const { response, data } = await this._supabaseRequest('user', {
                accessToken: session.access_token
            });
            return response.ok ? data : null;
        } catch (_) {
            return null;
        }
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

        if (this.hasSupabase()) {
            const session = await this._getSupabaseSession();
            const user = await this._getSupabaseUser(session);

            if (!requiresAuth) {
                if (publicOnlyPages.has(page) && user) {
                    document.body.classList.add('logged-in');
                    window.location.href = this.resolvePageUrl(this.safeNext());
                }
                return;
            }

            if (!user) {
                this._clearSupabaseSession();
                this.routeToLogin();
                return;
            }

            document.body.classList.add('logged-in');
            return;
        }

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
                    if (this.hasSupabase()) {
                        await this._supabaseRequest('logout', {
                            method: 'POST',
                            accessToken: token
                        });
                    } else {
                        await this.postJson(this.apiUrl('/api/auth/logout'), {}, token);
                    }
                } catch (_) {
                    // Keep UX working even when backend is unavailable.
                }
                this._clearSupabaseSession();
                window.location.href = this.resolvePageUrl('index.html');
            });
        }

        const container = document.getElementById('auth-container');
        if (!container) return;

        const switchToSignup = document.getElementById('switch-to-signup');
        const switchToSignin = document.getElementById('switch-to-signin');
        const signinForm = document.getElementById('signin-form');
        const signupForm = document.getElementById('signup-form');
        const forgotPasswordButton = document.getElementById('forgot-password');
        signinForm?.querySelector('input[type="email"]')?.focus();
        const resendButton = document.createElement('button');
        resendButton.type = 'button';
        resendButton.className = 'auth-forgot-password auth-resend-verification';
        resendButton.textContent = 'Resend verification email';
        signupForm?.querySelector('button[type="submit"]')?.after(resendButton);
        resendButton.addEventListener('click', async () => {
            const emailInput = signupForm?.querySelector('input[type="email"]');
            clearSignupMessage();
            if (!emailInput?.value || !emailInput.validity.valid) return showSignupError('Enter a valid email address first.', [emailInput]);
            resendButton.disabled = true;
            try {
                const { response } = await this._supabaseRequest('resend?redirect_to=' + encodeURIComponent(this.emailActionUrl()), { method: 'POST', body: { type: 'signup', email: emailInput.value.trim() } });
                if (!response.ok) throw new Error('Could not resend. Please wait before trying again.');
                if (signupMessage) {
                    signupMessage.textContent = 'If verification is needed, an email has been sent. Check your inbox and spam folder.';
                    signupMessage.classList.add('success');
                }
            } catch (error) { showSignupError(error.message); }
            finally { resendButton.disabled = false; }
        });
        const signinMessage = document.getElementById('signin-message');
        const signupMessage = document.getElementById('signup-message');
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

        const wireEnterSubmit = (form) => {
            if (!form) return;
            form.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                const t = event.target;
                if (t && (t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA')) return;
                event.preventDefault();
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            });
        };
        wireEnterSubmit(signinForm);
        wireEnterSubmit(signupForm);

        const clearSigninMessage = () => {
            if (signinMessage) {
                signinMessage.textContent = '';
                signinMessage.classList.remove('success');
            }
            if (signinForm) signinForm.querySelectorAll('input').forEach((input) => input.classList.remove('signin-invalid'));
        };

        const showSigninMessage = (message, success) => {
            if (signinMessage) {
                signinMessage.textContent = message;
                signinMessage.classList.toggle('success', !!success);
            }
        };

        const showInvalidLogin = () => {
            if (signinForm) signinForm.querySelectorAll('input').forEach((input) => {
                input.classList.remove('signin-invalid');
                void input.offsetWidth;
                input.classList.add('signin-invalid');
            });
            showSigninMessage('Invalid login credentials.');
        };

        const clearSignupMessage = () => {
            if (signupMessage) {
                signupMessage.textContent = '';
                signupMessage.classList.remove('success');
            }
            if (signupForm) signupForm.querySelectorAll('input').forEach((input) => input.classList.remove('signin-invalid'));
        };

        const showSignupError = (message, invalidInputs = []) => {
            invalidInputs.forEach((input) => {
                if (!input) return;
                input.classList.remove('signin-invalid');
                void input.offsetWidth;
                input.classList.add('signin-invalid');
            });
            if (signupMessage) {
                signupMessage.textContent = message;
                signupMessage.classList.remove('success');
            }
        };

        if (signinForm) signinForm.querySelectorAll('input').forEach((input) => {
            input.addEventListener('input', clearSigninMessage);
        });
        if (signupForm) signupForm.querySelectorAll('input').forEach((input) => {
            input.addEventListener('input', clearSignupMessage);
        });

        document.querySelectorAll('.password-toggle').forEach((button) => {
            const input = button.closest('.input-group')?.querySelector('input');
            if (!input) return;

            const applyType = () => {
                input.type = button.classList.contains('is-visible') ? 'text' : 'password';
            };

            button.addEventListener('click', () => {
                button.classList.toggle('is-visible');
                applyType();
                button.setAttribute('aria-label', button.classList.contains('is-visible') ? 'Hide password' : 'Show password');
            });

            button.addEventListener('mouseenter', () => {
                if (!button.classList.contains('is-visible')) input.type = 'text';
            });

            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('is-visible')) input.type = 'password';
            });
        });

        if (signinForm) {
            signinForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const inputs = signinForm.querySelectorAll('input');
                const email = (inputs[0]?.value || '').trim();
                const password = inputs[1]?.value || '';

                if (!email || !password) {
                    showInvalidLogin();
                    return;
                }

                try {
                    if (this.hasSupabase()) {
                        const { response, data } = await this._supabaseRequest('token?grant_type=password', {
                            method: 'POST',
                            body: { email, password }
                        });
                        if (!response.ok || !data?.access_token) {
                            if (data?.error_code === 'email_not_confirmed' || data?.code === 'email_not_confirmed') {
                                showSigninMessage('Please verify your email first. You can resend the verification email under Sign up.');
                                return;
                            }
                            showInvalidLogin();
                            return;
                        }
                        this._storeSupabaseSession(data);
                        const params = new URLSearchParams(window.location.search);
                        const next = this.safeNext();
                        window.location.href = this.resolvePageUrl(next);
                        return;
                    }

                    const { response, data } = await this.postJson(
                        this.apiUrl('/api/auth/login'),
                        { email, password }
                    );
                    if (!response.ok || !data?.token) {
                        showInvalidLogin();
                        return;
                    }
                    localStorage.setItem(tokenKey, data.token);
                    const params = new URLSearchParams(window.location.search);
                    const next = this.safeNext();
                    window.location.href = this.resolvePageUrl(next);
                } catch (_) {
                    if (this.hasSupabase()) {
                        showSigninMessage('Could not sign in. Please try again.');
                        return;
                    }
                    localStorage.setItem(tokenKey, 'offline-token');
                    const params = new URLSearchParams(window.location.search);
                    const next = this.safeNext();
                    window.location.href = this.resolvePageUrl(next);
                }
            });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const name = (document.getElementById('su-name')?.value || '').trim();
                const email = (document.getElementById('su-email')?.value || '').trim();
                const password = document.getElementById('su-password')?.value || '';
                const confirmPassword = document.getElementById('su-confirm')?.value || '';
                const phoneCode = (document.getElementById('su-phone-code')?.value || '+47').trim();
                const phoneNumber = (document.getElementById('su-phone')?.value || '').trim();
                const phone = phoneNumber ? phoneCode + ' ' + phoneNumber : '';
                const emailInput = document.getElementById('su-email');
                const emailIsValid = !!email && !!emailInput?.validity.valid;
                const messages = [];
                const invalidInputs = [];

                if (!name || !email || !password || !confirmPassword) messages.push('Please complete all fields.');
                if (!name) invalidInputs.push(document.getElementById('su-name'));
                if (!emailIsValid) {
                    messages.push('Invalid email.');
                    invalidInputs.push(emailInput);
                }
                if (!password || !confirmPassword || password !== confirmPassword) {
                    if (password && confirmPassword && password !== confirmPassword) messages.push('Passwords do not match.');
                    invalidInputs.push(document.getElementById('su-password'), document.getElementById('su-confirm'));
                }
                if (messages.length) {
                    showSignupError(messages.join(' '), invalidInputs);
                    return;
                }

                if (!this.hasSupabase()) {
                    window.MyMaintenanceCommonUi.alert('Sign up is not configured yet.');
                    return;
                }

                try {
                    const emailRedirectTo = this.emailActionUrl();
                    const { response, data } = await this._supabaseRequest('signup?redirect_to=' + encodeURIComponent(emailRedirectTo), {
                        method: 'POST',
                        body: {
                            email,
                            password,
                            data: { display_name: name, phone: phone }
                        }
                    });
                    if (!response.ok) {
                        const detail = String(data?.msg || data?.message || '').toLowerCase();
                        const invalidEmail = detail.includes('email') && (detail.includes('invalid') || detail.includes('valid'));
                        showSignupError(invalidEmail ? 'Invalid email.' : 'Could not create account.', invalidEmail ? [emailInput] : []);
                        return;
                    }
                    if (data?.access_token) this._storeSupabaseSession(data);
                    await window.MyMaintenanceCommonUi.alert(data?.access_token ? 'Your account is ready. You can sign in.' : 'Check your email to confirm your account before signing in.');
                    container.classList.remove('signup-mode');
                } catch (_) {
                    showSignupError('Could not connect. Please try again.');
                }
            });
        }

        if (forgotPasswordButton) {
            forgotPasswordButton.addEventListener('click', async () => {
                if (forgotPasswordButton.disabled) return;
                const email = (signinForm?.querySelector('input[type="email"]')?.value || '').trim();
                if (!email) {
                    showSigninMessage('Enter your email address first.');
                    return;
                }
                if (!this.hasSupabase()) {
                    showSigninMessage('Password reset is not configured.');
                    return;
                }
                forgotPasswordButton.disabled = true;
                try {
                    await this.sendRecovery(email);
                    showSigninMessage('If that account exists, a reset email was sent.', true);
                } catch (error) {
                    showSigninMessage(error.message || 'Could not send reset email. Please try again.');
                } finally { forgotPasswordButton.disabled = false; }
            });
        }
    }
};


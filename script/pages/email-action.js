(async function () {
    const auth = window.MyMaintenanceAuth;
    const params = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.slice(1));
    const message = document.getElementById('action-message');
    const title = document.getElementById('action-title');
    const form = document.getElementById('reset-form');
    const verify = document.getElementById('verify-link');
    const accept = document.getElementById('accept-invite');
    const signIn = document.getElementById('sign-in');
    const invitation = params.get('invitation');
    const type = params.get('type') || fragment.get('type');
    const tokenHash = params.get('token_hash');
    // Remove credentials before any further navigation or requests.
    history.replaceState(null, '', location.pathname + (invitation ? '?invitation=' + encodeURIComponent(invitation) : ''));
    let recoverySession = null;
    async function ready(session) {
        const user = await auth._getSupabaseUser(session);
        if (!user) throw new Error('This link is invalid or expired. Request a new email from the sign-in page.');
        if (type === 'recovery') {
            recoverySession = session;
            title.textContent = 'Set a new password';
            message.textContent = 'Enter your new password below.';
            form.hidden = false;
        } else {
            message.textContent = 'Your email is verified. You can now sign in.';
        }
    }
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const password = document.getElementById('new-password').value;
        if (password !== document.getElementById('repeat-password').value) { message.textContent = 'The passwords do not match.'; return; }
        const button = form.querySelector('button'); button.disabled = true;
        try {
            const { response, data } = await auth._supabaseRequest('user', { method: 'PUT', accessToken: recoverySession.access_token, body: { password } });
            if (!response.ok) throw new Error(data.msg || data.message || 'Could not update password. Request a new reset link.');
            form.reset(); form.hidden = true; recoverySession = null;
            auth._clearSupabaseSession();
            message.textContent = 'Password updated. Sign in with your new password.';
        } catch (error) { message.textContent = error.message; }
        finally { button.disabled = false; }
    });
    try {
        if (fragment.get('error') || params.get('error')) throw new Error('This email link is invalid or expired. Request a new email from the sign-in page.');
        if (invitation) {
            title.textContent = 'Family invitation';
            signIn.href = 'login.html?next=' + encodeURIComponent('email-action.html?invitation=' + invitation);
            const session = await auth._getSupabaseSession();
            if (!await auth._getSupabaseUser(session)) { message.textContent = 'Sign in or create an account with the invited email address, then return to this link to accept.'; return; }
            message.textContent = 'Accept to join this family. Your signed-in email must match the invitation.';
            accept.hidden = false;
            accept.onclick = async () => {
                accept.disabled = true;
                try { await auth.familyRequest('accept', { id: invitation }); accept.hidden = true; message.textContent = 'Invitation accepted. You are now a family member.'; signIn.href = 'myprofile.html'; signIn.textContent = 'Open my profile'; }
                catch (error) { message.textContent = error.message; }
                finally { accept.disabled = false; }
            };
        } else if (tokenHash && ['signup', 'email', 'recovery'].includes(type)) {
            message.textContent = 'Continue to verify your email link.'; verify.hidden = false;
            verify.onclick = async () => {
                verify.disabled = true;
                try {
                    const { response, data } = await auth._supabaseRequest('verify', { method: 'POST', body: { token_hash: tokenHash, type } });
                    if (!response.ok) throw new Error('This link is invalid or expired. Request a new email.');
                    verify.hidden = true; await ready(data);
                } catch (error) { message.textContent = error.message; }
                finally { verify.disabled = false; }
            };
        } else if (fragment.get('access_token')) {
            await ready({ access_token: fragment.get('access_token') });
        } else { message.textContent = 'Open the link from your verification or password reset email.'; }
    } catch (error) { message.textContent = error.message; }
})();

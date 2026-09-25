document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('support-request-form');
    const messageInput = document.getElementById('support-request-message');
    const status = document.getElementById('support-request-status');
    if (!form || !messageInput || !status) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = messageInput.value.trim();
        if (!message) {
            status.textContent = 'Please write a message first.';
            status.className = 'support-request-status error';
            messageInput.focus();
            return;
        }
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        status.textContent = 'Sending your request...';
        status.className = 'support-request-status';
        try {
            await window.MyMaintenanceAuth.supportRequest(message);
            messageInput.value = '';
            status.textContent = 'Your request was sent. A confirmation email is on its way.';
            status.className = 'support-request-status success';
        } catch (error) {
            status.textContent = /failed to fetch|networkerror|load failed/i.test(String(error.message || ''))
                ? 'We could not connect to vedlikeholdt.no. Check your internet connection and try again.'
                : (error.message || 'We could not send your request. Please try again.');
            status.className = 'support-request-status error';
        } finally {
            button.disabled = false;
        }
    });
});

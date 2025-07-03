document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMsg = document.getElementById('errorMsg');
  const submitBtn = document.getElementById('loginSubmitBtn');

  if (!loginForm || !errorMsg || !submitBtn) {
    // If any required element is missing, do nothing.
    return;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';
    errorMsg.className = '';

    // Grab inputs
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Presence validation
    if (!username) {
      errorMsg.textContent = 'Username is required.';
      errorMsg.classList.add('error');
      usernameInput.focus();
      return;
    }
    if (!password) {
      errorMsg.textContent = 'Password is required.';
      errorMsg.classList.add('error');
      passwordInput.focus();
      return;
    }

    // Loading state
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    errorMsg.classList.add('loading');

    try {
      const resp = await fetch('/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      errorMsg.classList.remove('loading');

      if (resp.ok) {
        // On successful login, redirect to the dashboard
        window.location.href = '/pages/dashboard.html';
      } else {
        let payload = {};
        try {
          payload = await resp.json();
        } catch (err) { /* empty */ }
        errorMsg.textContent = payload.error || 'Invalid credentials. Please try again.';
        errorMsg.classList.add('error');
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      errorMsg.classList.remove('loading');

      errorMsg.textContent = 'Server error. Please try again later.';
      errorMsg.classList.add('error');
    }
  });
});

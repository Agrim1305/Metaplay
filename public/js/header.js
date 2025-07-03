// Cache for user data to prevent multiple requests
let userDataCache = null;
let pendingAuthCheck = null;

// Function to update the header with authenticated navigation
function updateHeader(user) {
  const container = document.getElementById('header-include');
  if (!container) return;

  const isAdmin = user.role === 'admin';

  // Build authenticated navigation
  const authLinks = [
    { href: '/pages/profile.html', text: 'Profile' }
  ];

  if (isAdmin) {
    authLinks.push({ href: '/pages/admin.html', text: 'Admin' });
  }

  authLinks.push(
    { href: '/pages/seeAll.html?search=1', text: 'Search' },
    { href: '/pages/social.html', text: 'Social' },
    { href: '#', text: 'Logout', ariaLabel: 'Logout' }
  );

  const authNavHTML = authLinks
    .map((link) => {
      if (link.text === 'Logout') {
        return `<a href="#" id="btn-logout" aria-label="${link.ariaLabel || 'Logout'}">${link.text}</a>`;
      }
      return `<a href="${link.href}" aria-label="${link.text}">${link.text}</a>`;
    })
    .join('\n');

  const homeHref = '/pages/dashboard.html';

  // Update header with authenticated navigation
  container.innerHTML = `
    <header>
      <div class="container header-content">
        <h1>
          <a class="white" href="${homeHref}" aria-label="MetaPlay Home">MetaPlay</a>
        </h1>
        <nav>
          ${authNavHTML}
        </nav>
      </div>
    </header>
  `;

  // Wire up logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/auth/logout', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
          }
        });
        // Clear the cache on logout
        userDataCache = null;
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      } catch (err) {
        // Ignore logout errors - user will be redirected anyway
      }
    });
  }
}

// Function to handle authentication errors
function handleAuthError(err) {
  // Ignore authentication errors - user will be redirected anyway
}

// Load header when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('header-include');
  if (!container) return;

  // 1) Immediately show a minimal header with basic navigation
  const basicLinks = [
    { href: '/pages/registration.html', text: 'Register' },
    { href: '/pages/login.html', text: 'Login' }
  ];

  const basicNavHTML = basicLinks
    .map((link) => `<a href="${link.href}" aria-label="${link.text}">${link.text}</a>`)
    .join('\n');

  container.innerHTML = `
    <header>
      <div class="container header-content">
        <h1>
          <a class="white" href="/" aria-label="MetaPlay Home">MetaPlay</a>
        </h1>
        <nav>
          ${basicNavHTML}
        </nav>
      </div>
    </header>
  `;

  // 2) Then check authentication state in the background
  // Use a timeout to prevent blocking the main thread
  setTimeout(() => {
    // If we already have a pending auth check, use that
    if (pendingAuthCheck) {
      pendingAuthCheck.then(updateHeader).catch(handleAuthError);
      return;
    }

    // If we have cached data, use it
    if (userDataCache) {
      updateHeader(userDataCache);
      return;
    }

    // Otherwise, make a new request
    pendingAuthCheck = fetch('/get-user', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    })
      .then((resp) => {
        if (!resp.ok) {
          throw new Error('Not authenticated');
        }
        return resp.json();
      })
      .then((user) => {
        // Cache the user data
        userDataCache = user;
        return user;
      })
      .finally(() => {
        // Clear the pending check
        pendingAuthCheck = null;
      });

    pendingAuthCheck.then(updateHeader).catch(handleAuthError);
  }, 0);
});

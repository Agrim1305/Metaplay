/* global showToast */
(() => {
  const STATUS_MAP = {
    current: 'collection',
    wishlist: 'wishlist',
    completed: 'played'
  };

  let activeGameId = null;
  let modalGameData = null;

  // Generic fetch → JSON helper
  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...options });
    if (!res.ok) {
      throw new Error(`Fetch error (${res.status}): ${res.statusText}`);
    }
    return res.json();
  }

  // URL query & string helpers
  function getQueryParam(param) {
    return new URLSearchParams(window.location.search).get(param);
  }
  function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  // Empty / error grid messages
  function renderGridMessage(container, message, type = 'info') {
    const gridContainer = container;
    gridContainer.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = message;
    p.className = type === 'error' ? 'message-error' : 'message-info';
    gridContainer.appendChild(p);
  }

  // Generates 5 stars; if editable, calls onRate(newRating) on click
  function createStarRating(ratingValue = 0, editable = false, onRate = null) {
    const container = document.createElement('div');
    container.className = 'star-container';
    const current = Math.round(ratingValue);

    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement('span');
      star.textContent = i <= current ? '★' : '☆';
      star.className = i <= current ? 'star-full' : 'star-empty';

      if (editable && typeof onRate === 'function') {
        star.style.cursor = 'pointer';
        star.addEventListener('click', () => onRate(i));
      }
      container.appendChild(star);
    }
    return container;
  }

  // Renders the textarea + interactive stars + Save button
  function renderReviewSection({ review = '', rating = 0 }) {
    const section = document.getElementById('modalReviewSection');
    section.innerHTML = '';

    // Label + textarea
    const label = document.createElement('label');
    label.textContent = 'Your Review:';
    section.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write your review…';
    textarea.value = review;
    section.appendChild(textarea);

    // Star handler
    let currentRating = rating;
    function onRate(newRating) {
      currentRating = newRating;
      const newStars = createStarRating(currentRating, true, onRate);
      section.replaceChild(
        newStars,
        section.querySelector('.star-container')
      );
    }
    section.appendChild(createStarRating(currentRating, true, onRate));

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'action-btn';
    saveBtn.style.marginTop = '1rem';
    section.appendChild(saveBtn);

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        await fetchJSON('/user-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: activeGameId,
            review: textarea.value.trim() || null,
            rating: currentRating || null,
            gameName: modalGameData.name,
            releaseDate: modalGameData.released,
            metaRating: modalGameData.rating
          })
        });
        showToast('Review saved.');
      } catch (err) {
        showToast('Failed to save review.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });
  }

  // Try GET /user-review/:gameId; fall back to empty if error
  async function loadUserReview(gameId) {
    try {
      const data = await fetchJSON(`/user-review/${gameId}`);
      renderReviewSection(data);
    } catch (err) {
      renderReviewSection({ review: '', rating: 0 });
    }
  }

  // Remove from user list (collection/wishlist/played)
  async function removeGameFromUserList(gameId, listKey, cardEl) {
    try {
      const res = await fetch(`/user-games/${gameId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        cardEl.remove();
        showToast('Game removed.');
      } else {
        showToast('Failed to remove game.');
      }
    } catch (err) {
      showToast('Failed to remove game.');
    }
  }

  // Close modal
  function closeModal() {
    const modal = document.getElementById('gameModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    activeGameId = null;
    modalGameData = null;
  }

  // Add to wishlist/current/completed
  async function addToList(listKey) {
    try {
      await fetchJSON('/user-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: activeGameId,
          rating: null,
          review: null,
          status: STATUS_MAP[listKey]
        })
      });
      showToast(`Game added to ${listKey}.`);
    } catch (err) {
      showToast(`Failed to add to ${listKey}.`);
    } finally {
      closeModal();
    }
  }

  // Open modal, fetch game details, show reviewSection if released
  async function openGameModal(gameId) {
    activeGameId = gameId;
    const modal = document.getElementById('gameModal');
    const title = document.getElementById('modalTitle');
    const cover = document.getElementById('modalCover');
    const desc = document.getElementById('modalDesc');
    const rel = document.getElementById('modalRelease');
    const reviewSec = document.getElementById('modalReviewSection');
    const wishBtn = document.getElementById('addToWishlist');
    const currBtn = document.getElementById('addToCurrent');
    const compBtn = document.getElementById('addToCompleted');

    try {
      const game = await fetchJSON(
        `/rawg/games/${encodeURIComponent(gameId)}`
      );
      modalGameData = game;

      title.textContent = game.name || 'Unknown Title';
      cover.src = game.background_image || '/images/fallback_cover.png';
      cover.alt = game.name || 'Game Cover';
      desc.textContent = game.description_raw || 'No description available.';

      const releasedDate = game.released ? new Date(game.released) : null;
      const now = new Date();
      const upcoming = releasedDate && releasedDate > now;
      rel.textContent = upcoming
        ? `Releasing: ${game.released}`
        : `Released: ${game.released || 'N/A'}`;

      wishBtn.style.display = '';
      currBtn.style.display = upcoming ? 'none' : '';
      compBtn.style.display = upcoming ? 'none' : '';

      if (upcoming) {
        reviewSec.style.display = 'none';
      } else {
        reviewSec.style.display = '';
        await loadUserReview(gameId);
      }

      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    } catch (err) {
      showToast('Could not load game details.');
    }
  }

  // Build one card for "See All"
  function createSeeAllGameCard(game, listKey, showRemove) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.gameId = game.id;

    const thumb = document.createElement('div');
    thumb.className = 'game-thumb';
    if (game.background_image) {
      thumb.style.backgroundImage = `url('${game.background_image}')`;
    } else {
      thumb.style.backgroundColor = '#eee';
    }
    card.appendChild(thumb);

    // Add game title overlay
    const titleOverlay = document.createElement('div');
    titleOverlay.className = 'game-title-overlay';
    titleOverlay.textContent = game.name || 'Unknown Title';
    thumb.appendChild(titleOverlay);
    card.appendChild(thumb);

    if (showRemove) {
      const btn = document.createElement('button');
      btn.className = 'remove-game-btn';
      btn.title = `Remove from ${capitalizeFirstLetter(listKey)}`;
      btn.innerHTML = '&times;';
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        removeGameFromUserList(game.id, listKey, card);
      });
      card.appendChild(btn);
    }

    card.addEventListener('click', () => openGameModal(game.id));
    return card;
  }

  // Fill the grid with up to 40 games
  function renderGameGrid(container, games, listKey, showRemove) {
    const gridContainer = container;
    gridContainer.innerHTML = '';
    if (!Array.isArray(games) || games.length === 0) {
      renderGridMessage(gridContainer, 'No games in this list.');
      return;
    }
    games.forEach((game) => {
      gridContainer.appendChild(
        createSeeAllGameCard(game, listKey, showRemove)
      );
    });
  }

  // Bootstrap on page load
  document.addEventListener('DOMContentLoaded', () => {
    const category = getQueryParam('category');
    const grid = document.getElementById('seeAllGamesGrid');
    const heading = document.getElementById('seeAllHeader');
    const backBtn = document.getElementById('backToDashboard');
    const searchInput = document.getElementById('seeAllSearchInput');
    const searchBtn = document.getElementById('seeAllSearchBtn');
    const searchBar = document.getElementById('seeAllSearchBar');

    // Only show search bar if ?search=1 is present
    const urlParams = new URLSearchParams(window.location.search);
    const showSearch = urlParams.get('search') === '1';
    if (!showSearch && searchBar) {
      searchBar.style.display = 'none';
    }

    if (!grid || !heading) {
      return;
    }
    if (showSearch) {
      heading.textContent = 'Search';
    } else if (!category) {
      heading.textContent = 'Invalid configuration';
      return;
    }

    backBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      window.location.href = '/pages/dashboard.html';
    });

    if (!showSearch) {
      heading.textContent = `${capitalizeFirstLetter(category)} (loading…)`;
    } else {
      heading.textContent = 'Search';
      grid.innerHTML = '';
    }

    // Must be logged in
    fetchJSON('/get-user').catch(() => {
      window.location.replace('/pages/login.html');
    });

    // Modal controls
    const modalEl = document.getElementById('gameModal');
    modalEl.querySelector('.modal-close-btn')
      .addEventListener('click', closeModal);
    modalEl.addEventListener('click', (evt) => {
      if (evt.target === modalEl) {
        closeModal();
      }
    });
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && !modalEl.classList.contains('hidden')) {
        closeModal();
      }
    });
    document.getElementById('addToWishlist')
      .addEventListener('click', () => addToList('wishlist'));
    document.getElementById('addToCurrent')
      .addEventListener('click', () => addToList('current'));
    document.getElementById('addToCompleted')
      .addEventListener('click', () => addToList('completed'));

    // Search logic
    async function doSearch(query) {
      if (!query || query.trim().length < 2) {
        heading.textContent = 'Search';
        grid.innerHTML = '';
        return;
      }
      grid.innerHTML = '<em>Loading games…</em>';
      heading.textContent = 'Search';
      try {
        const data = await fetchJSON(
          `/rawg/games?search=${encodeURIComponent(query)}&page_size=40`
        );
        if (!data.results || data.results.length === 0) {
          renderGridMessage(grid, 'No games found.');
        } else {
          renderGameGrid(grid, data.results, category, false);
        }
      } catch (err) {
        renderGridMessage(grid, 'Error searching games.', 'error');
      }
    }

    function loadDefaultCategory() {
      if (!showSearch) {
        heading.textContent = `${capitalizeFirstLetter(category)} (loading…)`;
        grid.innerHTML = '<em>Loading games…</em>';
      } else {
        heading.textContent = 'Search';
        grid.innerHTML = '';
      }

      if (['current', 'wishlist', 'completed'].includes(category)) {
        fetchJSON(`/user-games?status=${STATUS_MAP[category]}`)
          .then((userGames) => {
            heading.textContent = `${capitalizeFirstLetter(category)} (${userGames.length} total)`;
            if (userGames.length === 0) {
              renderGridMessage(grid, 'No games in this list.');
              return null;
            }
            const ids = userGames.slice(0, 40).map((r) => r.gameId);
            return fetchJSON('/rawg/games/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids })
            });
          })
          .then((batchData) => {
            if (batchData) {
              renderGameGrid(grid, Object.values(batchData), category, true);
            }
          })
          .catch((err) => {
            if (err.status === 401) {
              window.location.replace('/pages/login.html');
            } else {
              renderGridMessage(grid, 'Error loading games.', 'error');
            }
          });
      } else if (!showSearch) {
        const today = new Date().toISOString().slice(0, 10);
        let apiUrl = '';
        if (category === 'trending') {
          const ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
          apiUrl = `/rawg/games?dates=${ago},${today}&ordering=-added&page_size=40`;
        } else if (category === 'comingSoon') {
          const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
          apiUrl = `/rawg/games?dates=${today},${in30}&ordering=-added&page_size=40`;
        } else {
          heading.textContent = `${capitalizeFirstLetter(category)} (0 total)`;
          renderGridMessage(grid, 'No games in this list.');
          return;
        }
        fetchJSON(apiUrl)
          .then((data) => {
            heading.textContent = `${capitalizeFirstLetter(category)} (${data.results.length} total)`;
            renderGameGrid(grid, data.results, category, false);
          })
          .catch((err) => {
            heading.textContent = `${capitalizeFirstLetter(category)} (0 total)`;
            renderGridMessage(grid, 'Error fetching games.', 'error');
          });
      }
    }

    // Event listeners for search
    searchBtn.addEventListener('click', () => {
      doSearch(searchInput.value.trim());
    });
    searchInput.addEventListener('keypress', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        doSearch(searchInput.value.trim());
      }
    });

    loadDefaultCategory();
  });
})();

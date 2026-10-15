/* global showToast */

(() => {
  const STATUS_MAP = {
    current: 'collection',
    wishlist: 'wishlist',
    completed: 'played'
  };

  const dom = {
    usernameSpan: document.getElementById('username'),
    grids: {
      current: document.getElementById('currentGamesGrid'),
      wishlist: document.getElementById('wishlistedGamesGrid'),
      completed: document.getElementById('completedGamesGrid'),
      trending: document.getElementById('trendingGamesGrid'),
      comingSoon: document.getElementById('comingSoonGrid')
    },
    seeAllBtns: {
      current: document.getElementById('currentSeeAll'),
      wishlist: document.getElementById('wishlistSeeAll'),
      completed: document.getElementById('completedSeeAll'),
      trending: document.getElementById('trendingSeeAll'),
      comingSoon: document.getElementById('comingSoonSeeAll')
    },
    logoutBtn: document.getElementById('btn-logout')
  };

  async function fetchJSON(url, options = {}) {
    // Always include credentials for authenticated endpoints
    const res = await fetch(url, { credentials: 'same-origin', ...options });
    if (!res.ok) {
      throw new Error(`Fetch error (${res.status}): ${res.statusText}`);
    }
    return res.json();
  }

  // Remove game from user list
  function removeGameFromList(gameId, listKey, cardElement) {
    fetch(`/user-games/${gameId}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    })
      .then((res) => {
        if (res.ok) {
          cardElement.remove();
          showToast('Game removed.');
        } else {
          showToast('Failed to remove game.');
        }
      })
      .catch(() => showToast('Failed to remove game'));
  }

  function createGameCard(game, listKey = null) {
    const card = document.createElement('div');
    card.classList.add('game-card');
    card.dataset.gameId = game.id;
    if (['current', 'wishlist', 'completed'].includes(listKey)) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-game-btn';
      removeBtn.title = 'Remove from this list';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeGameFromList(game.id, listKey, card);
      };
      card.appendChild(removeBtn);
    }
    const thumb = document.createElement('div');
    thumb.classList.add('game-thumb');
    if (game.background_image) {
      thumb.style.backgroundImage = `url("${game.background_image}")`;
    }
    // Add game title overlay
    const titleOverlay = document.createElement('div');
    titleOverlay.className = 'game-title-overlay';
    titleOverlay.textContent = game.name || 'Unknown Title';
    thumb.appendChild(titleOverlay);
    card.appendChild(thumb);

    card.addEventListener('click', () => { window.location.href = `/pages/game.html?id=${game.id}`; });
    return card;
  }

  function renderGameGrid(containerEl, games, listKey) {
    const container = containerEl;
    container.innerHTML = '';
    games.forEach((game) => {
      container.appendChild(createGameCard(game, listKey));
    });
  }

  function fetchAndRender(queryParams, gridElement, listKey) {
    const container = gridElement;
    container.innerHTML = '';
    const url = `/rawg/games?${queryParams}`;
    fetch(url) // RAWG: public, no credentials needed unless you protect it
      .then((res) => res.json())
      .then((data) => {
        if (data.results && Array.isArray(data.results)) {
          renderGameGrid(container, data.results, listKey);
        } else {
          container.innerHTML = '';
        }
      })
      .catch(() => {
        container.innerHTML = '';
      });
  }

  async function loadStoredList(listKey, gridElement) {
    const container = gridElement;
    container.innerHTML = '';
    try {
      await fetchJSON('/get-user');
    } catch (err) {
      const errP = document.createElement('p');
      errP.textContent = `Please log in to view your ${listKey} games.`;
      errP.classList.add('message-error');
      container.appendChild(errP);
      return;
    }
    let userGames;
    try {
      const status = STATUS_MAP[listKey];
      userGames = await fetchJSON(`/user-games?status=${status}`);
      if (!Array.isArray(userGames) || userGames.length === 0) {
        const infoP = document.createElement('p');
        infoP.textContent = `No ${listKey} games to show.`;
        infoP.classList.add('message-info');
        container.appendChild(infoP);
        return;
      }
    } catch (err) {
      const errP = document.createElement('p');
      errP.textContent = `Error loading ${listKey} games.`;
      errP.classList.add('message-error');
      container.appendChild(errP);
      return;
    }
    try {
      // RAWG: public
      const byId = await fetchJSON('/rawg/games/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: userGames.slice(0, 40).map((row) => row.gameId) })
      });
      renderGameGrid(container, Object.values(byId), listKey);
    } catch (err) {
      const errP = document.createElement('p');
      errP.textContent = `Error loading ${listKey} games.`;
      errP.classList.add('message-error');
      container.appendChild(errP);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const userData = await fetchJSON('/get-user');
      dom.usernameSpan.textContent = userData.username || 'User';
    } catch (err) {
      dom.usernameSpan.textContent = 'User';
    }
    loadStoredList('current', dom.grids.current);
    loadStoredList('wishlist', dom.grids.wishlist);
    loadStoredList('completed', dom.grids.completed);
    // Trending
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    fetchAndRender(
      `dates=${startDate},${endDate}&ordering=-added&page_size=4`,
      dom.grids.trending,
      'trending'
    );
    // Coming soon
    const today = new Date();
    const inThirtyDays = new Date();
    inThirtyDays.setDate(today.getDate() + 30);
    const todayStr = today.toISOString().split('T')[0];
    const inThirtyDaysStr = inThirtyDays.toISOString().split('T')[0];
    fetchAndRender(
      `dates=${todayStr},${inThirtyDaysStr}&ordering=-added&page_size=4`,
      dom.grids.comingSoon,
      'comingSoon'
    );
    // See All navigation
    if (dom.seeAllBtns.current) {
      dom.seeAllBtns.current.addEventListener('click', () => {
        window.location.href = '/pages/seeAll.html?category=current';
      });
    }
    if (dom.seeAllBtns.wishlist) {
      dom.seeAllBtns.wishlist.addEventListener('click', () => {
        window.location.href = '/pages/seeAll.html?category=wishlist';
      });
    }
    if (dom.seeAllBtns.completed) {
      dom.seeAllBtns.completed.addEventListener('click', () => {
        window.location.href = '/pages/seeAll.html?category=completed';
      });
    }
    if (dom.seeAllBtns.trending) {
      dom.seeAllBtns.trending.addEventListener('click', () => {
        window.location.href = '/pages/seeAll.html?category=trending';
      });
    }
    if (dom.seeAllBtns.comingSoon) {
      dom.seeAllBtns.comingSoon.addEventListener('click', () => {
        window.location.href = '/pages/seeAll.html?category=comingSoon';
      });
    }
    if (dom.logoutBtn) {
      dom.logoutBtn.addEventListener('click', () => {
        window.location.href = '/pages/login.html';
      });
    }
  });
})();

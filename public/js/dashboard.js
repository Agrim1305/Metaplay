/* global showToast */

(() => {
  let activeGameId = null;
  let userReviewData = null;
  let modalGameData = null;

  const STATUS_MAP = {
    current: 'collection',
    wishlist: 'wishlist',
    completed: 'played'
  };

  // Forward declaration
  let renderEditableReviewSection;

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
    modal: {
      container: document.getElementById('gameModal'),
      closeBtn: document.querySelector('.modal-close-btn'),
      cover: document.getElementById('modalCover'),
      title: document.getElementById('modalTitle'),
      release: document.getElementById('modalRelease'),
      rating: document.getElementById('modalRating'),
      desc: document.getElementById('modalDesc'),
      addToWishlist: document.getElementById('addToWishlist'),
      addToCurrent: document.getElementById('addToCurrent'),
      addToCompleted: document.getElementById('addToCompleted'),
      reviewSection: document.getElementById('modalReviewSection')
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

  function isComingSoon(listKey, game) {
    if (listKey === 'comingSoon') return true;
    if (game && game.released) {
      const now = new Date();
      return new Date(game.released) > now;
    }
    return false;
  }

  // Create star rating
  function createStarRating(ratingValue, editable = false, onRate = null) {
    const starContainer = document.createElement('div');
    starContainer.classList.add('star-container');
    let currentRating = ratingValue ? Math.round(ratingValue) : 0;
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.textContent = i <= currentRating ? '★' : '☆';
      star.className = i <= currentRating ? 'star-full' : 'star-empty';
      if (editable && onRate) {
        star.style.cursor = 'pointer';
        star.addEventListener('click', () => onRate(i));
      }
      starContainer.appendChild(star);
    }
    return starContainer;
  }

  // Remove game from user list
  function removeGameFromList(gameId, listKey, cardElement) {
    fetch(`/user-games/${gameId}`, {
      method: 'DELETE',
      credentials: 'same-origin' // Ensure credentials are sent
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

  async function loadUserReview(gameId) {
    try {
      userReviewData = await fetchJSON(`/user-review/${gameId}`);
      renderEditableReviewSection(userReviewData);
    } catch (err) {
      renderEditableReviewSection({ review: '', rating: 0 });
    }
  }

  // Render review UI with rating stars and text area
  renderEditableReviewSection = function({ review, rating }) {
    const section = dom.modal.reviewSection;
    section.innerHTML = '';
    const label = document.createElement('label');
    label.textContent = 'Your Review:';
    section.appendChild(label);
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write your review...';
    textarea.value = review || '';
    section.appendChild(textarea);
    let currentRating = rating || 0;
    function starClickHandler(newRating) {
      currentRating = newRating;
      const newStars = createStarRating(currentRating, true, starClickHandler);
      section.replaceChild(newStars, section.querySelector('.star-container'));
    }
    const starContainer = createStarRating(currentRating, true, starClickHandler);
    section.appendChild(starContainer);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('action-btn');
    saveBtn.style.marginTop = '1rem';
    section.appendChild(saveBtn);
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        await fetchJSON('/user-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: activeGameId,
            review: textarea.value.trim() || null,
            rating: currentRating || null,
            gameName: modalGameData ? modalGameData.name : undefined,
            releaseDate: modalGameData ? modalGameData.released : undefined,
            metaRating: modalGameData ? modalGameData.rating : undefined
          })
        });
        showToast('Review saved.');
        await loadUserReview(activeGameId);
      } catch (err) {
        showToast('Failed to save review.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });
  };

  // Open game modal and load details
  async function openGameModal(gameId, listKey) {
    activeGameId = gameId;
    try {
      // RAWG fetch doesn't require session; leave as is unless your backend restricts it
      const res = await fetch(`/rawg/games/${gameId}`);
      if (!res.ok) throw new Error('Failed to fetch game details');
      const game = await res.json();
      modalGameData = game;
      dom.modal.cover.src = game.background_image || 'about:blank';
      dom.modal.cover.alt = game.name || 'Game Cover';
      dom.modal.title.textContent = game.name || 'Unknown Title';
      let releaseLabel = isComingSoon(listKey, game) ? 'Releasing: ' : 'Released: ';
      dom.modal.release.textContent = `${releaseLabel}${game.released || 'N/A'}`;
      dom.modal.desc.textContent = game.description_raw || 'No description available.';
      if (isComingSoon(listKey, game)) {
        dom.modal.addToWishlist.style.display = '';
        dom.modal.addToCurrent.style.display = 'none';
        dom.modal.addToCompleted.style.display = 'none';
        dom.modal.rating.innerHTML = '';
        if (dom.modal.reviewSection) dom.modal.reviewSection.style.display = 'none';
      } else {
        dom.modal.addToWishlist.style.display = '';
        dom.modal.addToCurrent.style.display = '';
        dom.modal.addToCompleted.style.display = '';
        dom.modal.rating.innerHTML = '';
        dom.modal.rating.appendChild(createStarRating(game.rating || 0, false, null));
        if (dom.modal.reviewSection) {
          dom.modal.reviewSection.style.display = '';
          await loadUserReview(gameId);
        }
      }
      dom.modal.container.classList.remove('hidden');
      dom.modal.container.setAttribute('aria-hidden', 'false');
    } catch (err) {
      dom.modal.desc.textContent = 'Failed to load game details.';
      dom.modal.container.classList.remove('hidden');
      dom.modal.container.setAttribute('aria-hidden', 'false');
    }
  }

  function closeGameModal() {
    dom.modal.container.classList.add('hidden');
    dom.modal.container.setAttribute('aria-hidden', 'true');
    dom.modal.cover.src = 'about:blank';
    dom.modal.title.textContent = '';
    dom.modal.release.textContent = '';
    dom.modal.rating.innerHTML = '';
    dom.modal.desc.textContent = '';
    if (dom.modal.reviewSection) dom.modal.reviewSection.style.display = 'none';
    activeGameId = null;
    userReviewData = null;
    modalGameData = null;
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

    card.addEventListener('click', () => openGameModal(game.id, listKey));
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
      const detailPromises = userGames.map((row) => fetchJSON(`/rawg/games/${encodeURIComponent(row.gameId)}`));
      const rawgGames = await Promise.all(detailPromises);
      renderGameGrid(container, rawgGames, listKey);
    } catch (err) {
      const errP = document.createElement('p');
      errP.textContent = `Error loading ${listKey} games.`;
      errP.classList.add('message-error');
      container.appendChild(errP);
    }
  }

  async function addToList(listKey) {
    if (!activeGameId) return;
    const status = STATUS_MAP[listKey];
    try {
      await fetchJSON('/user-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: activeGameId,
          rating: null,
          review: null,
          status
        })
      });
      showToast(`Game added to ${listKey}.`);
      loadStoredList(listKey, dom.grids[listKey]);
    } catch (err) {
      showToast(`Failed to add to ${listKey}.`);
    }
    closeGameModal();
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
    // Modal button handlers
    if (dom.modal.closeBtn) {
      dom.modal.closeBtn.addEventListener('click', closeGameModal);
    }
    if (dom.modal.addToWishlist) {
      dom.modal.addToWishlist.addEventListener('click', () => addToList('wishlist'));
    }
    if (dom.modal.addToCurrent) {
      dom.modal.addToCurrent.addEventListener('click', () => addToList('current'));
    }
    if (dom.modal.addToCompleted) {
      dom.modal.addToCompleted.addEventListener('click', () => addToList('completed'));
    }
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

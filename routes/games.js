// Routes for searching and fetching game details from RAWG API

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const { ensureAuth } = require('../utils/auth');

// Apply ensureAuth to all /games routes
router.use(ensureAuth);

// Search for games using RAWG API
router.get('/', async (req, res) => {
  let gameSearch = req.query.search;
  if (typeof gameSearch === 'string') {
    gameSearch = gameSearch.trim();
  }

  if (!gameSearch) {
    return res
      .status(400)
      .json({ error: 'Please provide a search term via ?search=<term>' });
  }

  const { RAWG_API_KEY } = process.env;
  if (!RAWG_API_KEY) {
    return res
      .status(500)
      .json({ error: 'Server misconfiguration: missing API key' });
  }

  try {
    const params = new URLSearchParams({
      key: RAWG_API_KEY,
      search: gameSearch
    }).toString();

    const rawgUrl = `https://api.rawg.io/api/games?${params}`;
    const response = await fetch(rawgUrl);

    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch from RAWG' });
    }

    const data = await response.json();
    return res.json({ results: data.results || [] });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch from RAWG' });
  }
});

// Get game details from RAWG API
router.get('/:id', async (req, res) => {
  const rawgId = req.params.id;
  const gameId = parseInt(rawgId, 10);

  if (isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  const { RAWG_API_KEY } = process.env;
  if (!RAWG_API_KEY) {
    return res
      .status(500)
      .json({ error: 'Server misconfiguration: missing API key' });
  }

  try {
    const rawgUrl = `https://api.rawg.io/api/games/${gameId}?key=${RAWG_API_KEY}`;
    const response = await fetch(rawgUrl);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Game not found on RAWG' });
      }
      return res.status(502).json({ error: 'Failed to fetch from RAWG' });
    }

    const gameData = await response.json();
    return res.json(gameData);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch from RAWG' });
  }
});

module.exports = router;

// Routes for interacting with RAWG.io API

const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../utils/auth');

// Apply ensureAuth to all /rawg routes
router.use(ensureAuth);

// Get API key from environment
const { RAWG_API_KEY } = process.env;

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Fetch with a hard timeout so a slow/hanging RAWG upstream fails fast with a
// clean error instead of stalling until Railway's gateway returns a 502.
// (This is the root cause of the intermittent 502 on the date-range /games
// query — high latency to RAWG let the request hang with no upper bound.)
async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Fetch details for a single game by ID
router.get('/games/:id', async (req, res) => {
  const rawId = req.params.id;
  const gameId = parseInt(rawId, 10);

  if (isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  // Check cache first
  const cached = getCached(`game:${gameId}`);
  if (cached) {
    return res.json(cached);
  }

  const url = `https://api.rawg.io/api/games/${gameId}?key=${RAWG_API_KEY}`;

  try {
    const rawgResp = await fetchWithTimeout(url);
    if (!rawgResp.ok) {
      // Forward RAWG's status code (e.g. 404 or 429)
      return res
        .status(rawgResp.status)
        .json({ error: 'RAWG fetch failed', status: rawgResp.status });
    }
    const data = await rawgResp.json();
    setCached(`game:${gameId}`, data);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch fetch multiple games by IDs
router.post('/games/batch', async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid game IDs' });
  }

  // Filter out invalid IDs and check cache
  const validIds = ids.filter((id) => !isNaN(parseInt(id, 10)) && parseInt(id, 10) > 0);
  const results = {};
  const uncachedIds = [];

  // Check cache for each ID
  validIds.forEach((id) => {
    const cached = getCached(`game:${id}`);
    if (cached) {
      results[id] = cached;
    } else {
      uncachedIds.push(id);
    }
  });

  // If all games were cached, return immediately
  if (uncachedIds.length === 0) {
    return res.json(results);
  }

  // Fetch uncached games in parallel
  try {
    const fetchPromises = uncachedIds.map((id) => fetchWithTimeout(`https://api.rawg.io/api/games/${id}?key=${RAWG_API_KEY}`)
        .then((response) => response.json())
        .then((data) => {
          setCached(`game:${id}`, data);
          results[id] = data;
        })
        .catch(() => null));

    await Promise.all(fetchPromises);
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy a search or listing request to RAWG.io, forwarding all query params.
// Now cached (keyed by the full query) and timeout-bounded — this is the
// route that was returning 502 on the slow date-range "Trending" query.
router.get('/games', async (req, res) => {
  // Build query with API key and client parameters
  const params = new URLSearchParams({ key: RAWG_API_KEY, ...req.query }).toString();
  const url = `https://api.rawg.io/api/games?${params}`;

  // Cache key = the client query (exclude the API key so it isn't stored).
  const cacheKey = `games:${new URLSearchParams(req.query).toString()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const rawgResp = await fetchWithTimeout(url);
    if (!rawgResp.ok) {
      return res
        .status(rawgResp.status)
        .json({ error: 'RAWG fetch failed', status: rawgResp.status });
    }
    const data = await rawgResp.json();
    setCached(cacheKey, data);
    return res.json(data);
  } catch (err) {
    // AbortError (timeout) or network failure: respond fast and clearly
    // rather than letting the request hang into a gateway 502.
    const isTimeout = err.name === 'AbortError';
    return res
      .status(isTimeout ? 504 : 502)
      .json({ error: isTimeout ? 'RAWG request timed out' : 'RAWG upstream error' });
  }
});

module.exports = router;
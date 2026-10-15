// Routes for interacting with RAWG.io API

const express = require("express");
const router = express.Router();
const { ensureAuth } = require("../utils/auth");

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
    timestamp: Date.now(),
  });
}

// Fetch with a hard timeout so a slow/hanging RAWG upstream fails fast with a
// clean error instead of stalling until Railway's gateway returns a 502.
// (This is the root cause of the intermittent 502 on the date-range /games
// query — high latency to RAWG let the request hang with no upper bound.)
async function fetchWithTimeout(url, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// RAWG list responses carry `next`/`previous` URLs that embed our API key.
// Strip it before anything reaches the browser.
function stripKey(data) {
  for (const k of ["next", "previous"]) {
    if (typeof data[k] === "string") {
      const u = new URL(data[k]);
      u.searchParams.delete("key");
      data[k] = u.search;
    }
  }
  return data;
}

// Public (no login): cover art for the landing page's cover wall.
// Returns only names and images so it can't be used as an open RAWG proxy.
router.get("/public/trending", async (req, res) => {
  const cached = getCached("public:trending");
  if (cached) return res.json(cached);
  const params = new URLSearchParams({
    key: RAWG_API_KEY,
    ordering: "-added",
    page_size: "24",
    dates: `${new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)},${new Date().toISOString().slice(0, 10)}`,
  });
  try {
    const rawgResp = await fetchWithTimeout(`https://api.rawg.io/api/games?${params}`);
    if (!rawgResp.ok) return res.status(rawgResp.status).json({ error: "RAWG fetch failed" });
    const data = await rawgResp.json();
    const games = (data.results || [])
      .filter((g) => g.background_image)
      .map((g) => ({ id: g.id, name: g.name, background_image: g.background_image }));
    setCached("public:trending", games);
    return res.json(games);
  } catch (err) {
    return res.status(err.name === "AbortError" ? 504 : 502).json({ error: "RAWG upstream error" });
  }
});

// Everything below needs a logged-in user.
router.use(ensureAuth);

// Screenshots for a game (same cache + timeout pattern as the others)
router.get("/games/:id/screenshots", async (req, res) => {
  const gameId = parseInt(req.params.id, 10);
  if (isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: "Invalid game ID" });
  }
  const cached = getCached(`shots:${gameId}`);
  if (cached) return res.json(cached);
  try {
    const rawgResp = await fetchWithTimeout(
      `https://api.rawg.io/api/games/${gameId}/screenshots?key=${RAWG_API_KEY}`,
    );
    if (!rawgResp.ok) {
      return res
        .status(rawgResp.status)
        .json({ error: "RAWG fetch failed", status: rawgResp.status });
    }
    const data = stripKey(await rawgResp.json());
    setCached(`shots:${gameId}`, data);
    return res.json(data);
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return res
      .status(isTimeout ? 504 : 502)
      .json({ error: isTimeout ? "RAWG request timed out" : "RAWG upstream error" });
  }
});

// Fetch details for a single game by ID
router.get("/games/:id", async (req, res) => {
  const rawId = req.params.id;
  const gameId = parseInt(rawId, 10);

  if (isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: "Invalid game ID" });
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
        .json({ error: "RAWG fetch failed", status: rawgResp.status });
    }
    const data = await rawgResp.json();
    setCached(`game:${gameId}`, data);
    return res.json(data);
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return res
      .status(isTimeout ? 504 : 502)
      .json({ error: isTimeout ? "RAWG request timed out" : "RAWG upstream error" });
  }
});

// Batch fetch multiple games by IDs
router.post("/games/batch", async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid game IDs" });
  }

  // Filter out invalid IDs and check cache
  const validIds = ids.filter(
    (id) => !isNaN(parseInt(id, 10)) && parseInt(id, 10) > 0,
  );
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
    const fetchPromises = uncachedIds.map((id) =>
      fetchWithTimeout(
        `https://api.rawg.io/api/games/${id}?key=${RAWG_API_KEY}`,
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data || !data.id) return; // 404/429/etc: leave it out, never cache errors
          setCached(`game:${id}`, data);
          results[id] = data;
        })
        .catch(() => null),
    );

    await Promise.all(fetchPromises);
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Proxy a search or listing request to RAWG.io, forwarding all query params.
// Now cached (keyed by the full query) and timeout-bounded — this is the
// route that was returning 502 on the slow date-range "Trending" query.
router.get("/games", async (req, res) => {
  // Build query with API key and client parameters
  const params = new URLSearchParams({
    key: RAWG_API_KEY,
    ...req.query,
  }).toString();
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
        .json({ error: "RAWG fetch failed", status: rawgResp.status });
    }
    const data = stripKey(await rawgResp.json());
    setCached(cacheKey, data);
    return res.json(data);
  } catch (err) {
    // AbortError (timeout) or network failure: respond fast and clearly
    // rather than letting the request hang into a gateway 502.
    const isTimeout = err.name === "AbortError";
    return res
      .status(isTimeout ? 504 : 502)
      .json({
        error: isTimeout ? "RAWG request timed out" : "RAWG upstream error",
      });
  }
});

module.exports = router;

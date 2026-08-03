// routes/userReview.js
const express = require('express');
const pool = require('../db');
const { getLoggedInUserId, ensureAuth } = require('../utils/auth');
const router = express.Router();

router.use(ensureAuth);

router.get('/', async (req, res) => {
  const userId = getLoggedInUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const sql = `
      SELECT
        gr.Game_ID AS "gameId",
        g.Title AS "gameName",
        gr.Rating AS "rating",
        gr.Review AS "review",
        gr.Created_At AS "createdAt",
        gr.Updated_At AS "updatedAt"
      FROM Game_Reviews gr
      JOIN Games g ON gr.Game_ID = g.Game_ID
      WHERE gr.User_ID = $1
      ORDER BY gr.Created_At DESC
    `;
    const { rows } = await pool.query(sql, [userId]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user reviews' });
  }
});

router.get('/:gameId', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const gameId = parseInt(req.params.gameId, 10);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  if (Number.isNaN(gameId)) return res.status(400).json({ error: 'Invalid game ID' });

  try {
    const { rows } = await pool.query(
      'SELECT Rating AS "rating", Review AS "review" FROM Game_Reviews WHERE User_ID = $1 AND Game_ID = $2',
      [userId, gameId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch review' });
  }
});

router.post('/', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const {
    gameId,
    rating,
    review,
    gameName,
    releaseDate,
    metaRating
  } = req.body;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const parsedGameId = parseInt(gameId, 10);
  const ratingNum = Number(rating);
  if (Number.isNaN(parsedGameId)) return res.status(400).json({ error: 'Invalid gameId' });
  if (!ratingNum || ratingNum < 1 || ratingNum > 10) return res.status(400).json({ error: 'Rating must be between 1 and 10' });

  try {
    if (gameName) {
      await pool.query(
        `INSERT INTO Games (Game_ID, Title, Release_Date, Rating)
           VALUES ($1, $2, $3, $4)
         ON CONFLICT (Game_ID) DO UPDATE SET
           Title = EXCLUDED.Title,
           Release_Date = COALESCE(EXCLUDED.Release_Date, Games.Release_Date),
           Rating = COALESCE(EXCLUDED.Rating, Games.Rating)`,
        [parsedGameId, gameName, releaseDate || null, metaRating || null]
      );
    }
    await pool.query(
      `INSERT INTO Game_Reviews (Game_ID, User_ID, Rating, Review)
         VALUES ($1, $2, $3, $4)
       ON CONFLICT (Game_ID, User_ID) DO UPDATE SET
         Rating = EXCLUDED.Rating,
         Review = EXCLUDED.Review`,
      [parsedGameId, userId, ratingNum, review || null]
    );
    return res.status(201).json({ message: 'Review saved.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save review' });
  }
});

router.put('/:gameId', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const gameId = parseInt(req.params.gameId, 10);
  const { rating, review } = req.body;
  const ratingNum = Number(rating);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  if (Number.isNaN(gameId)) return res.status(400).json({ error: 'Invalid game ID' });
  if (!ratingNum || ratingNum < 1 || ratingNum > 10) return res.status(400).json({ error: 'Rating must be between 1 and 10' });

  try {
    const result = await pool.query(
      `UPDATE Game_Reviews
         SET Rating = $1, Review = $2
       WHERE User_ID = $3 AND Game_ID = $4`,
      [ratingNum, review || null, userId, gameId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Review not found' });
    return res.json({ message: 'Review updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update review' });
  }
});

router.delete('/:gameId', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const gameId = parseInt(req.params.gameId, 10);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  if (Number.isNaN(gameId)) return res.status(400).json({ error: 'Invalid game ID' });

  try {
    const result = await pool.query(
      'DELETE FROM Game_Reviews WHERE User_ID = $1 AND Game_ID = $2',
      [userId, gameId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Review not found' });
    return res.json({ message: 'Review deleted.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;

// routes/game_review.js
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
        gr.Game_ID AS gameId,
        g.Title AS gameName,
        gr.Rating AS rating,
        gr.Review AS review,
        gr.Created_At AS createdAt,
        gr.Updated_At AS updatedAt
      FROM Game_Reviews gr
      JOIN Games g ON gr.Game_ID = g.Game_ID
      WHERE gr.User_ID = ?
      ORDER BY gr.Created_At DESC
    `;
    const [rows] = await pool.execute(sql, [userId]);
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
    const [rows] = await pool.execute(
      'SELECT Rating AS rating, Review AS review FROM Game_Reviews WHERE User_ID = ? AND Game_ID = ?',
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
      await pool.execute(
        `INSERT INTO Games (Game_ID, Title, Release_Date, Rating)
           VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           Title = VALUES(Title),
           Release_Date = IFNULL(VALUES(Release_Date), Release_Date),
           Rating = IFNULL(VALUES(Rating), Rating)`,
        [parsedGameId, gameName, releaseDate || null, metaRating || null]
      );
    }
    await pool.execute(
      `INSERT INTO Game_Reviews (Game_ID, User_ID, Rating, Review)
         VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         Rating = VALUES(Rating),
         Review = VALUES(Review),
         Updated_At = CURRENT_TIMESTAMP`,
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
    const [result] = await pool.execute(
      `UPDATE Game_Reviews
         SET Rating = ?, Review = ?, Updated_At = CURRENT_TIMESTAMP
       WHERE User_ID = ? AND Game_ID = ?`,
      [ratingNum, review || null, userId, gameId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Review not found' });
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
    const [result] = await pool.execute(
      'DELETE FROM Game_Reviews WHERE User_ID = ? AND Game_ID = ?',
      [userId, gameId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Review not found' });
    return res.json({ message: 'Review deleted.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;

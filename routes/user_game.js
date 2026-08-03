// Routes for managing user-game relationships (ratings, reviews, etc.)

const express = require('express');
const { body, validationResult, query } = require('express-validator');
const pool = require('../db');
const { ensureAuth, getLoggedInUserId } = require('../utils/auth');

const router = express.Router();

// Apply ensureAuth to all /user_game routes
router.use(ensureAuth);

// Create or update a User_Game row for the logged-in user
router.post(
  '/',
  body('gameId')
    .isInt({ min: 1 })
    .withMessage('gameId must be a positive integer'),
  body('rating')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 10 })
    .withMessage('rating must be an integer between 1 and 10 if provided'),
  body('review')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 })
    .withMessage('review must be a string up to 1000 characters'),
  body('status')
    .isIn(['wishlist', 'played', 'collection'])
    .withMessage("status must be one of 'wishlist', 'played', 'collection'"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = getLoggedInUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: please log in.' });
    }

    const {
 gameId, rating = null, review = null, status
} = req.body;

    try {
      // Ensure that this gameId exists in the parent Games table.
      const { rows: existingGames } = await pool.query(
        'SELECT Game_ID FROM Games WHERE Game_ID = $1',
        [gameId]
      );

      if (existingGames.length === 0) {
        await pool.query(
          'INSERT INTO Games (Game_ID) VALUES ($1) ON CONFLICT DO NOTHING',
          [gameId]
        );
      }

      // Postgres UPSERT via ON CONFLICT
      const sql = `
        INSERT INTO User_Game (User_ID, Game_ID, Rating, Review, Status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (User_ID, Game_ID) DO UPDATE SET
          Rating = EXCLUDED.Rating,
          Review = EXCLUDED.Review,
          Status = EXCLUDED.Status
      `;
      await pool.query(sql, [userId, gameId, rating, review, status]);

      return res.status(200).json({ message: 'User_Game saved' });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all saved games for the logged-in user (optionally filtered by status & limited)
router.get(
  '/',
  query('status')
    .optional()
    .isIn(['wishlist', 'played', 'collection'])
    .withMessage("status must be one of 'wishlist','played','collection'"),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('limit must be a positive integer'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = getLoggedInUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: please log in.' });
    }

    const statusFilter = req.query.status;
    const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : null;

    try {
      let sql = `
        SELECT
          User_ID AS "userId",
          Game_ID AS "gameId",
          Rating AS "rating",
          Review AS "review",
          Status AS "status"
        FROM User_Game
        WHERE User_ID = $1
      `;
      const params = [userId];
      let idx = 2;

      if (statusFilter) {
        sql += ` AND Status = $${idx++}`;
        params.push(statusFilter);
      }

      if (limitParam) {
        sql += ` LIMIT $${idx++}`;
        params.push(limitParam);
      }

      const { rows } = await pool.query(sql, params);
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete a saved game for the logged-in user
router.delete('/:gameId', async (req, res) => {
  const gameId = parseInt(req.params.gameId, 10);
  if (isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: 'Invalid gameId' });
  }

  const userId = getLoggedInUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: please log in.' });
  }

  try {
    const sql = `
      DELETE FROM User_Game
      WHERE User_ID = $1
        AND Game_ID = $2
    `;
    await pool.query(sql, [userId, gameId]);
    return res.status(200).json({ message: 'User_Game deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

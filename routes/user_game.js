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
  // 1) Validate request body
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
    // 2) Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // 3) Determine the logged-in userId
    const userId = getLoggedInUserId(req);
    if (!userId) {
      // Should not happen due to ensureAuth, but guard anyway
      return res.status(401).json({ error: 'Unauthorized: please log in.' });
    }

    const {
 gameId, rating = null, review = null, status
} = req.body;

    try {
      // Ensure that this gameId exists in the parent Games table.
      const [existingGames] = await pool.execute(
        'SELECT Game_ID FROM Games WHERE Game_ID = ?',
        [gameId]
      );

      if (existingGames.length === 0) {
        await pool.execute(
          'INSERT INTO Games (Game_ID) VALUES (?)',
          [gameId]
        );
      }

      // 5) Now that the parent exists, insert or update into User_Game.
      const sql = `
        INSERT INTO User_Game (User_ID, Game_ID, Rating, Review, Status)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          Rating = VALUES(Rating),
          Review = VALUES(Review),
          Status = VALUES(Status);
      `;
      await pool.execute(sql, [userId, gameId, rating, review, status]);

      return res.status(200).json({ message: 'User_Game saved' });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all saved games for the logged-in user (optionally filtered by status & limited)
router.get(
  '/',
  // 1) Validate optional query params: status and limit
  query('status')
    .optional()
    .isIn(['wishlist', 'played', 'collection'])
    .withMessage("status must be one of 'wishlist','played','collection'"),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('limit must be a positive integer'),
  async (req, res) => {
    // 2) Check validation results
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
      // 3) Build base SQL
      let sql = `
        SELECT
          User_ID AS userId,
          Game_ID AS gameId,
          Rating AS rating,
          Review AS review,
          Status AS status
        FROM User_Game
        WHERE User_ID = ?
      `;
      const params = [userId];

      // 4) Add status filter if provided
      if (statusFilter) {
        sql += ' AND Status = ?';
        params.push(statusFilter);
      }

      // 5) Add LIMIT if provided
      if (limitParam) {
        sql += ' LIMIT ?';
        params.push(limitParam);
      }

      // 6) Execute and return
      const [rows] = await pool.execute(sql, params);
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
    // 1) Delete only the row that matches both User_ID and Game_ID
    const sql = `
      DELETE FROM User_Game
      WHERE User_ID = ?
        AND Game_ID = ?
    `;
    await pool.execute(sql, [userId, gameId]);
    return res.status(200).json({ message: 'User_Game deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

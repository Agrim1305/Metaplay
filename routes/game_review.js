// Routes for managing user reviews of games

const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { getLoggedInUserId, isLoggedIn } = require('../utils/auth');

const router = express.Router();

// Inserts or updates a single user's review (rating + optional text) for a given game.
// Only the logged-in user may write or update their own review.
router.post(
  '/:gameId',
  (req, res, next) => {
    const gameId = parseInt(req.params.gameId, 10);
    if (Number.isNaN(gameId) || gameId < 1) {
      return res.status(400).json({ error: 'Invalid gameId' });
    }
    return next();
  },
  body('rating')
    .isInt({ min: 1, max: 10 })
    .withMessage('rating must be an integer between 1 and 10'),
  body('review')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 })
    .withMessage('review must be a string up to 1000 characters'),
  async (req, res) => {
    if (!isLoggedIn(req)) {
      return res.status(401).json({ error: 'Unauthorized: please log in.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = parseInt(req.params.gameId, 10);
    const loggedInUserId = getLoggedInUserId(req);
    if (!loggedInUserId) {
      return res.status(401).json({ error: 'Unauthorized: please log in.' });
    }

    const { rating, review = null } = req.body;

    try {
      // Postgres UPSERT — the Updated_At column is handled by the trigger
      const upsertSql = `
        INSERT INTO Game_Reviews
          (Game_ID, User_ID, Rating, Review)
        VALUES
          ($1, $2, $3, $4)
        ON CONFLICT (Game_ID, User_ID) DO UPDATE SET
          Rating = EXCLUDED.Rating,
          Review = EXCLUDED.Review
      `;
      await pool.query(upsertSql, [
        gameId,
        loggedInUserId,
        rating,
        review !== null && review !== undefined && review.trim() !== '' ? review.trim() : null
      ]);

      return res.status(201).json({ message: 'Review saved' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save review.' });
    }
  }
);

// Get reviews and stats for a specific game
router.get('/:gameId', async (req, res) => {
  const gameId = parseInt(req.params.gameId, 10);
  if (Number.isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: 'Invalid gameId' });
  }

  try {
    // Get individual reviews
    const selectSql = `
      SELECT
        User_ID AS "userId",
        Rating AS "Rating",
        Review AS "review",
        Created_At AS "createdAt"
      FROM Game_Reviews
      WHERE Game_ID = $1
      ORDER BY Created_At DESC
    `;
    const { rows } = await pool.query(selectSql, [gameId]);

    // Get aggregate stats — COALESCE is the Postgres equivalent of IFNULL
    const statsSql = `
      SELECT
        COALESCE(AVG(Rating), 0) AS "averageRating",
        COUNT(*) AS "totalReviews"
      FROM Game_Reviews
      WHERE Game_ID = $1
    `;
    const { rows: statsRows } = await pool.query(statsSql, [gameId]);

    const rawAvg = statsRows[0].averageRating;
    const avgNumber = rawAvg !== null ? Number(rawAvg) : 0;
    const totalReviews = statsRows[0].totalReviews || 0;

    return res.json({
      averageRating: Number(avgNumber.toFixed(1)),
      totalReviews: Number(totalReviews),
      reviews: rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

module.exports = router;

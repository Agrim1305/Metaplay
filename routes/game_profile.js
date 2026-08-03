// Routes for managing game profiles

const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { isLoggedIn, isAdmin } = require('../utils/auth');

const router = express.Router();

// Get game profile by ID
router.get('/:gameId', async (req, res) => {
  const gameId = parseInt(req.params.gameId, 10);
  if (Number.isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: 'Invalid gameId' });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        Game_ID AS "gameId",
        Genre AS "genre",
        Player_Count AS "playerCount",
        Developer AS "developer"
      FROM Game_Profile
      WHERE Game_ID = $1
      `,
      [gameId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No profile found for that gameId' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch game profile.' });
  }
});

// Create or update game profile (admin only)
router.post(
  '/',
  body('gameId')
    .isInt({ min: 1 })
    .withMessage('gameId must be a positive integer'),
  body('genre')
    .optional()
    .isString()
    .withMessage('genre must be a string'),
  body('playerCount')
    .optional()
    .isString()
    .withMessage('playerCount must be a string'),
  body('developer')
    .optional()
    .isString()
    .withMessage('developer must be a string'),
  async (req, res) => {
    if (!isLoggedIn(req)) {
      return res.status(401).json({ error: 'Unauthorized: please log in.' });
    }
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden: admins only.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
 gameId, genre, playerCount, developer
} = req.body;

    try {
      // Postgres UPSERT via ON CONFLICT
      await pool.query(
        `
        INSERT INTO Game_Profile
          (Game_ID, Genre, Player_Count, Developer)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (Game_ID) DO UPDATE SET
          Genre = EXCLUDED.Genre,
          Player_Count = EXCLUDED.Player_Count,
          Developer = EXCLUDED.Developer
        `,
        [
          gameId,
          genre !== null && genre !== undefined && genre.trim() !== '' ? genre.trim() : null,
          playerCount !== null && playerCount !== undefined && playerCount.trim() !== '' ? playerCount.trim() : null,
          developer !== null && developer !== undefined && developer.trim() !== '' ? developer.trim() : null
        ]
      );

      return res.json({ message: 'Game profile saved successfully.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save game profile.' });
    }
  }
);

// Delete game profile (admin only)
router.delete('/:gameId', async (req, res) => {
  if (!isLoggedIn(req)) {
    return res.status(401).json({ error: 'Unauthorized: please log in.' });
  }
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden: admins only.' });
  }

  const gameId = parseInt(req.params.gameId, 10);
  if (Number.isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: 'Invalid gameId' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM Game_Profile WHERE Game_ID = $1`,
      [gameId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No profile found to delete.' });
    }

    return res.json({ message: 'Game profile deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete game profile.' });
  }
});

module.exports = router;

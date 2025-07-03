const express = require('express');
const pool = require('../db');
const router = express.Router();
const { ensureAuth, ensureAdmin } = require('../utils/auth');

// All /admin routes require authentication + admin role
router.use(ensureAuth, ensureAdmin);

// GET all users
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         User_ID  AS id,
         Username AS username,
         Email    AS email,
         Bio      AS bio,
         Role     AS role
       FROM MPUser;`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch users.' });
  }
});

// DELETE a user by ID
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const [result] = await pool.execute(
      `DELETE FROM MPUser WHERE User_ID = ?`,
      [userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Could not delete user.' });
  }
});

// UPDATE a user’s details by ID
router.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const {
 username, email, bio, role
} = req.body;

  const fields = [];
  const values = [];

  if (username !== null) {
    fields.push('Username = ?');
    values.push(username.trim());
  }
  if (email !== null) {
    fields.push('Email = ?');
    values.push(email.trim());
  }
  if (bio !== null) {
    fields.push('Bio = ?');
    values.push(bio.trim());
  }
  if (role !== null) {
    fields.push('Role = ?');
    values.push(role.trim());
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update.' });
  }

  try {
    const sql = `
      UPDATE MPUser
      SET ${fields.join(', ')}
      WHERE User_ID = ?
    `;
    values.push(userId);
    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Could not update user.' });
  }
});

module.exports = router;

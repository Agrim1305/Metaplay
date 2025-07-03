// Routes for managing user profiles

const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { ensureAuth, getLoggedInUserId } = require('../utils/auth');

const router = express.Router();

// Apply ensureAuth to all /profile routes
router.use(ensureAuth);
router.get('/', (req, res) => res.redirect('/get-user'));

// Update the current user's Username, Password, and/or Bio
router.put('/', async (req, res) => {
  const userId = getLoggedInUserId(req);
  if (!userId) {
    // Shouldn't happen because ensureAuth already ran
    return res.status(401).json({ error: 'Not logged in' });
  }

  // Extract fields from the request body
  let { username: newUsername, password: newPassword, bio: newBio } = req.body;

  // Trim if strings
  if (typeof newUsername === 'string') {
    newUsername = newUsername.trim();
  }
  if (typeof newBio === 'string') {
    newBio = newBio.trim();
  }

  // If no fields were provided, abort
  if (!newUsername && !newPassword && newBio === null) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const fields = [];
    const values = [];

    // If newUsername is provided, check uniqueness among other users
    if (newUsername) {
      // Make sure no one else (except this user) already has newUsername
      const [existingRows] = await pool.execute(
        'SELECT 1 FROM MPUser WHERE Username = ? AND User_ID <> ?',
        [newUsername, userId]
      );
      if (existingRows.length > 0) {
        return res.status(409).json({ error: 'Username already taken.' });
      }
      fields.push('Username = ?');
      values.push(newUsername);
    }

    // If newPassword is provided, hash it
    if (newPassword) {
      const saltRounds = 10;
      const hashedPwd = await bcrypt.hash(newPassword, saltRounds);
      fields.push('Password = ?');
      values.push(hashedPwd);
    }

    // 3) If newBio is provided (even if empty string), update it
    if (newBio !== null) {
      fields.push('Bio = ?');
      values.push(newBio);
    }

    // Still no valid fields? Should not happen, but guard anyway
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    // Append userId for the WHERE clause
    values.push(userId);

    // Build the final SQL: UPDATE MPUser SET <field1 = ?>, <field2 = ?>, ... WHERE User_ID = ?
    const sql = `
      UPDATE MPUser
         SET ${fields.join(', ')}
       WHERE User_ID = ?
    `;
    await pool.execute(sql, values);

    // 4) If username changed, synchronize it back into session and req.user
    if (newUsername) {
      req.session.username = newUsername;
      if (req.user) {
        req.user.Username = newUsername;
      }
    }

    return res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Update failed.' });
  }
});

module.exports = router;

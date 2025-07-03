// Routes for user login

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../db');

// Handle user login
router.post('/', async (req, res) => {
  // Extract and normalize input
  let { username, password } = req.body;
  if (typeof username === 'string') {
    username = username.trim();
  }

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: 'Username and password are required.' });
  }

  try {
    // Get user from database
    const [rows] = await pool.execute(
      'SELECT User_ID, Username, Password, Role FROM MPUser WHERE Username = ?',
      [username]
    );

    if (rows.length === 0) {
      // No such username
      return res
        .status(401)
        .json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    // Verify password
    const passwordMatches = await bcrypt.compare(password, user.Password);
    if (!passwordMatches) {
      return res
        .status(401)
        .json({ error: 'Invalid username or password.' });
    }

    // Regenerate session to prevent session fixation
    return new Promise((resolve) => {
      req.session.regenerate((err) => {
        if (err) {
          // Even if regeneration fails, proceed to set session values
        }

        // Store user info in session
        req.session.username = user.Username;
        req.session.userId = user.User_ID;
        req.session.isAdmin = (user.Role === 'admin');

        // Send success response
        resolve(res.json({
          message: 'Login successful!',
          username: user.Username,
          isAdmin: user.Role === 'admin'
        }));
      });
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'Internal server error.' });
  }
});

module.exports = router;

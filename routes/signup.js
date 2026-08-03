// Routes for user registration

const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

// Register a new user
router.post('/', async (req, res) => {
  // Extract and normalize input
  let {
 username, email, password, bio = ''
} = req.body;

  if (typeof username === 'string') username = username.trim();
  if (typeof email === 'string') email = email.trim().toLowerCase();
  if (typeof bio === 'string') bio = bio.trim();

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: 'Username, email, and password are required.' });
  }

  try {
    // Check if username exists
    const { rows: rowsByUsername } = await pool.query(
      'SELECT User_ID FROM MPUser WHERE Username = $1',
      [username]
    );
    if (rowsByUsername.length > 0) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    // Check if email exists
    const { rows: rowsByEmail } = await pool.query(
      'SELECT User_ID FROM MPUser WHERE Email = $1',
      [email]
    );
    if (rowsByEmail.length > 0) {
      return res.status(409).json({ error: 'Email is already in use.' });
    }

    // Hash password and create user
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertSql = `
      INSERT INTO MPUser (Username, Email, Password, Bio, Role)
      VALUES ($1, $2, $3, $4, 'user')
      RETURNING User_ID
    `;
    const { rows: insertRows } = await pool.query(insertSql, [
      username,
      email,
      hashedPassword,
      bio
    ]);

    return res.status(201).json({
      message: 'User registered successfully.',
      userId: insertRows[0].user_id
    });
  } catch (err) {
    // Postgres unique_violation SQLSTATE = 23505
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;

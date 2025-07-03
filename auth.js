require('dotenv').config();
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const pool = require('./db');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL
} = process.env;

// Configure Passport's Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract the email from Google profile
        const email = profile.emails
          && profile.emails[0]
          && profile.emails[0].value
          && profile.emails[0].value.toLowerCase();

        if (!email) {
          return done(
            new Error('Google profile did not contain a valid email'),
            null
          );
        }

        // Build a base username from displayName or local-part of email
        const rawDisplayName = profile.displayName || email.split('@')[0];
        // Replace any sequence of whitespace with a single underscore
        const displayNameBase = rawDisplayName.trim().replace(/\s+/g, '_');
        let finalUsername = displayNameBase;

        // Check if this email already exists in database
        const [existingRows] = await pool.execute(
          'SELECT * FROM MPUser WHERE Email = ?',
          [email]
        );

        let userRow;
        if (existingRows.length > 0) {
          // If a user with this email already exists, reuse it
          [userRow] = existingRows;
        } else {
          let attempt = 0;
          const maxAttempts = 10;

          for (; attempt < maxAttempts; attempt++) {
            try {
              const insertSql = 'INSERT INTO MPUser (Username, Email, Password, Bio, Role) VALUES (?, ?, \'\', \'Google User\', \'user\')';
              const [insertResult] = await pool.execute(insertSql, [finalUsername, email]);

              const newId = insertResult.insertId;
              const [newRows] = await pool.execute('SELECT * FROM MPUser WHERE User_ID = ?', [newId]);

              if (!newRows.length) {
                return done(
                  new Error('Failed to fetch/create user after Google login'),
                  null
                );
              }

              [userRow] = newRows;
              break;
            } catch (err) {
              if (
                err.code === 'ER_DUP_ENTRY' && err.message.includes('for key `Username`')
              ) {
                finalUsername = `${displayNameBase}_${attempt + 1}`;
                continue;
              }
              throw err;
            }
          }
        }
        return done(null, userRow);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.User_ID);
});

passport.deserializeUser(async (userId, done) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM MPUser WHERE User_ID = ?',
      [userId]
    );
    if (!rows.length) {
      return done(null, false);
    }
    const user = rows[0];
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
});

module.exports = passport;

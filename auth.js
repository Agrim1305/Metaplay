require("dotenv").config();
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const pool = require("./db");

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } =
  process.env;

// Configure Passport's Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract the email from Google profile
        const email =
          profile.emails &&
          profile.emails[0] &&
          profile.emails[0].value &&
          profile.emails[0].value.toLowerCase();

        if (!email) {
          return done(
            new Error("Google profile did not contain a valid email"),
            null,
          );
        }

        // Build a base username from displayName or local-part of email
        const rawDisplayName = profile.displayName || email.split("@")[0];
        const displayNameBase = rawDisplayName.trim().replace(/\s+/g, "_");
        let finalUsername = displayNameBase;

        // Check if this email already exists in database
        const { rows: existingRows } = await pool.query(
          `SELECT User_ID AS "User_ID", Username AS "Username",
                  Email AS "Email", Bio AS "Bio", Role AS "Role"
           FROM MPUser WHERE Email = $1`,
          [email],
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
              const insertSql = `
                INSERT INTO MPUser (Username, Email, Password, Bio, Role)
                VALUES ($1, $2, '', 'Google User', 'user')
                RETURNING User_ID AS "User_ID", Username AS "Username",
                          Email AS "Email", Bio AS "Bio", Role AS "Role"
              `;
              const { rows: insertRows } = await pool.query(insertSql, [
                finalUsername,
                email,
              ]);

              if (!insertRows.length) {
                return done(
                  new Error("Failed to fetch/create user after Google login"),
                  null,
                );
              }

              [userRow] = insertRows;
              break;
            } catch (err) {
              // Postgres unique_violation (SQLSTATE 23505)
              // On username collision, append suffix and retry
              if (
                err.code === "23505" &&
                err.constraint &&
                err.constraint.toLowerCase().includes("username")
              ) {
                finalUsername = `${displayNameBase}_${attempt + 1}`;
                continue;
              }
              // Some Postgres builds don't populate .constraint reliably; also match on detail
              if (
                err.code === "23505" &&
                err.detail &&
                err.detail.toLowerCase().includes("username")
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
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.User_ID);
});

passport.deserializeUser(async (userId, done) => {
  try {
    const { rows } = await pool.query(
      `SELECT User_ID AS "User_ID", Username AS "Username",
              Email AS "Email", Bio AS "Bio", Role AS "Role"
       FROM MPUser WHERE User_ID = $1`,
      [userId],
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

# MetaPlay

A full-stack web application for discovering video games, building personal
collections, writing reviews, and connecting with other players. Game data is
pulled live from the [RAWG Video Games Database API](https://rawg.io/apidocs).

Originally built as a university web & database computing project, then extended
and hardened for production deployment.

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MySQL (via the `mysql2` connection pool)
- **Authentication:** Passport — local username/password (bcrypt-hashed) plus
  Google OAuth 2.0
- **Frontend:** Server-served HTML with vanilla JavaScript (no framework) and
  custom CSS
- **External API:** RAWG for live game data

## Features

- Username/password registration and login, plus Google sign-in
- Search games via the RAWG API and view details, ratings, and release dates
- Personal collections: Wishlist, Currently Playing, Completed
- Write and manage game reviews
- Social: send/accept friend requests, create and join groups, find other users
- Admin dashboard for user management (view, edit, delete)
- Role-based access control (user vs admin)

## Local Setup

Requires Node.js 18+ and a running MySQL server.

1. Install dependencies:
   ```
   npm install
   ```
2. Create a `.env` file in the project root (see `.env.example`):
   ```
   RAWG_API_KEY=your_rawg_api_key
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=your_db_password
   DB_NAME=metaplay
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   SESSION_SECRET=a_long_random_string
   ```
3. Create the database and import the schema:
   ```
   mysql -u root -p -e "CREATE DATABASE metaplay;"
   mysql -u root -p metaplay < Schema.sql
   ```
4. Start the server:
   ```
   npm start
   ```
   The app runs on `http://localhost:3000` (override with the `PORT` env var).

## Creating an Admin

The schema ships with no default admin (for security). Register a normal account
through the UI, then promote it:

```sql
UPDATE MPUser SET Role = 'admin' WHERE Username = 'your_username';
```

## Notes

- Google sign-in requires real OAuth credentials and a matching authorised
  redirect URI in the Google Cloud Console. With placeholder credentials, the
  rest of the app works but the Google button will not.
- The RAWG free tier is rate-limited; heavy use may return 429 responses.
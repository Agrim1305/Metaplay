<p align="center">
  <img src="public/images/logo.svg" alt="MetaPlay logo" width="64">
</p>

<h1 align="center">MetaPlay</h1>

<p align="center">
  Track every game you play: wishlist it, play it, rate it, and see what your friends think.<br>
  <a href="https://metaplay-g2q7.onrender.com/"><strong>Live app</strong></a>
</p>

MetaPlay is a full-stack game library tracker built on the RAWG catalogue of over 500,000 games. It started as a university web and database project; since then I have redesigned it, migrated its infrastructure twice, and hardened its security.

> **Try it:** open the live link, register (or sign in with Google), and add a game to a shelf. The free hosting tier sleeps when idle, so the first load can take about 30 seconds.

## Features

- **Three shelves.** Move any game between Wishlist, Playing and Completed in one click, from any card.
- **Release schedule.** A week-by-week view of upcoming releases, with your wishlisted games highlighted.
- **Game pages.** Artwork, Metacritic and RAWG scores, screenshots, community rating split, and your own review.
- **10-point reviews.** Score and review anything you have played, then edit or delete it later.
- **Player profile.** A level and XP bar, achievement badges, your genre breakdown, score histogram and favourites, all computed from your library.
- **Social.** Friend requests, a friend activity feed, what your friends are playing, and groups.
- **Discover.** Search with live results, genre and platform filters, sorting, and grid or list views.
- **Accounts.** Username and password (bcrypt), or Google sign-in. Admins get a user management dashboard.

## Tech stack

| Layer    | Technology                                                                    |
| -------- | ----------------------------------------------------------------------------- |
| Backend  | Node.js, Express                                                              |
| Database | PostgreSQL on Neon (`pg` connection pool)                                     |
| Auth     | Passport: local strategy with bcrypt, plus Google OAuth 2.0; Express sessions |
| Frontend | Server-served HTML, vanilla JavaScript, custom CSS design tokens              |
| Data     | RAWG Video Games Database API, proxied and cached server-side                 |
| Hosting  | Render (web service), Neon (database)                                         |

## Engineering notes

**Securing page access.** Protected pages (home, profile, social, admin and others) sat behind Express route guards, but `express.static` ran first. Because it decodes and case-folds URLs before matching files, requests like `/pages/%64ashboard.html` or `/pages/DASHBOARD.html` skipped the guards and served the page to signed-out visitors. Moving the guards earlier was not enough on its own, so I added a check in front of the static server that normalizes each path the same way it does (decode, resolve `.` and `..`, lowercase). Protected paths are then always handed to the guarded routes. I verified the fix with curl tests covering signed-out, signed-in and non-admin sessions, including encoded and re-cased URLs.

**Two infrastructure migrations.** MetaPlay moved from Railway to Render with Aiven MySQL when the free trial ended, then from MySQL to Neon PostgreSQL when Aiven's free tier started powering the database off. The second move meant converting the schema and every query to PostgreSQL. The reasoning and lessons from both are in [docs/migration-postmortem.md](docs/migration-postmortem.md).

**Staying inside RAWG's rate limits.** All RAWG calls go through a server-side proxy with a one-hour cache, request timeouts, and a batch endpoint, so a page full of games makes one request instead of dozens.

## Run it locally

Requires Node.js 18+ and a PostgreSQL database (a free [Neon](https://neon.tech) project works).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root:

   ```bash
   RAWG_API_KEY=your_rawg_api_key

   PGHOST=your_postgres_host
   PGUSER=your_postgres_user
   PGPASSWORD=your_postgres_password
   PGDATABASE=your_database_name
   PGPORT=5432

   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

   SESSION_SECRET=a_long_random_string
   ```

3. Create the tables:
   ```bash
   psql "host=$PGHOST user=$PGUSER dbname=$PGDATABASE sslmode=require" -f Schema.sql
   ```
4. Start the server:
   ```bash
   npm start
   ```
   The app runs on http://localhost:3000 (set `PORT` to change it).

Google sign-in needs real OAuth credentials and a matching redirect URI in the Google Cloud Console. Without them, everything else still works.

### Making an admin

No admin account ships with the schema. Register normally, then promote yourself:

```sql
UPDATE MPUser SET Role = 'admin' WHERE Username = 'your_username';
```

## Project structure

```
app.js            Express app: sessions, page guards, routing
auth.js           Passport strategies (local and Google)
db.js             PostgreSQL connection pool
routes/           API routes: games, RAWG proxy, reviews, shelves, social, admin
public/pages/     HTML pages
public/js/        Page scripts and shared UI components
public/stylesheets/  Design tokens and styles
Schema.sql        Database schema
docs/             Migration postmortem and design notes
```

## Credits

Game data and artwork from the [RAWG Video Games Database API](https://rawg.io/apidocs).

Built by [Agrim Sharma](https://www.linkedin.com/in/agrim-sharma-821788302) · [GitHub](https://github.com/Agrim1305)

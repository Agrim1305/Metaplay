# MetaPlay Infrastructure Migrations

MetaPlay has been through two infrastructure migrations since deploy. This
document records both — the reasoning at each decision point, what broke,
and what I'd do differently. Written for my own reference and for anyone
curious enough to read the docs folder on the way to my code.

---

## Migration 1: Railway → Render + Aiven (July 31, 2026)

### Context

MetaPlay was originally deployed on Railway when the app first went live in
June 2026. It ran there for ~30 days on the free trial credit ($5). When the
credit expired, both the app and the database went offline.

### Options considered

1. **Pay $5/month for Railway's Hobby plan.** Keeps everything as-is.
   Ongoing cost of $60/year for a portfolio project with no users and no
   revenue.
2. **Migrate to a genuinely free tier.** More work up front, no ongoing
   cost.
3. **Take the app down entirely.** Zero cost, but breaks the live link on
   my LinkedIn post and portfolio site.

### Decision

Migrated to Render (web service) + Aiven (managed MySQL), both on free
tiers.

**Reasoning:** paying for hosting on an unfunded side project is the wrong
pattern to normalise — the cost compounds as I ship more projects, and for
a portfolio piece the signal that matters is "shipped a working app," not
"spent money to keep it always-on." The migration itself is portfolio
evidence too: working across two deployment stacks is a stronger talking
point than sticking with the first one.

### What I built

- Provisioned Aiven MySQL free tier in Sydney (closest region to me)
- Loaded the existing schema from `Schema.sql` — 9 tables including
  `MPUser`, `Games`, `Game_Reviews`, `MPGroup`, `Friends`, etc.
- Modified `db.js` to support SSL connections with an explicit CA
  certificate (Aiven's CA isn't in Node's default trust store)
- Deployed the Node.js/Express monolith to Render (Singapore region —
  closest to Sydney on Render's free tier)
- Updated Google Cloud Console OAuth to add the new Render redirect URI
- Promoted my own account to admin via a direct SQL UPDATE
  (`UPDATE MPUser SET Role='admin' WHERE Email=...`)

### Problems hit along the way

1. **Railway trial expired mid-flow.** The MySQL service was already
   offline when I started migration, meaning `mysqldump` from Railway
   wasn't possible. Since I didn't have real user data to preserve (test
   accounts only), I migrated the schema fresh instead.

2. **Aiven requires SSL with a specific CA.** First connection attempt
   failed with `self-signed certificate in certificate chain`. Fix:
   downloaded Aiven's CA cert, saved it to `certs/aiven-ca.pem`, updated
   `db.js` to load it explicitly with `rejectUnauthorized: true`.

3. **Google OAuth redirect URIs are per-environment.** The Render
   deployment got the URL `metaplay-g2q7.onrender.com` because
   `metaplay.onrender.com` was already taken. Had to update both the
   `GOOGLE_CALLBACK_URL` env var on Render and the Authorised Redirect
   URIs in Google Cloud Console.

### What I'd do differently next time

- **Design for portable deployment from day one.** Every hosting decision
  should be reversible — env vars only, no vendor-specific config baked
  in. If I'd done this originally, the migration would have been half the
  time.
- **Consider Postgres over MySQL.** The free tier options for Postgres in
  2026 (Neon, Supabase) are more generous than MySQL. For a fresh project
  I'd default to Postgres. (Foreshadowing — see Migration 2.)
- **Set up a proper session store.** Currently using Express's default
  MemoryStore, which drops all sessions on redeploy or spin-down. Should
  be Redis or a MySQL-backed session table.
- **Persistent secret management.** I keep secrets in a plain `.env`
  file. For a real product I'd use a secret manager (1Password, Doppler,
  or the hosting provider's own).

### What I'd take into an interview

- Working across two deployment stacks (Railway → Render + Aiven) is
  genuine breadth
- Debugging SSL/TLS connection errors is exactly the kind of "the code
  works on my laptop but not in production" problem senior engineers care
  about
- The decision framework — "don't pay for uptime you don't need" —
  reflects trade-off thinking, not just cost aversion

---

## Migration 2: Aiven MySQL → Neon Postgres (August 3, 2026)

### Context

Two days after the Railway migration, I hit a new problem: Aiven's
free-tier MySQL powers off after inactivity. Not "sleeps and wakes on
first query" — actually powers off, DNS stops resolving, and requires
manual clicking of a Power On button in the Aiven dashboard to bring back.

For a portfolio piece where the whole value is a recruiter or hiring
manager clicking the link at an arbitrary moment and it working, this
was unacceptable. First time it happened, I woke up to a broken app and
no realistic way to fix it before someone might see it.

### Options considered

1. **Pay $5/mo for Aiven's Hobbyist tier** to prevent auto-power-off.
   The same $5 I refused for Railway. Same reasoning against it — sets
   a bad pattern.
2. **Migrate to another free MySQL host.** Clever Cloud and db4free
   exist but are less polished; unclear whether they'd have the same
   idle-shutdown behavior.
3. **Migrate to Neon (Postgres).** Requires schema and code conversion
   from MySQL to Postgres. Neon's free tier is genuinely always-on for
   hobby projects — compute may sleep, but DNS resolves and first query
   wakes it transparently (unlike Aiven's manual power-on requirement).

### Decision

Migrated to Neon. The extra work of converting MySQL → Postgres was
worth doing once for a permanently always-on solution, and it added
useful portfolio evidence: working across two database engines is
better than working across one.

### What I built

- Provisioned Neon Postgres project in Sydney (`ap-southeast-2`)
- Converted schema from MySQL to Postgres:
  - `INT AUTO_INCREMENT` → `SERIAL`
  - `FLOAT` → `REAL`
  - `ENUM('user', 'admin')` → `VARCHAR + CHECK constraint`
  - `DATETIME` → `TIMESTAMP`
  - Removed `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` clauses (Postgres has no storage engines; UTF-8 is default)
  - Moved indexes out of table definitions into standalone `CREATE INDEX IF NOT EXISTS` statements
  - Replaced MySQL's `ON UPDATE CURRENT_TIMESTAMP` with a Postgres `BEFORE UPDATE` trigger + trigger function for `Game_Reviews.Updated_At`
- Rewrote `db.js`: `mysql2/promise` → `pg`, simplified SSL config (Neon uses a trusted-root CA so no explicit cert loading needed), individual connection params instead of a connection string (avoids URL-encoding issues with passwords containing special characters)
- Converted all 12 route files + `app.js`:
  - `?` placeholders → `$1, $2, ...` (per-query positional numbering)
  - `pool.execute()` → `pool.query()`
  - `const [rows] = await pool.execute(...)` → `const { rows } = await pool.query(...)`
  - `result.insertId` → `RETURNING id_col` + `rows[0].id_col`
  - `result.affectedRows` → `result.rowCount`
  - `ON DUPLICATE KEY UPDATE ... = VALUES(...)` → `ON CONFLICT (cols) DO UPDATE SET ... = EXCLUDED....`
  - `IFNULL()` → `COALESCE()`
  - `LIKE` → `ILIKE` for case-insensitive matching in user/group search
  - `err.code === 'ER_DUP_ENTRY'` → `err.code === '23505'` (Postgres SQLSTATE)
  - MySQL transactions (`pool.getConnection() + conn.beginTransaction()`) → Postgres transactions (`pool.connect() + client.query('BEGIN')`)
- Fixed a latent SQL bug in `social.js`: `Status = "pending"` (MySQL treats double-quoted strings as literals in default mode) failed on Postgres, which treats double quotes as identifier quotes. Changed to `Status = 'pending'`.
- Preserved the JS PascalCase interface (`user.User_ID`) by aliasing columns in SELECT statements (`SELECT User_ID AS "User_ID"`) — Postgres lowercases unquoted identifiers by default in result row keys, which would have broken every route otherwise.

### Problems hit along the way

1. **I missed converting `auth.js` on the first pass.** Google OAuth
   failed silently on the live site — clicking Sign In With Google
   returned users to the registration page rather than logging them in.
   Root cause: Passport's Google strategy in `auth.js` was still calling
   `pool.execute()` with mysql2 syntax. `grep -rn "pool.execute" .`
   would have caught it. Lesson: when doing a driver migration, grep the
   entire codebase for the old driver's API surface, not just the route
   files.

2. **My first Postgres schema was wrong.** I based it on the columns I
   thought I'd converted, not the columns the code actually uses. The
   `User_Game` table was missing `Rating` and `Review` columns; the
   `FriendRequests` table used different column names than the code
   expected. Had to run a `DROP` script and reload from a corrected
   `Schema.sql`. Lesson: verify the current schema against the code that
   uses it BEFORE writing the migration script, not after.

3. **Aiven's password had special characters that broke a
   connection-string URL.** Postgres connection URLs interpret `+`, `/`,
   `=`, `#`, etc. as delimiters. Fix: switched from
   `DATABASE_URL=postgresql://...` to individual `PGHOST`, `PGUSER`,
   `PGPASSWORD`, `PGDATABASE`, `PGPORT` env vars. Simpler and immune to
   encoding issues.

4. **RAWG API happened to go down during final testing.** Not a
   migration issue — RAWG returned Cloudflare 521 for hours. But it was
   a useful validation of the app's graceful failure mode: the
   `fetchWithTimeout` wrapper in `routes/rawg.js` caps requests at
   ~20 seconds and returns a clean 504 instead of hanging. The
   dashboard renders empty sections rather than crashing, and every
   other feature (auth, collections, reviews, friends, groups) is
   independent of RAWG and continues to work.

### What I'd do differently next time

- **Convert everything, then test.** I did the conversion in pieces and
  missed `auth.js` because it doesn't live in `routes/`. A systematic
  `grep` sweep at the start would have found it.
- **Write schema based on code, not memory.** Both schema mistakes came
  from me confidently rewriting the MySQL schema in Postgres syntax
  without first running `grep -rn "CREATE TABLE" .` on the original to
  confirm the actual columns.
- **Prefer individual DB config over connection strings.** No URL
  encoding to worry about, no ambiguity about which library parses which
  format, and env vars have clearer semantics per key.

### What I'd take into an interview

- Two DB migrations in three days is unusual for a portfolio project —
  it's genuine evidence I can work across engines, not just theoretical
  knowledge that MySQL and Postgres differ.
- The `"pending"` bug is a good "here's a subtle SQL semantics thing
  most people miss" talking point.
- The graceful failure story (RAWG down but the app still works) is
  worth mentioning as an example of designing for external-dependency
  failures.
- Reasoning about compounding trade-offs — refusing to pay for uptime
  when a free-tier engineering solution is available — is the kind of
  judgment senior engineers care about more than raw technical output.

---

## Current stack (as of August 3, 2026)

- **App:** Node.js + Express + Vue (served as static files)
- **Database:** Neon Postgres (Sydney)
- **Hosting:** Render (Singapore, free tier)
- **Auth:** Passport.js with local email/password + Google OAuth 2.0
- **External API:** RAWG for game metadata

**Live URL:** https://metaplay-g2q7.onrender.com
**Source code:** https://github.com/Agrim1305/Metaplay

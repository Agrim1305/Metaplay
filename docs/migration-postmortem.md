# MetaPlay: Railway → Render + Aiven Migration

**Date:** July 31, 2026
**Author:** Agrim Sharma

## Context

MetaPlay was originally deployed on Railway when the app first went live in June 2026. It ran there for ~30 days on the free trial credit ($5). When the credit expired, both the app and the database went offline.

## Options considered

1. **Pay $5/month for Railway's Hobby plan.** Keeps everything as-is. Ongoing cost of $60/year for a portfolio project with no users and no revenue.
2. **Migrate to a genuinely free tier.** More work up front, no ongoing cost.
3. **Take the app down entirely.** Zero cost, but breaks the live link on my LinkedIn post and portfolio site.

## Decision

Migrated to Render (web service) + Aiven (managed MySQL), both on free tiers.

**Reasoning:** paying for hosting on an unfunded side project is the wrong pattern to normalise — the cost compounds as I ship more projects, and for a portfolio piece the signal that matters is "shipped a working app," not "spent money to keep it always-on." The migration itself is portfolio evidence too: working across two deployment stacks is a stronger talking point than sticking with the first one.

## What I built

- Provisioned Aiven MySQL free tier in Sydney (closest region to me)
- Loaded the existing schema from `Schema.sql` — 9 tables including `MPUser`, `Games`, `Game_Reviews`, `MPGroup`, `Friends`, etc.
- Modified `db.js` to support SSL connections with an explicit CA certificate (Aiven's CA isn't in Node's default trust store)
- Deployed the Node.js/Express monolith to Render (Singapore region — closest to Sydney on Render's free tier)
- Updated Google Cloud Console OAuth to add the new Render redirect URI
- Promoted my own account to admin via a direct SQL UPDATE (`UPDATE MPUser SET Role='admin' WHERE Email=...`)

## Problems hit along the way

1. **Railway trial expired mid-flow.** The MySQL service was already offline when I started migration, meaning `mysqldump` from Railway wasn't possible. Since I didn't have real user data to preserve (test accounts only), I migrated the schema fresh instead.

2. **Aiven requires SSL with a specific CA.** First connection attempt failed with `self-signed certificate in certificate chain`. Fix: downloaded Aiven's CA cert, saved it to `certs/aiven-ca.pem`, updated `db.js` to load it explicitly with `rejectUnauthorized: true`.

3. **Google OAuth redirect URIs are per-environment.** The Render deployment got the URL `metaplay-g2q7.onrender.com` because `metaplay.onrender.com` was already taken. Had to update both the `GOOGLE_CALLBACK_URL` env var on Render and the Authorised Redirect URIs in Google Cloud Console.

## What I'd do differently next time

- **Design for portable deployment from day one.** Every hosting decision should be reversible — env vars only, no vendor-specific config baked in. If I'd done this originally, the migration would have been half the time.
- **Consider Postgres for MySQL.** The free tier options for Postgres in 2026 (Neon, Supabase) are more generous than MySQL. For a fresh project I'd default to Postgres.
- **Set up a proper session store.** Currently using Express's default MemoryStore, which drops all sessions on redeploy or spin-down. Should be Redis or a MySQL-backed session table.
- **Persistent secret management.** I keep secrets in a plain `.env` file. For a real product I'd use a secret manager (1Password, Doppler, or the hosting provider's own).

## What I'd take into an interview

- Working across two deployment stacks (Railway → Render + Aiven) is genuine breadth
- Debugging SSL/TLS connection errors is exactly the kind of "the code works on my laptop but not in production" problem senior engineers care about
- The decision framework — "don't pay for uptime you don't need" — reflects trade-off thinking, not just cost aversion

## References

- **Current live URL:** https://metaplay-g2q7.onrender.com
- **Source code:** https://github.com/Agrim1305/Metaplay
- **Stack:** Vue.js, Node.js, Express, MySQL, Passport.js
- **Hosting:** Render (app), Aiven (database)

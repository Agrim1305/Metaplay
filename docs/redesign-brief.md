# MetaPlay redesign: implementation brief (v4)

Hand this file to Claude Code together with the "MetaPlay Redesign" design canvas. Put it in `docs/` in the repo.

## Goal

Make MetaPlay feel like a game library, not a stack of identical grids. Cover art carries the colour, the user's own data (shelves, scores, stats) becomes visual, and every common action (change status, rate, accept a friend) happens in one tap without opening a modal.

## Ground rules

- Stay on the current stack: Express, server-served HTML, vanilla JS. No framework migration in this pass.
- Remove the Vue 2 CDN from `profile.html` and `my_reviews.html` (Vue 2 is end-of-life). Rewrite those two pages in vanilla JS like the rest.
- Use ES modules (`<script type="module">`) for new shared front-end code so pages can import components.
- Do not change auth, sessions, or the admin role logic.
- Every RAWG field shown in the design already exists in RAWG responses. Anything marked "NEW API" on the canvas needs a backend route (listed below).

## Design tokens

Replace `public/stylesheets/style.css` with a fresh file built on these variables. Delete the old override-patching history; it is the reason the current CSS fights itself.

```css
:root {
  --bg: #0E0F11;  --surface: #151619;  --raised: #1D1F23;  --line: #2A2C31;
  --ink: #EDEEF0; --ink-2: #A4A7AE;    --ink-3: #7E828A;
  --brand: #E5484D;             /* logo, active nav marker, today, Playing. Not for buttons. */
  --wishlist: #E0A83E; --playing: #E5484D; --completed: #5E9EE0; --meta-high: #46A758;
  --r-badge: 4px; --r-control: 6px; --r-panel: 8px;
  --font-sans: 'Geist', system-ui, sans-serif;   /* 400/500/600 */
  --font-mono: 'Geist Mono', monospace;          /* scores, dates */
  --font-display: 'Barlow Condensed', sans-serif; /* 700: schedule day names, profile numbers */
}
```

Self-host Geist, Geist Mono and Barlow Condensed (`npm i geist`, copy the woff2 files into `public/fonts/`) rather than linking Google Fonts. Icons: Material Symbols Outlined (self-hosted font or the `material-symbols` npm package), 18px, filled only for active states.

Rules:
- Primary button is `--ink` fill with `--bg` text. Secondary is a 1px `--line` outline. The brand red is never a button fill.
- No card boxes around game tiles: cover, title, one meta line. Panels use a 1px line, not a fill. Section headings sit on a 1px rule. No uppercase eyebrow labels.
- A status colour never appears alone. Always pair it with its icon (bookmark / play_arrow / check_circle) and label.
- Metacritic badge is the only place score colour appears: 90+ `--meta-high`, 75 to 89 `--wishlist`, below 75 `--ink-3`. User scores are plain mono text.
- Hover and keyboard focus on a game tile: 2px `--ink` ring on the cover plus quick actions fade in, 150ms. No lift, no glow.
- Visible focus ring on everything (2px `--brand` outline, 2px offset). Hit areas at least 32px on desktop, 44px on touch.
- Wrap all animation in `@media (prefers-reduced-motion: no-preference)`.

## Logo

"Save file": a game cartridge (clipped top-right corner) whose bottom ends in a bookmark notch, with a red label and one grip line. It reads as "a saved game", which is what MetaPlay stores. SVG, 24 by 24 viewBox:

```html
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M5.8 2.5H16.4L19 5.1V21.2L12 16.6L5 21.2V3.3C5 2.9 5.4 2.5 5.8 2.5Z" fill="var(--ink)"/>
  <rect x="7.6" y="5.4" width="8.8" height="6.2" rx="0.7" fill="var(--brand)"/>
  <rect x="7.6" y="13" width="8.8" height="0.9" fill="var(--bg)"/>
</svg>
```

The label is the only accent; on a red background it flips to white. The grip line is cut out in whatever the background colour is. Wordmark is Geist 600 at -0.02em, set next to the mark with an 8px gap at nav size. Ship `public/images/logo.svg`, a favicon at 16 and 32px, and a 180px app icon (red label on dark, or white label on red). Replace the old play-triangle square everywhere. Do not pair it with a play triangle.

## Shared front-end components (`public/js/ui/`)

| File | What it renders | Used on |
| --- | --- | --- |
| `nav.js` | Sticky blurred top bar: logo, Home / Discover / Social / Profile (+ Admin for admins), search field (`/` focuses it), avatar menu with Logout. Replaces `header.js`. | All app pages |
| `gameCard.js` | 16:10 cover (no box around it), Metacritic badge top-left, quick-action buttons on hover and focus, title, then one meta line with genre, library-status icon if owned, and your score. Click goes to the game page. | Home, Discover, Game page |
| `statusControl.js` | Segmented Wishlist / Playing / Completed. Click active segment again to remove from library. Optimistic update + toast with Undo. | Game page, card quick actions |
| `scorePips.js` | 10 buttons (radio group) colouring up to the chosen score. | Game page |
| `toast.js` | Bottom-right toast with optional Undo action, 5s. Replace current `toast.js`. | Everywhere |
| `skeleton.js` | Shimmer placeholders for cards and rows while RAWG loads. Never show an empty grid. | Everywhere |
| `art.js` | Fallback cover when `background_image` is null: a deterministic gradient from the game id. | gameCard and heroes |

## Page-by-page

| Canvas board | File | Notes |
| --- | --- | --- |
| 01 Landing | `public/pages/index.html` | Keeps the original v1 look on purpose (only the logo changes, to the Save file lockup): Bricolage Grotesque headline, coral glow background, rotating three-column cover wall that scrolls (stops under reduced motion), two floating cards (a friend's review, a status change), and four feature cards. Covers need real art: `/rawg` requires auth today, so either add a small public `/rawg/public/trending` route with the same cache, or ship 12 static cover URLs. Restyle `login.html` and `registration.html` to match the landing, not the app. |
| 02 Home | `public/pages/dashboard.html` | Greeting and a stat strip (counts per shelf, average score, a nudge to rate an unrated completed game). Library with underline tabs for Playing / Wishlist / Completed (replaces three separate grids). Release calendar (below). Trending: a spotlight image plus a numbered list of five; clicking a row swaps the spotlight. |
| 02 Home: release schedule | `public/js/ui/releaseSchedule.js` | A week strip, not a month grid. Header "Release schedule" with today's date, and an All releases / My wishlist toggle (selected state is a red fill). Seven day columns: a small date label ("Today" in red for today) above the weekday in Barlow Condensed 700 at about 68px, uppercase. Selected day is bright with a 3px underline, other days dim, past days dimmer. Small squares under each weekday show how many releases that day has (amber if wishlisted). Arrows move a week at a time. Below, a list of the selected day's releases: 16:9 thumb, title, genre and platforms, a round wishlist toggle and a pill "View game" button. An empty day says so and offers "Jump to" the next release. The selected day's first cover tints the top of the panel. Data: `GET /rawg/games?dates=<start>,<end>&ordering=released&page_size=40` for a 4-week window, bucketed by `released`, cross-referenced with `/user-games?status=wishlist`; fetch the next window when the user arrows past it. |
| 03 Game page | NEW `public/pages/game.html?id=` | Replaces the modal on every page. Full-bleed backdrop, three score tiles (Metacritic, RAWG /5, yours /10), status control, screenshots with thumbnail picker, collapsible description, review form with score pips, RAWG `ratings` distribution bar, details list, "In your circle", and "More in <first genre>". |
| 04 Discover | `public/pages/discover.html` (keep `seeAll.html` as a redirect that maps `?category=` to the scope) | Big search (debounced 300ms, no Search button), genre chips (multi), platform chips, sort select, grid/list toggle, left scope list (All, Trending, Coming soon, My Playing, My Wishlist, My Completed). Map chips to RAWG params: `genres`, `parent_platforms`, `ordering`, `search`. Load more uses RAWG `next`. |
| 05 Profile | `public/pages/profile.html` (+ fold `my_reviews.html` into an "All reviews" view) | A player card, not a stats page. Tilted mosaic banner from the user's cover art, avatar with a gradient ring, a title chip from their top genre ("Soulslike specialist"), and a level panel with an XP bar. Four coloured shelf tiles. Eight hexagon achievement badges (unlocked in colour, locked greyed with progress). Now playing as large covers. Genres as a coloured stacked bar plus chips. Score histogram coloured by band (1-4 red, 5-7 amber, 8-10 green). Hall of fame with score medals (gold for 10, silver for 9). Recent reviews as cards. Keep `edit_profile.html` but restyle. |
| 06 Social | `public/pages/social.html` | Friend activity feed, requests with one-tap accept and decline, friends list with "now playing", group cards with join and leave toggle. Restyle `group_create.html` to match. |
| 07 Tokens | n/a | Source of truth for the CSS above. |

Admin page: restyle with the tokens and table styles only. It was not redesigned.

## Backend work

Phase 1 needs only items 1 and 2. Items 3 to 6 unlock the Profile stats and the social features.

1. **Fix the N+1 calls.** `dashboard.js` and `seeAll.js` fetch `/rawg/games/:id` once per saved game. Use the existing `POST /rawg/games/batch` instead.
2. **Screenshots proxy.** `GET /rawg/games/:id/screenshots`, same cache and timeout pattern as the other RAWG routes.
3. **Stats.** `GET /api/me/stats` returns counts per status, review count, average score, a 1 to 10 histogram, friend count and whether the user owns a group, all from existing tables. Level and badges are computed client side from these, no new tables: XP = 100 per completed game + 50 per review + 10 per tracked game; level L starts at 25 x L x (L + 1) XP. Badges: First clear (1 completed), Completionist (25 completed), Critic (10 reviews), Tastemaker (25 reviews), Specialist (5 completed in one RAWG genre, which also sets the title chip), Party of six (5 friends), Founder (owns a group), Collector (50 tracked). "Genres you play" is computed client side from the batch RAWG data (`genres` array), not in SQL.
4. **Friend activity feed.** `GET /api/feed?limit=20` returns friends' reviews ordered by `Game_Reviews.Created_At`, joined through `Friends` (check both `User_ID_1` and `User_ID_2`).
5. **Friends on a game.** `GET /api/games/:id/friends` returns each friend's status and score for that game.
6. **Status timestamps.** Add `Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP` to `User_Game` (with a trigger like the one on `Game_Reviews`). This powers "started playing" and "completed" events in the feed and "now playing" ordering. Without it the feed can show reviews only.

## Decision needed before building: rating scale

The DB allows 1 to 10, but the current UI writes 1 to 5 stars into that column. The design uses a 10-point score. Before switching, run `SELECT MAX(Rating) FROM Game_Reviews;`. If every value is 5 or below, migrate with `UPDATE Game_Reviews SET Rating = Rating * 2;` in the same deploy that ships the new review form. If values above 5 exist, the data is already mixed and needs a manual look.

## Suggested build order

1. Tokens, `nav.js`, `toast.js`, `skeleton.js`, `art.js`, `gameCard.js`. Restyle every page with the new CSS so nothing looks broken mid-way.
2. Game page (`game.html`) and switch every card to link there. Delete both modals.
3. Home dashboard.
4. Discover (with the `seeAll.html` redirect).
5. Backend items 3 to 6, then Profile and Social.
6. Landing, login, registration, admin restyle.

Ship after each step. Every step leaves the app working.

## Acceptance checks

- No page makes more than one RAWG request per visible game on first load (batch or list responses only).
- Every page works at 390px wide: nav wraps, rails scroll horizontally, no sideways page scroll.
- Keyboard: Tab reaches every card action, status segment, score pip, and chip; Esc closes menus.
- Text contrast at least 4.5:1 against its background, checked on `--surface` and on the hero gradient overlay.
- Null `background_image`, null `metacritic`, and RAWG 429/504 each have a visible fallback, never a blank card.

require('dotenv').config();
require('./auth');

const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const passport = require('passport');
const pool = require('./db');

const app = express();

// Railway (and most PaaS hosts) sit behind a reverse proxy. Without this,
// Express won't know the original request was HTTPS, and secure cookies break.
app.set('trust proxy', 1);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// STATIC "PUBLIC" FOLDER (CSS, JS, images, etc.)
// Served before session/auth middleware so static assets skip that work.
app.use(express.static(path.resolve(__dirname, 'public')));

// Session configuration
app.use(
  session({
    // No hardcoded fallback: if SESSION_SECRET is unset the app should fail
    // loudly rather than silently use a guessable secret in production.
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Only require HTTPS-only cookies in production; stays false locally.
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    rolling: true, // Refresh session on activity
    name: 'sid', // Shorter cookie name
    unset: 'destroy' // Remove session from store when unset
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Optimized user data caching middleware
app.use(async (req, res, next) => {
  // Skip if not authenticated
  if (!req.isAuthenticated() && !req.session.username) {
    return next();
  }

  // If we already have cached data, use it
  if (req.session.userData) {
    return next();
  }

  // Get user ID from either Passport or session
  const userId = (req.user && req.user.User_ID) || req.session.userId;
  if (!userId) {
    return next();
  }

  try {
    // Single query to get all user data
    const [[userData]] = await pool.execute(
      'SELECT User_ID, Username, Email, Bio, Role FROM MPUser WHERE User_ID = ?',
      [userId]
    );

    if (userData) {
      req.session.userData = userData;
      req.session.username = userData.Username;
      req.session.userId = userData.User_ID;
      req.session.isAdmin = userData.Role === 'admin';
    }
  } catch (err) {
    // Log so a broken session lookup is visible in production logs.
    console.error('User cache middleware error:', err.message);
  }
  return next();
});

// ROUTE-GUARD HELPERS
const showAuthRequired = (res) => res.redirect('/pages/auth_required.html');
const showAccessDenied = (res) => res.redirect('/pages/accessDenied.html');

function ensureAuth(req, res, next) {
  const loggedInViaPassport = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  const loggedInViaSession = Boolean(req.session.username);

  if (loggedInViaPassport || loggedInViaSession) {
    return next();
  }
  return showAuthRequired(res);
}

function ensureAdmin(req, res, next) {
  const isLoggedIn = (typeof req.isAuthenticated === 'function' && req.isAuthenticated())
    || Boolean(req.session.username);

  if (!isLoggedIn) {
    return showAuthRequired(res);
  }

  const isAdmin = (req.user && req.user.Role === 'admin') || Boolean(req.session.isAdmin);

  return isAdmin ? next() : showAccessDenied(res);
}

// Protected routes
const protectedRoutes = {
  '/pages/dashboard.html': 'dashboard.html',
  '/pages/profile.html': 'profile.html',
  '/pages/admin.html': ['admin.html', ensureAdmin]
};

Object.entries(protectedRoutes).forEach(([route, config]) => {
  const [file, ...middleware] = Array.isArray(config) ? config : [config];
  app.get(route, ensureAuth, ...middleware, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'pages', file));
  });
});

// Public routes
const publicPages = [
  'index.html',
  'registration.html',
  'login.html',
  'auth_required.html'
];

publicPages.forEach((page) => {
  app.get([`/pages/${page}`, `/${page}`], (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'pages', page));
  });
});

// index.html
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'pages', 'index.html'));
});

// ROUTERS (API HANDLERS & LOGIC)
// Game-related: reuse the same router for both "/games" and "/api/games"
app.use('/games', require('./routes/games'));
app.use('/api/games', require('./routes/games'));

// Any "home" API calls
app.use('/', require('./routes/index'));

// Authentication & user management
app.use('/signup', require('./routes/signup'));
const loginRouter = require('./routes/login');
app.use('/auth', loginRouter);

// Admin
const adminRouter = require('./routes/admin');
app.use('/admin', adminRouter);

// Profile
app.use('/profile', require('./routes/profile'));

// User-Game relationships
app.use('/user-games', require('./routes/user_game'));

// Game profile & reviews
app.use('/game-profile', require('./routes/game_profile'));
app.use('/game-reviews', require('./routes/game_review'));
app.use('/user-review', require('./routes/userReview'));

// RAWG proxy
app.use('/rawg', require('./routes/rawg'));

// Social features (friends and groups)
app.use('/api', require('./routes/social'));

// Google OAuth routes
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/pages/login.html' }),
  (req, res) => {
    req.session.username = req.user.Username;
    req.session.userId = req.user.User_ID;
    req.session.isAdmin = req.user.Role === 'admin';
    return res.redirect('/pages/dashboard.html');
  }
);

// Logout
app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    return req.session.destroy(() => res.redirect('/'));
  });
});

// /get-user endpoint with caching
app.get('/get-user', (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Expires', '0');
  res.setHeader('Pragma', 'no-cache');

  if (req.session.userData) {
    const me = req.session.userData;
    return res.json({
      userId: me.User_ID,
      username: me.Username,
      email: me.Email,
      bio: me.Bio,
      role: me.Role
    });
  }

  if (req.user) {
    const me = req.user;
    return res.json({
      userId: me.User_ID,
      username: me.Username,
      email: me.Email,
      bio: me.Bio,
      role: me.Role
    });
  }

  if (req.session.username) {
    return res.json({
      userId: req.session.userId,
      username: req.session.username,
      email: null,
      bio: null,
      role: req.session.isAdmin ? 'admin' : 'user'
    });
  }

  return res.status(401).json({ error: 'Not logged in' });
});

// 404 & global error handler
app.use((req, res) => res.status(404).send('404 Not Found'));

// All four args required for Express to treat this as an error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('500 Server Error');
});

module.exports = app;
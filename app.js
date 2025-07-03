require('dotenv').config();
require('./auth');

const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const passport = require('passport');
const pool = require('./db');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// STATIC "PUBLIC" FOLDER (CSS, JS, images, etc.)
// Move static file serving BEFORE session/auth middleware for better performance
app.use(express.static(path.resolve(__dirname, 'public')));

// Session configuration optimized for performance
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'Metaplay',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    // Performance optimizations
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
    // Single optimized query to get all user data
    const [[userData]] = await pool.execute(
      'SELECT User_ID, Username, Email, Bio, Role FROM MPUser WHERE User_ID = ?',
      [userId]
    );

    if (userData) {
      // Cache the full user data in session
      req.session.userData = userData;

      // Also update session flags for compatibility
      req.session.username = userData.Username;
      req.session.userId = userData.User_ID;
      req.session.isAdmin = userData.Role === 'admin';
    }
  } catch (err) {
    // Ignore errors - user will be redirected anyway
  }
  return next();
});

// ROUTE‐GUARD HELPERS
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
    // On successful Google OAuth: Store user info in session
    req.session.username = req.user.Username;
    req.session.userId = req.user.User_ID;
    req.session.isAdmin = req.user.Role === 'admin';
    // Redirect to the protected Dashboard
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
  // Set cache control headers
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Expires', '0');
  res.setHeader('Pragma', 'no-cache');

  // First check session cache
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

  // Fallback to Passport user
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

  // Last resort: basic session data
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

app.use((err, req, res, next) => {
  res.status(500).send('500 Server Error');
});

module.exports = app;

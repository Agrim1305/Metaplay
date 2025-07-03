// Authentication utility functions

// Check if user is logged in
function isLoggedIn(req) {
  // Check session cache
  if (req.session && req.session.userData) {
    return true;
  }
  // Then check session flags
  if (req.session && req.session.username) {
    return true;
  }
  // Finally check Passport
  return typeof req.isAuthenticated === 'function' && req.isAuthenticated();
}

// Check if user has admin role
function isAdmin(req) {
  // Check session cache
  if (req.session && req.session.userData && req.session.userData.Role === 'admin') {
    return true;
  }

  // Then check session flag
  if (req.session && req.session.isAdmin) {
    return true;
  }

  // Finally check Passport user
  return req.user && req.user.Role === 'admin';
}

// Get user ID from either Passport or session
function getLoggedInUserId(req) {
  // Check session cache
  if (req.session && req.session.userData) {
    return req.session.userData.User_ID;
  }

  // Then check session flag
  if (req.session && req.session.userId) {
    return req.session.userId;
  }

  // Finally check Passport user
  return req.user && req.user.User_ID;
}

// Middleware to ensure user is authenticated
function ensureAuth(req, res, next) {
  if (isLoggedIn(req)) {
    return next();
  }
  return res.status(401).json({ error: 'Not logged in' });
}

// Middleware to ensure user is admin
function ensureAdmin(req, res, next) {
  if (isAdmin(req)) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied' });
}

// Export authentication utility functions
module.exports = {
  isLoggedIn,
  isAdmin,
  getLoggedInUserId,
  ensureAuth,
  ensureAdmin
};

// Routes for serving the home page

const express = require('express');
const path = require('path');
const router = express.Router();

// Serve the home page
router.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/pages/index.html'));
});

module.exports = router;

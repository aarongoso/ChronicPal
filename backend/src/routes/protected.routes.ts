const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const router = express.Router();

/**
 * Example protected route for any logged-in user
 */
router.get('/user', authenticateToken, (req, res) => {
  res.json({ message: `Hello ${req.user.email}, you are logged in as ${req.user.role}.` });
});

/**
 * Example admin-only route
 */
router.get('/admin', authenticateToken, authorizeRoles(['admin']), (req, res) => {
  res.json({ message: 'Welcome Admin! This route is restricted.' });
});

/**
 * Example doctor-only route
 */
router.get('/doctor', authenticateToken, authorizeRoles(['doctor']), (req, res) => {
  res.json({ message: 'Welcome Doctor! You have access to this route.' });
});

module.exports = router;

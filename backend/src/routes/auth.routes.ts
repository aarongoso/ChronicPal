const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/user.model')(require('../config/db').sequelize);

const router = express.Router();

/**
 * POST /auth/login
 * Verifies user credentials and issues both access & refresh tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check that email and password were provided
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Look up the user in the database
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Compare plaintext password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Prepare payload data for tokens
    const payload = { id: user.id, email: user.email, role: user.role };

    // Create a short-lived access token (15 min)
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    // Create a long-lived refresh token (7 days)
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Send refresh token in secure HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, // cookie not accessible via JS → prevents XSS
      secure: false,  // set true if using HTTPS in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    // Send access token & basic user info in response body
    res.status(200).json({
      message: 'Login successful.',
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Something went wrong during login.' });
  }
});

/**
 * POST /auth/refresh
 * Validates the refresh token from cookie and issues a new access token
 */
router.post('/refresh', (req, res) => {
  // Extract refresh token from cookies
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token missing.' });
  }

  try {
    // Verify refresh token using JWT secret
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Create a new short-lived access token
    const newAccessToken = jwt.sign(
      { id: payload.id, email: payload.email, role: payload.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    // Return new access token to client
    res.json({ token: newAccessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user.model')(require('../config/db').sequelize);

const router = express.Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Simple input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    // Create the new user (bcrypt runs automatically in model hook)
    const newUser = await User.create({ email, password, role });

    res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Something went wrong during registration.' });
  }
});

module.exports = router;

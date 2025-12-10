// routes/auth.js - Authentication Routes

const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Generate simple token (in production, use JWT)
function generateToken() {
  return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * POST /api/auth/signin
 * Sign in with email and password
 */
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    if (!user.comparePassword(password)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken();

    // Return success
    res.json({
      success: true,
      token: token,
      user: user.toPublicJSON(),
      message: 'Sign in successful',
    });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during sign in',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Create new user
    // NOTE: In production, hash the password with bcrypt!
    const user = new User({
      name,
      email: email.toLowerCase(),
      password, // Should be hashed in production!
    });

    await user.save();

    // Generate token
    const token = generateToken();

    // Return success
    res.status(201).json({
      success: true,
      token: token,
      user: user.toPublicJSON(),
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during sign up',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/guest
 * Create a guest session
 */
router.post('/guest', async (req, res) => {
  try {
    // Create guest user
    const guestEmail = `guest_${Date.now()}@allthingsclean.com`;
    const user = new User({
      name: 'Guest User',
      email: guestEmail,
      password: 'guest_' + Math.random().toString(36),
      isGuest: true,
    });

    await user.save();

    // Generate token
    const token = generateToken();

    // Return success
    res.json({
      success: true,
      token: token,
      user: user.toPublicJSON(),
      message: 'Guest session created',
    });
  } catch (error) {
    console.error('Guest session error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred creating guest session',
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/profile
 * Get user profile (requires token)
 */
router.get('/profile', async (req, res) => {
  try {
    // In a real app, you'd verify the token and get user ID from it
    // For now, just return mock profile
    res.json({
      success: true,
      user: {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        isGuest: false,
      },
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred fetching profile',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/signout
 * Sign out user
 */
router.post('/signout', async (req, res) => {
  try {
    // In a real app, you'd invalidate the token
    res.json({
      success: true,
      message: 'Signed out successfully',
    });
  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during sign out',
      error: error.message,
    });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

// ─── Helper: send token response ─────────────────────────────────────────────
const sendToken = (user, studentData, statusCode, res) => {
  const token = user.getSignedJwt();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:        user._id,
      username:  user.username,
      name:      user.name,
      role:      user.role,
      studentId: user.studentId,
      student:   studentData || null,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { username, password }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Fetch user with password field (select: false by default)
    const user = await User.findOne({ username: username.toLowerCase() }).select('+password');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // If student, fetch their student document
    let studentData = null;
    if (user.role === 'student' && user.studentId) {
      studentData = await Student.findById(user.studentId);
    }

    sendToken(user, studentData, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me        [Protected]
// Returns current logged-in user info
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    let studentData = null;
    if (user.role === 'student' && user.studentId) {
      studentData = await Student.findById(user.studentId);
    }
    res.json({
      success: true,
      user: {
        id:        user._id,
        username:  user.username,
        name:      user.name,
        role:      user.role,
        studentId: user.studentId,
        student:   studentData,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password   [Protected]
// Body: { currentPassword, newPassword }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords required.' });
    }
    const user = await User.findById(req.user.id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

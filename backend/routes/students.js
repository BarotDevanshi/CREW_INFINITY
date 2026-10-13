const express     = require('express');
const router      = express.Router();
const Student     = require('../models/Student');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, authorize } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/students
// Query: ?programme=&semester=&search=
// [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, authorize('coordinator'), async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.programme) filter.programme = new RegExp(req.query.programme, 'i');
    if (req.query.semester)  filter.semester  = Number(req.query.semester);
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: re }, { enrollmentNo: re }, { email: re }];
    }
    const students = await Student.find(filter).sort({ enrollmentNo: 1 });
    res.json({ success: true, count: students.length, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/students/:id
// [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/students    [Coordinator only]
// Body: { name, enrollmentNo, programme, semester, contact, email, address?,
//         username, password }
// Creates both Student + User (login) records atomically
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { name, enrollmentNo, programme, semester, contact, email, address, username, password } = req.body;

    if (!name || !enrollmentNo || !programme || !semester || !contact || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'All fields including username and password are required.' });
    }

    // Create student first
    const student = await Student.create({ name, enrollmentNo, programme, semester, contact, email, address });

    // Create linked user
    const user = await User.create({
      username: username.toLowerCase(),
      password,
      role: 'student',
      name,
      studentId: student._id,
    });

    // Link back
    student.userId = user._id;
    await student.save();

    res.status(201).json({
      success: true,
      message: `Student ${name} registered. Login: ${username}`,
      data: student,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({ success: false, message: `${field} already exists.` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/students/:id    [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    // Don't allow enrollmentNo change via this route (sensitive)
    delete req.body.enrollmentNo;
    delete req.body.userId;

    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/students/:id   [Coordinator only — soft delete]
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    // Check for active outstanding transactions
    const active = await Transaction.findOne({
      studentId: req.params.id,
      status: { $in: ['active', 'partially_returned', 'overdue'] },
    });
    if (active) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate student with outstanding issued items. Ensure all items are returned first.',
      });
    }
    const student = await Student.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    // Also deactivate user account
    await User.findByIdAndUpdate(student.userId, { isActive: false });

    res.json({ success: true, message: 'Student deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/students/:id/transactions
// [Coordinator: any student | Student: own only]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/transactions', protect, async (req, res) => {
  try {
    // Students can only view their own transactions
    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user.id });
      if (!student || student._id.toString() !== req.params.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const transactions = await Transaction.find({ studentId: req.params.id })
      .populate('itemId', 'name code category trackingType')
      .populate('assetId', 'assetTag serialNumber condition')
      .populate('issuingStaff', 'name username')
      .populate('renewalRequests.approvedBy', 'name')
      .populate('returns.receivingStaff', 'name')
      .sort({ issueDate: -1 });

    // Mark overdue on the fly
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const enriched = transactions.map((t) => {
      const obj = t.toJSON();
      if (['active', 'partially_returned'].includes(t.status) && new Date(t.dueDate) < today) {
        obj.status = 'overdue';
        obj.overdueDays = Math.floor((today - new Date(t.dueDate)) / 86400000);
      }
      return obj;
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

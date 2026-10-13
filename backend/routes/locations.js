const express   = require('express');
const router    = express.Router();
const Location  = require('../models/Location');
const { protect, authorize } = require('../middleware/auth');

// All location routes require login; write routes require coordinator
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/locations
// Query: ?department=&type=&search=
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.department) filter.department = new RegExp(req.query.department, 'i');
    if (req.query.type)       filter.type = req.query.type;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: re }, { department: re }];
    }
    const locations = await Location.find(filter).sort({ department: 1, name: 1 });
    res.json({ success: true, count: locations.length, data: locations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/locations/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found.' });
    res.json({ success: true, data: loc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/locations      [Coordinator only]
// Body: { department, type, name, building?, floor?, notes? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { department, type, name, building, floor, notes } = req.body;
    if (!department || !type || !name) {
      return res.status(400).json({ success: false, message: 'department, type, and name are required.' });
    }
    const loc = await Location.create({ department, type, name, building, floor, notes });
    res.status(201).json({ success: true, data: loc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/locations/:id   [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const loc = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found.' });
    res.json({ success: true, data: loc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/locations/:id   [Coordinator only — soft delete]
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const loc = await Location.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found.' });
    res.json({ success: true, message: 'Location deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

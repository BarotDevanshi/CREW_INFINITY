const express  = require('express');
const router   = express.Router();
const Item     = require('../models/Item');
const StockLog = require('../models/StockLog');
const Policy   = require('../models/Policy');
const { protect, authorize } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stock/log      [Coordinator only]
// Query: ?itemId=&type=&from=&to=
// ─────────────────────────────────────────────────────────────────────────────
router.get('/log', protect, authorize('coordinator'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.itemId) filter.itemId = req.query.itemId;
    if (req.query.type)   filter.type   = req.query.type;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }

    const logs = await StockLog.find(filter)
      .populate('itemId',      'name code')
      .populate('assetId',     'assetTag')
      .populate('performedBy', 'name username')
      .sort({ date: -1 });

    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stock/adjust    [Coordinator only]
// Body: { itemId, type, quantityChange, reason, conditionFrom?, conditionTo?, assetId? }
// type: 'new_stock' | 'correction' | 'retirement' | 'condition_change'
// ─────────────────────────────────────────────────────────────────────────────
router.post('/adjust', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { itemId, type, quantityChange, reason, conditionFrom, conditionTo, assetId } = req.body;

    if (!itemId || !type || quantityChange === undefined || !reason) {
      return res.status(400).json({ success: false, message: 'itemId, type, quantityChange, and reason are required.' });
    }

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    // Apply adjustments to item quantities based on type
    if (type === 'new_stock') {
      item.totalQty += parseInt(quantityChange);
    } else if (type === 'correction') {
      item.totalQty = Math.max(0, item.totalQty + parseInt(quantityChange));
    } else if (type === 'retirement') {
      item.totalQty = Math.max(0, item.totalQty - parseInt(Math.abs(quantityChange)));
      item.retiredQty += parseInt(Math.abs(quantityChange));
    } else if (type === 'condition_change') {
      // Update condition counters
      const from = conditionFrom;
      const to   = conditionTo;
      const cnt  = parseInt(Math.abs(quantityChange));

      // Decrease from-condition counter
      if (from === 'damaged')     item.damagedQty     = Math.max(0, item.damagedQty - cnt);
      if (from === 'lost')        item.lostQty        = Math.max(0, item.lostQty - cnt);
      if (from === 'maintenance') item.maintenanceQty = Math.max(0, item.maintenanceQty - cnt);

      // Increase to-condition counter
      if (to === 'damaged')     item.damagedQty     += cnt;
      if (to === 'lost')        item.lostQty        += cnt;
      if (to === 'maintenance') item.maintenanceQty += cnt;
    }

    await item.save();

    // Log
    const log = await StockLog.create({
      itemId, type, quantityChange, conditionFrom, conditionTo,
      assetId: assetId || null,
      reason, performedBy: req.user.id, date: new Date(),
    });

    res.status(201).json({ success: true, message: 'Stock adjustment recorded.', data: { item, log } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stock/policy    [Protected]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/policy', protect, async (req, res) => {
  try {
    const policy = await Policy.findOne() || { issueDays: 15, renewalDays: 15, maxRenewals: 3, maxIssueQty: 5 };
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/stock/policy    [Coordinator only]
// Body: { issueDays?, renewalDays?, maxRenewals?, maxIssueQty?, notes? }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/policy', protect, authorize('coordinator'), async (req, res) => {
  try {
    let policy = await Policy.findOne();
    if (!policy) {
      policy = await Policy.create({ ...req.body, issueDays: 15 });
    } else {
      const { renewalDays, maxRenewals, maxIssueQty, allowedProgrammes, notes } = req.body;
      Object.assign(policy, { renewalDays, maxRenewals, maxIssueQty, allowedProgrammes, notes, issueDays: 15 });
      await policy.save();
    }
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

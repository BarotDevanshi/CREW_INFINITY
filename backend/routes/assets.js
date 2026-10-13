const express  = require('express');
const router   = express.Router();
const Asset    = require('../models/Asset');
const Item     = require('../models/Item');
const StockLog = require('../models/StockLog');
const { protect, authorize } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/assets
// Query: ?itemId=&status=&condition=&search=
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, authorize('coordinator'), async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.itemId)    filter.itemId    = req.query.itemId;
    if (req.query.status)    filter.status    = req.query.status;
    if (req.query.condition) filter.condition = req.query.condition;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ assetTag: re }, { serialNumber: re }];
    }
    const assets = await Asset.find(filter)
      .populate('itemId', 'name code category')
      .populate('locationId', 'name department')
      .sort({ assetTag: 1 });
    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/assets/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('itemId', 'name code category')
      .populate('locationId', 'name department');
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/assets     [Coordinator only]
// Body: { itemId, assetTag, serialNumber?, locationId?, condition?, notes? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { itemId, assetTag, serialNumber, locationId, condition, notes } = req.body;
    if (!itemId || !assetTag) {
      return res.status(400).json({ success: false, message: 'itemId and assetTag are required.' });
    }
    // Verify parent item is asset-tracked
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Parent item not found.' });
    if (item.trackingType !== 'asset') {
      return res.status(400).json({ success: false, message: 'Cannot add individual asset to a quantity-tracked item.' });
    }

    const asset = await Asset.create({ itemId, assetTag, serialNumber, locationId, condition, notes });

    // Log stock
    await StockLog.create({
      itemId, type: 'new_stock', quantityChange: 1, assetId: asset._id,
      reason: `Asset ${assetTag} added`, performedBy: req.user.id,
    });

    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Asset tag already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/assets/:id    [Coordinator only]
// Body: any updatable fields (condition, locationId, notes, serialNumber)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const existing = await Asset.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Asset not found.' });

    const oldCondition = existing.condition;
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    // If condition changed, log it
    if (req.body.condition && req.body.condition !== oldCondition) {
      await StockLog.create({
        itemId: existing.itemId, type: 'condition_change', quantityChange: 0,
        assetId: existing._id,
        conditionFrom: oldCondition, conditionTo: req.body.condition,
        reason: req.body.reason || 'Condition updated by coordinator',
        performedBy: req.user.id,
      });
    }

    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/assets/:id   [Coordinator only — soft delete / retire]
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    if (asset.status === 'issued') {
      return res.status(400).json({ success: false, message: 'Cannot retire an asset that is currently issued.' });
    }
    asset.isActive = false;
    asset.status   = 'retired';
    await asset.save();

    await StockLog.create({
      itemId: asset.itemId, type: 'retirement', quantityChange: -1, assetId: asset._id,
      reason: req.body.reason || 'Asset retired', performedBy: req.user.id,
    });

    res.json({ success: true, message: 'Asset retired.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

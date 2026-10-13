const express      = require('express');
const router       = express.Router();
const Item         = require('../models/Item');
const Asset        = require('../models/Asset');
const Transaction  = require('../models/Transaction');
const StockLog     = require('../models/StockLog');
const { protect, authorize } = require('../middleware/auth');

// ─── Helper: compute available qty for a quantity-based item ──────────────────
const getAvailableQty = async (item) => {
  if (item.trackingType === 'asset') return null; // handled per-asset
  // sum outstanding qty from active transactions
  const result = await Transaction.aggregate([
    {
      $match: {
        itemId: item._id,
        status: { $in: ['active', 'partially_returned', 'overdue'] },
      },
    },
    { $group: { _id: null, totalOutstanding: { $sum: '$outstandingQty' } } },
  ]);
  const issuedQty = result.length ? result[0].totalOutstanding : 0;
  const unavailable = item.damagedQty + item.lostQty + item.maintenanceQty + item.retiredQty;
  return item.totalQty - unavailable - issuedQty;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/items
// Query: ?category=&trackingType=&search=
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.category)     filter.category     = new RegExp(req.query.category, 'i');
    if (req.query.trackingType) filter.trackingType  = req.query.trackingType;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: re }, { code: re }, { category: re }];
    }

    const items = await Item.find(filter).populate('locationId', 'name department type').sort({ name: 1 });

    // Attach availableQty for each item
    const enriched = await Promise.all(
      items.map(async (item) => {
        const obj = item.toJSON();
        obj.availableQty = await getAvailableQty(item);
        if (item.trackingType === 'asset') {
          obj.availableQty = await Asset.countDocuments({
            itemId: item._id, status: 'available', condition: 'good', isActive: true,
          });
          obj.issuedQty = await Asset.countDocuments({ itemId: item._id, status: 'issued', isActive: true });
        } else {
          const result = await Transaction.aggregate([
            { $match: { itemId: item._id, status: { $in: ['active', 'partially_returned', 'overdue'] } } },
            { $group: { _id: null, total: { $sum: '$outstandingQty' } } },
          ]);
          obj.issuedQty = result.length ? result[0].total : 0;
        }
        return obj;
      })
    );

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/items/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('locationId');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    const obj = item.toJSON();
    if (item.trackingType === 'asset') {
      obj.availableQty = await Asset.countDocuments({ itemId: item._id, status: 'available', condition: 'good', isActive: true });
      obj.issuedQty    = await Asset.countDocuments({ itemId: item._id, status: 'issued', isActive: true });
      obj.assets       = await Asset.find({ itemId: item._id, isActive: true }).populate('locationId', 'name');
    } else {
      obj.availableQty = await getAvailableQty(item);
      const result     = await Transaction.aggregate([
        { $match: { itemId: item._id, status: { $in: ['active', 'partially_returned', 'overdue'] } } },
        { $group: { _id: null, total: { $sum: '$outstandingQty' } } },
      ]);
      obj.issuedQty = result.length ? result[0].total : 0;
    }

    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/items     [Coordinator only]
// Body: { code, name, category, description?, makeModel?, trackingType, totalQty, locationId? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { code, name, category, description, makeModel, trackingType, totalQty, locationId } = req.body;
    if (!code || !name || !category || !trackingType || totalQty === undefined) {
      return res.status(400).json({ success: false, message: 'code, name, category, trackingType, totalQty are required.' });
    }
    const item = await Item.create({ code, name, category, description, makeModel, trackingType, totalQty, locationId });

    // Log stock addition
    await StockLog.create({
      itemId: item._id, type: 'new_stock', quantityChange: totalQty,
      reason: 'Initial stock entry', performedBy: req.user.id,
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Item code already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/items/:id    [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/items/:id   [Coordinator only — soft delete]
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, message: 'Item deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/items/:id/assets   [Coordinator only]
// All assets belonging to an item
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/assets', protect, authorize('coordinator'), async (req, res) => {
  try {
    const assets = await Asset.find({ itemId: req.params.id, isActive: true })
      .populate('locationId', 'name department')
      .sort({ assetTag: 1 });
    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

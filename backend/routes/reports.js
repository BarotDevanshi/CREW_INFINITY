const express     = require('express');
const router      = express.Router();
const Transaction = require('../models/Transaction');
const Item        = require('../models/Item');
const Asset       = require('../models/Asset');
const Student     = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// ─── Helper: overdue check ────────────────────────────────────────────────────
const enrichOverdue = (t) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const obj = t.toJSON ? t.toJSON() : t;
  if (['active', 'partially_returned'].includes(t.status) && new Date(t.dueDate) < today) {
    obj.computedStatus = 'overdue';
    obj.overdueDays = Math.floor((today - new Date(t.dueDate)) / 86400000);
  } else {
    obj.computedStatus = t.status;
    obj.overdueDays = 0;
  }
  return obj;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/summary    [Coordinator only]
// Overall inventory summary
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', protect, authorize('coordinator'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [items, totalStudents, activeTransactions, overdueTransactions, pendingRenewals] = await Promise.all([
      Item.find({ isActive: true }),
      Student.countDocuments({ isActive: true }),
      Transaction.countDocuments({ status: { $in: ['active', 'partially_returned'] } }),
      Transaction.countDocuments({ status: { $in: ['active', 'partially_returned', 'overdue'] }, dueDate: { $lt: today } }),
      Transaction.countDocuments({ 'renewalRequests.approvalStatus': 'pending' }),
    ]);

    const totalItems     = items.length;
    const totalQty       = items.reduce((s, i) => s + i.totalQty, 0);
    const totalDamaged   = items.reduce((s, i) => s + i.damagedQty, 0);
    const totalLost      = items.reduce((s, i) => s + i.lostQty, 0);
    const totalMaint     = items.reduce((s, i) => s + i.maintenanceQty, 0);

    res.json({
      success: true,
      data: {
        totalItems,
        totalQty,
        totalStudents,
        activeTransactions,
        overdueTransactions,
        pendingRenewals,
        totalDamaged,
        totalLost,
        totalMaintenance: totalMaint,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/student/:id    [Coordinator only]
// All transactions for a specific student
// ─────────────────────────────────────────────────────────────────────────────
router.get('/student/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const transactions = await Transaction.find({ studentId: req.params.id })
      .populate('itemId',  'name code category trackingType')
      .populate('assetId', 'assetTag serialNumber')
      .populate('issuingStaff', 'name')
      .populate('returns.receivingStaff', 'name')
      .sort({ issueDate: -1 });

    const enriched = transactions.map(enrichOverdue);

    res.json({
      success: true,
      student,
      totalTransactions: enriched.length,
      data: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/item/:id    [Coordinator only]
// All transactions for a specific item
// ─────────────────────────────────────────────────────────────────────────────
router.get('/item/:id', protect, authorize('coordinator'), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    const transactions = await Transaction.find({ itemId: req.params.id })
      .populate('studentId', 'name enrollmentNo programme semester')
      .populate('assetId',   'assetTag serialNumber condition')
      .populate('issuingStaff', 'name')
      .sort({ issueDate: -1 });

    const enriched = transactions.map(enrichOverdue);

    // Aggregate stats
    const totalIssued    = enriched.length;
    const currentlyOut   = enriched.filter((t) => ['active', 'partially_returned', 'overdue'].includes(t.status)).length;
    const overdue        = enriched.filter((t) => t.computedStatus === 'overdue').length;

    res.json({
      success: true,
      item,
      stats: { totalIssued, currentlyOut, overdue },
      data: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/programme/:programme    [Coordinator only]
// Query: ?semester=
// All transactions for students of a specific programme
// ─────────────────────────────────────────────────────────────────────────────
router.get('/programme/:programme', protect, authorize('coordinator'), async (req, res) => {
  try {
    const programmeFilter = { programme: new RegExp(req.params.programme, 'i'), isActive: true };
    if (req.query.semester) programmeFilter.semester = Number(req.query.semester);

    const students = await Student.find(programmeFilter);
    const studentIds = students.map((s) => s._id);

    const transactions = await Transaction.find({ studentId: { $in: studentIds } })
      .populate('studentId', 'name enrollmentNo semester')
      .populate('itemId',    'name code category')
      .populate('assetId',   'assetTag')
      .sort({ issueDate: -1 });

    const enriched = transactions.map(enrichOverdue);

    res.json({
      success: true,
      programme: req.params.programme,
      studentCount: students.length,
      totalTransactions: enriched.length,
      data: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/location/:locationId    [Coordinator only]
// Items stored in / issued from a specific location
// ─────────────────────────────────────────────────────────────────────────────
router.get('/location/:locationId', protect, authorize('coordinator'), async (req, res) => {
  try {
    const items  = await Item.find({ locationId: req.params.locationId, isActive: true });
    const assets = await Asset.find({ locationId: req.params.locationId, isActive: true })
      .populate('itemId', 'name code');

    const itemIds = items.map((i) => i._id);
    const transactions = await Transaction.find({
      itemId: { $in: itemIds },
      status: { $in: ['active', 'partially_returned', 'overdue'] },
    })
      .populate('studentId', 'name enrollmentNo')
      .populate('itemId',    'name code')
      .populate('assetId',   'assetTag');

    res.json({
      success: true,
      locationId: req.params.locationId,
      itemCount:  items.length,
      assetCount: assets.length,
      items,
      assets,
      activeTransactions: transactions.map(enrichOverdue),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/stock    [Coordinator only]
// Full stock breakdown for all items
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stock', protect, authorize('coordinator'), async (req, res) => {
  try {
    const items = await Item.find({ isActive: true }).populate('locationId', 'name department');

    const result = await Promise.all(
      items.map(async (item) => {
        const obj = item.toJSON();

        if (item.trackingType === 'asset') {
          obj.availableQty    = await Asset.countDocuments({ itemId: item._id, status: 'available', condition: 'good', isActive: true });
          obj.issuedQty       = await Asset.countDocuments({ itemId: item._id, status: 'issued', isActive: true });
          obj.damagedAssets   = await Asset.countDocuments({ itemId: item._id, condition: 'damaged', isActive: true });
          obj.lostAssets      = await Asset.countDocuments({ itemId: item._id, condition: 'lost', isActive: true });
          obj.maintenanceAssets = await Asset.countDocuments({ itemId: item._id, condition: 'maintenance', isActive: true });
        } else {
          const r = await Transaction.aggregate([
            { $match: { itemId: item._id, status: { $in: ['active', 'partially_returned', 'overdue'] } } },
            { $group: { _id: null, total: { $sum: '$outstandingQty' } } },
          ]);
          obj.issuedQty    = r.length ? r[0].total : 0;
          const unavail    = item.damagedQty + item.lostQty + item.maintenanceQty + item.retiredQty;
          obj.availableQty = item.totalQty - unavail - obj.issuedQty;
        }

        // Overdue count
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const od = await Transaction.countDocuments({
          itemId: item._id,
          status: { $in: ['active', 'partially_returned', 'overdue'] },
          dueDate: { $lt: today },
        });
        obj.overdueQty = od;

        return obj;
      })
    );

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

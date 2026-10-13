const express     = require('express');
const router      = express.Router();
const Transaction = require('../models/Transaction');
const Item        = require('../models/Item');
const Asset       = require('../models/Asset');
const Student     = require('../models/Student');
const Policy      = require('../models/Policy');
const { protect, authorize } = require('../middleware/auth');

const ISSUE_DURATION_DAYS = 15;

// ─── Helper: add days to a date ───────────────────────────────────────────────
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// ─── Helper: get policy (with defaults) ──────────────────────────────────────
const getPolicy = async () => {
  const p = await Policy.findOne();
  return p || { issueDays: 15, renewalDays: 15, maxRenewals: 3, maxIssueQty: 5 };
};

// ─── Helper: get available qty for quantity-based item ────────────────────────
const getAvailableQty = async (item) => {
  const result = await Transaction.aggregate([
    { $match: { itemId: item._id, status: { $in: ['active', 'partially_returned', 'overdue'] } } },
    { $group: { _id: null, total: { $sum: '$outstandingQty' } } },
  ]);
  const issued     = result.length ? result[0].total : 0;
  const unavailable = item.damagedQty + item.lostQty + item.maintenanceQty + item.retiredQty;
  return item.totalQty - unavailable - issued;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions
// Query: ?status=&studentId=&itemId=&from=&to=
// [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, authorize('coordinator'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)    filter.status    = req.query.status;
    if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.itemId)    filter.itemId    = req.query.itemId;
    if (req.query.from || req.query.to) {
      filter.issueDate = {};
      if (req.query.from) filter.issueDate.$gte = new Date(req.query.from);
      if (req.query.to)   filter.issueDate.$lte = new Date(req.query.to);
    }

    const transactions = await Transaction.find(filter)
      .populate('studentId', 'name enrollmentNo programme semester')
      .populate('itemId',    'name code category trackingType')
      .populate('assetId',   'assetTag serialNumber condition')
      .populate('issuingStaff', 'name username')
      .populate('renewalRequests.approvedBy', 'name')
      .populate('returns.receivingStaff', 'name')
      .sort({ issueDate: -1 });

    // Compute overdue on-the-fly
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const enriched = transactions.map((t) => {
      const obj = t.toJSON();
      if (['active', 'partially_returned'].includes(t.status) && new Date(t.dueDate) < today) {
        obj.computedStatus = 'overdue';
        obj.overdueDays = Math.floor((today - new Date(t.dueDate)) / 86400000);
      } else {
        obj.computedStatus = t.status;
        obj.overdueDays = 0;
      }
      return obj;
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions/overdue     [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overdue', protect, authorize('coordinator'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const transactions = await Transaction.find({
      status: { $in: ['active', 'partially_returned', 'overdue'] },
      dueDate: { $lt: today },
    })
      .populate('studentId', 'name enrollmentNo programme contact email')
      .populate('itemId',    'name code')
      .populate('assetId',   'assetTag')
      .sort({ dueDate: 1 });

    const result = transactions.map((t) => {
      const obj = t.toJSON();
      obj.overdueDays = Math.floor((today - new Date(t.dueDate)) / 86400000);
      // Human-readable message as per spec
      const assetLabel = t.assetId ? `${t.itemId.name} ${t.assetId.assetTag}` : t.itemId.name;
      obj.overdueMessage = `${assetLabel} issued to student enrolment number ${t.studentId.enrollmentNo} was due on ${new Date(t.dueDate).toDateString()} and is overdue by ${obj.overdueDays} day(s).`;
      return obj;
    });

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions/upcoming-due    [Coordinator only]
// Returns transactions due in the next N days (default 3)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/upcoming-due', protect, authorize('coordinator'), async (req, res) => {
  try {
    const days  = parseInt(req.query.days || '3');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limit = new Date(today); limit.setDate(limit.getDate() + days);

    const transactions = await Transaction.find({
      status: { $in: ['active', 'partially_returned'] },
      dueDate: { $gte: today, $lte: limit },
    })
      .populate('studentId', 'name enrollmentNo contact email')
      .populate('itemId',    'name code')
      .populate('assetId',   'assetTag')
      .sort({ dueDate: 1 });

    const result = transactions.map((t) => {
      const obj = t.toJSON();
      obj.daysLeft = Math.floor((new Date(t.dueDate) - today) / 86400000);
      return obj;
    });

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions/my     [Student only]
// Returns the logged-in student's own transactions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const transactions = await Transaction.find({ studentId: student._id })
      .populate('itemId',  'name code category trackingType')
      .populate('assetId', 'assetTag serialNumber condition')
      .populate('issuingStaff', 'name')
      .populate('renewalRequests.approvedBy', 'name')
      .populate('returns.receivingStaff', 'name')
      .sort({ issueDate: -1 });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const enriched = transactions.map((t) => {
      const obj = t.toJSON();
      if (['active', 'partially_returned'].includes(t.status) && new Date(t.dueDate) < today) {
        obj.computedStatus = 'overdue';
        obj.overdueDays = Math.floor((today - new Date(t.dueDate)) / 86400000);
      } else {
        obj.computedStatus = t.status;
        obj.overdueDays = 0;
        obj.daysLeft = Math.max(0, Math.floor((new Date(t.dueDate) - today) / 86400000));
      }
      return obj;
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions/pending-renewals   [Coordinator only]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending-renewals', protect, authorize('coordinator'), async (req, res) => {
  try {
    const transactions = await Transaction.find({
      'renewalRequests.approvalStatus': 'pending',
      status: { $in: ['active', 'partially_returned', 'overdue'] },
    })
      .populate('studentId', 'name enrollmentNo programme contact')
      .populate('itemId',    'name code')
      .populate('assetId',   'assetTag')
      .sort({ 'renewalRequests.requestDate': 1 });

    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const t = await Transaction.findById(req.params.id)
      .populate('studentId', 'name enrollmentNo programme semester contact email')
      .populate('itemId',    'name code category trackingType')
      .populate('assetId',   'assetTag serialNumber condition')
      .populate('issuingStaff', 'name username')
      .populate('renewalRequests.approvedBy', 'name')
      .populate('returns.receivingStaff', 'name');

    if (!t) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    // Students can only see their own
    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user.id });
      if (!student || t.studentId._id.toString() !== student._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const obj = t.toJSON();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (['active', 'partially_returned'].includes(t.status) && new Date(t.dueDate) < today) {
      obj.computedStatus = 'overdue';
      obj.overdueDays = Math.floor((today - new Date(t.dueDate)) / 86400000);
    }

    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/issue    [Coordinator only]
// Body: { studentId, itemId, assetId?, quantity, purpose, issueDate }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/issue', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { studentId, itemId, assetId, quantity, purpose, issueDate } = req.body;

    if (!studentId || !itemId || !quantity || !purpose || !issueDate) {
      return res.status(400).json({ success: false, message: 'studentId, itemId, quantity, purpose, issueDate are required.' });
    }

    const policy = await getPolicy();

    // ── Rule 1: Student must be registered ───────────────────────────────────
    const student = await Student.findById(studentId);
    if (!student || !student.isActive) {
      return res.status(400).json({ success: false, message: 'Student is not registered or inactive.' });
    }

    // ── Fetch item ────────────────────────────────────────────────────────────
    const item = await Item.findById(itemId);
    if (!item || !item.isActive) {
      return res.status(400).json({ success: false, message: 'Item not found or inactive.' });
    }

    // ── Asset-tracked item ────────────────────────────────────────────────────
    if (item.trackingType === 'asset') {
      if (!assetId) {
        return res.status(400).json({ success: false, message: 'assetId is required for asset-tracked items.' });
      }

      const asset = await Asset.findById(assetId);
      if (!asset || !asset.isActive) {
        return res.status(400).json({ success: false, message: 'Asset not found or inactive.' });
      }

      // Rule 2: Only usable condition
      if (asset.condition !== 'good') {
        return res.status(400).json({
          success: false,
          message: `Asset ${asset.assetTag} is not in good condition (current: ${asset.condition}). Cannot be issued.`,
        });
      }

      // Rule 3 + 4: Must be available and not already issued
      if (asset.status !== 'available') {
        return res.status(400).json({
          success: false,
          message: `Asset ${asset.assetTag} is currently ${asset.status}. Cannot be issued to another student.`,
        });
      }

      // ── Calculate due date ─────────────────────────────────────────────────
      const dueDate = addDays(new Date(issueDate), ISSUE_DURATION_DAYS);

      // ── Create transaction ─────────────────────────────────────────────────
      const transaction = await Transaction.create({
        studentId, itemId, assetId,
        issuedQty: 1, returnedQty: 0, outstandingQty: 1,
        purpose, issueDate: new Date(issueDate), dueDate,
        issuingStaff: req.user.id,
        status: 'active',
      });

      // Update asset status
      asset.status = 'issued';
      await asset.save();

      const populated = await transaction.populate([
        { path: 'studentId', select: 'name enrollmentNo programme' },
        { path: 'itemId',    select: 'name code' },
        { path: 'assetId',   select: 'assetTag serialNumber' },
        { path: 'issuingStaff', select: 'name' },
      ]);

      return res.status(201).json({
        success: true,
        message: `${item.name} (${asset.assetTag}) issued to ${student.name}. Due: ${dueDate.toDateString()}`,
        acknowledgement: {
          transactionId:  transaction._id,
          student:        student.name,
          enrollmentNo:   student.enrollmentNo,
          item:           item.name,
          assetTag:       asset.assetTag,
          issuedQty:      1,
          purpose,
          issueDate:      new Date(issueDate),
          dueDate,
          issuingStaff:   req.user.name,
        },
        data: populated,
      });
    }

    // ── Quantity-tracked item ─────────────────────────────────────────────────
    const qty = parseInt(quantity);
    const availableQty = await getAvailableQty(item);

    // Rule 3: Quantity check
    if (qty > availableQty) {
      return res.status(400).json({
        success: false,
        message: `${qty} ${item.name}(s) were requested, but only ${availableQty} are currently available.`,
        requested: qty,
        available: availableQty,
      });
    }

    // Policy check: max qty per issue
    if (qty > policy.maxIssueQty) {
      return res.status(400).json({
        success: false,
        message: `Issue quantity (${qty}) exceeds the maximum allowed (${policy.maxIssueQty}) per transaction.`,
      });
    }

    const dueDate = addDays(new Date(issueDate), ISSUE_DURATION_DAYS);

    const transaction = await Transaction.create({
      studentId, itemId, assetId: null,
      issuedQty: qty, returnedQty: 0, outstandingQty: qty,
      purpose, issueDate: new Date(issueDate), dueDate,
      issuingStaff: req.user.id,
      status: 'active',
    });

    const populated = await transaction.populate([
      { path: 'studentId', select: 'name enrollmentNo programme' },
      { path: 'itemId',    select: 'name code category' },
      { path: 'issuingStaff', select: 'name' },
    ]);

    res.status(201).json({
      success: true,
      message: `${qty} ${item.name}(s) issued to ${student.name}. Due: ${dueDate.toDateString()}`,
      acknowledgement: {
        transactionId: transaction._id,
        student:       student.name,
        enrollmentNo:  student.enrollmentNo,
        item:          item.name,
        issuedQty:     qty,
        purpose,
        issueDate:     new Date(issueDate),
        dueDate,
        issuingStaff:  req.user.name,
      },
      data: populated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/:id/return    [Coordinator only]
// Body: { returnedQty, conditionOnReturn, actualReturnDate, notes? }
// Supports partial returns
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/return', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { returnedQty, conditionOnReturn, actualReturnDate, notes } = req.body;

    if (!returnedQty || !conditionOnReturn || !actualReturnDate) {
      return res.status(400).json({ success: false, message: 'returnedQty, conditionOnReturn, actualReturnDate are required.' });
    }

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    if (transaction.status === 'returned') {
      return res.status(400).json({ success: false, message: 'This transaction is already fully returned.' });
    }

    const qty = parseInt(returnedQty);
    if (qty > transaction.outstandingQty) {
      return res.status(400).json({
        success: false,
        message: `Cannot return ${qty}. Only ${transaction.outstandingQty} outstanding.`,
      });
    }

    // Record the return
    transaction.returns.push({
      returnDate: new Date(actualReturnDate),
      qtyReturned: qty,
      conditionOnReturn,
      receivingStaff: req.user.id,
      notes,
    });

    transaction.returnedQty    += qty;
    transaction.outstandingQty -= qty;

    if (transaction.outstandingQty === 0) {
      transaction.status = 'returned';
    } else {
      transaction.status = 'partially_returned';
    }

    await transaction.save();

    // ── For asset-tracked: update asset status & condition ────────────────────
    if (transaction.assetId) {
      const asset = await Asset.findById(transaction.assetId);
      if (asset) {
        asset.status    = 'available';
        asset.condition = conditionOnReturn === 'good' ? 'good' : conditionOnReturn;
        await asset.save();
      }
    }

    res.json({
      success: true,
      message: transaction.outstandingQty === 0
        ? 'Item fully returned.'
        : `Partial return recorded. ${transaction.outstandingQty} unit(s) still outstanding.`,
      data: transaction,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/:id/renewal-request    [Student only]
// NOTE: Does NOT extend due date — only logs the request
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/renewal-request', protect, authorize('student'), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    // Ensure student owns this transaction
    const student = await Student.findOne({ userId: req.user.id });
    if (!student || transaction.studentId.toString() !== student._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (transaction.status === 'returned') {
      return res.status(400).json({ success: false, message: 'Cannot request renewal for a returned item.' });
    }

    // Check for existing pending renewal
    const hasPending = transaction.renewalRequests.some((r) => r.approvalStatus === 'pending');
    if (hasPending) {
      return res.status(400).json({ success: false, message: 'A renewal request is already pending for this transaction.' });
    }

    // Check max renewals policy
    const policy      = await getPolicy();
    const approvedCnt = transaction.renewalRequests.filter((r) => r.approvalStatus === 'approved').length;
    if (approvedCnt >= policy.maxRenewals) {
      return res.status(400).json({
        success: false,
        message: `Maximum renewals (${policy.maxRenewals}) already used for this transaction.`,
      });
    }

    // Add renewal request — due date stays the same
    transaction.renewalRequests.push({
      requestDate:    new Date(),
      approvalStatus: 'pending',
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Renewal request submitted. Due date remains unchanged until coordinator approves.',
      data: transaction,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/transactions/:id/renewal-approve    [Coordinator only]
// Body: { renewalRequestId, remarks? }
// Extends dueDate by renewalDays from CURRENT due date
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/renewal-approve', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { renewalRequestId, remarks } = req.body;
    if (!renewalRequestId) {
      return res.status(400).json({ success: false, message: 'renewalRequestId is required.' });
    }

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    const renewal = transaction.renewalRequests.id(renewalRequestId);
    if (!renewal) return res.status(404).json({ success: false, message: 'Renewal request not found.' });
    if (renewal.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'This renewal request is not pending.' });
    }

    const policy = await getPolicy();
    // Extend from CURRENT due date (not today)
    const newDueDate = addDays(transaction.dueDate, policy.renewalDays);

    renewal.approvalStatus = 'approved';
    renewal.revisedDueDate = newDueDate;
    renewal.approvedBy     = req.user.id;
    renewal.remarks        = remarks || '';
    renewal.resolvedAt     = new Date();

    // Update transaction due date
    transaction.dueDate = newDueDate;
    // If was overdue, reset to active
    if (transaction.status === 'overdue') transaction.status = 'active';

    await transaction.save();

    res.json({
      success: true,
      message: `Renewal approved. New due date: ${newDueDate.toDateString()}`,
      data: transaction,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/transactions/:id/renewal-reject    [Coordinator only]
// Body: { renewalRequestId, remarks }
// Due date stays the same — item remains overdue if past due
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/renewal-reject', protect, authorize('coordinator'), async (req, res) => {
  try {
    const { renewalRequestId, remarks } = req.body;
    if (!renewalRequestId) {
      return res.status(400).json({ success: false, message: 'renewalRequestId is required.' });
    }

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    const renewal = transaction.renewalRequests.id(renewalRequestId);
    if (!renewal) return res.status(404).json({ success: false, message: 'Renewal request not found.' });
    if (renewal.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'This renewal request is not pending.' });
    }

    renewal.approvalStatus = 'rejected';
    renewal.approvedBy     = req.user.id;
    renewal.remarks        = remarks || '';
    renewal.resolvedAt     = new Date();

    // Due date NOT changed
    await transaction.save();

    res.json({
      success: true,
      message: 'Renewal request rejected. Due date remains unchanged.',
      data: transaction,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

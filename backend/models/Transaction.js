const mongoose = require('mongoose');

// ─── Sub-schema: Return Record ────────────────────────────────────────────────
const returnRecordSchema = new mongoose.Schema(
  {
    returnDate:       { type: Date, required: true },
    qtyReturned:      { type: Number, required: true, min: 1 },
    conditionOnReturn:{ type: String, enum: ['good', 'damaged', 'lost'], required: true },
    receivingStaff:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes:            { type: String, trim: true },
  },
  { _id: true }
);

// ─── Sub-schema: Renewal Request ─────────────────────────────────────────────
const renewalRequestSchema = new mongoose.Schema(
  {
    requestDate:    { type: Date, default: Date.now },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    // Set ONLY when approved — currentDueDate + 15 days at time of approval
    revisedDueDate: { type: Date, default: null },
    approvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    remarks:        { type: String, trim: true, default: '' },
    resolvedAt:     { type: Date, default: null },
  },
  { _id: true }
);

// ─── Main Transaction Schema ──────────────────────────────────────────────────
const transactionSchema = new mongoose.Schema(
  {
    // ── Core refs ──
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item',    required: true },
    // Only populated for trackingType = 'asset'
    assetId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Asset',   default: null },

    // ── Quantities ──
    issuedQty:      { type: Number, required: true, min: 1 },
    returnedQty:    { type: Number, default: 0, min: 0 },
    outstandingQty: { type: Number, required: true, min: 0 },   // issuedQty - returnedQty

    // ── Issue Details ──
    purpose:      { type: String, required: true, trim: true },
    issueDate:    { type: Date, required: true },
    dueDate:      { type: Date, required: true },   // issueDate + 15 days (auto-calculated)
    issuingStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Status ──
    // active            → item is currently issued, outstanding
    // partially_returned→ some qty returned, some still outstanding
    // returned          → fully returned
    // overdue           → passed dueDate, not yet returned/renewed
    status: {
      type: String,
      enum: ['active', 'partially_returned', 'returned', 'overdue'],
      default: 'active',
    },

    // ── Sub-documents ──
    returns:         [returnRecordSchema],
    renewalRequests: [renewalRequestSchema],

    // ── Soft-delete / archive ──
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Virtual: overdue days ────────────────────────────────────────────────────
transactionSchema.virtual('overdueDays').get(function () {
  if (this.status === 'returned') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(this.dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
});

// ─── Virtual: pending renewal request ────────────────────────────────────────
transactionSchema.virtual('pendingRenewal').get(function () {
  return this.renewalRequests.find((r) => r.approvalStatus === 'pending') || null;
});

transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);

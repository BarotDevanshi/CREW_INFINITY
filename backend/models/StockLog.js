const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema(
  {
    itemId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    type: {
      type: String,
      // new_stock   → new purchase added
      // correction  → manual count correction
      // retirement  → item permanently removed
      // condition   → condition status change (good/damaged/lost/maintenance)
      enum: ['new_stock', 'correction', 'retirement', 'condition_change'],
      required: true,
    },
    // Positive = added, Negative = removed
    quantityChange: { type: Number, required: true },
    // For condition changes: old → new
    conditionFrom:  { type: String, enum: ['good', 'damaged', 'lost', 'maintenance', ''], default: '' },
    conditionTo:    { type: String, enum: ['good', 'damaged', 'lost', 'maintenance', ''], default: '' },
    // For asset-level items
    assetId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    reason:         { type: String, required: true, trim: true },
    performedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:           { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockLog', stockLogSchema);

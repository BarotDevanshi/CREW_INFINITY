const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    assetTag:     { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. DB-001
    serialNumber: { type: String, trim: true, default: '' },
    locationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    condition: {
      type: String,
      enum: ['good', 'damaged', 'lost', 'maintenance'],
      default: 'good',
    },
    status: {
      type: String,
      enum: ['available', 'issued', 'retired'],
      default: 'available',
    },
    notes:    { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// An asset is issuable only when available AND condition is good
assetSchema.virtual('isIssuable').get(function () {
  return this.status === 'available' && this.condition === 'good';
});

assetSchema.set('toJSON', { virtuals: true });
assetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Asset', assetSchema);

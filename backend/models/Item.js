const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    code:         { type: String, required: true, unique: true, trim: true, uppercase: true },
    name:         { type: String, required: true, trim: true },
    category:     { type: String, required: true, trim: true },     // e.g. Electronics, Cables
    description:  { type: String, trim: true },
    makeModel:    { type: String, trim: true },                      // Make/Model
    // 'asset'    → individually tracked (laptops, dev boards) each has unique assetId
    // 'quantity' → tracked by count only (cables, adapters)
    trackingType: { type: String, enum: ['asset', 'quantity'], required: true },
    totalQty:     { type: Number, required: true, min: 0, default: 0 },
    // Quantity breakdown — maintained by system on every transaction
    damagedQty:     { type: Number, default: 0, min: 0 },
    lostQty:        { type: Number, default: 0, min: 0 },
    maintenanceQty: { type: Number, default: 0, min: 0 },
    retiredQty:     { type: Number, default: 0, min: 0 },
    // Default storage location
    locationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual: Available Quantity
// availableQty = totalQty - damagedQty - lostQty - maintenanceQty - retiredQty - issuedQty
// issuedQty is computed by querying transactions separately (see reports route)
// This virtual gives non-issued unavailable count
itemSchema.virtual('unavailableQty').get(function () {
  return this.damagedQty + this.lostQty + this.maintenanceQty + this.retiredQty;
});

itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Item', itemSchema);

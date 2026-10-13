const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    department: { type: String, required: true, trim: true },
    type:       { type: String, enum: ['laboratory', 'room', 'cupboard', 'other'], required: true },
    name:       { type: String, required: true, trim: true },   // e.g. "Lab 3 - Cupboard B"
    building:   { type: String, trim: true },
    floor:      { type: String, trim: true },
    notes:      { type: String, trim: true },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual: full readable label
locationSchema.virtual('fullLabel').get(function () {
  return `${this.department} — ${this.name} (${this.type})`;
});

locationSchema.set('toJSON', { virtuals: true });
locationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Location', locationSchema);

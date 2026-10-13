const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    enrollmentNo:   { type: String, required: true, unique: true, trim: true, uppercase: true },
    programme:      { type: String, required: true, trim: true },   // e.g. M.Sc. DFIS
    semester:       { type: Number, required: true, min: 1, max: 10 },
    contact:        { type: String, required: true, trim: true },
    email:          { type: String, required: true, trim: true, lowercase: true },
    address:        { type: String, trim: true },
    isActive:       { type: Boolean, default: true },
    // userId links to User collection for login
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Virtual: full label for display
studentSchema.virtual('displayName').get(function () {
  return `${this.name} (${this.enrollmentNo}) — ${this.programme} Sem ${this.semester}`;
});

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);

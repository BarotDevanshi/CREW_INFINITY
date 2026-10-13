const mongoose = require('mongoose');

const policySchema = new mongoose.Schema(
  {
    // Only one policy document is maintained (singleton pattern)
    issueDays:       { type: Number, default: 15 },   // Days before item is due
    renewalDays:     { type: Number, default: 15 },   // Days added on renewal
    maxRenewals:     { type: Number, default: 3 },    // Max renewals per transaction
    maxIssueQty:     { type: Number, default: 5 },    // Max qty per issue per student per item
    allowedProgrammes: [{ type: String }],            // Restrict to specific programmes (empty = all)
    notes:           { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Policy', policySchema);

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true }, // e.g. "Grade 8-A"
    guardianPhone: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Roll numbers are unique within a class
studentSchema.index({ className: 1, rollNo: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
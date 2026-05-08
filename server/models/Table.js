const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
    number: { type: Number, required: true },
    status: { type: String, enum: ['available', 'occupied'], default: 'available' },
    branchId: { type: String, default: 'gombita-1', index: true }
});

TableSchema.index({ number: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('Table', TableSchema);

const mongoose = require('mongoose');

const ItemStatsSchema = new mongoose.Schema({
    menuItemId: { type: String, required: true },
    name: String,
    totalQuantity: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    branchId: { type: String, default: 'gombita-1', index: true }
});

module.exports = mongoose.model('ItemStats', ItemStatsSchema);
